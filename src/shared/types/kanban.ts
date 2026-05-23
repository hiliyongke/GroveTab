/**
 * 看板相关类型 (F-20)
 *
 * 看板模式将标签按用户自定义列组织，
 * 每列相当于一个"分组"，卡片可在列间拖拽。
 */

/** 看板中的单张卡片（对应一个标签页） */
export interface KanbanCard {
  /** 标签页 URL（用作唯一标识与恢复入口） */
  url: string;
  /** 页面标题（截断到 200 字符） */
  title: string;
  /** 网站图标 URL（可选，无则 UI 展示域名首字母） */
  favIconUrl?: string;
  /** 添加到看板的时间戳（ms），用于排序 */
  addedAt: number;
}

/** 看板中的一列 */
export interface KanbanColumn {
  /** 列唯一标识 */
  id: string;
  /** 列名称（如"工作"、"待读"） */
  name: string;
  /** 列左侧色条颜色（CSS 色值，可选） */
  color?: string;
  /** 该列下的卡片列表 */
  cards: KanbanCard[];
}

/** 看板整体布局（持久化到 chrome.storage） */
export interface KanbanLayout {
  /** 所有列的排序与内容 */
  columns: KanbanColumn[];
  /** 最后更新时间戳（ms），用于跨设备同步时的版本比较 */
  updatedAt: number;
}
