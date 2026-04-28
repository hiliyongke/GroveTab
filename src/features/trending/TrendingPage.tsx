/**
 * 热榜聚合页面 —— 全网热点一站查看
 *
 * 功能：
 *   - 多分类导航（全部/综合/科技/娱乐/社区/新闻）
 *   - 热榜卡片网格，每卡片展示一个平台的 Top 榜单
 *   - 偷摸模式：一键伪装为邮件/文档/表格/代码页面
 *   - 手动刷新单个平台或全部刷新
 *   - 点击条目跳转到原始链接
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, Button, Card, Empty, Segmented, Space, Spin, Tag, Tooltip, Typography, theme } from 'antd';
import {
  RefreshCw,
  EyeOff,
  ExternalLink,
  Flame,
  Cpu,
  Gamepad2,
  Users,
  Newspaper,
  LayoutGrid,
  Mail,
  FileText,
  Table2,
  Code2,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useT } from '@/shared/i18n';
import type { TrendingCategory, TrendingGroupMode, HotBoardData, StealthModeConfig } from '@/shared/types';
import {
  fetchMultipleBoards,
  forceRefreshBoard,
  getPlatformsByCategory,
  getPlatformColor,
} from '@/services/trending-service';

const { Text, Title } = Typography;

// ── 分类配置 ──────────────────────────────────────────

interface CategoryOption {
  value: TrendingCategory;
  labelKey: string;
  icon: React.ReactNode;
}

const CATEGORIES: CategoryOption[] = [
  { value: 'all', labelKey: 'trending.catAll', icon: <LayoutGrid size={ICON_SIZE.DEFAULT} /> },
  { value: 'comprehensive', labelKey: 'trending.catComprehensive', icon: <Flame size={ICON_SIZE.DEFAULT} /> },
  { value: 'tech', labelKey: 'trending.catTech', icon: <Cpu size={ICON_SIZE.DEFAULT} /> },
  { value: 'entertainment', labelKey: 'trending.catEntertainment', icon: <Gamepad2 size={ICON_SIZE.DEFAULT} /> },
  { value: 'community', labelKey: 'trending.catCommunity', icon: <Users size={ICON_SIZE.DEFAULT} /> },
  { value: 'news', labelKey: 'trending.catNews', icon: <Newspaper size={ICON_SIZE.DEFAULT} /> },
];

/** 偷摸模式伪装选项 */
const STEALTH_OPTIONS: { value: StealthModeConfig['disguise']; labelKey: string; icon: React.ReactNode }[] = [
  { value: 'email', labelKey: 'trending.stealthEmail', icon: <Mail size={ICON_SIZE.DEFAULT} /> },
  { value: 'doc', labelKey: 'trending.stealthDoc', icon: <FileText size={ICON_SIZE.DEFAULT} /> },
  { value: 'spreadsheet', labelKey: 'trending.stealthSpreadsheet', icon: <Table2 size={ICON_SIZE.DEFAULT} /> },
  { value: 'code', labelKey: 'trending.stealthCode', icon: <Code2 size={ICON_SIZE.DEFAULT} /> },
];

// ── 偷摸模式伪装页面 ──────────────────────────────────

