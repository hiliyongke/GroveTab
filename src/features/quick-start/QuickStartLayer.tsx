/**
 * QuickStartLayer — 首页轻启动层
 *
 * 常用站点快捷入口，位于 Hero 搜索框下方。
 * 参考 Chrome 新标签页设计：大图标 + 标题，居中排列。
 */

import { useEffect } from 'react';
import { useSpeedDialStore, useSettingsStore } from '@/store';
import { SpeedDialGrid } from './SpeedDialGrid';
import styles from './QuickStartLayer.module.less';

/**
 * 常用站点快捷启动层
 *
 * 渲染常用站点网格（SpeedDialGrid），位于 Hero 搜索框下方。
 * 参考 Chrome 新标签页设计：大图标 + 标题，居中排列。
 * 当配置隐藏时不渲染任何内容。
 *
 * @returns {JSX.Element | null} 返回快捷启动层 JSX 元素或 null
 */
export function QuickStartLayer() {
  const sites = useSpeedDialStore((s) => s.sites);
  const loaded = useSpeedDialStore((s) => s.loaded);
  const loadSites = useSpeedDialStore((s) => s.loadSites);
  const quickStartVisible = useSettingsStore((s) => s.settings.uiVisibility?.quickStart !== false);

  useEffect(() => {
    if (!loaded) {
      void loadSites();
    }
  }, [loaded, loadSites]);

  if (!quickStartVisible) return null;

  return (
    <section className={styles['app-quick-start']}>
      <SpeedDialGrid sites={sites} />
    </section>
  );
}
