/**
 * 开发工具栏页面 —— 专业开发者工作台
 *
 * 功能：
 *   - 紧凑工具列表 + 右侧工作台面板
 *   - 前端、后端、网络、数据、编码、加密等分类
 *   - 输入实时执行、复制输出、双向交换、错误提示
 *   - 收藏置顶 / 示例填充
 *   - 全部工具纯本地处理，零网络请求
 *
 * 所有工具均在主线程本地执行，不依赖 chrome.debugger API。
 */

import { useCallback, useMemo, useState } from "react";
import { Input, Tag, Typography } from "antd";
import {
  Braces,
  Clock,
  Code2,
  Dices,
  Globe2,
  Hash,
  Heart,
  Link,
  Palette,
  Search,
  Server,
  Shield,
  Star,
  Wrench,
} from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { translate } from "@/shared/i18n/core";
import { loadStringArray, saveStringArray } from "@/shared/utils/storage-array";
import { FeatureEmptyState } from "@/shared/ui/FeatureEmptyState";
import type { DevToolCategory, DevToolDefinition } from "./tool-registry";
import { DEV_TOOLS, searchTools } from "./tool-registry";
import styles from "./DevToolsView.module.less";
import { TOOL_ICONS } from "./components/ToolCard";
import { ToolPanel } from "./components/ToolPanel";

const { Title } = Typography;

const STORAGE_KEY_FAV = "devtools:favorites";

const CATEGORY_ICONS: Record<DevToolCategory, React.ReactNode> = {
  data: <Braces size={14} />,
  encoding: <Link size={14} />,
  time: <Clock size={14} />,
  crypto: <Shield size={14} />,
  number: <Hash size={14} />,
  generator: <Dices size={14} />,
  color: <Palette size={14} />,
  frontend: <Code2 size={14} />,
  backend: <Server size={14} />,
  network: <Globe2 size={14} />,
};

const CATEGORY_LABEL_KEYS: Record<DevToolCategory, string> = {
  data: translate("数据处理"),
  encoding: translate("编码转换"),
  time: translate("时间工具"),
  crypto: translate("加密哈希"),
  number: translate("数值计算"),
  generator: translate("随机生成"),
  color: translate("颜色工具"),
  frontend: translate("前端工具"),
  backend: translate("后端工具"),
  network: translate("网络工具"),
};

/**
 * 开发工具栏主页面
 *
 * 列表组织：
 *   - 左侧：侧边栏导航（搜索 + 按分类分组的工具列表）
 *   - 右侧：工具工作台
 */
