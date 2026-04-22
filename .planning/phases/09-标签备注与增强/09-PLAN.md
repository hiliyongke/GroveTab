# Phase 9 PLAN — 标签备注 + 固定 + 书签标记

## Wave 1: Tag/Note 数据层 + UI

### Task 1: Tags/Notes 存储
- tags slice: `{ [url: string]: string[] }` 持久化到 storage
- notes slice: `{ [url: string]: string }` 持久化到 storage
- CRUD actions

### Task 2: TabContextMenu
- 右键 Tab → 弹出菜单: 添加标签 / 添加备注 / 固定/取消固定
- 标签色块: hash 稳定色
- 备注图标指示

### Task 3: 搜索 tag:xxx 语法
- SearchBox 支持 `tag:xxx` 前缀过滤

## Wave 2: 固定 + 书签

### Task 4: Pin (固定/置顶)
- pinnedUrls: Set<string> 持久化
- 域名分组中固定项排最前
- 固定 Tab 不受"关闭所有"影响

### Task 5: 书签标记
- chrome.bookmarks 读取
- 域名分组中标记书签 Tab（小书签图标）
