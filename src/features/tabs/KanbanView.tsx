/* eslint-disable react-hooks/refs */

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Input,
  Popconfirm,
  theme,
  App as AntApp,
  Image,
  Typography,
  Space,
} from "antd";
import { Plus, Trash2, Save, PenLine, X, GripVertical } from "lucide-react";
import { cssVars } from "@/shared/utils/css-vars";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { KanbanCard, KanbanColumn } from "@/shared/types";
import { useKanbanStore, useTabsStore } from "@/store";
import { archiveSelectedTabs } from "@/services";
import { useT } from "@/shared/i18n";
import { useReducedMotionPreference } from "@/shared/hooks/use-reduced-motion";
import styles from "./styles/views.module.less";

/** 拖拽数据类型：区分「源 tab」「列内卡片」「列自身」 */
type DragData =
  | { kind: "tab-source"; card: KanbanCard }
  | { kind: "card"; columnId: string; url: string }
  | { kind: "column"; columnId: string };

interface ActiveDrag {
  id: string;
  data: DragData;
}

export function KanbanView() {
  const { token } = theme.useToken();
  const { t } = useT();
  const { message } = AntApp.useApp();
  const columns = useKanbanStore((s) => s.columns);
  const loaded = useKanbanStore((s) => s.loaded);
  const loadKanban = useKanbanStore((s) => s.loadKanban);
  const addColumn = useKanbanStore((s) => s.addColumn);
  const renameColumn = useKanbanStore((s) => s.renameColumn);
  const removeColumn = useKanbanStore((s) => s.removeColumn);
  const addCard = useKanbanStore((s) => s.addCard);
  const removeCard = useKanbanStore((s) => s.removeCard);
  const moveCard = useKanbanStore((s) => s.moveCard);
  const reorderCard = useKanbanStore((s) => s.reorderCard);
  const reorderColumns = useKanbanStore((s) => s.reorderColumns);
  const tabs = useTabsStore((s) => s.tabs);
  const reduced = useReducedMotionPreference();

  useEffect(() => {
    if (!loaded) void loadKanban();
  }, [loaded, loadKanban]);

  const liveUrls = useMemo(() => new Set(tabs.map((t) => t.url)), [tabs]);
  const [newColumnName, setNewColumnName] = useState("");
  const [active, setActive] = useState<ActiveDrag | null>(null);

  // Sensors: 指针（拖动需 6px 激活，避免点击误触）、触屏（按住 200ms）、键盘
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const kanbanThemeStyle: React.CSSProperties = cssVars({
    "--app-kanban-source-bg": token.colorFillQuaternary,
    "--app-kanban-surface-bg": token.colorBgContainer,
    "--app-kanban-border": token.colorBorderSecondary,
    "--app-kanban-column-bg": token.colorFillQuaternary,
    "--app-kanban-column-hover-bg": token.colorPrimaryBg,
    "--app-kanban-overlay-border": token.colorPrimary,
    "--app-kanban-overlay-shadow": token.boxShadowSecondary,
  });

  const handleAddColumn = async () => {
    const name = newColumnName.trim();
    if (name === "") return;
    try {
      await addColumn(name);
      setNewColumnName("");
      message.success(t("kanban.addColumnOk", { name }));
    } catch (err) {
      message.error(t("kanban.addFailed"));
      console.warn("[kanban] addColumn failed", err);
    }
  };

  const handleSaveAsSession = async (col: KanbanColumn) => {
    const live = tabs.filter((t) => col.cards.some((c) => c.url === t.url));
    if (live.length === 0) {
      message.warning(t("kanban.emptyColumn"));
      return;
    }
    try {
      await archiveSelectedTabs(live.map((t) => t.id));
      message.success(t("archive.archivedOk", { count: live.length }));
    } catch (err) {
      message.error(t("kanban.archiveFailed"));
      console.warn("[kanban] archive failed", err);
    }
  };

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (!data) return;
    setActive({ id: String(event.active.id), data });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active: a, over } = event;
    setActive(null);
    if (!over) return;
    const activeData = a.data.current as DragData | undefined;
    const overData = over.data.current as
      | { kind: "card"; columnId: string; url: string }
      | { kind: "column-body"; columnId: string }
      | { kind: "column"; columnId: string }
      | undefined;
    if (!activeData) return;

    try {
      // 1) 源 Tab 拖入列或卡片位置 → addCard（不关闭原 Tab）
      if (activeData.kind === "tab-source") {
        const destCol =
          overData?.kind === "card"
            ? overData.columnId
            : overData?.kind === "column-body"
              ? overData.columnId
              : overData?.kind === "column"
                ? overData.columnId
                : null;
        if (!destCol) return;
        await addCard(destCol, activeData.card);
        return;
      }

      // 2) 卡片拖动
      if (activeData.kind === "card") {
        // 拖到列空白处 → 移动到该列末尾
        if (overData?.kind === "column-body") {
          if (overData.columnId === activeData.columnId) return;
          await moveCard(activeData.columnId, overData.columnId, activeData.url);
          return;
        }
        // 拖到某卡片上 → 列内 reorder 或跨列移动到该卡片前
        if (overData?.kind === "card") {
          // 同列 reorder
          if (overData.columnId === activeData.columnId) {
            const col = columns.find((c) => c.id === activeData.columnId);
            if (!col) return;
            const fromIndex = col.cards.findIndex((c) => c.url === activeData.url);
            const toIndex = col.cards.findIndex((c) => c.url === overData.url);
            if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
            await reorderCard(activeData.columnId, fromIndex, toIndex);
            return;
          }
          // 跨列移动到目标卡前
          const destCol = columns.find((c) => c.id === overData.columnId);
          const toIndex = destCol?.cards.findIndex((c) => c.url === overData.url) ?? undefined;
          await moveCard(activeData.columnId, overData.columnId, activeData.url, toIndex);
          return;
        }
      }

      // 3) 列排序
      if (activeData.kind === "column" && overData?.kind === "column") {
        if (activeData.columnId === overData.columnId) return;
        const fromIndex = columns.findIndex((c) => c.id === activeData.columnId);
        const toIndex = columns.findIndex((c) => c.id === overData.columnId);
        if (fromIndex < 0 || toIndex < 0) return;
        await reorderColumns(fromIndex, toIndex);
      }
    } catch (err) {
      message.error(t("kanban.dragFailed"));
      console.warn("[kanban] drag operation failed", err);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={(e) => void onDragEnd(e)}
      onDragCancel={() => setActive(null)}
    >
      <div className={styles["app-kanban-theme"]} style={kanbanThemeStyle}>
        <div className={styles["app-kanban-view"]}>
          {/* 左侧：实时 Tab 源栏 —— 只作为拖出源，不是排序目标 */}
          <Space direction="vertical" size={0} className={styles["app-kanban-source"]}>
            <Typography.Text className={styles["app-kanban-source__title"]}>
              {t("kanban.title")}
            </Typography.Text>
            {tabs.map((tab) => (
              <TabSourceItem
                key={tab.id}
                card={{
                  url: tab.url,
                  title: tab.title,
                  favIconUrl: tab.favIconUrl,
                  addedAt: 0,
                }}
                reduced={reduced}
              />
            ))}
          </Space>

          {/* 右侧：列排序层 —— 每列作为一个可排序单元 */}
          <SortableContext
            items={columns.map((c) => `col::${c.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {columns.map((col) => (
              <KanbanColumnView
                key={col.id}
                col={col}
                liveUrls={liveUrls}
                tabs={tabs}
                t={t}
                reduced={reduced}
                onRename={(name) => void renameColumn(col.id, name)}
                onRemove={() => {
                  removeColumn(col.id).catch((err) => {
                    message.error(t("kanban.removeColumnFailed"));
                    console.warn("[kanban] removeColumn failed", err);
                  });
                }}
                onSaveAsSession={() => void handleSaveAsSession(col)}
                onRemoveCard={(url) => {
                  removeCard(col.id, url).catch((err) => {
                    message.error(t("kanban.removeCardFailed"));
                    console.warn("[kanban] removeCard failed", err);
                  });
                }}
              />
            ))}
          </SortableContext>

          {/* 新增列 */}
          <Space direction="vertical" size={0} className={styles["app-kanban-add-column"]}>
            <Input
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onPressEnter={() => void handleAddColumn()}
              placeholder={t("kanban.addColumn")}
              suffix={
                <Button
                  size="small"
                  type="text"
                  icon={<Plus size={ICON_SIZE.SMALL} />}
                  onClick={() => void handleAddColumn()}
                />
              }
            />
          </Space>
        </div>
      </div>

      {/* DragOverlay：拖拽时渲染的抬升副本 */}
      <DragOverlay dropAnimation={null}>
        {active ? <DragPreview active={active} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── 子组件：源 Tab 卡片 ──────────────────────────────────
function TabSourceItem({ card, reduced }: { card: KanbanCard; reduced: boolean }) {
  const id = `tab-source::${card.url}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { kind: "tab-source", card } satisfies DragData,
  });
  const sourceItemStyle: React.CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
    transform: CSS.Translate.toString(transform),
    transition: reduced ? "none" : transition,
  };

  return (
    <Space
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`${styles["app-kanban-card"]} ${styles["app-kanban-card--source"]}`}
      style={sourceItemStyle}
    >
      {card.favIconUrl !== undefined && card.favIconUrl !== "" && (
        <Image
          src={card.favIconUrl}
          alt=""
          preview={false}
          width={12}
          height={12}
          className={styles["app-kanban-card__favicon"]}
        />
      )}
      <Typography.Text className={styles["app-kanban-card__title"]} title={card.title}>
        {card.title}
      </Typography.Text>
    </Space>
  );
}

