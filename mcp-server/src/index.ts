#!/usr/bin/env node

/**
 * Text-to-Figma MCP Server
 *
 * Provides design constraint validation and Figma integration
 * through the Model Context Protocol.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest
} from '@modelcontextprotocol/sdk/types.js';
import {
  hexToRgb,
  validateContrast,
  validateSpacing,
  validateTypography,
  type ContrastValidationResult,
  type RGB,
  type SpacingConstraintResult,
  type TypographyConstraintResult
} from './constraints/index.js';
import { getFigmaBridge } from './figma-bridge.js';

// Import new tools
import { getConfig, loadConfig } from './config.js';
import { startHealthCheck, stopHealthCheck } from './health.js';
import { getFewShotExamples, getFewShotPrompt } from './prompts/few-shot.js';
import { getZeroShotPrompt } from './prompts/zero-shot.js';
import {
  addGradientFill,
  addGradientFillToolDefinition,
  type AddGradientFillInput
} from './tools/add_gradient_fill.js';
import {
  addLayoutGrid,
  addLayoutGridToolDefinition,
  type AddLayoutGridInput
} from './tools/add_layout_grid.js';
import {
  addVariantProperty,
  addVariantPropertyToolDefinition,
  type AddVariantPropertyInput
} from './tools/add_variant_property.js';
import {
  applyEffectStyle,
  applyEffectStyleToolDefinition,
  type ApplyEffectStyleInput
} from './tools/apply_effect_style.js';
import {
  applyEffects,
  applyEffectsToolDefinition,
  type ApplyEffectsInput
} from './tools/apply_effects.js';
import {
  applyFillStyle,
  applyFillStyleToolDefinition,
  type ApplyFillStyleInput
} from './tools/apply_fill_style.js';
import {
  applyTextStyle,
  applyTextStyleToolDefinition,
  type ApplyTextStyleInput
} from './tools/apply_text_style.js';
import {
  checkWcagContrast,
  checkWcagContrastToolDefinition,
  formatContrastCheckResult,
  type CheckWcagContrastInput
} from './tools/check_wcag_contrast.js';
import {
  createBooleanOperation,
  createBooleanOperationToolDefinition,
  type CreateBooleanOperationInput
} from './tools/create_boolean_operation.js';
import {
  createColorStyle,
  createColorStyleToolDefinition,
  type CreateColorStyleInput
} from './tools/create_color_style.js';
import {
  createComponent,
  createComponentToolDefinition,
  type CreateComponentInput
} from './tools/create_component.js';
import {
  createComponentSet,
  createComponentSetToolDefinition,
  type CreateComponentSetInput
} from './tools/create_component_set.js';
import {
  createEffectStyle,
  createEffectStyleToolDefinition,
  type CreateEffectStyleInput
} from './tools/create_effect_style.js';
import {
  createEllipse,
  createEllipseToolDefinition,
  type CreateEllipseInput
} from './tools/create_ellipse.js';
import {
  createFrame,
  createFrameToolDefinition,
  type CreateFrameInput
} from './tools/create_frame.js';
import {
  createInstance,
  createInstanceToolDefinition,
  type CreateInstanceInput
} from './tools/create_instance.js';
import { createLine, createLineToolDefinition, type CreateLineInput } from './tools/create_line.js';
import { createPage, createPageToolDefinition, type CreatePageInput } from './tools/create_page.js';
import {
  createPolygon,
  createPolygonToolDefinition,
  type CreatePolygonInput
} from './tools/create_polygon.js';
import {
  createRectangleWithImageFill,
  createRectangleWithImageFillToolDefinition,
  type CreateRectangleWithImageFillInput
} from './tools/create_rectangle_with_image_fill.js';
import { createStar, createStarToolDefinition, type CreateStarInput } from './tools/create_star.js';
import { createText, createTextToolDefinition, type CreateTextInput } from './tools/create_text.js';
import {
  createTextStyle,
  createTextStyleToolDefinition,
  type CreateTextStyleInput
} from './tools/create_text_style.js';
import { exportNode, exportNodeToolDefinition, type ExportNodeInput } from './tools/export_node.js';
import { flipNode, flipNodeToolDefinition, type FlipNodeInput } from './tools/flip_node.js';
import {
  getAbsoluteBounds,
  getAbsoluteBoundsToolDefinition,
  type GetAbsoluteBoundsInput
} from './tools/get_absolute_bounds.js';
import {
  getChildren,
  getChildrenToolDefinition,
  type GetChildrenInput
} from './tools/get_children.js';
import {
  getNodeById,
  getNodeByIdToolDefinition,
  type GetNodeByIdInput
} from './tools/get_node_by_id.js';
import {
  getNodeByName,
  getNodeByNameToolDefinition,
  type GetNodeByNameInput
} from './tools/get_node_by_name.js';
import { getParent, getParentToolDefinition, type GetParentInput } from './tools/get_parent.js';
import {
  getPluginData,
  getPluginDataToolDefinition,
  type GetPluginDataInput
} from './tools/get_plugin_data.js';
import { listPages, listPagesToolDefinition, type ListPagesInput } from './tools/list_pages.js';
import {
  setAbsolutePosition,
  setAbsolutePositionToolDefinition,
  type SetAbsolutePositionInput
} from './tools/set_absolute_position.js';
import {
  setBlendMode,
  setBlendModeToolDefinition,
  type SetBlendModeInput
} from './tools/set_blend_mode.js';
import {
  setClippingMask,
  setClippingMaskToolDefinition,
  type SetClippingMaskInput
} from './tools/set_clipping_mask.js';
import {
  setComponentProperties,
  setComponentPropertiesToolDefinition,
  type SetComponentPropertiesInput
} from './tools/set_component_properties.js';
import {
  setConstraints,
  setConstraintsToolDefinition,
  type SetConstraintsInput
} from './tools/set_constraints.js';
import {
  setCornerRadius,
  setCornerRadiusToolDefinition,
  type SetCornerRadiusInput
} from './tools/set_corner_radius.js';
import {
  setCurrentPage,
  setCurrentPageToolDefinition,
  type SetCurrentPageInput
} from './tools/set_current_page.js';
import {
  setExportSettings,
  setExportSettingsToolDefinition,
  type SetExportSettingsInput
} from './tools/set_export_settings.js';
import { setFills, setFillsToolDefinition, type SetFillsInput } from './tools/set_fills.js';
import {
  setImageFill,
  setImageFillToolDefinition,
  type SetImageFillInput
} from './tools/set_image_fill.js';
import {
  setInstanceSwap,
  setInstanceSwapToolDefinition,
  type SetInstanceSwapInput
} from './tools/set_instance_swap.js';
import {
  setLayoutAlign,
  setLayoutAlignToolDefinition,
  type SetLayoutAlignInput
} from './tools/set_layout_align.js';
import {
  setLayoutProperties,
  setLayoutPropertiesToolDefinition,
  type SetLayoutPropertiesInput
} from './tools/set_layout_properties.js';
import {
  setLayoutSizing,
  setLayoutSizingToolDefinition,
  type SetLayoutSizingInput
} from './tools/set_layout_sizing.js';
import {
  setLetterSpacing,
  setLetterSpacingToolDefinition,
  type SetLetterSpacingInput
} from './tools/set_letter_spacing.js';
import { setLocked, setLockedToolDefinition, type SetLockedInput } from './tools/set_locked.js';
import { setOpacity, setOpacityToolDefinition, type SetOpacityInput } from './tools/set_opacity.js';
import {
  setParagraphSpacing,
  setParagraphSpacingToolDefinition,
  type SetParagraphSpacingInput
} from './tools/set_paragraph_spacing.js';
import {
  setPluginData,
  setPluginDataToolDefinition,
  type SetPluginDataInput
} from './tools/set_plugin_data.js';
import {
  setRotation,
  setRotationToolDefinition,
  type SetRotationInput
} from './tools/set_rotation.js';
import { setScale, setScaleToolDefinition, type SetScaleInput } from './tools/set_scale.js';
import { setSize, setSizeToolDefinition, type SetSizeInput } from './tools/set_size.js';
import { setStroke, setStrokeToolDefinition, type SetStrokeInput } from './tools/set_stroke.js';
import {
  setStrokeCap,
  setStrokeCapToolDefinition,
  type SetStrokeCapInput
} from './tools/set_stroke_cap.js';
import {
  setStrokeJoin,
  setStrokeJoinToolDefinition,
  type SetStrokeJoinInput
} from './tools/set_stroke_join.js';
import {
  setTextCase,
  setTextCaseToolDefinition,
  type SetTextCaseInput
} from './tools/set_text_case.js';
import {
  setTextDecoration,
  setTextDecorationToolDefinition,
  type SetTextDecorationInput
} from './tools/set_text_decoration.js';
import { setVisible, setVisibleToolDefinition, type SetVisibleInput } from './tools/set_visible.js';
import {
  formatValidationReport,
  validateDesignTokens,
  validateDesignTokensToolDefinition,
  type DesignTokensInput
} from './tools/validate_design_tokens.js';

// New drawing helper tools
import { alignNodes, alignNodesToolDefinition, type AlignNodesInput } from './tools/align_nodes.js';
import {
  connectShapes,
  connectShapesToolDefinition,
  type ConnectShapesInput
} from './tools/connect_shapes.js';

import { createPath, createPathToolDefinition, type CreatePathInput } from './tools/create_path.js';
import {
  distributeNodes,
  distributeNodesToolDefinition,
  type DistributeNodesInput
} from './tools/distribute_nodes.js';
import {
  getRelativeBounds,
  getRelativeBoundsToolDefinition,
  type GetRelativeBoundsInput
} from './tools/get_relative_bounds.js';
import {
  setLayerOrder,
  setLayerOrderToolDefinition,
  type SetLayerOrderInput
} from './tools/set_layer_order.js';

/**
 * Initialize MCP Server
 */
