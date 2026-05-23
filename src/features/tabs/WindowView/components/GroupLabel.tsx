/**
 * GroupLabel — 分组标签组件
 *
 * 支持：
 * - 双击重命名
 * - 双击颜色标签改色
 * - 拖拽到其他分组标签上合并分组
 * - 右键菜单（重命名/改色/取消分组）
 */

import { useState, useCallback } from 'react';
import { Tag, Button, Dropdown, Input } from 'antd';
import { GripVertical, ArrowUpDown } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useTabsStore } from '@/store';
import { feedback } from '@/shared/ui/feedback';
import { track as trackEvent } from '@/shared/utils/metrics';
import { stringToColor } from '@/shared/utils/color';
import {
  recolorTabGroup,
  renameTabGroup,
  reorderTabs,
  sortTabsByRule,
} from '@/features/tabs/services/window-tab-operations';
import { GROUP_COLORS } from '../types';
import type { GroupColor, GroupLabelProps, SmartSortRule } from '../types';
import { GroupContextMenu } from './GroupContextMenu';
import styles from '../WindowView.module.less';

/**
 * 获取排序规则对应的 i18n 名称
 * @param rule
 * @param t
 * @returns {void} 无返回值
 */
function getSortRuleName(rule: SmartSortRule, t: (key: string) => string): string {
  switch (rule) {
    case 'domain':
      return t('window.smartSortByDomain');
    case 'recentAccess':
      return t('window.smartSortByRecentAccess');
    case 'alphabetical':
      return t('window.smartSortByAlphabetical');
    case 'type':
      return t('window.smartSortByType');
  }
}

/**
 *
 * @param root0
 * @param root0.groupId
 * @param root0.groupTitle
 * @param root0.groupColor
 * @param root0.windowId
 * @param root0.tabs
 * @param root0.t
 * @returns {void} 无返回值
 */
