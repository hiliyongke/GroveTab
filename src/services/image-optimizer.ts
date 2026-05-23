/**
 * Image optimization service
 *
 * Provides browser-side image compression, downsampling, and WebP conversion
 * using the Canvas API. Used to prepare uploaded background images before
 * persisting them as data URLs, avoiding oversized base64 payloads in storage
 * and rendering memory.
 */

/** Maximum allowed source file size for background images (20 MB) */
const MAX_BACKGROUND_IMAGE_SOURCE_BYTES = 20 * 1024 * 1024;

/** Maximum edge length of the output image; larger images are down-sampled */
const MAX_BACKGROUND_IMAGE_EDGE = 1920;

/** WebP encoding quality (0–1) */
const BACKGROUND_IMAGE_QUALITY = 0.84;

/**
 * Compress an uploaded image file into a WebP data URL.
 *
 * The pipeline:
 *   1. Validate the file type and size.
 *   2. Decode the image via `URL.createObjectURL` + `Image.decode()`.
 *   3. Down-sample to fit within {@link MAX_BACKGROUND_IMAGE_EDGE} on the
 *      longest side while preserving aspect ratio.
 *   4. Encode the result as WebP at {@link BACKGROUND_IMAGE_QUALITY}.
 *   5. Release the object URL and minimize the canvas to free memory.
 *
 * @param file - The image `File` selected by the user.
 * @returns A WebP data-URL string suitable for storage.
 * @throws {Error} If the file is not an image, exceeds the size limit, or
 *         cannot be decoded.
 */
export async function optimizeBackgroundImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件');
  }
  if (file.size > MAX_BACKGROUND_IMAGE_SOURCE_BYTES) {
    throw new Error('图片不能超过 20MB');
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new window.Image();
  try {
    image.decoding = 'async';
    image.src = objectUrl;
    await image.decode();

    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error('图片尺寸无效');
    }

    const scale = Math.min(1, MAX_BACKGROUND_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight));
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (ctx === null) throw new Error('无法处理图片');
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL('image/webp', BACKGROUND_IMAGE_QUALITY);
    canvas.width = 1;
    canvas.height = 1;
    return dataUrl;
  } finally {
    image.src = '';
    URL.revokeObjectURL(objectUrl);
  }
}
