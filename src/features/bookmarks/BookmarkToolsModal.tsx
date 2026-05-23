/**
 * BookmarkToolsModal —— 书签工具箱（v2 视觉重构）
 *
 * 设计目标：
 *   - 像「Mac 系统设置」一样：左侧分类导航 + 右侧详情；进入即看「总览」
 *   - 每个能力都按「① 提示 → ② 操作 → ③ 结果」三段式呈现，节奏一致
 *   - 列表项展示 favicon + 标题 + 域名 / 状态，告别"光秃秃文字"
 *
 * 能力清单（v2）：
 *   1. 总览（Overview）——书签健康一览
 *   2. 去重（Dedupe）
 *   3. 失效检测（Health Check）
 *   4. 智能整理（Auto Organize）—— 簇可展开看具体书签
 *   5. 空文件夹清理（Empty Folders）—— 新增
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal, Button, List, Tag, Progress, Alert, Checkbox, Tooltip, Empty, Segmented,
} from 'antd';
import {
  Copy, HeartPulse, FolderTree, Check, RefreshCw, FolderX, LayoutDashboard,
  ExternalLink, Globe, Bookmark as BookmarkIcon, Folder, Hash, Layers,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import type { BookmarkNode } from '@/chrome/bookmarks';
import { getBookmarkTree } from '@/chrome/bookmarks';
import { getFaviconUrl, createTab } from '@/chrome';
import {
  findDuplicateBookmarks,
  mergeDuplicateBookmarks,
  checkBookmarkHealth,
  removeDeadBookmarks,
  clusterBookmarksByDomain,
  organizeClusterIntoFolder,
  findEmptyFolders,
  removeEmptyFolders,
  collectBookmarkOverview,
  type DuplicateBookmarkGroup,
  type BookmarkHealth,
  type DomainCluster,
  type EmptyFolder,
  type BookmarkOverview,
} from './bookmark-tools';
import { useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { feedback } from '@/shared/ui/feedback';
import styles from './bookmark-tools.module.less';

interface BookmarkToolsModalProps {
  open: boolean;
  onClose: () => void;
  onMutated: () => void;
}

/** 工具箱左侧导航的能力 key */
type ToolKey = 'overview' | 'dedupe' | 'health' | 'organize' | 'empty';

/**
 * 通用 favicon 图标，附域名首字母兜底
 * @param root0 - 组件属性
 * @param root0.url - 书签 URL
 * @param root0.size - 图标尺寸
 * @returns {JSX.Element} 返回 favicon 图标 JSX 元素
 */
function SiteIcon({ url, size = 18 }: { url: string; size?: number }) {
  const fav = getFaviconUrl(url);
  const [err, setErr] = useState(false);
  let host = url;
  try { host = new URL(url).hostname; } catch { /* keep */ }
  if (fav && !err) {
    return (
      <img
        src={fav}
        alt=""
        className={styles['bm-tools__favicon']}
        style={{ width: size, height: size }}
        onError={() => setErr(true)}
      />
    );
  }
  const letter = (host.charAt(0) || '?').toUpperCase();
  return (
    <span className={`${styles['bm-tools__favicon']} ${styles['bm-tools__favicon--fallback']}`} style={{ width: size, height: size }}>
      {letter}
    </span>
  );
}

/**
 * 顶部统计卡片
 * @param root0 - 组件属性
 * @param root0.icon - 图标
 * @param root0.label - 标签
 * @param root0.value - 数值
 * @param root0.accent - 强调样式
 * @returns {JSX.Element} 返回统计卡片 JSX 元素
 */
function StatCard({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: number | string; accent?: 'primary' | 'success' | 'warning' | 'info';
}) {
  return (
    <div className={`${styles['bm-tools__stat-card']}${accent ? ` is-${accent}` : ''}`}>
      <div className={styles['bm-tools__stat-icon']}>{icon}</div>
      <div className={styles['bm-tools__stat-body']}>
        <div className={styles['bm-tools__stat-value']}>{value}</div>
        <div className={styles['bm-tools__stat-label']}>{label}</div>
      </div>
    </div>
  );
}

