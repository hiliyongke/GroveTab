/**
 * 语义化图标颜色工具
 *
 * 将图标按功能语义映射到 antd 设计令牌色阶，
 * 避免全站统一灰色导致视觉单调。
 *
 * 使用方式：
 *   import { iconColor } from '@/shared/utils/icon-colors';
 *   <SearchOutlined style={{ color: iconColor.search(token) }} />
 *
 * 原则：
 *   1. 主操作（搜索/归档）用主色或品牌色
 *   2. 状态类（成功/警告/危险）对应语义色
 *   3. 指标类（标签数/域名/窗口）用区分度高的功能色
 *   4. 所有颜色均从 token 派生，自动跟随主题切换
 */

import type { GlobalToken } from 'antd';

/** 语义化图标角色 */
export type IconRole =
  | 'search'        // 搜索 —— 品牌蓝
  | 'archive'       // 归档 —— 紫色
  | 'settings'      // 设置 —— 中性灰
  | 'theme'         // 主题切换 —— 金橙（太阳感）
  | 'tabs'          // 标签页计数 —— 蓝色
  | 'domains'       // 域名计数 —— 绿色
  | 'windows'       // 窗口计数 —— 青色
  | 'duplicates'    // 重复标签 —— 橙色（警告向）
  | 'idle'          // 闲置 —— 琥珀
  | 'sessions'      // 归档会话 —— 紫
  | 'tab'           // 标签页项 —— 蓝
  | 'history'       // 历史 —— 绿
  | 'web'           // 网页搜索 —— 蓝
  | 'suggestion'    // 建议 —— 紫
  | 'hot'           // 热门 —— 红/橙
  | 'recent'        // 最近 —— 青
  | 'permission'    // 权限 —— 橙
  | 'close'         // 关闭 —— 危险红
  | 'discard'       // 休眠 —— 灰蓝
  | 'success'       // 成功 —— 绿
  | 'warning'       // 警告 —— 橙
  | 'error'         // 错误 —— 红
  | 'info'          // 信息 —— 蓝
  | 'tidy'          // 整理 —— 金
  | 'select'        // 多选 —— 主色
  | 'pin'           // 固定 —— 金
  | 'bookmark'      // 书签 —— 黄
  | 'splitScreen';  // 分屏 —— 紫

/**
 * 根据角色返回图标颜色（hex）。
 *
 * 所有颜色都从 antd token 派生，深浅主题自动适配。
 */
export function iconColor(role: IconRole, token: GlobalToken): string {
  const map: Record<IconRole, string> = {
    search:     token.colorPrimary,
    archive:    '#7c3aed',          // 紫色
    settings:   token.colorTextSecondary,
    theme:      '#f59e0b',          // 金橙色（呼应太阳）
    tabs:       token.colorPrimary,
    domains:    '#10b981',          // 翠绿
    windows:    '#06b6d4',          // 青
    duplicates: '#f97316',          // 橙（警告感）
    idle:       '#d97706',          // 琥珀
    sessions:   '#8b5cf6',          // 淡紫
    tab:        token.colorPrimary,
    history:    '#059669',          // 深绿
    web:        '#3b82f6',          // 亮蓝
    suggestion: '#a855f7',          // 紫罗兰
    hot:        '#ef4444',          // 红（热度）
    recent:     '#14b8a6',          // 青
    permission: '#ea580c',          // 深橙
    close:      token.colorError,
    discard:    '#64748b',          // 石板灰蓝
    success:    token.colorSuccess,
    warning:    token.colorWarning,
    error:      token.colorError,
    info:       token.colorInfo,
    tidy:       '#eab308',          // 金黄
    select:     token.colorPrimary,
    pin:        '#f59e0b',          // 金
    bookmark:   '#eab308',          // 金黄（书签隐喻）
    splitScreen:'#8b5cf6',          // 紫
  };
  return map[role];
}

/**
 * 返回带透明度的图标颜色（用于背景、弱装饰等场景）。
 *
 * @param role 图标角色
 * @param token antd 全局设计令牌
 * @param opacity 透明度 0~1，默认 0.15
 */
export function iconColorAlpha(role: IconRole, token: GlobalToken, opacity = 0.15): string {
  const hex = iconColor(role, token);
  // hex → rgba
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
