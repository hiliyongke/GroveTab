/**
 * BookmarkView — 书签视图
 *
 * 展示 Chrome 书签，支持：
 *   - 按文件夹分组浏览
 *   - 搜索书签
 *   - 从标签页一键收藏
 *   - 点击书签在新标签页打开
 *
 * 设计：
 *   - 使用 antd Tree 组件展示书签文件夹结构
 *   - 搜索走 chrome.bookmarks.search API
 *   - 首次使用需动态申请 bookmarks optional permission
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Tree, Input, Button, Empty, List, Spin } from 'antd';
import {
  BookOpen,
  Search,
  Plus,
  Wrench,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import {
  getBookmarkTree,
  searchBookmarks,
  createBookmark,
  requestBookmarksPermission,
  hasBookmarksPermission,
  flattenBookmarks,
  type BookmarkNode,
} from '@/chrome/bookmarks';
import { createTab } from '@/chrome';
import { useTabsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { feedback } from '@/shared/ui/feedback';
import { translate } from '@/shared/i18n/core';
import { BookmarkToolsModal } from '@/features/bookmarks/BookmarkToolsModal';
import { isSafeExternalUrl } from '@/shared/utils/url-safety';
import './styles/views.css';

/**
 * 将书签树转换为 antd Tree 数据
 */
function toTreeData(nodes: BookmarkNode[]): Array<Record<string, unknown>> {
  return nodes
    .filter((node) => (node.children?.length ?? 0) > 0 || (node.url ?? '') !== '')
    .map((node) => {
      const bookmarkUrl = node.url ?? '';
      const hasBookmarkUrl = bookmarkUrl !== '';
      const fallbackTitle = hasBookmarkUrl
        ? (() => { try { return new URL(bookmarkUrl).hostname; } catch { return bookmarkUrl; } })()
        : '未命名';

      return {
        key: node.id,
        title: (node.title ?? '') !== '' ? node.title : fallbackTitle,
        icon: hasBookmarkUrl ? <BookOpen size={ICON_SIZE.SMALL} /> : undefined,
        children: node.children !== undefined ? toTreeData(node.children) : undefined,
        isLeaf: hasBookmarkUrl,
      };
    });
}

/**
 * 书签视图
 */
export function BookmarkView() {
  const [hasPermission, setHasPermission] = useState(false);
  const [checking, setChecking] = useState(true);
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BookmarkNode[]>([]);
  const [searching, setSearching] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const tabs = useTabsStore((s) => s.tabs);
  const { t } = useT();

  /** 检查权限 */
  useEffect(() => {
    void hasBookmarksPermission().then((has) => {
      setHasPermission(has);
      setChecking(false);
      if (has) {
        void getBookmarkTree().then(setBookmarks);
      }
    });
  }, []);

  /** 请求权限 */
  const handleRequestPermission = useCallback(async () => {
    const granted = await requestBookmarksPermission();
    if (granted) {
      setHasPermission(true);
      const tree = await getBookmarkTree();
      setBookmarks(tree);
    } else {
      feedback.error(translate('bookmark.permissionDenied'));
    }
  }, []);

  /** 搜索书签 */
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const results = await searchBookmarks(query);
    setSearchResults(results);
    setSearching(false);
  }, []);

  /** 打开书签。 */
  const handleOpenBookmark = useCallback(async (url: string) => {
    if (!isSafeExternalUrl(url)) {
      feedback.error(translate('bookmark.openFailed'));
      return;
    }
    try {
      await createTab({ url });
    } catch (err) {
      feedback.error(translate('bookmark.openFailed'), err);
    }
  }, []);

  /** 收藏当前所有标签页 */
  const handleBookmarkAll = useCallback(async () => {
    let count = 0;
    for (const tab of tabs) {
      if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        const result = await createBookmark({ title: tab.title, url: tab.url });
        if (result !== null) count++;
      }
    }
    feedback.success(translate('bookmark.bookmarkedAll', { count }));
    // 刷新书签
    const tree = await getBookmarkTree();
    setBookmarks(tree);
  }, [tabs]);

  /** 扁平化的全部书签（用于搜索展示） */
  const allFlatBookmarks = useMemo(() => flattenBookmarks(bookmarks), [bookmarks]);

  if (checking) {
    return <Spin className="app-bookmark-loading" />;
  }

  if (!hasPermission) {
    return (
      <div className="app-bookmark-empty">
        <BookOpen size={ICON_SIZE.HERO} className="app-bookmark-empty-icon" />
        <div className="app-bookmark-empty-copy">
          {t('bookmark.needPermission')}
        </div>
        <Button type="primary" icon={<BookOpen size={ICON_SIZE.MEDIUM} />} onClick={() => { void handleRequestPermission(); }}>
          {t('bookmark.grantPermission')}
        </Button>
      </div>
    );
  }

  return (
    <div className="app-bookmark-shell">
      {/* 搜索栏 + 操作（固定，不参与滚动） */}
      <div className="app-bookmark-toolbar">
        <Input
          prefix={<Search size={ICON_SIZE.MEDIUM} />}
          placeholder={t('bookmark.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => { void handleSearch(e.target.value); }}
          allowClear
          className="app-bookmark-search"
        />
        <Button icon={<Plus size={ICON_SIZE.MEDIUM} />} onClick={() => { void handleBookmarkAll(); }}>
          {t('bookmark.bookmarkAll')}
        </Button>
        {/* 工具箱入口：打开 Modal 进行去重 / 失效检测 / 智能整理 */}
        <Button icon={<Wrench size={ICON_SIZE.MEDIUM} />} onClick={() => setToolsOpen(true)}>
          {t('bookmark.tools.entry')}
        </Button>
      </div>

      {/* 结果区：独立滚动容器 */}
      <div className="app-bookmark-result">
        {searchQuery ? (
          searching ? (
            <Spin className="app-bookmark-result-loading" />
          ) : searchResults.length === 0 ? (
            <Empty description={t('bookmark.noResults')} />
          ) : (
            <List
              size="small"
              dataSource={searchResults}
              renderItem={(item) => (
                <List.Item
                  key={item.id}
                  className="app-bookmark-list-item"
                  onClick={() => {
                    if (item.url) {
                      void handleOpenBookmark(item.url);
                    }
                  }}
                >
                  <List.Item.Meta
                    title={
                      <span className="app-bookmark-list-title">
                        {item.title}
                      </span>
                    }
                    description={
                      <span className="app-bookmark-list-url">
                        {item.url}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          )
        ) : (
          /* 书签树 */
          <Tree
            showIcon
            defaultExpandAll={false}
            treeData={toTreeData(bookmarks)}
            onSelect={(keys, info) => {
              // 如果选中的是叶子节点（书签），打开 URL
              const node = info.node as unknown as { isLeaf?: boolean };
              if (node?.isLeaf) {
                // 通过 key 找到书签 URL
                const flat = allFlatBookmarks.find((b) => b.id === keys[0]);
                if (flat?.url) {
                  void handleOpenBookmark(flat.url);
                }
              }
            }}
          />
        )}
      </div>

      {/*
        书签工具箱 Modal —— 去重 / 失效检测 / 智能整理
        mutation 完成后重新拉取书签树，避免 UI 与实际数据不一致
      */}
      <BookmarkToolsModal
        open={toolsOpen}
        onClose={() => setToolsOpen(false)}
        onMutated={() => {
          void getBookmarkTree().then(setBookmarks);
        }}
      />
    </div>
  );
}
