/**
 * Favicon 取色 —— 从网站图标提取主色
 *
 * 背景：
 *   `stringToAccent` 基于 10 色哈希循环，域名一多必然撞色。
 *   改从 favicon 像素中取"众数色"，天然做到每个站点色相独立。
 *
 * 算法（简单但够用）：
 *   1. 用 `<img>` 加载 favicon，同源则可直接画 canvas（Chrome `_favicon/` 是同源）
 *   2. 画到 16×16 小 canvas，逐像素采样
 *   3. 排除：透明像素 / 近白（RGB 均 > 240）/ 近黑（RGB 均 < 20）/ 灰（饱和度 < 0.15）
 *   4. 将 RGB 各降到 4-bit（共 4096 桶）做众数统计，取出现最多的桶作主色
 *   5. 回写一套 `{ bar, soft, text }`
 *
 * 性能：
 *   - 全局 Map 缓存（以 faviconUrl 为 key），同一图标只采一次
 *   - 失败（跨域 / 加载超时 / 无 favicon）→ 回退 null，由调用方用哈希色兜底
 */

export interface Accent {
  /**
   * 主色（中高饱和、亮度中等）
   * 用于 Tag、Badge 等明确需要"强调色"的场景
   */
  bar: string;
  /**
   * 标签色 · 浅色主题（2026-04-22 水彩版）
   * 中低饱和（~0.48）+ 中高亮度（~0.68）—— 白底细色条上柔和不刺眼、与 antd 极简灰阶风格协调
   */
  barLight: string;
  /**
   * 标签色 · 深色主题（2026-04-22 水彩版）
   * 中饱和（~0.55）+ 中亮度（~0.62）—— 暗底上可辨但不闪亮
   */
  barDark: string;
  /** 弱背景（barLight + 18% 透明度，柔和地衬托 favicon 徽章） */
  soft: string;
  /** 同色系文字色 */
  text: string;
}

/** faviconUrl → Accent 结果（或 null 代表已确认取色失败，不再重试） */
const cache = new Map<string, Accent | null>();

/** 正在加载中的 Promise，用于并发复用 */
const pending = new Map<string, Promise<Accent | null>>();

/**
 * 判断 URL 是否与当前页面同源
 *
 * 扩展自身的 `chrome-extension://<id>/_favicon/...` 与 newtab 页同源 → true。
 * 远程站点的 favicon（https://example.com/favicon.ico）→ false。
 * data: / blob: 也视为同源（canvas 可安全读取）。
 */
function isSameOriginUrl(url: string): boolean {
  try {
    // 协议 data:/blob: 天然可在 canvas 里使用
    if (url.startsWith('data:') || url.startsWith('blob:')) return true;
    const parsed = new URL(url, window.location.href);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * 把 RGB → HSL 的饱和度（仅需 S，用于过滤灰色）
 */
function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return 0;
  return l > 127.5 ? d / (510 - max - min) : d / (max + min);
}

/**
 * 从 canvas 像素数据中提取主色
 * @returns [r, g, b] 或 null（全是灰/透明像素）
 */
function extractDominantColor(imageData: ImageData): [number, number, number] | null {
  const { data } = imageData;
  /** 桶频次统计：key = (r4<<8)|(g4<<4)|b4（r4 g4 b4 各 4-bit） */
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    // 过滤：透明、近白、近黑、灰
    if (a < 128) continue;
    if (r > 240 && g > 240 && b > 240) continue;
    if (r < 20 && g < 20 && b < 20) continue;
    if (saturation(r, g, b) < 0.15) continue;

    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  if (buckets.size === 0) return null;

  // 取 count 最大的桶
  let top: { count: number; r: number; g: number; b: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!top || bucket.count > top.count) top = bucket;
  }
  if (!top) return null;

  return [Math.round(top.r / top.count), Math.round(top.g / top.count), Math.round(top.b / top.count)];
}

