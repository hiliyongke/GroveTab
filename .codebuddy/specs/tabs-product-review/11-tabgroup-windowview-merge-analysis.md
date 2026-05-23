# TabGroupView 与 WindowView 合并方案分析

**日期**: 2026-05-23  
**状态**: 研究中（待评审）  
**目标**: 分析 TabGroupView 和 WindowView 的功能重叠，提出合并方案

---

## 1. 当前实现分析

### 1.1 TabGroupView（Chrome 原生 Tab Group 视图）

**文件位置**: `src/features/tabs/TabGroupView.tsx`

**核心功能**:
- 一级分组：按 Chrome 原生 Tab Group（`tab.groupId`）分组
- 二级分组：每个 Tab Group 内按域名分组展示标签页
- 未分组的标签归入"未分组"区域
- 使用 antd Collapse 组件实现分组展开/折叠
- 每个分组显示组名（或颜色标记）、标签数量

**数据来源**:
```typescript
const tabs = useTabsStore((s) => s.tabs);
// 按 tab.groupId 分组
const groups = useMemo(() => {
  const map = new Map<number, TabGroupData>();
  for (const tab of tabs) {
    const gid = tab.groupId ?? -1;
    if (!map.has(gid)) {
      map.set(gid, {
        groupId: gid,
        title: gid === -1 ? t('tabGroup.ungrouped') : (tab.groupTitle || t('tabGroup.unnamed')),
        color: gid === -1 ? 'grey' : (tab.groupColor || 'grey'),
        tabs: [],
      });
    }
    map.get(gid)!.tabs.push(tab);
  }
  // 未分组排最后
  const result = Array.from(map.values());
  const ungrouped = result.find((g) => g.groupId === -1);
  const grouped = result.filter((g) => g.groupId !== -1);
  return [...grouped, ...(ungrouped ? [ungrouped] : [])];
}, [tabs, t]);
```

**交互特点**:
- ✅ 简单展示，使用 Collapse 展开/折叠
- ✅ 支持跳转和关闭标签
- ❌ 不支持拖拽排序
- ❌ 不支持键盘导航
- ❌ 不支持 Tab Group 操作（重命名、改颜色等）

**适用场景**:
- 用户想要跨窗口查看所有 Tab Group
- 用户需要简单的分组展示

---

### 1.2 WindowView（窗口管理视图）

**文件位置**: `src/features/tabs/WindowView/index.tsx` + 多个组件和 hooks

**核心功能**:
- 一级分组：按窗口 ID（`tab.windowId`）分组
- 二级分组：每个窗口内按 Tab Group（`tab.groupId`）分组
- 支持拖拽排序（@dnd-kit/core）
- 支持键盘导航（Arrow keys + Enter + Space）
- 支持跨窗口拖拽（Alt+拖拽复制）
- 支持窗口合并
- 支持缩略图预览（悬停时）
- 支持智能排序（按域名、访问时间、字母、类型）
- 支持 Tab Group 操作（重命名、改颜色、关闭分组）

**数据来源**:
```typescript
// WindowView.tsx - 按窗口分组
const windows = useMemo(() => {
  const map = new Map<number, typeof tabs>();
  for (const tab of tabs) {
    const wid = tab.windowId ?? -1;
    if (!map.has(wid)) map.set(wid, []);
    map.get(wid)!.push(tab);
  }
  return map;
}, [tabs]);

// WindowCard.tsx - 每个窗口内按 Tab Group 分组
const tabGroups = useMemo(() => {
  const map = new Map<number, { groupId: number; groupTitle?: string; groupColor?: string; tabs: LiveTab[] }>();
  for (const tab of windowTabs) {
    const gid = tab.groupId ?? -1;
    if (!map.has(gid)) {
      map.set(gid, {
        groupId: gid,
        groupTitle: gid === -1 ? undefined : tab.groupTitle,
        groupColor: gid === -1 ? undefined : tab.groupColor,
        tabs: [] as LiveTab[],
      });
    }
    map.get(gid)!.tabs.push(tab);
  }
  // 未分组排最后
  const result = Array.from(map.values());
  const ungrouped = result.find((g) => g.groupId === -1);
  const grouped = result.filter((g) => g.groupId !== -1);
  return [...grouped, ...(ungrouped ? [ungrouped] : [])];
}, [windowTabs]);
```

