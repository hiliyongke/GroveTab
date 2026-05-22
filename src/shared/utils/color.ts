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
 * 稳定字符串哈希
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
 */
function stringToDopamineHue(str: string): number {
  const idx = hashString(normalizeColorKey(str)) % PALETTE_HUES.length;
  return PALETTE_HUES[idx];
}

/**
 * 基于字符串生成稳定 HSL 颜色（向后兼容；已用水彩色相+中饱和度）
 */
export function stringToColor(str: string): string {
  return `hsl(${stringToDopamineHue(str)}, 48%, 68%)`;
}

/**
 * 基于字符串生成一套稳定的"分组身份色"Accent：
 *   - bar/soft/text：老字段，向后兼容（主色 / 柔光 / 文字）
 *   - barLight、barDark：浅/深色主题下的身份色变体，业务层根据主题模式选
 *
 * 2026-04-22 起从水彩 20 色相池取色——柔和可辨，与 antd 极简风格协调。
 */
export function stringToAccent(str: string): Accent {
  return buildAccentFromHue(stringToDopamineHue(str));
}
