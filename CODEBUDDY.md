# GroveTab 代码规范

## 项目概述

GroveTab 是一个 Chrome 新标签页扩展，使用 React 19 + TypeScript + Vite + Ant Design v6 + Zustand 构建。

---

## 1. React 最佳实践

### 1.1 组件设计原则

#### 组件拆分原则
- **单一职责**：每个组件只做一件事
- **可复用性**：公共组件提取到 `src/shared/ui/`
- **可组合性**：使用 children 和 composition 模式

```tsx
// ✅ 正确：使用 composition
<Card 
  title={<Typography.Title level={4}>标题</Typography.Title>}
  extra={<Button>操作</Button>}
>
  <p>内容</p>
</Card>

// ❌ 错误：过度嵌套 div
<div className="card">
  <div className="card-header">
    <div className="title">标题</div>
    <div className="actions"><button>操作</button></div>
  </div>
  <div className="card-body"><p>内容</p></div>
</div>
```

#### 组件命名规范
- 使用 PascalCase：`TabView`, `BookmarkCard`
- 文件名与组件名一致：`TabView.tsx` 导出 `TabView`
- 使用描述性名称，避免缩写：`BookmarkGridView` 而非 `BMGV`

### 1.2 Hooks 使用规范

#### useState
```tsx
// ✅ 正确：使用对象状态合并更新
const [state, setState] = useState({ count: 0, loading: false });
setState(prev => ({ ...prev, loading: true }));

// ❌ 错误：过度拆分状态
const [count, setCount] = useState(0);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
```

#### useEffect
```tsx
// ✅ 正确：明确的依赖数组
useEffect(() => {
  const controller = new AbortController();
  fetchData(controller.signal);
  return () => controller.abort();
}, [userId]); // 明确依赖

// ❌ 错误：缺少依赖或依赖过多
useEffect(() => {
  fetchData();
}, []); // 缺少 userId 依赖
```

#### useMemo / useCallback
```tsx
// ✅ 正确：缓存昂贵计算
const sortedTabs = useMemo(
  () => tabs.sort((a, b) => b.lastAccessed - a.lastAccessed),
  [tabs]
);

// ✅ 正确：缓存回调函数
const handleTabClick = useCallback((tabId: string) => {
  chrome.tabs.update(parseInt(tabId), { active: true });
}, []);

// ❌ 错误：不必要的缓存（简单计算）
const total = useMemo(() => items.length, [items]); // 过度优化
```

#### 自定义 Hooks
```tsx
// ✅ 正确：自定义 Hook 以 use 开头
function useTabActions() {
  const closeTab = useCallback((tabId: string) => {
    chrome.tabs.remove(parseInt(tabId));
  }, []);
  
  return { closeTab };
}

// 使用
const { closeTab } = useTabActions();
```

### 1.3 性能优化

#### React.memo
```tsx
// ✅ 正确：对纯组件使用 memo
const TabCard = React.memo(({ tab, onClose }: TabCardProps) => {
  return (
    <Card onClick={() => handleTabClick(tab.id)}>
      {tab.title}
    </Card>
  );
}, (prevProps, nextProps) => {
  return prevProps.tab.id === nextProps.tab.id 
    && prevProps.tab.title === nextProps.tab.title;
});

// ❌ 错误：不必要的 memo（简单组件）
const SimpleText = React.memo(({ text }: { text: string }) => {
  return <span>{text}</span>;
}); // 过度优化
```

#### 避免匿名函数
```tsx
// ✅ 正确：使用 useCallback
const handleClick = useCallback(() => {
  setCount(prev => prev + 1);
}, []);

<Button onClick={handleClick}>增加</Button>

// ❌ 错误：每次渲染创建新函数
<Button onClick={() => setCount(count + 1)}>增加</Button>
```

### 1.4 列表渲染

#### key 属性
```tsx
// ✅ 正确：使用稳定唯一的 key
{tabs.map(tab => (
  <TabCard key={tab.id} tab={tab} />
))}

// ❌ 错误：使用 index 作为 key
{tabs.map((tab, index) => (
  <TabCard key={index} tab={tab} />
))}
```

#### 大列表优化
```tsx
// ✅ 正确：使用虚拟滚动（大列表）
import { List } from 'react-virtualized';

<List
  width={800}
  height={600}
  rowCount={tabs.length}
  rowHeight={50}
  rowRenderer={({ index, key, style }) => (
    <div key={key} style={style}>
      <TabCard tab={tabs[index]} />
    </div>
  )}
/>

// ❌ 错误：渲染 1000+ 个 DOM 节点
{tabs.map(tab => <TabCard key={tab.id} tab={tab} />)}
```

### 1.5 条件渲染