**交互特点**:
- ✅ 支持拖拽排序（标签排序、跨窗口拖拽、拖入分组）
- ✅ 支持键盘导航
- ✅ 支持 Tab Group 操作（GroupLabel + GroupContextMenu）
- ✅ 支持窗口操作（合并、关闭、排序）
- ✅ 支持缩略图预览
- ❌ 不支持"全局 Tab Group 视角"（跨窗口查看所有 Tab Group）

**适用场景**:
- 用户管理多个窗口
- 用户需要复杂的拖拽和排序操作
- 用户需要查看窗口缩略图

---

## 2. 功能重叠分析

### 2.1 相同点

| 功能 | TabGroupView | WindowView | 重叠度 |
|------|--------------|------------|--------|
| 按 Tab Group 分组 | ✅ 一级分组 | ✅ 二级分组（在窗口内） | **高** |
| 展示标签列表 | ✅ | ✅ | **高** |
| 跳转标签 | ✅ | ✅ | **高** |
| 关闭标签 | ✅ | ✅ | **高** |
| 使用 `tab.groupId` | ✅ | ✅ | **高** |
| 展示未分组标签 | ✅ | ✅ | **高** |

### 2.2 不同点

| 功能 | TabGroupView | WindowView | 差异度 |
|------|--------------|------------|--------|
| **视角** | 全局视角（跨所有窗口按 Tab Group 分组） | 窗口视角（在每个窗口内按 Tab Group 分组） | **高** |
| **交互复杂度** | 简单（Collapse 展开/折叠） | 复杂（拖拽、键盘、上下文菜单） | **高** |
| **拖拽排序** | ❌ 不支持 | ✅ 支持（@dnd-kit） | **高** |
| **键盘导航** | ❌ 不支持 | ✅ 支持 | **高** |
| **Tab Group 操作** | ❌ 不支持（重命名、改颜色等） | ✅ 支持（GroupLabel + GroupContextMenu） | **高** |
| **跨窗口操作** | ❌ 不支持 | ✅ 支持（Alt+拖拽复制、窗口合并） | **高** |
| **缩略图预览** | ❌ 不支持 | ✅ 支持 | **高** |
| **智能排序** | ❌ 不支持 | ✅ 支持（按域名、访问时间等） | **高** |

### 2.3 关键发现

1. **功能重叠严重**: 
   - TabGroupView 的核心功能（按 Tab Group 分组展示）已经在 WindowView 中实现（WindowCard 内部按 Tab Group 分组）
   - WindowView 的 Tab Group 展示功能更强大（支持操作、上下文菜单等）

2. **视角不同**:
   - TabGroupView: 全局视角，适合"我想看看所有 Tab Group 里有什么"
   - WindowView: 窗口视角，适合"我想管理这个窗口里的标签"

3. **用户体验不同**:
   - TabGroupView: 简单、快速、轻量
   - WindowView: 功能丰富、交互复杂、学习成本高

---

## 3. Chrome API 中 Tab Group 和 Window 的关系

### 3.1 概念定义

| 概念 | Chrome API | 说明 |
|------|-----------|------|
| **Window** | `chrome.windows.*` | 浏览器窗口，每个窗口有唯一的 `windowId` |
| **Tab** | `chrome.tabs.*` | 标签页，每个标签属于某个窗口（`tab.windowId`） |
| **Tab Group** | `chrome.tabGroups.*` | 窗口内的标签分组，每个分组有 `groupId` |

### 3.2 关系

