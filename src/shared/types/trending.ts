/**
 * Trending Type Definitions
 * 热榜聚合相关类型 (v1.4)
 */

/** 热榜平台分类 */
export type TrendingCategory = 'all' | 'comprehensive' | 'tech' | 'entertainment' | 'community' | 'news';

/** 热榜布局模式 */
export type TrendingGroupMode = 'default' | 'compact';

/** 单条热榜条目（标准化后的通用格式） */
export interface TrendingItem {
  /** 条目唯一标识 */
  id: string;
  /** 标题 */
  title: string;
  /** 简介/描述 */
  desc?: string;
  /** 封面图 */
  pic?: string;
  /** 热度值 */
  hot?: number;
  /** 可读的热度文字（如 "1234万"） */
  hotLabel?: string;
  /** PC 端链接 */
  url: string;
  /** 移动端链接 */
  mobileUrl?: string;
  /** 作者/UP主信息 */
  author?: string;
}

/** 单个平台的榜单数据 */
export interface HotBoardData {
  /** 平台调用名称（如 'bilibili'） */
  id: string;
  /** 平台中文名 */
  name: string;
  /** 榜单类别 */
  subtitle?: string;
  /** 分类标签 */
  category: TrendingCategory;
  /** 榜单条目列表 */
  items: TrendingItem[];
  /** 数据获取时间 */
  updateTime?: string;
  /** 数据来源标识 */
  from?: 'dailyhot' | 'pearktrue' | 'xcvts' | 'cache';
}

/** 热榜缓存整体结构 */
export interface TrendingCache {
  /** 按平台 id 索引的榜单数据 */
  boards: Record<string, HotBoardData>;
  /** 最近一次全量刷新时间 */
  lastRefreshAt: number;
}
