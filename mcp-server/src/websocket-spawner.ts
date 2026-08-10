/**
 * WebSocket Server Auto-Spawner
 *
 * Automatically spawns the WebSocket bridge server when the MCP server starts,
 * if it's not already running. Provides clear error messages for port conflicts.
 */

import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';
import { getConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_WEBSOCKET_PORT = 8080;
const DEFAULT_WEBSOCKET_PORT_SCAN_LIMIT = 20;
const STARTUP_TIMEOUT = 10000; // 10 seconds to wait for server to start
const PORT_CHECK_INTERVAL = 200; // Check every 200ms
const BRIDGE_SERVER_ID = 'text-to-figma-websocket-bridge';

/** PID file location — shared across all MCP server processes. */
const PID_FILE = path.join(os.tmpdir(), 'text-to-figma-ws-bridge.pid');

/** Log file for the detached bridge process. */
const BRIDGE_LOG_FILE = path.join(os.tmpdir(), 'text-to-figma-ws-bridge.log');

interface WebSocketTarget {
  port: number;
  hostname: string;
  isLocal: boolean;
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function getPortScanLimit(): number {
  const parsed = Number.parseInt(process.env.TEXT_TO_FIGMA_WS_PORT_SCAN_LIMIT ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_WEBSOCKET_PORT_SCAN_LIMIT;
  }
  return Math.min(parsed, 100);
}

function getCandidatePorts(startPort: number): number[] {
  const limit = Math.min(getPortScanLimit(), 65535 - startPort + 1);
  return Array.from({ length: limit }, (_value, index) => startPort + index);
}

function formatUrlHostname(hostname: string): string {
  return hostname.includes(':') && !hostname.startsWith('[') ? `[${hostname}]` : hostname;
}

function buildWebSocketUrl(hostname: string, port: number): string {
  return `ws://${formatUrlHostname(hostname)}:${port}`;
}

function rawDataToString(data: WebSocket.Data): string | null {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf-8');
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf-8');
  return null;
}

function isBridgeWelcomeMessage(data: WebSocket.Data): boolean {
  const messageStr = rawDataToString(data);
  if (!messageStr) return false;

  try {
    const message = JSON.parse(messageStr) as Record<string, unknown>;
    return (
      message.type === 'connection' &&
      (message.server === BRIDGE_SERVER_ID ||
        String(message.message ?? '').includes('WebSocket bridge server'))
    );
  } catch {
    return false;
  }
}

/**
 * Extract port and hostname from the configured WebSocket URL.
 * Falls back to localhost:DEFAULT_WEBSOCKET_PORT if URL parsing fails.
 */
function getWebSocketTarget(): WebSocketTarget {
  try {
    const config = getConfig();
    const url = new URL(config.FIGMA_WS_URL);
    const port = parseInt(url.port, 10);
    const hostname = url.hostname;
    return {
      port: Number.isFinite(port) && port > 0 ? port : DEFAULT_WEBSOCKET_PORT,
      hostname,
      isLocal: LOCAL_HOSTNAMES.has(hostname)
    };
  } catch {
    return { port: DEFAULT_WEBSOCKET_PORT, hostname: 'localhost', isLocal: true };
  }
}

let spawnedProcess: ChildProcess | null = null;

/**
 * Check if a port is in use by trying to connect to it
 * @param port
 * @param hostname
 */
async function isPortInUse(port: number, hostname: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 1000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, hostname);
  });
}

/**
 * Check if a port can be bound (more reliable check)
 * @param port
 */
async function canBindPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false); // Cannot bind - port is in use
    });

    server.once('listening', () => {
      server.close(() => {
        resolve(true); // Can bind - port is free
      });
    });

    // Try binding on all interfaces like the WebSocket server does
    server.listen(port);
  });
}

/**
 * Check if our WebSocket server is responding on the port
 * Uses actual WebSocket connection to verify it's a WS server
 * @param port
 * @param hostname
 */
async function isWebSocketServerReady(port: number, hostname: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let ws: WebSocket | null = null;

    const settle = (ready: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (ws) {
        ws.removeAllListeners();
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      }
      resolve(ready);
    };

    const timeout = setTimeout(() => {
      settle(false);
    }, 2000);
    timeout.unref();

    try {
      ws = new WebSocket(buildWebSocketUrl(hostname, port));

      ws.on('message', (data: WebSocket.Data) => {
        settle(isBridgeWelcomeMessage(data));
      });

      ws.on('error', () => {
        settle(false);
      });

      ws.on('close', () => {
        settle(false);
      });
    } catch {
      settle(false);
    }
  });
}

