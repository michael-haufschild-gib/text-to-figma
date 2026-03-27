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
const STARTUP_TIMEOUT = 10000; // 10 seconds to wait for server to start
const PORT_CHECK_INTERVAL = 200; // Check every 200ms

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
    const timeout = setTimeout(() => {
      resolve(false);
    }, 2000);

    try {
      const ws = new WebSocket(`ws://${hostname}:${port}`);

      ws.on('open', () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      });

      ws.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    } catch {
      clearTimeout(timeout);
      resolve(false);
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

/**
 * Build a SpawnResult for port-in-use errors with a user-friendly message
 */
function portInUseResult(port: number): SpawnResult {
  console.error(
    `[WebSocket Spawner] Port ${port} is already in use. ` +
      `Run 'lsof -i :${port}' to find the process, ` +
      `or set FIGMA_WS_URL to use a different port.`
  );
  return {
    success: false,
    alreadyRunning: false,
    spawned: false,
    error: `Port ${port} is already in use by another application. Run 'lsof -i :${port}' to find the process.`,
    port
  };
}

export interface SpawnResult {
  success: boolean;
  alreadyRunning: boolean;
  spawned: boolean;
  error?: string;
  port: number;
}

/**
 * Ensure the WebSocket server is running.
 * Will spawn it if not already running.
 */
export async function ensureWebSocketServer(): Promise<SpawnResult> {
  const { port, hostname, isLocal } = getWebSocketTarget();

  console.error(
    `[WebSocket Spawner] Checking if WebSocket server is running on ${hostname}:${port}...`
  );

  // First check if something is already listening
  const portUsed = await isPortInUse(port, isLocal ? '127.0.0.1' : hostname);

  if (portUsed) {
    const isReady = await isWebSocketServerReady(port, isLocal ? '127.0.0.1' : hostname);

    if (isReady) {
      console.error(`[WebSocket Spawner] WebSocket server already running on ${hostname}:${port}`);
      return { success: true, alreadyRunning: true, spawned: false, port };
    } else if (!isLocal) {
      return {
        success: false,
        alreadyRunning: false,
        spawned: false,
        error: `Remote host ${hostname}:${port} is reachable but not responding as a WebSocket server`,
        port
      };
    } else {
      return portInUseResult(port);
    }
  }

  // Remote host not reachable — cannot spawn there
  if (!isLocal) {
    console.error(
      `[WebSocket Spawner] Remote WebSocket server at ${hostname}:${port} is not reachable. ` +
        `Cannot auto-spawn on a remote host.`
    );
    return {
      success: false,
      alreadyRunning: false,
      spawned: false,
      error: `Remote WebSocket server at ${hostname}:${port} is not reachable. Start it manually or use a local FIGMA_WS_URL.`,
      port
    };
  }

  // Local host — check if we can bind the port
  const canBind = await canBindPort(port);
  if (!canBind) {
    return portInUseResult(port);
  }

  return spawnLocalServer(port);
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

async function spawnLocalServer(port: number): Promise<SpawnResult> {
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
          return { success: true, alreadyRunning: true, spawned: false, port };
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
      return { success: true, alreadyRunning: false, spawned: true, port };
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
        port
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
      port
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
