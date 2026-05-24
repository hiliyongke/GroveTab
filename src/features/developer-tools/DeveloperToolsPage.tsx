/**
 * 开发工具栏页面 —— 专业开发者工作台
 *
 * 功能：
 *   - 紧凑工具列表 + 右侧工作台面板
 *   - 前端、后端、网络、数据、编码、加密等分类
 *   - 输入实时执行、复制输出、双向交换、错误提示
 *   - 收藏置顶 / 示例填充
 *   - 全部工具纯本地处理，零网络请求
 */

import { useCallback, useMemo, useState } from "react";
import { Empty, Input, Segmented, Tag, Typography } from "antd";
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
import { loadStringArray, saveStringArray } from "@/shared/utils/storage-array";
import type { DevToolCategory, DevToolDefinition } from "./tool-registry";
import { DEV_TOOLS, getToolsByCategory, searchTools } from "./tool-registry";
import styles from "./DeveloperToolsPage.module.less";
import { ToolCard, TOOL_ICONS } from "./components/ToolCard";
import { ToolPanel } from "./components/ToolPanel";

const { Title } = Typography;

const STORAGE_KEY_FAV = "devtools:favorites";

const CATEGORY_ICONS: Record<DevToolCategory, React.ReactNode> = {
  data: <Braces size={ICON_SIZE.DEFAULT} />,
  encoding: <Link size={ICON_SIZE.DEFAULT} />,
  time: <Clock size={ICON_SIZE.DEFAULT} />,
  crypto: <Shield size={ICON_SIZE.DEFAULT} />,
  number: <Hash size={ICON_SIZE.DEFAULT} />,
  generator: <Dices size={ICON_SIZE.DEFAULT} />,
  color: <Palette size={ICON_SIZE.DEFAULT} />,
  frontend: <Code2 size={ICON_SIZE.DEFAULT} />,
  backend: <Server size={ICON_SIZE.DEFAULT} />,
  network: <Globe2 size={ICON_SIZE.DEFAULT} />,
};

const CATEGORY_LABEL_KEYS: Record<DevToolCategory, string> = {
  data: "devtools.catData",
  encoding: "devtools.catEncoding",
  time: "devtools.catTime",
  crypto: "devtools.catCrypto",
  number: "devtools.catNumber",
  generator: "devtools.catGenerator",
  color: "devtools.catColor",
  frontend: "devtools.catFrontend",
  backend: "devtools.catBackend",
  network: "devtools.catNetwork",
};

/**
 * 开发工具栏主页面
 *
 * 列表组织：
 *   - 顶部：收藏区（仅当无搜索 / category=all 时展示）
 *   - 主体：根据分类与搜索过滤后的工具列表
 *   - 收藏区与主列表共用同一份 React 渲染逻辑，避免手动 DOM 操作引发的状态错位
 */
