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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEBSOCKET_PORT = 8080;
const STARTUP_TIMEOUT = 10000; // 10 seconds to wait for server to start
const PORT_CHECK_INTERVAL = 200; // Check every 200ms

let spawnedProcess: ChildProcess | null = null;

/**
 * Check if a port is in use by trying to connect to it
 * @param port
 */
async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 1000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true); // Port is in use - something is listening
    });

    socket.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timeout);
      socket.destroy();
      if (err.code === 'ECONNREFUSED') {
        resolve(false); // Port is free - nothing listening
      } else {
        resolve(false); // Assume free on other errors
      }
    });

    socket.connect(port, '127.0.0.1');
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
 */
async function isWebSocketServerReady(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, 2000);

    try {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);

      ws.on('open', () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true); // Successfully connected to a WebSocket server
      });

      ws.on('error', () => {
        clearTimeout(timeout);
        resolve(false); // Not a WebSocket server
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
 * @param timeoutMs
 */
async function waitForServerReady(port: number, timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await isWebSocketServerReady(port)) {
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
  const port = WEBSOCKET_PORT;

  console.error(`[WebSocket Spawner] Checking if WebSocket server is running on port ${port}...`);

  // First check if something is already listening on the port
  const portInUse = await isPortInUse(port);

  if (portInUse) {
    // Port has something listening - check if it responds like a WebSocket server
    const isReady = await isWebSocketServerReady(port);

    if (isReady) {
      console.error(`[WebSocket Spawner] WebSocket server already running on port ${port}`);
      return {
        success: true,
        alreadyRunning: true,
        spawned: false,
        port
      };
    } else {
      return portInUseResult(port);
    }
  }

  // Nothing listening, but check if we can actually bind the port
  const canBind = await canBindPort(port);
  if (!canBind) {
    return portInUseResult(port);
  }

  // Port is free - spawn the WebSocket server
  console.error(`[WebSocket Spawner] Port ${port} is free. Spawning WebSocket server...`);

  const serverPath = getWebSocketServerPath();
  console.error(`[WebSocket Spawner] Server path: ${serverPath}`);

  try {
    // Spawn the WebSocket server as a detached process
    spawnedProcess = spawn('node', [serverPath], {
      detached: false, // Keep attached so it terminates with the MCP server
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: String(port)
      }
    });

    // Log output from the spawned process
    spawnedProcess.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        console.error(`[WebSocket Server] ${line}`);
      }
    });

    spawnedProcess.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        console.error(`[WebSocket Server] ${line}`);
      }
    });

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

    // Wait for the server to become ready
    console.error(`[WebSocket Spawner] Waiting for server to become ready...`);
    const isReady = await waitForServerReady(port, STARTUP_TIMEOUT);

    if (isReady) {
      console.error(`[WebSocket Spawner] ✓ WebSocket server started successfully on port ${port}`);
      return {
        success: true,
        alreadyRunning: false,
        spawned: true,
        port
      };
    } else {
      console.error(
        `[WebSocket Spawner] ✗ WebSocket server failed to start within ${STARTUP_TIMEOUT / 1000} seconds`
      );
      // Kill the process if it's still running but not responding
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
