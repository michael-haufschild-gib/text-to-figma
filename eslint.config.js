// ESLint v9 flat config — unified for all three packages + tests
const tsParser = require('@typescript-eslint/parser');
const tseslint = require('@typescript-eslint/eslint-plugin');
const prettierPlugin = require('eslint-plugin-prettier');
const eslintConfigPrettier = require('eslint-config-prettier');
const figmaPlugin = require('@figma/eslint-plugin-figma-plugins');
const globals = require('globals');

// Custom rules
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
  '@typescript-eslint/require-await': 'warn'
};

const codeQualityRules = {
  'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['warn', { max: 150, skipBlankLines: true, skipComments: true }],
  complexity: ['warn', { max: 25 }],
  eqeqeq: ['error', 'always'],
  curly: ['error', 'all'],
  'no-throw-literal': 'error',
  'prefer-const': 'error',
  'no-var': 'error',
  'no-unused-expressions': 'error'
};

module.exports = [
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
      'prettier/prettier': ['error', { endOfLine: 'auto', tabWidth: 2, useTabs: false }]
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
      'prettier/prettier': ['error', { endOfLine: 'auto', tabWidth: 2, useTabs: false }]
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
        __html__: 'readonly'
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
      'prettier/prettier': ['error', { endOfLine: 'auto', tabWidth: 2, useTabs: false }]
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

  // ─── Tests: TypeScript ───────────────────────────────────────────────────
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
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
      'local/no-shallow-test-matchers': 'error',
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', { max: 25 }]
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
      'coverage/**',
      'eslint-rules/**',
      // Legacy JS integration tests require live WebSocket server — not in CI pipeline
      'tests/**/*.js'
    ]
  }
];
