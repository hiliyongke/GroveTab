/**
 * 统一离线搜索索引 Worker（需求 3.1 / 3.4）
 *
 * 在 Web Worker 中增量构建覆盖标签、归档、书签、历史的统一搜索索引。
 * 使用 scheduler.postTask()（若可用）将索引构建任务降级为后台优先级。
 *
 * 消息协议：
 *   IN  { type: 'build', payload: BuildPayload }
 *   OUT { type: 'ready', indexId: string }
 *   OUT { type: 'error', message: string }
 *
 *   IN  { type: 'search', query: string, requestId: string }
 *   OUT { type: 'results', requestId: string, results: SearchResult[] }
 */

import MiniSearch from "minisearch";

// ── 类型 ──────────────────────────────────────────────────────────────────────

export interface UnifiedIndexDoc {
  /** 唯一 ID（格式：`{source}:{id}`） */
  id: string;
  /** 来源类型 */
  source: "tab" | "archive" | "bookmark" | "history";
  title: string;
  url: string;
  hostname: string;
  /** 归档会话名称（仅 archive 类型） */
  sessionName?: string;
  /** 归档会话 ID（仅 archive 类型） */
  sessionId?: string;
  /** 书签文件夹路径（仅 bookmark 类型） */
  folderPath?: string;
  /** 访问次数（仅 history 类型） */
  visitCount?: number;
  /** 最后访问时间（ms） */
  lastVisited?: number;
}

export interface BuildPayload {
  tabs?: Array<{ id: number; title: string; url: string; hostname: string }>;
  archiveSessions?: Array<{
    id: string;
    name: string;
    tabs: Array<{ url: string; title: string; hostname: string }>;
  }>;
  bookmarks?: Array<{
    id: string;
    title: string;
    url: string;
    hostname: string;
    folderPath?: string;
  }>;
  historyEntries?: Array<{
    id: string;
    title: string;
    url: string;
    hostname: string;
    visitCount?: number;
    lastVisited?: number;
  }>;
}

export interface SearchResult {
  id: string;
  source: UnifiedIndexDoc["source"];
  title: string;
  url: string;
  hostname: string;
  sessionName?: string;
  sessionId?: string;
  folderPath?: string;
  visitCount?: number;
  lastVisited?: number;
  score: number;
}

// ── 索引实例 ──────────────────────────────────────────────────────────────────

let ms: MiniSearch<UnifiedIndexDoc> | null = null;

function createIndex(): MiniSearch<UnifiedIndexDoc> {
  return new MiniSearch<UnifiedIndexDoc>({
    fields: ["title", "url", "hostname", "sessionName", "folderPath"],
    storeFields: [
      "id",
      "source",
      "title",
      "url",
      "hostname",
      "sessionName",
      "sessionId",
      "folderPath",
      "visitCount",
      "lastVisited",
    ],
    searchOptions: { fuzzy: 0.2, prefix: true, boost: { title: 2, hostname: 1.5 } },
  });
}

// ── 构建逻辑 ──────────────────────────────────────────────────────────────────

function buildDocs(payload: BuildPayload): UnifiedIndexDoc[] {
  const docs: UnifiedIndexDoc[] = [];

  // 标签页
  for (const tab of payload.tabs ?? []) {
    docs.push({
      id: `tab:${tab.id}`,
      source: "tab",
      title: tab.title,
      url: tab.url,
      hostname: tab.hostname,
    });
  }

  // 归档会话
  for (const session of payload.archiveSessions ?? []) {
    for (let i = 0; i < session.tabs.length; i++) {
      const tab = session.tabs[i];
      if (tab === undefined) continue;
      docs.push({
        id: `archive:${session.id}:${i}`,
        source: "archive",
        title: tab.title,
        url: tab.url,
        hostname: tab.hostname,
        sessionName: session.name,
        sessionId: session.id,
      });
    }
  }

  // 书签
  for (const bm of payload.bookmarks ?? []) {
    docs.push({
      id: `bookmark:${bm.id}`,
      source: "bookmark",
      title: bm.title,
      url: bm.url,
      hostname: bm.hostname,
      folderPath: bm.folderPath,
    });
  }

  // 历史记录
  for (const entry of payload.historyEntries ?? []) {
    docs.push({
      id: `history:${entry.id}`,
      source: "history",
      title: entry.title,
      url: entry.url,
      hostname: entry.hostname,
      visitCount: entry.visitCount,
      lastVisited: entry.lastVisited,
    });
  }

  return docs;
}

function buildIndex(payload: BuildPayload): void {
  const docs = buildDocs(payload);
  const newMs = createIndex();
  newMs.addAll(docs);
  ms = newMs;
}

// ── 搜索逻辑 ──────────────────────────────────────────────────────────────────

function search(query: string): SearchResult[] {
  if (!ms || query.trim() === "") return [];
  try {
    const raw = ms.search(query);
    return raw.map((r) => ({
      id: r.id as string,
      source: r.source as UnifiedIndexDoc["source"],
      title: r.title as string,
      url: r.url as string,
      hostname: r.hostname as string,
      sessionName: r.sessionName as string | undefined,
      sessionId: r.sessionId as string | undefined,
      folderPath: r.folderPath as string | undefined,
      visitCount: r.visitCount as number | undefined,
      lastVisited: r.lastVisited as number | undefined,
      score: r.score,
    }));
  } catch {
    return [];
  }
}

// ── 消息处理 ──────────────────────────────────────────────────────────────────

type InMessage =
  | { type: "build"; payload: BuildPayload }
  | { type: "search"; query: string; requestId: string };

self.addEventListener("message", (event: MessageEvent<InMessage>) => {
  const msg = event.data;

  if (msg.type === "build") {
    const run = () => {
      try {
        buildIndex(msg.payload);
        self.postMessage({ type: "ready", indexId: Date.now().toString() });
      } catch (err) {
        self.postMessage({ type: "error", message: String(err) });
      }
    };

    // 使用 scheduler.postTask 降级为后台优先级（Chrome 94+）
    const scheduler = (
      self as unknown as {
        scheduler?: { postTask: (fn: () => void, opts: { priority: string }) => void };
      }
    ).scheduler;
    if (typeof scheduler?.postTask === "function") {
      scheduler.postTask(
        () => {
          run();
        },
        { priority: "background" },
      );
    } else {
      run();
    }
    return;
  }

  if (msg.type === "search") {
    const results = search(msg.query);
    self.postMessage({ type: "results", requestId: msg.requestId, results });
  }
});
