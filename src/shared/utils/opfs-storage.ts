/**
 * OPFS 存储适配器（Origin Private File System）
 *
 * 提供统一的大体量数据持久化接口，作为 chrome.storage.local 的大容量补充：
 *   - 归档会话正文（超配额时自动迁移）
 *   - 书签索引（超 5000 条时）
 *   - 历史分析仓（长期数据）
 *   - 背景素材（图片/视频）
 *   - 开发工具栏片段（正则/Header 模板）
 *
 * 所有写入操作通过 Web Locks API 加全局锁，防止多标签页并发数据竞争。
 */

/** OPFS 是否可用（MV3 扩展页面支持，Service Worker 不支持） */
export function isOPFSAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "storage" in navigator &&
    "getDirectory" in navigator.storage
  );
}

/** 获取 OPFS 根目录 */
async function getRoot(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory();
}

/** 确保子目录存在并返回其句柄 */
async function ensureDir(path: string): Promise<FileSystemDirectoryHandle> {
  const root = await getRoot();
  const parts = path.split("/").filter(Boolean);
  let dir = root;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
  return dir;
}

// ── 核心读写（带 Web Locks 并发保护）────────────────────

/**
 * 从 OPFS 读取 JSON 数据。
 * @param filePath 相对路径，如 'archive/sessions.json'
 */
export async function opfsRead<T>(filePath: string): Promise<T | null> {
  if (!isOPFSAvailable()) return null;
  try {
    const parts = filePath.split("/");
    const fileName = parts.pop()!;
    const dirPath = parts.join("/");
    const dir = dirPath ? await ensureDir(dirPath) : await getRoot();
    const fileHandle = await dir.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * 向 OPFS 写入 JSON 数据（带 Web Locks 全局锁）。
 * @param filePath 相对路径，如 'archive/sessions.json'
 * @param data 要写入的数据
 */
export async function opfsWrite<T>(filePath: string, data: T): Promise<void> {
  if (!isOPFSAvailable()) return;
  const lockName = `opfs:${filePath}`;
  await navigator.locks.request(lockName, async () => {
    const parts = filePath.split("/");
    const fileName = parts.pop()!;
    const dirPath = parts.join("/");
    const dir = dirPath ? await ensureDir(dirPath) : await getRoot();
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data));
    await writable.close();
  });
}

/**
 * 从 OPFS 删除文件。
 */
export async function opfsDelete(filePath: string): Promise<void> {
  if (!isOPFSAvailable()) return;
  try {
    const parts = filePath.split("/");
    const fileName = parts.pop()!;
    const dirPath = parts.join("/");
    const dir = dirPath ? await ensureDir(dirPath) : await getRoot();
    await dir.removeEntry(fileName);
  } catch {
    // 文件不存在时静默忽略
  }
}

/**
 * 向 OPFS 写入二进制数据（图片/视频素材）。
 */
export async function opfsWriteBinary(filePath: string, data: ArrayBuffer | Blob): Promise<void> {
  if (!isOPFSAvailable()) return;
  const lockName = `opfs:${filePath}`;
  await navigator.locks.request(lockName, async () => {
    const parts = filePath.split("/");
    const fileName = parts.pop()!;
    const dirPath = parts.join("/");
    const dir = dirPath ? await ensureDir(dirPath) : await getRoot();
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
  });
}

/**
 * 从 OPFS 读取二进制数据。
 */
export async function opfsReadBinary(filePath: string): Promise<Blob | null> {
  if (!isOPFSAvailable()) return null;
  try {
    const parts = filePath.split("/");
    const fileName = parts.pop()!;
    const dirPath = parts.join("/");
    const dir = dirPath ? await ensureDir(dirPath) : await getRoot();
    const fileHandle = await dir.getFileHandle(fileName);
    return fileHandle.getFile();
  } catch {
    return null;
  }
}

// ── 配额监控 ──────────────────────────────────────────

export interface StorageQuotaInfo {
  /** chrome.storage.local 已用字节 */
  chromeStorageUsed: number;
  /** chrome.storage.local 总配额（10MB） */
  chromeStorageTotal: number;
  /** chrome.storage.local 使用率 0~1 */
  chromeStorageRatio: number;
  /** OPFS 已用字节（估算） */
  opfsUsed: number;
  /** 设备存储总配额 */
  opfsTotal: number;
  /** OPFS 使用率 0~1 */
  opfsRatio: number;
}

/**
 * 获取存储配额信息（chrome.storage.local + OPFS）。
 */
export async function getStorageQuotaInfo(): Promise<StorageQuotaInfo> {
  // chrome.storage.local 配额（通过 navigator.storage 统一估算，避免直接调用 chrome.storage）
  let chromeStorageUsed = 0;
  const chromeStorageTotal = 10 * 1024 * 1024; // 10MB
  try {
    // 使用 navigator.storage.estimate() 获取整体存储用量作为近似值
    const estimate = await navigator.storage.estimate();
    chromeStorageUsed = Math.min(estimate.usage ?? 0, chromeStorageTotal);
  } catch {
    // 忽略
  }

  // OPFS / navigator.storage 配额
  let opfsUsed = 0;
  let opfsTotal = 0;
  try {
    const estimate = await navigator.storage.estimate();
    opfsUsed = estimate.usage ?? 0;
    opfsTotal = estimate.quota ?? 0;
  } catch {
    // 忽略
  }

  return {
    chromeStorageUsed,
    chromeStorageTotal,
    chromeStorageRatio: chromeStorageTotal > 0 ? chromeStorageUsed / chromeStorageTotal : 0,
    opfsUsed,
    opfsTotal,
    opfsRatio: opfsTotal > 0 ? opfsUsed / opfsTotal : 0,
  };
}

/**
 * 检查 chrome.storage.local 是否超过配额阈值。
 * @param threshold 阈值，默认 0.8（80%）
 */
export async function isChromeStorageOverQuota(threshold = 0.8): Promise<boolean> {
  const info = await getStorageQuotaInfo();
  return info.chromeStorageRatio >= threshold;
}

// ── Web Locks 通用包装 ────────────────────────────────

/**
 * 在指定锁名下执行操作（独占锁）。
 * 用于归档、书签、历史等写入路径的并发保护。
 */
export async function withLock<T>(lockName: string, fn: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !("locks" in navigator)) {
    // 降级：不支持 Web Locks 时直接执行
    return fn();
  }
  return navigator.locks.request(lockName, fn);
}

/** 归档操作专用锁名 */
export const LOCK_NAMES = {
  archive: "canopy:archive",
  bookmarks: "canopy:bookmarks",
  history: "canopy:history",
  settings: "canopy:settings",
  devTools: "canopy:dev-tools",
} as const;
