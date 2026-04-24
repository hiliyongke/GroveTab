/**
 * HeroWidgets —— 新标签页"仪表板三件套"统一容器
 *
 * 摆放：HeroBar 上方，居中；三件套水平排列，隔以纵向分隔线。
 *
 * 根据 settings.heroWidgets.layout 控制整体行为：
 *   - 'trio'         ：时钟 | 天气 | 日历（默认）
 *   - 'clockWeather' ：时钟 | 天气
 *   - 'clockOnly'    ：只显示时钟
 *   - 'hidden'       ：整块隐藏（同 uiVisibility.heroWidgets=false）
 *
 * 另：上层 settings.uiVisibility.heroWidgets=false 是"总闸"，优先级最高。
 */

import { theme } from 'antd';
import { useSettingsStore } from '@/store';
import { ClockWidget } from './ClockWidget';
import { WeatherWidget } from './WeatherWidget';
import { CalendarWidget } from './CalendarWidget';

export function HeroWidgets() {
  const { token } = theme.useToken();
  const uiVisibilityOn = useSettingsStore((s) => s.settings.uiVisibility?.heroWidgets);
  const layout = useSettingsStore((s) => s.settings.heroWidgets?.layout) ?? 'trio';

  // 总闸关闭 → 不渲染
  if (uiVisibilityOn === false || layout === 'hidden') return null;

  /** 纵向小分隔，提升三联视觉节律 */
  const Divider = () => (
    <span
      aria-hidden="true"
      style={{
        width: 1,
        height: 36,
        background: token.colorSplit,
        opacity: 0.6,
      }}
    />
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: '4px 16px',
        marginBottom: 4,
      }}
    >
      <ClockWidget />
      {(layout === 'trio' || layout === 'clockWeather') && (
        <>
          <Divider />
          <WeatherWidget />
        </>
      )}
      {layout === 'trio' && (
        <>
          <Divider />
          <CalendarWidget />
        </>
      )}
    </div>
  );
}