```tsx
// ✅ 正确：使用三元运算符（简单条件）
{isLoading ? <Spin /> : <TabList tabs={tabs} />}

// ✅ 正确：使用 &&（无 else 分支）
{isVisible && <SettingsPanel />}

// ✅ 正确：使用变量存储 JSX（复杂条件）
const content = () => {
  if (isLoading) return <Spin />;
  if (error) return <Alert message={error} />;
  if (tabs.length === 0) return <Empty />;
  return <TabList tabs={tabs} />;
};

return <div>{content}</div>;

// ❌ 错误：复杂的嵌套三元运算符
{isLoading ? <Spin /> : error ? <Alert /> : tabs.length === 0 ? <Empty /> : <TabList />}
```

### 1.6 事件处理

```tsx
// ✅ 正确：使用明确的命名
const handleTabClick = (tabId: string) => { ... };
const handleSearchChange = (value: string) => { ... };
const handleSettingsSubmit = (values: Settings) => { ... };

// ✅ 正确：事件处理函数内联简单逻辑
<Button onClick={() => setVisible(true)}>打开</Button>

// ❌ 错误：事件处理函数包含复杂逻辑
<Button onClick={() => {
  const tabs = await chrome.tabs.query({});
  const filtered = tabs.filter(t => t.url.includes('google'));
  setTabs(filtered);
  setLoading(false);
}}>
  查询
</Button>
```

---

## 2. TypeScript 最佳实践

### 2.1 类型定义

#### 接口 vs 类型别名
```tsx
// ✅ 正确：使用 interface 定义对象形状（可扩展）
interface TabCardProps {
  tab: chrome.tabs.Tab;
  onClose: (tabId: string) => void;
}

// ✅ 正确：使用 type 定义联合类型/交叉类型
type ThemeMode = 'light' | 'dark' | 'auto';
type TabState = 'idle' | 'loading' | 'error';

// ❌ 错误：过度使用 type（无法利用声明合并）
type TabCardProps = {
  tab: chrome.tabs.Tab;
  onClose: (tabId: string) => void;
};
```

#### Props 类型定义
```tsx
// ✅ 正确：使用 interface 定义 Props
interface ButtonProps {
  type?: 'primary' | 'default' | 'dashed';
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ type = 'default', loading = false, onClick, children }) => {
  return (
    <button className={`btn btn-${type}`} onClick={onClick} disabled={loading}>
      {loading && <Spin />}
      {children}
    </button>
  );
};

// ❌ 错误：使用 React.FC（丢失 children 类型信息）
const Button: React.FC<ButtonProps> = (props) => { ... };
```

#### 避免 any
```tsx
// ✅ 正确：使用具体类型
const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);

// ✅ 正确：使用 unknown（需要类型守卫）
const parseData = (data: unknown): TabData | null => {
  if (typeof data === 'object' && data !== null && 'id' in data) {
    return data as TabData;
  }
  return null;
};

// ❌ 错误：使用 any
const [tabs, setTabs] = useState<any[]>([]);
```

### 2.2 泛型使用

```tsx
// ✅ 正确：使用泛型定义可复用组件
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string;
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <div>
      {items.map(item => (
        <div key={keyExtractor(item)}>
          {renderItem(item)}
        </div>
      ))}
    </div>
  );
}

// 使用
<List
  items={tabs}
  renderItem={(tab) => <TabCard tab={tab} />}
  keyExtractor={(tab) => tab.id.toString()}
/>
```

### 2.3 类型导入

```tsx
// ✅ 正确：使用 import type
import type { TabCardProps } from './TabCard';
import type { chrome } from 'chrome';

// ✅ 正确：分离类型和值导入
import { Button } from 'antd';
import type { ButtonProps } from 'antd';

// ❌ 错误：混合导入
import { Button, ButtonProps } from 'antd';
```

---

## 3. Ant Design v6 最佳实践

### 3.1 设计 Token 使用

```less
// ✅ 正确：使用 antd Token
.app-header {
  padding: var(--ant-padding-md);
  margin-bottom: var(--ant-margin-sm);
  background: var(--ant-color-bg-container);
  border-radius: var(--ant-border-radius-lg);
}

// ❌ 错误：硬编码值
.app-header {
  padding: 16px;
  margin-bottom: 8px;
  background: #ffffff;
  border-radius: 8px;
}
```

### 3.2 布局组件使用

```tsx
// ✅ 正确：使用 antd 布局组件（无需额外 CSS）
<Flex align="center" justify="space-between" gap={10}>
  <Typography.Title level={4}>标题</Typography.Title>
  <Space>
    <Button type="primary">保存</Button>
    <Button>取消</Button>
  </Space>
</Flex>

// ✅ 正确：使用 CSS Modules（需要自定义样式时）
// Component.module.less
// .container { padding: 16px; }
import styles from './Component.module.less';
<div className={styles.container}>内容</div>

// ❌ 错误：使用内联 style 对象（性能问题：每次渲染创建新对象）
<div style={{ display: 'flex', alignItems: 'center' }}>
  内容
</div>
```