/**
 * Wait for the WebSocket server to become ready
 * @param port
 * @param hostname
 * @param timeoutMs
 */
async function waitForServerReady(
  port: number,
  hostname: string,
  timeoutMs: number
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await isWebSocketServerReady(port, hostname)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, PORT_CHECK_INTERVAL));
  }

  return false;
}

/**
 * Get the path to the WebSocket server
 */
function getWebSocketServerPath(): string {
  // From mcp-server/dist/websocket-spawner.js -> websocket-server/dist/server.js
  // We need to go up from mcp-server/dist to the repo root, then into websocket-server
  const repoRoot = path.resolve(__dirname, '..', '..');
  return path.join(repoRoot, 'websocket-server', 'dist', 'server.js');
}

export interface SpawnResult {
  success: boolean;
  alreadyRunning: boolean;
  spawned: boolean;
  error?: string;
  port: number;
  url: string;
}

/**
 * Ensure the WebSocket server is running.
 * Will spawn it if not already running.
 */
export async function ensureWebSocketServer(): Promise<SpawnResult> {
  const { port, hostname, isLocal } = getWebSocketTarget();
  const checkHostname = isLocal ? '127.0.0.1' : hostname;
  const candidatePorts = isLocal ? getCandidatePorts(port) : [port];
  let firstBindablePort: number | null = null;

  console.error(`[WebSocket Spawner] Checking WebSocket bridge ports on ${hostname}...`);

  for (const candidatePort of candidatePorts) {
    const candidateUrl = buildWebSocketUrl(hostname, candidatePort);
    console.error(`[WebSocket Spawner] Checking ${candidateUrl}...`);

    const portUsed = await isPortInUse(candidatePort, checkHostname);

    if (portUsed) {
      const isReady = await isWebSocketServerReady(candidatePort, checkHostname);

      if (isReady) {
        console.error(`[WebSocket Spawner] WebSocket bridge already running at ${candidateUrl}`);
        return {
          success: true,
          alreadyRunning: true,
          spawned: false,
          port: candidatePort,
          url: candidateUrl
        };
      }

      if (!isLocal) {
        return {
          success: false,
          alreadyRunning: false,
          spawned: false,
          error: `Remote host ${hostname}:${candidatePort} is reachable but not responding as a Text-to-Figma WebSocket bridge`,
          port: candidatePort,
          url: candidateUrl
        };
      }

      console.error(
        `[WebSocket Spawner] Port ${candidatePort} is occupied by another service; trying next port.`
      );
      continue;
    }

    // Remote host not reachable — cannot spawn there
    if (!isLocal) {
      console.error(
        `[WebSocket Spawner] Remote WebSocket bridge at ${candidateUrl} is not reachable. ` +
          `Cannot auto-spawn on a remote host.`
      );
      return {
        success: false,
        alreadyRunning: false,
        spawned: false,
        error: `Remote WebSocket bridge at ${candidateUrl} is not reachable. Start it manually or use a local FIGMA_WS_URL.`,
        port: candidatePort,
        url: candidateUrl
      };
    }

    if (firstBindablePort === null && (await canBindPort(candidatePort))) {
      firstBindablePort = candidatePort;
      console.error(`[WebSocket Spawner] Port ${candidatePort} is available if spawn is needed.`);
    }
  }

  if (firstBindablePort !== null) {
    return spawnLocalServer(firstBindablePort, hostname);
  }

  console.error(
    `[WebSocket Spawner] No available bridge port found in ${candidatePorts[0]}-${candidatePorts[candidatePorts.length - 1]}.`
  );
  return {
    success: false,
    alreadyRunning: false,
    spawned: false,
    error: `No available local WebSocket bridge port found in ${candidatePorts[0]}-${candidatePorts[candidatePorts.length - 1]}.`,
    port,
    url: buildWebSocketUrl(hostname, port)
  };
}

/**
 * Check if a previously spawned bridge is still alive via its PID file.
 * Returns true if the process exists (even if it hasn't finished starting).
 */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // signal 0 = existence check, no signal sent
    return true;
  } catch {
    return false;
  }
}

/**
 * Write the bridge PID so other MCP server processes can find it.
 */
