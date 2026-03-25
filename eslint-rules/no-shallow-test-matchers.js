/**
 * ESLint rule: no-shallow-test-matchers
 *
 * Disallow shallow matchers (toBeDefined, toBeTruthy, toBeFalsy, etc.) that
 * assert existence/type but not correctness. These catch zero real bugs.
 * Also catches common AI circumvention patterns like .not.toBeNull().
 */

// Matchers that assert existence/type but not correctness.
const SHALLOW_MATCHERS = {
  toBeDefined: 'Asserts existence, not correctness. Assert the specific expected value.',
  toBeTruthy: 'Too loose — passes for any truthy value. Assert the specific expected value.',
  toBeFalsy:
    'Too loose — passes for any falsy value. Use toBe(false), toBe(null), or assert a specific outcome.'
};

// Negated existence matchers — AI agents swap toBeDefined() to these to dodge the rule.
const NEGATED_EXISTENCE_MATCHERS = new Set(['toBeNull', 'toBeUndefined']);

const SHALLOW_MSG =
  'Shallow useless assertion — catches zero real bugs. Delete or replace with a specific value check.';

/**
 * Walk up the .not chain and return the innermost CallExpression
 * if it is `expect(...)`, otherwise return null.
 */
function findExpectCall(node) {
  let obj = node.callee.object;
  while (obj.type === 'CallExpression' && obj.callee.type === 'MemberExpression') {
    obj = obj.callee.object;
  }
  if (obj.type === 'MemberExpression' && obj.property.name === 'not') {
    obj = obj.object;
  }
  if (
    obj.type === 'CallExpression' &&
    obj.callee.type === 'Identifier' &&
    obj.callee.name === 'expect'
  ) {
    return obj;
  }
  return null;
}

/**
 * Check expect(<shallow-arg>) patterns: typeof, Array.isArray, Boolean wrapping.
 */
function checkExpectArgPatterns(context, node) {
  if (node.callee.type !== 'Identifier' || node.callee.name !== 'expect') return;
  const arg = node.arguments[0];
  if (!arg) return;

  if (arg.type === 'UnaryExpression' && arg.operator === 'typeof') {
    context.report({ node, message: SHALLOW_MSG });
  } else if (
    arg.type === 'CallExpression' &&
    arg.callee.type === 'MemberExpression' &&
    arg.callee.object.name === 'Array' &&
    arg.callee.property.name === 'isArray'
  ) {
    context.report({ node, message: SHALLOW_MSG });
  } else if (arg.type === 'CallExpression' && arg.callee.name === 'Boolean') {
    context.report({ node, message: SHALLOW_MSG });
  }
}

/**
 * Check matcher patterns: named shallow matchers, negated existence, extended patterns.
 */
function checkMatcherPatterns(context, node) {
  if (node.callee.type !== 'MemberExpression') return;
  // expect.any() / expect.anything() are asymmetric matchers — legitimate
  if (node.callee.object.name === 'expect') return;

  const methodName = node.callee.property.name;
  if (!methodName) return;

  const isNot =
    node.callee.object.type === 'MemberExpression' && node.callee.object.property.name === 'not';

  // Named shallow matchers (original set, zero args)
  const namedReason = SHALLOW_MATCHERS[methodName];
  if (namedReason && node.arguments.length === 0 && findExpectCall(node)) {
    context.report({
      node: node.callee.property,
      messageId: 'shallowMatcher',
      data: { matcher: methodName, reason: namedReason }
    });
    return;
  }

  // Negated existence matchers (.not.toBeNull / .not.toBeUndefined)
  if (
    isNot &&
    NEGATED_EXISTENCE_MATCHERS.has(methodName) &&
    node.arguments.length === 0 &&
    findExpectCall(node)
  ) {
    context.report({
      node: node.callee.property,
      messageId: 'shallowMatcher',
      data: {
        matcher: `not.${methodName}`,
        reason:
          'Same as toBeDefined() — asserts existence, not correctness. Assert the specific expected value.'
      }
    });
    return;
  }

  // .not.toBe(null/undefined) / .not.toEqual(null/undefined)
  if (isNot && (methodName === 'toBe' || methodName === 'toEqual') && node.arguments.length === 1) {
    const arg = node.arguments[0];
    const isNullOrUndefined =
      (arg.type === 'Literal' && arg.value === null) ||
      (arg.type === 'Identifier' && arg.name === 'undefined');
    if (isNullOrUndefined && findExpectCall(node)) {
      context.report({
        node: node.callee.property,
        messageId: 'shallowMatcher',
        data: {
          matcher: `not.${methodName}`,
          reason:
            'Same as toBeDefined() — asserts existence, not correctness. Assert the specific expected value.'
        }
      });
      return;
    }
  }

  // Extended shallow matcher patterns
  let isShallow = false;
  if (methodName === 'toMatch') {
    const arg = node.arguments[0];
    if (arg?.type === 'Literal' && arg.regex) {
      const pattern = arg.regex.pattern;
      if (pattern.includes('.+') || pattern.includes('[a-zA-Z]') || pattern === '.*') {
        isShallow = true;
      }
    }
  } else if (methodName === 'toHaveProperty' && node.arguments.length === 1 && !isNot) {
    isShallow = true;
  }

  if (!isShallow || !findExpectCall(node)) return;
  context.report({ node: node.callee.property, message: SHALLOW_MSG });
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow shallow matchers (toBeDefined, toBeTruthy, toBeFalsy) that assert existence/type but not correctness'
    },
    schema: [],
    messages: {
      shallowMatcher: '{{matcher}}() is a shallow assertion. {{reason}}'
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        checkExpectArgPatterns(context, node);
        checkMatcherPatterns(context, node);
      }
    };
  }
};