/**
 * 书签工具箱主模态框
 * @param root0 - 组件属性
 * @param root0.open - 是否打开
 * @param root0.onClose - 关闭回调
 * @param root0.onMutated - 数据变更回调
 * @returns {JSX.Element} 返回书签工具箱模态框 JSX 元素
 */
export function BookmarkToolsModal({ open, onClose, onMutated }: BookmarkToolsModalProps) {
  const { t } = useT();
  const dedupStrictness = useSettingsStore((s) => s.settings.dedupStrictness) ?? 'loose';

  const [activeTool, setActiveTool] = useState<ToolKey>('overview');

  // ── 总览 ──
  const [overview, setOverview] = useState<BookmarkOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const refreshOverview = useCallback(async () => {
    setOverviewLoading(true);
    const tree = await getBookmarkTree();
    setOverview(collectBookmarkOverview(tree));
    setOverviewLoading(false);
  }, []);

  // 弹窗打开时拉一次总览（仅一次；关闭后不主动重拉，避免应用启动时多余请求）
  useEffect(() => {
    if (open && overview === null && !overviewLoading) {
      void refreshOverview();
    }
  }, [open, overview, overviewLoading, refreshOverview]);

  // ── 去重 ──
  const [dups, setDups] = useState<DuplicateBookmarkGroup[] | null>(null);
  const [dupLoading, setDupLoading] = useState(false);

  const scanDuplicates = useCallback(async () => {
    setDupLoading(true);
    const tree = await getBookmarkTree();
    setDups(findDuplicateBookmarks(tree, dedupStrictness));
    setDupLoading(false);
  }, [dedupStrictness]);

  const applyDedupe = useCallback(async () => {
    if (dups === null) return;
    const removed = await mergeDuplicateBookmarks(dups);
    feedback.success(t('bookmark.tools.dedupeDone', { count: removed }));
    onMutated();
    setDups(null);
    void refreshOverview();
  }, [dups, t, onMutated, refreshOverview]);

  // ── 失效检测 ──
  const [healthResults, setHealthResults] = useState<BookmarkHealth[] | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthProgress, setHealthProgress] = useState<{ done: number; total: number } | null>(null);
  const [healthPermission, setHealthPermission] = useState<boolean | null>(null);
  const [healthFilter, setHealthFilter] = useState<'all' | 'dead' | 'timeout' | 'ok'>('dead');

  const checkHealth = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.permissions?.request) {
      feedback.error(t('bookmark.tools.healthNeedPermission'));
      return;
    }
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
    void refreshOverview();
  }, [healthResults, t, onMutated, refreshOverview]);

  const filteredHealth = useMemo(() => {
    if (healthResults === null) return [];
    if (healthFilter === 'all') return healthResults;
    return healthResults.filter((r) => r.status === healthFilter);
  }, [healthResults, healthFilter]);

  const deadList = useMemo(
    () => healthResults?.filter((r) => r.status === 'dead' || r.status === 'timeout') ?? [],
    [healthResults],
  );

  const healthStats = useMemo(() => {
    if (healthResults === null) return null;
    const ok = healthResults.filter((r) => r.status === 'ok').length;
    const dead = healthResults.filter((r) => r.status === 'dead').length;
    const timeout = healthResults.filter((r) => r.status === 'timeout').length;
    const skipped = healthResults.filter((r) => r.status === 'skipped').length;
    return { ok, dead, timeout, skipped, total: healthResults.length };
  }, [healthResults]);

  // ── 智能整理 ──
  const [clusters, setClusters] = useState<DomainCluster[] | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [selectedClusters, setSelectedClusters] = useState<Set<string>>(new Set());
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

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
    const parentId = '2'; // "其他书签"
    let created = 0;
    for (const c of clusters) {
      if (!selectedClusters.has(c.domain)) continue;
      const fid = await organizeClusterIntoFolder(c, parentId);
      if (fid !== null) created += 1;
    }
    feedback.success(t('bookmark.tools.organizeDone', { count: created }));
    onMutated();
    setClusters(null);
    void refreshOverview();
  }, [clusters, selectedClusters, t, onMutated, refreshOverview]);

  // ── 空文件夹清理 ──
  const [emptyFolders, setEmptyFolders] = useState<EmptyFolder[] | null>(null);
  const [emptyLoading, setEmptyLoading] = useState(false);

  const scanEmptyFolders = useCallback(async () => {
    setEmptyLoading(true);
    const tree = await getBookmarkTree();
    setEmptyFolders(findEmptyFolders(tree));
    setEmptyLoading(false);
  }, []);

  const applyRemoveEmpty = useCallback(async () => {
    if (emptyFolders === null) return;
    const removed = await removeEmptyFolders(emptyFolders);
    feedback.success(t('bookmark.tools.emptyDone', { count: removed }));
    onMutated();
    setEmptyFolders(null);
    void refreshOverview();
  }, [emptyFolders, t, onMutated, refreshOverview]);

  // 首次打开总览已由 useEffect 接管，这里不需额外调用

  // ─────────────────────────────────────────────────────────
  // Renderers
  // ─────────────────────────────────────────────────────────

  const navItems: Array<{ key: ToolKey; icon: React.ReactNode; label: string; badge?: number }> = [
    { key: 'overview', icon: <LayoutDashboard size={ICON_SIZE.MEDIUM} />, label: t('bookmark.tools.overview') },
    { key: 'dedupe', icon: <Copy size={ICON_SIZE.MEDIUM} />, label: t('bookmark.tools.dedupe'), badge: dups?.length },
    { key: 'health', icon: <HeartPulse size={ICON_SIZE.MEDIUM} />, label: t('bookmark.tools.health'), badge: deadList.length },
    { key: 'organize', icon: <FolderTree size={ICON_SIZE.MEDIUM} />, label: t('bookmark.tools.organize'), badge: clusters?.length },
    { key: 'empty', icon: <FolderX size={ICON_SIZE.MEDIUM} />, label: t('bookmark.tools.empty'), badge: emptyFolders?.length },
  ];

  // ── 总览面板 ──
  const renderOverview = () => (
    <div className={styles['bm-tools__panel']}>
      <div className={styles['bm-tools__panel-header']}>
        <div>
          <div className={styles['bm-tools__panel-title']}>{t('bookmark.tools.overview')}</div>
          <div className={styles['bm-tools__panel-subtitle']}>{t('bookmark.tools.overviewHint')}</div>
        </div>
        <Button
          size="small"
          icon={<RefreshCw size={ICON_SIZE.SMALL} />}
          loading={overviewLoading}
          onClick={() => { void refreshOverview(); }}
        >
          {t('bookmark.tools.refresh')}
        </Button>
      </div>

      <div className={styles['bm-tools__stat-grid']}>
        <StatCard
          icon={<BookmarkIcon size={ICON_SIZE.MEDIUM} />}
          label={t('bookmark.tools.statTotal')}
          value={overview?.total ?? '—'}
          accent="primary"
        />
        <StatCard
          icon={<Folder size={ICON_SIZE.MEDIUM} />}
          label={t('bookmark.tools.statFolders')}
          value={overview?.folders ?? '—'}
          accent="info"
        />
        <StatCard
          icon={<Globe size={ICON_SIZE.MEDIUM} />}
          label={t('bookmark.tools.statDomains')}
          value={overview?.domains ?? '—'}
          accent="success"
        />
        <StatCard
          icon={<Layers size={ICON_SIZE.MEDIUM} />}
          label={t('bookmark.tools.statDepth')}
          value={overview?.maxDepth ?? '—'}
          accent="warning"
        />
      </div>

      <div className={styles['bm-tools__quick-grid']}>
        <Button type="default" className={styles['bm-tools__quick']} onClick={() => setActiveTool('dedupe')}>
          <Copy size={ICON_SIZE.MEDIUM} />
          <div className={styles['bm-tools__quick-text']}>
            <span className={styles['bm-tools__quick-title']}>{t('bookmark.tools.dedupe')}</span>
            <span className={styles['bm-tools__quick-desc']}>{t('bookmark.tools.dedupeShort')}</span>
          </div>
        </Button>
        <Button type="default" className={styles['bm-tools__quick']} onClick={() => setActiveTool('health')}>
          <HeartPulse size={ICON_SIZE.MEDIUM} />
          <div className={styles['bm-tools__quick-text']}>
            <span className={styles['bm-tools__quick-title']}>{t('bookmark.tools.health')}</span>
            <span className={styles['bm-tools__quick-desc']}>{t('bookmark.tools.healthShort')}</span>
          </div>
        </Button>
        <Button type="default" className={styles['bm-tools__quick']} onClick={() => setActiveTool('organize')}>
          <FolderTree size={ICON_SIZE.MEDIUM} />
          <div className={styles['bm-tools__quick-text']}>
            <span className={styles['bm-tools__quick-title']}>{t('bookmark.tools.organize')}</span>
            <span className={styles['bm-tools__quick-desc']}>{t('bookmark.tools.organizeShort')}</span>
          </div>
        </Button>
        <Button type="default" className={styles['bm-tools__quick']} onClick={() => setActiveTool('empty')}>
          <FolderX size={ICON_SIZE.MEDIUM} />
          <div className={styles['bm-tools__quick-text']}>
            <span className={styles['bm-tools__quick-title']}>{t('bookmark.tools.empty')}</span>
            <span className={styles['bm-tools__quick-desc']}>{t('bookmark.tools.emptyShort')}</span>
          </div>
        </Button>
      </div>
    </div>
  );

  // ── 去重 ──
  const renderDedupe = () => (
    <div className={styles['bm-tools__panel']}>
      <div className={styles['bm-tools__panel-header']}>
        <div>
          <div className={styles['bm-tools__panel-title']}>{t('bookmark.tools.dedupe')}</div>
          <div className={styles['bm-tools__panel-subtitle']}>
            {t('bookmark.tools.dedupeHint', { mode: dedupStrictness })}
          </div>
        </div>
        <div className={styles['bm-tools__panel-actions']}>
          <Button
            type="primary"
            loading={dupLoading}
            icon={<RefreshCw size={ICON_SIZE.SMALL} />}
            onClick={() => { void scanDuplicates(); }}
          >
            {t('bookmark.tools.scan')}
          </Button>
          {dups !== null && dups.length > 0 && (
            <Button
              danger
              icon={<Check size={ICON_SIZE.SMALL} />}
              onClick={() => { void applyDedupe(); }}
            >
              {t('bookmark.tools.mergeAll', { count: dups.reduce((s, g) => s + g.items.length - 1, 0) })}
            </Button>
          )}
        </div>
      </div>

      {dups === null && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('bookmark.tools.idle')}
          className={styles['bm-tools__empty']}
        />
      )}

      {dups !== null && dups.length === 0 && (
        <Alert type="success" showIcon message={t('bookmark.tools.dedupeClean')} />
      )}

      {dups !== null && dups.length > 0 && (
        <div className={styles['bm-tools__list']}>
          {dups.map((g) => (
            <div key={g.key} className={styles['bm-tools__group']}>
              <div className={styles['bm-tools__group-header']}>
                <SiteIcon url={g.items[0]?.url ?? g.key} />
                <div className={styles['bm-tools__group-title']} title={g.key}>{g.key}</div>
                <Tag color="orange" bordered={false}>
                  {t('bookmark.tools.dedupeItems', { count: g.items.length })}
                </Tag>
              </div>
              <div className={styles['bm-tools__group-body']}>
                {g.items.map((item, idx) => (
                  <div key={item.id} className={`${styles['bm-tools__row']}${idx === 0 ? ' is-keep' : ''}`}>
                    <div className={styles['bm-tools__row-main']}>
                      <div className={styles['bm-tools__row-title']}>{item.title || item.url}</div>
                      <div className={styles['bm-tools__row-sub']}>{item.url}</div>
                    </div>
                    {idx === 0
                      ? <Tag color="green" bordered={false}>{t('bookmark.tools.keep')}</Tag>
                      : <Tag color="red" bordered={false}>{t('bookmark.tools.willRemove')}</Tag>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── 失效检测 ──
  const renderHealth = () => (
    <div className={styles['bm-tools__panel']}>
      <div className={styles['bm-tools__panel-header']}>
        <div>
          <div className={styles['bm-tools__panel-title']}>{t('bookmark.tools.health')}</div>
          <div className={styles['bm-tools__panel-subtitle']}>{t('bookmark.tools.healthHint')}</div>
        </div>
        <div className={styles['bm-tools__panel-actions']}>
          <Button
            type="primary"
            loading={healthLoading}
            icon={<RefreshCw size={ICON_SIZE.SMALL} />}
            onClick={() => { void checkHealth(); }}
          >
            {t('bookmark.tools.scan')}
          </Button>
          {deadList.length > 0 && (
            <Button
              danger
              icon={<Check size={ICON_SIZE.SMALL} />}
              onClick={() => { void applyRemoveDead(); }}
            >
              {t('bookmark.tools.removeDeadAll', { count: deadList.length })}
            </Button>
          )}
        </div>
      </div>

      {healthPermission === false && (
        <Alert type="error" showIcon message={t('bookmark.tools.healthNeedPermission')} />
      )}

      {healthLoading && healthProgress !== null && (
        <div className={styles['bm-tools__progress']}>
          <Progress
            percent={healthProgress.total > 0
              ? Math.round((healthProgress.done / healthProgress.total) * 100)
              : 0}
            status="active"
          />
          <div className={styles['bm-tools__progress-text']}>
            {t('bookmark.tools.healthProgress', { done: healthProgress.done, total: healthProgress.total })}
          </div>
        </div>
      )}

      {healthStats !== null && (
        <div className={styles['bm-tools__health-summary']}>
          <span className="bm-tools__chip is-success">
            <span className={styles['bm-tools__chip-dot']} /> {t('bookmark.tools.statusOk')} {healthStats.ok}
          </span>
          <span className="bm-tools__chip is-danger">
            <span className={styles['bm-tools__chip-dot']} /> {t('bookmark.tools.statusDead')} {healthStats.dead}
          </span>
          <span className="bm-tools__chip is-warning">
            <span className={styles['bm-tools__chip-dot']} /> {t('bookmark.tools.statusTimeout')} {healthStats.timeout}
          </span>
          <span className="bm-tools__chip is-muted">
            <span className={styles['bm-tools__chip-dot']} /> {t('bookmark.tools.statusSkipped')} {healthStats.skipped}
          </span>
        </div>
      )}

      {healthResults !== null && (
        <Segmented
          size="small"
          value={healthFilter}
          onChange={(v) => setHealthFilter(v as typeof healthFilter)}
          options={[
            { value: 'dead', label: `${t('bookmark.tools.statusDead')} (${healthStats?.dead ?? 0})` },
            { value: 'timeout', label: `${t('bookmark.tools.statusTimeout')} (${healthStats?.timeout ?? 0})` },
            { value: 'ok', label: `${t('bookmark.tools.statusOk')} (${healthStats?.ok ?? 0})` },
            { value: 'all', label: `${t('bookmark.tools.statusAll')} (${healthStats?.total ?? 0})` },
          ]}
        />
      )}

      {healthResults === null && !healthLoading && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('bookmark.tools.idle')}
          className={styles['bm-tools__empty']}
        />
      )}

      {healthResults !== null && filteredHealth.length === 0 && (
        <Alert type="success" showIcon message={t('bookmark.tools.healthFilterEmpty')} />
      )}

      {healthResults !== null && filteredHealth.length > 0 && (
        <div className={styles['bm-tools__list']}>
          {filteredHealth.map((r) => (
            <div key={r.bookmark.id} className={`bm-tools__row is-status-${r.status}`}>
              <SiteIcon url={r.bookmark.url ?? ''} />
              <div className={styles['bm-tools__row-main']}>
                <div className={styles['bm-tools__row-title']}>{r.bookmark.title || r.bookmark.url}</div>
                <div className={styles['bm-tools__row-sub']}>{r.bookmark.url}</div>
              </div>
              <Tag
                bordered={false}
                color={r.status === 'ok' ? 'green' : r.status === 'timeout' ? 'orange' : r.status === 'dead' ? 'red' : 'default'}
              >
                {t(`bookmark.tools.status${r.status.charAt(0).toUpperCase() + r.status.slice(1)}` as never)}
              </Tag>
              {r.bookmark.url !== undefined && (
                <Tooltip title={t('bookmark.tools.openInNewTab')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<ExternalLink size={ICON_SIZE.SMALL} />}
                    onClick={() => { void createTab({ url: r.bookmark.url, active: false }); }}
                  />
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── 智能整理 ──
  const renderOrganize = () => (
    <div className={styles['bm-tools__panel']}>
      <div className={styles['bm-tools__panel-header']}>
        <div>
          <div className={styles['bm-tools__panel-title']}>{t('bookmark.tools.organize')}</div>
          <div className={styles['bm-tools__panel-subtitle']}>{t('bookmark.tools.organizeHint')}</div>
        </div>
        <div className={styles['bm-tools__panel-actions']}>
          <Button
            type="primary"
            loading={orgLoading}
            icon={<RefreshCw size={ICON_SIZE.SMALL} />}
            onClick={() => { void scanClusters(); }}
          >
            {t('bookmark.tools.scan')}
          </Button>
          {clusters !== null && clusters.length > 0 && (
            <Button
              type="primary"
              icon={<Check size={ICON_SIZE.SMALL} />}
              onClick={() => { void applyOrganize(); }}
              disabled={selectedClusters.size === 0}
            >
              {t('bookmark.tools.organizeApply', { count: selectedClusters.size })}
            </Button>
          )}
        </div>
      </div>

      {clusters === null && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('bookmark.tools.idle')}
          className={styles['bm-tools__empty']}
        />
      )}

      {clusters !== null && clusters.length === 0 && (
        <Alert type="success" showIcon message={t('bookmark.tools.organizeEmpty')} />
      )}

      {clusters !== null && clusters.length > 0 && (
        <div className={styles['bm-tools__list']}>
          {clusters.map((c) => {
            const checked = selectedClusters.has(c.domain);
            const expanded = expandedCluster === c.domain;
            return (
              <div key={c.domain} className={`bm-tools__group${checked ? ' is-checked' : ''}`}>
                <div
                  className="bm-tools__group-header is-clickable"
                  onClick={() => {
                    const next = new Set(selectedClusters);
                    if (checked) next.delete(c.domain); else next.add(c.domain);
                    setSelectedClusters(next);
                  }}
                >
                  <Checkbox checked={checked} onChange={() => undefined} />
                  <SiteIcon url={`https://${c.domain}`} />
                  <div className={styles['bm-tools__group-title']}>{c.domain}</div>
                  <Tag bordered={false} color="blue">
                    {t('bookmark.tools.organizeCount', { count: c.items.length })}
                  </Tag>
                  <Button
                    type="text"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedCluster(expanded ? null : c.domain);
                    }}
                  >
                    {expanded ? t('bookmark.tools.collapse') : t('bookmark.tools.expand')}
                  </Button>
                </div>
                {expanded && (
                  <div className={styles['bm-tools__group-body']}>
                    {c.items.map((item) => (
                      <div key={item.id} className="bm-tools__row is-mini">
                        <div className={styles['bm-tools__row-main']}>
                          <div className={styles['bm-tools__row-title']}>{item.title || item.url}</div>
                          <div className={styles['bm-tools__row-sub']}>{item.url}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── 空文件夹 ──
  const renderEmpty = () => (
    <div className={styles['bm-tools__panel']}>
      <div className={styles['bm-tools__panel-header']}>
        <div>
          <div className={styles['bm-tools__panel-title']}>{t('bookmark.tools.empty')}</div>
          <div className={styles['bm-tools__panel-subtitle']}>{t('bookmark.tools.emptyHint')}</div>
        </div>
        <div className={styles['bm-tools__panel-actions']}>
          <Button
            type="primary"
            loading={emptyLoading}
            icon={<RefreshCw size={ICON_SIZE.SMALL} />}
            onClick={() => { void scanEmptyFolders(); }}
          >
            {t('bookmark.tools.scan')}
          </Button>
          {emptyFolders !== null && emptyFolders.length > 0 && (
            <Button
              danger
              icon={<Check size={ICON_SIZE.SMALL} />}
              onClick={() => { void applyRemoveEmpty(); }}
            >
              {t('bookmark.tools.emptyRemoveAll', { count: emptyFolders.reduce((s, e) => s + e.size, 0) })}
            </Button>
          )}
        </div>
      </div>

      {emptyFolders === null && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('bookmark.tools.idle')}
          className={styles['bm-tools__empty']}
        />
      )}

      {emptyFolders !== null && emptyFolders.length === 0 && (
        <Alert type="success" showIcon message={t('bookmark.tools.emptyClean')} />
      )}

      {emptyFolders !== null && emptyFolders.length > 0 && (
        <List
          size="small"
          dataSource={emptyFolders}
          renderItem={(e) => (
            <List.Item>
              <div className={styles['bm-tools__row']}>
                <FolderX size={ICON_SIZE.MEDIUM} className="bm-tools__row-icon is-warning" />
                <div className={styles['bm-tools__row-main']}>
                  <div className={styles['bm-tools__row-title']}>{e.folder.title || t('bookmark.tools.unnamed')}</div>
                  {e.size > 1 && (
                    <div className={styles['bm-tools__row-sub']}>
                      {t('bookmark.tools.emptyCascade', { count: e.size })}
                    </div>
                  )}
                </div>
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  const renderActive = () => {
    switch (activeTool) {
      case 'overview': return renderOverview();
      case 'dedupe': return renderDedupe();
      case 'health': return renderHealth();
      case 'organize': return renderOrganize();
      case 'empty': return renderEmpty();
      default: return null;
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={920}
      title={
        <div className={styles['bm-tools__title']}>
          <Hash size={ICON_SIZE.MEDIUM} />
          <span>{t('bookmark.tools.title')}</span>
          {overview !== null && (
            <span className={styles['bm-tools__title-meta']}>
              {t('bookmark.tools.titleMeta', {
                bookmarks: overview.total,
                folders: overview.folders,
              })}
            </span>
          )}
        </div>
      }
      destroyOnHidden
      className={styles['bm-tools__modal']}
    >
      <div className={styles['bm-tools__layout']}>
        <nav className={styles['bm-tools__nav']}>
          {navItems.map((item) => (
            <Button
              key={item.key}
              type="text"
              className={`bm-tools__nav-item${activeTool === item.key ? ' is-active' : ''}`}
              onClick={() => setActiveTool(item.key)}
            >
              <span className={styles['bm-tools__nav-icon']}>{item.icon}</span>
              <span className={styles['bm-tools__nav-label']}>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={styles['bm-tools__nav-badge']}>{item.badge}</span>
              )}
            </Button>
          ))}
        </nav>
        <section className={styles['bm-tools__content']}>
          {renderActive()}
        </section>
      </div>
    </Modal>
  );
}
