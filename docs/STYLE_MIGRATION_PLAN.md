# 样式迁移计划

## 审计结果

### 发现的问题

1. **重复文件**：`src/pages/newtab/index.less` 和 `src/styles/global.less` 内容完全相同（约 26KB）
2. **混合样式方案**：项目同时使用 CSS Modules (`.module.less`) 和普通 Less (`.less`)

### 文件分类

#### ✅ 需要迁移到 CSS Modules

1. `src/features/arc-sidebar/ArcSidebar.less`
   - 原因：组件级样式，当前通过 `import './ArcSidebar.less'` 全局导入
   - 影响：ArcSidebar.tsx, pages/sidebar/main2.tsx

#### ⚠️ 需要清理的重复文件

1. `src/pages/newtab/index.less`
   - 和 `src/styles/global.less` 完全重复
   - 建议：删除此文件，更新所有导入指向 `src/styles/global.less`

#### 🔒 应保持全局的文件（含 `html`/`body`/`:root` 选择器）

1. `src/styles/global.less` - 全局效果、工具类、CSS 变量、动画
2. `src/pages/newtab/prepaint.less` - 预渲染样式（color-scheme, body 背景）
3. `src/shared/styles/_variables.less` - Less 全局变量
4. `src/shared/styles/mixins.less` - Less 全局 Mixins

#### ❓ 需要评估的文件

1. `src/pages/popup/styles/index.less` - 页面级样式
   - 当前包含 `.popup-shell` 等类名
   - 建议：如果只在 Popup 页面使用，应迁移到 CSS Modules
   - 如果多个页面共享，应保持全局并在 `STYLES_GUIDE.md` 中说明

2. `src/pages/newtab/styles/app-shell.less` - 布局样式
   - 包含 `.app-header-shell`, `.app-hero`, `.app-content-shell` 等
   - 建议：这些是全局布局类，应保持全局

## 📊 迁移进度

- ✅ **阶段 1：清理重复文件**（已完成）
  - 删除 `src/pages/newtab/index.less`（与 `global.less` 重复）
  - 更新 `newtab/main.tsx` 和 `popup/main.tsx` 导入

- ✅ **阶段 2：迁移 ArcSidebar 组件样式**（已完成）
  - `ArcSidebar.less` → `ArcSidebar.module.less`
  - 转换所有类名：kebab-case → camelCase
  - Commit: `b2f12b0`

- ✅ **阶段 3：迁移 Popup 页面样式**（已完成）
  - `popup/styles/index.less` → `index.module.less`
  - 更新 `App.tsx` 使用 CSS Modules
  - Commit: `bea1863`

- ✅ **阶段 4：更新文档**（已完成）
  - 创建 `docs/STYLES_GUIDE.md`
  - 更新本迁移计划

## 迁移步骤

### 阶段 1：清理重复文件（优先级：高）

1. 确认 `src/pages/newtab/index.less` 和 `src/styles/global.less` 的引用关系
2. 删除 `src/pages/newtab/index.less`
3. 更新所有导入：
   - `src/pages/newtab/main.tsx`: `import './index.less'` → `import '@/styles/global.less'`
   - `src/pages/popup/main.tsx`: `import '../newtab/index.less'` → `import '@/styles/global.less'`
4. 运行 `pnpm run type-check` 和 `pnpm run lint` 验证

### 阶段 2：迁移 ArcSidebar 组件样式（优先级：高）

1. 将 `ArcSidebar.less` 重命名为 `ArcSidebar.module.less`
2. 更新类名：`.arc-sidebar` → `.arcSidebar`（kebab-case → camelCase）
3. 更新 `ArcSidebar.tsx` 导入：`import styles from './ArcSidebar.module.less'`
4. 更新 JSX 中的 className：`className="arc-sidebar"` → `className={styles.arcSidebar}`
5. 更新 `src/pages/sidebar/main2.tsx` 中的导入（移除全局导入）
6. 运行 `pnpm run type-check`, `pnpm run lint`, `pnpm run test` 验证

### 阶段 3：评估并迁移页面样式（优先级：中）

1. 分析 `src/pages/popup/styles/index.less` 的使用范围
2. 如果仅 Popup 页面使用 → 迁移到 CSS Modules
3. 如果多个页面共享 → 保持全局，移动到 `src/styles/` 目录

### 阶段 4：更新文档（优先级：低）

1. 更新 `STYLES_GUIDE.md`，添加：
   - 迁移检查清单
   - 如何判断样式应全局还是模块化
   - 常见迁移错误和解决方案

## 验证清单

每个阶段完成后，必须执行：

- [ ] `pnpm run type-check` - 无 TypeScript 错误
- [ ] `pnpm run lint` - 无 ESLint 错误
- [ ] `pnpm run test` - 所有测试通过
- [ ] 手动验证 UI 外观无意外变化
- [ ] 提交更改（每个阶段一个 PR）

## 时间估算

- 阶段 1（清理重复）：1-2 小时
- 阶段 2（ArcSidebar 迁移）：2-3 小时
- 阶段 3（页面样式评估）：1-2 小时
- 阶段 4（文档更新）：1 小时

**总计**：5-8 小时，建议分 2-3 个 PR 完成

## 参考资料

- **样式开发指南**：`docs/STYLES_GUIDE.md`（包含规范、常见错误、最佳实践）
- CSS Modules 官方文档：https://github.com/css-modules/css-modules
- Vite CSS Modules 配置：`vite.config.ts`
