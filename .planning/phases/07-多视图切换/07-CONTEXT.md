# Phase 7 CONTEXT — 多视图切换

**Created:** 2026-04-22
**Status:** Ready to plan

## Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D-01 | 视图切换器 = 顶栏图标组 | 直观、一键切换，无额外点击展开 |
| D-02 | 时间轴分段: 今天/昨天/本周/更早 | 自然语义分段，用户直觉 |
| D-03 | 缩略图 = favicon + 域名色块 | 避免 host_permissions，优先上架审核 |
| D-04 | 频率数据 = SW onActivated + 启动校正 | 无需 optional_permissions，数据够用 |
| D-05 | 虚拟滚动始终启用 | @tanstack/react-virtual 在少量数据也零成本 |
| D-06 | viewMode 持久化记住上次 | UX 自然，设置中可选默认视图 |

## Requirements Covered

- TIMELINE-01~02, COMPACT-01, GRID-01, FREQ-01~03
