/**
 * WebSocket Server Auto-Spawner
 *
 * Automatically spawns the WebSocket bridge server when the MCP server starts,
 * if it's not already running. Provides clear error messages for port conflicts.
 */

import { ChildProcess, spawn } from 'child_process';
import * as net from 'net';
import * as path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';
import { getConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_WEBSOCKET_PORT = 8080;
const STARTUP_TIMEOUT = 10000; // 10 seconds to wait for server to start
const PORT_CHECK_INTERVAL = 200; // Check every 200ms

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

async function spawnLocalServer(port: number): Promise<SpawnResult> {
  console.error(`[WebSocket Spawner] Port ${port} is free. Spawning WebSocket server...`);

  const serverPath = getWebSocketServerPath();
  console.error(`[WebSocket Spawner] Server path: ${serverPath}`);

  try {
    spawnedProcess = spawn('node', [serverPath], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(port) }
    });

    const pipeOutput = (stream: NodeJS.ReadableStream | null): void => {
      stream?.on('data', (data: Buffer) => {
        for (const line of data.toString().trim().split('\n')) {
          console.error(`[WebSocket Server] ${line}`);
        }
      });
    };
    pipeOutput(spawnedProcess.stdout);
    pipeOutput(spawnedProcess.stderr);

    spawnedProcess.on('error', (err) => {
      console.error(`[WebSocket Spawner] Failed to spawn server: ${err.message}`);
    });

    spawnedProcess.on('exit', (code, signal) => {
      if (code !== null) {
        console.error(`[WebSocket Spawner] Server exited with code ${code}`);
      } else if (signal !== null) {
        console.error(`[WebSocket Spawner] Server killed by signal ${signal}`);
      }
      spawnedProcess = null;
    });

    console.error(`[WebSocket Spawner] Waiting for server to become ready...`);
    const isReady = await waitForServerReady(port, '127.0.0.1', STARTUP_TIMEOUT);

    if (isReady) {
      console.error(`[WebSocket Spawner] WebSocket server started successfully on port ${port}`);
      return { success: true, alreadyRunning: false, spawned: true, port };
    } else {
      console.error(
        `[WebSocket Spawner] FAIL: Server failed to start within ${STARTUP_TIMEOUT / 1000}s`
      );
      spawnedProcess.kill();
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
 * Stop the spawned WebSocket server if we started it
 */
export function stopWebSocketServer(): void {
  if (spawnedProcess) {
    console.error('[WebSocket Spawner] Stopping spawned WebSocket server...');
    spawnedProcess.kill('SIGTERM');
    spawnedProcess = null;
  }
}
