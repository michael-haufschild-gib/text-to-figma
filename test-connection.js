/**
 * Test script to verify WebSocket server and MCP connections
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:8080';
const TEST_TIMEOUT = 10000; // 10 seconds

console.log('Text-to-Figma Connection Test');
console.log('=============================\n');

// Test WebSocket server connection
console.log(`1. Testing WebSocket server at ${WS_URL}...`);

const ws = new WebSocket(WS_URL);
let connected = false;
let messageReceived = false;

// Set timeout for test
const timeout = setTimeout(() => {
  if (!connected) {
    console.error('❌ FAIL: Could not connect to WebSocket server');
    process.exit(1);
  } else if (!messageReceived) {
    console.error('❌ FAIL: Did not receive welcome message from server');
    process.exit(1);
  }
}, TEST_TIMEOUT);

ws.on('open', () => {
  connected = true;
  console.log('✅ SUCCESS: Connected to WebSocket server');
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📨 Received message:', message);

    if (message.type === 'connection') {
      messageReceived = true;
      console.log(`✅ SUCCESS: Welcome message received (Client ID: ${message.clientId})`);

      // Send a test request
      console.log('\n2. Testing request/response flow...');
      const testRequest = {
        id: 'test-request-123',
        type: 'create_frame',
        payload: {
          name: 'Test Frame',
          width: 100,
          height: 100
        }
      };

      console.log('📤 Sending test request:', testRequest);
      ws.send(JSON.stringify(testRequest));

      // Wait for response (or timeout)
      setTimeout(() => {
        console.log('\n3. Checking for connected clients...');
        console.log('   - Check WebSocket server output for "Client connected" messages');
        console.log('   - Expected: 2 clients (MCP server + this test script)');
        console.log('   - If Figma plugin is open: 3 clients\n');

        console.log('Test completed!');
        console.log('\nConnection Summary:');
        console.log('- WebSocket Server: ✅ Running and accepting connections');
        console.log('- MCP Server: ✅ Should be connected (check for client-* in logs)');
        console.log('- Figma Plugin: ⏳ Open Figma and run the plugin to connect');

        clearTimeout(timeout);
        ws.close();
        process.exit(0);
      }, 2000);
    }
  } catch (error) {
    console.error('Error parsing message:', error);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
  clearTimeout(timeout);
  process.exit(1);
});

ws.on('close', () => {
  if (!messageReceived) {
    console.error('❌ FAIL: Connection closed before receiving welcome message');
    clearTimeout(timeout);
    process.exit(1);
  }
});
