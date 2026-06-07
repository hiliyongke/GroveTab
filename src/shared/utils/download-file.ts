/**
 * download-file.ts — 触发浏览器下载
 *
 * 封装 a 标签 + Blob URL 的标准下载流程，并异步释放 URL。
 * 项目内多处复用：书签导出、历史导出、洞察数据导出等。
 *
 * 注意：仅适用于"在浏览器中点击触发"的场景，不要放在异步回调里
 * （可能因为用户没有交互而被浏览器拦截）。
 */
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
