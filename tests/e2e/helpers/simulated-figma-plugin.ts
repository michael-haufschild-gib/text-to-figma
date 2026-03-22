/**
 * Simulated Figma Plugin
 *
 * A WebSocket client that mimics the Figma plugin's behavior for e2e testing.
 * Connects to the WebSocket bridge, sends figma_hello, and responds to
 * tool commands with configurable responses.
 *
 * This replaces the real Figma desktop app in the three-tier architecture:
 *   MCP Server → WebSocket Bridge → [SimulatedFigmaPlugin]
 */

import WebSocket from 'ws';

export interface FigmaCommand {
  id: string;
  type: string;
  payload: Record<string, unknown>;
}

export type CommandHandler = (
  command: FigmaCommand
) => { success: true; data: unknown } | { success: false; error: string };

type SuccessResponse = { success: true; data: unknown };

/** Handle create_design — returns a multi-node response tree. */
function handleCreateDesign(payload: Record<string, unknown>): SuccessResponse {
  const spec = payload.spec as Record<string, unknown> | undefined;
  const rootId = `node_${Date.now()}_root`;
  const nodeIds: Record<string, string> = {};
  const nodes: Array<Record<string, unknown>> = [];

  function processSpec(
    node: Record<string, unknown>,
    parentId: string | null,
    depth: number
  ): string {
    const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const nodeName = (node.name as string) ?? `${String(node.type)}_${depth}`;
    nodeIds[nodeName] = id;
    nodes.push({
      nodeId: id,
      type: ((node.type as string) ?? 'FRAME').toUpperCase(),
      name: nodeName,
      parentId,
      bounds: { x: 0, y: 0, width: 100, height: 100 }
    });

    const children = node.children as Record<string, unknown>[] | undefined;
    if (children) {
      for (const child of children) {
        processSpec(child, id, depth + 1);
      }
    }
    return id;
  }

  const rootNodeId = spec ? processSpec(spec, (payload.parentId as string) ?? null, 0) : rootId;

  return {
    success: true,
    data: {
      rootNodeId,
      nodeIds,
      totalNodes: nodes.length,
      message: `Created ${nodes.length} nodes`,
      nodes
    }
  };
}

/** Handle query tools — return mock data for node lookups. */
function handleQueryTool(type: string, payload: Record<string, unknown>): SuccessResponse | null {
  const name = (payload.name as string) ?? type;

  if (type === 'get_node_by_id') {
    return {
      success: true,
      data: {
        exists: true,
        node: {
          id: payload.nodeId,
          name,
          type: 'FRAME',
          width: 100,
          height: 100,
          x: 0,
          y: 0,
          childrenCount: 0
        }
      }
    };
  }
  if (type === 'get_node_info') {
    return {
      success: true,
      data: {
        exists: true,
        nodeId: payload.nodeId,
        node: {
          nodeId: payload.nodeId,
          type: 'FRAME',
          name,
          visible: true,
          locked: false,
          children: []
        },
        type: 'FRAME',
        name,
        visible: true,
        locked: false,
        children: []
      }
    };
  }
  if (type === 'get_children') return { success: true, data: { children: [] } };
  if (type === 'get_parent') return { success: true, data: { parentId: null } };
  if (type === 'get_node_by_name') {
    return {
      success: true,
      data: {
        nodes: [
          {
            nodeId: payload.nodeId ?? `node_found_${Date.now()}`,
            type: 'FRAME',
            name: payload.name ?? 'Found Node',
            visible: true,
            locked: false
          }
        ]
      }
    };
  }
  if (type === 'get_page_hierarchy')
    return { success: true, data: { pages: [], currentPage: 'Page 1' } };
  if (type === 'get_selection') return { success: true, data: { selection: [], count: 0 } };
  if (type === 'get_absolute_bounds') {
    return {
      success: true,
      data: { nodeId: payload.nodeId, bounds: { x: 10, y: 20, width: 200, height: 150 } }
    };
  }
  if (type === 'get_relative_bounds') {
    const rp = {
      topLeft: { x: 0, y: 0 },
      topCenter: { x: 100, y: 0 },
      topRight: { x: 200, y: 0 },
      centerLeft: { x: 0, y: 75 },
      center: { x: 100, y: 75 },
      centerRight: { x: 200, y: 75 },
      bottomLeft: { x: 0, y: 150 },
      bottomCenter: { x: 100, y: 150 },
      bottomRight: { x: 200, y: 150 }
    };
    return {
      success: true,
      data: {
        relativeBounds: {
          relativeX: 50,
          relativeY: 30,
          distanceFromRight: 100,
          distanceFromLeft: 50,
          distanceFromTop: 30,
          distanceFromBottom: 80,
          centerDistanceX: 75,
          centerDistanceY: 55,
          width: 200,
          height: 150,
          referencePoints: rp
        },
        message: 'Relative bounds calculated'
      }
    };
  }
  if (type === 'get_plugin_data') {
    return { success: true, data: { nodeId: payload.nodeId, key: payload.key, value: '' } };
  }
  return null;
}

