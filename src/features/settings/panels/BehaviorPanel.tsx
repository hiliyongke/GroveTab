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
import { useT } from '@/shared/i18n';
import { GeneralSettings } from './GeneralSettings';
import { ViewLayoutSettings } from './ViewLayoutSettings';
import { TimelineSettings } from './TimelineSettings';
import { SearchSettings } from './SearchSettings';

interface BehaviorPanelProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

/**
 * 行为设置面板主组件
 *
 * 组合多个子组件，按功能模块展示所有行为相关设置项。
 */
export function BehaviorPanel({ settings, updateSettings }: BehaviorPanelProps) {
  const { t } = useT();
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* 通用行为设置 */}
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: 'var(--ant-color-text)', letterSpacing: '-0.01em' }}>
          {t('settings.sectionGeneral')}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <GeneralSettings settings={settings} updateSettings={updateSettings} />
        </div>
      </section>

      {/* 视图与布局设置 */}
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: 'var(--ant-color-text)', letterSpacing: '-0.01em' }}>
          {t('settings.sectionViewLayout')}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <ViewLayoutSettings settings={settings} updateSettings={updateSettings} />
        </div>
      </section>

      {/* 时间轴设置 */}
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: 'var(--ant-color-text)', letterSpacing: '-0.01em' }}>
          {t('settings.sectionTimeline')}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <TimelineSettings settings={settings} updateSettings={updateSettings} />
        </div>
      </section>

      {/* 搜索设置 */}
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: 'var(--ant-color-text)', letterSpacing: '-0.01em' }}>
          {t('settings.sectionSearch')}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SearchSettings settings={settings} updateSettings={updateSettings} />
        </div>
      </section>
    </div>
  );
}