**性能说明**：
- `style={{}}` 每次渲染创建新对象 → 破坏 `React.memo` 优化
- 应使用 CSS Modules（`className={styles.xxx}`）或 antd 组件属性

### 3.3 组件 props 使用

```tsx
// ✅ 正确：使用 antd 组件的 classNames prop
<Card 
  classNames={{ 
    header: styles.header,
    body: styles.body 
  }}
/>

// ❌ 错误：使用 className 覆盖组件样式
<Card className={styles.card}>
```

### 3.4 禁止的原生 HTML 元素

| 原生元素 | 必须替换为 |
|---------|------------|
| `<button>` | `<Button>` |
| `<h1>` - `<h6>` | `<Typography.Title>` |
| `<p>` | `<Typography.Paragraph>` |
| `<input>` | `<Input>` |
| `<select>` | `<Select>` |
| `<textarea>` | `<Input.TextArea>` |
| `<a>` | `<Typography.Link>` 或 `<Button type="link">` |

---

## 4. 样式管理规范

### 4.1 CSS Modules 使用

```less
// ✅ 正确：使用 CSS Modules（.module.less）
// TabCard.module.less
.container {
  padding: var(--ant-padding-md);
  
  .title {
    color: var(--ant-color-text);
  }
}

// ❌ 错误：使用全局样式
// TabCard.less
.tab-card-container {
  padding: 16px;
}
```

```tsx
// ✅ 正确：导入 CSS Modules
import styles from './TabCard.module.less';

<div className={styles.container}>
  <span className={styles.title}>标题</span>
</div>

// ❌ 错误：使用全局类名
<div className="tab-card-container">
  <span className="title">标题</span>
</div>
```

### 4.2 Less 文件规范

**禁止**：
- ❌ 使用 `display: flex`（应使用 `<Flex>` 组件）
- ❌ 使用 `display: grid`（应使用 `<Row>` + `<Col>`）
- ❌ 使用 `gap` 属性（应使用 `<Flex gap={}>` 或 `<Space size={}>`）
- ❌ 使用 `!important`
- ❌ 硬编码颜色值（必须使用 CSS 变量或设计 Token）

**允许**：
- ✅ 使用 `display: flex` 仅用于微调 antd 组件内部样式（需添加注释说明）
- ✅ 使用 antd 设计 Token（`--ant-*`）进行样式定制

### 4.3 主题适配

```tsx
// ✅ 正确：使用 CSS 变量支持主题切换
.app-container {
  background: var(--ant-color-bg-container);
  color: var(--ant-color-text);
}

// ✅ 正确：使用 data-theme 属性
[data-theme='dark'] {
  .app-container {
    background: var(--ant-color-bg-container-dark);
  }
}

// ❌ 错误：硬编码主题颜色
.app-container {
  background: #ffffff;
  
  [data-theme='dark'] & {
    background: #141414; // 应使用 Token
  }
}
```

---

## 5. 代码组织规范

### 5.1 目录结构

```
src/
├── shared/              # 共享代码
│   ├── ui/            # 公共 UI 组件
│   ├── hooks/         # 公共 Hooks
│   ├── utils/         # 工具函数
│   ├── styles/        # 全局样式
│   └── theme/        # 主题配置
├── features/          # 功能模块
│   ├── tabs/         # Tab 管理功能
│   │   ├── components/   # 功能相关组件
│   │   ├── hooks/        # 功能相关 Hooks
│   │   └── utils/        # 功能相关工具
│   ├── bookmarks/    # 书签功能
│   └── settings/     # 设置功能
├── pages/            # 页面组件
│   ├── newtab/       # 新标签页
│   └── popup/        # 弹出窗口
└── types/            # 全局类型定义
```

### 5.2 组件提取规则

- **公共组件**：必须提取到 `src/shared/ui/` 目录
- **功能组件**：必须提取到 `src/features/<feature>/components/` 目录
- **页面组件**：禁止在页面组件中直接编写复杂组件逻辑

### 5.3 Hook 提取规则

- **公共 Hooks**：必须提取到 `src/shared/hooks/` 目录
- **功能 Hooks**：必须提取到 `src/features/<feature>/hooks/` 目录

---

## 6. 状态管理规范（Zustand）

### 6.1 Store 定义

```tsx
// ✅ 正确：使用 Zustand 定义 Store
import { create } from 'zustand';

interface TabsStore {
  tabs: chrome.tabs.Tab[];
  loading: boolean;
  fetchTabs: () => Promise<void>;
  closeTab: (tabId: number) => Promise<void>;
}

const useTabsStore = create<TabsStore>((set, get) => ({
  tabs: [],
  loading: false,
  
  fetchTabs: async () => {
    set({ loading: true });
    try {
      const tabs = await chrome.tabs.query({});
      set({ tabs, loading: false });
    } catch (error) {
      set({ loading: false });
      console.error('Failed to fetch tabs:', error);
    }
  },
  
  closeTab: async (tabId: number) => {
    await chrome.tabs.remove(tabId);
    set(state => ({
      tabs: state.tabs.filter(tab => tab.id !== tabId)
    }));
  },
}));

export default useTabsStore;
```