/** Handle page/connection/export tools. */
function handleUtilityTool(type: string, payload: Record<string, unknown>): SuccessResponse | null {
  if (type === 'list_pages') {
    return {
      success: true,
      data: {
        pages: [
          { id: 'page1', name: 'Page 1', isCurrent: true },
          { id: 'page2', name: 'Page 2', isCurrent: false }
        ]
      }
    };
  }
  if (type === 'set_current_page') {
    return {
      success: true,
      data: { pageId: payload.pageId ?? payload.name, pageName: payload.name ?? 'Page 1' }
    };
  }
  if (type === 'ping') {
    return {
      success: true,
      data: {
        pong: true,
        timestamp: Date.now(),
        pluginVersion: '1.0.0',
        fileName: 'Test File',
        currentPage: 'Page 1'
      }
    };
  }
  if (type === 'check_connection') {
    return {
      success: true,
      data: {
        connected: true,
        figmaFile: 'Test File',
        currentPage: 'Page 1',
        pluginVersion: '1.0.0'
      }
    };
  }
  if (type === 'export_node') {
    return {
      success: true,
      data: {
        imageData: 'base64encodeddata',
        format: (payload.format as string) ?? 'PNG',
        scale: (payload.scale as number) ?? 1
      }
    };
  }
  if (type === 'set_export_settings') {
    return { success: true, data: { nodeId: payload.nodeId, settingsCount: 1 } };
  }
  if (type === 'set_plugin_data') {
    return {
      success: true,
      data: { nodeId: payload.nodeId, key: payload.key, value: payload.value }
    };
  }
  return null;
}

/** Handle component tools. */
function handleComponentTool(
  type: string,
  payload: Record<string, unknown>
): SuccessResponse | null {
  const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  if (type === 'create_component') return { success: true, data: { componentId: `comp_${uid()}` } };
  if (type === 'create_instance')
    return {
      success: true,
      data: { instanceId: `inst_${uid()}`, componentId: payload.componentId }
    };
  if (type === 'create_component_set')
    return {
      success: true,
      data: { componentSetId: `compset_${uid()}`, name: payload.name ?? 'ComponentSet' }
    };
  if (type === 'add_variant_property')
    return {
      success: true,
      data: { componentSetId: payload.componentSetId, propertyName: payload.propertyName }
    };
  if (type === 'set_component_properties' || type === 'set_instance_swap')
    return { success: true, data: { updated: true } };
  if (type === 'create_boolean_operation') {
    return {
      success: true,
      data: {
        booleanNodeId: `bool_${Date.now()}`,
        operation: payload.operation,
        nodeCount: (payload.nodeIds as string[])?.length ?? 0
      }
    };
  }
  return null;
}

/** Handle style tools. */
function handleStyleTool(type: string, payload: Record<string, unknown>): SuccessResponse | null {
  if (type === 'create_color_style')
    return {
      success: true,
      data: { styleId: `style_color_${Date.now()}`, name: payload.name, color: payload.color }
    };
  if (type === 'create_text_style')
    return { success: true, data: { styleId: `style_text_${Date.now()}`, name: payload.name } };
  if (type === 'create_effect_style')
    return { success: true, data: { styleId: `style_effect_${Date.now()}`, name: payload.name } };
  if (type === 'apply_fill_style' || type === 'apply_text_style' || type === 'apply_effect_style') {
    return { success: true, data: { applied: true, nodeId: payload.nodeId } };
  }
  return null;
}

/** Handle layout and spatial tools. */
function handleLayoutTool(type: string, payload: Record<string, unknown>): SuccessResponse | null {
  if (type === 'set_layout_sizing')
    return {
      success: true,
      data: { nodeId: payload.nodeId, horizontal: payload.horizontal, vertical: payload.vertical }
    };
  if (type === 'align_nodes' || type === 'distribute_nodes')
    return { success: true, data: { aligned: true, nodeIds: payload.nodeIds } };
  if (type === 'connect_shapes')
    return {
      success: true,
      data: { connectorId: `conn_${Date.now()}`, fromId: payload.fromId, toId: payload.toId }
    };
  if (type === 'set_layer_order')
    return { success: true, data: { nodeId: payload.nodeId, order: payload.order } };
  return null;
}

