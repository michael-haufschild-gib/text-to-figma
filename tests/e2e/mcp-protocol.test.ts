/**
 * MCP Protocol E2E Tests
 *
 * Spawns the actual MCP server as a child process and communicates via
 * JSON-RPC 2.0 over stdin/stdout — exactly how a real MCP client (like
 * Claude Desktop or an LLM agent) connects to this server.
 *
 * Bug this catches:
 * - Server fails to start or crashes on initialization
 * - ListTools response missing tools or has wrong structure
 * - CallTool doesn't produce valid JSON-RPC responses
 * - Error responses don't conform to MCP protocol
 * - Server doesn't handle malformed JSON-RPC gracefully
 * - Prompts (ListPrompts, GetPrompt) return wrong content
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ChildProcess, spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startTestBridge, type TestBridgeHandle } from './helpers/test-bridge.js';
import { SimulatedFigmaPlugin } from './helpers/simulated-figma-plugin.js';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/**
 * MCP Test Client
 *
 * Spawns the MCP server, sends JSON-RPC requests over stdin,
 * reads responses from stdout.
 */
class MCPTestClient {
  private server: ChildProcess | null = null;
  private responseBuffer = '';
  private pendingResponses = new Map<
    number,
    { resolve: (v: JsonRpcResponse) => void; reject: (e: Error) => void }
  >();
  private nextId = 1;
  private ready = false;

  async start(env: Record<string, string>): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MCP server failed to start within 10s'));
      }, 10000);

      const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
      this.server = spawn('node', ['mcp-server/dist/index.js'], {
        cwd: projectRoot,
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Read stderr for startup logs
      this.server.stderr!.on('data', (data: Buffer) => {
        const text = data.toString();
        if (text.includes('Server running and ready for requests')) {
          clearTimeout(timeout);
          this.ready = true;
          resolve();
        }
      });

      // Read stdout for JSON-RPC responses
      this.server.stdout!.on('data', (data: Buffer) => {
        this.responseBuffer += data.toString();
        this.processBuffer();
      });

      this.server.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.server.on('exit', (code) => {
        if (!this.ready) {
          clearTimeout(timeout);
          reject(new Error(`MCP server exited with code ${code} before ready`));
        }
      });
    });
  }

  private processBuffer(): void {
    // JSON-RPC messages are newline-delimited
    const lines = this.responseBuffer.split('\n');
    this.responseBuffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;

      try {
        const response = JSON.parse(trimmed) as JsonRpcResponse;
        if (response.id !== undefined) {
          const pending = this.pendingResponses.get(response.id);
          if (pending) {
            this.pendingResponses.delete(response.id);
            pending.resolve(response);
          }
        }
      } catch {
        // Not JSON — ignore (might be partial data)
      }
    }
  }

  async sendRequest(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    if (!this.server?.stdin?.writable) {
      throw new Error('MCP server not started or stdin not writable');
    }

    const id = this.nextId++;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      ...(params !== undefined ? { params } : {})
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResponses.delete(id);
        reject(new Error(`Request ${method} (id=${id}) timed out`));
      }, 10000);

      this.pendingResponses.set(id, {
        resolve: (resp) => {
          clearTimeout(timeout);
          resolve(resp);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        }
      });

      this.server!.stdin!.write(JSON.stringify(request) + '\n');
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.server?.kill('SIGKILL');
        resolve();
      }, 3000);

      this.server!.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.server!.kill('SIGTERM');
    });
  }
}

let bridge: TestBridgeHandle;
let plugin: SimulatedFigmaPlugin;
let client: MCPTestClient;

