/**
 * lunar-cn · v1.3
 *
 * 历史：v1.1 内置手写压缩表（2024-2035），v1.3 切换为 `lunar-typescript`，
 * 原生 TS、~20 KB gz，覆盖 1900-2100，长期可用，附带节气 / 干支 / 节日 / 宜忌。
 *
 * 体积控制：
 *   - 通过 `src/shared/lazy-deps.loadLunar()` 动态 `import('lunar-typescript')`，
 *     仅在 CalendarWidget 首次挂载时触发下载，首屏 0 影响。
 *   - 拉取到手后缓存到模块级 `_lunarModule`，后续所有查询直接命中内存。
 *
 * API（供 CalendarWidget 使用）：
 *   - `getLunarInfoSync(date)`   同步读缓存，未加载时返回空字段
 *   - `loadLunarAsync()`         触发异步加载（幂等，可多处调用）
 *   - `getSolarHoliday(date, locale)` 立即返回节日名（优先命中农历 → 公历）
 *   - 向后兼容：`solarToLunarLabel(date)`（同步，未就绪时返回 ''）
 */

import { loadLunar } from '@/shared/lazy-deps';

type LunarModule = typeof import('lunar-typescript');
let _lunarModule: LunarModule | null = null;
let _loadingPromise: Promise<LunarModule> | null = null;

/**
 * 按需加载 lunar-typescript 模块；幂等。
 * 组件可在 useEffect 里调用，加载完成后触发 setState 重新渲染。
 */
export function loadLunarAsync(): Promise<LunarModule> {
  if (_lunarModule !== null) return Promise.resolve(_lunarModule);
  _loadingPromise ??= loadLunar().then((mod) => {
    _lunarModule = mod;
    return mod;
  });
  return _loadingPromise;
}

export interface LunarInfo {
  /** 如 "正月初一" */
  monthDay: string;
  /** 如 "甲辰年" */
  ganzhiYear: string;
  /** 当日节气（若有） */
  jieqi?: string;
  /** 当日节日（农历/公历/法定任一命中） */
  festival?: string;
}

const EMPTY_INFO: LunarInfo = { monthDay: '', ganzhiYear: '' };

/** 同步读缓存；未加载时返回空字段（UI 层降级展示） */
export function getLunarInfoSync(date: Date): LunarInfo {
  if (_lunarModule === null) return EMPTY_INFO;
  try {
    const { Lunar, Solar } = _lunarModule;
    const lunar = Lunar.fromDate(date);
    const solar = Solar.fromDate(date);

    const monthDay = `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
    const ganzhiYear = `${lunar.getYearInGanZhi()}年`;

    // 节气：当日恰逢节气才有值
    const jieqi = lunar.getJieQi() || undefined;

    // 节日合并：农历节日 → 公历节日 → 法定节假日（getFestivals 均涵盖）
    const lunarFestivals = lunar.getFestivals();
    const solarFestivals = solar.getFestivals();
    const allFestivals = [...lunarFestivals, ...solarFestivals];
    const festival = allFestivals.length > 0 ? allFestivals[0] : undefined;

    return { monthDay, ganzhiYear, jieqi, festival };
  } catch {
    return EMPTY_INFO;
  }
}

/** 向后兼容：返回 "正月初一" 或空串（未就绪 / 超范围） */
export function solarToLunarLabel(date: Date): string {
  return getLunarInfoSync(date).monthDay;
}

/** 英文公历节日表（locale=en 时仍使用本地表，不依赖 lunar-typescript） */
const SOLAR_HOLIDAYS_EN: Record<string, string> = {
  '01-01': "New Year's Day",
  '02-14': "Valentine's Day",
  '03-08': "Women's Day",
  '05-01': 'Labour Day',
  '10-31': 'Halloween',
  '12-24': 'Christmas Eve',
  '12-25': 'Christmas',
  '12-31': "New Year's Eve",
};

/**
 * 获取当天节日名。中文 locale 优先使用 lunar-typescript 的节日合集；
 * 英文 locale 使用本地公历表。
 */
export function getSolarHoliday(date: Date, locale: string): string {
  if (locale === 'zh-CN') {
    const info = getLunarInfoSync(date);
    return info.festival ?? '';
  }
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  return SOLAR_HOLIDAYS_EN[`${mm}-${dd}`] ?? '';
}