/**
 * Default handler: delegates to sub-handlers by tool category.
 * Falls back to generic success for unrecognized tool types.
 */
function defaultCommandHandler(command: FigmaCommand): SuccessResponse {
  const { type, payload } = command;

  if (type === 'create_design') return handleCreateDesign(payload);

  // Delegate to sub-handlers by category
  const queryResult = handleQueryTool(type, payload);
  if (queryResult) return queryResult;

  const utilResult = handleUtilityTool(type, payload);
  if (utilResult) return utilResult;

  const compResult = handleComponentTool(type, payload);
  if (compResult) return compResult;

  const styleResult = handleStyleTool(type, payload);
  if (styleResult) return styleResult;

  const layoutResult = handleLayoutTool(type, payload);
  if (layoutResult) return layoutResult;

  // Other creation tools return a nodeId
  if (type.startsWith('create_')) {
    return {
      success: true,
      data: { nodeId: `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }
    };
  }

  // Styling/layout tools return success
  return { success: true, data: { updated: true } };
}

export class SimulatedFigmaPlugin {
  private ws: WebSocket | null = null;
  private connected = false;
  private commandHandler: CommandHandler = defaultCommandHandler;
  private receivedCommands: FigmaCommand[] = [];
  private connectionPromise: Promise<void> | null = null;

  /**
   * Connect to the WebSocket bridge and register as the Figma plugin.
   */
  async connect(wsUrl: string): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('SimulatedFigmaPlugin: connection timeout'));
      }, 5000);

      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.connected = true;

        // Register as Figma plugin
        this.ws!.send(
          JSON.stringify({
            type: 'figma_hello',
            source: 'figma-plugin'
          })
        );

        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.connectionPromise = null;
      });
    });

    return this.connectionPromise;
  }

  /**
   * Handle incoming messages from the bridge (forwarded from MCP clients).
   */
  private handleMessage(raw: string): void {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    // Ignore connection/info messages from the bridge
    if (parsed.type === 'connection' || parsed.type === 'info' || parsed.type === 'error') {
      return;
    }

    // This is a command from an MCP client routed through the bridge
    if (typeof parsed.type === 'string' && 'payload' in parsed && typeof parsed.id === 'string') {
      const command: FigmaCommand = {
        id: parsed.id,
        type: parsed.type,
        payload: (parsed.payload as Record<string, unknown>) ?? {}
      };

      this.receivedCommands.push(command);

      const result = this.commandHandler(command);

      // Send response back through the bridge
      this.ws!.send(
        JSON.stringify({
          id: command.id,
          success: result.success,
          ...(result.success ? { data: result.data } : { error: result.error })
        })
      );
    }
  }

  /**
   * Set a custom command handler for specific test scenarios.
   */
  setCommandHandler(handler: CommandHandler): void {
    this.commandHandler = handler;
  }

  /**
   * Reset to the default command handler.
   */
  resetCommandHandler(): void {
    this.commandHandler = defaultCommandHandler;
  }

  /**
   * Get all commands received during this session.
   */
  getReceivedCommands(): FigmaCommand[] {
    return [...this.receivedCommands];
  }

  /**
   * Get the last command received.
   */
  getLastCommand(): FigmaCommand | undefined {
    return this.receivedCommands[this.receivedCommands.length - 1];
  }

  /**
   * Clear the received commands log.
   */
  clearCommands(): void {
    this.receivedCommands = [];
  }

  /**
   * Wait until a specific number of commands have been received.
   */
  async waitForCommands(count: number, timeoutMs = 5000): Promise<FigmaCommand[]> {
    const start = Date.now();
    while (this.receivedCommands.length < count) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `Timed out waiting for ${count} commands (received ${this.receivedCommands.length})`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return [...this.receivedCommands];
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Wait until the plugin is fully registered with the bridge.
   * Polls the bridge state to confirm figmaPluginClient is set,
   * replacing non-deterministic setTimeout waits.
   */
  async waitForRegistration(
    bridgeState: { figmaPluginClient: string | null },
    timeoutMs = 5000
  ): Promise<void> {
    const start = Date.now();
    while (bridgeState.figmaPluginClient === null) {
      if (Date.now() - start > timeoutMs) {
        throw new Error('Timed out waiting for Figma plugin registration with bridge');
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  /**
   * Disconnect from the bridge.
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.connectionPromise = null;
  }
}
