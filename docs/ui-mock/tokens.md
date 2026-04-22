# Canopy × antd v6 设计令牌

> 风格方向：**现代轻盈 · 卡片化**（参考 Arc / Notion / Linear）
> 主题：antd 默认蓝 `#1677ff` 明暗双套
> 技术：antd v6 ConfigProvider theme token + css-in-js，**不再使用 Tailwind**

---

## 1. 品牌色 Palette

### Light 模式

| Token                  | 值          | 用途                       |
| ---------------------- | ----------- | -------------------------- |
| `colorPrimary`         | `#1677ff`   | antd 默认蓝，主要交互      |
| `colorPrimaryHover`    | `#4096ff`   | 按钮 hover                 |
| `colorPrimaryActive`   | `#0958d9`   | 按钮 active                |
| `colorSuccess`         | `#52c41a`   | 成功/已归档                |
| `colorWarning`         | `#faad14`   | 重复标签提示               |
| `colorError`           | `#ff4d4f`   | 删除/危险                  |
| `colorInfo`            | `#1677ff`   | 信息气泡                   |
| `colorBgLayout`        | `#f5f7fa`   | 页面背景（浅冷灰）         |
| `colorBgContainer`     | `#ffffff`   | 卡片/容器                  |
| `colorBgElevated`      | `#ffffff`   | 浮层（Modal/Drawer）       |
| `colorBorderSecondary` | `#f0f0f0`   | 极淡分割                   |
| `colorTextBase`        | `#1f1f1f`   | 主文本                     |
| `colorTextSecondary`   | `#595959`   | 次级文本                   |
| `colorTextTertiary`    | `#8c8c8c`   | 辅助文本                   |
| `colorTextQuaternary`  | `#bfbfbf`   | placeholder                |

### Dark 模式

| Token                  | 值          |
| ---------------------- | ----------- |
| `colorPrimary`         | `#1677ff`   |
| `colorBgLayout`        | `#141414`   |
| `colorBgContainer`     | `#1f1f1f`   |
| `colorBgElevated`      | `#262626`   |
| `colorBorderSecondary` | `#303030`   |
| `colorTextBase`        | `#ffffffd9` |
| `colorTextSecondary`   | `#ffffff73` |

---

## 2. 形状与节奏

| Token              | 值     | 说明                                           |
| ------------------ | ------ | ---------------------------------------------- |
| `borderRadius`     | `10`   | 基础圆角（卡片、Input、Button）                |
| `borderRadiusLG`   | `14`   | 大卡片、Modal                                  |
| `borderRadiusSM`   | `6`    | Tag、小徽章                                    |
| `borderRadiusXS`   | `4`    | Kbd、inline 标签                               |
| `controlHeight`    | `36`   | 按钮、输入默认高度（比 antd 默认 32 大一点，更呼吸） |
| `controlHeightLG`  | `44`   | 顶部大搜索栏                                   |
| `controlHeightSM`  | `28`   | 密集控件（去重栏）                             |

## 3. 字体

```
fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif'
fontFamilyCode: 'JetBrains Mono, ui-monospace, Menlo, monospace'
fontSize: 14                 // 基础
fontSizeSM: 12
fontSizeLG: 16
fontSizeHeading1: 32
fontSizeHeading2: 24
fontSizeHeading3: 20
fontSizeHeading4: 16
lineHeight: 1.55
```

## 4. 间距（Space Token）

遵循 antd 的 `paddingXS / paddingSM / padding / paddingLG / paddingXL`，对应 `8 / 12 / 16 / 24 / 32`。
**禁止直接写 px 内联 padding**，一律走 token 或 `<Space size="middle">`。

## 5. 阴影（Elevation）

| 层级 | antd Token 对应             | 用途                       |
| ---- | --------------------------- | -------------------------- |
| 1    | `boxShadowTertiary`         | 卡片 hover                 |
| 2    | `boxShadowSecondary`        | Popover、Dropdown          |
| 3    | `boxShadow`                 | Modal、Drawer              |

Card 默认无阴影（`variant="outlined"`），hover 时升一级，保证轻盈。

## 6. 动效

| Token              | 值      | 用途                     |
| ------------------ | ------- | ------------------------ |
| `motionDurationFast`  | `0.1s`  | Button、Tag 状态切换     |
| `motionDurationMid`   | `0.2s`  | 默认过渡                 |
| `motionDurationSlow`  | `0.3s`  | Modal、Drawer 进出       |
| `motionEaseInOut`     | `cubic-bezier(0.645, 0.045, 0.355, 1)` | 默认缓动 |

## 7. 组件映射表（旧 → 新）

| 现状                              | 迁移目标                     |
| --------------------------------- | ---------------------------- |
| `shared/ui/primitives/Button`     | `antd.Button`                |
| `shared/ui/primitives/IconButton` | `antd.Button` shape="circle" type="text" |
| `shared/ui/primitives/Input`      | `antd.Input`                 |
| `shared/ui/primitives/Textarea`   | `antd.Input.TextArea`        |
| `shared/ui/primitives/Card`       | `antd.Card`                  |
| `shared/ui/primitives/Badge`      | `antd.Tag`                   |
| `shared/ui/primitives/Dialog`     | `antd.Modal` / `antd.Drawer` |
| `shared/ui/primitives/Tooltip`    | `antd.Tooltip`               |
| `shared/ui/primitives/ScrollArea` | 原生 overflow + 自定义滚动条 |
| `shared/ui/primitives/Separator`  | `antd.Divider`               |
| `shared/ui/primitives/Kbd`        | 保留（简单自定义 span）      |
| `UndoToast`                       | `antd.message` 或 `antd.notification` |
| `ViewSwitcher`                    | `antd.Segmented`             |
| `SearchBox` 命令面板              | `antd.Modal` + `antd.AutoComplete` / `antd.List` |
| `SettingsPanel`                   | `antd.Drawer` + `antd.Form`  |
| `ArchivePanel`                    | `antd.Drawer` + `antd.List`  |
| `OnboardingCard`                  | `antd.Card` + `antd.Steps`   |
| `TabContextMenu`                  | `antd.Dropdown` (trigger=contextMenu) |
| `DomainGroupCard`                 | `antd.Card` + `antd.Collapse` |
| `DedupInfoBar`                    | `antd.Alert` + 自定义 Actions |

## 8. 迁移节奏

```
Phase A  安装 antd v6 + 主题 Provider + 全局样式重置           (0.5d)
Phase B  重写 shared/ui/primitives/* 为 antd 轻封装            (1d)
Phase C  替换 features 层组件（按文件列表逐个迁）              (2d)
Phase D  删除 Tailwind 依赖 + 清理 index.css                   (0.5d)
Phase E  联调 + 扩展打包验证                                    (0.5d)
```
