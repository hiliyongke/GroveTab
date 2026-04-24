/**
 * TabContextMenu — 标签右键上下文菜单（antd 版）
 *
 * 设计：
 *   - 外层使用 antd Popover 风格的浮层（手动定位 + Card 实现，避免动态 anchor 绑定）
 *   - 菜单项使用 antd Button(type="text") 保持一致视觉
 *   - 标签使用 antd Tag（closable）
 *   - 输入使用 antd Input / Input.TextArea
 *   - 边界钳制：防止菜单超出 viewport
 *   - ESC 关闭
 */

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  Pin,
  Tag as TagIcon,
  MessageSquare,
  Moon,
  MoveHorizontal,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { Button, Input, Tag, Divider, Card, theme } from 'antd';
import { useMetadataStore, useTabsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { stringToColor } from '@/shared/utils/color';
import { splitTabToSide } from '@/chrome';
import { Z } from '@/shared/config/z-index';
import { CONFIG } from '@/shared/config';

interface TabContextMenuProps {
  x: number;
  y: number;
  url: string;
  /** 标签页 ID，用于休眠等需要 tabId 的操作 */
  tabId?: number;
  onClose: () => void;
}

const MENU_WIDTH = CONFIG.ui.menuWidth;

/**
 * 标签右键上下文菜单
 */
export function TabContextMenu({ x, y, url, tabId, onClose }: TabContextMenuProps) {
  const { t } = useT();
  const { token } = theme.useToken();
  const addTag = useMetadataStore((s) => s.addTag);
  const removeTag = useMetadataStore((s) => s.removeTag);
  const setNote = useMetadataStore((s) => s.setNote);
  const togglePin = useMetadataStore((s) => s.togglePin);
  const isPinned = useMetadataStore((s) => s.isPinned);
  const tags = useMetadataStore((s) => s.getTags(url));
  const note = useMetadataStore((s) => s.getNote(url));
  const discardTab = useTabsStore((s) => s.discardTab);

  const [showTagInput, setShowTagInput] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [tagValue, setTagValue] = useState('');
  const [noteValue, setNoteValue] = useState(note);
  const [position, setPosition] = useState({ left: x, top: y });

  const menuRef = useRef<HTMLDivElement>(null);

  // 关闭：外部点击 / ESC
  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouse);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouse);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // 边界钳制：防止菜单超出 viewport
  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - 8;
    const maxTop = window.innerHeight - rect.height - 8;
    setPosition({
      left: Math.min(x, Math.max(8, maxLeft)),
      top: Math.min(y, Math.max(8, maxTop)),
    });
  }, [x, y]);

  const handleAddTag = () => {
    const v = tagValue.trim();
    if (v) {
      void addTag(url, v);
      setTagValue('');
      setShowTagInput(false);
    }
  };

  const handleSaveNote = () => {
    void setNote(url, noteValue);
    setShowNoteInput(false);
  };

  const pinned = isPinned(url);

  return (
    <div
      ref={menuRef}
      role="menu"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        width: MENU_WIDTH,
        zIndex: Z.contextMenu,
      }}
    >
      <Card
        size="small"
        styles={{ body: { padding: 4 } }}
        style={{
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadow,
        }}
      >
        {/* Pin / Unpin */}
        <Button
          type="text"
          block
          icon={<Pin size={ICON_SIZE.MEDIUM} />}
          onClick={() => {
            void togglePin(url);
            onClose();
          }}
          style={{ textAlign: 'left', justifyContent: 'flex-start', height: 32 }}
        >
          {pinned ? t('context.unpin') : t('context.pin')}
        </Button>

        {/* 休眠标签页 */}
        {tabId != null && (
          <Button
            type="text"
            block
            icon={<Moon size={ICON_SIZE.MEDIUM} />}
            onClick={() => {
              void (async () => {
                onClose();
                try {
                  await discardTab(tabId);
                } catch {
                  /* store 已 toast */
                }
              })();
            }}
            style={{ textAlign: 'left', justifyContent: 'flex-start', height: 32 }}
          >
            {t('tabs.discard')}
          </Button>
        )}

        {/* 分屏——将标签页移到新窗口，左右各占 50% */}
        {tabId != null && (
          <Button
            type="text"
            block
            icon={<MoveHorizontal size={ICON_SIZE.MEDIUM} />}
            onClick={() => {
              void (async () => {
                onClose();
                try {
                  await splitTabToSide(tabId);
                } catch {
                  /* splitTabToSide 内部已 safeCall */
                }
              })();
            }}
            style={{ textAlign: 'left', justifyContent: 'flex-start', height: 32 }}
          >
            {t('context.splitScreen')}
          </Button>
        )}

        <Divider style={{ margin: '4px 0' }} />

        {/* Add Tag */}
        <Button
          type="text"
          block
          icon={<TagIcon size={ICON_SIZE.MEDIUM} />}
          onClick={() => setShowTagInput(true)}
          style={{ textAlign: 'left', justifyContent: 'flex-start', height: 32 }}
        >
          {t('context.addTag')}
        </Button>

        {/* 已有 tags */}
        {tags.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              padding: '4px 8px 8px',
            }}
          >
            {tags.map((tag) => (
              <Tag
                key={tag}
                closable
                onClose={(e) => {
                  e.preventDefault();
                  void removeTag(url, tag);
                }}
                style={{
                  margin: 0,
                  fontSize: 11,
                  padding: '0 6px',
                  height: 20,
                  lineHeight: '18px',
                  color: '#fff',
                  border: 'none',
                  backgroundColor: stringToColor(tag),
                }}
              >
                {tag}
              </Tag>
            ))}
          </div>
        )}

        {/* Tag 输入 */}
        {showTagInput && (
          <div style={{ padding: '4px 6px 6px', display: 'flex', gap: 4 }}>
            <Input
              size="small"
              autoFocus
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              onPressEnter={handleAddTag}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setShowTagInput(false);
                }
              }}
              placeholder={t('context.tagPlaceholder')}
            />
            <Button type="primary" size="small" onClick={handleAddTag}>
              {t('context.save')}
            </Button>
          </div>
        )}

        <Divider style={{ margin: '4px 0' }} />

        {/* Note */}
        <Button
          type="text"
          block
          icon={<MessageSquare size={ICON_SIZE.MEDIUM} />}
          onClick={() => {
            setShowNoteInput(true);
            setNoteValue(note);
          }}
          style={{ textAlign: 'left', justifyContent: 'flex-start', height: 32 }}
        >
          {note ? t('context.editNote') : t('context.addNote')}
        </Button>

        {showNoteInput && (
          <div style={{ padding: '4px 6px 6px' }}>
            <Input.TextArea
              autoFocus
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              placeholder={t('context.notePlaceholder')}
              rows={3}
              style={{ fontSize: 12 }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 4,
                marginTop: 6,
              }}
            >
              <Button size="small" onClick={() => setShowNoteInput(false)}>
                {t('context.cancel')}
              </Button>
              <Button type="primary" size="small" onClick={handleSaveNote}>
                {t('context.save')}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