```
Window 1 (windowId: 123)
  ├─ Tab Group 1 (groupId: 456, 颜色: blue, 标题: "工作")
  │    ├─ Tab 1 (id: 1, url: "https://github.com/...", groupId: 456)
  │    └─ Tab 2 (id: 2, url: "https://stackoverflow.com/...", groupId: 456)
  ├─ Tab Group 2 (groupId: 789, 颜色: green, 标题: "学习")
  │    └─ Tab 3 (id: 3, url: "https://developer.mozilla.org/...", groupId: 789)
  └─ 未分组
       └─ Tab 4 (id: 4, url: "https://news.ycombinator.com/", groupId: -1)

Window 2 (windowId: 124)
  ├─ Tab Group 3 (groupId: 890, 颜色: red, 标题: "个人")
  │    └─ Tab 5 (id: 5, url: "https://mail.google.com/", groupId: 890)
  └─ 未分组
       └─ Tab 6 (id: 6, url: "https://calendar.google.com/", groupId: -1)
```

**关键规则**:
1. Tab Group **属于某个窗口**，不能跨窗口
2. Tab **属于某个窗口**（`tab.windowId`），可以同时属于某个 Tab Group（`tab.groupId`）
3. `tab.groupId === -1` 表示未分组
4. 不同窗口可以有相同颜色的 Tab Group（颜色不是全局唯一的）

### 3.3 API 示例

```typescript
// 获取所有窗口
const windows = await chrome.windows.getAll({ populate: true });

// 获取所有 Tab Group
const tabGroups = await chrome.tabGroups.query({});

// 获取某个窗口的 Tab Group
const windowTabGroups = await chrome.tabGroups.query({ windowId: 123 });

// 创建 Tab Group
const groupId = await chrome.tabs.group({ tabIds: [1, 2] });

// 修改 Tab Group
await chrome.tabGroups.update(groupId, { title: "工作", color: "blue" });

// 关闭 Tab Group 内的所有标签
await chrome.tabs.remove([1, 2]);
```

---

## 4. 合并方案

### 4.1 方案对比

| 方案 | 描述 | 优点 | 缺点 | 推荐度 |
|------|------|------|------|--------|
| **方案 1** | 在 WindowView 中增强 Tab Group 展示（添加"全局 Tab Group"模式） | 减少视图数量、功能不重复、维护成本低 | 需要添加新功能、可能增加 WindowView 复杂度 | ⭐⭐⭐⭐⭐ |
| **方案 2** | 保留 TabGroupView 作为独立视图 | 保留"全局 Tab Group 视角"、用户可选择 | 功能重复、维护成本高、用户需要理解区别 | ⭐⭐ |
| **方案 3** | 重构为统一的"分组视图"（支持多种分组维度） | 最灵活、统一架构 | 工作量最大、可能过度设计 | ⭐⭐⭐ |

---

### 4.2 推荐方案：方案 1（在 WindowView 中增强 Tab Group 展示）

#### 4.2.1 设计思路

**核心思想**: TabGroupView 的功能已经在 WindowView 中实现（WindowCard 内部已经按 Tab Group 分组展示），可以移除独立的 TabGroupView，并在 WindowView 中添加一个"全局 Tab Group"模式。

**用户体验**:
- 默认视图：按窗口查看（现有行为）
- 切换视图：按分组查看（新功能，替代 TabGroupView）

**实施步骤**:
1. 在 WindowView 工具栏添加一个切换按钮
2. 实现"按分组查看"模式（忽略窗口边界，将所有 Tab Group 平铺展示）
3. 复用现有的 GroupLabel 和 SortableTabItem 组件
4. 移除 TabGroupView.tsx

#### 4.2.2 UI 设计

**工具栏添加切换按钮**:

```tsx
// WindowView.tsx
import { Segmented } from 'antd';

function WindowView() {
  const [viewMode, setViewMode] = useState<'window' | 'group'>('window');
  
  return (
    <div className={styles['app-window-view']}>
      {/* 工具栏 */}
      <div className={styles['app-window-toolbar']}>
        <Segmented
          options={[
            { label: t('window.byWindow'), value: 'window' },
            { label: t('window.byGroup'), value: 'group' },
          ]}
          value={viewMode}
          onChange={(value) => setViewMode(value)}
          size="small"
        />
        <Button type="primary" size="small" onClick={() => void handleMergeAll()}>
          {t('window.mergeAll')}
        </Button>
      </div>
      
      {/* 视图内容 */}
      {viewMode === 'window' ? (
        <WindowViewMode windows={windows} />
      ) : (
        <GroupViewMode groups={allGroups} />
      )}
    </div>
  );
}
```