// ── 子组件：单列 ──────────────────────────────────
interface KanbanColumnViewProps {
  col: KanbanColumn;
  liveUrls: Set<string>;
  tabs: Array<{ id: number; url: string; windowId: number }>;
  t: (key: string, params?: Record<string, string | number>) => string;
  reduced: boolean;
  onRename: (name: string) => void;
  onRemove: () => void;
  onSaveAsSession: () => void;
  onRemoveCard: (url: string) => void;
}

function KanbanColumnView({
  col,
  liveUrls,
  tabs,
  t,
  reduced,
  onRename,
  onRemove,
  onSaveAsSession,
  onRemoveCard,
}: KanbanColumnViewProps) {
  // 整列拖拽（useSortable 把列作为 SortableContext 中的一项）
  const sortable = useSortable({
    id: `col::${col.id}`,
    data: { kind: "column", columnId: col.id } satisfies DragData,
  });

  // 列空白处作为 droppable，用于"拖到空白/末尾"
  const body = useDroppable({
    id: `col-body::${col.id}`,
    data: { kind: "column-body", columnId: col.id },
  });

  const columnWrapStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: reduced ? "none" : sortable.transition,
    opacity: sortable.isDragging ? 0.5 : 1,
  };

  const columnCardStyle: React.CSSProperties = {
    transition: reduced ? "none" : "background 120ms",
  };

  return (
    <div
      ref={sortable.setNodeRef}
      className={styles["app-kanban-column-wrap"]}
      style={columnWrapStyle}
    >
      <Card
        size="small"
        className={`${styles["app-kanban-column"]}${body.isOver ? ` ${styles["is-over"]}` : ""}`}
        style={columnCardStyle}
        classNames={{ body: styles["app-kanban-column__body"] }}
        title={
          <span className={styles["app-kanban-column__header"]}>
            {/* 列拖拽句柄 —— 只有点住这里才能拖整列 */}
            <Button
              type="text"
              size="small"
              icon={<GripVertical size={ICON_SIZE.TINY} />}
              {...sortable.attributes}
              {...sortable.listeners}
              className={styles["app-kanban-column__drag-handle"]}
              aria-label={t("kanban.renameColumn")}
            />
            <ColumnNameEditor col={col} onRename={onRename} />
            <Typography.Text className={styles["app-kanban-column__count"]}>
              {col.cards.length}
            </Typography.Text>
            <Button
              type="text"
              size="small"
              icon={<Save size={ICON_SIZE.TINY} />}
              onClick={onSaveAsSession}
              title={t("kanban.saveAsSession")}
            />
            <Popconfirm title={t("kanban.removeColumn")} onConfirm={onRemove}>
              <Button type="text" size="small" icon={<Trash2 size={ICON_SIZE.TINY} />} />
            </Popconfirm>
          </span>
        }
      >
        <div ref={body.setNodeRef} className={styles["app-kanban-column__dropzone"]}>
          <SortableContext
            items={col.cards.map((c) => `card::${col.id}::${c.url}`)}
            strategy={verticalListSortingStrategy}
          >
            {col.cards.length === 0 ? (
              <Typography.Text className={styles["app-kanban-column__empty"]}>
                {t("kanban.emptyColumn")}
              </Typography.Text>
            ) : (
              col.cards.map((card) => (
                <SortableCard
                  key={card.url}
                  card={card}
                  columnId={col.id}
                  offline={!liveUrls.has(card.url)}
                  tabs={tabs}
                  t={t}
                  reduced={reduced}
                  onRemove={() => onRemoveCard(card.url)}
                />
              ))
            )}
          </SortableContext>
        </div>
      </Card>
    </div>
  );
}

