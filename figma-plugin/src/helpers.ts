/**
 * Shared Figma Plugin Helpers
 *
 * Utilities used across all command handlers: color conversion,
 * node lookup with caching, and common type guards.
 */

/** Convert hex color string to Figma RGB (0-1 range) */
export function hexToRgb(hex: string): RGB {
  const cleanHex = hex.replace('#', '');
  return {
    r: parseInt(cleanHex.substring(0, 2), 16) / 255,
    g: parseInt(cleanHex.substring(2, 4), 16) / 255,
    b: parseInt(cleanHex.substring(4, 6), 16) / 255
  };
}

/**
 * Node cache for recently created nodes.
 * Solves the issue where figma.getNodeById() returns null for just-created nodes.
 */
const nodeCache = new Map<string, SceneNode>();

const CACHE_MAX_SIZE = 1000;
const CACHE_EVICT_COUNT = 100;

/** Get node by ID with cache fallback */
export function getNode(nodeId: string): SceneNode | null {
  try {
    const cached = nodeCache.get(nodeId);
    if (cached) {
      return cached;
    }

    // Sync lookup is intentional — cache-miss path for recently created nodes
    // eslint-disable-next-line @figma/figma-plugins/ban-deprecated-sync-methods
    const node = figma.getNodeById(nodeId) as SceneNode | null;
    if (node) {
      nodeCache.set(nodeId, node);
    }
    return node;
  } catch {
    return null;
  }
}

/** Cache a newly created node for immediate lookups */
export function cacheNode(node: SceneNode): void {
  nodeCache.set(node.id, node);

  if (nodeCache.size > CACHE_MAX_SIZE) {
    const keysToDelete = Array.from(nodeCache.keys()).slice(0, CACHE_EVICT_COUNT);
    for (const key of keysToDelete) {
      nodeCache.delete(key);
    }
  }
}

/** Type guard: node can contain children */
export function isContainerNode(
  node: BaseNode
): node is FrameNode | GroupNode | ComponentNode | ComponentSetNode | BooleanOperationNode {
  return 'appendChild' in node;
}

/** Resolve parent from parentId or fall back to currentPage */
export function resolveParent(parentId?: string): BaseNode & ChildrenMixin {
  if (parentId) {
    const parent = getNode(parentId);
    if (parent && 'appendChild' in parent) {
      return parent as BaseNode & ChildrenMixin;
    }
    throw new Error(
      `Parent node not found: ${parentId}. Node cannot be created without valid parent.`
    );
  }
  return figma.currentPage;
}

/** Map numeric font weight to Figma style string */
export function weightToStyle(fontWeight: number): string {
  if (fontWeight >= 700) return 'Bold';
  if (fontWeight >= 600) return 'Semi Bold';
  if (fontWeight >= 500) return 'Medium';
  if (fontWeight <= 300) return 'Light';
  return 'Regular';
}

/** Load a font with fallback to Inter Regular */
export async function loadFont(family: string, weight: number): Promise<FontName> {
  const style = weightToStyle(weight);
  try {
    await figma.loadFontAsync({ family, style });
    return { family, style };
  } catch {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    return { family: 'Inter', style: 'Regular' };
  }
}

/** Convert Figma effect array from simplified format */
export function convertEffects(effects: Array<Record<string, unknown>>): Effect[] {
  return effects.map((effect) => {
    const type = effect.type as string;
    if (type === 'DROP_SHADOW' || type === 'INNER_SHADOW') {
      const rgb = hexToRgb((effect.color as string) || '#000000');
      const opacity = (effect.opacity as number) ?? 1;
      return {
        type,
        color: { ...rgb, a: opacity },
        offset: {
          x: (effect.x as number) || (effect.offsetX as number) || 0,
          y: (effect.y as number) || (effect.offsetY as number) || 0
        },
        radius: (effect.blur as number) || 0,
        spread: (effect.spread as number) || 0,
        visible: true,
        blendMode: 'NORMAL' as BlendMode
      } as DropShadowEffect | InnerShadowEffect;
    } else if (type === 'LAYER_BLUR' || type === 'BACKGROUND_BLUR') {
      return {
        type,
        radius: (effect.radius as number) || (effect.blur as number) || 0,
        visible: true
      } as BlurEffect;
    }
    return effect as unknown as Effect;
  });
}

/** Get width/height safely from any node type */
export function getNodeDimensions(node: SceneNode): { width: number; height: number } {
  return {
    width: 'width' in node ? node.width : 0,
    height: 'height' in node ? node.height : 0
  };
}
