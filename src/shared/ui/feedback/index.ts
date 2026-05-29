/**
 * 反馈三态统一入口
 *
 * UX-P0-08：导出统一的反馈 API，替代 `message.xxx` 直调
 *
 * 三态语义：
 *   - 持久状态 → StatusBar（useStatusBarStore）
 *   - 瞬时反馈 → Toast（feedback.xxx）
 *   - 阻塞确认 → Modal（feedback.modal.confirm）
 *
 * @see docs/feedback-pattern.md
 */

export { feedback, bindFeedback, unbindFeedback } from "../feedback";
