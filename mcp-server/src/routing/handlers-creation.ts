/**
 * Tool Handlers — Creation & Design
 *
 * Handlers for tools that create nodes or orchestrate multi-node designs.
 */

import { handler as checkConnection } from '../tools/check_connection.js';
import { handler as createDesign } from '../tools/create_design.js';
import { handler as createFrame } from '../tools/create_frame.js';
import { handler as createText } from '../tools/create_text.js';
import { handler as createEllipse } from '../tools/create_ellipse.js';
import { handler as createRectangleWithImageFill } from '../tools/create_rectangle_with_image_fill.js';
import { handler as createLine } from '../tools/create_line.js';
import { handler as createPolygon } from '../tools/create_polygon.js';
import { handler as createStar } from '../tools/create_star.js';
import { handler as createPath } from '../tools/create_path.js';
import { handler as batchCreatePath } from '../tools/batch_create_path.js';
import { handler as editPath } from '../tools/edit_path.js';
import { handler as createBooleanOperation } from '../tools/create_boolean_operation.js';
import { handler as createComponent } from '../tools/create_component.js';
import { handler as createInstance } from '../tools/create_instance.js';
import { handler as setComponentProperties } from '../tools/set_component_properties.js';
import { handler as createComponentSet } from '../tools/create_component_set.js';
import { handler as addVariantProperty } from '../tools/add_variant_property.js';
import { handler as setInstanceSwap } from '../tools/set_instance_swap.js';

export const creationHandlers = [
  checkConnection,
  createDesign,
  createFrame,
  createText,
  createEllipse,
  createRectangleWithImageFill,
  createLine,
  createPolygon,
  createStar,
  createPath,
  batchCreatePath,
  editPath,
  createBooleanOperation,
  createComponent,
  createInstance,
  setComponentProperties,
  createComponentSet,
  addVariantProperty,
  setInstanceSwap
];