**"按分组查看"模式**:

```tsx
// GroupViewMode.tsx
function GroupViewMode({ groups }: { groups: TabGroupInfo[] }) {
  return (
    <div className={styles['app-group-view']}>
      {groups.map((group) => (
        <Card key={group.groupId} size="small" className={styles['app-group-card']}>
          <GroupLabel
            groupId={group.groupId}
            groupTitle={group.groupTitle}
            groupColor={group.groupColor}
            windowId={-1} // 全局模式，无窗口边界
            tabs={group.tabs}
            t={t}
          />
          <div className={styles['app-group-tab-list']}>
            {group.tabs.map((tab) => (
              <SortableTabItem
                key={`tab::${tab.windowId}::${tab.id}`}
                tab={tab}
                windowId={tab.windowId}
                onJump={handleJump}
                onClose={handleClose}
                showHostname
                selectable
                visibleTabIds={allTabIds}
                reduced={false}
              />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
```

**数据准备**:

```typescript
// WindowView.tsx
const allGroups = useMemo(() => {
  // 忽略窗口边界，按 groupId 分组所有标签
  const map = new Map<number, TabGroupInfo>();
  for (const tab of tabs) {
    const gid = tab.groupId ?? -1;
    if (!map.has(gid)) {
      map.set(gid, {
        groupId: gid,
        groupTitle: gid === -1 ? undefined : tab.groupTitle,
        groupColor: gid === -1 ? undefined : tab.groupColor,
        tabs: [],
      });
    }
    map.get(gid)!.tabs.push(tab);
  }
  // 未分组排最后
  const result = Array.from(map.values());
  const ungrouped = result.find((g) => g.groupId === -1);
  const grouped = result.filter((g) => g.groupId !== -1);
  return [...grouped, ...(ungrouped ? [ungrouped] : [])];
}, [tabs]);
```

#### 4.2.3 交互设计

**"按窗口查看"模式（现有行为）**:
- 按窗口分组
- 每个窗口卡片内按 Tab Group 分组
- 支持拖拽、键盘导航、跨窗口操作、缩略图预览

**"按分组查看"模式（新功能）**:
- 按 Tab Group 分组（忽略窗口边界）
- 每个分组显示组名、颜色、标签数量
- 支持 Tab Group 操作（重命名、改颜色、关闭分组）
- 支持标签跳转和关闭
- **不支持**跨窗口拖拽（因为忽略窗口边界）
- **不支持**缩略图预览（因为涉及多个窗口）

**切换行为**:
- 切换视图模式时，保持滚动位置
- 切换视图模式时，保持选中状态（如果有多选）

#### 4.2.4 技术实施

**阶段 1: 添加视图模式切换（3 天）**

1. 在 WindowView 工具栏添加 Segmented 组件
2. 实现 `viewMode` 状态管理
3. 实现 `GroupViewMode` 组件
4. 复用现有的 GroupLabel 和 SortableTabItem 组件

**阶段 2: 移除 TabGroupView（1 天）**

1. 从视图切换器中移除 TabGroupView
2. 删除 TabGroupView.tsx 文件
3. 删除 TabGroupView.module.less 文件（如果存在）
4. 更新路由和导航

**阶段 3: 优化交互（3-5 天）**

1. 在"按分组查看"模式下添加拖拽支持（标签排序）
2. 添加键盘导航
3. 添加上下文菜单
4. 优化动画和过渡效果

**阶段 4: 测试和优化（2-3 天）**

1. 单元测试
2. 集成测试
3. 性能优化
4. 无障碍优化

#### 4.2.5 工作量评估

