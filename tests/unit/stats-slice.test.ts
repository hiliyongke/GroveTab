/**
 * Stats Slice 单元测试
 *
 * 覆盖：
 * - loadStats 的成功 / 数据损坏 / 异常三条分支
 * - getCountRecent 的窗口截断（≥ N 天）
 * - getTopUrls 的合计排序与 limit 截断
 * - data === null 时的空兜底
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/repositories", () => ({
  getStats: vi.fn(),
}));

import { useStatsStore } from "@/store";
import { getStats } from "@/repositories";

/** 把日期对象转成 SQL 风格的 yyyy-mm-dd 字符串（与项目内 toDayStr 同语义）。 */
function dayStr(offsetDays: number): string {
  const d = new Date(Date.now() - offsetDays * 86400_000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  useStatsStore.setState({ data: null, loaded: false, isFallback: false });
});

describe("loadStats", () => {
  it("加载成功后 loaded=true、isFallback=false", async () => {
    (getStats as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      daily: [],
      lastFlushAt: 0,
    });
    await useStatsStore.getState().loadStats();
    const s = useStatsStore.getState();
    expect(s.loaded).toBe(true);
    expect(s.isFallback).toBe(false);
  });

  it("仓库返回 undefined 时进入 fallback", async () => {
    (getStats as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await useStatsStore.getState().loadStats();
    expect(useStatsStore.getState().isFallback).toBe(true);
    expect(useStatsStore.getState().data).toBeNull();
  });

  it("数据缺少 daily 字段时 fallback", async () => {
    (getStats as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ lastFlushAt: 0 });
    await useStatsStore.getState().loadStats();
    expect(useStatsStore.getState().isFallback).toBe(true);
  });

  it("repo 抛异常时 fallback 而不是崩溃", async () => {
    (getStats as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("boom"));
    await useStatsStore.getState().loadStats();
    expect(useStatsStore.getState().isFallback).toBe(true);
    expect(useStatsStore.getState().loaded).toBe(true);
  });
});

describe("getCountRecent", () => {
  beforeEach(() => {
    useStatsStore.setState({
      data: {
        daily: [
          { day: dayStr(0), counts: { "https://a/": 5, "https://b/": 1 } },
          { day: dayStr(2), counts: { "https://a/": 3 } },
          { day: dayStr(8), counts: { "https://a/": 100 } }, // 超出 7 天窗口
        ],
        lastFlushAt: 0,
      },
      loaded: true,
      isFallback: false,
    });
  });

  it("默认 7 天窗口忽略更老的记录", () => {
    expect(useStatsStore.getState().getCountRecent("https://a/")).toBe(8);
  });

  it("不存在的 url 返回 0", () => {
    expect(useStatsStore.getState().getCountRecent("https://nope/")).toBe(0);
  });

  it("data 为 null 时返回 0", () => {
    useStatsStore.setState({ data: null });
    expect(useStatsStore.getState().getCountRecent("https://a/")).toBe(0);
  });

  it("自定义 days 影响窗口大小", () => {
    // 1 天窗口仅命中今天 5 次
    expect(useStatsStore.getState().getCountRecent("https://a/", 1)).toBe(5);
  });
});

describe("getTopUrls", () => {
  beforeEach(() => {
    useStatsStore.setState({
      data: {
        daily: [
          { day: dayStr(0), counts: { "https://a/": 5, "https://b/": 1, "https://c/": 9 } },
          { day: dayStr(1), counts: { "https://a/": 3 } },
        ],
        lastFlushAt: 0,
      },
      loaded: true,
      isFallback: false,
    });
  });

  it("按合计倒序排序", () => {
    const list = useStatsStore.getState().getTopUrls();
    expect(list[0]?.url).toBe("https://c/");
    expect(list[1]?.url).toBe("https://a/");
  });

  it("limit 截断结果", () => {
    expect(useStatsStore.getState().getTopUrls(7, 1).length).toBe(1);
  });

  it("data 为 null 时返回空数组", () => {
    useStatsStore.setState({ data: null });
    expect(useStatsStore.getState().getTopUrls()).toEqual([]);
  });

  it("合计计算正确：跨多日累加", () => {
    const list = useStatsStore.getState().getTopUrls();
    const a = list.find((it) => it.url === "https://a/");
    expect(a?.count).toBe(8);
  });
});