// ── 子组件：列内卡片 ──────────────────────────────────
interface SortableCardProps {
  card: KanbanCard;
  columnId: string;
  offline: boolean;
  tabs: Array<{ id: number; url: string; windowId: number }>;
  t: (key: string, params?: Record<string, string | number>) => string;
  reduced: boolean;
  onRemove: () => void;
}

function SortableCard({ card, columnId, offline, tabs, t, reduced, onRemove }: SortableCardProps) {
  const id = `card::${columnId}::${card.url}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { kind: "card", columnId, url: card.url } satisfies DragData,
  });
  const jumpToTab = useTabsStore((s) => s.jumpToTab);

  const handleActivate = () => {
    if (offline) {
      // 离线状态：在新标签页中打开 URL
      try {
        void window.open(card.url, "_blank");
      } catch {
        /* ignore */
      }
    } else {
      const live = tabs.find((tt) => tt.url === card.url);
      if (live) {
        void jumpToTab(live.id, live.windowId);
      }
    }
  };

  const sortableCardStyle: React.CSSProperties = {
    opacity: isDragging ? 0.4 : offline ? 0.55 : 1,
    transform: CSS.Translate.toString(transform),
    transition: reduced ? "none" : transition,
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`${styles["app-kanban-card"]}${offline ? ` ${styles["is-offline"]}` : ""}`}
      style={sortableCardStyle}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate();
        }
      }}
      role="button"
      tabIndex={0}
    >
      {card.favIconUrl !== undefined && card.favIconUrl !== "" && (
        <Image
          src={card.favIconUrl}
          alt=""
          preview={false}
          width={12}
          height={12}
          className={styles["app-kanban-card__favicon"]}
        />
      )}
      <Typography.Text
        className={`${styles["app-kanban-card__title"]} ${styles["app-kanban-card__title--grow"]}`}
        title={offline ? `${card.title} · ${t("kanban.offline")}` : card.title}
      >
        {card.title}
      </Typography.Text>
      <Button
        type="text"
        size="small"
        icon={<X size={ICON_SIZE.TINY} />}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={t("kanban.removeCard")}
      />
    </div>
  );
}

// ── 子组件：列名编辑（inline） ──────────────────────────────────
function ColumnNameEditor({
  col,
  onRename,
}: {
  col: KanbanColumn;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(col.name);
  if (editing) {
    return (
      <Input
        size="small"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        onPressEnter={() => {
          onRename(value.trim() !== "" ? value.trim() : col.name);
          setEditing(false);
        }}
        onBlur={() => {
          onRename(value.trim() !== "" ? value.trim() : col.name);
          setEditing(false);
        }}
      />
    );
  }
  return (
    <span className={styles["app-kanban-column__name"]} onDoubleClick={() => setEditing(true)}>
      {col.name}
      <Button
        type="text"
        size="small"
        icon={<PenLine size={ICON_SIZE.TINY} />}
        onClick={() => setEditing(true)}
      />
    </span>
  );
}

// ── 子组件：DragOverlay 抬升副本 ──────────────────────────────────
function DragPreview({ active }: { active: ActiveDrag }) {
  const { t } = useT();
  if (active.data.kind === "column") {
    return (
      <Space className={`${styles["app-kanban-overlay"]} ${styles["app-kanban-overlay--column"]}`}>
        {t("kanban.draggingColumn")}
      </Space>
    );
  }
  const card =
    active.data.kind === "card"
      ? null
      : active.data.kind === "tab-source"
        ? active.data.card
        : null;
  return (
    <Space className={styles["app-kanban-overlay"]}>
      {card?.favIconUrl !== undefined && card.favIconUrl !== "" && (
        <Image
          src={card.favIconUrl}
          alt=""
          preview={false}
          width={12}
          height={12}
          className={styles["app-kanban-card__favicon"]}
        />
      )}
      <Typography.Text className={styles["app-kanban-card__title"]}>
        {card ? card.title : t("kanban.draggingCard")}
      </Typography.Text>
    </Space>
  );
}