| 阶段 | 任务 | 工作量 | 说明 |
|------|------|--------|------|
| 阶段 1 | 添加视图模式切换 | 3 天 | 添加 Segmented、实现 GroupViewMode、复用组件 |
| 阶段 2 | 移除 TabGroupView | 1 天 | 删除文件、更新路由 |
| 阶段 3 | 优化交互 | 3-5 天 | 拖拽、键盘导航、上下文菜单 |
| 阶段 4 | 测试和优化 | 2-3 天 | 测试、性能、无障碍 |
| **总计** | | **9-12 天** | |

#### 4.2.6 风险评估

| 风险 | 严重程度 | 缓解措施 |
|------|----------|----------|
| **功能丢失风险**（丢失"全局 Tab Group 视角"） | 中 | 在 WindowView 中添加"按分组查看"模式 |
| **用户体验风险**（用户习惯了 TabGroupView） | 低 | 提供平滑的迁移路径，保留相似的交互方式 |
| **技术风险**（WindowView 已经很复杂） | 中 | 充分的测试，分阶段发布，功能开关 |
| **性能风险**（"按分组查看"模式下标签数量多） | 低 | 使用虚拟滚动（如果标签数量 > 100） |

---

### 4.3 备选方案：方案 2（保留 TabGroupView 作为独立视图）

#### 4.3.1 设计思路

**核心思想**: TabGroupView 和 WindowView 服务不同的使用场景，保留两者，但明确各自的使用场景。

**用户体验**:
- TabGroupView: 简单、快速、轻量，适合"我想看看所有 Tab Group 里有什么"
- WindowView: 功能丰富、交互复杂，适合"我想管理这个窗口里的标签"

**实施步骤**:
1. 优化 TabGroupView 的交互（添加拖拽、键盘导航）
2. 保持 WindowView 不变
3. 在视图切换器中明确两种视图的区别

#### 4.3.2 优缺点

**优点**:
- ✅ 保留"全局 Tab Group 视角"
- ✅ 用户可以选择适合自己的视图
- ✅ 风险低（不删除现有功能）

**缺点**:
- ❌ 功能重复，维护成本高
- ❌ 用户需要理解两种视图的区别
- ❌ 代码冗余

#### 4.3.3 工作量评估

| 任务 | 工作量 | 说明 |
|------|--------|------|
| 优化 TabGroupView（添加拖拽） | 5-7 天 | 引入 @dnd-kit，实现拖拽排序 |
| 优化 TabGroupView（添加键盘导航） | 2-3 天 | 实现键盘事件处理 |
| 优化 TabGroupView（添加 Tab Group 操作） | 3-5 天 | 实现重命名、改颜色、关闭分组 |
| 更新文档和测试 | 2-3 天 | 更新用户文档、添加测试 |
| **总计** | **12-18 天** | |

---

### 4.4 备选方案：方案 3（重构为统一的"分组视图"）

#### 4.4.1 设计思路

**核心思想**: 创建一个统一的视图，支持多种分组维度（按窗口、按 Tab Group、按域名、按访问时间等）。

**用户体验**:
- 用户可以选择分组维度
- 统一的交互方式（拖拽、键盘导航、上下文菜单）
- 灵活的配置选项

**实施步骤**:
1. 创建一个新的 `GroupingView` 组件
2. 支持多种分组维度（窗口、Tab Group、域名、访问时间等）
3. 统一的交互方式
4. 移除 TabGroupView 和 WindowView

#### 4.4.2 优缺点

**优点**:
- ✅ 最灵活，用户可以自由切换分组维度
- ✅ 统一的代码架构
- ✅ 易于扩展（添加新分组维度）

**缺点**:
- ❌ 工作量最大
- ❌ 可能过度设计
- ❌ 风险高（大范围重构）

#### 4.4.3 工作量评估

| 任务 | 工作量 | 说明 |
|------|--------|------|
| 设计统一的分组视图架构 | 3-5 天 | 设计组件结构、状态管理、交互方式 |
| 实现分组维度（窗口、Tab Group） | 5-7 天 | 实现两种分组维度 |
| 实现其他分组维度（域名、访问时间等） | 3-5 天 | 实现可选的分组维度 |
| 统一交互方式 | 5-7 天 | 拖拽、键盘导航、上下文菜单 |
| 移除旧视图 | 1-2 天 | 删除 TabGroupView 和 WindowView |
| 测试和优化 | 5-7 天 | 测试、性能、无障碍 |
| **总计** | **22-33 天** | |