export function DevToolsView() {
  const { t } = useT();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedToolId, setSelectedToolId] = useState(DEV_TOOLS[0]?.id ?? "json-format");
  const [favorites, setFavorites] = useState<string[]>(() => loadStringArray(STORAGE_KEY_FAV));

  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return DEV_TOOLS;
    return searchTools(searchQuery);
  }, [searchQuery]);

  const selectedTool = useMemo(
    () => DEV_TOOLS.find((tool) => tool.id === selectedToolId) ?? DEV_TOOLS[0]!,
    [selectedToolId],
  );

  /** 工具 id → 翻译标题/描述（缓存，避免每次渲染都调用 t()） */
  const toolTexts = useMemo(() => {
    const map: Record<string, { title: string; desc: string }> = {};
    DEV_TOOLS.forEach((tool) => {
      map[tool.id] = {
        title: t(tool.titleKey),
        desc: t(tool.descriptionKey),
      };
    });
    return map;
  }, [t]);

  const handleSelectTool = useCallback((toolId: string) => {
    setSelectedToolId(toolId);
  }, []);

  const handleToggleFavorite = useCallback((toolId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId];
      saveStringArray(STORAGE_KEY_FAV, next);
      return next;
    });
  }, []);

  const favoriteTools = useMemo(() => {
    if (favorites.length === 0) return [];
    const lookup = new Map(DEV_TOOLS.map((tool) => [tool.id, tool]));
    return favorites
      .map((id) => lookup.get(id))
      .filter((tool): tool is DevToolDefinition => Boolean(tool))
      .filter((tool) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        const texts = toolTexts[tool.id];
        return (
          tool.id.toLowerCase().includes(q) ||
          (texts?.title.toLowerCase().includes(q) ?? false) ||
          (texts?.desc.toLowerCase().includes(q) ?? false)
        );
      });
  }, [favorites, searchQuery, toolTexts]);

  const hiddenIds = useMemo(() => new Set(favoriteTools.map((tool) => tool.id)), [favoriteTools]);

  const groupedTools = useMemo(() => {
    const groups: Array<{ category: string; label: React.ReactNode; tools: DevToolDefinition[] }> =
      [];

    if (favoriteTools.length > 0) {
      groups.push({
        category: "favorites",
        label: (
          <span className={styles["devtools-sidebar-group-title"]}>
            <Star size={12} className={styles["devtools-sidebar-group-icon-fav"]} />
            {t('收藏')}
          </span>
        ),
        tools: favoriteTools,
      });
    }

    const categories = Object.keys(CATEGORY_LABEL_KEYS) as DevToolCategory[];
    categories.forEach((cat) => {
      const toolsInCat = filteredTools.filter((t) => t.category === cat && !hiddenIds.has(t.id));
      if (toolsInCat.length > 0) {
        groups.push({
          category: cat,
          label: (
            <span className={styles["devtools-sidebar-group-title"]}>
              {CATEGORY_ICONS[cat]}
              {t(CATEGORY_LABEL_KEYS[cat])}
            </span>
          ),
          tools: toolsInCat,
        });
      }
    });

    return groups;
  }, [filteredTools, favoriteTools, hiddenIds, t]);

  return (
    <section className={styles["devtools-page"]}>
      <div className={styles["devtools-shell"]}>
        <aside className={styles["devtools-sidebar"]}>
          <div className={styles["devtools-sidebar-header"]}>
            <div className={styles["devtools-brand"]}>
              <span className={styles["devtools-logo"]}>
                <Wrench size={ICON_SIZE.LARGE} />
              </span>
              <Title level={5} className={styles["devtools-title"]}>
                {t('开发工具栏')}
              </Title>
            </div>
          </div>

          <div className={styles["devtools-sidebar-search"]}>
            <Input
              prefix={<Search size={14} />}
              placeholder={t('搜索工具…')}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              allowClear
            />
          </div>

          <div className={styles["devtools-sidebar-menu"]}>
            {groupedTools.length > 0 ? (
              groupedTools.map((group) => (
                <div key={group.category} className={styles["devtools-sidebar-group"]}>
                  {group.label}
                  <div className={styles["devtools-sidebar-group-list"]}>
                    {group.tools.map((tool) => (
                      <div
                        key={tool.id}
                        className={`${styles["devtools-sidebar-item"]} ${selectedToolId === tool.id ? styles["is-active"] : ""}`}
                        onClick={() => handleSelectTool(tool.id)}
                      >
                        <span className={styles["devtools-sidebar-item-icon"]}>
                          {TOOL_ICONS[tool.id] ?? <Wrench size={14} />}
                        </span>
                        <span className={styles["devtools-sidebar-item-title"]}>
                          {toolTexts[tool.id]?.title ?? tool.titleKey}
                        </span>
                        <span
                          className={`${styles["devtools-sidebar-item-fav"]} ${favorites.includes(tool.id) ? styles["is-active"] : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(tool.id);
                          }}
                        >
                          <Heart size={12} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <FeatureEmptyState
              title={t("未找到匹配的工具")}
              description={t("搜索无结果")}
              icon={<Search size={ICON_SIZE.LARGE} />}
              hints={[t("尝试不同的关键词"), t("检查拼写是否正确")]}
            />
            )}
          </div>

          <div className={styles["devtools-sidebar-footer"]}>
            <Shield size={12} />
            <span>{t('所有工具均在本地处理，输入内容不会上传到任何服务器')}</span>
          </div>
        </aside>

        <main className={styles["devtools-main"]}>
          <div className={styles["devtools-main-header"]}>
            <div className={styles["devtools-main-title-row"]}>
              <span className={styles["devtools-main-icon"]}>
                {TOOL_ICONS[selectedTool.id] ?? <Wrench size={ICON_SIZE.LARGE} />}
              </span>
              <Title level={4} className={styles["devtools-main-title"]}>
                {toolTexts[selectedTool.id]?.title ?? selectedTool.titleKey}
              </Title>
              <Tag color="green" className={styles["devtools-tag-local"]}>
                {t('本地处理')}
              </Tag>
              <span
                className={`${styles["devtools-main-fav-btn"]} ${favorites.includes(selectedTool.id) ? styles["is-active"] : ""}`}
                onClick={() => handleToggleFavorite(selectedTool.id)}
              >
                <Heart size={16} />
              </span>
            </div>
            <div className={styles["devtools-main-desc"]}>
              {toolTexts[selectedTool.id]?.desc ?? selectedTool.descriptionKey}
            </div>
          </div>

          <div className={styles["devtools-main-body"]}>
            <ToolPanel tool={selectedTool} onUse={() => handleSelectTool(selectedTool.id)} />
          </div>
        </main>
      </div>
    </section>
  );
}
