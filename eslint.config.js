import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'url';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const tabPlugin = require('./eslint-plugins/eslint-plugin-tab.cjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

// ─── 内联 i18n-zh 插件规则 ──────────────────────────────────────────
const CHINESE_REGEX = /[\u4e00-\u9fff]/;

const i18nZhPlugin = {
  rules: {
    'no-bare-zh-in-jsx': {
      meta: {
        type: 'suggestion',
        docs: {
          description: '禁止在 JSX 文本节点中直接使用硬编码中文，请使用 t() 翻译函数',
          category: 'Best Practices',
        },
        messages: {
          bareZhInJsx:
            'JSX 中发现硬编码中文 "{{text}}"，请使用 t("{{text}}") 替代以支持国际化。',
        },
        schema: [],
      },
      create(context) {
        return {
          JSXText(node) {
            const text = node.value.trim();
            if (!text) return;
            if (!CHINESE_REGEX.test(text)) return;
            // <Trans> 组件内的文本是合法的
            const parent = node.parent;
            if (
              parent &&
              parent.type === 'JSXElement' &&
              parent.openingElement.name.name === 'Trans'
            ) {
              return;
            }
            context.report({
              node,
              messageId: 'bareZhInJsx',
              data: { text },
            });
          },
        };
      },
    },
    'no-bare-zh-in-js': {
      meta: {
        type: 'suggestion',
        docs: {
          description: '禁止在 JS 字符串字面量中直接使用硬编码中文，请使用 t() 翻译函数',
          category: 'Best Practices',
        },
        messages: {
          bareZhInJs:
            '字符串中发现硬编码中文 "{{text}}"，请使用 t("{{text}}") 替代以支持国际化。',
        },
        schema: [],
      },
      create(context) {
        function isInAllowedContext(node) {
          let current = node.parent;
          while (current) {
            if (
              current.type === 'CallExpression' &&
              current.callee.type === 'Identifier' &&
              (current.callee.name === 't' || current.callee.name === 'translate')
            ) {
              return true;
            }
            if (
              current.type === 'CallExpression' &&
              current.callee.type === 'MemberExpression' &&
              current.callee.object.type === 'Identifier' &&
              current.callee.object.name === 'console' &&
              ['log', 'warn', 'error', 'info', 'debug'].includes(current.callee.property.name)
            ) {
              return true;
            }
            if (current.type === 'ImportDeclaration') {
              return true;
            }
            current = current.parent;
          }
          return false;
        }

        return {
          Literal(node) {
            if (typeof node.value !== 'string') return;
            const text = node.value;
            if (!CHINESE_REGEX.test(text)) return;
            if (isInAllowedContext(node)) return;
            context.report({
              node,
              messageId: 'bareZhInJs',
              data: { text },
            });
          },
          TemplateLiteral(node) {
            for (const quasi of node.quasis) {
              const text = quasi.value.cooked || quasi.value.raw;
              if (CHINESE_REGEX.test(text)) {
                if (isInAllowedContext(node)) return;
                context.report({
                  node: quasi,
                  messageId: 'bareZhInJs',
                  data: { text: text.trim() || text },
                });
              }
            }
          },
        };
      },
    },
    'no-explicit-any': {
      meta: {
        type: 'problem',
        docs: {
          description: '禁止显式使用 TypeScript any 类型，请使用 unknown 或更精确的类型',
          category: 'Best Practices',
        },
        messages: {
          noExplicitAny:
            '禁止使用 any 类型。请使用 unknown（然后通过类型守卫收窄）或定义更精确的类型。',
        },
        schema: [],
      },
      create(context) {
        const filePath = context.getFilename ? context.getFilename() : (context.filename || '');

        // 豁免：测试文件、类型定义文件、配置文件
        if (
          filePath.endsWith('.test.ts') ||
          filePath.endsWith('.test.tsx') ||
          filePath.endsWith('.spec.ts') ||
          filePath.endsWith('.spec.tsx') ||
          filePath.endsWith('.d.ts') ||
          filePath.endsWith('.config.ts') ||
          filePath.endsWith('.config.js') ||
          filePath.endsWith('.config.cjs')
        ) {
          return {};
        }

        return {
          TSAnyKeyword(node) {
            context.report({
              node,
              messageId: 'noExplicitAny',
            });
          },
          TSAsExpression(node) {
            if (
              node.typeAnnotation &&
              node.typeAnnotation.type === 'TSAnyKeyword'
            ) {
              context.report({
                node,
                messageId: 'noExplicitAny',
              });
            }
          },
        };
      },
    },
  },
};

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
      'i18n-zh': i18nZhPlugin,
      'tab': tabPlugin,
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
      /* ========================================================================
       * 国际化中文检测规则 —— 防止代码中出现硬编码中文
       *
       * 1. no-bare-zh-in-jsx: 禁止在 JSX 文本节点中直接使用中文
       * 2. no-bare-zh-in-js:  禁止在 JS 字符串字面量中直接使用中文
       * 注意：t() / translate() 参数内的中文不触发警告
       * ======================================================================== */
      'i18n-zh/no-bare-zh-in-jsx': 'warn',
      'i18n-zh/no-bare-zh-in-js': 'warn',

      /* ========================================================================
       * Tab 项目专属规则
       *
       * 1. no-whole-store-subscription  禁止订阅整个 Zustand Store
       * 2. no-relative-cross-dir-import 跨目录引用必须使用路径别名
       * 3. no-direct-chrome-api         禁止业务代码直接调用 chrome.* API
       * 4. no-direct-storage-api        禁止非 repos 层直接调用 chrome.storage.*
       * 5. no-direct-feedback-api       禁止直接使用 antd 静态 message/notification/modal
       * 6. prefer-named-function-component 禁止匿名箭头函数组件
       * 7. no-default-export-anonymous-component 禁止 export default 匿名组件
       * 8. no-large-component           组件文件超过 400 行时警告
       * ======================================================================== */
      'tab/no-whole-store-subscription': 'error',
      'tab/no-relative-cross-dir-import': ['error', { maxDepth: 1 }],
      'tab/no-direct-chrome-api': 'warn',
      'tab/no-direct-storage-api': 'error',
      'tab/no-direct-feedback-api': 'warn',
      'tab/prefer-named-function-component': 'warn',
      'tab/no-default-export-anonymous-component': 'warn',
      'tab/no-large-component': ['warn', { max: 400 }],

      // ─── 新增规则（2025-05 补齐） ──────────────────────────────────────────────
      // tab 插件新增 4 条规则
      'tab/no-direct-web-storage-api': 'error',
      'tab/no-direct-window-api': 'warn',
      'tab/no-direct-navigator-api': 'warn',
      'tab/no-direct-fetch': 'error',

      // i18n-zh 插件新增 1 条规则
      'i18n-zh/no-explicit-any': 'error',

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
  /* ============================================================
   * CSS Modules 死 class 检测
   * css-modules/no-unused-class  — CSS 中定义但 JS 未引用的 class
   * css-modules/no-undef-class   — JS 中引用但 CSS 未定义的 class
   * 注：通过 FlatCompat 桥接，兼容 ESLint 10 flat config
   * ============================================================ */
  ...compat.config({
    plugins: ['css-modules'],
    rules: {
      'css-modules/no-unused-class': ['warn', { camelCase: true }],
      'css-modules/no-undef-class': ['warn', { camelCase: true }],
    },
  }),
);
