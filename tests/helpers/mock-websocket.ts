/**
 * Mock WebSocket for Figma Bridge Tests
 *
 * Provides a controllable WebSocket stub that emits events
 * to simulate real connection lifecycle without a server.
 */

import { EventEmitter } from 'events';
import { vi } from 'vitest';

/** Track all created MockWebSocket instances so tests can interact with them */
export let mockWsInstances: MockWebSocket[] = [];

export function resetMockWsInstances(): void {
  mockWsInstances = [];
}

export class MockWebSocket extends EventEmitter {
  static OPEN = 1;
  static CLOSED = 3;
  static CONNECTING = 0;
  readyState = 0; // Start as CONNECTING
  send = vi.fn();
  // close() sets readyState but does NOT emit 'close' —
  // the real WebSocket fires 'close' asynchronously. Tests that need
  // to simulate unexpected disconnect call emit('close') directly.
  close = vi.fn(function (this: MockWebSocket) {
    this.readyState = 3;
  });

  constructor(_url: string) {
    super();
    mockWsInstances.push(this);
  }

  /** Test helper: simulate successful connection */
  simulateOpen(): void {
    this.readyState = 1; // OPEN
    this.emit('open');
  }

  /** Test helper: simulate incoming message */
  simulateMessage(data: string | Buffer): void {
    this.emit('message', data);
  }

  /** Test helper: simulate connection error */
  simulateError(message: string): void {
    this.emit('error', new Error(message));
  }
}
