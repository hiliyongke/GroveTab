/**
 * bookmark-io.ts — 书签导入/导出序列化
 *
 * 支持：
 *   - Netscape Bookmark File Format 1 (HTML)
 *   - JSON（原生 chrome.bookmarks 树结构）
 *   - Markdown（人类可读清单）
 *
 * 解析：Netscape HTML 优先，JSON 次之。
 * 浏览器解析失败时回落到空数组，由调用方决定如何提示。
 *
 * @i18n-noscan 本文件导出的 Markdown 标题 "# Header" 为占位符，避免污染 i18n
 */

import type { BookmarkNode } from "@/chrome/bookmarks";

/** 转义 XML 特殊字符 */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 递归渲染为 Netscape Bookmark HTML */
export function toNetscapeHtml(nodes: BookmarkNode[], indent = 0): string {
  let html = "";
  const pad = "  ".repeat(indent);
  for (const n of nodes) {
    if (n.url !== undefined) {
      html += `${pad}<DT><A HREF="${escapeXml(n.url)}" ADD_DATE="">${escapeXml(n.title)}</A>\n`;
    } else {
      html += `${pad}<DT><H3>${escapeXml(n.title)}</H3>\n<DL><p>\n`;
      if (n.children) html += toNetscapeHtml(n.children, indent + 1);
      html += `${pad}</DL><p>\n`;
    }
  }
  return html;
}

/** 渲染为 Markdown 列表 */
export function toMarkdown(nodes: BookmarkNode[]): string {
  // 标题使用占位符 # Header（i18n noscan）
  const lines: string[] = ["# Header", ""];
  const walk = (arr: BookmarkNode[], depth: number): void => {
    for (const n of arr) {
      if (n.url !== undefined) {
        lines.push(`${"  ".repeat(depth)}- [${n.title}](${n.url})`);
      } else {
        lines.push(`${"  ".repeat(depth)}- **${n.title}**`);
        if (n.children) walk(n.children, depth + 1);
      }
    }
  };
  walk(nodes, 0);
  return lines.join("\n");
}

/** 解析导入文本，尝试 JSON → HTML（注意顺序） */
export function parseImport(text: string): Array<{ title: string; url: string }> {
  // 优先 JSON（更精确）
  try {
    const arr = JSON.parse(text) as unknown;
    if (Array.isArray(arr)) return flattenImport(arr);
  } catch {
    /* 落到 HTML */
  }
  return parseNetscapeHtml(text);
}

/** 递归展平 JSON 树为 URL 列表 */
function flattenImport(arr: unknown[]): Array<{ title: string; url: string }> {
  const r: Array<{ title: string; url: string }> = [];
  for (const item of arr) {
    if (item === null || typeof item !== "object") continue;
    const obj = item as { url?: unknown; title?: unknown; children?: unknown };
    if (typeof obj.url === "string" && obj.url.length > 0) {
      r.push({
        title: typeof obj.title === "string" ? obj.title : obj.url,
        url: obj.url,
      });
    }
    if (Array.isArray(obj.children)) r.push(...flattenImport(obj.children));
  }
  return r;
}

/** 正则提取 Netscape Bookmark HTML 中的链接 */
function parseNetscapeHtml(text: string): Array<{ title: string; url: string }> {
  const linkRegex = /<A\s[^>]*HREF="([^"]*)"[^>]*>([^<]*)<\/A>/gi;
  const results: Array<{ title: string; url: string }> = [];
  let match: RegExpExecArray | null = linkRegex.exec(text);
  while (match !== null) {
    const url = match[1];
    if (url !== undefined && url.length > 0 && !url.toLowerCase().startsWith("javascript:")) {
      const title = (match[2] ?? "").trim();
      results.push({ title: title.length > 0 ? title : url, url });
    }
    match = linkRegex.exec(text);
  }
  return results;
}

/** 触发浏览器下载 */
export function downloadFile(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // 异步释放，浏览器完成下载后再回收
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