---

## 5. 推荐方案详解

### 5.1 为什么选择方案 1？

1. **功能已经重叠**:
   - WindowView 的 WindowCard 组件已经实现了 Tab Group 的展示和操作
   - TabGroupView 的功能是 WindowView 的子集

2. **用户体验**:
   - 减少视图数量，简化用户选择
   - 统一的视图切换体验

3. **维护成本**:
   - 移除重复代码，降低维护成本
   - 减少测试用例

4. **可行性**:
   - 只需要在 WindowView 中添加一个"全局 Tab Group"模式
   - 可以复用现有组件（GroupLabel、SortableTabItem 等）

### 5.2 实施计划（详细）

#### Phase 1: 准备阶段（1 周）

**任务 1.1: 创建功能分支**
```bash
git checkout -b feature/merge-tabgroup-windowview
```

**任务 1.2: 添加视图模式状态管理**
```typescript
// src/store/settings-slice.ts
interface SettingsState {
  // 现有状态...
  
  // 新增：WindowView 的视图模式
  windowViewMode: 'window' | 'group';
  setWindowViewMode: (mode: 'window' | 'group') => void;
}

// 实现
const useSettingsStore = create<SettingsState>((set) => ({
  // 现有状态...
  
  windowViewMode: 'window',
  setWindowViewMode: (mode) => set({ windowViewMode: mode }),
}));
```

**任务 1.3: 设计"按分组查看"模式的 UI**
- 创建 wireframe 或 mockup
- 确定交互细节
- 评审设计方案

#### Phase 2: 实施阶段（2 周）

**任务 2.1: 在 WindowView 工具栏添加切换按钮（1 天）**
```tsx
// src/features/tabs/WindowView/index.tsx
import { Segmented } from 'antd';
import styles from './WindowView.module.less';

function WindowView() {
  const viewMode = useSettingsStore((s) => s.windowViewMode);
  const setViewMode = useSettingsStore((s) => s.setWindowViewMode);
  
  return (
    <div className={styles['app-window-view']}>
      {/* 工具栏 */}
      <div className={styles['app-window-toolbar']}>
        <Segmented
          options={[
            {
              label: (
                <span>
                  <AppWindow size={14} />
                  {t('window.byWindow')}
                </span>
              ),
              value: 'window',
            },
            {
              label: (
                <span>
                  <Folder size={14} />
                  {t('window.byGroup')}
                </span>
              ),
              value: 'group',
            },
          ]}
          value={viewMode}
          onChange={(value) => setViewMode(value as 'window' | 'group')}
          size="small"
        />
        {/* 其他工具栏按钮 */}
      </div>
      
      {/* 视图内容 */}
      {viewMode === 'window' ? (
        <WindowViewContent windows={windows} />
      ) : (
        <GroupViewContent groups={allGroups} />
      )}
    </div>
  );
}
```

**任务 2.2: 实现 GroupViewContent 组件（3 天）**
```tsx
// src/features/tabs/WindowView/components/GroupViewContent.tsx
import { memo } from 'react';
import { Card } from 'antd';
import { GroupLabel } from './GroupLabel';
import { SortableTabItem } from './SortableTabItem';
import styles from '../WindowView.module.less';

interface GroupViewContentProps {
  groups: TabGroupInfo[];
  allTabIds: number[];
  onJump: (tabId: number, windowId: number) => void;
  onClose: (tabId: number) => void;
}

const GroupViewContent = memo(function GroupViewContent({
  groups,
  allTabIds,
  onJump,
  onClose,
}: GroupViewContentProps) {
  return (
    <div className={styles['app-group-view']}>
      {groups.map((group) => (
        <Card
          key={group.groupId}
          size="small"
          className={styles['app-group-card']}
          classNames={{
            header: styles['app-group-card-header'],
            body: styles['app-group-card-body'],
          }}
        >
          <GroupLabel
            groupId={group.groupId}
            groupTitle={group.groupTitle}
            groupColor={group.groupColor}
            windowId={-1} // 全局模式，无窗口边界
            tabs={group.tabs}
            t={t}
          />
          <div className={styles['app-group-tab-list']}>
            {group.tabs.map((tab) => (
              <SortableTabItem
                key={`tab::${tab.windowId}::${tab.id}`}
                tab={tab}
                windowId={tab.windowId}
                onJump={(id, wid) => onJump(id, wid)}
                onClose={(id) => onClose(id)}
                showHostname
                selectable
                visibleTabIds={allTabIds}
                reduced={false}
              />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
});

export { GroupViewContent };
```

