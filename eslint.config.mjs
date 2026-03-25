// ESLint v9 flat config — unified for all three packages + tests (ESM)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tsParser from '@typescript-eslint/parser';
import tseslint from '@typescript-eslint/eslint-plugin';
import prettierPlugin from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';
import figmaPlugin from '@figma/eslint-plugin-figma-plugins';
import globals from 'globals';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Custom rules (CommonJS modules loaded via createRequire)
const localLintPlugin = {
  rules: {
    'no-inline-color-values': require('./eslint-rules/no-inline-color-values'),
    'no-shallow-test-matchers': require('./eslint-rules/no-shallow-test-matchers')
  }
};

// ─── Shared rule sets ────────────────────────────────────────────────────────

const strictTypeScriptRules = {
  ...(tseslint.configs.recommended && tseslint.configs.recommended.rules
    ? tseslint.configs.recommended.rules
    : {}),
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
  ],
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-misused-promises': 'error',
  '@typescript-eslint/await-thenable': 'error',
  '@typescript-eslint/no-unnecessary-type-assertion': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/consistent-type-assertions': [
    'error',
    { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' }
  ],
  '@typescript-eslint/require-await': 'error',

  // ─── Implicit `any` safety — catches AI-generated type holes ────────────
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
  '@typescript-eslint/no-unsafe-argument': 'error',

  // ─── Logic correctness ──────────────────────────────────────────────────
  '@typescript-eslint/no-unnecessary-condition': 'error',
  '@typescript-eslint/switch-exhaustiveness-check': 'error',
  '@typescript-eslint/restrict-template-expressions': [
    'error',
    { allowNumber: true, allowBoolean: true }
  ],
  '@typescript-eslint/prefer-nullish-coalescing': 'error',
  '@typescript-eslint/prefer-optional-chain': 'error',
  '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],

  // ─── Boolean hygiene — kills lazy truthiness, forces explicit checks ────
  '@typescript-eslint/strict-boolean-expressions': [
    'error',
    {
      allowString: false,
      allowNumber: false,
      allowNullableObject: true,
      allowNullableBoolean: true,
      allowNullableString: true,
      allowNullableNumber: false,
      allowNullableEnum: false,
      allowAny: false
    }
  ]
};

const codeQualityRules = {
  'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
  complexity: ['error', { max: 20 }],
  eqeqeq: ['error', 'always'],
  curly: ['error', 'all'],
  'no-throw-literal': 'error',
  'prefer-const': 'error',
  'no-var': 'error',
  'no-unused-expressions': 'error'
};

export default [
  // ─── MCP Server: TypeScript (strict) ─────────────────────────────────────
  {
    files: ['mcp-server/src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./mcp-server/tsconfig.json'],
        tsconfigRootDir: __dirname
      },
      globals: {
        ...globals.node
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettierPlugin,
      local: localLintPlugin
    },
    rules: {
      ...strictTypeScriptRules,
      ...codeQualityRules,
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../websocket-server/*'],
              message: 'mcp-server must not import websocket-server internals'
            },
            {
              group: ['../../figma-plugin/*'],
              message: 'mcp-server must not import figma-plugin internals'
            }
          ]
        }
      ],
      'prettier/prettier': ['error', { endOfLine: 'lf', tabWidth: 2, useTabs: false }]
    }
  },

  // ─── WebSocket Server: TypeScript ────────────────────────────────────────
  {
    files: ['websocket-server/src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./websocket-server/tsconfig.json'],
        tsconfigRootDir: __dirname
      },
      globals: {
        ...globals.node
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettierPlugin
    },
    rules: {
      ...strictTypeScriptRules,
      ...codeQualityRules,
      'no-console': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../mcp-server/*'],
              message: 'websocket-server must not import mcp-server internals'
            },
            {
              group: ['../../figma-plugin/*'],
              message: 'websocket-server must not import figma-plugin internals'
            }
          ]
        }
      ],
      'prettier/prettier': ['error', { endOfLine: 'lf', tabWidth: 2, useTabs: false }]
    }
  },

  // ─── Figma Plugin: TypeScript ────────────────────────────────────────────
  {
    files: ['figma-plugin/src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./figma-plugin/tsconfig.json'],
        tsconfigRootDir: __dirname
      },
      globals: {
        figma: 'readonly',
        parent: 'readonly',
        __html__: 'readonly',
        __PLUGIN_VERSION__: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettierPlugin,
      local: localLintPlugin
    },
    rules: {
      ...strictTypeScriptRules,
      ...codeQualityRules,
      'no-console': 'off',
      // Figma API types require object literal assertions for discriminated union returns
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'as' }],
      'prettier/prettier': ['error', { endOfLine: 'lf', tabWidth: 2, useTabs: false }]
    }
  },

  // ─── Figma Plugin API: ban deprecated sync methods/properties/ID params ──
  {
    files: ['figma-plugin/src/**/*.ts'],
    ...figmaPlugin.flatConfigs['recommended-problems-only'],
    rules: {
      ...figmaPlugin.flatConfigs['recommended-problems-only'].rules,
      // TypeScript already errors on missing async — redundant
      '@figma/figma-plugins/await-requires-async': 'off'
    }
  },

  // ─── Tests: TypeScript (type-checked) ───────────────────────────────────
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./tests/tsconfig.eslint.json'],
        tsconfigRootDir: __dirname
      },
      globals: {
        ...globals.node
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      local: localLintPlugin
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true }
      ],
      'local/no-shallow-test-matchers': 'error',
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      complexity: ['error', { max: 15 }],

      // ─── Ban .skip and .only abuse ───────────────────────────────────────
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.object.name="it"][callee.property.name="skip"]',
          message: 'No it.skip — fix or remove the test.'
        },
        {
          selector: 'CallExpression[callee.object.name="test"][callee.property.name="skip"]',
          message: 'No test.skip — fix or remove the test.'
        },
        {
          selector: 'CallExpression[callee.object.name="describe"][callee.property.name="skip"]',
          message: 'No describe.skip — fix or remove the test suite.'
        },
        {
          selector: 'CallExpression[callee.object.name="it"][callee.property.name="only"]',
          message: 'No it.only — remove before committing.'
        },
        {
          selector: 'CallExpression[callee.object.name="test"][callee.property.name="only"]',
          message: 'No test.only — remove before committing.'
        },
        {
          selector: 'CallExpression[callee.object.name="describe"][callee.property.name="only"]',
          message: 'No describe.only — remove before committing.'
        }
      ]
    }
  },

  // ─── Tests: JavaScript (legacy test files) ───────────────────────────────
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    },
    plugins: {
      local: localLintPlugin
    },
    rules: {
      'local/no-shallow-test-matchers': 'error',
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', { max: 25 }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },

  // ─── ESLint custom rules: CJS modules ──────────────────────────────────
  {
    files: ['eslint-rules/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'max-lines-per-function': ['warn', { max: 100, skipBlankLines: true, skipComments: true }]
    }
  },

  // ─── Turn off stylistic rules that conflict with Prettier ────────────────
  eslintConfigPrettier,

  // ─── Global ignores ──────────────────────────────────────────────────────
  {
    ignores: [
      'node_modules/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      'mcp-server/dist/**',
      'figma-plugin/code.js',
      'coverage/**'
    ]
  }
];
