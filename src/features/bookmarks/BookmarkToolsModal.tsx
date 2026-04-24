/**
 * BookmarkToolsModal —— 书签工具箱（v1.1）
 *
 * 包含三个能力的 UI 入口：
 *   1. 扫描去重
 *   2. 失效检测（需 <all_urls> 权限；未授权时按钮置灰并给出申请入口）
 *   3. 智能整理（按域名分簇）
 *
 * 交互：每个能力先扫描 → 展示预览列表 → 用户点"执行"后才真正写入。
 */

import { useCallback, useMemo, useState } from 'react';
import { Modal, Tabs, Button, List, Tag, Progress, Alert, theme, Space } from 'antd';
import { Copy, HeartPulse, FolderTree, Check, RefreshCw } from 'lucide-react';
import type { BookmarkNode } from '@/chrome/bookmarks';
import { getBookmarkTree } from '@/chrome/bookmarks';
import {
  findDuplicateBookmarks,
  mergeDuplicateBookmarks,
  checkBookmarkHealth,
  removeDeadBookmarks,
  clusterBookmarksByDomain,
  organizeClusterIntoFolder,
  type DuplicateBookmarkGroup,
  type BookmarkHealth,
  type DomainCluster,
} from './bookmark-tools';
import { useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { feedback } from '@/shared/ui/feedback';

interface BookmarkToolsModalProps {
  open: boolean;
  onClose: () => void;
  /** 执行完操作后通知上层刷新书签树 */
  onMutated: () => void;
}

export function BookmarkToolsModal({ open, onClose, onMutated }: BookmarkToolsModalProps) {
  const { t } = useT();
  const { token } = theme.useToken();
  const dedupStrictness = useSettingsStore((s) => s.settings.dedupStrictness) ?? 'loose';

  // ── Tab 1: 去重 ──
  const [dups, setDups] = useState<DuplicateBookmarkGroup[] | null>(null);
  const [dupLoading, setDupLoading] = useState(false);

  const scanDuplicates = useCallback(async () => {
    setDupLoading(true);
    const tree = await getBookmarkTree();
    const found = findDuplicateBookmarks(tree, dedupStrictness);
    setDups(found);
    setDupLoading(false);
  }, [dedupStrictness]);

  const applyDedupe = useCallback(async () => {
    if (dups === null) return;
    const removed = await mergeDuplicateBookmarks(dups);
    feedback.success(t('bookmark.tools.dedupeDone', { count: removed }));
    onMutated();
    setDups(null);
  }, [dups, t, onMutated]);

  // ── Tab 2: 失效检测 ──
  const [healthResults, setHealthResults] = useState<BookmarkHealth[] | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthProgress, setHealthProgress] = useState<{ done: number; total: number } | null>(null);
  const [healthPermission, setHealthPermission] = useState<boolean | null>(null);

  const checkHealth = useCallback(async () => {
    // 先申请 <all_urls> 权限
    const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
    setHealthPermission(granted);
    if (!granted) {
      feedback.error(t('bookmark.tools.healthNeedPermission'));
      return;
    }
    setHealthLoading(true);
    setHealthProgress({ done: 0, total: 0 });
    const tree = await getBookmarkTree();
    const flat: BookmarkNode[] = [];
    const walk = (nodes: BookmarkNode[]) => {
      for (const n of nodes) {
        if ((n.url ?? '') !== '') flat.push(n);
        if (n.children !== undefined) walk(n.children);
      }
    };
    walk(tree);
    const results = await checkBookmarkHealth(flat, (done, total) => {
      setHealthProgress({ done, total });
    });
    setHealthResults(results);
    setHealthLoading(false);
  }, [t]);

  const applyRemoveDead = useCallback(async () => {
    if (healthResults === null) return;
    const removed = await removeDeadBookmarks(healthResults);
    feedback.success(t('bookmark.tools.healthDone', { count: removed }));
    onMutated();
    setHealthResults(null);
  }, [healthResults, t, onMutated]);

  const deadList = useMemo(
    () => healthResults?.filter((r) => r.status === 'dead' || r.status === 'timeout') ?? [],
    [healthResults],
  );

  // ── Tab 3: 智能整理 ──
  const [clusters, setClusters] = useState<DomainCluster[] | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [selectedClusters, setSelectedClusters] = useState<Set<string>>(new Set());

  const scanClusters = useCallback(async () => {
    setOrgLoading(true);
    const tree = await getBookmarkTree();
    const c = clusterBookmarksByDomain(tree);
    setClusters(c);
    setSelectedClusters(new Set(c.map((x) => x.domain)));
    setOrgLoading(false);
  }, []);

  const applyOrganize = useCallback(async () => {
    if (clusters === null) return;
    /** "其他书签" 根目录 ID 通常是 "2"，该节点稳定存在 */
    const parentId = '2';
    let created = 0;
    for (const c of clusters) {
      if (!selectedClusters.has(c.domain)) continue;
      const fid = await organizeClusterIntoFolder(c, parentId);
      if (fid !== null) created += 1;
    }
    feedback.success(t('bookmark.tools.organizeDone', { count: created }));
    onMutated();
    setClusters(null);
  }, [clusters, selectedClusters, t, onMutated]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      title={t('bookmark.tools.title')}
      destroyOnHidden
    >
      <Tabs
        defaultActiveKey="dedupe"
        items={[
          // ── 去重 ──
          {
            key: 'dedupe',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Copy size={14} /> {t('bookmark.tools.dedupe')}
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420 }}>
                <Alert
                  type="info"
                  showIcon
                  message={t('bookmark.tools.dedupeHint', { mode: dedupStrictness })}
                />
                <Space>
                  <Button type="primary" loading={dupLoading} icon={<RefreshCw size={14} />} onClick={() => { void scanDuplicates(); }}>
                    {t('bookmark.tools.scan')}
                  </Button>
                  {dups !== null && dups.length > 0 && (
                    <Button danger icon={<Check size={14} />} onClick={() => { void applyDedupe(); }}>
                      {t('bookmark.tools.mergeAll', { count: dups.reduce((s, g) => s + g.items.length - 1, 0) })}
                    </Button>
                  )}
                </Space>
                {dups !== null && (
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {dups.length === 0 ? (
                      <Alert type="success" message={t('bookmark.tools.dedupeClean')} />
                    ) : (
                      <List
                        size="small"
                        dataSource={dups}
                        renderItem={(g) => (
                          <List.Item>
                            <div style={{ width: '100%' }}>
                              <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{g.key}</div>
                              <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
                                {t('bookmark.tools.dedupeItems', { count: g.items.length })}
                              </div>
                            </div>
                          </List.Item>
                        )}
                      />
                    )}
                  </div>
                )}
              </div>
            ),
          },
          // ── 失效检测 ──
          {
            key: 'health',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <HeartPulse size={14} /> {t('bookmark.tools.health')}
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420 }}>
                <Alert
                  type="warning"
                  showIcon
                  message={t('bookmark.tools.healthHint')}
                />
                {healthPermission === false && (
                  <Alert type="error" showIcon message={t('bookmark.tools.healthNeedPermission')} />
                )}
                <Space>
                  <Button type="primary" loading={healthLoading} icon={<RefreshCw size={14} />} onClick={() => { void checkHealth(); }}>
                    {t('bookmark.tools.scan')}
                  </Button>
                  {deadList.length > 0 && (
                    <Button danger icon={<Check size={14} />} onClick={() => { void applyRemoveDead(); }}>
                      {t('bookmark.tools.removeDeadAll', { count: deadList.length })}
                    </Button>
                  )}
                </Space>
                {healthLoading && healthProgress !== null && (
                  <Progress percent={healthProgress.total > 0 ? Math.round((healthProgress.done / healthProgress.total) * 100) : 0} />
                )}
                {healthResults !== null && (
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {deadList.length === 0 ? (
                      <Alert type="success" message={t('bookmark.tools.healthClean')} />
                    ) : (
                      <List
                        size="small"
                        dataSource={deadList}
                        renderItem={(r) => (
                          <List.Item>
                            <div style={{ width: '100%' }}>
                              <div style={{ fontSize: 12 }}>
                                {r.bookmark.title}
                                <Tag color={r.status === 'timeout' ? 'orange' : 'red'} style={{ marginLeft: 8 }}>
                                  {r.status}
                                </Tag>
                              </div>
                              <div style={{ fontSize: 11, color: token.colorTextTertiary }}>{r.bookmark.url}</div>
                            </div>
                          </List.Item>
                        )}
                      />
                    )}
                  </div>
                )}
              </div>
            ),
          },
          // ── 智能整理 ──
          {
            key: 'organize',
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <FolderTree size={14} /> {t('bookmark.tools.organize')}
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420 }}>
                <Alert type="info" showIcon message={t('bookmark.tools.organizeHint')} />
                <Space>
                  <Button type="primary" loading={orgLoading} icon={<RefreshCw size={14} />} onClick={() => { void scanClusters(); }}>
                    {t('bookmark.tools.scan')}
                  </Button>
                  {clusters !== null && clusters.length > 0 && (
                    <Button type="primary" icon={<Check size={14} />} onClick={() => { void applyOrganize(); }}>
                      {t('bookmark.tools.organizeApply', { count: selectedClusters.size })}
                    </Button>
                  )}
                </Space>
                {clusters !== null && (
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {clusters.length === 0 ? (
                      <Alert type="success" message={t('bookmark.tools.organizeEmpty')} />
                    ) : (
                      <List
                        size="small"
                        dataSource={clusters}
                        renderItem={(c) => {
                          const checked = selectedClusters.has(c.domain);
                          return (
                            <List.Item
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                const next = new Set(selectedClusters);
                                if (checked) next.delete(c.domain);
                                else next.add(c.domain);
                                setSelectedClusters(next);
                              }}
                            >
                              <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="checkbox" checked={checked} readOnly />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 12 }}>{c.domain}</div>
                                  <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
                                    {t('bookmark.tools.organizeCount', { count: c.items.length })}
                                  </div>
                                </div>
                              </div>
                            </List.Item>
                          );
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
}
