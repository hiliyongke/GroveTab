/**
 * KanbanView —— 看板视图（F-20）· v1.3 升级
 *
 * 历史：v1.2 使用原生 HTML5 Drag-and-Drop API，触屏体验差、无键盘可达、
 * 无 DragOverlay 视觉反馈。v1.3 改用 `@dnd-kit/core` + `@dnd-kit/sortable`，
 * 支持：
 *   - 卡片在**列内重排序** + 跨列移动（统一的 DndContext）
 *   - 列的**整列排序**（另一层 SortableContext）
 *   - 触屏（TouchSensor activationDelay:200ms）+ 键盘（KeyboardSensor）
 *   - DragOverlay 抬升副本：拖拽时显示阴影 + 0.9 透明
 *
 * 保留既有语义：
 *   - 左侧 "实时 Tab 源" 列拖入目标列 → 复制一份到列，**不关闭**原 Tab（addCard）
 *   - 列内/跨列拖拽 → moveCard/reorderCard
 */

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Popconfirm, theme, App as AntApp } from 'antd';
import { Plus, Trash2, Save, PenLine, X, GripVertical } from 'lucide-react';
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
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { KanbanCard, KanbanColumn } from '@/shared/types';
import { useKanbanStore, useTabsStore } from '@/store';
import { archiveSelectedTabs } from '@/services';
import { useT } from '@/shared/i18n';
import { useReducedMotionPreference } from '@/shared/hooks/use-reduced-motion';

/** 拖拽数据类型：区分「源 tab」「列内卡片」「列自身」 */
type DragData =
  | { kind: 'tab-source'; card: KanbanCard }
  | { kind: 'card'; columnId: string; url: string }
  | { kind: 'column'; columnId: string };

