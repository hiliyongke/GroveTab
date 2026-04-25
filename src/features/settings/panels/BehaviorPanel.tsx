/**
 * BehaviorPanel —— 行为设置 Tab（重构版）
 *
 * 组件结构：
 * 1. GeneralSettings - 通用行为设置
 * 2. ViewLayoutSettings - 视图与布局设置
 * 3. TimelineSettings - 时间轴设置
 * 4. SearchSettings - 搜索设置
 * 5. DailyQuoteSettings - 每日金句设置
 */

import type { UserSettings } from '@/shared/types';
import { GeneralSettings } from './GeneralSettings';
import { ViewLayoutSettings } from './ViewLayoutSettings';
import { TimelineSettings } from './TimelineSettings';
import { SearchSettings } from './SearchSettings';
import { DailyQuoteSettings } from './DailyQuoteSettings';

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
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* 通用行为设置 */}
      <section>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'inherit' }}>
          通用行为
        </h3>
        <GeneralSettings settings={settings} updateSettings={updateSettings} />
      </section>

      {/* 视图与布局设置 */}
      <section>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'inherit' }}>
          视图与布局
        </h3>
        <ViewLayoutSettings settings={settings} updateSettings={updateSettings} />
      </section>

      {/* 时间轴设置 */}
      <section>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'inherit' }}>
          时间轴
        </h3>
        <TimelineSettings settings={settings} updateSettings={updateSettings} />
      </section>

      {/* 搜索设置 */}
      <section>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'inherit' }}>
          搜索
        </h3>
        <SearchSettings settings={settings} updateSettings={updateSettings} />
      </section>

      {/* 每日金句设置 */}
      <section>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'inherit' }}>
          每日金句
        </h3>
        <DailyQuoteSettings settings={settings} updateSettings={updateSettings} />
      </section>
    </div>
  );
}
