/**
 * 日期格式化工具单元测试
 */
import { describe, it, expect } from 'vitest';
import { toDayStrUTC, toDayStrLocal, formatDateKey, formatShortDateTime } from '@/shared/utils/date';

describe('toDayStrUTC', () => {
  it('应格式化为 YYYY-MM-DD（UTC）', () => {
    // 2024-01-15 08:30:00 UTC
    const date = new Date('2024-01-15T08:30:00.000Z');
    expect(toDayStrUTC(date)).toBe('2024-01-15');
  });

  it('应正确处理月末日期', () => {
    const date = new Date('2024-01-31T23:59:59.999Z');
    expect(toDayStrUTC(date)).toBe('2024-01-31');
  });

  it('应正确处理跨年日期', () => {
    const date = new Date('2023-12-31T00:00:00.000Z');
    expect(toDayStrUTC(date)).toBe('2023-12-31');
  });

  it('月和日应补零', () => {
    const date = new Date('2024-03-05T12:00:00.000Z');
    expect(toDayStrUTC(date)).toBe('2024-03-05');
  });

  it('不传参数时应返回当天 UTC 日期字符串', () => {
    const result = toDayStrUTC();
    // 验证格式为 YYYY-MM-DD
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('toDayStrLocal', () => {
  it('应格式化为 YYYY-MM-DD（本地时区）', () => {
    // 使用一个在所有时区都落在同一天的日期
    const date = new Date(2024, 0, 15, 12, 0, 0); // 2024-01-15 12:00 local
    expect(toDayStrLocal(date)).toBe('2024-01-15');
  });

  it('应正确处理月末日期', () => {
    const date = new Date(2024, 0, 31, 23, 59, 59);
    expect(toDayStrLocal(date)).toBe('2024-01-31');
  });

  it('月和日应补零', () => {
    const date = new Date(2024, 2, 5, 12, 0, 0); // March 5
    expect(toDayStrLocal(date)).toBe('2024-03-05');
  });

  it('不传参数时应返回当天本地日期字符串', () => {
    const result = toDayStrLocal();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatDateKey', () => {
  it('应把时间戳格式化为 YYYY-MM-DD（本地时区）', () => {
    // 2024-03-15 local noon
    const date = new Date(2024, 2, 15, 12, 0, 0);
    const ts = date.getTime();
    expect(formatDateKey(ts)).toBe('2024-03-15');
  });

  it('不传参数时应返回当天日期字符串', () => {
    const result = formatDateKey();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('应与 toDayStrLocal 结果一致', () => {
    const ts = new Date(2024, 5, 20, 15, 30, 0).getTime();
    expect(formatDateKey(ts)).toBe(toDayStrLocal(new Date(ts)));
  });
});

describe('formatShortDateTime', () => {
  it('英文 locale 应格式化为 "Mon D, HH:mm"', () => {
    // January 5, 14:30 local
    const date = new Date(2024, 0, 5, 14, 30, 0);
    expect(formatShortDateTime(date.getTime(), 'en')).toBe('Jan 5, 14:30');
  });

  it('中文 locale 应格式化为 "M月D日 HH:mm"', () => {
    // March 8, 09:05 local
    const date = new Date(2024, 2, 8, 9, 5, 0);
    expect(formatShortDateTime(date.getTime(), 'zh-CN')).toBe('3月8日 09:05');
  });

  it('默认 locale 应为英文', () => {
    const date = new Date(2024, 11, 25, 18, 0, 0); // Dec 25
    expect(formatShortDateTime(date.getTime())).toBe('Dec 25, 18:00');
  });

  it('小时和分钟应补零', () => {
    const date = new Date(2024, 0, 1, 0, 5, 0); // Jan 1, 00:05
    expect(formatShortDateTime(date.getTime(), 'en')).toBe('Jan 1, 00:05');
    expect(formatShortDateTime(date.getTime(), 'zh-CN')).toBe('1月1日 00:05');
  });

  it('应覆盖所有英文月份缩写', () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 0; i < 12; i++) {
      const date = new Date(2024, i, 10, 12, 0, 0);
      expect(formatShortDateTime(date.getTime(), 'en')).toBe(`${months[i]} 10, 12:00`);
    }
  });

  it('中文 locale 应正确处理两位数月份', () => {
    const date = new Date(2024, 10, 15, 10, 30, 0); // November
    expect(formatShortDateTime(date.getTime(), 'zh-CN')).toBe('11月15日 10:30');
  });
});
