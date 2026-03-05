import eslint from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import importPlugin from 'eslint-plugin-import'
import globals from 'globals'

export default defineConfig(
  globalIgnores(['dist/', 'eslint.config.js']),
  eslint.configs.recommended,
  importPlugin.flatConfigs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    files: ['**/*.ts'],
    extends: [
      tseslint.configs.recommendedTypeChecked,
      importPlugin.flatConfigs.typescript,
    ],
    rules: {
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['sibling', 'parent'],
            'index',
          ],
          pathGroups: [
            {
              pattern: '@/**',
              group: 'internal',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'never',
          distinctGroup: false,
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/newline-after-import': 'error',
    },
  },
  {
    files: ['**/*.ts'],
    ignores: ['src/client/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.app.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.node,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.app.json',
        },
        node: true,
      },
    },
  },
  {
    files: ['src/client/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.client.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.browser,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.client.json',
        },
      },
    },
  },
  prettierConfig,
)
