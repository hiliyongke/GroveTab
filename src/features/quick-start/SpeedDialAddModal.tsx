/**
 * SpeedDialAddModal — 新增/编辑常用站点弹窗
 *
 * 支持手动输入 URL、标题和分组。
 * 分组模式下显示分组选择器（可从已有分组选，也可输入新分组名）。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Input, Form, Select } from 'antd';
import { useSpeedDialStore, useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';
import type { SpeedDialSite } from '@/shared/types';
import './QuickStartLayer.css';

interface SpeedDialAddModalProps {
  open: boolean;
  onClose: () => void;
  /** 若提供则为编辑模式，否则为新增模式 */
  editingSite: SpeedDialSite | null;
  /** 当前已有的分组名列表 */
  existingGroups: string[];
}

/** 安全获取 URL 的 hostname，失败返回原始 URL */
function safeGetHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** 生成简易唯一 ID */
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function SpeedDialAddModal({ open, onClose, editingSite, existingGroups }: SpeedDialAddModalProps) {
  const { t } = useT();
  const addSite = useSpeedDialStore((s) => s.addSite);
  const updateSite = useSpeedDialStore((s) => s.updateSite);
  const sites = useSpeedDialStore((s) => s.sites);
  const groupEnabled = useSettingsStore((s) => s.settings.speedDialGroupEnabled ?? false);

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [group, setGroup] = useState<string | undefined>(undefined);
  const [confirmLoading, setConfirmLoading] = useState(false);
  /** 标记用户是否手动修改过 URL 或标题，避免异步回调覆盖 */
  const userModifiedRef = useRef(false);

  /** 包装 setUrl，标记用户已手动修改 */
  const setUrlWithFlag = useCallback((value: string | ((prev: string) => string)) => {
    userModifiedRef.current = true;
    setUrl(value as string);
  }, []);

  /** 包装 setTitle，标记用户已手动修改 */
  const setTitleWithFlag = useCallback((value: string | ((prev: string) => string)) => {
    userModifiedRef.current = true;
    setTitle(value as string);
  }, []);

  const isEdit = editingSite !== null;

  /** 打开时自动填充 */
  useEffect(() => {
    if (!open) return;
    // 每次打开弹窗时重置修改标记
    userModifiedRef.current = false;
    if (editingSite) {
      setUrl(editingSite.url);
      setTitle(editingSite.title);
      setGroup(editingSite.group || '__none__');
    } else {
      setUrl('');
      setTitle('');
      setGroup(groupEnabled ? '__none__' : undefined);
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabsList) => {
          const active = tabsList[0];
          // 只有当用户没有手动修改过时才自动填充
          if (active?.url && active.url.startsWith('http') && !userModifiedRef.current) {
            setUrl(active.url);
            setTitle(active.title || '');
          }
        });
      }
    }
  }, [open, editingSite, groupEnabled]);

  const handleOk = useCallback(async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    // 确保 URL 有协议前缀
    let finalUrl = trimmedUrl;
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`;
    }

    const resolvedGroup = groupEnabled && group && group !== '__none__' ? group : undefined;

    setConfirmLoading(true);
    try {
      if (isEdit && editingSite) {
        await updateSite({
          id: editingSite.id,
          url: finalUrl,
          title: title.trim() || safeGetHostname(finalUrl),
          group: resolvedGroup,
        });
      } else {
        const site: SpeedDialSite = {
          id: uid(),
          url: finalUrl,
          title: title.trim() || safeGetHostname(finalUrl),
          /** favIconUrl 留空，由 SpeedDialGrid 的 getFaviconUrl() 运行时解析 */
          favIconUrl: undefined,
          order: sites.length,
          createdAt: Date.now(),
          group: resolvedGroup,
        };
        await addSite(site);
      }
      onClose();
    } finally {
      setConfirmLoading(false);
    }
  }, [url, title, group, groupEnabled, isEdit, editingSite, sites, addSite, updateSite, onClose]);

  return (
    <Modal
      open={open}
      title={isEdit ? t('quickStart.editTitle') : t('quickStart.addTitle')}
      okText={isEdit ? t('quickStart.save') : t('quickStart.add')}
      cancelText={t('quickStart.cancel')}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={confirmLoading}
      destroyOnClose
      width={440}
    >
      <Form layout="vertical" className="app-speed-dial-form">
        <Form.Item label={t('quickStart.urlLabel')}>
          <Input
            value={url}
            onChange={(e) => setUrlWithFlag(e.target.value)}
            placeholder={t('quickStart.urlPlaceholder')}
            autoFocus
          />
        </Form.Item>
        <Form.Item label={t('quickStart.titleLabel')}>
          <Input
            value={title}
            onChange={(e) => setTitleWithFlag(e.target.value)}
            placeholder={t('quickStart.titlePlaceholder')}
          />
        </Form.Item>
        {groupEnabled && (
          <Form.Item label={t('quickStart.groupLabel')}>
            <Select
              mode="tags"
              maxCount={1}
              value={group && group !== '__none__' ? [group] : undefined}
              onChange={(values: string[]) => {
                // tags 模式返回数组，取第一个值；空数组表示未分组
                setGroup(values.length > 0 ? values[0] : '__none__');
              }}
              options={existingGroups.map((g) => ({ value: g, label: g }))}
              allowClear
              showSearch
              placeholder={t('quickStart.groupPlaceholder')}
              notFoundContent={t('quickStart.groupNotFound')}
              suffixIcon={null}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