/**
 * 把 RGB 转到 HSL，返回 [h(0-360), s(0-1), l(0-1)]
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
        break;
      case gn:
        h = ((bn - rn) / d + 2) * 60;
        break;
      default:
        h = ((rn - gn) / d + 4) * 60;
    }
  }
  return [h, s, l];
}

/**
 * HSL → RGB 三元组
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  return [
    Math.round(hue2rgb(p, q, hk + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hk) * 255),
    Math.round(hue2rgb(p, q, hk - 1 / 3) * 255),
  ];
}

/**
 * 基于同一色相（hue）生成 Accent 的多套变体
 *
 * **2026-04-22 水彩版（watercolor palette）——第三次迭代**：
 *
 * 历史教训：
 *   1. 初版克制路线（S 0.42 / L 0.45）→ 白底上对比度不够，用户说"看不清"
 *   2. 多巴胺路线（S 0.85 / L 0.58）→ 跟 antd 极简白底风格撕裂，刺眼
 *   3. 现在的水彩路线：S 0.48 / L 0.68 —— 柔和但可辨，与整体 UI 调性匹配
 *
 * 设计直觉：
 *   - antd 的视觉语言是"白底 + 细灰线 + 小圆角"的文档风，色彩应服务于 UI 而非压过它
 *   - 色条不是"装饰"，是"身份标签"——就像 GitHub issue label，柔和但清晰
 *   - 通过**色相 + 明度抖动**双维度区分，即便相邻两卡色相接近，也能通过亮度细差区分
 *
 * - bar：中饱和中亮（通用强调色，给 Tag/徽章用）
 * - barLight：**水彩色**，浅色主题下的身份色（柔和不喧宾夺主）
 * - barDark：**水彩色**，深色主题下的身份色（暗底可辨不闪烁）
 * - soft：浅色主题用 18% 透明的 barLight，柔和地衬托 favicon 徽章
 * - text：与 bar 同值（文字场景少，保留字段）
 *
 * @param h 基础色相（0-360）
 * @param lShift 明度偏移（可选，范围 -0.06 ~ +0.06）——同色相下的明度微抖动，
 *   用于批次内区分同一色相的不同分组。由 useGroupAccents 基于 colorKey 稳定生成。
 */
export function buildAccentFromHue(h: number, lShift = 0): Accent {
  /** rgb 辅助：给定 s/l 返回 hex */
  const toHex = (s: number, l: number) => {
    const clampedL = Math.max(0.35, Math.min(0.85, l + lShift));
    const [r, g, b] = hslToRgb(h, s, clampedL);
    const hex = (v: number) => v.toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  };
  // 水彩参数：中低饱和 + 中偏高亮度，柔和但可辨
  const bar = toHex(0.52, 0.6);
  const barLight = toHex(0.48, 0.68);
  const barDark = toHex(0.55, 0.62);
  return {
    bar,
    barLight,
    barDark,
    // soft 用 barLight + 18% 透明度——柔和地衬托 favicon 徽章，
    // 比原来的 14% 稍浓，让 favicon 徽章色更可感。18% 对应 hex 后缀 2E。
    soft: barLight + '2e',
    text: bar,
  };
}

/**
 * 把 favicon URL 变成 Accent
 *
 * **同源策略**：
 *   只有当 URL 与当前页面同源（典型情况：扩展自己的 `_favicon/` 入口）时，
 *   才尝试加载并读像素。跨源 favicon 即便 `crossOrigin="anonymous"` 请求成功，
 *   对方不返回 CORS 头时浏览器仍会在控制台打红（JS 无法捕获），因此**直接放弃**，
 *   由调用方用 `stringToAccent` 哈希色兜底——视觉上只是撞色，控制台保持干净。
 *
 * 失败场景：跨源 / 非图像 / 纯灰图标 / 加载超时 → resolve(null)
 */
export function getAccentFromFavicon(url: string): Promise<Accent | null> {
  if (!url) return Promise.resolve(null);
  if (cache.has(url)) return Promise.resolve(cache.get(url)!);
  const inFlight = pending.get(url);
  if (inFlight) return inFlight;

  // 非同源直接放弃，避免浏览器级 CORS 报错污染控制台
  if (!isSameOriginUrl(url)) {
    cache.set(url, null);
    return Promise.resolve(null);
  }

  const task = new Promise<Accent | null>((resolve) => {
    const img = new Image();
    // 同源图片无需 crossOrigin；设置反而可能触发多余的预检
    // img.crossOrigin = 'anonymous';

    // 3 秒超时兜底
    const timer = window.setTimeout(() => {
      cleanup();
      cache.set(url, null);
      resolve(null);
    }, 3000);

    const cleanup = () => {
      window.clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
    };

    img.onload = () => {
      cleanup();
      try {
        const size = 16;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          cache.set(url, null);
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const pixels = ctx.getImageData(0, 0, size, size);
        const dominant = extractDominantColor(pixels);
        if (!dominant) {
          cache.set(url, null);
          resolve(null);
          return;
        }
        const [h] = rgbToHsl(...dominant);
        const accent = buildAccentFromHue(h);
        cache.set(url, accent);
        resolve(accent);
      } catch {
        // canvas 读像素被 CORS 拦截 → 记失败
        cache.set(url, null);
        resolve(null);
      }
    };

    img.onerror = () => {
      cleanup();
      cache.set(url, null);
      resolve(null);
    };

    img.src = url;
  });

  pending.set(url, task);
  void task.finally(() => pending.delete(url));
  return task;
}

/**
 * 同步读取已缓存的 Accent（未算完返回 undefined）
 */
export function peekFaviconAccent(url: string): Accent | null | undefined {
  if (!url) return null;
  return cache.get(url);
}
