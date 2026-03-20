/**
 * ESLint rule: no-inline-color-values
 *
 * Disallow hardcoded/inlined color values (hex, rgb, hsl) in component code.
 * Colors should use theme tokens/variables/constants instead.
 */

const COLOR_VALUE_PATTERN =
  /(#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})\b|rgba?\([^)]*\)|hsla?\([^)]*\))/i;
const COLOR_CONTEXT_PATTERN = /(color|background|border|stroke|fill|shadow|outline)/i;

/**
 * @param {import('estree').Node} nameNode
 * @returns {string | null}
 */
function getJSXName(nameNode) {
  if (!nameNode) return null;
  if (nameNode.type === 'JSXIdentifier') return nameNode.name;
  return null;
}

/**
 * @param {import('estree').Node} keyNode
 * @param {boolean} computed
 * @returns {string | null}
 */
function getPropertyKeyName(keyNode, computed) {
  if (computed || !keyNode) return null;
  if (keyNode.type === 'Identifier') return keyNode.name;
  if (keyNode.type === 'Literal' && typeof keyNode.value === 'string') return keyNode.value;
  return null;
}

/** @param {string} value */
function isColorLiteral(value) {
  return COLOR_VALUE_PATTERN.test(value.trim());
}

/** @param {import('estree').Node} node */
function isColorContext(node) {
  let current = node.parent;
  while (current) {
    if (current.type === 'JSXAttribute') {
      const jsxName = getJSXName(current.name);
      if (jsxName && (jsxName === 'style' || COLOR_CONTEXT_PATTERN.test(jsxName))) return true;
    }
    if (current.type === 'Property') {
      const keyName = getPropertyKeyName(current.key, current.computed);
      if (keyName && COLOR_CONTEXT_PATTERN.test(keyName)) return true;
    }
    if (current.type === 'VariableDeclarator' && current.id.type === 'Identifier') {
      if (COLOR_CONTEXT_PATTERN.test(current.id.name)) return true;
    }
    current = current.parent;
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hardcoded/inlined color values in component code'
    },
    schema: [],
    messages: {
      noInlineColor:
        'Avoid hardcoded color value "{{value}}". Use theme tokens/variables/constants instead.'
    }
  },
  create(context) {
    /**
     * @param {import('estree').Node} node
     * @param {string} value
     */
    const checkNode = (node, value) => {
      if (!isColorLiteral(value) || !isColorContext(node)) return;
      context.report({ node, messageId: 'noInlineColor', data: { value } });
    };

    return {
      Literal(node) {
        if (typeof node.value === 'string') checkNode(node, node.value);
      },
      TemplateLiteral(node) {
        if (node.expressions.length > 0) return;
        const value = node.quasis.map((quasi) => quasi.value.cooked ?? '').join('');
        if (value) checkNode(node, value);
      }
    };
  }
};