export function DeveloperToolsPage() {
  const { t } = useT();
  const [category, setCategory] = useState<DevToolCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedToolId, setSelectedToolId] = useState(DEV_TOOLS[0]?.id ?? "json-format");
  const [favorites, setFavorites] = useState<string[]>(() => loadStringArray(STORAGE_KEY_FAV));

  const categoryCounts = useMemo(
    () =>
      DEV_TOOLS.reduce<Record<string, number>>((acc, tool) => {
        acc[tool.category] = (acc[tool.category] ?? 0) + 1;
        return acc;
      }, {}),
    [],
  );

  const categoryOptions = useMemo(
    () => [
      {
        value: "all" as const,
        label: (
          <span className={styles["devtools-category-label"]}>
            <Wrench size={ICON_SIZE.DEFAULT} />
            {t("devtools.catAll")} · {DEV_TOOLS.length}
          </span>
        ),
      },
      ...Object.entries(CATEGORY_LABEL_KEYS).map(([cat, key]) => ({
        value: cat as DevToolCategory,
        label: (
          <span className={styles["devtools-category-label"]}>
            {CATEGORY_ICONS[cat as DevToolCategory]}
            {t(key)} · {categoryCounts[cat] ?? 0}
          </span>
        ),
      })),
    ],
    [categoryCounts, t],
  );

  const filteredTools = useMemo(() => {
    const byCategory = getToolsByCategory(category);
    if (!searchQuery.trim()) return byCategory;
    return searchTools(searchQuery).filter(
      (tool) => category === "all" || tool.category === category,
    );
  }, [category, searchQuery]);

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

  /** 收藏区是否展示：无搜索时即可展示，分类筛选时也允许展示（仅显示该分类下的收藏） */
  const favoriteTools = useMemo(() => {
    if (favorites.length === 0) return [];
    const lookup = new Map(DEV_TOOLS.map((tool) => [tool.id, tool]));
    return favorites
      .map((id) => lookup.get(id))
      .filter((tool): tool is DevToolDefinition => Boolean(tool))
      .filter((tool) => category === "all" || tool.category === category)
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
  }, [favorites, category, searchQuery, toolTexts]);

  /** 主列表中需要隐藏（已在收藏区展示）的工具 id */
  const hiddenIds = useMemo(() => new Set(favoriteTools.map((tool) => tool.id)), [favoriteTools]);

  return (
    <section className={styles["devtools-page"]}>
      <div className={styles["devtools-shell"]}>
        <header className={styles["devtools-hero"]}>
          <div className={styles["devtools-title-row"]}>
            <div className={styles["devtools-brand"]}>
              <span className={styles["devtools-logo"]}>
                <Wrench size={ICON_SIZE.LARGE} />
              </span>
              <Title level={4} className={styles["devtools-title"]}>
                {t("devtools.title")}
              </Title>
              <Tag
                color="green"
                className={`${styles["devtools-tag"]} ${styles["devtools-tag--local"]}`}
              >
                {t("devtools.localOnly")}
              </Tag>
            </div>
            <div className={styles["devtools-stats"]}>
              <span className={styles["devtools-stat-pill"]}>{DEV_TOOLS.length} tools</span>
              <span className={styles["devtools-stat-pill"]}>
                {Object.keys(categoryCounts).length} categories
              </span>
              <span className={styles["devtools-stat-pill"]}>100% local</span>
            </div>
          </div>
          <div className={styles["devtools-subtitle"]}>{t("devtools.subtitle")}</div>
        </header>

        <div className={styles["devtools-toolbar"]}>
          <Segmented
            value={category}
            onChange={(value) => setCategory(value)}
            options={categoryOptions}
            size="small"
            className={styles["devtools-segmented"]}
          />
          <Input
            prefix={<Search size={14} />}
            placeholder={t("devtools.searchPlaceholder")}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            allowClear
            size="small"
            className={styles["devtools-search"]}
          />
        </div>

        <div className={styles["devtools-workbench"]}>
          <div className={styles["devtools-list-pane"]}>
            {favoriteTools.length > 0 && (
              <div className={styles["devtools-section"]}>
                <div className={styles["devtools-section-head"]}>
                  <Star
                    size={14}
                    className={`${styles["devtools-section-icon"]} ${styles["devtools-section-icon--fav"]}`}
                  />
                  <strong className={styles["devtools-section-title"]}>
                    {t("devtools.favorites")}
                  </strong>
                </div>
                <div className={styles["devtools-grid"]}>
                  {favoriteTools.map((tool) => (
                    <ToolCard
                      key={`fav-${tool.id}`}
                      tool={tool}
                      title={toolTexts[tool.id]?.title ?? tool.titleKey}
                      description={toolTexts[tool.id]?.desc ?? tool.descriptionKey}
                      selected={selectedToolId === tool.id}
                      favorited
                      onClick={() => handleSelectTool(tool.id)}
                      onToggleFavorite={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(tool.id);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            {filteredTools
              .filter((tool) => !hiddenIds.has(tool.id))
              .map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  title={toolTexts[tool.id]?.title ?? tool.titleKey}
                  description={toolTexts[tool.id]?.desc ?? tool.descriptionKey}
                  selected={selectedToolId === tool.id}
                  favorited={favorites.includes(tool.id)}
                  onClick={() => handleSelectTool(tool.id)}
                  onToggleFavorite={(e) => {
                    e.stopPropagation();
                    handleToggleFavorite(tool.id);
                  }}
                />
              ))}
            {filteredTools.length === 0 && (
              <Empty
                description={t("devtools.searchPlaceholder")}
                className={styles["devtools-empty-state"]}
              />
            )}
          </div>

          <aside className={styles["devtools-panel-pane"]}>
            <div className={styles["devtools-panel-card"]}>
              <div className={styles["devtools-panel-head"]}>
                <div className={styles["devtools-panel-title"]}>
                  <span className={styles["devtools-panel-icon"]}>
                    {TOOL_ICONS[selectedTool.id] ?? <Wrench size={ICON_SIZE.LARGE} />}
                  </span>
                  <Title level={5} className={styles["devtools-panel-heading"]}>
                    {toolTexts[selectedTool.id]?.title ?? selectedTool.titleKey}
                  </Title>
                  <span
                    className={`devtools-fav-btn${favorites.includes(selectedTool.id) ? " is-active" : ""}`}
                    onClick={() => handleToggleFavorite(selectedTool.id)}
                    role="button"
                    tabIndex={0}
                    aria-label="收藏"
                  >
                    <Heart size={14} />
                  </span>
                </div>
                <div className={styles["devtools-panel-desc"]}>
                  {toolTexts[selectedTool.id]?.desc ?? selectedTool.descriptionKey}
                </div>
              </div>
              <div className={styles["devtools-panel-body"]}>
                <ToolPanel tool={selectedTool} onUse={() => handleSelectTool(selectedTool.id)} />
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div className={styles["devtools-privacy"]}>
        <Shield size={12} />
        <span>{t("devtools.privacyNote")}</span>
      </div>
    </section>
  );
}
