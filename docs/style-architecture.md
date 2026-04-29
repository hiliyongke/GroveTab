# Style Architecture

本项目的样式定制以 `antd v6` 官方推荐链路为中心：

1. 主题入口只允许通过 `ConfigProvider.theme` 定制 antd token。
2. 业务层只允许消费 `--app-*` 语义变量，不直接依赖 antd 内部 DOM 结构。
3. 全局 CSS 只保留浏览器级 reset、布局 utility 和跨组件视觉原语。

## 当前分层

- `src/shared/theme/skin-presets.ts`
  皮肤预设数据源，只定义设计 token，不参与 React 渲染。

- `src/shared/theme/theme-customization.ts`
  样式定制核心模块。
  `buildAntdThemeConfig()` 负责把皮肤预设映射为 antd v6 `ThemeConfig`。
  `buildAppThemeVars()` 负责把业务需要的视觉原语桥接为 `--app-*` CSS 变量。
  `getSkinCustomBaseValues()` 负责让“极客定制”开关继承当前皮肤基线，而不是落回硬编码默认值。

- `src/shared/ui/AntdThemeProvider.tsx`
  主题运行时装配层，只负责：
  同步 `data-theme`
  挂载 `ConfigProvider`
  注入 `--app-*`
  绑定 antd `App.useApp()` 反馈实例

- `src/pages/newtab/index.css`
  只放三类样式：
  浏览器与页面基础样式
  业务语义类，如 `.app-row-hover`、`.app-card-interactive`
  antd 无法表达的结构类，如 masonry、噪点、动画 keyframes

## 官方最佳实践对齐

与 antd v6 官方推荐一致的部分：

- 主题主入口统一收敛到 `ConfigProvider.theme`。
- 通过 `token` 和 `components` 做 seed/component token 定制，而不是大面积覆盖 `.ant-*`。
- 开启 `cssVar` 模式，让全局 CSS 和业务组件消费稳定变量，而不是读运行时 class hash。

仍需继续治理的部分：

- 项目里仍有大量 `style={{ ... }}` 内联样式，说明视觉实现仍然分散。
- 多数页面组件直接消费 `theme.useToken()` 拼局部样式对象，复用性弱。
- `newtab/index.css` 已经承担了不少业务原语，但还没有拆成 `base / primitives / utilities` 多文件。

## 后续治理规则

新增样式时按下面顺序判断：

1. 如果是 antd 组件皮肤差异，优先改 `buildAntdThemeConfig()`。
2. 如果是跨组件业务视觉原语，优先新增 `--app-*` 变量和语义类。
3. 如果只是单个组件局部布局，才在组件内保留最小内联样式。
4. 禁止新增面向 antd 私有结构的深层覆盖选择器，除非官方 className 无法表达。

推荐的收敛方向：

- 把高频的玻璃卡片、面板容器、标题区、统计条抽成共享 primitives。
- 逐步用 `classNames` / `styles` / `rootClassName` 替代大块内联 `style`。
- 为 popup、workspace、trending 分别建立页面级样式文件，避免继续把所有全局语义塞进一个 `index.css`。

## 本轮修正点

- 极客定制开关改为继承当前皮肤基线，避免一开启就把当前皮肤跳回固定值。
- 标题字体、正文字重、hairline 等业务语义变量统一从主题模块注入。
- `AntdThemeProvider` 从“大而全实现”收敛为“纯装配层”，主题逻辑集中到了 `theme-customization.ts`。
