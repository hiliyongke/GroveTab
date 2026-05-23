/**
 * Workspace 视图模式
 *
 * 控制主内容区的视图切换：
 *   - 'domain'      ：按域名分组视图
 *   - 'timeline'   ：时间轴视图
 *   - 'compact'    ：紧凑列表视图
 *   - 'grid'       ：网格视图
 *   - 'frequency'   ：使用频率视图
 *   - 'tabgroup'   ：标签页分组视图
 *   - 'window'     ：窗口视图'
 *   - 'bookmarks'  ：书签视图'
 *   - 'kanban'     ：看板视图'
 *   - 'archive'    ：归档视图'
 */
export type ViewMode =
  | 'domain'
  | 'timeline'
  | 'compact'
  | 'grid'
  | 'frequency'
  | 'tabgroup'
  | 'window'
  | 'bookmarks'
  | 'kanban'
  | 'archive';