const server = new Server(
  {
    name: 'text-to-figma',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {},
      prompts: {}
    }
  }
);

/**
 * Available tools definition
 */
const TOOLS = [
  // Creation and manipulation tools
  createFrameToolDefinition,
  setLayoutPropertiesToolDefinition,
  createTextToolDefinition,
  setFillsToolDefinition,

  // Component tools
  createComponentToolDefinition,
  createInstanceToolDefinition,
  setComponentPropertiesToolDefinition,
  applyEffectsToolDefinition,
  setConstraintsToolDefinition,

  // Image primitives
  createRectangleWithImageFillToolDefinition,
  setImageFillToolDefinition,

  // Vector primitives
  createEllipseToolDefinition,
  createLineToolDefinition,

  // Gradient and styling primitives
  addGradientFillToolDefinition,
  setCornerRadiusToolDefinition,
  setStrokeToolDefinition,

  // Vector shape primitives
  createPolygonToolDefinition,
  createStarToolDefinition,

  // Transform primitives
  setRotationToolDefinition,
  setAbsolutePositionToolDefinition,
  setSizeToolDefinition,

  // Typography primitives
  setTextDecorationToolDefinition,
  setLetterSpacingToolDefinition,
  setTextCaseToolDefinition,

  // Boolean operations
  createBooleanOperationToolDefinition,

  // Visual effects primitives
  setBlendModeToolDefinition,
  setOpacityToolDefinition,

  // Advanced stroke primitives
  setStrokeJoinToolDefinition,
  setStrokeCapToolDefinition,

  // Style system primitives
  createColorStyleToolDefinition,
  applyFillStyleToolDefinition,
  createTextStyleToolDefinition,
  applyTextStyleToolDefinition,
  createEffectStyleToolDefinition,
  applyEffectStyleToolDefinition,

  // Clipping and masking
  setClippingMaskToolDefinition,

  // Advanced typography
  setParagraphSpacingToolDefinition,

  // Component variant primitives
  createComponentSetToolDefinition,
  addVariantPropertyToolDefinition,

  // Node selection and navigation
  getNodeByIdToolDefinition,
  getNodeByNameToolDefinition,

  // Layout grids
  addLayoutGridToolDefinition,

  // Transform primitives
  flipNodeToolDefinition,

  // Node management
  setVisibleToolDefinition,
  setLockedToolDefinition,

  // Export primitives
  setExportSettingsToolDefinition,
  exportNodeToolDefinition,

  // Node tree navigation
  getChildrenToolDefinition,
  getParentToolDefinition,

  // Plugin data primitives
  setPluginDataToolDefinition,
  getPluginDataToolDefinition,

  // Component instance primitives
  setInstanceSwapToolDefinition,

  // Advanced transform primitives
  setScaleToolDefinition,

  // Page management primitives
  createPageToolDefinition,
  listPagesToolDefinition,
  setCurrentPageToolDefinition,

  // Positioning and bounds primitives
  getAbsoluteBoundsToolDefinition,
  getRelativeBoundsToolDefinition,

  // Advanced layout primitives
  setLayoutSizingToolDefinition,
  setLayoutAlignToolDefinition,

  // Drawing helper tools
  alignNodesToolDefinition,
  distributeNodesToolDefinition,
  setLayerOrderToolDefinition,
  connectShapesToolDefinition,

  // Custom path primitives
  createPathToolDefinition,

  // Validation tools
  validateDesignTokensToolDefinition,
  checkWcagContrastToolDefinition,

  // Legacy validation tools
  {
    name: 'validate_spacing',
    description: 'Validates spacing values against the 8pt grid system',
    inputSchema: {
      type: 'object' as const,
      properties: {
        value: {
          type: 'number' as const,
          description: 'Spacing value in pixels to validate'
        }
      },
      required: ['value']
    }
  },
  {
    name: 'validate_typography',
    description: 'Validates font sizes against the modular type scale',
    inputSchema: {
      type: 'object' as const,
      properties: {
        fontSize: {
          type: 'number' as const,
          description: 'Font size in pixels to validate'
        }
      },
      required: ['fontSize']
    }
  },
  {
    name: 'validate_contrast',
    description: 'Validates color contrast ratios for WCAG AA/AAA compliance',
    inputSchema: {
      type: 'object' as const,
      properties: {
        foreground: {
          type: 'string' as const,
          description: 'Foreground color in hex format (e.g., #000000)'
        },
        background: {
          type: 'string' as const,
          description: 'Background color in hex format (e.g., #FFFFFF)'
        }
      },
      required: ['foreground', 'background']
    }
  },
  {
    name: 'send_to_figma',
    description: 'Sends commands to Figma plugin for creating or modifying designs',
    inputSchema: {
      type: 'object' as const,
      properties: {
        command: {
          type: 'string' as const,
          description: 'Command type to send to Figma'
        },
        data: {
          type: 'object' as const,
          description: 'Command data payload'
        }
      },
      required: ['command', 'data']
    }
  },
  {
    name: 'get_constraints',
    description: 'Returns available design system constraints',
    inputSchema: {
      type: 'object' as const,
      properties: {}
    }
  },
  {
    name: 'get_system_prompt',
    description:
      'Returns the zero-shot system prompt for Text-to-Figma with HTML/CSS mappings and constraint guidelines',
    inputSchema: {
      type: 'object' as const,
      properties: {}
    }
  },
  {
    name: 'get_few_shot_prompt',
    description:
      'Returns the few-shot system prompt with complete workflow examples for creating UI components (button, card, form, navbar)',
    inputSchema: {
      type: 'object' as const,
      properties: {}
    }
  },
  {
    name: 'get_few_shot_examples',
    description: 'Returns just the few-shot examples as structured data for reference',
    inputSchema: {
      type: 'object' as const,
      properties: {}
    }
  }
];

