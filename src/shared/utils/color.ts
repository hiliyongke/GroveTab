/**
 * Color utilities —— 分组标识色
 *
 * 方案（2026-04-22 水彩版 · 第三次迭代）：
 *   - 色相池扩大到 **20 色**，覆盖色相圆更均匀，减少撞色循环
 *   - 参数调整到水彩风（S 0.48 / L 0.68），与 antd 极简白底调性匹配
 *   - 同一域名永远映射到同一色相，便于记忆
 *   - 同色相下可用明度抖动区分（见 favicon-color.ts 的 lShift 参数）
 */

import { buildAccentFromHue, type Accent } from './favicon-color';

/**
 * 水彩色相池（单位：度，HSL 色相环位置）
 *
 * 挑选原则：
 *   - 20 个色相均匀分布在色相圆上（平均间隔 18°），最大化相邻差异
 *   - 剔除 45°-55° 的土黄段（S=0.48 下仍显脏）
 *   - 剔除 85°-95° 的黄绿段（白底对比度低）
 *   - 色相顺序打乱，避免哈希落到相邻桶时视觉渐进
 *
 * 理论最多支撑 20 种"无冲突"身份色；超过时由 `useGroupAccents`
 * 的批次去重算法 + 明度抖动做二次分配。
 */
const PALETTE_HUES = [
  0,    // 红
  350,  // 玫红
  328,  // 品红
  310,  // 紫红
  290,  // 紫
  265,  // 紫罗兰
  245,  // 靛
  220,  // 宝蓝
  200,  // 天蓝
  185,  // 青
  170,  // 蓝绿
  150,  // 薄荷
  130,  // 草绿
  110,  // 嫩绿
  70,   // 橄榄黄
  35,   // 橙
  20,   // 橘红
  10,   // 朱红
  255,  // 靛蓝补位
  160,  // 绿松石补位
] as const;

/**
 * 稳定字符串哈希（DJB2 变体）
 *
 * 同一输入总是得到同一输出，用于稳定映射到色相池索引。
 *
 * @param str 输入字符串
 * @returns 非负整数哈希值
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * 色键规范化 —— 保证"同一组织/同一网段"映射到同一色。
 *
 * tldts 已经能把公网和大多数内网自建 TLD（.local/.internal/.corp 等）收敛到注册域，
 * 例如：
 *   - `docs.google.com` / `mail.google.com` → `google.com`
 *   - `a.app.corp.local` / `b.app.corp.local` → `corp.local`
 *   - `a.b.c.company.internal` → `company.internal`
 *
 * 本函数在此基础上再做两类兜底：
 *   1. **IPv4 地址** → 按 `/24` 段归一（`10.0.1.5` → `10.0.1`），
 *      一台物理机上的多端口服务、同网段容器被视为一组。
 *   2. **端口号 / 协议** → 统一剥除，避免 `host:3000` 与 `host:8080` 分色。
 *
 * 公网域名 / 已收敛到注册域的内网域名走原串。
 *
 * @param raw - 原始域名或 URL 字符串
 * @returns 规范化后的色键字符串
 */
function normalizeColorKey(raw: string): string {
  if (!raw) return 'other';
  // 剥协议和路径
  let key = raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  // 剥端口
  key = key.replace(/:\d+$/, '').toLowerCase();
  // IPv4 归一到 /24
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const m = ipv4.exec(key);
  if (m) {
    return `${m[1]}.${m[2]}.${m[3]}.*`;
  }
  return key;
}

/**
 * 从水彩色相池中为字符串选一个色相（稳定哈希）
 *
 * 基于字符串的哈希值，从 20 色的 PALETTE_HUES 中选取一个色相。
 *
 * @param str 输入字符串（通常是域名或分组键）
 * @returns HSL 色相值（0-360）
 */
function stringToDopamineHue(str: string): number {
  const idx = hashString(normalizeColorKey(str)) % PALETTE_HUES.length;
  return PALETTE_HUES[idx] ?? 0;
}

/**
 * 基于字符串生成稳定 HSL 颜色（向后兼容）
 *
 * 已改用 20 水彩色相池 + 中饱和度（S=0.48）/ 中亮度（L=0.68）。
 *
 * @param str 输入字符串
 * @returns HSL 颜色字符串（如 "hsl(220, 48%, 68%)"）
 */
export function stringToColor(str: string): string {
  return `hsl(${stringToDopamineHue(str)}, 48%, 68%)`;
}

/**
 * 将 HEX 色值按指定比例暗化
 *
 * 支持格式：3 位简写（#fff）、6 位（#ffffff）、8 位（#ffffffaa，忽略 alpha）。
 * ratio 范围 0~1，1 表示完全变黑。
 *
 * @param hex   HEX 颜色字符串
 * @param ratio 暗化比例（0-1）
 * @returns 暗化后的 HEX 字符串
 */
export function darkenHex(hex: string, ratio: number): string {
  // 移除 # 前缀
  let h = hex.replace('#', '');

  // 处理 3 位简写（如 #fff → #ffffff）
  if (h.length === 3) {
    h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  }

  // 处理 8 位 hex（带 alpha），忽略 alpha 部分
  if (h.length === 8) {
    h = h.slice(0, 6);
  }

  // 校验长度，无法解析时返回原值
  if (h.length !== 6) {
    return hex;
  }

  const r = Math.round(parseInt(h.slice(0, 2), 16) * (1 - ratio));
  const g = Math.round(parseInt(h.slice(2, 4), 16) * (1 - ratio));
  const b = Math.round(parseInt(h.slice(4, 6), 16) * (1 - ratio));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * 从 rgba 字符串中解析 alpha 通道值
 *
 * @param rgba rgba 颜色字符串（如 "rgba(255,0,0,0.5)"）
 * @returns alpha 值（0-1），解析失败返回 0.35
 */
export function parseAlpha(rgba: string): number {
  const match = /[\d.]+(?=\))/.exec(rgba);
  return match ? parseFloat(match[0]) : 0.35;
}

/**
 * HEX 颜色 + alpha 透明度 → rgba 字符串
 *
 * @param hex   HEX 颜色字符串（支持 3/6 位）
 * @param alpha 透明度（0-1）
 * @returns rgba 颜色字符串
 */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * 基于字符串生成一套稳定的"分组身份色"Accent：
 *   - bar/soft/text：老字段，向后兼容（主色 / 柔光 / 文字）
 *   - barLight、barDark：浅/深色主题下的身份色变体，业务层根据主题模式选
 *
 * 2026-04-22 起从水彩 20 色相池取色——柔和可辨，与 antd 极简风格协调。
 *
 * @param str 输入字符串（通常是域名或分组键）
 * @returns 包含多种变体的 Accent 对象
 */
export function stringToAccent(str: string): Accent {
  return buildAccentFromHue(stringToDopamineHue(str));
}
