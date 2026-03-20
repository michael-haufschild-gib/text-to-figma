/**
 * Set Constraints Tool
 *
 * Configures layout constraints for Figma nodes including:
 * - Horizontal/vertical constraints (MIN, MAX, STRETCH, CENTER, SCALE)
 * - Pinning to parent edges
 * - Aspect ratio locking
 * - Responsive behavior
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Horizontal constraint types
 * - MIN: Pin to left (like CSS: left: 0)
 * - MAX: Pin to right (like CSS: right: 0)
 * - STRETCH: Pin to both edges (like CSS: left: 0; right: 0)
 * - CENTER: Center horizontally (like CSS: margin: 0 auto)
 * - SCALE: Scale proportionally with parent
 */
export const horizontalConstraintSchema = z.enum(['MIN', 'MAX', 'STRETCH', 'CENTER', 'SCALE']);
export type HorizontalConstraint = z.infer<typeof horizontalConstraintSchema>;

/**
 * Vertical constraint types
 * - MIN: Pin to top (like CSS: top: 0)
 * - MAX: Pin to bottom (like CSS: bottom: 0)
 * - STRETCH: Pin to both edges (like CSS: top: 0; bottom: 0)
 * - CENTER: Center vertically (like CSS: margin: auto 0)
 * - SCALE: Scale proportionally with parent
 */
export const verticalConstraintSchema = z.enum(['MIN', 'MAX', 'STRETCH', 'CENTER', 'SCALE']);
export type VerticalConstraint = z.infer<typeof verticalConstraintSchema>;

/**
 * Input schema for set_constraints tool
 */
export const SetConstraintsInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to set constraints on'),
  horizontal: horizontalConstraintSchema.optional().describe('Horizontal constraint behavior'),
  vertical: verticalConstraintSchema.optional().describe('Vertical constraint behavior'),
  aspectRatioLocked: z.boolean().optional().describe('Lock aspect ratio when resizing'),
  pinLeft: z.boolean().optional().describe('Pin to left edge of parent'),
  pinRight: z.boolean().optional().describe('Pin to right edge of parent'),
  pinTop: z.boolean().optional().describe('Pin to top edge of parent'),
  pinBottom: z.boolean().optional().describe('Pin to bottom edge of parent')
});

export type SetConstraintsInput = z.infer<typeof SetConstraintsInputSchema>;

/**
 * Result of setting constraints
 */
export interface SetConstraintsResult {
  nodeId: string;
  applied: string[];
  cssEquivalent: string;
  description: string;
}

/**
 * Generate CSS equivalent for constraints
 * @param input
 */
function generateCssEquivalent(input: SetConstraintsInput): string {
  const cssRules: string[] = ['position: absolute;'];

  // Handle pinning
  if (input.pinLeft === true) {
    cssRules.push('left: 0;');
  }
  if (input.pinRight === true) {
    cssRules.push('right: 0;');
  }
  if (input.pinTop === true) {
    cssRules.push('top: 0;');
  }
  if (input.pinBottom === true) {
    cssRules.push('bottom: 0;');
  }

  // Handle horizontal constraints
  if (input.horizontal === 'CENTER' && !input.pinLeft && !input.pinRight) {
    cssRules.push('left: 50%;');
    cssRules.push('transform: translateX(-50%);');
  } else if (input.horizontal === 'STRETCH') {
    if (!input.pinLeft) {
      cssRules.push('left: 0;');
    }
    if (!input.pinRight) {
      cssRules.push('right: 0;');
    }
  }

  // Handle vertical constraints
  if (input.vertical === 'CENTER' && !input.pinTop && !input.pinBottom) {
    const hasTransform = cssRules.some((rule) => rule.includes('transform'));
    if (hasTransform) {
      // Update existing transform
      const transformIndex = cssRules.findIndex((rule) => rule.includes('transform'));
      cssRules[transformIndex] = 'transform: translate(-50%, -50%);';
    } else {
      cssRules.push('transform: translateY(-50%);');
    }
    cssRules.push('top: 50%;');
  } else if (input.vertical === 'STRETCH') {
    if (!input.pinTop) {
      cssRules.push('top: 0;');
    }
    if (!input.pinBottom) {
      cssRules.push('bottom: 0;');
    }
  }

  // Handle aspect ratio
  if (input.aspectRatioLocked === true) {
    cssRules.push('aspect-ratio: auto; /* Maintain aspect ratio */');
  }

  return cssRules.map((rule) => `  ${rule}`).join('\n');
}

/**
 * Generate human-readable description
 * @param input
 */
function generateDescription(input: SetConstraintsInput): string {
  const parts: string[] = [];

  if (input.horizontal) {
    const descriptions: Record<HorizontalConstraint, string> = {
      MIN: 'pinned to left edge',
      MAX: 'pinned to right edge',
      STRETCH: 'stretches horizontally with parent',
      CENTER: 'centered horizontally',
      SCALE: 'scales horizontally with parent'
    };
    parts.push(descriptions[input.horizontal]);
  }

  if (input.vertical) {
    const descriptions: Record<VerticalConstraint, string> = {
      MIN: 'pinned to top edge',
      MAX: 'pinned to bottom edge',
      STRETCH: 'stretches vertically with parent',
      CENTER: 'centered vertically',
      SCALE: 'scales vertically with parent'
    };
    parts.push(descriptions[input.vertical]);
  }

  const pinParts: string[] = [];
  if (input.pinLeft === true) {
    pinParts.push('left');
  }
  if (input.pinRight === true) {
    pinParts.push('right');
  }
  if (input.pinTop === true) {
    pinParts.push('top');
  }
  if (input.pinBottom === true) {
    pinParts.push('bottom');
  }

  if (pinParts.length > 0) {
    parts.push(`pinned to ${pinParts.join(', ')} edge${pinParts.length > 1 ? 's' : ''}`);
  }

  if (input.aspectRatioLocked === true) {
    parts.push('aspect ratio locked');
  }

  if (parts.length === 0) {
    return 'No constraints applied';
  }

  return `Element ${parts.join(', ')}`;
}

