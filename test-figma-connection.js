#!/usr/bin/env node

/**
 * Test script to verify Figma connection and create a simple frame
 */

import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  console.log('Connected to WebSocket server');

  // Send a test message to create a frame
  const message = {
    id: `test-${Date.now()}`,
    type: 'create_frame',
    payload: {
      name: 'Test Mobile Frame',
      width: 390,
      height: 844,
      x: 100,
      y: 100
    }
  };

  console.log('Sending message:', JSON.stringify(message, null, 2));
  ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
  ws.close();
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('Connection closed');
  process.exit(0);
});

setTimeout(() => {
  console.log('Timeout - closing connection');
  ws.close();
  process.exit(1);
}, 5000);