type ActiveDrag = {
  id: string;
  data: DragData;
};

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
  const [newColumnName, setNewColumnName] = useState('');
  const [active, setActive] = useState<ActiveDrag | null>(null);

  // Sensors: 指针（拖动需 6px 激活，避免点击误触）、触屏（按住 200ms）、键盘
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleAddColumn = async () => {
    const name = newColumnName.trim();
    if (name === '') return;
    await addColumn(name);
    setNewColumnName('');
  };

  const handleSaveAsSession = async (col: KanbanColumn) => {
    const live = tabs.filter((t) => col.cards.some((c) => c.url === t.url));
    if (live.length === 0) {
      message.warning(t('kanban.emptyColumn'));
      return;
    }
    try {
      await archiveSelectedTabs(live.map((t) => t.id));
      message.success(t('archive.archivedOk', { count: live.length }));
    } catch (err) {
      console.warn('[kanban] archive failed', err);
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
      | { kind: 'card'; columnId: string; url: string }
      | { kind: 'column-body'; columnId: string }
      | { kind: 'column'; columnId: string }
      | undefined;
    if (!activeData) return;

    // 1) 源 Tab 拖入列或卡片位置 → addCard（不关闭原 Tab）
    if (activeData.kind === 'tab-source') {
      const destCol = overData?.kind === 'card' ? overData.columnId
        : overData?.kind === 'column-body' ? overData.columnId
        : overData?.kind === 'column' ? overData.columnId
        : null;
      if (!destCol) return;
      await addCard(destCol, activeData.card);
      return;
    }

    // 2) 卡片拖动
    if (activeData.kind === 'card') {
      // 拖到列空白处 → 移动到该列末尾
      if (overData?.kind === 'column-body') {
        if (overData.columnId === activeData.columnId) return;
        await moveCard(activeData.columnId, overData.columnId, activeData.url);
        return;
      }
      // 拖到某卡片上 → 列内 reorder 或跨列移动到该卡片前
      if (overData?.kind === 'card') {
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
    if (activeData.kind === 'column' && overData?.kind === 'column') {
      if (activeData.columnId === overData.columnId) return;
      const fromIndex = columns.findIndex((c) => c.id === activeData.columnId);
      const toIndex = columns.findIndex((c) => c.id === overData.columnId);
      if (fromIndex < 0 || toIndex < 0) return;
      await reorderColumns(fromIndex, toIndex);
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
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
        {/* 左侧：实时 Tab 源栏 —— 只作为拖出源，不是排序目标 */}
        <div
          style={{
            flex: '0 0 240px',
            maxHeight: 600,
            overflowY: 'auto',
            padding: 10,
            background: token.colorFillQuaternary,
            borderRadius: 12,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: token.colorTextSecondary,
              marginBottom: 8,
            }}
          >
            {t('kanban.title')}
          </div>
          {tabs.map((tab) => (
            <TabSourceItem
              key={tab.id}
              card={{
                url: tab.url,
                title: tab.title,
                favIconUrl: tab.favIconUrl,
                addedAt: Date.now(),
              }}
              reduced={reduced}
            />
          ))}
        </div>

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
              onRemove={() => void removeColumn(col.id)}
              onSaveAsSession={() => void handleSaveAsSession(col)}
              onRemoveCard={(url) => void removeCard(col.id, url)}
            />
          ))}
        </SortableContext>

        {/* 新增列 */}
        <div style={{ flex: '0 0 220px' }}>
          <Input
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            onPressEnter={() => void handleAddColumn()}
            placeholder={t('kanban.addColumn')}
            suffix={
              <Button
                size="small"
                type="text"
                icon={<Plus size={12} />}
                onClick={() => void handleAddColumn()}
              />
            }
          />
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
  const { token } = theme.useToken();
  const id = `tab-source::${card.url}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { kind: 'tab-source', card } satisfies DragData,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 8px',
        marginBottom: 4,
        borderRadius: 6,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        cursor: 'grab',
        fontSize: 11.5,
        opacity: isDragging ? 0.4 : 1,
        transform: CSS.Translate.toString(transform),
        transition: reduced ? 'none' : transition,
      }}
    >
      {card.favIconUrl !== undefined && card.favIconUrl !== '' && (
        <img src={card.favIconUrl} alt="" width={12} height={12} style={{ borderRadius: 2 }} />
      )}
      <span
        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={card.title}
      >
        {card.title}
      </span>
    </div>
  );
}

// ── 子组件：单列 ──────────────────────────────────
interface KanbanColumnViewProps {
  col: KanbanColumn;
  liveUrls: Set<string>;
  tabs: { id: number; url: string; windowId: number }[];
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
  const { token } = theme.useToken();
  // 整列拖拽（useSortable 把列作为 SortableContext 中的一项）
  const sortable = useSortable({
    id: `col::${col.id}`,
    data: { kind: 'column', columnId: col.id } satisfies DragData,
  });

  // 列空白处作为 droppable，用于"拖到空白/末尾"
  const body = useDroppable({
    id: `col-body::${col.id}`,
    data: { kind: 'column-body', columnId: col.id },
  });

  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        flex: '0 0 260px',
        transform: CSS.Translate.toString(sortable.transform),
        transition: reduced ? 'none' : sortable.transition,
        opacity: sortable.isDragging ? 0.5 : 1,
      }}
    >
      <Card
        size="small"
        style={{
          minHeight: 400,
          background: body.isOver ? token.colorPrimaryBg : token.colorFillQuaternary,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 12,
          transition: reduced ? 'none' : 'background 120ms',
        }}
        styles={{ body: { padding: 8 } }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* 列拖拽句柄 —— 只有点住这里才能拖整列 */}
            <Button
              type="text"
              size="small"
              icon={<GripVertical size={11} />}
              {...sortable.attributes}
              {...sortable.listeners}
              style={{ cursor: 'grab' }}
              aria-label={t('kanban.renameColumn')}
            />
            <ColumnNameEditor col={col} onRename={onRename} />
            <span style={{ fontSize: 11, opacity: 0.6 }}>{col.cards.length}</span>
            <Button
              type="text"
              size="small"
              icon={<Save size={11} />}
              onClick={onSaveAsSession}
              title={t('kanban.saveAsSession')}
            />
            <Popconfirm title={t('kanban.removeColumn')} onConfirm={onRemove}>
              <Button type="text" size="small" icon={<Trash2 size={11} />} />
            </Popconfirm>
          </div>
        }
      >
        <div ref={body.setNodeRef} style={{ minHeight: 300 }}>
          <SortableContext
            items={col.cards.map((c) => `card::${col.id}::${c.url}`)}
            strategy={verticalListSortingStrategy}
          >
            {col.cards.length === 0 ? (
              <div
                style={{
                  padding: '24px 8px',
                  fontSize: 11.5,
                  color: token.colorTextTertiary,
                  textAlign: 'center',
                }}
              >
                {t('kanban.emptyColumn')}
              </div>
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
  tabs: { id: number; url: string; windowId: number }[];
  t: (key: string, params?: Record<string, string | number>) => string;
  reduced: boolean;
  onRemove: () => void;
}

function SortableCard({ card, columnId, offline, tabs, t, reduced, onRemove }: SortableCardProps) {
  const { token } = theme.useToken();
  const id = `card::${columnId}::${card.url}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { kind: 'card', columnId, url: card.url } satisfies DragData,
  });

  const handleActivate = () => {
    if (offline) {
      try {
        void chrome.tabs?.create({ url: card.url, active: true });
      } catch {
        /* ignore */
      }
    } else {
      const live = tabs.find((tt) => tt.url === card.url);
      if (live) {
        void chrome.tabs?.update(live.id, { active: true });
        void chrome.windows?.update(live.windowId, { focused: true });
      }
    }
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 8px',
        marginBottom: 4,
        borderRadius: 6,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        fontSize: 11.5,
        opacity: isDragging ? 0.4 : offline ? 0.55 : 1,
        cursor: 'pointer',
        transform: CSS.Translate.toString(transform),
        transition: reduced ? 'none' : transition,
      }}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleActivate();
        }
      }}
      role="button"
      tabIndex={0}
    >
      {card.favIconUrl !== undefined && card.favIconUrl !== '' && (
        <img src={card.favIconUrl} alt="" width={12} height={12} style={{ borderRadius: 2 }} />
      )}
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={offline ? `${card.title} · ${t('kanban.offline')}` : card.title}
      >
        {card.title}
      </span>
      <Button
        type="text"
        size="small"
        icon={<X size={11} />}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label="删除卡片"
      />
    </div>
  );
}

