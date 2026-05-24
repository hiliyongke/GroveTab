import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

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

      /* ========================================================================
       * UI 规范拦截规则 —— 防止在重构期间产生新的不规范代码
       *
       * 1. 禁止使用原生 <button>，必须使用 Antd <Button>
       * 2. 禁止使用原生 <h1>~<h6>、<p>，必须使用 <Typography.Title> / <Typography.Text> / <Typography.Paragraph>
       * 3. 禁止使用原生 <input>，必须使用 Antd <Input> / <InputNumber> 等
       * 4. 禁止在 JSX 元素上使用内联 style={{...}}，应使用 CSS Modules 或 Antd Token
       * ======================================================================== */
      'no-restricted-syntax': [
        'error',
        // 拦截原生 <button> 标签
        {
          selector: "JSXElement[openingElement.name.name='button']",
          message: '禁止使用原生 <button>，请使用 Antd <Button> 组件',
        },
        // 拦截原生 <h1>~<h6> 标签
        {
          selector: "JSXElement[openingElement.name.name='h1']",
          message: '禁止使用原生 <h1>，请使用 <Typography.Title level={1}>',
        },
        {
          selector: "JSXElement[openingElement.name.name='h2']",
          message: '禁止使用原生 <h2>，请使用 <Typography.Title level={2}>',
        },
        {
          selector: "JSXElement[openingElement.name.name='h3']",
          message: '禁止使用原生 <h3>，请使用 <Typography.Title level={3}>',
        },
        {
          selector: "JSXElement[openingElement.name.name='h4']",
          message: '禁止使用原生 <h4>，请使用 <Typography.Title level={4}>',
        },
        {
          selector: "JSXElement[openingElement.name.name='h5']",
          message: '禁止使用原生 <h5>，请使用 <Typography.Title level={5}>',
        },
        {
          selector: "JSXElement[openingElement.name.name='h6']",
          message: '禁止使用原生 <h6>，请使用 <Typography.Title>',
        },
        // 拦截原生 <p> 标签
        {
          selector: "JSXElement[openingElement.name.name='p']",
          message: '禁止使用原生 <p>，请使用 <Typography.Paragraph> 或 <Typography.Text>',
        },
        // 拦截原生 <input> 标签
        {
          selector: "JSXElement[openingElement.name.name='input']",
          message: '禁止使用原生 <input>，请使用 Antd <Input> / <InputNumber> / <Checkbox> 等组件',
        },
        // 拦截内联 style={{...}} 对象字面量（放行 style={变量} / style={cssVars(...)} 等动态样式）
        {
          selector: 'JSXAttribute[name.name="style"] > JSXExpressionContainer > ObjectExpression.properties',
          message: '禁止使用内联 style={{...}} 对象字面量，请使用 CSS Modules (className={styles.xxx}) 或 Antd Design Token',
        },
      ],
    },
  },
);
