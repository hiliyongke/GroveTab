import type {
  DashboardWidgetLayoutItem,
  DashboardWidgetType,
  SpeedDialGroup,
  CountdownEntry,
  TodoEntry,
  StickyNoteEntry,
} from '@/shared/types';

export const DASHBOARD_GRID_COLUMNS = 12;
export const DASHBOARD_ROW_HEIGHT = 88;
export const DASHBOARD_GAP = 12;
export const DASHBOARD_MIN_ITEM_W = 2;
export const DASHBOARD_MAX_ITEM_W = 12;
export const DASHBOARD_MIN_ITEM_H = 2;
export const DASHBOARD_MAX_ITEM_H = 6;

export interface WidgetDefinition {
  type: DashboardWidgetType;
  title: string;
  defaultSize: { w: number; h: number };
  description: string;
}

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  { type: 'clock', title: '时钟', defaultSize: { w: 3, h: 2 }, description: '显示当前时间与日期' },
  { type: 'weather', title: '天气', defaultSize: { w: 3, h: 2 }, description: '显示当前位置天气与温度' },
  { type: 'calendar', title: '日历', defaultSize: { w: 3, h: 2 }, description: '显示今天日期、节日与农历' },
  { type: 'workCountdown', title: '距离下班', defaultSize: { w: 3, h: 2 }, description: '打工人必备，下班倒计时' },
  { type: 'speedDial', title: '常用网站', defaultSize: { w: 6, h: 3 }, description: '按分组管理高频网站入口' },
  { type: 'countdown', title: '纪念日', defaultSize: { w: 3, h: 3 }, description: '纪念日、DDL、旅行倒计时' },
  { type: 'pomodoro', title: '番茄钟', defaultSize: { w: 3, h: 3 }, description: '专注计时与休息节奏' },
  { type: 'todo', title: '待办', defaultSize: { w: 4, h: 3 }, description: '轻量待办清单' },
  { type: 'sticky', title: '便签', defaultSize: { w: 4, h: 3 }, description: '随手记录灵感和备忘' },
  { type: 'dailyQuote', title: '金句', defaultSize: { w: 4, h: 3 }, description: '支持自定义导入的每日金句' },
  { type: 'searchBox', title: '极速搜索', defaultSize: { w: 6, h: 2 }, description: '多引擎快速搜索盒子' },
  { type: 'waterReminder', title: '喝水打卡', defaultSize: { w: 3, h: 2 }, description: '每天 8 杯水，记录饮水进度' },
  { type: 'habitTracker', title: '习惯打卡', defaultSize: { w: 4, h: 3 }, description: '每日习惯追踪，查看连续与累计天数' },
  { type: 'timestampTool', title: '时间戳', defaultSize: { w: 4, h: 2 }, description: '极客必备，时间戳与日期互转' },
  { type: 'jsonFormatter', title: 'JSON 格式化', defaultSize: { w: 6, h: 4 }, description: '极客必备，粘贴即格式化' },
  { type: 'networkInfo', title: '网络状态', defaultSize: { w: 3, h: 2 }, description: '显示在线状态、连接类型与浏览器信息' },
];

export function getWidgetDefinition(type: DashboardWidgetType): WidgetDefinition {
  return WIDGET_DEFINITIONS.find((item) => item.type === type) ?? WIDGET_DEFINITIONS[0];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeLayoutItem(
  item: DashboardWidgetLayoutItem,
  columns: number = DASHBOARD_GRID_COLUMNS,
): DashboardWidgetLayoutItem {
  const normalizedColumns = Math.max(1, Math.floor(columns));
  const minW = Math.min(DASHBOARD_MIN_ITEM_W, normalizedColumns);
  const maxW = Math.max(minW, Math.min(DASHBOARD_MAX_ITEM_W, normalizedColumns));
  const w = clamp(item.w, minW, maxW);
  return {
    ...item,
    x: clamp(item.x, 0, normalizedColumns - w),
    y: Math.max(0, item.y),
    w,
    h: clamp(item.h, DASHBOARD_MIN_ITEM_H, DASHBOARD_MAX_ITEM_H),
  };
}

export function getDefaultSpeedDialGroups(): SpeedDialGroup[] {
  return [
    {
      id: 'work',
      name: '工作',
      links: [
        { id: 'work-github', title: 'GitHub', url: 'https://github.com', emoji: '🐙', color: '#24292f' },
        { id: 'work-figma', title: 'Figma', url: 'https://www.figma.com', emoji: '🎨', color: '#f24e1e' },
      ],
    },
    {
      id: 'life',
      name: '生活',
      links: [
        { id: 'life-bilibili', title: 'Bilibili', url: 'https://www.bilibili.com', emoji: '📺', color: '#00a1d6' },
      ],
    },
  ];
}

export function getDefaultCountdownItems(): CountdownEntry[] {
  return [
    { id: 'countdown-launch', title: '项目上线纪念', targetDate: '2026-06-01', emoji: '🚀', color: '#1677ff' },
    { id: 'countdown-vacation', title: '下一次旅行', targetDate: '2026-10-01', emoji: '🏕️', color: '#52c41a' },
  ];
}

export function getDefaultTodoItems(): TodoEntry[] {
  return [
    { id: 'todo-1', text: '清理待关闭标签页', done: false },
    { id: 'todo-2', text: '补一版周报', done: false },
    { id: 'todo-3', text: '下班前同步进度', done: true },
  ];
}

export function getDefaultStickyNotes(): StickyNoteEntry[] {
  return [
    {
      id: 'sticky-1',
      title: '灵感速记',
      content: '把真正高频使用的小工具放到顶部，主内容区保持专注。',
      color: '#fff7e6',
    },
  ];
}
