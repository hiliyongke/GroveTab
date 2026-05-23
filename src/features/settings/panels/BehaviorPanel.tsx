/**
 * BehaviorPanel —— 行为设置 Tab（重构版）
 *
 * 组件结构：
 * 1. GeneralSettings - 通用行为设置
 * 2. ViewLayoutSettings - 视图与布局设置
 * 3. TimelineSettings - 时间轴设置
 * 4. SearchSettings - 搜索设置
 */

import type { UserSettings } from '@/shared/types';
import { Typography } from 'antd';
import { useT } from '@/shared/i18n';
import { GeneralSettings } from './GeneralSettings';
import { ViewLayoutSettings } from './ViewLayoutSettings';
import { TimelineSettings } from './TimelineSettings';
import { SearchSettings } from './SearchSettings';
import styles from '../settings.module.less';

interface BehaviorPanelProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

/**
 * 行为设置面板主组件
 *
 * 组合多个子组件，按功能模块展示所有行为相关设置项。
 *
 * @param props - 组件属性
 * @param props.settings - 当前用户设置
 * @param props.updateSettings - 更新设置回调
 * @returns 行为设置面板 JSX 元素
 */
export function BehaviorPanel({ settings, updateSettings }: BehaviorPanelProps) {
  const { t } = useT();
  const sections = [
    {
      key: 'general',
      title: t('settings.sectionGeneral'),
      content: <GeneralSettings settings={settings} updateSettings={updateSettings} />,
    },
    {
      key: 'view-layout',
      title: t('settings.sectionViewLayout'),
      content: <ViewLayoutSettings settings={settings} updateSettings={updateSettings} />,
    },
    {
      key: 'timeline',
      title: t('settings.sectionTimeline'),
      content: <TimelineSettings settings={settings} updateSettings={updateSettings} />,
    },
    {
      key: 'search',
      title: t('settings.sectionSearch'),
      content: <SearchSettings settings={settings} updateSettings={updateSettings} />,
    },
  ];

  return (
    <div className={styles['settings-panel-stack']}>
      {sections.map((section) => (
        <section key={section.key} className={styles['settings-section']}>
          <Typography.Title level={3} className={styles['settings-section__title']} style={{ margin: 0 }}>
            {section.title}
          </Typography.Title>
          <div className={styles['settings-section__body']}>{section.content}</div>
        </section>
      ))}
    </div>
  );
}