function writePidFile(pid: number): void {
  try {
    fs.writeFileSync(PID_FILE, String(pid), { mode: 0o644 });
  } catch {
    console.error('[WebSocket Spawner] Warning: could not write PID file');
  }
}

/**
 * Clean up a stale PID file (process no longer running).
 */
function cleanPidFile(): void {
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    // Already gone — fine
  }
}

async function spawnLocalServer(port: number, hostname: string): Promise<SpawnResult> {
  const url = buildWebSocketUrl(hostname, port);

  // Check for a PID file from a previous spawn that may still be starting
  try {
    if (fs.existsSync(PID_FILE)) {
      const existingPid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
      if (Number.isFinite(existingPid) && isPidAlive(existingPid)) {
        // Process exists but port isn't ready yet — wait for it
        console.error(
          `[WebSocket Spawner] Found running bridge (PID ${existingPid}), waiting for readiness...`
        );
        const isReady = await waitForServerReady(port, '127.0.0.1', STARTUP_TIMEOUT);
        if (isReady) {
          return { success: true, alreadyRunning: true, spawned: false, port, url };
        }
        // Process alive but never became ready — kill and re-spawn
        console.error('[WebSocket Spawner] Stale bridge process, killing and re-spawning');
        try {
          process.kill(existingPid, 'SIGTERM');
        } catch {
          // Already dead
        }
      }
      cleanPidFile();
    }
  } catch {
    // PID file check failed — continue to spawn
  }

  console.error(`[WebSocket Spawner] Port ${port} is free. Spawning WebSocket server...`);

  const serverPath = getWebSocketServerPath();
  console.error(`[WebSocket Spawner] Server path: ${serverPath}`);

  try {
    // Open a log file for the detached process (stdio pipes can't survive unref)
    const logFd = fs.openSync(BRIDGE_LOG_FILE, 'a');

    spawnedProcess = spawn('node', [serverPath], {
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: { ...process.env, PORT: String(port) }
    });

    // Write PID file so other MCP servers (and future invocations) can find it
    if (spawnedProcess.pid !== undefined) {
      writePidFile(spawnedProcess.pid);
    }

    // Allow this MCP server to exit without killing the bridge
    spawnedProcess.unref();

    spawnedProcess.on('error', (err) => {
      console.error(`[WebSocket Spawner] Failed to spawn server: ${err.message}`);
      cleanPidFile();
    });

    // Close the fd in this process — the child owns it now
    fs.closeSync(logFd);

    console.error(`[WebSocket Spawner] Waiting for server to become ready...`);
    const isReady = await waitForServerReady(port, '127.0.0.1', STARTUP_TIMEOUT);

    if (isReady) {
      console.error(`[WebSocket Spawner] WebSocket server started successfully on port ${port}`);
      console.error(`[WebSocket Spawner] Bridge logs: ${BRIDGE_LOG_FILE}`);
      return { success: true, alreadyRunning: false, spawned: true, port, url };
    } else {
      console.error(
        `[WebSocket Spawner] FAIL: Server failed to start within ${STARTUP_TIMEOUT / 1000}s`
      );
      if (spawnedProcess.pid !== undefined) {
        try {
          process.kill(spawnedProcess.pid, 'SIGTERM');
        } catch {
          // Already dead
        }
      }
      cleanPidFile();
      spawnedProcess = null;
      return {
        success: false,
        alreadyRunning: false,
        spawned: false,
        error: `WebSocket server failed to start within ${STARTUP_TIMEOUT / 1000} seconds`,
        port,
        url
      };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[WebSocket Spawner] Error spawning server: ${errorMessage}`);
    return {
      success: false,
      alreadyRunning: false,
      spawned: false,
      error: errorMessage,
      port,
      url
    };
  }
}

/**
 * Explicitly stop the WebSocket bridge. Only call this when the user
 * requests a full shutdown — not on normal MCP server exit, since the
 * bridge is shared across all MCP server processes.
 */
export function stopWebSocketServer(): void {
  try {
    if (fs.existsSync(PID_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
      if (Number.isFinite(pid)) {
        console.error(`[WebSocket Spawner] Stopping WebSocket bridge (PID ${pid})...`);
        try {
          process.kill(pid, 'SIGTERM');
        } catch {
          // Already dead
        }
      }
      cleanPidFile();
    }
  } catch {
    // Best-effort cleanup
  }
  spawnedProcess = null;
}