/**
 * Handler for listing available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS
  };
});

/**
 * Handler for listing available prompts
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'text-to-figma-system',
        description:
          'Zero-shot system prompt: HTML/CSS to Figma mental model, primitive composition patterns, and design constraints',
        arguments: []
      },
      {
        name: 'text-to-figma-examples',
        description:
          'Few-shot examples: Complete workflows for building UI components (button, card, form, navbar) from primitives',
        arguments: []
      }
    ]
  };
});

/**
 * Handler for getting prompt content
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name } = request.params;

  switch (name) {
    case 'text-to-figma-system': {
      const systemPrompt = getZeroShotPrompt();
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Please review the Text-to-Figma system prompt to understand how to think about Figma design in HTML/CSS terms and compose UI components from primitives.'
            }
          },
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: systemPrompt
            }
          }
        ]
      };
    }

    case 'text-to-figma-examples': {
      const fewShotPrompt = getFewShotPrompt();
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Please show me complete examples of building UI components in Figma from primitives.'
            }
          },
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: fewShotPrompt
            }
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

/**
 * Handler for calling tools
 */
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'create_frame': {
        const input = args as CreateFrameInput;
        const result = await createFrame(input);

        let text = `Frame Created Successfully\n`;
        text += `Frame ID: ${result.frameId}\n\n`;
        text += `HTML Analogy: ${result.htmlAnalogy}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_layout_properties': {
        const input = args as SetLayoutPropertiesInput;
        const result = await setLayoutProperties(input);

        let text = `Layout Properties Updated\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Updated Properties: ${result.updated.join(', ')}\n\n`;
        text += `CSS Equivalent:\n  ${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'create_text': {
        const input = args as CreateTextInput;
        const result = await createText(input);

        let text = `Text Created Successfully\n`;
        text += `Text ID: ${result.textId}\n`;
        text += `Applied Line Height: ${result.appliedLineHeight}px\n\n`;
        text += `CSS Equivalent:\n  ${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_fills': {
        const input = args as SetFillsInput;
        const result = await setFills(input);

        let text = `Fills Applied Successfully\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Applied Color: ${result.appliedColor}\n\n`;
        text += `CSS Equivalent:\n  ${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'validate_design_tokens': {
        const input = args as DesignTokensInput;
        const report = await validateDesignTokens(input);
        const text = formatValidationReport(report);

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'check_wcag_contrast': {
        const input = args as CheckWcagContrastInput;
        const result = checkWcagContrast(input);
        const text = formatContrastCheckResult(result);

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'create_component': {
        const input = args as CreateComponentInput;
        const result = await createComponent(input);

        let text = `Component Created Successfully\n`;
        text += `Component ID: ${result.componentId}\n`;
        text += `Name: ${result.name}\n`;
        if (result.description) {
          text += `Description: ${result.description}\n`;
        }
        text += `\n${result.message}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'create_instance': {
        const input = args as CreateInstanceInput;
        const result = await createInstance(input);

        let text = `Instance Created Successfully\n`;
        text += `Instance ID: ${result.instanceId}\n`;
        text += `Component ID: ${result.componentId}\n`;
        text += `Overrides Applied: ${result.overridesApplied}\n`;
        text += `\n${result.message}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_component_properties': {
        const input = args as SetComponentPropertiesInput;
        const result = await setComponentProperties(input);

        let text = `Component Properties Updated\n`;
        text += `Component ID: ${result.componentId}\n`;
        text += `Updated: ${result.updated.join(', ')}\n`;
        text += `\n${result.message}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'apply_effects': {
        const input = args as ApplyEffectsInput;
        const result = await applyEffects(input);

        let text = `Effects Applied Successfully\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Effects Applied: ${result.effectsApplied}\n\n`;
        text += `CSS Equivalent:\n  ${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_constraints': {
        const input = args as SetConstraintsInput;
        const result = await setConstraints(input);

        let text = `Constraints Applied Successfully\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Applied: ${result.applied.join(', ')}\n\n`;
        text += `Description: ${result.description}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'create_rectangle_with_image_fill': {
        const input = args as CreateRectangleWithImageFillInput;
        const result = await createRectangleWithImageFill(input);

        let text = `Image Rectangle Created Successfully\n`;
        text += `Rectangle ID: ${result.rectangleId}\n`;
        text += `Image URL: ${result.imageUrl}\n`;
        text += `Scale Mode: ${result.scaleMode}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_image_fill': {
        const input = args as SetImageFillInput;
        const result = await setImageFill(input);

        let text = `Image Fill Applied Successfully\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Image URL: ${result.imageUrl}\n`;
        text += `Scale Mode: ${result.scaleMode}\n`;
        text += `Opacity: ${result.opacity}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'create_ellipse': {
        const input = args as CreateEllipseInput;
        const result = await createEllipse(input);

        let text = `${result.message}\n`;
        text += `Ellipse ID: ${result.ellipseId}\n`;
        text += `Dimensions: ${result.width}x${result.height}\n`;
        text += `Is Circle: ${result.isCircle}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'create_line': {
        const input = args as CreateLineInput;
        const result = await createLine(input);

        let text = `${result.message}\n`;
        text += `Line ID: ${result.lineId}\n`;
        text += `Length: ${result.length}px\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'add_gradient_fill': {
        const input = args as AddGradientFillInput;
        const result = await addGradientFill(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Type: ${result.type}\n`;
        text += `Stops: ${result.stopCount}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_corner_radius': {
        const input = args as SetCornerRadiusInput;
        const result = await setCornerRadius(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Is Uniform: ${result.isUniform}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_stroke': {
        const input = args as SetStrokeInput;
        const result = await setStroke(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Stroke Weight: ${result.strokeWeight}px\n`;
        text += `Alignment: ${result.strokeAlign}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'create_polygon': {
        const input = args as CreatePolygonInput;
        const result = await createPolygon(input);

        let text = `${result.message}\n`;
        text += `Polygon ID: ${result.polygonId}\n`;
        text += `Type: ${result.polygonType}\n`;
        text += `Sides: ${result.sideCount}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'create_star': {
        const input = args as CreateStarInput;
        const result = await createStar(input);

        let text = `${result.message}\n`;
        text += `Star ID: ${result.starId}\n`;
        text += `Points: ${result.pointCount}\n`;
        text += `Radius: ${result.radius}px (inner: ${result.innerRadius}px)\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_rotation': {
        const input = args as SetRotationInput;
        const result = await setRotation(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Rotation: ${result.rotation}°\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_absolute_position': {
        const input = args as SetAbsolutePositionInput;
        const result = await setAbsolutePosition(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Position: (${result.x}, ${result.y})\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_size': {
        const input = args as SetSizeInput;
        const result = await setSize(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Dimensions: ${result.width}×${result.height}px\n`;
        text += `Aspect Ratio: ${result.aspectRatio}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_text_decoration': {
        const input = args as SetTextDecorationInput;
        const result = await setTextDecoration(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Decoration: ${result.decoration}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_letter_spacing': {
        const input = args as SetLetterSpacingInput;
        const result = await setLetterSpacing(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Value: ${result.value}${result.unit === 'PERCENT' ? '%' : 'px'}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_text_case': {
        const input = args as SetTextCaseInput;
        const result = await setTextCase(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Text Case: ${result.textCase}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'create_boolean_operation': {
        const input = args as CreateBooleanOperationInput;
        const result = await createBooleanOperation(input);

        let text = `${result.message}\n`;
        text += `Boolean Node ID: ${result.booleanNodeId}\n`;
        text += `Operation: ${result.operation}\n`;
        text += `Node Count: ${result.nodeCount}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_blend_mode': {
        const input = args as SetBlendModeInput;
        const result = await setBlendMode(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Blend Mode: ${result.blendMode}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_opacity': {
        const input = args as SetOpacityInput;
        const result = await setOpacity(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Opacity: ${result.opacity} (${result.percentage}%)\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_stroke_join': {
        const input = args as SetStrokeJoinInput;
        const result = await setStrokeJoin(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Stroke Join: ${result.strokeJoin}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_stroke_cap': {
        const input = args as SetStrokeCapInput;
        const result = await setStrokeCap(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Stroke Cap: ${result.strokeCap}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'create_color_style': {
        const input = args as CreateColorStyleInput;
        const result = await createColorStyle(input);

        let text = `${result.message}\n`;
        text += `Style ID: ${result.styleId}\n`;
        text += `Name: ${result.name}\n`;
        text += `Color: ${result.color}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'apply_fill_style': {
        const input = args as ApplyFillStyleInput;
        const result = await applyFillStyle(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Style: ${result.styleName}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'create_text_style': {
        const input = args as CreateTextStyleInput;
        const result = await createTextStyle(input);

        let text = `${result.message}\n`;
        text += `Style ID: ${result.styleId}\n`;
        text += `Name: ${result.name}\n`;
        text += `Font: ${result.fontSize}px, weight ${result.fontWeight}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'apply_text_style': {
        const input = args as ApplyTextStyleInput;
        const result = await applyTextStyle(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Style: ${result.styleName}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'create_effect_style': {
        const input = args as CreateEffectStyleInput;
        const result = await createEffectStyle(input);

        let text = `${result.message}\n`;
        text += `Style ID: ${result.styleId}\n`;
        text += `Name: ${result.name}\n`;
        text += `Effects: ${result.effectCount}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'apply_effect_style': {
        const input = args as ApplyEffectStyleInput;
        const result = await applyEffectStyle(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Style: ${result.styleName}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_clipping_mask': {
        const input = args as SetClippingMaskInput;
        const result = await setClippingMask(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Enabled: ${result.enabled}\n`;
        text += `Use Mask: ${result.useMask}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_paragraph_spacing': {
        const input = args as SetParagraphSpacingInput;
        const result = await setParagraphSpacing(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        if (result.paragraphSpacing !== undefined) {
          text += `Paragraph Spacing: ${result.paragraphSpacing}px\n`;
        }
        if (result.paragraphIndent !== undefined) {
          text += `Paragraph Indent: ${result.paragraphIndent}px\n`;
        }
        text += `\nCSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'create_component_set': {
        const input = args as CreateComponentSetInput;
        const result = await createComponentSet(input);

        let text = `${result.message}\n`;
        text += `Component Set ID: ${result.componentSetId}\n`;
        text += `Name: ${result.name}\n`;
        text += `Variants: ${result.variantCount}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'add_variant_property': {
        const input = args as AddVariantPropertyInput;
        const result = await addVariantProperty(input);

        let text = `${result.message}\n`;
        text += `Component Set ID: ${result.componentSetId}\n`;
        text += `Property: ${result.propertyName}\n`;
        text += `Values: ${result.valueCount}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'get_node_by_id': {
        const input = args as GetNodeByIdInput;
        const result = await getNodeById(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Name: ${result.name}\n`;
        text += `Type: ${result.type}\n`;
        if (result.width && result.height) {
          text += `Dimensions: ${result.width}×${result.height}\n`;
        }
        if (result.x !== undefined && result.y !== undefined) {
          text += `Position: (${result.x}, ${result.y})\n`;
        }

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'get_node_by_name': {
        const input = args as GetNodeByNameInput;
        const result = await getNodeByName(input);

        let text = `${result.message}\n`;
        text += `Found: ${result.found} node(s)\n\n`;

        if (result.nodes.length > 0) {
          text += 'Nodes:\n';
          result.nodes.forEach((node, i) => {
            text += `${i + 1}. ${node.name} (${node.type}) - ID: ${node.nodeId}\n`;
          });
        }

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'add_layout_grid': {
        const input = args as AddLayoutGridInput;
        const result = await addLayoutGrid(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Pattern: ${result.pattern}\n`;
        if (result.count) {
          text += `Count: ${result.count}\n`;
        }
        text += `Gutter: ${result.gutter}px\n`;
        text += `Margin: ${result.margin}px\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'flip_node': {
        const input = args as FlipNodeInput;
        const result = await flipNode(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Direction: ${result.direction}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_visible': {
        const input = args as SetVisibleInput;
        const result = await setVisible(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Visible: ${result.visible}\n\n`;
        text += `CSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_locked': {
        const input = args as SetLockedInput;
        const result = await setLocked(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Locked: ${result.locked}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_export_settings': {
        const input = args as SetExportSettingsInput;
        const result = await setExportSettings(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Export Settings: ${result.settingsCount}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'export_node': {
        const input = args as ExportNodeInput;
        const result = await exportNode(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Format: ${result.format}\n`;
        text += `Scale: ${result.scale}x\n`;

        if (result.base64Data) {
          text += `\nBase64 Data: [${result.base64Data.length} characters]\n`;
        }

        if (result.filePath) {
          text += `\nFile Path: ${result.filePath}\n`;
        }

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'get_children': {
        const input = args as GetChildrenInput;
        const result = await getChildren(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Child Count: ${result.childCount}\n\n`;

        if (result.children.length > 0) {
          text += 'Children:\n';
          result.children.forEach((child, i) => {
            text += `${i + 1}. ${child.name} (${child.type}) - ID: ${child.nodeId}\n`;
            text += `   Visible: ${child.visible}, Locked: ${child.locked}\n`;
          });
        }

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'get_parent': {
        const input = args as GetParentInput;
        const result = await getParent(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;

        if (result.parentId) {
          text += `Parent ID: ${result.parentId}\n`;
          text += `Parent Name: ${result.parentName}\n`;
          text += `Parent Type: ${result.parentType}\n`;
        }

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_plugin_data': {
        const input = args as SetPluginDataInput;
        const result = await setPluginData(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Key: ${result.key}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'get_plugin_data': {
        const input = args as GetPluginDataInput;
        const result = await getPluginData(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Key: ${result.key}\n`;

        if (result.value) {
          text += `Value: ${result.value}\n`;
        }

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_instance_swap': {
        const input = args as SetInstanceSwapInput;
        const result = await setInstanceSwap(input);

        let text = `${result.message}\n`;
        text += `Instance ID: ${result.instanceId}\n`;
        text += `New Component ID: ${result.newComponentId}\n`;

        if (result.oldComponentId) {
          text += `Old Component ID: ${result.oldComponentId}\n`;
        }

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_scale': {
        const input = args as SetScaleInput;
        const result = await setScale(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Scale: ${result.scaleX}x × ${result.scaleY}x\n`;

        if (result.newWidth && result.newHeight) {
          text += `New Dimensions: ${result.newWidth}×${result.newHeight}px\n`;
        }

        text += `\nCSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'create_page': {
        const input = args as CreatePageInput;
        const result = await createPage(input);

        let text = `${result.message}\n`;
        text += `Page ID: ${result.pageId}\n`;
        text += `Name: ${result.name}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'list_pages': {
        const input = args as ListPagesInput;
        const result = await listPages(input);

        let text = `${result.message}\n\n`;

        if (result.pages.length > 0) {
          text += 'Pages:\n';
          result.pages.forEach((page, i) => {
            const current = page.isCurrent ? ' (current)' : '';
            text += `${i + 1}. ${page.name}${current} - ID: ${page.pageId}\n`;
          });
        }

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_current_page': {
        const input = args as SetCurrentPageInput;
        const result = await setCurrentPage(input);

        let text = `${result.message}\n`;
        text += `Page ID: ${result.pageId}\n`;

        if (result.pageName) {
          text += `Page Name: ${result.pageName}\n`;
        }

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'get_absolute_bounds': {
        const input = args as GetAbsoluteBoundsInput;
        const result = await getAbsoluteBounds(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;
        text += `Position: (${result.bounds.x}, ${result.bounds.y})\n`;
        text += `Dimensions: ${result.bounds.width}×${result.bounds.height}px\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'get_relative_bounds': {
        const input = args as GetRelativeBoundsInput;
        const result = await getRelativeBounds(input);

        return {
          content: [{ type: 'text', text: result.message }]
        };
      }

      case 'align_nodes': {
        const input = args as AlignNodesInput;
        const result = await alignNodes(input);

        return {
          content: [{ type: 'text', text: result.message }]
        };
      }

      case 'distribute_nodes': {
        const input = args as DistributeNodesInput;
        const result = await distributeNodes(input);

        return {
          content: [{ type: 'text', text: result.message }]
        };
      }

      case 'create_path': {
        const input = args as CreatePathInput;
        const result = await createPath(input);

        return {
          content: [{ type: 'text', text: result.message }]
        };
      }

      case 'set_layer_order': {
        const input = args as SetLayerOrderInput;
        const result = await setLayerOrder(input);

        return {
          content: [{ type: 'text', text: result.message }]
        };
      }

      case 'connect_shapes': {
        const input = args as ConnectShapesInput;
        const result = await connectShapes(input);

        return {
          content: [{ type: 'text', text: result.message }]
        };
      }

      case 'set_layout_sizing': {
        const input = args as SetLayoutSizingInput;
        const result = await setLayoutSizing(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;

        if (result.horizontal) {
          text += `Horizontal: ${result.horizontal}\n`;
        }

        if (result.vertical) {
          text += `Vertical: ${result.vertical}\n`;
        }

        text += `\nCSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'set_layout_align': {
        const input = args as SetLayoutAlignInput;
        const result = await setLayoutAlign(input);

        let text = `${result.message}\n`;
        text += `Node ID: ${result.nodeId}\n`;

        if (result.primaryAxis) {
          text += `Primary Axis: ${result.primaryAxis}\n`;
        }

        if (result.counterAxis) {
          text += `Counter Axis: ${result.counterAxis}\n`;
        }

        text += `\nCSS Equivalent:\n${result.cssEquivalent}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'validate_spacing': {
        const { value } = args as { value: number };
        const result: SpacingConstraintResult = validateSpacing(value);

        let text = `Spacing Validation Result:\n`;
        text += `Value: ${result.value}px\n`;
        text += `Valid: ${result.isValid ? 'Yes' : 'No'}\n`;

        if (!result.isValid && result.suggestedValue !== undefined) {
          text += `Suggested: ${result.suggestedValue}px\n`;
          text += `Message: ${result.message || ''}\n`;
        }

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'validate_typography': {
        const { fontSize } = args as { fontSize: number };
        const result: TypographyConstraintResult = validateTypography(fontSize);

        let text = `Typography Validation Result:\n`;
        text += `Font Size: ${result.fontSize}px\n`;
        text += `Valid: ${result.isValid ? 'Yes' : 'No'}\n`;

        if (result.recommendedLineHeight !== undefined) {
          text += `Recommended Line Height: ${result.recommendedLineHeight}px\n`;
        }

        if (!result.isValid && result.suggestedFontSize !== undefined) {
          text += `Suggested: ${result.suggestedFontSize}px\n`;
          text += `Message: ${result.message || ''}\n`;
        }

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'validate_contrast': {
        const { foreground, background } = args as { foreground: string; background: string };
        const fgRgb: RGB | null = hexToRgb(foreground);
        const bgRgb: RGB | null = hexToRgb(background);

        if (!fgRgb || !bgRgb) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Invalid hex color format. Use format like #000000'
              }
            ]
          };
        }

        const result: ContrastValidationResult = validateContrast(fgRgb, bgRgb);

        let text = `Contrast Validation Result:\n`;
        text += `Foreground: ${foreground}\n`;
        text += `Background: ${background}\n`;
        text += `Contrast Ratio: ${result.ratio.toFixed(2)}:1\n\n`;
        text += `WCAG AA:\n`;
        text += `  Normal Text: ${result.passes.AA.normal ? 'Pass' : 'Fail'}\n`;
        text += `  Large Text: ${result.passes.AA.large ? 'Pass' : 'Fail'}\n`;
        text += `WCAG AAA:\n`;
        text += `  Normal Text: ${result.passes.AAA.normal ? 'Pass' : 'Fail'}\n`;
        text += `  Large Text: ${result.passes.AAA.large ? 'Pass' : 'Fail'}\n\n`;
        text += `Recommendation: ${result.recommendation}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'send_to_figma': {
        const { command, data } = args as { command: string; data: Record<string, unknown> };
        const bridge = getFigmaBridge();

        if (!bridge.isConnected()) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Not connected to Figma plugin. Ensure the plugin is running and WebSocket bridge is active.'
              }
            ]
          };
        }

        try {
          const response = await bridge.sendToFigma(command, data);
          return {
            content: [
              {
                type: 'text',
                text: `Success: Command sent to Figma\n${JSON.stringify(response, null, 2)}`
              }
            ]
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            content: [
              {
                type: 'text',
                text: `Error: Failed to send command to Figma\n${errorMessage}`
              }
            ]
          };
        }
      }

      case 'get_constraints': {
        const text = `Text-to-Figma Primitive Design System

PHILOSOPHY: Expose ALL Figma primitives. NO pre-made components.
Just like Figma itself - there's no "draw button" functionality.
You must COMPOSE designs from raw primitives.

═══════════════════════════════════════

DESIGN SYSTEM CONSTRAINTS:

SPACING (8pt Grid):
Valid values: 0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128

TYPOGRAPHY (Modular Scale):
Valid font sizes: 12, 16, 20, 24, 32, 40, 48, 64

COLOR (WCAG Contrast):
- AA Normal Text: 4.5:1 minimum
- AA Large Text: 3.0:1 minimum
- AAA Normal Text: 7.0:1 minimum
- AAA Large Text: 4.5:1 minimum

═══════════════════════════════════════

AVAILABLE PRIMITIVES:

Shape Primitives:
- create_frame: Rectangle containers with auto-layout (flexbox-like)
- create_ellipse: Circle or oval shapes
- create_line: Straight lines between two points
- create_polygon: N-sided polygons (triangle, pentagon, hexagon, octagon)
- create_star: Star shapes with configurable points

Text Primitives:
- create_text: Text nodes with typography validation

Fill Primitives:
- set_fills: Apply solid colors to frames or text
- add_gradient_fill: Apply linear or radial gradients with color stops
- set_image_fill: Apply image fill to existing frame/rectangle

Image Primitives:
- create_rectangle_with_image_fill: Create rectangle with image from URL
- set_image_fill: Apply image fill with scale modes (FILL, FIT, CROP, TILE)

Styling Primitives:
- set_corner_radius: Set corner radius (uniform or individual corners)
- set_stroke: Apply strokes/borders (width, color, alignment, dash pattern)
- set_stroke_join: Stroke corner style (miter, bevel, round)
- set_stroke_cap: Stroke ending style (none, round, square)

Transform Primitives:
- set_rotation: Rotate nodes by degrees
- set_absolute_position: Set absolute X, Y coordinates
- set_size: Set precise width and height dimensions

Typography Primitives:
- set_text_decoration: Underline, strikethrough text
- set_letter_spacing: Letter tracking (tight, normal, loose)
- set_text_case: Text case transformation (UPPER, lower, Title)
- set_paragraph_spacing: Paragraph spacing and indent

Boolean Operations:
- create_boolean_operation: Union, subtract, intersect, exclude shapes

Visual Effects Primitives:
- set_blend_mode: Blend modes for compositing (multiply, screen, overlay, etc.)
- set_opacity: Node transparency (0.0-1.0)

Clipping and Masking:
- set_clipping_mask: Clip to bounds or use vector mask

Style System Primitives:
- create_color_style: Create reusable color styles
- apply_fill_style: Apply color style to node
- create_text_style: Create reusable text styles
- apply_text_style: Apply text style to text node
- create_effect_style: Create reusable effect styles (shadows, blur)
- apply_effect_style: Apply effect style to node

Effect Primitives:
- apply_effects: Add drop shadows, inner shadows, layer blur, background blur

Layout Primitives:
- set_layout_properties: Configure auto-layout (spacing, padding, direction)
- set_constraints: Layout constraints for responsive behavior

Component Primitives:
- create_component: Convert frames to reusable components
- create_instance: Create instances with property overrides
- set_component_properties: Modify component properties

Validation Primitives:
- validate_design_tokens: Bulk validation (spacing, typography, colors)
- validate_spacing: Check 8pt grid compliance
- validate_typography: Check type scale compliance
- validate_contrast: Check WCAG AA/AAA compliance
- check_wcag_contrast: Enhanced contrast validation with color suggestions

Utility Primitives:
- send_to_figma: Send raw commands to Figma plugin
- get_system_prompt: Get zero-shot prompt (primitive-first philosophy)
- get_few_shot_prompt: Get workflow examples (composition patterns)
- get_few_shot_examples: Get structured examples as JSON

═══════════════════════════════════════

COMPOSITION PATTERN:
To create a button, you compose primitives:
1. create_frame (rectangle container)
2. set_fills (background color)
3. create_text (label text)
4. apply_effects (drop shadow)
5. validate_contrast (accessibility)
6. create_component (make reusable - optional)

Remember: Compose from primitives, don't look for high-level abstractions.
`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'get_system_prompt': {
        const text = getZeroShotPrompt();
        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'get_few_shot_prompt': {
        const text = getFewShotPrompt();
        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'get_few_shot_examples': {
        const examples = getFewShotExamples();
        const text = JSON.stringify(examples, null, 2);
        return {
          content: [{ type: 'text', text }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`
        }
      ]
    };
  }
});

/**
 * Main server startup
 */
async function main(): Promise<void> {
  console.error('[MCP Server] Starting Text-to-Figma MCP Server...');

  // Load configuration
  loadConfig();
  console.error('[MCP Server] Configuration loaded');

  // Start health check server if enabled
  try {
    startHealthCheck();
    const config = getConfig();
    if (config.HEALTH_CHECK_ENABLED) {
      console.error(`[MCP Server] Health check server started on port ${config.HEALTH_CHECK_PORT}`);
    }
  } catch (error) {
    console.error('[MCP Server] Warning: Could not start health check server:', error);
  }

  // Connect to Figma bridge with retry
  const bridge = getFigmaBridge();
  try {
    await bridge.connect();
    console.error('[MCP Server] Connected to Figma WebSocket bridge');
  } catch (error) {
    console.error(
      '[MCP Server] Warning: Could not connect to Figma bridge initially. Will retry automatically.'
    );
    console.error(
      '[MCP Server] Figma integration will become available once WebSocket server is running.'
    );
    console.error('[MCP Server] Constraint validation tools will work immediately.');
  }

  // Create transport and connect
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP Server] Server running and ready for requests');
  console.error(
    '[MCP Server] Available tools: create_frame, set_layout_properties, create_text, set_fills, validate_design_tokens'
  );

  // Handle cleanup on exit
  const shutdown = async (signal: string): Promise<void> => {
    console.error(`[MCP Server] Received ${signal}, shutting down gracefully...`);

    const config = getConfig();
    const shutdownTimeout = config.GRACEFUL_SHUTDOWN_TIMEOUT;

    // Set a timeout for forced shutdown
    const forceShutdownTimer = setTimeout(() => {
      console.error('[MCP Server] Graceful shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, shutdownTimeout);

    try {
      // Stop accepting new requests
      console.error('[MCP Server] Stopping health check server...');
      await stopHealthCheck();

      // Disconnect from Figma bridge
      console.error('[MCP Server] Disconnecting from Figma bridge...');
      bridge.disconnect();

      // Close MCP server transport
      console.error('[MCP Server] Closing MCP server transport...');
      await server.close();

      clearTimeout(forceShutdownTimer);
      console.error('[MCP Server] Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('[MCP Server] Error during shutdown:', error);
      clearTimeout(forceShutdownTimer);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

// Start the server
main().catch((error) => {
  console.error('[MCP Server] Fatal error:', error);
  process.exit(1);
});