// ── 子组件：列名编辑（inline） ──────────────────────────────────
function ColumnNameEditor({ col, onRename }: { col: KanbanColumn; onRename: (name: string) => void }) {
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
          onRename(value.trim() !== '' ? value.trim() : col.name);
          setEditing(false);
        }}
        onBlur={() => {
          onRename(value.trim() !== '' ? value.trim() : col.name);
          setEditing(false);
        }}
      />
    );
  }
  return (
    <span
      style={{ flex: 1, fontSize: 12.5, fontWeight: 600, cursor: 'text' }}
      onDoubleClick={() => setEditing(true)}
    >
      {col.name}
      <Button type="text" size="small" icon={<PenLine size={11} />} onClick={() => setEditing(true)} />
    </span>
  );
}

// ── 子组件：DragOverlay 抬升副本 ──────────────────────────────────
function DragPreview({ active }: { active: ActiveDrag }) {
  const { token } = theme.useToken();
  if (active.data.kind === 'column') {
    return (
      <div
        style={{
          width: 260,
          minHeight: 60,
          padding: 12,
          background: token.colorBgContainer,
          borderRadius: 12,
          border: `1px solid ${token.colorBorderSecondary}`,
          boxShadow: token.boxShadowSecondary,
          opacity: 0.9,
        }}
      >
        拖动列中…
      </div>
    );
  }
  const card = active.data.kind === 'card' ? null : active.data.kind === 'tab-source' ? active.data.card : null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 8px',
        borderRadius: 6,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorPrimary}`,
        boxShadow: token.boxShadowSecondary,
        fontSize: 11.5,
        opacity: 0.9,
        minWidth: 200,
      }}
    >
      {card !== null && card.favIconUrl !== undefined && card.favIconUrl !== '' && (
        <img src={card.favIconUrl} alt="" width={12} height={12} style={{ borderRadius: 2 }} />
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {card ? card.title : '拖动卡片中…'}
      </span>
    </div>
  );
}

export default KanbanView;
