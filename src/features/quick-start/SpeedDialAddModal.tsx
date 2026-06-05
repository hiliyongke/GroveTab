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
import styles from './QuickStartLayer.module.less';

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
  /** 组件挂载标记：防止 chrome.tabs.query 回调在卸载后 setState */
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  /** 当前活动 tab 的 favicon URL（新增时自动带入） */
  const faviconUrlRef = useRef<string | undefined>(undefined);

  /** 包装 setUrl，标记用户已手动修改 */
  const setUrlWithFlag = useCallback((value: string | ((prev: string) => string)) => {
    userModifiedRef.current = true;
    setUrl(value);
  }, []);

  /** 包装 setTitle，标记用户已手动修改 */
  const setTitleWithFlag = useCallback((value: string | ((prev: string) => string)) => {
    userModifiedRef.current = true;
    setTitle(value);
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
      setGroup(editingSite.group ?? '__none__');
      faviconUrlRef.current = editingSite.favIconUrl;
    } else {
      setUrl('');
      setTitle('');
      setGroup(groupEnabled ? '__none__' : undefined);
      faviconUrlRef.current = undefined;
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabsList) => {
          if (!mountedRef.current) return; // 组件可能已卸载
          const active = tabsList[0];
          // 只有当用户没有手动修改过时才自动填充
          if (active?.url && active.url.startsWith('http') && !userModifiedRef.current) {
            setUrl(active.url);
            setTitle(active.title ?? '');
          }
          if (active?.favIconUrl) {
            faviconUrlRef.current = active.favIconUrl;
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
          favIconUrl: faviconUrlRef.current,
        });
      } else {
        const site: SpeedDialSite = {
          id: uid(),
          url: finalUrl,
          title: title.trim() || safeGetHostname(finalUrl),
          favIconUrl: faviconUrlRef.current,
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
      title={isEdit ? t('编辑常用站点') : t('添加常用站点')}
      okText={isEdit ? t('保存') : t('添加')}
      cancelText={t('取消')}
      onOk={() => void handleOk()}
      onCancel={onClose}
      confirmLoading={confirmLoading}
      width={440}
    >
<Form layout="vertical" className={styles['app-speed-dial-form']}>
        <Form.Item label={t('网址')}>
          <Input
            value={url}
            onChange={(e) => setUrlWithFlag(e.target.value)}
            placeholder={t('输入网址，如 github.com')}
            autoFocus
          />
        </Form.Item>
        <Form.Item label={t('标题')}>
          <Input
            value={title}
            onChange={(e) => setTitleWithFlag(e.target.value)}
            placeholder={t('显示名称（可选）')}
          />
        </Form.Item>
        {groupEnabled && (
          <Form.Item label={t('分组')}>
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
              placeholder={t('选择已有分组或输入新分组名')}
              notFoundContent={t('输入即可创建新分组')}
              suffixIcon={null}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
