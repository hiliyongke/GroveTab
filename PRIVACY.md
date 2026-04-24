# Canopy 隐私政策（PRIVACY）

**最后更新：2026-04-24 · 随 v1.0.0 封板发布**

## 一句话概括

Canopy 是 100% 本地的新标签页扩展。**所有数据只保存在您本地浏览器里**，我们不上传、不分析、不转卖您的任何数据。

## 不收集、不上传

Canopy 不运行任何云端服务，不包含任何遥测（telemetry）/ 分析 SDK；源码中不存在对外部服务器的任何请求，唯一的外部请求来自：

- （可选）OG description 抓取：在用户显式开启 `enableOgFetch` 并授权 `<all_urls>` 后，Service Worker 会在 Tab 加载完成时对该 URL 发起一次 `GET`（50 KB 截断、3s 超时、5 并发、7 天内不重复）。抓取结果存本地索引，不上传。

## 本地存储清单（chrome.storage.local）

| 存储键 | 用途 | 是否可清除 |
| --- | --- | --- |
| `canopy_tabs` | 活跃 Tab 快照（运行时同步） | 不建议手动清除 |
| `canopy_sessions` | 归档会话 | 设置 → 清除归档 |
| `canopy_settings` | 用户偏好 | 设置 → 恢复默认 |
| `canopy_tags` / `canopy_notes` / `canopy_pins` | 标签 / 笔记 / 置顶元数据 | 手动 |
| `canopy_undo` | 近 5s 可撤销记录 | 自动过期 |
| `canopy_stats` | URL × day 激活计数（近 30 天） | 设置 → InsightsPanel → 清除 |
| `canopy_metrics` | 本地事件型埋点（最多 2000 条） | 设置 → InsightsPanel → 清除 |
| `canopy_activity` | 最近 20 条 ActivityStrip 记录（72h） | 自动过期 |
| `canopy_workspaces` | 用户工作区 | 手动 |
| `canopy_kanban` | 看板布局 | 手动 |
| `canopy_og_index` | OG description 缓存（最多 10000 条） | InsightsPanel → 清除 |
| `canopy_auto_snapshot_meta` | 自动快照时间戳 | 自动 |

## 权限清单与用途

| 权限 | 必选/可选 | 用途 |
| --- | --- | --- |
| `tabs` | 必选 | 枚举/关闭/跳转 Tab |
| `storage` | 必选 | 本地存储 |
| `favicon` | 必选 | 显示站点图标 |
| `alarms` | 必选 | 定期 flush 统计、自动快照闹钟 |
| `sessions` | 必选 | 恢复最近关闭的 Tab |
| `contextMenus` | 必选 | 右键菜单"保存所有标签" |
| `tabGroups` | 必选 | Tab 组视图 |
| `activeTab` | 必选 | 当前 Tab 快捷操作 |
| `history`（可选） | 仅在用户启用历史视图时请求 | 读取浏览历史 |
| `bookmarks`（可选） | 仅在用户启用书签视图时请求 | 读取/写入书签 |
| `<all_urls>`（可选 host） | 仅在用户开启 OG description 抓取时请求 | 为搜索增强抓取页面元描述 |

## 您可以做的

- **导出**：设置 → 数据 → 导出（JSON / Markdown / TXT / HTML）
- **导入**：设置 → 数据 → 导入（自动识别 JSON / HTML / OneTab）
- **清除**：设置 → 隐私洞察 → 清除所有统计（metrics / stats / OG / activity）
- **撤销权限**：设置 → 关闭 `enableOgFetch` 自动 `chrome.permissions.remove(<all_urls>)`

## 联系方式

如有疑问或数据相关请求，请通过 Chrome 商店扩展页面的支持联系方式反馈。
