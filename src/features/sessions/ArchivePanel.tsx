/**
 * ArchivePanel — 归档会话浮层（Modal 版）
 *
 * 薄封装：Modal 外壳 + 内嵌 ArchiveView。
 * 保留向后兼容（顶栏归档按钮、空状态引导仍可打开此浮层）。
 */

import { ArchiveView, refreshSessions } from './ArchiveView';
import { Modal } from 'antd';
import type { ArchivedSession } from '@/shared/types';

interface ArchivePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionsChange?: (sessions: ArchivedSession[]) => void;
}

export function ArchivePanel({ open, onOpenChange }: ArchivePanelProps) {
  return (
    <Modal
      open={open}
      rootClassName="app-archive-panel"
      classNames={{ body: 'app-archive-panel__body' }}
      onCancel={() => onOpenChange(false)}
      afterOpenChange={(visible) => {
        if (visible) {
          void refreshSessions();
        }
      }}
      footer={null}
      width={680}
      centered={false}
      destroyOnHidden
    >
      <ArchiveView />
    </Modal>
  );
}