**任务 2.3: 准备"按分组查看"模式的数据（1 天）**
```typescript
// src/features/tabs/WindowView/index.tsx
const allGroups = useMemo(() => {
  // 忽略窗口边界，按 groupId 分组所有标签
  const map = new Map<number, TabGroupInfo>();
  for (const tab of tabs) {
    const gid = tab.groupId ?? -1;
    if (!map.has(gid)) {
      map.set(gid, {
        groupId: gid,
        groupTitle: gid === -1 ? undefined : tab.groupTitle,
        groupColor: gid === -1 ? undefined : tab.groupColor,
        tabs: [],
      });
    }
    map.get(gid)!.tabs.push(tab);
  }
  // 未分组排最后
  const result = Array.from(map.values());
  const ungrouped = result.find((g) => g.groupId === -1);
  const grouped = result.filter((g) => g.groupId !== -1);
  return [...grouped, ...(ungrouped ? [ungrouped] : [])];
}, [tabs]);
```

**任务 2.4: 移除 TabGroupView（1 天）**
```bash
# 删除文件
rm src/features/tabs/TabGroupView.tsx
rm src/features/tabs/TabGroupView.module.less

# 更新视图切换器
# src/features/tabs/TabViewSelector.tsx
# 移除 TabGroupView 选项
```

**任务 2.5: 添加拖拽支持（3 天）**
- 在"按分组查看"模式下添加 @dnd-kit 拖拽
- 支持标签排序（ within group）
- 支持标签移动到其他分组

**任务 2.6: 添加键盘导航（2 天）**
- 实现 Arrow keys 导航
- 实现 Enter 激活、Space 选中
- 实现 Tab 切换到分组标题

**任务 2.7: 添加上下文菜单（2 天）**
- 复用 GroupContextMenu 组件
- 支持 Tab Group 操作（重命名、改颜色、关闭分组）
- 支持标签操作（关闭、丢弃、固定等）

#### Phase 3: 测试阶段（1 周）

**任务 3.1: 单元测试**
- WindowView 组件测试
- GroupViewContent 组件测试
- 视图模式切换测试

**任务 3.2: 集成测试**
- 拖拽功能测试
- 键盘导航测试
- 上下文菜单测试

**任务 3.3: 性能测试**
- 大量标签时的性能
- 切换视图模式时的性能

**任务 3.4: 无障碍测试**
- 键盘导航
- 屏幕阅读器
- 焦点管理

#### Phase 4: 发布阶段（1 周）

**任务 4.1: 更新文档**
- 用户文档（新功能说明）
- 开发者文档（代码结构说明）

**任务 4.2: 代码审查**
- 提交 PR
- 代码审查
- 修复审查意见

**任务 4.3: 发布**
- 合并到 main 分支
- 发布 beta 版本
- 收集用户反馈

**任务 4.4: 监控和优化**
- 监控错误日志
- 监控性能指标
- 修复 bug

---

## 6. 合并后的用户体验

### 6.1  Before（合并前）

**视图切换器**:
```
[Compact] [Domain] [Frequency] [Grid] [Kanban] [Timeline] [Tab Group] [Bookmark] [Window]
```

**TabGroupView**:
- 按 Tab Group 分组
- 简单的 Collapse 展开/折叠
- 不支持拖拽、键盘导航、Tab Group 操作

**WindowView**:
- 按窗口分组
- 每个窗口内按 Tab Group 分组
- 支持拖拽、键盘导航、Tab Group 操作、跨窗口操作、缩略图预览

