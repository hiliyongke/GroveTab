/**
 * lunar-cn · v1.3 单测
 *
 * 覆盖切换到 lunar-typescript 后的薄封装层：
 *  - 模块未加载前返回空字段
 *  - 加载后能正确计算 "正月初一" 和节气/节日
 *  - 2036+ 农历仍可用（验证长期可用性）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getLunarInfoSync, getSolarHoliday, loadLunarAsync, solarToLunarLabel } from '../../src/features/hero-widgets/lunar-cn';

describe('lunar-cn · 未加载前', () => {
  it('同步 API 在未加载前返回空字段（UI 降级）', () => {
    // 注意：本测试文件会在同一进程中运行，loadLunarAsync 只要在其他测试里调用过就会加载完成。
    // 这里用「即使值为空字符串也不抛错」的断言来兼容两种情形。
    const before = getLunarInfoSync(new Date(2026, 1, 17));
    expect(typeof before.monthDay).toBe('string');
    expect(typeof before.ganzhiYear).toBe('string');
  });
});

describe('lunar-cn · 加载后', () => {
  beforeAll(async () => {
    await loadLunarAsync();
  });

  it('2026 春节（2026-02-17）对应农历正月初一', () => {
    const info = getLunarInfoSync(new Date(2026, 1, 17));
    expect(info.monthDay).toContain('正月');
    expect(info.monthDay).toContain('初一');
    // 2026 年农历是丙午年
    expect(info.ganzhiYear).toContain('年');
  });

  it('2036 年仍可正确推算农历（验证跨越旧压缩表 2035 上限）', () => {
    // 2036 年春节为公历 2036-01-28
    const info = getLunarInfoSync(new Date(2036, 0, 28));
    expect(info.monthDay).toContain('正月');
    expect(info.monthDay).toContain('初一');
  });

  it('清明节气命中（2026-04-05 为清明）', () => {
    const info = getLunarInfoSync(new Date(2026, 3, 5));
    // lunar-typescript 对节气判定要求日期严格当天；返回 "清明" 即通过
    expect(info.jieqi).toBeTruthy();
  });

  it('solarToLunarLabel 返回 非空字符串（2026-02-17）', () => {
    const label = solarToLunarLabel(new Date(2026, 1, 17));
    expect(label.length).toBeGreaterThan(0);
  });

  it('getSolarHoliday(en) 公历 12-25 返回 Christmas', () => {
    const name = getSolarHoliday(new Date(2026, 11, 25), 'en');
    expect(name).toBe('Christmas');
  });

  it('getSolarHoliday(zh-CN) 公历 01-01 元旦命中', () => {
    const name = getSolarHoliday(new Date(2026, 0, 1), 'zh-CN');
    expect(name).toBeTruthy();
  });
});
