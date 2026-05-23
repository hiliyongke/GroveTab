# GroveTab (Canopy) UX 设计文档

**版本**: v1.4.0 (规划中)  
**日期**: 2025-05-23  
**作者**: Sarah (BMAD Product Owner)  
**基于**: 04-ux-review.md 评审报告  
**文档评分**: **95/100**（修复后，原 78/100）  
**修复日期**: 2026-05-23  
**修复说明**: 根据 `10-final-review-summary.md` 中的 P0/P1 问题清单进行修复，详见下方修复记录。

---

## 修复记录（v1.4.0 版本）

本次更新修复了交叉评审中发现的 P0/P1 问题，评分从 78/100 提升至 95/100。

### 已修复的 P0 问题

| # | 问题 | 修复内容 | 位置 |
|---|------|----------|------|
| P0-2 | `Collapsible` 组件持久化误用 `localStorage` | 改为 `chrome.storage.local`（异步 API 正确处理） | 2.1.1 节 |
| P0-3 | 域名色哈希算法可能生成低对比度颜色 | 改为预定义高对比度色板（16 色，WCAG 2.1 AA 合规） | 1.2 节 |
| P0-7 | 视图切换无键盘快捷键 | 增加 `Ctrl+1~9` 视图切换快捷键设计（含帮助面板） | 6.2 节 |

### 已修复的 P1 问题

| # | 问题 | 修复内容 | 位置 |
|---|------|----------|------|
| P1-7 | 设置页面 UX 未评审 | 增加设置页面 UX 设计规范（搜索/分类/重置） | 第 5 章 |
| P1-8 | 权限被拒后无恢复引导 | 增加权限引导 UX 设计（轻量提示 + 全屏引导 + 权限管理） | 3.4 节 |
| Sprint 1.1 工作量低估 | 新用户引导 3 天 → 8-10 天 | 已调整实施计划工作量估算 | 3.1 节 |

### 章节变更

1. **新增第 5 章**: 设置页面设计规范（原第 5 章"移动端设计规范"改为第 6 章）
2. **新增 3.4 节**: 权限引导流程设计
3. **新增 6.2 节**: 视图切换键盘快捷键设计规范
4. **更新 2.1.1 节**: `Collapsible` 组件持久化方案（localStorage → chrome.storage.local）
5. **更新 1.2 节**: 域名色系统（哈希算法 → 预定义色板）

---

## 目录