beforeAll(async () => {
  // Start a test WebSocket bridge
  bridge = startTestBridge();

  // Connect simulated Figma plugin
  plugin = new SimulatedFigmaPlugin();
  await plugin.connect(bridge.wsUrl);
  await plugin.waitForRegistration(bridge.server.state);

  // Configure server environment
  const serverEnv: Record<string, string> = {
    FIGMA_WS_URL: bridge.wsUrl,
    FIGMA_REQUEST_TIMEOUT: '5000',
    FIGMA_MAX_RECONNECT_ATTEMPTS: '1',
    HEALTH_CHECK_ENABLED: 'false',
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    CIRCUIT_BREAKER_THRESHOLD: '5',
    CIRCUIT_BREAKER_RESET_TIMEOUT: '1000',
    RETRY_MAX_ATTEMPTS: '1',
    RETRY_BASE_DELAY: '50',
    RETRY_MAX_DELAY: '200'
  };

  // Start the MCP server
  client = new MCPTestClient();
  await client.start(serverEnv);

  // Initialize the MCP protocol
  const initResponse = await client.sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'e2e-test-client', version: '1.0.0' }
  });

  const initResult = initResponse.result as Record<string, unknown>;
  expect(initResult.protocolVersion).toBeTypeOf('string');

  // Server must identify itself with name and version
  const serverInfo = initResult.serverInfo as { name: string; version: string };
  expect(serverInfo.name).toBe('text-to-figma');
  expect(serverInfo.version).toMatch(/^\d+\.\d+\.\d+/);

  // Server must declare tool and prompt capabilities
  const capabilities = initResult.capabilities as Record<string, unknown>;
  expect(capabilities.tools).toBeTypeOf('object');
  expect(capabilities.prompts).toBeTypeOf('object');

  // Send initialized notification
  await client.sendRequest('notifications/initialized', {});
});

afterAll(async () => {
  await client?.stop();
  plugin?.disconnect();
  await bridge?.close();
});