/**
 * Sets layout constraints on a Figma node
 * @param input
 */
export async function setConstraints(input: SetConstraintsInput): Promise<SetConstraintsResult> {
  // Validate input
  const validated = input;

  // Resolve pinning conflicts with constraint settings
  const resolvedInput = { ...validated };

  // If STRETCH is set, ensure both pins are enabled
  if (resolvedInput.horizontal === 'STRETCH') {
    resolvedInput.pinLeft = resolvedInput.pinLeft ?? true;
    resolvedInput.pinRight = resolvedInput.pinRight ?? true;
  }

  if (resolvedInput.vertical === 'STRETCH') {
    resolvedInput.pinTop = resolvedInput.pinTop ?? true;
    resolvedInput.pinBottom = resolvedInput.pinBottom ?? true;
  }

  // If both pins are set, constraint should be STRETCH
  if (
    resolvedInput.pinLeft === true &&
    resolvedInput.pinRight === true &&
    !resolvedInput.horizontal
  ) {
    resolvedInput.horizontal = 'STRETCH';
  }

  if (
    resolvedInput.pinTop === true &&
    resolvedInput.pinBottom === true &&
    !resolvedInput.vertical
  ) {
    resolvedInput.vertical = 'STRETCH';
  }

  // Generate CSS and description
  const cssEquivalent = generateCssEquivalent(resolvedInput);
  const description = generateDescription(resolvedInput);

  // Build list of applied constraints
  const applied: string[] = [];
  if (resolvedInput.horizontal) {
    applied.push(`horizontal: ${resolvedInput.horizontal}`);
  }
  if (resolvedInput.vertical) {
    applied.push(`vertical: ${resolvedInput.vertical}`);
  }
  if (resolvedInput.aspectRatioLocked) {
    applied.push('aspectRatioLocked');
  }
  if (resolvedInput.pinLeft) {
    applied.push('pinLeft');
  }
  if (resolvedInput.pinRight) {
    applied.push('pinRight');
  }
  if (resolvedInput.pinTop) {
    applied.push('pinTop');
  }
  if (resolvedInput.pinBottom) {
    applied.push('pinBottom');
  }

  // Send to Figma
  const bridge = getFigmaBridge();
  await bridge.sendToFigmaWithRetry<{ nodeId: string }>('set_constraints', {
    nodeId: resolvedInput.nodeId,
    constraints: {
      horizontal: resolvedInput.horizontal,
      vertical: resolvedInput.vertical
    },
    aspectRatioLocked: resolvedInput.aspectRatioLocked,
    pinLeft: resolvedInput.pinLeft,
    pinRight: resolvedInput.pinRight,
    pinTop: resolvedInput.pinTop,
    pinBottom: resolvedInput.pinBottom
  });

  return {
    nodeId: validated.nodeId,
    applied,
    cssEquivalent,
    description
  };
}

/**
 * Tool definition for MCP
 */
export const setConstraintsToolDefinition = {
  name: 'set_constraints',
  description: `Sets layout constraints on a Figma node for responsive behavior.

HTML/CSS Analogy: Similar to CSS positioning with absolute positioning and pinning.

Constraint Types:
- MIN: Pin to start edge (left/top) - like CSS 'left: 0' or 'top: 0'
- MAX: Pin to end edge (right/bottom) - like CSS 'right: 0' or 'bottom: 0'
- STRETCH: Pin to both edges - like CSS 'left: 0; right: 0' or 'top: 0; bottom: 0'
- CENTER: Center in parent - like CSS 'margin: auto'
- SCALE: Scale proportionally with parent

Pin Properties:
- pinLeft, pinRight, pinTop, pinBottom: Explicitly pin to specific edges
- Pinning both horizontal edges automatically sets horizontal: STRETCH
- Pinning both vertical edges automatically sets vertical: STRETCH

Aspect Ratio:
- aspectRatioLocked: Maintains aspect ratio when resizing (like CSS aspect-ratio)

Common Patterns:
1. Fixed position in corner:
   horizontal: MIN, vertical: MIN, pinLeft: true, pinTop: true

2. Center horizontally and vertically:
   horizontal: CENTER, vertical: CENTER

3. Full width, fixed height:
   horizontal: STRETCH, pinLeft: true, pinRight: true

4. Responsive with locked aspect ratio:
   horizontal: SCALE, vertical: SCALE, aspectRatioLocked: true`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node to set constraints on'
      },
      horizontal: {
        type: 'string' as const,
        enum: ['MIN', 'MAX', 'STRETCH', 'CENTER', 'SCALE'],
        description: 'Horizontal constraint behavior'
      },
      vertical: {
        type: 'string' as const,
        enum: ['MIN', 'MAX', 'STRETCH', 'CENTER', 'SCALE'],
        description: 'Vertical constraint behavior'
      },
      aspectRatioLocked: {
        type: 'boolean' as const,
        description: 'Lock aspect ratio when resizing'
      },
      pinLeft: {
        type: 'boolean' as const,
        description: 'Pin to left edge of parent'
      },
      pinRight: {
        type: 'boolean' as const,
        description: 'Pin to right edge of parent'
      },
      pinTop: {
        type: 'boolean' as const,
        description: 'Pin to top edge of parent'
      },
      pinBottom: {
        type: 'boolean' as const,
        description: 'Pin to bottom edge of parent'
      }
    },
    required: ['nodeId']
  }
};
