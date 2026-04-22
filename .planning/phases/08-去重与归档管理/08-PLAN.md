# Phase 8 PLAN — 去重 + 归档管理 + 导入导出 + 设置

## Wave 1: 去重检测

### Task 1: 去重工具函数
- `dedupe.ts`: 宽松规则去重（忽略 #hash、utm_*/fbclid/gclid 参数）
- 返回重复组: `{ canonicalUrl: string, duplicates: LiveTab[] }[]`

### Task 2: DedupInfoBar 组件
- 顶部非侵入 InfoBar
- "发现 N 组重复标签页" + "查看" + "忽略"
- 点击查看展开重复列表，可一键合并（关闭重复的）

## Wave 2: 归档管理增强

### Task 3: ArchivePanel 增强
- 会话重命名（双击标题编辑）
- 删除 + Undo
- 恢复策略: 单个恢复在当前窗口，>30 分批

### Task 4: 导入导出
- 导出: JSON 格式下载
- 导入: 文件选择 + 冲突策略（跳过重复）+ 进度提示

## Wave 3: 设置面板

### Task 5: SettingsPanel 组件
- 侧滑面板
- 分组: 外观（主题/渐变/语言）、行为（默认视图/Undo时间）、数据（导入/导出/清空）
- 清空需二次确认
