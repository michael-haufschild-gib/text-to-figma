/**
 * Tool Handlers — Creation & Design
 *
 * Handlers for tools that create nodes or orchestrate multi-node designs.
 */

import { z } from 'zod';
import { defineHandler, textResponse } from './handler-utils.js';

import {
  checkConnection,
  checkConnectionToolDefinition,
  type CheckConnectionResult
} from '../tools/check_connection.js';
import {
  createDesign,
  createDesignToolDefinition,
  CreateDesignInputSchema,
  type CreateDesignParams,
  type CreateDesignResult
} from '../tools/create_design.js';
import {
  createFrame,
  createFrameToolDefinition,
  CreateFrameInputSchema,
  type CreateFrameInput,
  type CreateFrameResult
} from '../tools/create_frame.js';
import {
  createText,
  createTextToolDefinition,
  CreateTextInputSchema,
  type CreateTextInput,
  type CreateTextResult
} from '../tools/create_text.js';
import {
  createEllipse,
  createEllipseToolDefinition,
  CreateEllipseInputSchema,
  type CreateEllipseInput,
  type CreateEllipseResult
} from '../tools/create_ellipse.js';
import {
  createRectangleWithImageFill,
  createRectangleWithImageFillToolDefinition,
  CreateRectangleWithImageFillInputSchema,
  type CreateRectangleWithImageFillInput,
  type CreateRectangleWithImageFillResult
} from '../tools/create_rectangle_with_image_fill.js';
import {
  createLine,
  createLineToolDefinition,
  CreateLineInputSchema,
  type CreateLineInput,
  type CreateLineResult
} from '../tools/create_line.js';
import {
  createPolygon,
  createPolygonToolDefinition,
  CreatePolygonInputSchema,
  type CreatePolygonInput,
  type CreatePolygonResult
} from '../tools/create_polygon.js';
import {
  createStar,
  createStarToolDefinition,
  CreateStarInputSchema,
  type CreateStarInput,
  type CreateStarResult
} from '../tools/create_star.js';
import {
  createPath,
  createPathToolDefinition,
  CreatePathInputSchema,
  type CreatePathInput,
  type CreatePathResult
} from '../tools/create_path.js';
import {
  createBooleanOperation,
  createBooleanOperationToolDefinition,
  CreateBooleanOperationInputSchema,
  type CreateBooleanOperationInput,
  type CreateBooleanOperationResult
} from '../tools/create_boolean_operation.js';
import {
  createComponent,
  createComponentToolDefinition,
  CreateComponentInputSchema,
  type CreateComponentInput,
  type CreateComponentResult
} from '../tools/create_component.js';
import {
  createInstance,
  createInstanceToolDefinition,
  CreateInstanceInputSchema,
  type CreateInstanceInput,
  type CreateInstanceResult
} from '../tools/create_instance.js';
import {
  createComponentSet,
  createComponentSetToolDefinition,
  CreateComponentSetInputSchema,
  type CreateComponentSetInput,
  type CreateComponentSetResult
} from '../tools/create_component_set.js';
import {
  addVariantProperty,
  addVariantPropertyToolDefinition,
  AddVariantPropertyInputSchema,
  type AddVariantPropertyInput,
  type AddVariantPropertyResult
} from '../tools/add_variant_property.js';
import {
  setComponentProperties,
  setComponentPropertiesToolDefinition,
  SetComponentPropertiesInputSchema,
  type SetComponentPropertiesInput,
  type SetComponentPropertiesResult
} from '../tools/set_component_properties.js';
import {
  setInstanceSwap,
  setInstanceSwapToolDefinition,
  SetInstanceSwapInputSchema,
  type SetInstanceSwapInput,
  type SetInstanceSwapResult
} from '../tools/set_instance_swap.js';

