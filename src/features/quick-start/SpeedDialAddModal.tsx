/**
 * SpeedDialAddModal — 新增/编辑常用站点弹窗
 *
 * 两种模式：
 *   - 单个添加：手动输入 URL、标题和分组
 *   - 批量导入：粘贴 JSON 数组，自动去重
 * 编辑时仅显示单个添加模式。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Input, Form, Select, Segmented, Typography } from 'antd';
import { useSpeedDialStore, useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { feedback } from '@/shared/ui/feedback';
import type { SpeedDialSite } from '@/shared/types';
import styles from './QuickStartLayer.module.less';

type AddMode = 'single' | 'import';

// IMPORT_EXAMPLE 在组件内用 useMemo + t() 翻译，避免模块级 translate() 时机问题

interface SpeedDialAddModalProps {
  open: boolean;
  onClose: () => void;
  editingSite: SpeedDialSite | null;
  existingGroups: string[];
}

function safeGetHostname(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function SpeedDialAddModal({ open, onClose, editingSite, existingGroups }: SpeedDialAddModalProps) {
  const { t } = useT();
  const addSite = useSpeedDialStore((s) => s.addSite);
  const updateSite = useSpeedDialStore((s) => s.updateSite);
  const batchImport = useSpeedDialStore((s) => s.batchImport);
  const sites = useSpeedDialStore((s) => s.sites);
  const groupEnabled = useSettingsStore((s) => s.settings.speedDialGroupEnabled ?? false);

  // ── 单个添加 state ──
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [group, setGroup] = useState<string | undefined>(undefined);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const userModifiedRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const faviconUrlRef = useRef<string | undefined>(undefined);

  // ── 批量导入 state ──
  const [mode, setMode] = useState<AddMode>('single');
  const [importJson, setImportJson] = useState('');

  const importExample = useMemo(() => JSON.stringify([
    { url: 'github.com', title: 'GitHub', group: t('开发') },
    { url: 'figma.com', title: 'Figma', group: t('设计') },
  ], null, 2), [t]);

  const setUrlWithFlag = useCallback((value: string | ((prev: string) => string)) => {
    userModifiedRef.current = true;
    setUrl(value);
  }, []);

  const setTitleWithFlag = useCallback((value: string | ((prev: string) => string)) => {
    userModifiedRef.current = true;
    setTitle(value);
  }, []);

  const isEdit = editingSite !== null;

  // 打开时重置
  useEffect(() => {
    if (!open) return;
    setMode('single');
    setImportJson('');
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
          if (!mountedRef.current) return;
          const active = tabsList[0];
          if (active?.url && active.url.startsWith('http') && !userModifiedRef.current) {
            setUrl(active.url);
            setTitle(active.title ?? '');
          }
          if (active?.favIconUrl) faviconUrlRef.current = active.favIconUrl;
        });
      }
    }
  }, [open, editingSite, groupEnabled]);

  // ── 单个添加确认 ──
  const handleSingleOk = useCallback(async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    let finalUrl = trimmedUrl;
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = `https://${finalUrl}`;
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
          id: uid(), url: finalUrl, title: title.trim() || safeGetHostname(finalUrl),
          favIconUrl: faviconUrlRef.current, order: sites.length, createdAt: Date.now(),
          group: resolvedGroup,
        };
        await addSite(site);
      }
      onClose();
    } finally {
      setConfirmLoading(false);
    }
  }, [url, title, group, groupEnabled, isEdit, editingSite, sites, addSite, updateSite, onClose]);

  // ── 批量导入确认 ──
  const handleImportOk = useCallback(async () => {
    if (!importJson.trim()) return;
    setConfirmLoading(true);
    try {
      const parsed = JSON.parse(importJson);
      if (!Array.isArray(parsed)) throw new Error(t('必须是数组格式'));
      const newSites = parsed.map((item: Record<string, unknown>, i: number) => {
        if (!item.url || typeof item.url !== 'string') throw new Error(t('第 {n} 项缺少 url', { n: i + 1 }));
        const normalized = item.url.startsWith('http') ? item.url : `https://${item.url}`;
        return {
          id: `import-${Date.now()}-${i}`, url: normalized,
          title: String(item.title || safeGetHostname(normalized)),
          group: typeof item.group === 'string' ? item.group : undefined,
          order: i, createdAt: Date.now(),
        } as SpeedDialSite;
      });
      await batchImport(newSites);
      feedback.success(t('导入成功，已添加 {n} 个站点', { n: newSites.length }));
      onClose();
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      feedback.error(err.message || t('JSON 格式错误'));
    } finally {
      setConfirmLoading(false);
    }
  }, [importJson, batchImport, onClose, t]);

  const handleOk = useCallback(() => {
    if (isEdit) { void handleSingleOk(); return; }
    if (mode === 'import') { void handleImportOk(); } else { void handleSingleOk(); }
  }, [mode, isEdit, handleSingleOk, handleImportOk]);

  const canSubmit = isEdit ? url.trim().length > 0
    : mode === 'import' ? importJson.trim().length > 0 : url.trim().length > 0;

  return (
    <Modal
      open={open}
      title={isEdit ? t('编辑常用站点') : t('添加常用站点')}
      okText={isEdit ? t('保存') : mode === 'import' ? t('导入') : t('添加')}
      cancelText={t('取消')}
      onOk={() => void handleOk()}
      onCancel={onClose}
      confirmLoading={confirmLoading}
      okButtonProps={{ disabled: !canSubmit }}
      width={480}
    >
      {/* 模式切换（非编辑时） */}
      {!isEdit && (
        <Segmented
          block
          value={mode}
          onChange={(v) => setMode(v as AddMode)}
          options={[
            { label: t('单个添加'), value: 'single' as const },
            { label: t('批量导入'), value: 'import' as const },
          ]}
          style={{ marginBottom: "var(--app-space-4)" }}
        />
      )}

      {(!isEdit && mode === 'single') || isEdit ? (
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
                onChange={(values: string[]) => setGroup(values.length > 0 ? values[0] : '__none__')}
                options={existingGroups.map((g) => ({ value: g, label: g }))}
                allowClear showSearch
                placeholder={t('选择已有分组或输入新分组名')}
                notFoundContent={t('输入即可创建新分组')}
                suffixIcon={null}
              />
            </Form.Item>
          )}
        </Form>
      ) : (
        <div>
          <Typography.Paragraph type="secondary">
            {t('粘贴 JSON 数组，自动去重已存在的站点：')}
          </Typography.Paragraph>
          <Input.TextArea
            rows={10}
            placeholder={importExample}
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            style={{ fontFamily: 'monospace' }}
            autoFocus
          />
        </div>
      )}
    </Modal>
  );
}
