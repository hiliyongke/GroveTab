/**
 * GroupContextMenu — 分组右键菜单组件
 *
 * 提供分组操作菜单：
 * - 重命名分组
 * - 更改分组颜色
 * - 取消分组
 */

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Card, Button, Input } from 'antd';
import { Pencil, Palette, Ungroup } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useTabsStore } from '@/store';
import { feedback } from '@/shared/ui/feedback';
import { stringToColor } from '@/shared/utils/color';
import {
  recolorTabGroup,
  renameTabGroup,
  ungroupTabs,
} from '@/features/tabs/services/window-tab-operations';
import { GROUP_COLORS, type GroupColor, type GroupContextMenuProps } from '../types';
import styles from '../WindowView.module.less';

/**
 *
 * @param root0
 * @param root0.x
 * @param root0.y
 * @param root0.groupId
 * @param root0.groupTitle
 * @param root0.groupColor
 * @param root0.onClose
 * @param root0.t
 * @returns {void} 无返回值
 */
function GroupContextMenu({ x, y, groupId, groupTitle, groupColor, onClose, t }: GroupContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 外部点击关闭
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // 边界钳制
  const [position, setPosition] = useState({ left: x, top: y });
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

  /** 重命名分组 */
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(groupTitle ?? '');
  /**
   * 重命名分组
   *
   * 验证并保存新的分组名称。
   *
   * @returns 无返回值
   */
  const handleRename = () => {
    const newName = renameValue.trim();
    if (newName && newName !== groupTitle) {
      void renameTabGroup(groupId, newName).then(() => {
        feedback.success(t('window.groupRename'));
        void useTabsStore.getState().loadAllTabs({ silent: true });
      }).catch(() => {
        feedback.error(t('window.groupCreateFailed'));
      });
    }
    setRenaming(false);
    onClose();
  };

  /** 更改分组颜色 */
  const [showColors, setShowColors] = useState(false);
  /**
   * 更改分组颜色
   *
   * @param color - 颜色值
   * @returns 无返回值
   */
  const handleChangeColor = (color: GroupColor) => {
    void recolorTabGroup(groupId, color).then(() => {
      feedback.success(t('window.groupColor'));
      void useTabsStore.getState().loadAllTabs({ silent: true });
    }).catch(() => {
      feedback.error(t('window.groupCreateFailed'));
    });
    setShowColors(false);
    onClose();
  };

  /**
   * 取消分组
   *
   * 将分组内的所有标签移出分组。
   *
   * @returns 无返回值
   */
  const handleUngroup = () => {
    const groupTabIds = useTabsStore
      .getState()
      .tabs.filter((t) => t.groupId === groupId && t.groupId !== -1)
      .map((t) => t.id);
    void ungroupTabs(groupTabIds).then(() => {
      feedback.success(t('window.groupUngrouped'));
      void useTabsStore.getState().loadAllTabs({ silent: true });
    }).catch(() => {
      feedback.error(t('window.groupUngroupFailed'));
    });
    onClose();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      onClick={(e) => e.stopPropagation()}
      className={styles['app-window-group-context-menu']}
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      <Card size="small" className={styles['app-window-group-context-menu__card']}>
        {/* 重命名 */}
        <Button type="text" block icon={<Pencil size={ICON_SIZE.MEDIUM} />} onClick={() => setRenaming(true)}>
          {t('window.groupRename')}
        </Button>

        {/* 改色 */}
        <Button type="text" block icon={<Palette size={ICON_SIZE.MEDIUM} />} onClick={() => setShowColors(true)}>
          {t('window.groupColor')}
        </Button>

        {/* 取消分组 */}
        <Button
          type="text"
          block
          danger
          icon={<Ungroup size={ICON_SIZE.MEDIUM} />}
          onClick={handleUngroup}
        >
          {t('window.groupUngroup')}
        </Button>
      </Card>

      {/* 内联编辑：重命名 */}
      {renaming && (
        <div className={styles['app-window-group-context-menu__inline-edit']}>
          <Input
            size="small"
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onPressEnter={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setRenaming(false);
              }
            }}
            placeholder={t('window.groupRename')}
          />
          <Button type="primary" size="small" onClick={handleRename}>
            {t('context.save')}
          </Button>
        </div>
      )}

      {/* 内联编辑：改色 */}
      {showColors && (
        <div className={styles['app-window-group-context-menu__color-picker']}>
          {GROUP_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`${styles['app-window-card-group-color-swatch']} ${color === groupColor ? styles['is-active'] : ''}`}
              style={{ backgroundColor: stringToColor(color) }}
              onClick={() => handleChangeColor(color)}
            >
              {color}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { GroupContextMenu };
