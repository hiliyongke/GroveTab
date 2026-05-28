/**
 * AppearancePanel — 工具函数
 *
 * 从 AppearancePanel 中提取的纯函数：
 *   - darkenHex：HEX 色值暗化
 *   - parseAlpha：从 rgba 字符串解析 alpha
 *   - hexToRgba：HEX + alpha → rgba 字符串
 *   - optimizeBackgroundImage：上传背景图压缩为 WebP data URL
 */

/** 将上传背景图压缩为 WebP data URL，避免原图 base64 长期占用 storage 与渲染内存。 */
export async function optimizeBackgroundImage(file: File): Promise<string> {
  const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
  const MAX_EDGE = 1920;
  const QUALITY = 0.84;

  if (!file.type.startsWith("image/")) {
    throw new Error("i18n:请选择图片文件");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("i18n:图片不能超过 20MB");
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new window.Image();
  try {
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();

    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error("i18n:图片尺寸无效");
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight));
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (ctx === null) throw new Error("i18n:无法处理图片");
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL("image/webp", QUALITY);
    canvas.width = 1;
    canvas.height = 1;
    return dataUrl;
  } finally {
    image.src = "";
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * 将 HEX 色值暗化指定比例
 * 支持 3 位简写（#fff）、6 位（#ffffff）、8位（#ffffffaa，忽略 alpha）
 */
export function darkenHex(hex: string, ratio: number): string {
  let h = hex.replace("#", "");

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
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** 从 rgba 字符串解析 alpha 值 */
export function parseAlpha(rgba: string): number {
  const match = /[\d.]+(?=\))/.exec(rgba);
  return match ? parseFloat(match[0]) : 0.35;
}

/** HEX + alpha → rgba 字符串 */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
