export default {
  extends: [
    'stylelint-config-standard',
    'stylelint-config-recess-order',
  ],
  overrides: [
    {
      files: ['**/*.less'],
      customSyntax: 'postcss-less',
    },
  ],
  rules: {
    /* ========================================================================
     * UI 规范拦截规则 —— 防止在重构期间产生新的不规范样式代码
     *
     * 1. 禁止在 Less 中手写 display: flex / display: grid，应使用 Antd <Flex> / <Layout> 组件
     * 2. 禁止硬编码十六进制颜色值，必须使用 var(--ant-*) 或 var(--app-*) Token 变量
     * 3. 其他规范规则
     * ======================================================================== */

    /* 禁止 display: flex / inline-flex / grid / inline-grid */
    'declaration-property-value-disallowed-list': {
      display: ['flex', 'inline-flex', 'grid', 'inline-grid'],
    },

    /* 禁止硬编码十六进制颜色（允许 rgb/rgba/hsl/hsla/var） */
    'color-no-hex': true,

    /* 禁止无效十六进制颜色缩写 */
    'color-hex-length': 'long',

    /* 禁止使用 important（除皮肤覆盖等特殊场景） */
    'declaration-no-important': true,

    /* 禁止重复属性 */
    'declaration-block-no-duplicate-properties': true,

    /* 禁止空块 */
    'block-no-empty': true,

    /* 选择器命名规范：只允许 BEM 风格（app- 前缀或 CSS Modules） */
    'selector-class-pattern': null,

    /* 允许 Less 特有语法 */
    'at-rule-no-unknown': null,
    'no-descending-specificity': null,

    /* 函数规范 */
    'function-no-unknown': [
      true,
      {
        ignoreFunctions: ['color-mix'],
      },
    ],
  },
};
