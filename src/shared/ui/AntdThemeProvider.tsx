/**
 * AntdThemeProvider —— antd v6 主题桥接
 *
 * 职责：
 *   1. 通过 `useResolvedTheme` 订阅 settings.theme 与系统 `prefers-color-scheme`，
 *      在「跟随系统」模式下也能即时响应系统明暗切换
 *   2. 写 `<html data-theme="...">` 以兼容存量 CSS 变量引用
 *   3. 根据当前主题选择 antd 的 defaultAlgorithm / darkAlgorithm，并注入统一 token
 *   4. 挂载 antd 的 App 容器（提供 message/notification/modal 的静态调用上下文）
 *
 * 设计 token 与 docs/ui-mock/newtab.html 视觉稿保持一致，是项目视觉基准。
 */

import { useEffect, useMemo } from 'react';
import { ConfigProvider, theme as antdTheme, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { useSettingsStore } from '@/store';
import { useResolvedTheme } from '@/shared/hooks';
import { bindFeedback, unbindFeedback } from './feedback';

/**
 * 将 antd App 的 message/notification/modal 实例注入到模块级 `feedback`
 *
 * 必须放在 `<AntdApp>` 的子节点里，`App.useApp()` 才能拿到有效实例；
 * 组件本身不渲染任何节点。
 */
function FeedbackBridge() {
  const { message, notification, modal } = AntdApp.useApp();
  useEffect(() => {
    bindFeedback({ message, notification, modal });
    return () => unbindFeedback();
  }, [message, notification, modal]);
  return null;
}

/**
 * antd v6 主题提供者 + 多语言环境 + App 静态消息容器
 */
export function AntdThemeProvider({ children }: { children: React.ReactNode }) {
  const language = useSettingsStore((s) => s.settings.language);
  const loaded = useSettingsStore((s) => s.loaded);
  const mode = useResolvedTheme();

  // 同步 data-theme 到 <html>，供存量 CSS 变量消费
  useEffect(() => {
    if (!loaded) return;
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode, loaded]);

  // 同步 dayjs locale
  useEffect(() => {
    dayjs.locale(language === 'zh-CN' ? 'zh-cn' : 'en');
  }, [language]);

  // 当前阶段只切换明暗算法，全部走 antd 默认 token；未来要做多套主题再在此处扩展
  const themeConfig = useMemo(
    () => ({
      algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      cssVar: { key: 'canopy' },
      hashed: false,
      /**
       * Tooltip 保持 antd 默认反色样式。
       *
       * 之前尝试过在 `components.Tooltip` 里覆盖 `colorBgSpotlight` + `colorTextLightSolid`
       * 把它做成「白底深字」与 Canopy 卡片视觉更贴合，但 `colorTextLightSolid` 其实是
       * 全局 Seed token，放在 components 命名空间里不生效，导致文字色计算链断裂；
       * 叠加 `cssVar + hashed: false` 会让多个 Tooltip 共享同一份 CSS 变量，
       * 出现「首次显示正常，第二次就不显示」的诡异 bug。
       *
       * 目前策略：组件级 token 保持空，主题切换完全交给 antd 默认算法。
       * 未来要做品牌化 Tooltip 时，需同时在 seed token + components.Tooltip 里
       * 成对覆盖色与阴影，并删掉 `hashed: false`。
       */
    }),
    [mode],
  );

  const locale = language === 'zh-CN' ? zhCN : enUS;

  return (
    <ConfigProvider theme={themeConfig} locale={locale}>
      <AntdApp style={{ minHeight: '100vh' }}>
        <FeedbackBridge />
        {children}
      </AntdApp>
    </ConfigProvider>
  );
}
