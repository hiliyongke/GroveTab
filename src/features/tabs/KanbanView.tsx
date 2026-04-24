/**
 * KanbanView —— 看板视图（F-20）
 *
 * 简化实现：使用原生 HTML5 Drag-and-Drop API（不引入 @dnd-kit 以控制包体）。
 * 默认 4 列：工作 / 学习 / 娱乐 / 待看；可增删改。
 * 拖拽 Tab 卡片入列**不关闭**原 Tab；原 Tab 关闭后看板中以"离线"灰态显示，
 * 点击尝试用 chrome.tabs.create 重新打开。
 */

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Popconfirm, theme, App as AntApp } from 'antd';
import { Plus, Trash2, Save, PenLine, X } from 'lucide-react';
import type { KanbanColumn } from '@/shared/types';
import { useKanbanStore, useTabsStore } from '@/store';
import { archiveSelectedTabs } from '@/services';
import { useT } from '@/shared/i18n';
import { useReducedMotionPreference } from '@/shared/hooks/use-reduced-motion';

/** 拖拽载荷：Tab url + title（保持轻量） */
interface DragPayload {
  url: string;
  title: string;
  favIconUrl: string;
}

const DATA_MIME = 'application/x-canopy-kanban';

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
  const tabs = useTabsStore((s) => s.tabs);
  const reduced = useReducedMotionPreference();

  useEffect(() => {
    if (!loaded) void loadKanban();
  }, [loaded, loadKanban]);

  const liveUrls = useMemo(() => new Set(tabs.map((t) => t.url)), [tabs]);
  const [newColumnName, setNewColumnName] = useState('');
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

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

  const onDragStart = (e: React.DragEvent, payload: DragPayload, fromColumn?: string) => {
    e.dataTransfer.setData(DATA_MIME, JSON.stringify(payload));
    if (fromColumn !== undefined) {
      e.dataTransfer.setData('application/x-canopy-from-col', fromColumn);
    }
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDropColumn = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const raw = e.dataTransfer.getData(DATA_MIME);
    if (raw === '') return;
    try {
      const payload = JSON.parse(raw) as DragPayload;
      await addCard(columnId, { ...payload, addedAt: Date.now() });
    } catch {
      // ignore malformed payload
    }
  };

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
      {/* 左侧：实时 Tab 侧栏（源，仅显示尚未归入任一列的） */}
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
        <div style={{ fontSize: 12, fontWeight: 600, color: token.colorTextSecondary, marginBottom: 8 }}>
          {t('kanban.title')}
        </div>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            draggable
            onDragStart={(e) => onDragStart(e, { url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl })}
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
              transition: reduced ? 'none' : 'transform 120ms',
            }}
          >
            {tab.favIconUrl !== '' && (
              <img src={tab.favIconUrl} alt="" width={12} height={12} style={{ borderRadius: 2 }} />
            )}
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={tab.title}
            >
              {tab.title}
            </span>
          </div>
        ))}
      </div>

      {/* 右侧：各列 */}
      {columns.map((col) => (
        <Card
          key={col.id}
          size="small"
          style={{
            flex: '0 0 260px',
            minHeight: 400,
            background:
              dragOverCol === col.id ? token.colorPrimaryBg : token.colorFillQuaternary,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 12,
            transition: reduced ? 'none' : 'background 120ms',
          }}
          styles={{ body: { padding: 8 } }}
          title={
            <KanbanColumnHeader
              col={col}
              onRename={(name) => void renameColumn(col.id, name)}
              onRemove={() => void removeColumn(col.id)}
              onSaveAsSession={() => void handleSaveAsSession(col)}
              t={t}
            />
          }
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverCol(col.id);
          }}
          onDragLeave={() => setDragOverCol((prev) => (prev === col.id ? null : prev))}
          onDrop={(e) => void onDropColumn(e, col.id)}
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
            col.cards.map((card) => {
              const offline = !liveUrls.has(card.url);
              return (
                <div
                  key={card.url}
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
                    opacity: offline ? 0.55 : 1,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    if (offline) {
                      try {
                        void chrome.tabs?.create({ url: card.url, active: true });
                      } catch {
                        // ignore
                      }
                    } else {
                      // 跳转到现有 Tab
                      const live = tabs.find((t) => t.url === card.url);
                      if (live) {
                        void chrome.tabs?.update(live.id, { active: true });
                        void chrome.windows?.update(live.windowId, { focused: true });
                      }
                    }
                  }}
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
                      void removeCard(col.id, card.url);
                    }}
                  />
                </div>
              );
            })
          )}
        </Card>
      ))}

      {/* 新增列 */}
      <div style={{ flex: '0 0 220px' }}>
        <Input
          value={newColumnName}
          onChange={(e) => setNewColumnName(e.target.value)}
          onPressEnter={() => void handleAddColumn()}
          placeholder={t('kanban.addColumn')}
          suffix={
            <Button size="small" type="text" icon={<Plus size={12} />} onClick={() => void handleAddColumn()} />
          }
        />
      </div>
    </div>
  );
}

interface KanbanColumnHeaderProps {
  col: KanbanColumn;
  onRename: (name: string) => void;
  onRemove: () => void;
  onSaveAsSession: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function KanbanColumnHeader({ col, onRename, onRemove, onSaveAsSession, t }: KanbanColumnHeaderProps) {
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{col.name}</span>
      <span style={{ fontSize: 11, opacity: 0.6 }}>{col.cards.length}</span>
      <Button type="text" size="small" icon={<PenLine size={11} />} onClick={() => setEditing(true)} title={t('kanban.renameColumn')} />
      <Button type="text" size="small" icon={<Save size={11} />} onClick={onSaveAsSession} title={t('kanban.saveAsSession')} />
      <Popconfirm title={t('kanban.removeColumn')} onConfirm={onRemove}>
        <Button type="text" size="small" icon={<Trash2 size={11} />} />
      </Popconfirm>
    </div>
  );
}

export default KanbanView;
