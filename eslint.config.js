import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsdoc from 'eslint-plugin-jsdoc';
import react from 'eslint-plugin-react';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  { ignores: ['dist', '.planning', 'node_modules', '*.d.ts', 'tests', 'build/', '.husky/'] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      jsdoc: jsdoc,
      'react': react,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      /* TypeScript ESLint 规则 */
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-misused-promises': 'error',

      /* 禁用太严格的规则 */
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/dot-notation': 'off',
      '@typescript-eslint/prefer-includes': 'off',
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      'no-useless-assignment': 'off',

      /* 代码风格 */
      '@typescript-eslint/array-type': ['warn', { default: 'array-simple' }],
      '@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-inferrable-types': 'warn',
      '@typescript-eslint/prefer-for-of': 'warn',
      '@typescript-eslint/prefer-function-type': 'warn',

      /* JSDoc 规范检查 - 简化版 */
      'jsdoc/require-jsdoc': ['warn', {
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
          ClassDeclaration: true,
          ArrowFunctionExpression: false,
          FunctionExpression: false,
        },
      }],
      'jsdoc/require-param': 'warn',
      'jsdoc/require-returns': ['warn', {
        contexts: ['!FunctionExpression[parent.init.type="FunctionExpression"]', '!ArrowFunctionExpression[parent.init.type="ArrowFunctionExpression"]'],
        exemptedBy: ['returns', 'type', 'class'],
      }],

      /* React 性能优化规则 */
      'react/jsx-key': 'error',
      'react/jsx-no-useless-fragment': 'warn',
      'react/no-array-index-key': 'warn',
      'react/no-children-prop': 'warn',
      'react/no-danger': 'warn',
      'react/no-set-state': 'off', // Zustand 使用 setState

      /* 无障碍访问规则 */
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-is-valid': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
    },
  },
  // 例外文件：类型声明文件不需要 JSDoc 注释
  {
    files: ['**/*.d.ts'],
    rules: {
      'jsdoc/require-file-overview': 'off',
      'jsdoc/require-jsdoc': 'off',
    },
  },
);