export const creationHandlers = [
  // ─── Connection / Design ────────────────────────────────────────────────
  defineHandler<Record<string, never>, CheckConnectionResult>({
    name: 'check_connection',
    schema: z.object({}) as z.ZodSchema<Record<string, never>>,
    execute: checkConnection,
    formatResponse: (result) => {
      let text = result.connected
        ? `Connection Status: CONNECTED\n\n`
        : `Connection Status: DISCONNECTED\n\n`;
      if (result.connected) {
        if (result.figmaFile) {
          text += `File: ${result.figmaFile}\n`;
        }
        if (result.currentPage) {
          text += `Page: ${result.currentPage}\n`;
        }
        if (result.latencyMs !== undefined) {
          text += `Latency: ${result.latencyMs}ms\n`;
        }
        if (result.pluginVersion) {
          text += `Plugin Version: ${result.pluginVersion}\n`;
        }
      }
      text += `\nDiagnostics:\n`;
      text += `  Circuit Breaker: ${result.circuitBreakerState}\n`;
      text += `  Pending Requests: ${result.pendingRequests}\n`;
      if (result.wsReadyStateText) {
        text += `  WebSocket State: ${result.wsReadyStateText}\n`;
      }
      if (result.error) {
        text += `\nWarning: ${result.error}\n`;
      }
      text += `\n${result.message}`;
      return textResponse(text);
    },
    definition: checkConnectionToolDefinition
  }),

  defineHandler<CreateDesignParams, CreateDesignResult>({
    name: 'create_design',
    schema: CreateDesignInputSchema as z.ZodSchema<CreateDesignParams>,
    execute: createDesign,
    formatResponse: (result) => {
      if (!result.success) {
        return textResponse(`Error: ${result.error}`);
      }
      let text = `Design Created Successfully\n\nRoot Node ID: ${result.rootNodeId}\nTotal Nodes: ${result.totalNodes}\n\n`;
      if (result.nodeIds) {
        text += `Node IDs:\n`;
        for (const [name, id] of Object.entries(result.nodeIds)) {
          text += `  - ${name}: ${id}\n`;
        }
        text += `\n`;
      }
      if (result.autoCorrections && result.autoCorrections.length > 0) {
        text += `Auto-Corrections Applied (${result.autoCorrections.length}):\n`;
        for (const c of result.autoCorrections) {
          text += `  - ${c.path}.${c.field}: ${c.originalValue} -> ${c.correctedValue}\n`;
        }
        text += `\n`;
      }
      text += `${result.message}\n\nAll nodes created in a single atomic operation with proper hierarchy.`;
      return textResponse(text);
    },
    definition: createDesignToolDefinition
  }),

  // ─── Primitive shapes ───────────────────────────────────────────────────
  defineHandler<CreateFrameInput, CreateFrameResult>({
    name: 'create_frame',
    schema: CreateFrameInputSchema as z.ZodSchema<CreateFrameInput>,
    execute: createFrame,
    formatResponse: (r) =>
      textResponse(
        `Frame Created Successfully\nFrame ID: ${r.frameId}\n\nHTML Analogy: ${r.htmlAnalogy}\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
      ),
    definition: createFrameToolDefinition
  }),

  defineHandler<CreateTextInput, CreateTextResult>({
    name: 'create_text',
    schema: CreateTextInputSchema as z.ZodSchema<CreateTextInput>,
    execute: createText,
    formatResponse: (r) =>
      textResponse(
        `Text Created Successfully\nText ID: ${r.textId}\nApplied Line Height: ${r.appliedLineHeight}px\n\nCSS Equivalent:\n  ${r.cssEquivalent}\n`
      ),
    definition: createTextToolDefinition
  }),

  defineHandler<CreateEllipseInput, CreateEllipseResult>({
    name: 'create_ellipse',
    schema: CreateEllipseInputSchema as z.ZodSchema<CreateEllipseInput>,
    execute: createEllipse,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nEllipse ID: ${r.ellipseId}\nDimensions: ${r.width}x${r.height}\nIs Circle: ${r.isCircle}\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
      ),
    definition: createEllipseToolDefinition
  }),

  defineHandler<CreateRectangleWithImageFillInput, CreateRectangleWithImageFillResult>({
    name: 'create_rectangle_with_image_fill',
    schema:
      CreateRectangleWithImageFillInputSchema as z.ZodSchema<CreateRectangleWithImageFillInput>,
    execute: createRectangleWithImageFill,
    formatResponse: (r) =>
      textResponse(
        `Image Rectangle Created Successfully\nRectangle ID: ${r.rectangleId}\nImage URL: ${r.imageUrl}\nScale Mode: ${r.scaleMode}\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
      ),
    definition: createRectangleWithImageFillToolDefinition
  }),

  defineHandler<CreateLineInput, CreateLineResult>({
    name: 'create_line',
    schema: CreateLineInputSchema as z.ZodSchema<CreateLineInput>,
    execute: createLine,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nLine ID: ${r.lineId}\nLength: ${r.length}px\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
      ),
    definition: createLineToolDefinition
  }),

  defineHandler<CreatePolygonInput, CreatePolygonResult>({
    name: 'create_polygon',
    schema: CreatePolygonInputSchema as z.ZodSchema<CreatePolygonInput>,
    execute: createPolygon,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nPolygon ID: ${r.polygonId}\nType: ${r.polygonType}\nSides: ${r.sideCount}\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
      ),
    definition: createPolygonToolDefinition
  }),

  defineHandler<CreateStarInput, CreateStarResult>({
    name: 'create_star',
    schema: CreateStarInputSchema as z.ZodSchema<CreateStarInput>,
    execute: createStar,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nStar ID: ${r.starId}\nPoints: ${r.pointCount}\nRadius: ${r.radius}px (inner: ${r.innerRadius}px)\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
      ),
    definition: createStarToolDefinition
  }),

  defineHandler<CreatePathInput, CreatePathResult>({
    name: 'create_path',
    schema: CreatePathInputSchema as z.ZodSchema<CreatePathInput>,
    execute: createPath,
    formatResponse: (r) => textResponse(r.message),
    definition: createPathToolDefinition
  }),

  defineHandler<CreateBooleanOperationInput, CreateBooleanOperationResult>({
    name: 'create_boolean_operation',
    schema: CreateBooleanOperationInputSchema as z.ZodSchema<CreateBooleanOperationInput>,
    execute: createBooleanOperation,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nBoolean Node ID: ${r.booleanNodeId}\nOperation: ${r.operation}\nNode Count: ${r.nodeCount}\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
      ),
    definition: createBooleanOperationToolDefinition
  }),

  // ─── Components ─────────────────────────────────────────────────────────
  defineHandler<CreateComponentInput, CreateComponentResult>({
    name: 'create_component',
    schema: CreateComponentInputSchema as z.ZodSchema<CreateComponentInput>,
    execute: createComponent,
    formatResponse: (r) => {
      let text = `Component Created Successfully\nComponent ID: ${r.componentId}\nName: ${r.name}\n`;
      if (r.description) {
        text += `Description: ${r.description}\n`;
      }
      text += `\n${r.message}\n`;
      return textResponse(text);
    },
    definition: createComponentToolDefinition
  }),

  defineHandler<CreateInstanceInput, CreateInstanceResult>({
    name: 'create_instance',
    schema: CreateInstanceInputSchema as z.ZodSchema<CreateInstanceInput>,
    execute: createInstance,
    formatResponse: (r) =>
      textResponse(
        `Instance Created Successfully\nInstance ID: ${r.instanceId}\nComponent ID: ${r.componentId}\nOverrides Applied: ${r.overridesApplied}\n\n${r.message}\n`
      ),
    definition: createInstanceToolDefinition
  }),

  defineHandler<SetComponentPropertiesInput, SetComponentPropertiesResult>({
    name: 'set_component_properties',
    schema: SetComponentPropertiesInputSchema as z.ZodSchema<SetComponentPropertiesInput>,
    execute: setComponentProperties,
    formatResponse: (r) =>
      textResponse(
        `Component Properties Updated\nComponent ID: ${r.componentId}\nUpdated: ${r.updated.join(', ')}\n\n${r.message}\n`
      ),
    definition: setComponentPropertiesToolDefinition
  }),

  defineHandler<CreateComponentSetInput, CreateComponentSetResult>({
    name: 'create_component_set',
    schema: CreateComponentSetInputSchema as z.ZodSchema<CreateComponentSetInput>,
    execute: createComponentSet,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nComponent Set ID: ${r.componentSetId}\nName: ${r.name}\nVariants: ${r.variantCount}\n`
      ),
    definition: createComponentSetToolDefinition
  }),

  defineHandler<AddVariantPropertyInput, AddVariantPropertyResult>({
    name: 'add_variant_property',
    schema: AddVariantPropertyInputSchema as z.ZodSchema<AddVariantPropertyInput>,
    execute: addVariantProperty,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nComponent Set ID: ${r.componentSetId}\nProperty: ${r.propertyName}\nValues: ${r.valueCount}\n`
      ),
    definition: addVariantPropertyToolDefinition
  }),

  defineHandler<SetInstanceSwapInput, SetInstanceSwapResult>({
    name: 'set_instance_swap',
    schema: SetInstanceSwapInputSchema as z.ZodSchema<SetInstanceSwapInput>,
    execute: setInstanceSwap,
    formatResponse: (r) => {
      let text = `${r.message}\nInstance ID: ${r.instanceId}\nNew Component ID: ${r.newComponentId}\n`;
      if (r.oldComponentId) {
        text += `Old Component ID: ${r.oldComponentId}\n`;
      }
      return textResponse(text);
    },
    definition: setInstanceSwapToolDefinition
  })
];
