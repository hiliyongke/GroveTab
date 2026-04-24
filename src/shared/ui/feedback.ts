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
import { BRAND } from '@/shared/config/brand';

/** 统一日志前缀：在构建时从 BRAND 读取，后续品牌切换自动同步 */
const LOG_TAG = BRAND.logTag;

/** 由 React 层通过 useApp() 注入的 antd 实例 */
interface FeedbackApi {
  message: MessageInstance;
  notification: NotificationInstance;
  modal: ModalHookAPI;
}

/**
 * 反馈 API 的持有方式：
 *   - 直接引用：绑定一次后不再变化
 *   - Ref 代理：通过 React ref 间接访问，每次调用都读取最新值，
 *     解决 antd App.useApp() 返回引用不稳定的问题
 *
 * 注意：这里统一用 RefObject 模式，避免 antd 内部实例引用不稳定导致的问题。
 */
let holder: (React.RefObject<FeedbackApi> | FeedbackApi | null) = null;

/** 从 holder 中解析出实际的 FeedbackApi 实例 */
function resolveApi(): FeedbackApi | null {
  if (holder === null) return null;
  if ('current' in holder) return holder.current;
  return holder;
}

/**
 * React 层注入 antd 反馈实例（应在 App 根组件的 useEffect 中调用一次）
 *
 * 支持直接传入 FeedbackApi 或 React.RefObject<FeedbackApi>（推荐后者，
 * 避免因 antd 内部引用不稳定导致 useEffect 反复触发）。
 */
export function bindFeedback(instance: React.RefObject<FeedbackApi> | FeedbackApi): void {
  holder = instance;
}

/**
 * 解绑（热重载/卸载时调用，避免引用已卸载的 React 树）
 */
export function unbindFeedback(): void {
  holder = null;
}

/**
 * 统一的反馈入口 —— 供 store / service / 非 React 代码直接使用
 *
 * 所有方法都带 console fallback：如果 React 树还没 mount 完成就失败了，
 * 至少在 DevTools 里能看到信息，不会静默丢失。
 */
export const feedback = {
  success(content: string): void {
    const api = resolveApi();
    if (api !== null) api.message.success(content);
    else console.info(`${LOG_TAG}/feedback:success`, content);
  },

  info(content: string): void {
    const api = resolveApi();
    if (api !== null) api.message.info(content);
    else console.info(`${LOG_TAG}/feedback:info`, content);
  },

  warning(content: string): void {
    const api = resolveApi();
    if (api !== null) api.message.warning(content);
    else console.warn(`${LOG_TAG}/feedback:warning`, content);
  },

  /**
   * 错误反馈 —— chrome API 失败的默认通道
   *
   * @param content  用户可读的失败描述
   * @param err      可选的原始错误，仅打到 console，不展示给用户
   */
  error(content: string, err?: unknown): void {
    if (err !== undefined) console.warn(`${LOG_TAG}/feedback:error`, content, err);
    else console.warn(`${LOG_TAG}/feedback:error`, content);
    const api = resolveApi();
    if (api !== null) api.message.error(content);
  },

  /**
   * 右侧通知（比 message 更重量级，带标题）—— 适合错误有详细描述时
   */
  notify: {
    error(title: string, description?: string): void {
      const api = resolveApi();
      if (api !== null) api.notification.error({ message: title, description });
      else console.warn(`${LOG_TAG}/notify:error`, title, description);
    },
  },

  /**
   * Modal 对话框 —— 供 store 层触发确认弹窗
   *
   * 若 React 树未 mount 则 fallback 到 window.confirm。
   */
  modal: {
    confirm(config: Parameters<ModalHookAPI['confirm']>[0]): void {
      const api = resolveApi();
      if (api !== null) api.modal.confirm(config);
      else {
        const fallbackTitle = typeof config.title === 'string' || typeof config.title === 'number'
          ? String(config.title)
          : '确认？';
        const ok = window.confirm(fallbackTitle);
        if (ok && config.onOk !== undefined) config.onOk(null);
      }
    },
  } satisfies { confirm(config: Parameters<ModalHookAPI['confirm']>[0]): void },
};
