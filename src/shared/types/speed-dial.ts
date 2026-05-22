/**
 * Speed Dial Type Definitions
 * 常用站点相关类型 (v1.4)
 */

/** 常用站点条目 */
export interface SpeedDialSite {
  /** 唯一标识 */
  id: string;
  /** 站点 URL */
  url: string;
  /** 站点标题 */
  title: string;
  /** favicon URL */
  favIconUrl?: string;
  /** 排序权重（越小越靠前） */
  order: number;
  /** 创建时间 */
  createdAt: number;
  /** 所属分组名称，不设则为「未分组」 */
  group?: string;
}
