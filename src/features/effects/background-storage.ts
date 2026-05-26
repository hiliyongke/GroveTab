/**
 * background-storage — 背景素材 OPFS 存储（任务8）
 *
 * 将背景图片/视频文件存储到 Origin Private File System（OPFS），
 * 相比 IndexedDB 更适合大型二进制文件，且不占用 chrome.storage 配额。
 *
 * 目录结构：
 *   /backgrounds/
 *     bg_<key>.bin   — 背景图片或视频文件
 *
 * API:
 *   - saveBackgroundFile(file) → key
 *   - loadBackgroundBlobUrl(key) → blob URL（调用方负责 revokeObjectURL）
 *   - removeBackgroundFile(key)
 *   - listBackgroundFiles() → key[]
 */

const BG_DIR = "backgrounds";

/** 获取 OPFS 背景目录句柄，不存在时自动创建。 */
async function getBgDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(BG_DIR, { create: true });
}

/**
 * 保存背景文件到 OPFS，返回持久化 key。
 * key 格式：bg_<timestamp>_<random>
 *
 * 使用 Web Locks 对 per-key 加独占锁，防止并发写入同一文件时损坏数据。
 */
export async function saveBackgroundFile(file: File): Promise<string> {
  const key = `bg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const lockName = `bg:${key}`;
  await navigator.locks.request(lockName, async () => {
    const dir = await getBgDir();
    const fileHandle = await dir.getFileHandle(`${key}.bin`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
  });
  return key;
}

/**
 * 读取背景文件，返回 Blob URL（内存态）。
 * 调用方不再使用时必须 URL.revokeObjectURL。
 */
export async function loadBackgroundBlobUrl(key: string): Promise<string | null> {
  try {
    const dir = await getBgDir();
    const fileHandle = await dir.getFileHandle(`${key}.bin`);
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

/** 删除背景文件。 */
export async function removeBackgroundFile(key: string): Promise<void> {
  try {
    const dir = await getBgDir();
    await dir.removeEntry(`${key}.bin`);
  } catch {
    // 文件不存在时静默忽略
  }
}

/** 列出所有已保存的背景文件 key。 */
export async function listBackgroundFiles(): Promise<string[]> {
  try {
    const dir = await getBgDir();
    const keys: string[] = [];
    for await (const [name] of dir.entries()) {
      if (name.endsWith(".bin")) {
        keys.push(name.replace(/\.bin$/, ""));
      }
    }
    return keys;
  } catch {
    return [];
  }
}

/** 获取背景目录总占用字节数（用于配额展示）。 */
export async function getBackgroundStorageBytes(): Promise<number> {
  try {
    const dir = await getBgDir();
    let total = 0;
    for await (const [, handle] of dir.entries()) {
      if (handle.kind === "file") {
        const file = await (handle as FileSystemFileHandle).getFile();
        total += file.size;
      }
    }
    return total;
  } catch {
    return 0;
  }
}
