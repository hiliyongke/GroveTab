/**
 * Speed Dial Slice 单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock 外部依赖
vi.mock("@/repositories", () => ({
  getSpeedDialSites: vi.fn().mockResolvedValue([]),
  addSpeedDialSite: vi.fn().mockResolvedValue([]),
  updateSpeedDialSite: vi.fn().mockResolvedValue([]),
  removeSpeedDialSite: vi.fn().mockResolvedValue([]),
  reorderSpeedDialSites: vi.fn().mockResolvedValue([]),
}));

import { useSpeedDialStore } from "@/store/speed-dial-slice";
import {
  getSpeedDialSites,
  addSpeedDialSite as repoAdd,
  updateSpeedDialSite as repoUpdate,
  removeSpeedDialSite as repoRemove,
  reorderSpeedDialSites as repoReorder,
} from "@/repositories";
import type { SpeedDialSite } from "@/shared/types";

const mkSite = (id: string, url: string, order: number, group?: string): SpeedDialSite => ({
  id,
  url,
  title: url,
  order,
  createdAt: Date.now(),
  ...(group ? { group } : {}),
});

beforeEach(() => {
  vi.clearAllMocks();
  useSpeedDialStore.setState({
    sites: [],
    loaded: false,
  });
});

describe("loadSites", () => {
  it("从 storage 加载站点列表", async () => {
    const sites = [mkSite("1", "https://a.com", 0), mkSite("2", "https://b.com", 1)];
    (getSpeedDialSites as ReturnType<typeof vi.fn>).mockResolvedValueOnce(sites);
    await useSpeedDialStore.getState().loadSites();
    expect(useSpeedDialStore.getState().sites.length).toBe(2);
    expect(useSpeedDialStore.getState().loaded).toBe(true);
  });
});

describe("addSite", () => {
  it("添加站点", async () => {
    const newSite = mkSite("1", "https://a.com", 0);
    const updatedSites = [newSite];
    (repoAdd as ReturnType<typeof vi.fn>).mockResolvedValueOnce(updatedSites);
    await useSpeedDialStore.getState().addSite(newSite);
    expect(useSpeedDialStore.getState().sites.length).toBe(1);
    expect(useSpeedDialStore.getState().sites[0].id).toBe("1");
    expect(repoAdd).toHaveBeenCalledWith(newSite);
  });

  it("添加失败时不改变 sites", async () => {
    (repoAdd as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("fail"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await useSpeedDialStore.getState().addSite(mkSite("1", "https://a.com", 0));
    expect(useSpeedDialStore.getState().sites.length).toBe(0);
    consoleSpy.mockRestore();
  });
});

describe("removeSite", () => {
  it("删除站点", async () => {
    const site1 = mkSite("1", "https://a.com", 0);
    const site2 = mkSite("2", "https://b.com", 1);
    useSpeedDialStore.setState({ sites: [site1, site2] });

    (repoRemove as ReturnType<typeof vi.fn>).mockResolvedValueOnce([site2]);
    await useSpeedDialStore.getState().removeSite("1");
    expect(useSpeedDialStore.getState().sites.length).toBe(1);
    expect(useSpeedDialStore.getState().sites[0].id).toBe("2");
    expect(repoRemove).toHaveBeenCalledWith("1");
  });
});

describe("updateSite", () => {
  it("更新站点", async () => {
    const site1 = mkSite("1", "https://a.com", 0);
    useSpeedDialStore.setState({ sites: [site1] });

    const updated = { ...site1, title: "New Title" };
    (repoUpdate as ReturnType<typeof vi.fn>).mockResolvedValueOnce([updated]);
    await useSpeedDialStore.getState().updateSite({ id: "1", title: "New Title" });
    expect(useSpeedDialStore.getState().sites[0].title).toBe("New Title");
    expect(repoUpdate).toHaveBeenCalledWith({ id: "1", title: "New Title" });
  });
});

describe("reorderSites", () => {
  it("拖拽重排站点顺序", async () => {
    const site1 = mkSite("1", "https://a.com", 0);
    const site2 = mkSite("2", "https://b.com", 1);
    const site3 = mkSite("3", "https://c.com", 2);
    useSpeedDialStore.setState({ sites: [site1, site2, site3] });

    const reordered = [site2, site3, site1];
    (repoReorder as ReturnType<typeof vi.fn>).mockResolvedValueOnce(reordered);
    await useSpeedDialStore.getState().reorderSites(["2", "3", "1"]);
    const ids = useSpeedDialStore.getState().sites.map((s) => s.id);
    expect(ids).toEqual(["2", "3", "1"]);
    expect(repoReorder).toHaveBeenCalledWith(["2", "3", "1"]);
  });
});

describe("分组操作", () => {
  it("添加带分组的站点", async () => {
    const site = mkSite("1", "https://a.com", 0, "work");
    (repoAdd as ReturnType<typeof vi.fn>).mockResolvedValueOnce([site]);
    await useSpeedDialStore.getState().addSite(site);
    expect(useSpeedDialStore.getState().sites[0].group).toBe("work");
  });

  it("更新站点分组", async () => {
    const site = mkSite("1", "https://a.com", 0, "work");
    useSpeedDialStore.setState({ sites: [site] });

    const updated = { ...site, group: "personal" };
    (repoUpdate as ReturnType<typeof vi.fn>).mockResolvedValueOnce([updated]);
    await useSpeedDialStore.getState().updateSite({ id: "1", group: "personal" });
    expect(useSpeedDialStore.getState().sites[0].group).toBe("personal");
  });

  it("删除分组后站点变为未分组", async () => {
    const site = mkSite("1", "https://a.com", 0, "work");
    useSpeedDialStore.setState({ sites: [site] });

    const updated = { ...site, group: undefined };
    (repoUpdate as ReturnType<typeof vi.fn>).mockResolvedValueOnce([updated]);
    await useSpeedDialStore.getState().updateSite({ id: "1", group: undefined });
    expect(useSpeedDialStore.getState().sites[0].group).toBeUndefined();
  });
});