### 6.2 Store 使用

```tsx
// ✅ 正确：按需订阅 Store
const tabs = useTabsStore((state) => state.tabs);
const fetchTabs = useTabsStore((state) => state.fetchTabs);

// ✅ 正确：使用 shallow 比较（避免不必要渲染）
import { shallow } from 'zustand/shallow';

const { tabs, loading } = useTabsStore(
  (state) => ({ tabs: state.tabs, loading: state.loading }),
  shallow
);

// ❌ 错误：订阅整个 Store
const store = useTabsStore(); // 任何状态变化都会触发重渲染
```

---

## 7. 异步处理规范

### 7.1 Chrome API 调用

```tsx
// ✅ 正确：封装 Chrome API 调用
const useChromeTabs = () => {
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTabs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await chrome.tabs.query({});
      setTabs(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  return { tabs, loading, error, fetchTabs };
};

// ❌ 错误：直接在组件中调用 Chrome API
const TabList = () => {
  const [tabs, setTabs] = useState([]);
  
  useEffect(() => {
    chrome.tabs.query({}, (result) => {
      setTabs(result);
    });
  }, []);
  
  return <div>{/* ... */}</div>;
};
```

### 7.2 错误处理

```tsx
// ✅ 正确：统一的错误处理
const useAsyncTask = <T,>(
  task: () => Promise<T>,
  options: { onSuccess?: (data: T) => void; onError?: (error: Error) => void } = {}
) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await task();
      options.onSuccess?.(data);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      options.onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [task, options.onSuccess, options.onError]);

  return { execute, loading, error };
};

// 使用
const { execute, loading, error } = useAsyncTask(
  () => chrome.tabs.query({}),
  {
    onSuccess: (tabs) => console.log('Fetched', tabs.length, 'tabs'),
    onError: (error) => message.error(error.message),
  }
);
```

---

## 8. 测试规范

### 8.1 单元测试

```tsx
// ✅ 正确：使用 Vitest + React Testing Library
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TabCard from './TabCard';

describe('TabCard', () => {
  it('should render tab title', () => {
    const tab = { id: 1, title: 'Google', url: 'https://google.com' };
    render(<TabCard tab={tab} onClose={vi.fn()} />);
    
    expect(screen.getByText('Google')).toBeInTheDocument();
  });

  it('should call onClose when close button clicked', () => {
    const tab = { id: 1, title: 'Google', url: 'https://google.com' };
    const onClose = vi.fn();
    render(<TabCard tab={tab} onClose={onClose} />);
    
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledWith('1');
  });
});
```

### 8.2 测试覆盖

- 公共组件必须有单元测试
- Hooks 必须有单元测试
- 工具函数必须有单元测试
- 目标覆盖率：≥ 80%

---

## 9. 构建验证规范

### 9.1 提交前必须验证

```bash
# TypeScript 类型检查
npm run type-check

# 构建验证
npm run build

# 单元测试
npm run test

# Lint 检查
npm run lint
```

### 9.2 禁止提交

- ❌ TypeScript 类型错误
- ❌ 构建失败
- ❌ 单元测试失败
- ❌ Lint 错误

---

## 10. 重构优先级

当发现违反上述规范的代码时，按以下优先级进行重构：

| 优先级 | 范围 | 示例 |
|-------|------|------|
| **P0** | 用户直接使用的视图 | Tab 视图、书签视图、设置面板 |
| **P1** | 功能和侧边栏 | 历史面板、Arc 侧边栏、搜索框 |
| **P2** | 辅助功能 | 开发者工具、洞察页面 |

---

## 11. 例外情况

以下情况可以申请例外（需在代码中添加 `// eslint-disable-next-line` 并说明原因）：

1. **第三方组件内部样式调整**：如果必须调整第三方组件的样式，且无法通过 antd 组件实现
2. **性能敏感场景**：如果频繁重新渲染的组件，使用 antd 组件可能带来额外的性能开销（需通过性能测试验证）
3. **浏览器兼容性**：如果需要支持旧版浏览器，可能需要降级使用某些 API

---

## 参考资料

- [React 官方文档](https://react.dev/learn)
- [TypeScript 官方文档](https://www.typescriptlang.org/docs/)
- [Ant Design v6 官方文档](https://ant.design/docs/react/introduce)
- [Zustand 官方文档](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro)

---

**本规范适用于 GroveTab 项目所有新代码和重构代码。**
