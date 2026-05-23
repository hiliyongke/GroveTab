/**
 * OG 索引相关类型 (F-24)
 *
 * 缓存网页的 Open Graph 元数据（title / description），
 * 用于「常用站点」卡片悬停时展示页面预览信息。
 * 数据由 SW 在空闲时抓取并写入 IndexedDB。
 */

/** 单条 OG 缓存记录 */
export interface OgEntry {
  /** 页面 URL（作为主键） */
  url: string;
  /** 页面 OG 标题（回退到 <title>） */
  title: string;
  /** 页面 OG 描述（截断到 300 字符） */
  description: string;
  /** 抓取时间戳（ms），用于判断缓存是否过期 */
  fetchedAt: number;
}
