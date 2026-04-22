/**
 * 全局反馈桥 —— 让 store / service 层也能触发 antd 的 message/notification/modal
 *
 * 背景：
 *   antd v6 推荐用 `App.useApp()` 在 React tree 内拿到 message 实例，这样才能
 *   正确继承 ConfigProvider 的主题与 locale。但 Zustand store action、Service
 *   Worker 桥、Chrome API 回调等都发生在 React tree 外部，没法用 hook。
 *
 * 解决方案：
 *   - React 树内 `<AntdThemeProvider>` mount 时通过 `useApp()` 拿到实例，
 *     调用 `bindFeedback()` 注册到模块级变量
 *   - 任何非 React 代码通过 `feedback.error(...)` 直接触发
 *   - 若 React 树尚未 mount（极少见，比如启动失败页），回落到 console 打印
 *
 * 这样所有 chrome API 失败只需要在 store 里 `feedback.error('关闭失败')` 一行，
 * 就能统一弹 toast，不用每个调用点都包 try/catch。
 */

import type { MessageInstance } from 'antd/es/message/interface';
import type { NotificationInstance } from 'antd/es/notification/interface';
import type { HookAPI as ModalHookAPI } from 'antd/es/modal/useModal';

/** 由 React 层通过 useApp() 注入的 antd 实例 */
interface FeedbackApi {
  message: MessageInstance;
  notification: NotificationInstance;
  modal: ModalHookAPI;
}

let api: FeedbackApi | null = null;

/**
 * React 层注入 antd 反馈实例（应在 App 根组件的 useEffect 中调用一次）
 */
export function bindFeedback(instance: FeedbackApi): void {
  api = instance;
}

/**
 * 解绑（热重载/卸载时调用，避免引用已卸载的 React 树）
 */
export function unbindFeedback(): void {
  api = null;
}

/**
 * 统一的反馈入口 —— 供 store / service / 非 React 代码直接使用
 *
 * 所有方法都带 console fallback：如果 React 树还没 mount 完成就失败了，
 * 至少在 DevTools 里能看到信息，不会静默丢失。
 */
export const feedback = {
  success(content: string): void {
    if (api) api.message.success(content);
    else console.info('[Canopy/feedback:success]', content);
  },

  info(content: string): void {
    if (api) api.message.info(content);
    else console.info('[Canopy/feedback:info]', content);
  },

  warning(content: string): void {
    if (api) api.message.warning(content);
    else console.warn('[Canopy/feedback:warning]', content);
  },

  /**
   * 错误反馈 —— chrome API 失败的默认通道
   *
   * @param content  用户可读的失败描述
   * @param err      可选的原始错误，仅打到 console，不展示给用户
   */
  error(content: string, err?: unknown): void {
    if (err !== undefined) console.warn('[Canopy/feedback:error]', content, err);
    else console.warn('[Canopy/feedback:error]', content);
    if (api) api.message.error(content);
  },

  /**
   * 右侧通知（比 message 更重量级，带标题）—— 适合错误有详细描述时
   */
  notify: {
    error(title: string, description?: string): void {
      if (api) api.notification.error({ message: title, description });
      else console.warn('[Canopy/notify:error]', title, description);
    },
  },
};
