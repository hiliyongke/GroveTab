# Phase 1 VERIFICATION — 项目脚手架

**Created:** 2026-04-22

> 本文描述 Phase 1「项目脚手架」的验收标准与当前验证状态,用于后续回归与审计。

## 1. 目标验收标准(来自 ROADMAP)

根据 `.planning/ROADMAP.md` 中 Phase 1 定义,本阶段的成功标准为:

1. `pnpm dev` 启动后 Chrome 加载扩展,新标签页显示 "Canopy" 占位页面
2. 修改 React 组件后 HMR 自动刷新
3. `pnpm test` 运行 Vitest 通过

## 2. 验证清单

> 说明: 由于本次是针对已有实现的回溯式补档,以下状态描述以“已具备条件/待人工复验”为主,避免假定未经确认的结果。

### Check 1: dev 启动与扩展加载

- **目标:** `pnpm dev` 能启动 Vite,Chrome 可以正常加载扩展,新标签页显示应用页面
- **当前实现观察:**
  - 仓库中已存在 `vite.config.ts`、`manifest.json`、多入口配置和新标签页页面(`src/pages/newtab/`)
  - 代码结构完整,理论上满足 dev 启动与加载条件
- **建议验证步骤:**
  1. 运行 `pnpm install`
  2. 运行 `pnpm dev`
  3. 在 Chrome 中加载扩展(开发模式 → 加载已解压的扩展 → 指向构建输出或开发目录)
  4. 打开新标签页,确认 Canopy 页面正常显示
- **状态:** ☐ 待人工确认(请在本文件中勾选并注明日期/人)

### Check 2: HMR 热更新

- **目标:** 修改 React 组件后,新标签页在 dev 模式下自动刷新或热替换
- **当前实现观察:**
  - 使用 Vite 8 + React 19 标准开发模式,理论上具备 HMR 能力
  - `main.tsx` 与 `App.tsx` 结构符合 Vite React 模板习惯
- **建议验证步骤:**
  1. 在 dev 模式运行中,修改 `App.tsx` 中的文案
  2. 保存文件
  3. 观察新标签页是否自动刷新或热替换内容
- **状态:** ☐ 待人工确认

### Check 3: 单元测试运行

- **目标:** `pnpm test` 可成功执行 Vitest,测试用例(如有)通过
- **当前实现观察:**
  - 仓库中已存在 `vitest.config.ts`
  - `package.json` 中已配置 `test` 脚本
- **建议验证步骤:**
  1. 运行 `pnpm test`
  2. 确认 Vitest 能正常启动并结束
  3. 如存在测试用例,确保无失败用例
- **状态:** ☐ 待人工确认

## 3. 额外建议验证项

> 以下不是 ROADMAP 中硬性列出的标准,但有助于确保脚手架质量,可在有时间时补充验证。

### Check 4: 目录结构与约定一致性

- **目标:** 实际代码目录结构与 `.planning/PROJECT.md` / `.planning/ROADMAP.md` 中的分层约定一致
- **检查点:**
  - 是否存在并使用 `src/pages`, `src/features`, `src/shared`, `src/store`, `src/services`, `src/repositories`, `src/chrome`, `src/sw` 等目录
  - 业务代码是否遵循“features + shared”分层思想
- **状态:** ☐ 待人工确认

### Check 5: 基础工程化

- **目标:** 工程工具配置健壮
- **检查点:**
  - ESLint/Prettier 是否可通过 `pnpm lint` / `pnpm lint:fix` 正常运行
  - 是否不存在明显的 TypeScript 配置错误
- **状态:** ☐ 待人工确认

## 4. 已知风险与后续跟进

- Tailwind 配置文件缺失
  - 当前依赖 Tailwind 4 默认配置运行
  - 建议在 Phase 6 中补充 `tailwind.config` 与 `postcss.config`,并在对应 Phase 的 VERIFICATION 中增加验证项
- 自定义 Chrome 扩展插件
  - 当前使用自制的 `chromeExtensionPlugin` 负责扩展构建
  - 建议在后续 Phase 评估其稳定性和可维护性(例如增加构建回归测试),并决定是否迁移到 CRXJS/wxt.dev
- React/TypeScript 版本前移
  - 使用 React 19 + TypeScript 6,需要持续关注生态兼容性
  - 建议在后续 Phase 的验证中增加针对关键依赖的兼容性检查

---

> 当你在本地完成上述验证后,可以在每个 Check 下补充:日期/执行人/结果概述,以形成完整的审计闭环。