describe('MCP Protocol — tools/list', () => {
  it('returns all registered tools with correct structure', async () => {
    const response = await client.sendRequest('tools/list', {});
    expect(response.error).toBeUndefined();
    const result = response.result as { tools: Array<Record<string, unknown>> };
    expect(result.tools).toBeInstanceOf(Array);
    // Tool count must be non-trivial (catches registration failures)
    expect(result.tools.length).toBeGreaterThanOrEqual(65);

    // Verify tool structure
    for (const tool of result.tools) {
      expect(tool.name).toBeTypeOf('string');
      expect((tool.name as string).length).toBeGreaterThan(0);
      expect(tool.description).toBeTypeOf('string');
      const schema = tool.inputSchema as Record<string, unknown>;
      expect(schema.type).toBe('object');
    }
  });

  it('contains expected core tools', async () => {
    const response = await client.sendRequest('tools/list', {});
    const result = response.result as { tools: Array<{ name: string }> };
    const toolNames = result.tools.map((t) => t.name);
    const expectedTools = [
      'create_frame',
      'create_text',
      'create_ellipse',
      'create_line',
      'create_polygon',
      'create_star',
      'create_path',
      'create_design',
      'create_component',
      'create_instance',
      'set_fills',
      'set_stroke',
      'set_corner_radius',
      'apply_effects',
      'set_layout_properties',
      'check_wcag_contrast',
      'validate_design_tokens',
      'check_connection',
      'get_node_by_id',
      'get_children',
      'get_page_hierarchy'
    ];

    for (const expected of expectedTools) {
      expect(toolNames).toContain(expected);
    }
  });

  it('tool names follow snake_case convention', async () => {
    const response = await client.sendRequest('tools/list', {});
    const result = response.result as { tools: Array<{ name: string }> };
    for (const tool of result.tools) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});

describe('MCP Protocol — tools/call', () => {
  it('executes check_wcag_contrast and returns contrast result', async () => {
    const response = await client.sendRequest('tools/call', {
      name: 'check_wcag_contrast',
      arguments: { foreground: '#000000', background: '#FFFFFF', fontSize: 16, fontWeight: 400 }
    });
    expect(response.error).toBeUndefined();
    const result = response.result as { content: Array<{ type: string; text: string }> };
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Contrast Ratio: 21.00:1');
    expect(result.content[0].text).toContain('PASS');
  });

  it('executes validate_design_tokens with mixed valid/invalid tokens', async () => {
    const response = await client.sendRequest('tools/call', {
      name: 'validate_design_tokens',
      arguments: {
        spacing: [8, 16, 15],
        typography: [{ fontSize: 16, name: 'body' }]
      }
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: Array<{ type: string; text: string }> };
    expect(result.content[0].text).toContain('Design Tokens Validation Report');
    expect(result.content[0].text).toContain('Suggested:');
  });

  it('executes create_frame through the full three-tier chain', async () => {
    const response = await client.sendRequest('tools/call', {
      name: 'create_frame',
      arguments: {
        name: 'MCPProtocolFrame',
        layoutMode: 'VERTICAL',
        padding: 16,
        itemSpacing: 8
      }
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: Array<{ type: string; text: string }> };
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Frame Created Successfully');
    expect(result.content[0].text).toContain('Frame ID:');

    // Verify the command reached the simulated plugin
    const cmds = plugin.getReceivedCommands().filter((c) => c.type === 'create_frame');
    expect(cmds.length).toBeGreaterThanOrEqual(1);
    const cmd = cmds[cmds.length - 1];
    expect(cmd.payload.name).toBe('MCPProtocolFrame');
  });

  it('returns error for unknown tool name', async () => {
    const response = await client.sendRequest('tools/call', {
      name: 'nonexistent_tool_xyz',
      arguments: {}
    });

    const result = response.result as {
      content?: Array<{ text: string }>;
      isError?: boolean;
    };

    if (response.error) {
      expect(response.error.message).toContain('Unknown tool');
    } else {
      expect(result.isError).toBe(true);
      expect(result.content![0].text).toContain('Unknown tool');
    }
  });

  it('returns error for invalid input', async () => {
    const response = await client.sendRequest('tools/call', {
      name: 'check_wcag_contrast',
      arguments: {
        foreground: 'not-a-color',
        background: '#FFFFFF'
      }
    });

    const result = response.result as {
      content?: Array<{ text: string }>;
      isError?: boolean;
    };

    if (response.error) {
      expect(response.error.message).toBeTypeOf('string');
    } else {
      expect(result.isError).toBe(true);
    }
  });
});

describe('MCP Protocol — multi-step workflows', () => {
  it('creates a frame then creates a child text inside it via protocol', async () => {
    const frameResponse = await client.sendRequest('tools/call', {
      name: 'create_frame',
      arguments: {
        name: 'ProtocolParent',
        layoutMode: 'VERTICAL',
        padding: 16,
        itemSpacing: 8
      }
    });
    expect(frameResponse.error).toBeUndefined();
    const frameResult = frameResponse.result as {
      content: Array<{ type: string; text: string }>;
    };
    const frameText = frameResult.content[0].text;
    const frameIdMatch = frameText.match(/Frame ID:\s*(\S+)/);
    expect(frameIdMatch).toEqual(expect.arrayContaining([expect.stringMatching(/\S+/)]));
    const parentId = frameIdMatch![1];

    const textResponse = await client.sendRequest('tools/call', {
      name: 'create_text',
      arguments: {
        content: 'Protocol Child Text',
        fontSize: 16,
        parentId
      }
    });
    expect(textResponse.error).toBeUndefined();
    const textResult = textResponse.result as {
      content: Array<{ type: string; text: string }>;
    };
    expect(textResult.content[0].text).toContain('Text Created Successfully');
    expect(textResult.content[0].text).toContain('Text ID:');
  });

  it('create_design returns node IDs that can be used for styling', async () => {
    const designResponse = await client.sendRequest('tools/call', {
      name: 'create_design',
      arguments: {
        spec: {
          type: 'frame',
          name: 'ProtocolDesign',
          props: { layoutMode: 'VERTICAL', padding: 16 },
          children: [{ type: 'text', name: 'Title', props: { content: 'Hello', fontSize: 24 } }]
        }
      }
    });
    expect(designResponse.error).toBeUndefined();
    const designResult = designResponse.result as {
      content: Array<{ type: string; text: string }>;
    };
    expect(designResult.content[0].text).toContain('Design Created Successfully');
    expect(designResult.content[0].text).toContain('Root Node ID:');

    const rootMatch = designResult.content[0].text.match(/Root Node ID:\s*(\S+)/);
    expect(rootMatch).toEqual(expect.arrayContaining([expect.stringMatching(/\S+/)]));
    const rootId = rootMatch![1];

    const styleResponse = await client.sendRequest('tools/call', {
      name: 'set_fills',
      arguments: {
        nodeId: rootId,
        color: '#0066FF'
      }
    });
    expect(styleResponse.error).toBeUndefined();
  });

  it('check_connection returns diagnostics via protocol', async () => {
    const response = await client.sendRequest('tools/call', {
      name: 'check_connection',
      arguments: {}
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: Array<{ type: string; text: string }> };
    expect(result.content[0].text).toContain('Connection Status');
    expect(result.content[0].text).toContain('Diagnostics');
  });
});

describe('MCP Protocol — JSON-RPC error handling', () => {
  it('returns error for unknown method', async () => {
    const response = await client.sendRequest('nonexistent/method', {});
    const isError =
      response.error !== undefined ||
      (response.result as { isError?: boolean } | undefined)?.isError === true;
    expect(isError).toBe(true);
  });

  it('handles tools/call with missing name field', async () => {
    const response = await client.sendRequest('tools/call', {
      arguments: { foreground: '#000000' }
    });

    const hasError =
      response.error !== undefined || (response.result as { isError?: boolean })?.isError === true;
    expect(hasError).toBe(true);
  });

  it('returns validation error for tool with empty arguments when required fields exist', async () => {
    const response = await client.sendRequest('tools/call', {
      name: 'create_text',
      arguments: {}
    });

    const result = response.result as {
      content?: Array<{ text: string }>;
      isError?: boolean;
    };

    if (response.error) {
      expect(response.error.message).toBeTypeOf('string');
    } else {
      expect(result.isError).toBe(true);
    }
  });

  it('returns validation error for off-grid spacing via protocol', async () => {
    const response = await client.sendRequest('tools/call', {
      name: 'create_frame',
      arguments: { name: 'BadGrid', padding: 15 }
    });

    const result = response.result as {
      content?: Array<{ text: string }>;
      isError?: boolean;
    };

    if (response.error) {
      expect(response.error.message).toBeTypeOf('string');
    } else {
      expect(result.isError).toBe(true);
      expect(result.content![0].text.length).toBeGreaterThan(0);
    }
  });
});

describe('MCP Protocol — prompts', () => {
  it('lists available prompts', async () => {
    const response = await client.sendRequest('prompts/list', {});

    expect(response.error).toBeUndefined();
    const result = response.result as { prompts: Array<{ name: string; description: string }> };
    expect(result.prompts).toHaveLength(2);

    const names = result.prompts.map((p) => p.name);
    expect(names).toContain('text-to-figma-system');
    expect(names).toContain('text-to-figma-examples');
  });

  it('retrieves the system prompt content', async () => {
    const response = await client.sendRequest('prompts/get', {
      name: 'text-to-figma-system'
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { messages: Array<{ role: string; content: unknown }> };
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[1].role).toBe('assistant');
  });

  it('retrieves the examples prompt content', async () => {
    const response = await client.sendRequest('prompts/get', {
      name: 'text-to-figma-examples'
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { messages: Array<{ role: string; content: unknown }> };
    expect(result.messages).toHaveLength(2);
  });
});
