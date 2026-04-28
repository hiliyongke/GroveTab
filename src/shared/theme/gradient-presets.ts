/**
 * 渐变背景预设配置
 *
 * 集中定义所有预设的色值和元信息，供 SettingsPanel 和 App.tsx 共用。
 * 每个预设包含 light / dark 两套渐变，运行期按 resolvedTheme 自动切换。
 *
 * 纪律：
 *   - 预设 ID 必须与 UserSettings.gradientPreset 联合类型一一对应
 *   - 渐变色值用 CSS linear-gradient 语法，App.tsx 直接消费
 *   - colors 字段用于设置面板的色卡渲染
 *   - compatibleMode 标注该预设的最佳适用模式，用于设置面板角标
 */

export type GradientPresetId =
  | 'default'
  | 'slate'
  | 'warm'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'deepspace'
  | 'midnight'
  | 'custom';

export interface GradientPreset {
  id: GradientPresetId;
  /** i18n key 前缀，如 gradient.slate → t('gradient.slate') */
  labelKey: string;
  /** 浅色模式渐变 CSS */
  light: string;
  /** 深色模式渐变 CSS */
  dark: string;
  /** 色卡渲染用的色值数组（浅色版本） */
  colors: string[];
  /** 该预设的推荐模式：'both' 双模皆宜 / 'light' 浅色优先 / 'dark' 深色优先 */
  compatibleMode: 'both' | 'light' | 'dark';
}

/**
 * 全部预设配置（顺序即设置面板展示顺序）
 *
 * 设计原则：
 *   - default / slate / warm：浅色系，白底环境最自然
 *   - ocean / forest / sunset：中等饱和，双模自适应
 *   - deepspace / midnight：深色系，暗底环境最舒适
 *   - custom：占位，暂未开放编辑器
 */
export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: 'default',
    labelKey: 'gradient.default',
    light: 'var(--ant-color-bg-layout)',
    dark: 'var(--ant-color-bg-layout)',
    colors: ['#ffffff', '#f5f5f5', '#e8e8e8'],
    compatibleMode: 'both',
  },
  {
    id: 'slate',
    labelKey: 'gradient.slate',
    light: 'linear-gradient(135deg, #f1f5f9, #e2e8f0, #cbd5e1)',
    dark: 'linear-gradient(135deg, #050505, #000000, #0a0a0a)',
    colors: ['#f1f5f9', '#e2e8f0', '#cbd5e1'],
    compatibleMode: 'light',
  },
  {
    id: 'warm',
    labelKey: 'gradient.warm',
    light: 'linear-gradient(135deg, #fafaf9, #f5f0eb, #e7e5e4)',
    dark: 'linear-gradient(135deg, #292524, #1c1917, #0c0a09)',
    colors: ['#fafaf9', '#f5f0eb', '#e7e5e4'],
    compatibleMode: 'light',
  },
  {
    id: 'ocean',
    labelKey: 'gradient.ocean',
    light: 'linear-gradient(135deg, #ecfeff, #cffafe, #a5f3fc)',
    dark: 'linear-gradient(135deg, #164e63, #0e4c5e, #083344)',
    colors: ['#ecfeff', '#cffafe', '#a5f3fc'],
    compatibleMode: 'both',
  },
  {
    id: 'forest',
    labelKey: 'gradient.forest',
    light: 'linear-gradient(135deg, #f0fdf4, #dcfce7, #bbf7d0)',
    dark: 'linear-gradient(135deg, #14532d, #052e16, #022c22)',
    colors: ['#f0fdf4', '#dcfce7', '#bbf7d0'],
    compatibleMode: 'both',
  },
  {
    id: 'sunset',
    labelKey: 'gradient.sunset',
    light: 'linear-gradient(135deg, #fef3c7, #fde68a, #fcd34d)',
    dark: 'linear-gradient(135deg, #3d2c1e, #2e2218, #1e1510)',
    colors: ['#fef3c7', '#fde68a', '#fcd34d'],
    compatibleMode: 'both',
  },
  {
    id: 'deepspace',
    labelKey: 'gradient.deepspace',
    light: 'linear-gradient(135deg, #e2e8f0, #94a3b8, #64748b)',
    dark: 'linear-gradient(135deg, #0F2027, #203A43, #2C5364)',
    colors: ['#0F2027', '#203A43', '#2C5364'],
    compatibleMode: 'dark',
  },
  {
    id: 'midnight',
    labelKey: 'gradient.midnight',
    light: 'linear-gradient(135deg, #dde0f0, #c5c9e0, #aeb3d0)',
    dark: 'linear-gradient(135deg, #1a1a2e, #252540, #1a1a2e)',
    colors: ['#1e1b4b', '#312e81', '#1e1b4b'],
    compatibleMode: 'dark',
  },
  {
    id: 'custom',
    labelKey: 'gradient.custom',
    light: 'var(--ant-color-bg-layout)',
    dark: 'var(--ant-color-bg-layout)',
    colors: ['#888888', '#666666', '#444444'],
    compatibleMode: 'both',
  },
];

/**
 * 将色标数组 + 角度拼接成 CSS linear-gradient 字符串
 */
export function buildGradient(stops: Array<{ color: string; position: number }>, angle: number): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const colorStops = sorted.map((s) => `${s.color} ${Math.round(s.position * 100)}%`).join(', ');
  return `linear-gradient(${angle}deg, ${colorStops})`;
}

/** 根据 ID 和当前模式快速查找渐变 CSS */
export function resolveGradient(id: GradientPresetId, isDark: boolean, customGradient?: { stops: Array<{ color: string; position: number }>; angle: number; darkStops?: Array<{ color: string; position: number }>; darkAngle?: number }): string {
  if (id === 'custom' && customGradient) {
    const stops = (isDark && customGradient.darkStops) ? customGradient.darkStops : customGradient.stops;
    const angle = (isDark && customGradient.darkAngle != null) ? customGradient.darkAngle : customGradient.angle;
    return buildGradient(stops, angle);
  }
  const preset = GRADIENT_PRESETS.find((p) => p.id === id);
  if (!preset) return 'var(--ant-color-bg-layout)';
  return isDark ? preset.dark : preset.light;
}
