/**
 * Chrome API 统一导出
 *
 * 本文件是 chrome/ 目录的公共入口，统一导出所有 Chrome API 封装层。
 *
 * 封装目的：
 *   - 将 chrome.* API 的回调风格统一为 Promise
 *   - 统一超时控制、错误归一化、日志前缀
 *   - 外部调用点只依赖本目录，不直接触 chrome.xxx
 *
 * 导出模块：
 *   - tabs:    标签页、窗口、存储、分屏、Tab Group 等
 *   - history:  历史记录查询（需动态申请权限）
 *   - utils:    URL 分类、hostname 提取等工具函数
 *   - bookmarks: 书签读写（需动态申请权限）
 */

export * from './tabs';
export * from './history';
export * from './utils';