**问题**:
- 用户需要理解 9 种视图的区别
- TabGroupView 和 WindowView 的功能重叠
- TabGroupView 的功能不如 WindowView 强大

### 6.2 After（合并后）

**视图切换器**:
```
[Compact] [Domain] [Frequency] [Grid] [Kanban] [Timeline] [Bookmark] [Window]
```

**WindowView（默认：按窗口查看）**:
- 按窗口分组
- 每个窗口内按 Tab Group 分组
- 支持拖拽、键盘导航、Tab Group 操作、跨窗口操作、缩略图预览

**WindowView（切换：按分组查看）**:
- 按 Tab Group 分组（忽略窗口边界）
- 支持拖拽、键盘导航、Tab Group 操作
- 不支持跨窗口操作、缩略图预览

**优点**:
- 减少视图数量（从 9 种减少到 8 种）
- 功能不重复
- 统一的视图切换体验
- TabGroupView 的功能被保留（作为 WindowView 的一种模式）

---

## 7. 结论

### 7.1 核心结论

1. **TabGroupView 和 WindowView 功能重叠严重**:
   - TabGroupView 的核心功能（按 Tab Group 分组展示）已经在 WindowView 中实现
   - WindowView 的 Tab Group 展示功能更强大

2. **推荐方案 1（在 WindowView 中增强 Tab Group 展示）**:
   - 减少视图数量，简化用户体验
   - 功能不重复，降低维护成本
   - 保留 TabGroupView 的功能（作为 WindowView 的一种模式）

3. **工作量评估**:
   - 总计 9-12 天
   - 分阶段实施，降低风险

4. **风险评估**:
   - 功能丢失风险：低（在 WindowView 中添加"按分组查看"模式）
   - 用户体验风险：低（提供平滑的迁移路径）
   - 技术风险：中（WindowView 已经很复杂，需要充分测试）

### 7.2 下一步行动

1. **评审本报告**:
   - 与团队评审合并方案
   - 确定最终方案

2. **创建详细任务清单**:
   - 拆解实施计划
   - 分配给开发者

3. **开始实施**:
   - 按 Phase 1 → Phase 2 → Phase 3 → Phase 4 的顺序实施
   - 每个 Phase 结束后进行评审

---

## 8. 附录

### 8.1 相关文件清单

**TabGroupView**:
- `src/features/tabs/TabGroupView.tsx`
- `src/features/tabs/TabGroupView.module.less`（如果存在）

**WindowView**:
- `src/features/tabs/WindowView/index.tsx`
- `src/features/tabs/WindowView/WindowView.module.less`
- `src/features/tabs/WindowView/types/index.ts`
- `src/features/tabs/WindowView/components/WindowCard.tsx`
- `src/features/tabs/WindowView/components/GroupLabel.tsx`
- `src/features/tabs/WindowView/components/GroupContextMenu.tsx`
- `src/features/tabs/WindowView/components/SortableTabItem.tsx`
- `src/features/tabs/WindowView/components/DragPreview.tsx`
- `src/features/tabs/WindowView/hooks/use-window-drag.ts`
- `src/features/tabs/WindowView/hooks/use-window-keyboard.ts`
- `src/features/tabs/WindowView/hooks/use-window-merge.ts`
- `src/features/tabs/WindowView/hooks/use-window-thumbnail.ts`

**Store**:
- `src/store/tabs-slice.ts`（包含 `queryTabGroups` 调用和 `withTabGroupInfo` 处理逻辑）

### 8.2 参考资料

- [Chrome Tab Groups API](https://developer.chrome.com/docs/extensions/reference/tabGroups/)
- [Chrome Windows API](https://developer.chrome.com/docs/extensions/reference/windows/)
- [Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/tabs/)
- [@dnd-kit 文档](https://docs.dndkit.com/)
- [Ant Design Segmented 组件](https://ant.design/components/segmented/)

---

**文档版本**: v1.0  
**最后更新**: 2026-05-23  
**作者**: CodeBuddy AI