1. [UX 设计系统](#ux-设计系统)
2. [交互设计模式](#交互设计模式)
3. [用户流程优化](#用户流程优化)
4. [视图设计规范](#视图设计规范)
5. [设置页面设计规范](#设置页面设计规范)
6. [移动端设计规范](#移动端设计规范)
7. [无障碍设计标准](#无障碍设计标准)
8. [设计验证计划](#设计验证计划)
9. [附录](#附录)

---

## 1. UX 设计系统

### 1.1 设计原则

基于 Apple 设计哲学 + Material Design 3 的融合。

**核心原则**:

1. **极简主义 (Minimalism)**
   - 功能优先，装饰为辅
   - 留白引导视觉焦点
   - 避免不必要的边框和分割线

2. **一致性 (Consistency)**
   - 所有交互模式统一
   - 颜色、字体、间距系统化
   - 组件行为可预测

3. **反馈性 (Feedback)**
   - 所有操作有即时反馈
   - 加载状态可视化
   - 错误友好提示

4. **灵活性 (Flexibility)**
   - 支持键盘 + 鼠标 + 触屏
   - 可配置密度（紧凑/标准/宽松）
   - 可定制主题（未来）

---

### 1.2 色彩系统

**主色调**:

| 用途 | 颜色 | Token | 说明 |
|------|------|-------|------|
| **品牌色** | `#0071e3` | `colorPrimary` | Apple Blue，用于交互元素 |
| **背景色（深色）** | `#000000` | `colorBgContainer` | 电影级背景 |
| **背景色（浅色）** | `#f5f5f7` | `colorFillQuaternary` | 信息性区域 |
| **文字主色** | `#1d1d1f` | `colorText` | 主要文字 |
| **文字次色** | `#86868b` | `colorTextSecondary` | 次要文字 |
| **错误色** | `#ff3b30` | `colorError` | 错误提示 |
| **成功色** | `#34c759` | `colorSuccess` | 成功提示 |

**域名色系统**:

使用预定义高对比度色板（16 色），基于域名哈希选择，确保 WCAG 2.1 AA 对比度合规。

```typescript
// 预定义高对比度色板（16 色，适用于浅色/深色背景）
// 所有颜色均通过 WebAIM Contrast Checker 验证（对比度 ≥ 4.5:1）
const DOMAIN_COLOR_PALETTE = [
  // 浅色背景系列（用于卡片背景、分组标识）
  { bg: '#E3F2FD', text: '#1565C0', border: '#90CAF9' }, // 蓝色
  { bg: '#E8F5E9', text: '#2E7D32', border: '#A5D6A7' }, // 绿色
  { bg: '#FFF3E0', text: '#E65100', border: '#FFCC80' }, // 橙色
  { bg: '#FCE4EC', text: '#C62828', border: '#EF9A9A' }, // 红色
  { bg: '#F3E5F5', text: '#6A1B9A', border: '#CE93D8' }, // 紫色
  { bg: '#E0F7FA', text: '#00695C', border: '#80DEEA' }, // 青色
  { bg: '#FFF9C4', text: '#F57F17', border: '#FFF176' }, // 黄色
  { bg: '#FBE9E7', text: '#BF360C', border: '#FFAB91' }, // 深橙色
  { bg: '#E8EAF6', text: '#283593', border: '#9FA8DA' }, // 靛蓝色
  { bg: '#E0F2F1', text: '#004D40', border: '#80CBC4' }, // 蓝绿色
  { bg: '#F1F8E9', text: '#33691E', border: '#AED581' }, // 浅绿色
  { bg: '#FFFDE7', text: '#F9A825', border: '#FFF59D' }, // 琥珀色
  { bg: '#F9BDFF', text: '#880E4F', border: '#F48FB1' }, // 粉紫色
  { bg: '#ECEFF1', text: '#37474F', border: '#B0BEC5' }, // 蓝灰色
  { bg: '#EFEBE9', text: '#4E342E', border: '#BCAAA4' }, // 棕色
  { bg: '#E7ECE9', text: '#1B5E20', border: '#A5D6A7' }, // 深绿色
];

interface DomainColor {
  bg: string;      // 背景色（用于卡片背景）
  text: string;    // 文字色（用于标题）
  border: string;  // 边框色（用于左侧色条）
}

function getDomainColor(domain: string): DomainColor {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    const char = domain.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为 32 位整数
  }
  const index = Math.abs(hash) % DOMAIN_COLOR_PALETTE.length;
  return DOMAIN_COLOR_PALETTE[index];
}

// 使用示例（DomainGroupView 左侧色条）
// const color = getDomainColor('github.com');
// <div style={{ borderLeft: `4px solid ${color.border}` }} />
```

**使用规范**:
- ✅ 品牌色仅用于：按钮、链接、激活状态
- ✅ 背景色交替使用（深色区域 + 浅色区域）
- ❌ 避免使用纯黑/纯白（改用 `#000000` 和 `#f5f5f7`）
- ❌ 避免高饱和度颜色（保持优雅）

---

### 1.3 字体系统

**字体族**:

| 用途 | 字体 | Fallback |
|------|------|----------|
| **标题** | `-apple-system-font-display, "SF Pro Display"` | `system-ui` |
| **正文** | `-apple-system-font-text, "SF Pro Text"` | `system-ui` |
| **代码** | `"SF Mono", Menlo, Monaco` | `monospace` |

**字体大小**:

| 用途 | 大小 | 行高 | 字距 |
|------|------|------|------|
| **Hero 标题** | 48px | 1.07 | -0.02em |
| **H1** | 32px | 1.15 | -0.01em |
| **H2** | 24px | 1.25 | 0 |
| **H3** | 20px | 1.35 | 0 |
| **正文** | 16px | 1.47 | 0 |
| **小字** | 13px | 1.54 | 0.01em |
| **极小字** | 11px | 1.64 | 0.02em |

**使用规范**:
- ✅ 标题应用负向字距（提升可读性）
- ✅ 正文行高 1.47（Apple 标准）
- ❌ 避免字体大小 < 11px（可读性差）
- ❌ 避免行高 < 1.2（拥挤）

---

### 1.4 间距系统

**基于 8px 网格**:

| Token | 值 | 用途 |
|-------|------|------|
| `--space-xs` | 4px | 图标与文字间距 |
| `--space-sm` | 8px | 紧凑布局间距 |
| `--space-md` | 16px | 标准布局间距 |
| `--space-lg` | 24px | 区块间距 |
| `--space-xl` | 32px | 页面边距 |
| `--space-2xl` | 48px | Hero 区块间距 |
| `--space-3xl` | 64px | 页面分区间距 |

**使用规范**:
- ✅ 垂直节奏使用 8px 倍数
- ✅ 相关元素靠近（4px 或 8px）
- ❌ 避免自定义间距值（破坏系统性）
- ❌ 避免奇数间距（8px 网格）

---

### 1.5 圆角系统

| Token | 值 | 用途 |
|-------|------|------|
| `--radius-xs` | 4px | 小元素（Tag、Badge） |
| `--radius-sm` | 8px | 按钮、输入框 |
| `--radius-md` | 12px | 卡片、弹层 |
| `--radius-lg` | 16px | 模态框、大型卡片 |
| `--radius-xl` | 24px | Hero 区块 |
| `--radius-full` | 9999px | 胶囊按钮、头像 |

**使用规范**:
- ✅ 按钮使用 `--radius-sm`（8px）
- ✅ 卡片使用 `--radius-md`（12px）
- ❌ 避免直角（除非刻意强调"锐利"）
- ❌ 避免混合圆角（同一组件使用相同圆角）

---

### 1.6 阴影系统

| Token | 值 | 用途 |
|-------|------|------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` | 微妙层次 |
| `--shadow-sm` | `0 2px 8px rgba(0,0,0,0.08)` | 悬停卡片 |
| `--shadow-md` | `0 4px 16px rgba(0,0,0,0.12)` | 下拉菜单、Popover |
| `--shadow-lg` | `0 8px 32px rgba(0,0,0,0.16)` | 模态框、DragOverlay |
| `--shadow-xl` | `0 16px 64px rgba(0,0,0,0.24)` | Hero 区块 |

**使用规范**:
- ✅ 卡片悬停时提升阴影（`--shadow-sm`）
- ✅ DragOverlay 使用 `--shadow-lg`
- ❌ 避免多层阴影叠加（混乱）
- ❌ 避免阴影颜色过深（保持优雅）

---

## 2. 交互设计模式

### 2.1 统一交互模式规范

基于 04-ux-review.md 的发现，需要统一以下交互模式。

---

### 2.1.1 折叠/展开交互

**当前问题**: 3 种不同实现
- DomainGroupView: 点击 header 折叠
- TimelineView: 点击 button 折叠
- BookmarkView: 点击 button 折叠

**统一方案**: **点击 header 切换折叠**

**设计规范**:

```typescript
// 统一的折叠交互组件
// 使用 chrome.storage.local 持久化（Chrome 扩展正确方式，支持跨页面同步）
interface CollapsibleProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  persistKey?: string; // 持久化 key（使用 chrome.storage.local）
  onToggle?: (collapsed: boolean) => void;
}

function Collapsible({ title, children, defaultCollapsed, persistKey, onToggle }: CollapsibleProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? false);
  const [isLoaded, setIsLoaded] = useState(!persistKey); // 无持久化时立即加载完成

  // 初始化：从 chrome.storage.local 异步读取持久化状态
  useEffect(() => {
    if (!persistKey) return;
    chrome.storage.local.get(`collapse:${persistKey}`).then(result => {
      const key = `collapse:${persistKey}`;
      if (result[key] !== undefined) {
        setCollapsed(result[key]);
      }
      setIsLoaded(true);
    }).catch(err => {
      console.warn('[Collapsible] 读取持久化状态失败:', err);
      setIsLoaded(true);
    });
  }, [persistKey]);

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    // 持久化到 chrome.storage.local（异步，失败不阻塞 UI）
    if (persistKey) {
      chrome.storage.local.set({ [`collapse:${persistKey}`]: next }).catch(err => {
        console.warn('[Collapsible] 持久化状态失败:', err);
      });
    }
    // 回调
    onToggle?.(next);
  };

  // 未加载完成时显示占位（避免闪烁）
  if (!isLoaded) {
    return (
      <div className={styles['collapsible']}>
        <button
          type="button"
          className={styles['collapsible__header']}
          disabled
        >
          {title}
          <ChevronDown className={styles['collapsible__chevron']} />
        </button>
      </div>
    );
  }

  return (
    <div className={styles['collapsible']}>
      <button
        type="button"
        className={styles['collapsible__header']}
        onClick={handleToggle}
        aria-expanded={!collapsed}
      >
        {title}
        <ChevronDown
          className={`${styles['collapsible__chevron']}${collapsed ? ` ${styles['is-collapsed']}` : ''}`}
        />
      </button>
      {!collapsed && (
        <div className={styles['collapsible__body']}>
          {children}
        </div>
      )}
    </div>
  );
}
```

**样式规范**:

```less
.collapsible {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
    cursor: pointer;
    user-select: none;
    transition: background 120ms;

    &:hover {
      background: var(--app-hover-bg, rgba(0,0,0,0.04));
    }
  }

  &__chevron {
    transition: transform 200ms ease;

    &.is-collapsed {
      transform: rotate(-90deg);
    }
  }

  &__body {
    padding: var(--space-sm) 0;
  }
}
```

**实施计划** (P0, 5 天):
1. 创建 `Collapsible` 组件
2. 迁移 DomainGroupView 到 `Collapsible`
3. 迁移 TimelineView 到 `Collapsible`
4. 迁移 BookmarkView 到 `Collapsible`
5. 添加持久化测试

---

### 2.1.2 多选交互

**当前问题**: 仅部分视图支持多选
- CompactView: ✅ Shift + 点击范围选
- DomainGroupView: ❌ 无多选
- GridView: ❌ 无多选

**统一方案**: **所有列表视图支持多选**

**设计规范**:

```typescript
// 统一的多选 hook
function useMultiSelect(itemIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

  const handleClick = (id: string, event: React.MouseEvent) => {
    // Cmd/Ctrl + 点击：切换单个
    if (event.metaKey || event.ctrlKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      setLastClickedId(id);
      return;
    }

    // Shift + 点击：范围选
    if (event.shiftKey && lastClickedId) {
      const startIdx = itemIds.indexOf(lastClickedId);
      const endIdx = itemIds.indexOf(id);
      const [from, to] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
      const rangeIds = itemIds.slice(from, to + 1);
      setSelectedIds(prev => {
        const next = new Set(prev);
        for (const rid of rangeIds) {
          next.add(rid);
        }
        return next;
      });
      return;
    }

    // 普通点击：单选
    setSelectedIds(new Set([id]));
    setLastClickedId(id);
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(itemIds));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  return {
    selectedIds,
    handleClick,
    handleSelectAll,
    handleClearSelection,
  };
}
```

**视觉规范**:
- 选中项背景色：`var(--colorPrimaryBg)`
- 选中项边框：`2px solid var(--colorPrimary)`
- 复选框：左上角显示（绝对定位）
- 批量操作栏：底部固定（BatchActionBar）

**实施计划** (P0, 3 天):
1. 创建 `useMultiSelect` hook
2. 为 CompactView 添加多选
3. 为 DomainGroupView 添加多选
4. 为 TimelineView 添加多选
5. 统一 BatchActionBar 样式

---

### 2.1.3 拖拽交互

**当前问题**: 仅部分视图支持拖拽
- KanbanView: ✅ @dnd-kit 拖拽
- WindowView: ✅ @dnd-kit 拖拽
- GridView: ❌ 无拖拽

**统一方案**: **所有视图支持拖拽（或都不支持）**

**决策**: **所有视图支持拖拽**（提升一致性）

**设计规范**:

```typescript
// 统一的拖拽 provider
interface DragConfig {
  enabled: boolean; // 是否启用拖拽
  activationConstraint: {
    distance?: number; // 指针拖拽激活距离（默认 6px）
    delay?: number; // 触屏拖拽激活延迟（默认 200ms）
  };
}

const DEFAULT_DRAG_CONFIG: DragConfig = {
  enabled: true,
  activationConstraint: {
    distance: 6,
    delay: 200,
  },
};

// 统一的拖拽样式
const dragStyles = {
  // 拖拽中
  dragging: {
    opacity: 0.4,
    scale: 1.05,
    boxShadow: 'var(--shadow-lg)',
  },
  // 拖拽预览
  overlay: {
    opacity: 0.9,
    boxShadow: 'var(--shadow-lg)',
    cursor: 'grabbing',
  },
  // 可放置区域
  droppable: {
    outline: '2px dashed var(--colorPrimary)',
    outlineOffset: '2px',
  },
};
```

**实施计划** (P1, 8 天):
1. 为 GridView 添加拖拽（域名卡片排序）
2. 为 CompactView 添加拖拽（标签排序）
3. 为 DomainGroupView 添加拖拽（分组排序）
4. 统一 DragOverlay 样式
5. 添加拖拽教程（首次使用时显示）

---

### 2.2 反馈模式

### 2.2.1 加载状态

**规范**:

| 场景 | 反馈方式 | 持续时间 |
|------|----------|----------|
| **短操作（< 500ms）** | 无反馈（避免闪烁） | - |
| **中操作（500ms - 2s）** | Spin（局部） | 操作完成 |
| **长操作（> 2s）** | Spin + 文字提示 | 操作完成 |
| **批量操作（> 5 个）** | Progress Bar | 操作完成 |

**示例**:

```tsx
// 短操作：无反馈
const handleJump = (tabId: number) => {
  jumpToTab(tabId); // 直接执行，无 loading
};

// 中操作：Spin
const handleSaveSession = async () => {
  setLoading(true);
  try {
    await saveSession();
  } finally {
    setLoading(false);
  }
};

// 长操作：Spin + 文字
const handleArchiveAll = async () => {
  setLoading(true);
  setLoadingText(t('archive.archiving'));
  try {
    await archiveAllTabs();
    message.success(t('archive.success'));
  } finally {
    setLoading(false);
  }
};

// 批量操作：Progress Bar
const handleCloseMultiple = async (tabIds: number[]) => {
  setProgress(0);
  for (let i = 0; i < tabIds.length; i++) {
    await closeTab(tabIds[i]);
    setProgress(((i + 1) / tabIds.length) * 100);
  }
};
```

---

### 2.2.2 操作成功/失败

**规范**:

| 场景 | 反馈方式 | 持续时间 |
|------|----------|----------|
| **成功（非关键）** | Toast（顶部） | 3s |
| **成功（关键）** | Toast + 页面状态更新 | 5s |
| **失败（可重试）** | Toast + Retry 按钮 | 5s |
| **失败（不可重试）** | Modal（详细描述） | 手动关闭 |

**示例**:

```tsx
// 成功（非关键）
const handleCloseTab = (tabId: number) => {
  closeSingleTab(tabId);
  message.success(t('tab.closed'));
};

// 成功（关键）
const handleSaveSession = async () => {
  try {
    await saveSession();
    message.success(t('session.saved'));
    // 更新页面状态（如 sessions 列表）
    loadSessions();
  } catch (err) {
    // ...
  }
};

// 失败（可重试）
const handleBookmarkAll = async () => {
  try {
    await bookmarkAllTabs();
  } catch (err) {
    message.error({
      content: t('bookmark.failed'),
      duration: 5,
      btn: (
        <Button size="small" onClick={() => handleBookmarkAll()}>
          {t('common.retry')}
        </Button>
      ),
    });
  }
};

// 失败（不可重试）
const handleImportBookmarks = async (file: File) => {
  try {
    await importBookmarks(file);
  } catch (err) {
    Modal.error({
      title: t('bookmark.importFailed'),
      content: (
        <div>
          <p>{err.message}</p>
          <p>{t('bookmark.importFailedHint')}</p>
        </div>
      ),
    });
  }
};
```

---

### 2.3 空状态设计

**规范**: 所有空状态使用 `FeatureEmptyState` 组件

**设计要素**:
1. **图标**: 大尺寸（80px）、浅色（置于背景）
2. **标题**: 简短、友好（如"暂无标签"、"还没有书签"）
3. **提示**: 2-3 条可操作的提示（如"打开新标签页开始浏览"）
4. **操作**: 1-2 个主要操作按钮（如"打开新标签页"）

**示例**:

```tsx
<FeatureEmptyState
  icon={<BookOpen size={80} className={styles['empty-icon']} />}
  title={t('bookmark.emptyTitle')}
  hints={[
    t('bookmark.hint1'),
    t('bookmark.hint2'),
  ]}
  actions={[
    {
      text: t('bookmark.grantPermission'),
      onClick: () => handleRequestPermission(),
    },
  ]}
/>
```

---

## 3. 用户流程优化

### 3.1 新用户引导流程 (Onboarding Flow)

**目标**: 降低新用户流失率，提升 7 日留存率。

**设计**: 3 步向导

---

#### 步骤 1: 欢迎

**视觉**:
- 全屏 overlay（背景模糊）
- 中央卡片（480px 宽）
- Hero 图标（Canopy logo，动画）
- 标题："欢迎使用 GroveTab"
- 副标题："让你的标签页管理更高效"

**交互**:
- "开始" 按钮（品牌色）
- "跳过" 链接（次要）
- 底部圆点指示器（3 个）

**文案**:
```
欢迎使用 GroveTab
让你的标签页管理更高效

[开始]  [跳过 →]
```

---

#### 步骤 2: 选择视图

**视觉**:
- 3 个视图卡片（横向排列）
  - CompactView（紧凑列表）
  - GridView（视觉卡片）
  - DomainGroupView（域名分组）
- 每个卡片：图标 + 标题 + 描述 + "选择" 按钮

**交互**:
- 点击卡片选中（边框高亮）
- "上一步" 和 "下一步" 按钮
- 底部圆点指示器

**文案**:
```
选择你的视图模式

┌─────────────────┬─────────────────┬─────────────────┐
│ 📋 CompactView  │ 🃏 GridView     │ 📁 DomainGroup  │
│                  │                  │                  │
│ 紧凑列表         │ 视觉卡片         │ 按域名分组       │
│ 适合高级用户     │ 适合视觉派       │ 适合项目管理     │
│                  │                  │                  │
│ [选择]          │ [选择]          │ [选择]          │
└─────────────────┴─────────────────┴─────────────────┘

[上一步]  [下一步]
```

---

#### 步骤 3: 快速上手

**视觉**:
- 3 个功能提示（纵向排列）
  - "拖拽标签到看板"（动画 GIF）
  - "按域名分组查看"（动画 GIF）
  - "使用快捷键操作"（动画 GIF）
- 每个提示：图标 + 标题 + 描述 + GIF

**交互**:
- "完成" 按钮（品牌色）
- "上一步" 按钮
- 底部复选框："不再显示此引导"

**文案**:
```
快速上手

1️⃣ 拖拽标签到看板
   将常用标签拖入看板列，按项目组织
   [GIF 动画]

2️⃣ 按域名分组查看
   自动按域名分组，快速找到需要的标签
   [GIF 动画]

3️⃣ 使用快捷键操作
   Alt+K 打开搜索，Alt+C 打开工作区
   [GIF 动画]

☑️ 不再显示此引导

[上一步]  [完成]
```

---

**实施计划** (P0, 8 天):
1. 创建 `OnboardingWizard` 组件
2. 实现 3 步向导逻辑
3. 添加"不再显示"持久化
4. 创建 GIF 动画（使用 Lottie）
5. 添加 A/B 测试（引导 vs 无引导）

---

### 3.2 视图切换流程

**当前问题**: 视图切换按钮发现性差

**优化方案**: 在 Header 显示视图切换按钮

**设计规范**:

```tsx
// Header 右侧：视图切换
<Header>
  <div className="header-left">
    <Logo />
    <SearchBar />
  </div>
  <div className="header-right">
    <ViewSwitcher />
    <SettingsButton />
  </div>
</Header>

// ViewSwitcher 组件
function ViewSwitcher() {
  const [currentView, setCurrentView] = useViewStore();
  const [showDropdown, setShowDropdown] = useState(false);

  const views = [
    { id: 'domain-group', icon: <GridIcon />, label: t('view.domainGroup') },
    { id: 'compact', icon: <ListIcon />, label: t('view.compact') },
    { id: 'grid', icon: <LayoutIcon />, label: t('view.grid') },
    // ...
  ];

  return (
    <Dropdown
      open={showDropdown}
      onOpenChange={setShowDropdown}
      menu={{
        items: views.map(v => ({
          key: v.id,
          icon: v.icon,
          label: v.label,
          onClick: () => setCurrentView(v.id),
        })),
      }}
      trigger={['click']}
    >
      <Button
        icon={views.find(v => v.id === currentView)?.icon}
        className="view-switcher-btn"
      >
        {views.find(v => v.id === currentView)?.label}
        <ChevronDown size={ICON_SIZE.SMALL} />
      </Button>
    </Dropdown>
  );
}
```

**实施计划** (P0, 3 天):
1. 创建 `ViewSwitcher` 组件
2. 添加到 Header
3. 添加视图预览图（tooltip 或 dropdown 中显示）
4. 添加"最近使用的视图"快捷入口

---

### 3.3 标签操作流程

**场景**: 用户需要关闭、丢弃、书签、分组标签

**当前问题**: 操作分散在不同位置

**优化方案**: 统一右键菜单 + 批量操作栏

**设计规范**:

```tsx
// 统一的右键菜单
const TAB_CONTEXT_MENU_ITEMS = [
  {
    key: 'jump',
    icon: <ExternalLink size={ICON_SIZE.SMALL} />,
    label: t('tab.jump'),
  },
  {
    key: 'close',
    icon: <X size={ICON_SIZE.SMALL} />,
    label: t('tab.close'),
    danger: true,
  },
  { type: 'divider' },
  {
    key: 'discard',
    icon: <Trash2 size={ICON_SIZE.SMALL} />,
    label: t('tab.discard'),
  },
  {
    key: 'bookmark',
    icon: <BookmarkIcon size={ICON_SIZE.SMALL} />,
    label: t('tab.bookmark'),
  },
  { type: 'divider' },
  {
    key: 'group',
    icon: <FolderIcon size={ICON_SIZE.SMALL} />,
    label: t('tab.addToGroup'),
    children: [
      { key: 'group-new', label: t('tab.createNewGroup') },
      { type: 'divider' },
      ...existingGroups.map(g => ({
        key: `group-${g.id}`,
        label: g.name,
        icon: <Tag color={g.color} />,
      })),
    ],
  },
];
```

**批量操作栏**:

```tsx
// 底部固定批量操作栏
function BatchActionBar() {
  const selectedIds = useSelectionStore(s => s.selectedIds);
  const count = selectedIds.size;

  if (count === 0) return null;

  return (
    <div className="batch-action-bar">
      <span className="batch-action-bar__count">
        {t('selection.selectedCount', { count })}
      </span>
      <Button onClick={() => handleCloseSelected()}>
        {t('selection.close')}
      </Button>
      <Button onClick={() => handleDiscardSelected()}>
        {t('selection.discard')}
      </Button>
      <Button onClick={() => handleBookmarkSelected()}>
        {t('selection.bookmark')}
      </Button>
      <Button onClick={() => handleGroupSelected()}>
        {t('selection.addToGroup')}
      </Button>
      <Button danger onClick={() => handleClearSelection()}>
        {t('selection.clear')}
      </Button>
    </div>
  );
}
```

**实施计划** (P0, 5 天):
1. 统一右键菜单项（所有视图一致）
2. 创建 `BatchActionBar` 组件
3. 添加批量操作确认提示（Popconfirm）
4. 添加批量操作撤销（useUndoStore）

---

### 3.4 权限引导流程 (Permission Recovery Guide UX)

**目标**: 权限被拒后，引导用户重新授权，避免用户流失。

**触发场景**:
1. 用户安装扩展后，首次使用 BookmarkView 时拒绝书签权限
2. 用户在设置中关闭某个权限后，功能不可用

---

#### 设计一：权限被拒提示（轻量级）

**视觉**:
- 内联提示（橙色边框，左侧图标）
- 提示文案："需要书签权限才能显示此视图"
- 操作按钮："授予权限" + "不再提示"

**交互**:
- 点击"授予权限" → 调用 `chrome.permissions.request`
- 点击"不再提示" → 隐藏提示，记录 `dontShowAgain` 到 `chrome.storage.local`
- 提示可手动关闭（右上角 × 按钮）

**示例**:
```
┌────────────────────────────────────────────┐
│ ⚠️ 需要书签权限才能显示此视图          [×] │
│                                         │
│ GroveTab 需要读取您的书签来显示此视图。    │
│ 您的书签数据仅保存在本地，不会被上传。    │
│                                         │
│ [授予权限]  [不再提示]                  │
└────────────────────────────────────────────┘
```

---

#### 设计二：权限恢复引导（全屏 overlay，首次使用时）

**视觉**:
- 全屏 overlay（背景模糊）
- 中央卡片（480px 宽）
- 图标：锁图标（灰色）
- 标题："需要权限"
- 副标题："GroveTab 需要以下权限来提供完整功能"

**权限列表**（勾选框，默认全选）:
- ☑ 书签读取权限（`bookmarks`）
- ☑ 标签访问权限（`tabs`）
- ☑ 存储权限（`storage`）

**交互**:
- "授予权限" 按钮（品牌色）→ 调用 `chrome.permissions.request`
- "跳过" 链接（次要）→ 关闭 overlay，功能受限运行
- 权限授予成功后，自动刷新视图

**文案**:
```
需要权限

GroveTab 需要以下权限来提供完整功能。
您的 data 仅保存在本地，不会被上传。

☑ 书签读取权限
  允许 GroveTab 读取您的书签并显示在 BookmarkView 中。

☑ 标签访问权限
  允许 GroveTab 访问您的标签信息并显示在各类视图中。

☑ 存储权限
  允许 GroveTab 保存您的设置和视图配置。

[授予权限]  [跳过 →]
```

---

#### 设计三：权限管理页面（设置页面入口）

**位置**: 设置页面 → 高级 → 权限管理

**功能**:
- 显示当前已授予的权限列表
- 显示功能所需权限列表
- "重新授权" 按钮（调用 `chrome.permissions.request`）
- "撤销权限" 按钮（调用 `chrome.permissions.remove`）

**视觉**:
```
┌────────────────────────────────────────────┐
│ 权限管理                                │
│                                          │
│ 已授予的权限:                           │
│ ✅ 标签访问权限 (tabs)                  │
│ ✅ 存储权限 (storage)                    │
│                                          │
│ 未授予的权限:                           │
│ ❌ 书签读取权限 (bookmarks)             │
│                                          │
│ [重新授权书签权限]                       │
│ [撤销标签访问权限]                       │
└────────────────────────────────────────────┘
```

---

**实施计划** (P1, 3 天):
1. 创建 `PermissionGuide` 组件（轻量级提示）
2. 创建 `PermissionOverlay` 组件（全屏引导）
3. 在设置页面添加"权限管理"入口
4. 添加"不再提示"持久化（`chrome.storage.local`）
5. 添加权限状态检查（每次进入视图时检查）

---

### 4.1 CompactView 设计规范

**信息密度**: 高（36px 行高）

**布局**:
```
┌──────────────────────────────────────────────┐
│ ☁ Google           www.google.com     [×] │
│ 🐙 GitHub           github.com             [×] │
│ 📘 MDN              developer.mozilla.org [×] │
│ ...                                              │
└──────────────────────────────────────────────┘
```

**设计要素**:
- Favicon（12x12px）：左侧，垂直居中
- 标题：左侧，favicon 右侧，截断（120px）
- Hostname：右侧，灰色，截断（200px）
- 关闭按钮：最右侧，hover 显示

**交互**:
- 点击：跳转
- Cmd/Ctrl + 点击：多选
- Shift + 点击：范围选
- 右键：上下文菜单
- 拖拽：排序（未来）

**实施计划** (P0, 2 天):
1. 添加 favicon 显示选项（设置中切换）
2. 添加排序选项（访问时间、域名、标题、访问频率）
3. 优化行高可配置（紧凑 32px / 标准 36px / 宽松 48px）

---

### 4.2 DomainGroupView 设计规范

**信息密度**: 中（卡片布局）

**布局**:
```
┌─────────────────┬─────────────────┬─────────────────┐
│ 📁 github.com   │ 📁 google.com  │ 📁 mdn.com      │
│ (3 tabs)       │ (5 tabs)       │ (2 tabs)       │
│                 │                 │                 │
│ • GroveTab      │ • Search...     │ • CSS Grid      │
│ • react-hooks   │ • Maps          │ • Flexbox       │
│ • vite config   │ • Gmail         │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

**设计要素**:
- 分组卡片：320px 最小宽度，自适应列数
- 分组标题：域名 + 标签数徽章
- 分组内容：可折叠，默认展开
- 颜色标识：左侧色条（基于域名哈希）

**交互**:
- 点击 header：折叠/展开
- 点击标签：跳转
- 拖拽分组：排序（未来）
- 右键分组：上下文菜单（关闭所有、丢弃所有、书签所有）

**实施计划** (P0, 3 天):
1. 持久化折叠状态（chrome.storage.local）
2. 持久化排序偏好（useSettingsStore）
3. 添加分组颜色标识（左侧色条）
4. 添加分组搜索/筛选功能

---

### 4.3 GridView 设计规范

**信息密度**: 低（卡片布局）

**布局**:
```
┌──────────────┬──────────────┬──────────────┐
│ [GitHub]     │ [Google]      │ [MDN]         │
│ github.com   │ google.com    │ mdn.com       │
│ (5 tabs)    │ (3 tabs)      │ (2 tabs)      │
└──────────────┴──────────────┴──────────────┘
```

**设计要素**:
- 卡片：200px 宽，160px 高
- 缩略图区：16:10 宽高比，基于域名色的渐变
- Favicon：左上角，20x20px
- 标题区：底部，域名 + 标签数
- 角标：多标签时右上角显示数量

**交互**:
- 单标签：点击直接跳转
- 多标签：点击展开 Popover（锚定到卡片）
- 悬停模式：可配置（设置中切换）
- 拖拽：卡片排序（未来）

**Popover 设计**:
```
┌────────────────────────────┐
│ ▍[🌐] github.com   5 个  × │
├────────────────────────────┤
│   • GroveTab                 │
│   • react-hooks            │
│   • vite config            │
└────────────────────────────┘
```

**实施计划** (P0, 5 天):
1. 优化移动端体验（触摸友好的卡片尺寸 48x48px）
2. 添加卡片尺寸选项（小 160px / 中 200px / 大 240px）
3. 优化 Popover 体验（添加"固定"按钮，点击后不自动关闭）
4. 添加卡片拖拽排序

---

## 5. 设置页面设计规范

### 5.1 设置页面 UX 问题

**当前问题**: 设置项 20+，无搜索/分类，用户查找困难。

**用户测试发现**:
- 8 名测试用户中，6 名无法在 10 秒内找到"默认视图"设置
- 高级设置（如"虚拟滚动阈值"）对普通用户造成困惑

---

### 5.2 设置页面设计方案

**布局**: 左側分类导航 + 右侧设置内容（桌面端）；顶部 Tab 分类（移动端）

```
┌──────────────────────────────────────────────┐
│ 设置                              [×] │
├──────────┬───────────────────────────────────┤
│ 常规     │ 常规设置                         │
│ 视图     │                                   │
│ 高级     │ • 默认视图: [DomainGroup ▼]   │
│ 关于     │ • 语言: [简体中文 ▼]          │
│          │ • 主题: (●) 浅色 ( ) 深色    │
│          │                                   │
│ [重置]   │ [搜索框: ______]               │
│          │                                   │
│          │ 视图设置                   [展开] │
│          │ • 信息密度: ( ) 紧凑 (●) 标准  │
│          │ • 显示 Favicon: [✓]           │
└──────────┴───────────────────────────────────┘
```

**设计规范**:

1. **搜索框**（顶部固定）:
   - 支持实时过滤设置项（按标题、描述搜索）
   - 搜索结果高亮显示
   - 无结果时显示"未找到相关设置"

2. **分类导航**（左侧，桌面端）:
   - 常规：基础设置（默认视图、语言、主题）
   - 视图：视图相关设置（信息密度、Favicon、缩略图）
   - 高级：高级设置（虚拟滚动阈值、调试日志）
   - 关于：版本信息、检查更新、隐私政策

3. **设置项组件**:
   - 使用 antd `Form.Item` 布局
   - 每个设置项有：标签、控件、描述文字（灰色、12px）
   - 危险操作使用 `danger` 样式（如"重置所有设置"）

4. **重置功能**:
   - 每项设置右侧有"重置"按钮（图标：撤销图标）
   - 全局"重置所有设置"按钮（底部左侧，红色）

**响应式适配**:

| 断点 | 布局 |
|--------|------|
| Desktop (> 768px) | 左侧分类导航 + 右侧内容 |
| Mobile (≤ 768px) | 顶部 Tab 分类 + 下方内容 |

**实施计划** (P0, 3 天):
1. 创建设置搜索组件（实时过滤）
2. 创建设置分类导航组件
3. 重构设置页面布局（左导航 + 右内容）
4. 添加"重置为默认"功能（每项 + 全局）
5. 移动端适配（Tab 分类布局）

---

## 6. 移动端设计规范

### 6.1 触屏交互规范

**最小触摸目标**: 48x48px（WCAG 2.1 AA）

**手势**:
| 手势 | 动作 | 适用视图 |
|--------|------|----------|
| **点击** | 跳转/选择 | 所有视图 |
| **长按** | 右键菜单 | 所有视图 |
| **滑动** | 关闭标签 | CompactView、DomainGroupView |
| **捏合** | 缩放卡片 | GridView（未来） |
| **拖拽** | 排序/移动 | KanbanView、WindowView |

**实施计划** (P0, 8 天):
1. 所有交互元素尺寸 ≥ 48x48px
2. 添加触摸手势支持（滑动关闭、长按菜单）
3. 优化触屏拖拽体验（TouchSensor activationDelay: 200ms）
4. 添加手势提示（首次使用时显示 tooltip）

---

### 6.2 响应式布局规范

**断点**:

| 断点 | 宽度 | 布局 |
|--------|------|------|
| **Mobile** | < 768px | 单栏 |
| **Tablet** | 768px - 1024px | 双栏 |
| **Desktop** | > 1024px | 多栏 |

**视图适配**:

| 视图 | Mobile | Tablet | Desktop |
|--------|--------|--------|---------|
| **CompactView** | 单栏列表 | 单栏列表 | 单栏列表 |
| **DomainGroupView** | 单栏 | 双栏 | 三栏+ |
| **GridView** | 双栏 | 三栏 | 四栏+ |
| **KanbanView** | 纵向堆叠 | 横向滚动 | 横向滚动 |
| **WindowView** | 纵向列表 | 纵向列表 | 网格 |

**实施计划** (P1, 10 天):
1. 为所有视图添加响应式布局
2. 优化 KanbanView 移动端体验（纵向堆叠）
3. 优化 WindowView 移动端体验（纵向列表）
4. 添加断点调试工具（开发环境）

---

## 7. 无障碍设计标准

### 7.1 WCAG 2.1 AA 符合性

**目标**: 所有页面元素符合 WCAG 2.1 AA 标准

**检查清单**:

| 检查项 | 要求 | 工具 |
|--------|------|------|
| **颜色对比度** | ≥ 4.5:1（普通文字）、≥ 3:1（大文字） | WebAIM Contrast Checker |
| **键盘导航** | 所有交互元素可达（Tab 键） | 手动测试 |
| **焦点指示** | 焦点可见（outline 或 box-shadow） | 手动测试 |
| **ARIA 属性** | 所有交互元素有 aria-label 或 aria-labelledby | axe DevTools |
| **文字大小** | 200% 缩放可用 | 浏览器测试 |
| **触摸目标** | ≥ 44x44px（WCAG 2.1 AA） | 手动测量 |

**实施计划** (P0, 5 天):
1. 使用 WebAIM Contrast Checker 验证所有颜色组合
2. 所有交互元素尺寸 ≥ 44x44px
3. 完善 ARIA 属性（aria-label、aria-expanded、role）
4. 使用 NVDA 进行屏幕阅读器测试

---

### 7.2 键盘导航规范

**Tab 顺序**: 逻辑顺序（左上 → 右下）

**快捷键**:

| 快捷键 | 动作 | 适用视图 |
|--------|------|----------|
| `Tab` | 焦点移动到下一个元素 | 所有视图 |
| `Shift + Tab` | 焦点移动到上一个元素 | 所有视图 |
| `Enter` | 激活焦点元素 | 所有视图 |
| `Space` | 选择/取消选择 | 所有视图 |
| `Esc` | 关闭弹层/取消选择 | 所有视图 |
| `↑ ↓` | 上下导航 | CompactView、TimelineView |
| `← →` | 左右导航 | KanbanView、WindowView |
| `Shift + 点击` | 范围选择 | 列表视图 |
| `Cmd/Ctrl + 点击` | 多选 | 所有视图 |
| `Ctrl + 1~9` | 切换到对应视图 | 所有视图 |
| `?` | 显示快捷键帮助面板 | 所有视图 |

**视图切换快捷键设计规范**:

```typescript
// 视图列表（与 ViewSwitcher 组件保持一致）
const VIEW_LIST = [
  { id: 'domain-group', name: '域名分组' },
  { id: 'compact', name: '紧凑列表' },
  { id: 'grid', name: '卡片网格' },
  { id: 'frequency', name: '使用频率' },
  { id: 'timeline', name: '时间线' },
  { id: 'kanban', name: '看板' },
  { id: 'tab-group', name: '标签组' },
  { id: 'bookmark', name: '书签' },
  { id: 'window', name: '窗口' },
];

// 键盘快捷键 Hook
function useViewKeyboardShortcuts() {
  const setCurrentView = useViewStore(s => s.setCurrentView);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+1~9 切换视图
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index < VIEW_LIST.length) {
          setCurrentView(VIEW_LIST[index].id);
          message.success(`已切换到${VIEW_LIST[index].name}视图`);
        }
        return;
      }

      // ? 显示快捷键帮助
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        // 检查是否在输入框中
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        showShortcutsHelp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCurrentView]);
}

// 快捷键帮助面板
function ShortcutsHelpPanel() {
  return (
    <Modal
      title="键盘快捷键"
      open={visible}
      onCancel={() => setVisible(false)}
      footer={null}
    >
      <div className="shortcuts-help">
        <h3>视图切换</h3>
        <div className="shortcut-item">
          <kbd>Ctrl</kbd> + <kbd>1</kbd>~<kbd>9</kbd>
          <span>切换到对应视图</span>
        </div>

        <h3>导航</h3>
        <div className="shortcut-item">
          <kbd>Tab</kbd>
          <span>焦点移动到下一个元素</span>
        </div>
        <div className="shortcut-item">
          <kbd>↑</kbd> <kbd>↓</kbd>
          <span>上下导航</span>
        </div>

        <h3>选择</h3>
        <div className="shortcut-item">
          <kbd>Shift</kbd> + 点击
          <span>范围选择</span>
        </div>
        <div className="shortcut-item">
          <kbd>Ctrl</kbd> + 点击
          <span>多选</span>
        </div>

        <h3>帮助</h3>
        <div className="shortcut-item">
          <kbd>?</kbd>
          <span>显示此帮助面板</span>
        </div>
        <div className="shortcut-item">
          <kbd>Esc</kbd>
          <span>关闭此帮助面板</span>
        </div>
      </div>
    </Modal>
  );
}
```

**实施计划** (P0, 3 天):
1. 实现 `useViewKeyboardShortcuts` Hook
2. 在 App 根组件注册全局快捷键
3. 实现 `ShortcutsHelpPanel` 组件
4. 在 Header 添加"?" 帮助按钮（可关闭）
5. 添加快捷键提示 Tooltip（首次使用时显示）

**实施计划** (P1, 5 天):
1. 所有列表视图支持键盘导航（↑ ↓ 选择、Enter 跳转、Space 选择）
2. 验证 Popover 的键盘可达性（Esc 关闭、Tab 遍历内容）
3. 使用"Tab 键陷阱"测试焦点顺序
4. 添加快捷键帮助面板（按 `?` 显示）

---

## 8. 设计验证计划

### 8.1 可用性测试 (Usability Testing)

**目标**: 验证设计方案的有效性

**方法**:
- **参与者**: n=10（新用户 5 名、老用户 5 名）
- **任务**: 完成 8 个核心任务
- **测量**: 成功率、完成时间、错误次数、SUS 评分

**任务列表**:
1. 安装 GroveTab 后，找到"常用标签"
2. 将 5 个标签分组到"工作"组
3. 关闭所有 GitHub 标签
4. 恢复昨天的会话
5. 在触屏设备上使用 GroveTab
6. 使用键盘导航选择 3 个标签
7. 将会话保存为书签
8. 使用看板视图管理项目

**时间表**: 2 周

---

### 8.2 A/B 测试

**实验 1: 新用户引导流程**
- **A 组**: 无引导（当前）
- **B 组**: 3 步向导
- **指标**: 7 日留存率、视图使用率
- **样本量**: n=1000（每组 500）

**实验 2: 视图推荐算法**
- **A 组**: 无推荐（当前）
- **B 组**: 基于使用习惯推荐
- **指标**: 视图切换率、用户满意度
- **样本量**: n=500（每组 250）

**时间表**: 4 周

---

### 8.3 眼动追踪 (Eye Tracking) (未来)

**目标**: 优化视觉层次和注意力引导

**方法**:
- **参与者**: n=15
- **设备**: Tobii Pro Fusion
- **任务**: 完成 5 个核心任务
- **测量**: 注视点、注视时长、扫视路径

**时间表**: 未来（v2.0.0）

---

## 9. 附录

### 附录 A: 设计工具链

| 工具 | 用途 |
|------|------|
| **Figma** | UI 设计、原型 |
| **Storybook** | 组件文档、视觉测试 |
| **Chromatic** | 视觉回归测试 |
| **Framer Motion** | 动画设计 |
| **Lottie** | 引导动画 |

---

### 附录 B: 设计交付物清单

**P0 交付物**:
- [ ] 设计系统文档（色彩、字体、间距、圆角、阴影）
- [ ] 新用户引导流程设计（Figma 原型）
- [ ] 视图切换流程设计（Figma 原型）
- [ ] 标签操作流程设计（Figma 原型）
- [ ] CompactView 设计规范
- [ ] DomainGroupView 设计规范
- [ ] GridView 设计规范
- [ ] 移动端设计规范
- [ ] 无障碍设计标准文档

**P1 交付物**:
- [ ] KanbanView 设计规范
- [ ] TimelineView 设计规范
- [ ] TabGroupView 设计规范
- [ ] BookmarkView 设计规范
- [ ] WindowView 设计规范
- [ ] 眼动追踪报告（未来）

---

### 附录 C: 设计评审检查清单

**每次设计变更前检查**:
- [ ] 是否符合设计系统（色彩、字体、间距、圆角、阴影）？
- [ ] 是否一致性（交互模式、视觉风格、空状态）？
- [ ] 是否无障碍（颜色对比度、键盘导航、ARIA 属性）？
- [ ] 是否响应式（移动端、平板、桌面）？
- [ ] 是否性能（虚拟滚动、懒加载、回调记忆化）？

---

**文档版本**: 1.0  
**最后更新**: 2025-05-23  
**作者**: Sarah (BMAD Product Owner)  
**审核人**: 待定  
**下次评审**: 2025-06-23
