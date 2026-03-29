import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      boundaries,
    },
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.app.json',
        },
      },
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/*', mode: 'folder', capture: ['moduleName'] },
        { type: 'pages', pattern: 'src/pages/*', mode: 'folder', capture: ['moduleName'] },
        { type: 'widgets', pattern: 'src/widgets/*', mode: 'folder', capture: ['moduleName'] },
        { type: 'features', pattern: 'src/features/*', mode: 'folder', capture: ['moduleName'] },
        { type: 'entities', pattern: 'src/entities/*', mode: 'folder', capture: ['moduleName'] },
        { type: 'shared', pattern: 'src/shared/*', mode: 'folder', capture: ['moduleName'] },
        { type: 'labs', pattern: 'src/labs/*', mode: 'folder', capture: ['moduleName'] },
        {
          type: 'sandbox',
          pattern: 'src/sandbox/*',
          mode: 'folder',
          capture: ['moduleName'],
        },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          message:
            "Import violates docs/frontend-rules-v0.3.md. 如确属真实例外，必须人工评审后再记录到对应 labs 模块的 meta.ts exception 字段。不要用深层 import 或相对路径绕过规则。",
          rules: [
            {
              from: { type: 'app' },
              allow: [
                { to: { type: 'app', captured: { moduleName: '{{from.moduleName}}' } } },
                { to: { type: ['pages', 'widgets', 'features', 'entities', 'shared'] } },
              ],
            },
            {
              from: { type: 'pages' },
              allow: [
                { to: { type: 'pages', captured: { moduleName: '{{from.moduleName}}' } } },
                { to: { type: ['widgets', 'features', 'entities', 'shared'] } },
              ],
            },
            {
              from: { type: 'widgets' },
              allow: [
                { to: { type: 'widgets', captured: { moduleName: '{{from.moduleName}}' } } },
                { to: { type: ['features', 'entities', 'shared'] } },
              ],
            },
            {
              from: { type: 'features' },
              allow: [
                {
                  to: { type: 'features', captured: { moduleName: '{{from.moduleName}}' } },
                },
                { to: { type: ['entities', 'shared'] } },
              ],
            },
            {
              from: { type: 'entities' },
              allow: [
                {
                  to: { type: 'entities', captured: { moduleName: '{{from.moduleName}}' } },
                },
                { to: { type: 'shared' } },
              ],
            },
            {
              from: { type: 'shared' },
              allow: [{ to: { type: 'shared', captured: { moduleName: '{{from.moduleName}}' } } }],
            },
            {
              from: { type: 'labs' },
              allow: [
                { to: { type: 'labs', captured: { moduleName: '{{from.moduleName}}' } } },
                { to: { type: ['shared', 'entities'] } },
              ],
            },
            {
              from: { type: 'sandbox' },
              allow: [
                {
                  to: { type: 'sandbox', captured: { moduleName: '{{from.moduleName}}' } },
                },
                { to: { type: ['shared', 'entities'] } },
              ],
            },
          ],
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/app/*/*',
                '@/pages/*/*',
                '@/widgets/*/*',
                '@/features/*/*',
                '@/entities/*/*',
                '@/labs/*/*',
                '@/sandbox/*/*',
                '**/app/*/*',
                '**/pages/*/*',
                '**/widgets/*/*',
                '**/features/*/*',
                '**/entities/*/*',
                '**/labs/*/*',
                '**/sandbox/*/*',
              ],
              message:
                'Cross-module imports must use a module public API such as "@/entities/user". 如认为确需例外，请先人工评审；不要用深层 import 绕过规则。',
            },
          ],
        },
      ],
    },
  },
]);
