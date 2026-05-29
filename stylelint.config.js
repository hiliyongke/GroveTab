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
    /**
     * 浮层覆盖层文件 + popup / newtab 全局架构样式：允许 !important（必须显式覆盖 antd 内联优先级）。
     * 这些文件本身就是为了"集中收敛覆盖样式"，是 !important 的合法栖息地。
     */
    {
      files: [
        '**/_floating-overrides.less',
        '**/_skin-overrides.less',
        '**/pages/popup/styles/index.less',
        '**/pages/newtab/styles/**/*.less',
        '**/pages/newtab/prepaint.css',
        '**/shared/styles/_variables.less',
      ],
      rules: {
        'declaration-no-important': null,
        'declaration-property-value-disallowed-list': null,
        /* 覆盖层中的 hex 多为预设颜色/fallback，取消限制 */
        'color-no-hex': null,
        'no-duplicate-selectors': null,
        'no-invalid-position-at-import-rule': null,
      },
    },
    /**
     * 历史 .module.less：不阻断 display: flex / grid，不阻断 hex 颜色
     * （v1.4 增量治理，新增样式仍需走 antd Flex/Layout 与 design tokens）。
     * 属性顺序由 lint:style:fix 自动修；!important 在 v1.4 阶段作为 antd 覆盖实践保留（v1.5 逐步迁到 ConfigProvider components token）。
     */
    {
      files: ['**/*.module.less'],
      rules: {
        'declaration-property-value-disallowed-list': null,
        'color-no-hex': null,
        'declaration-no-important': null,
        'no-duplicate-selectors': null,
        'declaration-block-no-duplicate-properties': null,
        'declaration-property-value-no-unknown': null,
        'declaration-property-value-keyword-no-deprecated': null,
        'block-no-empty': null,
      },
    },
  ],
  rules: {
    /* ========================================================================
     * UI 规范拦截规则 —— 防止在重构期间产生新的不规范样式代码
     *
     * 1. 禁止在 Less 中手写 display: flex / display: grid，应使用 Antd <Flex> / <Layout> 组件
     *    （仅作用于全局 .less，不阻断历史 .module.less，详见 overrides）
     * 2. 禁止硬编码十六进制颜色值，必须使用 var(--ant-*) 或 var(--app-*) Token 变量
     * 3. 其他规范规则
     * ======================================================================== */

    /* 禁止 display: flex / inline-flex / grid / inline-grid（仅作用于非 module.less） */
    'declaration-property-value-disallowed-list': {
      display: ['flex', 'inline-flex', 'grid', 'inline-grid'],
    },

    /* 禁止硬编码十六进制颜色（允许 rgb/rgba/hsl/hsla/var） */
    'color-no-hex': true,

    /* 禁止无效十六进制颜色缩写 */
    'color-hex-length': 'long',

    /* 禁止使用 important（覆盖层文件已在 overrides 中豁免） */
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

    /* 补全 antd v6 复合伪类与常见 less / module 选择器白名单 */
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['where', 'is', 'has', 'global', 'local'],
      },
    ],

    /* 函数规范 */
    'function-no-unknown': [
      true,
      {
        ignoreFunctions: ['color-mix'],
      },
    ],

    /* Less 中 @import 不强制 url() 语法 */
    'function-url-quotes': null,
    'import-notation': null,
  },
};
