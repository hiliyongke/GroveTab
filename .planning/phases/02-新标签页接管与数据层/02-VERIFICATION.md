# Phase 2 VERIFICATION — 新标签页接管 + 数据层

**Created:** 2026-04-22

> 本文基于 `.planning/ROADMAP.md` 中 Phase 2 的成功标准,结合当前实现状态给出可执行的验证清单。

## 1. Roadmap 成功标准回顾

From `.planning/ROADMAP.md` Phase 2:

1. 新开 Tab 显示所有窗口的 Tab 列表
2. 打开/关闭/切换 Tab 后列表实时更新
3. chrome:// / file:// 等特殊 URL 正确处理
4. 首次安装显示 Onboarding

## 2. 验证项

> 状态栏初始均为 ☐,表示待人工实际验证。验证完成后可将对应项改为 ☑ 并补充说明。

### Check 1: 新开 Tab 显示所有窗口 Tab 列表

- **目标:** 在安装扩展并开启 newtab 接管后,用户新开标签页即可看到所有窗口中的 Tab 列表。
- **建议步骤:**
  1. 安装并加载扩展;
  2. 确认 `manifest.json` 中 `chrome_url_overrides.newtab` 已生效;
  3. 打开多个窗口与多个 Tab;
  4. 新开 Tab,检查页面是否展示所有窗口的 Tab。
- **状态:** ☐ 待确认
- **备注:** 实现路径: `src/store/tabs-slice.ts` + `src/pages/newtab/App.tsx` + `DomainGroupView`。

### Check 2: Tab 列表实时更新

- **目标:** 在新标签页打开的情况下,进行 Tab 打开/关闭/切换/移动操作,列表能实时更新。
- **建议步骤:**
  1. 打开 newtab 页面;
  2. 在其它标签页中执行: 新开 Tab、关闭 Tab、切换激活 Tab、移动 Tab 至其他窗口;
  3. 观察 newtab 页面中的列表是否实时更新(无需刷新页面)。
- **状态:** ☐ 待确认
- **备注:** 实现路径: `src/sw/index.ts` + BroadcastChannel + `tabs-slice.handleBroadcast()`。

### Check 3: 特殊 URL 处理

- **目标:** 对 chrome://、file:// 等特殊 URL 的 Tab 做合理处理(隐藏或特殊标记)。
- **建议步骤:**
  1. 打开包含 chrome://settings、file:// 等页面;
  2. 观察 newtab 页面中是否隐藏/特殊标示这些 Tab;
  3. 确认逻辑与产品预期一致。
- **状态:** ☐ 待确认
- **备注:** 实现可能集中在 `tabs-slice` 与 URL 工具函数中。

### Check 4: Onboarding 首次展示

- **目标:** 首次安装扩展时,在 newtab 页面顶部显示 Onboarding 卡片;用户关闭后不再出现。
- **建议步骤:**
  1. 清空扩展本地数据或在干净环境安装扩展;
  2. 首次打开 newtab 页面,确认 Onboarding 卡片显示;
  3. 点击关闭按钮;
  4. 刷新或重新打开 newtab,确认不再显示;
  5. 通过 devtools 检查 storage 中的 Onboarding 标记是否正确写入。
- **状态:** ☐ 待确认
- **备注:** 实现路径: `storage-repo` Onboarding API + `OnboardingCard` 组件。

### Check 5: 冲突检测(当前未实现)

- **目标:** 当有其它扩展同时接管 newtab 时,能够检测并向用户提示。
- **当前状态:**
  - 代码中尚未实现该能力;
  - 需要在后续 Patch/Phase 中补充实现。
- **建议后续验证思路:**
  1. 使用测试环境安装两个 newtab 扩展;
  2. 在本扩展中实现 `chrome.management` 调用,检测其它扩展的 newtab override;
  3. 在 newtab 页面展示冲突提示;
  4. 验证提示逻辑在多种冲突组合下的表现。
- **状态:** ☐ 未实现(待补)

## 3. 总结

- 当前实现从代码角度看已经基本满足 Phase 2 的核心功能,但仍需人工执行以上验证项以形成闭环;
- newtab 冲突检测作为 ROADMAP 中的需求,目前尚未实现,需要在未来补课阶段中完成并在此文档更新验证状态。

---

> 建议: 在你本地实际跑通一次 Phase 2 的关键流程后,回到本文件逐条勾选并记录日期/执行人/结果,形成可审计的验证记录。