function GroupLabel({ groupId, groupTitle, groupColor, windowId, tabs, t }: GroupLabelProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(groupTitle ?? '');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // 使用 useSortable 让分组标签本身可拖拽（用于拖到另一个分组标签上合并分组）
  const {
    setNodeRef: setSortableRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `group-label-sortable::${windowId}::${groupId}`,
    data: { kind: 'group-label', groupId, windowId },
  });

  // 分组标签也可作为 droppable 区域（标签拖入该分组）
  const { setNodeRef: setGroupLabelRef } = useDroppable({
    id: `group-label::${windowId}::${groupId}`,
    data: { kind: 'group-label', groupId, windowId },
  });

  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      setGroupLabelRef(node);
      setSortableRef(node);
    },
    [setGroupLabelRef, setSortableRef],
  );

  /**
   * 分组内智能排序
   *
   * 根据指定规则对分组内标签进行排序。
   *
   * @param rule - 排序规则
   * @returns 无返回值
   */
  const handleGroupSort = useCallback(
    async (rule: SmartSortRule) => {
      try {
        const sortedIds = sortTabsByRule(tabs, rule);
        if (sortedIds.length === 0) return;

        await reorderTabs(sortedIds);

        feedback.success(
          t('window.smartSortGroupSuccess', {
            rule: getSortRuleName(rule, t),
            count: String(sortedIds.length),
          }),
        );
        void trackEvent('smart_sort_group', { rule, groupId, count: sortedIds.length });
        void useTabsStore.getState().loadAllTabs({ silent: true });
      } catch (err) {
        feedback.error(t('window.moveFailed'));
        console.warn('[WindowView] group sort failed', err);
        void useTabsStore.getState().loadAllTabs({ silent: true });
      }
    },
    [tabs, groupId, t],
  );

  /**
   * 双击标题重命名
   *
   * @returns 无返回值
   */
  const handleTitleDoubleClick = () => {
    setEditing(true);
  };

  /**
   * 保存重命名
   *
   * @returns 无返回值
   */
  const handleSaveTitle = () => {
    const newName = editValue.trim();
    if (newName && newName !== groupTitle) {
      void renameTabGroup(groupId, newName).then(() => {
        feedback.success(t('window.groupRename'));
        void useTabsStore.getState().loadAllTabs({ silent: true });
      }).catch(() => {
        feedback.error(t('window.groupCreateFailed'));
      });
    }
    setEditing(false);
  };

  /**
   * 双击颜色标签改色
   *
   * @returns 无返回值
   */
  const handleColorDoubleClick = () => {
    setShowColorPicker(true);
  };

  /**
   * 选择新颜色
   * @param color
 * @returns {void} 无返回值
   */
  const handleColorChange = (color: GroupColor) => {
    void recolorTabGroup(groupId, color).then(() => {
      feedback.success(t('window.groupColor'));
      void useTabsStore.getState().loadAllTabs({ silent: true });
    }).catch(() => {
      feedback.error(t('window.groupCreateFailed'));
    });
    setShowColorPicker(false);
  };

  /**
   * 右键菜单
   * @param e
 * @returns {JSX.Element} JSX 元素
   */
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const labelStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
  };

  return (
    <div
      ref={mergedRef}
      {...attributes}
      {...listeners}
      style={labelStyle}
      className={`${styles['app-window-card-group-label']} ${isDragging ? styles['is-dragging'] : ''}`}
      onContextMenu={handleContextMenu}
    >
      {/* 颜色标记（双击改色） */}
      <Tag
        color={groupColor ?? 'default'}
        className={styles['app-window-card-group-color-tag']}
        onDoubleClick={handleColorDoubleClick}
      >
        {groupTitle ?? t('tabGroup.unnamed')}
      </Tag>

      {/* 标签数量 */}
      <span className={styles['app-tab-group-count']}>{tabs.length}</span>

      {/* 拖拽手柄 */}
      <GripVertical size={ICON_SIZE.TINY} className={styles['app-window-card-group-grip']} />

      {/* 分组内排序按钮 */}
      <Dropdown
        trigger={['click']}
        menu={{
          items: ([
            { key: 'domain', label: t('window.smartSortByDomain'), icon: <span>🌐</span> },
            { key: 'recentAccess', label: t('window.smartSortByRecentAccess'), icon: <span>⏱</span> },
            { key: 'alphabetical', label: t('window.smartSortByAlphabetical'), icon: <span>🔤</span> },
          ] as const).map((item) => ({
            key: item.key,
            label: item.label,
            icon: item.icon,
          })),
          onClick: ({ key }) => {
            void handleGroupSort(key as SmartSortRule);
          },
        }}
      >
        <Button
          type="text"
          size="small"
          icon={<ArrowUpDown size={ICON_SIZE.TINY} />}
          className={styles['app-window-card-group-sort-btn']}
          onClick={(e) => e.stopPropagation()}
        />
      </Dropdown>

      {/* 双击编辑标题 */}
      {editing ? (
        <Input
          size="small"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          autoFocus
          onPressEnter={handleSaveTitle}
          onBlur={handleSaveTitle}
          onClick={(e) => e.stopPropagation()}
          className={styles['app-window-card-group-name-input']}
        />
      ) : (
        <span
          className={styles['app-window-card-group-name']}
          onDoubleClick={handleTitleDoubleClick}
        >
          {groupTitle ?? t('tabGroup.unnamed')}
        </span>
      )}

      {/* 颜色选择器浮层 */}
      {showColorPicker && (
        <div className={styles['app-window-card-group-color-picker']}>
          {GROUP_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`${styles['app-window-card-group-color-swatch']} ${color === groupColor ? styles['is-active'] : ''}`}
              style={{ backgroundColor: stringToColor(color) }}
              onClick={() => handleColorChange(color)}
            >
              {color}
            </button>
          ))}
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <GroupContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          groupId={groupId}
          groupTitle={groupTitle}
          groupColor={groupColor}
          onClose={() => setContextMenu(null)}
          t={t}
        />
      )}
    </div>
  );
}

export { GroupLabel };