function StealthDisguise({ disguise }: { disguise: StealthModeConfig['disguise'] }) {
  const { token } = theme.useToken();

  const content = useMemo(() => {
    switch (disguise) {
      case 'email':
        return {
          title: '收件箱',
          items: [
            { from: '产品经理', subject: '关于 Q2 季度 OKR 对齐会议的邀请', time: '10:32' },
            { from: 'HR', subject: '本周五下午团建活动通知', time: '09:15' },
            { from: '技术主管', subject: 'Re: 新项目技术方案评审', time: '昨天' },
            { from: '设计团队', subject: '设计稿已更新，请查阅 Figma', time: '昨天' },
            { from: '运维', subject: '服务器维护通知 - 本周六凌晨', time: '周一' },
          ],
        };
      case 'doc':
        return {
          title: '项目周报 - 第 17 周',
          items: [
            { from: '一、本周工作进展', subject: '1.1 完成用户认证模块重构，测试覆盖率达到 92%', time: '' },
            { from: '', subject: '1.2 修复 3 个 P1 级线上问题，优化查询性能提升 40%', time: '' },
            { from: '二、下周计划', subject: '2.1 启动数据分析模块开发', time: '' },
            { from: '', subject: '2.2 完成技术方案评审与排期', time: '' },
            { from: '三、风险与依赖', subject: '3.1 第三方 API 响应延迟需跟进', time: '' },
          ],
        };
      case 'spreadsheet':
        return {
          title: 'Q2 季度预算表',
          items: [
            { from: '项目名称', subject: '预算金额（万元）', time: '实际支出' },
            { from: '用户增长', subject: '120.00', time: '98.50' },
            { from: '内容运营', subject: '85.00', time: '72.30' },
            { from: '品牌推广', subject: '200.00', time: '156.80' },
            { from: '技术基建', subject: '150.00', time: '134.20' },
          ],
        };
      case 'code':
        return {
          title: 'main.ts',
          items: [
            { from: ' 1', subject: "import { createApp } from 'vue';", time: '' },
            { from: ' 2', subject: "import App from './App.vue';", time: '' },
            { from: ' 3', subject: "import router from './router';", time: '' },
            { from: ' 4', subject: "import { createPinia } from 'pinia';", time: '' },
            { from: ' 5', subject: '', time: '' },
            { from: ' 6', subject: 'const app = createApp(App);', time: '' },
            { from: ' 7', subject: 'app.use(createPinia());', time: '' },
            { from: ' 8', subject: 'app.use(router);', time: '' },
            { from: ' 9', subject: 'app.mount("#app");', time: '' },
          ],
        };
    }
  }, [disguise]);

  const isCode = disguise === 'code';
  const isSpreadsheet = disguise === 'spreadsheet';

  return (
    <div style={{ padding: '28px 0 0' }}>
      <Card
        style={{
          borderRadius: 18,
          background: 'var(--canopy-glass-bg)',
          border: '1px solid var(--canopy-hairline)',
          boxShadow: 'var(--canopy-shadow-card)',
        }}
        styles={{ body: { padding: 24 } }}
      >
        <Title level={4} style={{ margin: '0 0 16px' }}>{content.title}</Title>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {content.items.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderBottom: i < content.items.length - 1 ? `1px solid ${token.colorBorderSecondary}` : 'none',
                fontSize: 13,
                fontFamily: isCode ? 'monospace' : 'inherit',
              }}
            >
              {item.from && (
                <span style={{ fontWeight: isSpreadsheet ? 600 : 500, color: token.colorText, minWidth: isCode ? 32 : 80 }}>
                  {item.from}
                </span>
              )}
              <span style={{ flex: 1, color: isCode ? token.colorTextSecondary : token.colorText }}>
                {item.subject}
              </span>
              {item.time && (
                <span style={{ color: token.colorTextTertiary, fontSize: 12, flexShrink: 0 }}>
                  {item.time}
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── 单条热榜条目 ──────────────────────────────────────

/** 排名金银铜徽章 */
function RankBadge({ rank }: { rank: number }) {
  const { token } = theme.useToken();

  if (rank === 1) {
    return (
      <span style={{
        width: 20, height: 20, borderRadius: 6, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        background: token.colorError, color: '#fff',
        fontSize: 11, fontWeight: 700, flexShrink: 0,
      }}>1</span>
    );
  }
  if (rank === 2) {
    return (
      <span style={{
        width: 20, height: 20, borderRadius: 6, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#faad14', color: '#fff',
        fontSize: 11, fontWeight: 700, flexShrink: 0,
      }}>2</span>
    );
  }
  if (rank === 3) {
    return (
      <span style={{
        width: 20, height: 20, borderRadius: 6, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#d48806', color: '#fff',
        fontSize: 11, fontWeight: 700, flexShrink: 0,
      }}>3</span>
    );
  }
  return (
    <span style={{
      width: 20, textAlign: 'center', fontSize: 12, fontWeight: 600,
      color: token.colorTextTertiary, flexShrink: 0,
    }}>{rank}</span>
  );
}

function TrendingListItem({ item, rank }: { item: HotBoardData['items'][0]; rank: number }) {
  const { token } = theme.useToken();

  return (
    <Tooltip title={item.title} placement="topLeft" mouseEnterDelay={0.6}>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px',
          borderRadius: 8,
          textDecoration: 'none',
          color: 'inherit',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = token.colorFillQuaternary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        {/* 排名 */}
        <RankBadge rank={rank} />
        {/* 标题 */}
        <span
          style={{
            flex: 1,
            fontSize: 13,
            lineHeight: 1.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: token.colorText,
          }}
        >
          {item.title}
        </span>
        {/* 热度 —— 固定宽度右对齐 */}
        {item.hotLabel ? (
          <span style={{
            fontSize: 11, color: token.colorTextTertiary, flexShrink: 0,
            width: 64, textAlign: 'right',
          }}>
            {item.hotLabel}
          </span>
        ) : (
          <span style={{ width: 64, flexShrink: 0 }} />
        )}
        {/* 外链图标 */}
        <ExternalLink size={12} style={{ color: token.colorTextQuaternary, flexShrink: 0 }} />
      </a>
    </Tooltip>
  );
}

// ── 加载中/失败占位卡片 ───────────────────────────────

function HotBoardSkeletonCard({
  platformId,
  platformName,
  platformSubtitle,
  onRefresh,
}: {
  platformId: string;
  platformName: string;
  platformSubtitle: string;
  onRefresh: (id: string) => Promise<boolean>;
}) {
  const { token } = theme.useToken();
  const { t } = useT();
  const platformColor = getPlatformColor(platformId);
  const [refreshing, setRefreshing] = useState(false);
  const [errored, setErrored] = useState(false);

  const handleRefresh = useCallback(async () => {
    setErrored(false);
    setRefreshing(true);
    const result = await onRefresh(platformId);
    setRefreshing(false);
    if (!result) setErrored(true);
  }, [platformId, onRefresh]);

  return (
    <Card
      style={{
        minHeight: 420,
        borderRadius: 18,
        background: 'var(--canopy-glass-bg)',
        border: '1px solid var(--canopy-hairline)',
        boxShadow: 'var(--canopy-shadow-card)',
      }}
      styles={{ body: { padding: '14px 16px' } }}
    >
      {/* 卡片头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: platformColor,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 14, fontWeight: 700, color: token.colorText }}>
            {platformName}
          </span>
          {platformSubtitle && (
            <Tag style={{ margin: 0, fontSize: 10, borderRadius: 4, lineHeight: '16px' }}>
              {platformSubtitle}
            </Tag>
          )}
        </div>
        <Tooltip title={t('trending.refresh')}>
          <Button
            type="text"
            size="small"
            icon={
              <RefreshCw
                size={ICON_SIZE.SMALL}
                style={{
                  animation: refreshing ? 'canopy-spin 1s linear infinite' : 'none',
                }}
              />
            }
            onClick={handleRefresh}
            disabled={refreshing}
          />
        </Tooltip>
      </div>

      {/* 占位内容：加载中 / 加载失败 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 8 }}>
        {refreshing ? (
          <>
            <Spin size="small" />
            <Text type="secondary" style={{ fontSize: 12 }}>{t('trending.loading')}</Text>
          </>
        ) : errored ? (
          <>
            <Text type="danger" style={{ fontSize: 12 }}>{t('trending.noData')}</Text>
            <Button type="link" size="small" onClick={handleRefresh} style={{ fontSize: 11, padding: 0, height: 20 }}>
              {t('trending.refresh')}
            </Button>
          </>
        ) : (
          <>
            <Spin size="small" />
            <Text type="secondary" style={{ fontSize: 12 }}>{t('trending.loading')}</Text>
          </>
        )}
      </div>
    </Card>
  );
}

// ── 热榜卡片 ──────────────────────────────────────────

function HotBoardCard({
  board,
  onRefresh,
}: {
  board: HotBoardData;
  onRefresh: (id: string) => void;
}) {
  const { token } = theme.useToken();
  const { t } = useT();
  const [refreshing, setRefreshing] = useState(false);
  const platformColor = getPlatformColor(board.id);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh(board.id);
    setRefreshing(false);
  }, [board.id, onRefresh]);

  return (
    <Card
      style={{
        minHeight: 420,
        borderRadius: 18,
        background: 'var(--canopy-glass-bg)',
        border: '1px solid var(--canopy-hairline)',
        boxShadow: 'var(--canopy-shadow-card)',
        display: 'flex',
        flexDirection: 'column',
      }}
      styles={{ body: { padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column' } }}
    >
      {/* 卡片头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: platformColor,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 14, fontWeight: 700, color: token.colorText }}>
            {board.name}
          </span>
          {board.subtitle && (
            <Tag style={{ margin: 0, fontSize: 10, borderRadius: 4, lineHeight: '16px' }}>
              {board.subtitle}
            </Tag>
          )}
        </div>
        <Tooltip title={t('trending.refresh')}>
          <Button
            type="text"
            size="small"
            icon={
              <RefreshCw
                size={ICON_SIZE.SMALL}
                style={{
                  animation: refreshing ? 'canopy-spin 1s linear infinite' : 'none',
                }}
              />
            }
            onClick={handleRefresh}
            disabled={refreshing}
          />
        </Tooltip>
      </div>

      {/* 榜单列表 */}
      <div style={{ flex: 1, overflow: 'auto', margin: '0 -8px' }}>
        {board.items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('trending.noData')}</Text>
          </div>
        ) : (
          board.items.map((item, idx) => (
            <TrendingListItem key={item.id || idx} item={item} rank={idx + 1} />
          ))
        )}
      </div>

      {/* 更新时间 */}
      {board.updateTime && (
        <div style={{ marginTop: 6, textAlign: 'right' }}>
          <Text type="secondary" style={{ fontSize: 10 }}>
            {new Date(board.updateTime).toLocaleTimeString()}
          </Text>
        </div>
      )}
    </Card>
  );
}

// ── 主页面 ────────────────────────────────────────────

export function TrendingPage() {
  const { t } = useT();
  const { token } = theme.useToken();

  /** 当前分类 */
  const [category, setCategory] = useState<TrendingCategory>('all');
  /** 布局模式 */
  const [groupMode, setGroupMode] = useState<TrendingGroupMode>('default');
  /** 偷摸模式 */
  const [stealthMode, setStealthMode] = useState<StealthModeConfig>({ enabled: false, disguise: 'email' });
  /** 榜单数据 */
  const [boards, setBoards] = useState<Record<string, HotBoardData>>({});
  /** 加载状态 */
  const [loading, setLoading] = useState(true);
  /** 是否全部加载失败 */
  const [allFailed, setAllFailed] = useState(false);

  /** 根据分类获取需要加载的平台列表 */
  const activePlatforms = useMemo(() => getPlatformsByCategory(category), [category]);

  /** 批量加载热榜数据 */
  const loadBoards = useCallback(async (platformIds: string[]) => {
    setLoading(true);
    setAllFailed(false);
    try {
      const data = await fetchMultipleBoards(platformIds);
      setBoards((prev) => ({ ...prev, ...data }));
      // 若一个平台都没加载成功，标记为全部失败
      if (Object.keys(data).length === 0 && platformIds.length > 0) {
        setAllFailed(true);
      }
    } catch {
      setAllFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  /** 切换分类时重新加载 */
  useEffect(() => {
    const ids = activePlatforms.map((p) => p.id);
    void loadBoards(ids);
  }, [activePlatforms, loadBoards]);

  /** 刷新单个平台 */
  const handleRefreshBoard = useCallback(async (platformId: string): Promise<boolean> => {
    const data = await forceRefreshBoard(platformId);
    if (data) {
      setBoards((prev) => ({ ...prev, [platformId]: data }));
      return true;
    }
    return false;
  }, []);

  /** 全部刷新 */
  const handleRefreshAll = useCallback(() => {
    const ids = activePlatforms.map((p) => p.id);
    void loadBoards(ids);
  }, [activePlatforms, loadBoards]);

  /** 切换偷摸模式 */
  const toggleStealthMode = useCallback(() => {
    setStealthMode((prev) => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  /** 分类 Segmented options */
  const categoryOptions = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        value: c.value,
        label: (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5 }}>
            {c.icon}
            {t(c.labelKey)}
          </span>
        ),
      })),
    [t],
  );

  /** 布局模式选项 */
  const groupModeOptions = useMemo(
    () => [
      { value: 'default' as TrendingGroupMode, label: t('trending.groupDefault') },
      { value: 'compact' as TrendingGroupMode, label: t('trending.groupCompact') },
    ],
    [t],
  );

  // 偷摸模式 → 渲染伪装页面
  if (stealthMode.enabled) {
    return (
      <section style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '28px 0 0' }}>
        {/* 偷摸模式工具栏（极简，不引人注目） */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, opacity: 0.3 }}>
          <Space size={4}>
            {STEALTH_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                type="text"
                size="small"
                icon={opt.icon}
                onClick={() => setStealthMode((prev) => ({ ...prev, disguise: opt.value }))}
                style={{ padding: '2px 6px' }}
              />
            ))}
            <Button
              type="text"
              size="small"
              icon={<EyeOff size={ICON_SIZE.SMALL} />}
              onClick={toggleStealthMode}
              style={{ padding: '2px 6px' }}
            />
          </Space>
        </div>
        <StealthDisguise disguise={stealthMode.disguise} />
      </section>
    );
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '28px 0 0' }}>
      {/* 页面标题栏：标题 + 分类导航（合并为一行） + 操作按钮 */}
      <Card
        style={{
          borderRadius: 24,
          background: 'var(--canopy-glass-bg)',
          border: '1px solid var(--canopy-hairline)',
          boxShadow: 'var(--canopy-shadow-card)',
        }}
        styles={{ body: { padding: '18px 20px' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 顶行：标题 + 操作按钮 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: token.colorPrimary,
                  background: token.colorPrimaryBg,
                }}
              >
                <Flame size={ICON_SIZE.LARGE} />
              </span>
              <Title level={4} style={{ margin: 0, fontSize: 16 }}>{t('trending.title')}</Title>
            </div>
            <Space size={4}>
              <Tooltip title={t('trending.refreshAll')}>
                <Button
                  type="text"
                  size="small"
                  icon={<RefreshCw size={ICON_SIZE.SMALL} style={{ animation: loading ? 'canopy-spin 1s linear infinite' : 'none' }} />}
                  onClick={handleRefreshAll}
                  loading={loading}
                />
              </Tooltip>
              <Tooltip title={t('trending.stealthMode')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOff size={ICON_SIZE.SMALL} />}
                  onClick={toggleStealthMode}
                />
              </Tooltip>
            </Space>
          </div>

          {/* 分类导航 + 分组模式（同一行内联） */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Segmented<TrendingCategory>
              value={category}
              onChange={setCategory}
              options={categoryOptions}
              size="small"
              style={{ flex: 1 }}
            />
            <Segmented<TrendingGroupMode>
              size="small"
              value={groupMode}
              onChange={setGroupMode}
              options={groupModeOptions}
            />
          </div>
        </div>
      </Card>

      {/* 全局错误提示 */}
      {allFailed && (
        <Alert
          type="warning"
          showIcon
          message={t('trending.allFailed')}
          action={(
            <Button size="small" onClick={handleRefreshAll} loading={loading}>
              {t('trending.refreshAll')}
            </Button>
          )}
          style={{ borderRadius: 12 }}
        />
      )}

      {/* 热榜卡片网格 */}
      {loading && Object.keys(boards).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Spin />
            <Text type="secondary">{t('trending.loading')}</Text>
          </div>
        </div>
      ) : activePlatforms.length === 0 ? (
        <Empty description={t('trending.noPlatforms')} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: groupMode === 'compact'
              ? 'repeat(auto-fill, minmax(280px, 1fr))'
              : 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 14,
          }}
        >
          {activePlatforms.map((platform) => {
            const board = boards[platform.id];
            if (!board) {
              // 数据尚未加载或加载失败，显示占位卡片
              return (
                <HotBoardSkeletonCard
                  key={platform.id}
                  platformId={platform.id}
                  platformName={platform.name}
                  platformSubtitle={platform.subtitle}
                  onRefresh={handleRefreshBoard}
                />
              );
            }
            return (
              <HotBoardCard
                key={platform.id}
                board={board}
                onRefresh={handleRefreshBoard}
              />
            );
          })}
        </div>
      )}

      {/* 加载更多提示 */}
      {loading && Object.keys(boards).length > 0 && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <Spin size="small" />
        </div>
      )}
    </section>
  );
}

export default TrendingPage;
