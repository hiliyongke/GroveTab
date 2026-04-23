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
import { Tree, Input, Button, Empty, List, Spin, theme } from 'antd';
import {
  BookOpen,
  Search,
  Plus,
} from 'lucide-react';
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
        icon: hasBookmarkUrl ? <BookOpen size={12} /> : undefined,
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
  const tabs = useTabsStore((s) => s.tabs);
  const { t } = useT();
  const { token } = theme.useToken();

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
    return <Spin style={{ display: 'block', margin: '80px auto' }} />;
  }

  if (!hasPermission) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <BookOpen size={48} style={{ color: token.colorTextTertiary, marginBottom: 16 }} />
        <div style={{ fontSize: 14, color: token.colorTextSecondary, marginBottom: 16 }}>
          {t('bookmark.needPermission')}
        </div>
        <Button type="primary" icon={<BookOpen size={14} />} onClick={() => { void handleRequestPermission(); }}>
          {t('bookmark.grantPermission')}
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* 搜索栏 + 操作 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Input
          prefix={<Search size={14} />}
          placeholder={t('bookmark.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => { void handleSearch(e.target.value); }}
          allowClear
          style={{ flex: 1 }}
        />
        <Button icon={<Plus size={14} />} onClick={() => { void handleBookmarkAll(); }}>
          {t('bookmark.bookmarkAll')}
        </Button>
      </div>

      {/* 搜索结果 */}
      {searchQuery ? (
        searching ? (
          <Spin style={{ display: 'block', margin: '40px auto' }} />
        ) : searchResults.length === 0 ? (
          <Empty description={t('bookmark.noResults')} />
        ) : (
          <List
            size="small"
            dataSource={searchResults}
            renderItem={(item) => (
              <List.Item
                key={item.id}
                style={{ cursor: 'pointer', padding: '6px 8px' }}
                onClick={() => {
                  if (item.url) {
                    void handleOpenBookmark(item.url);
                  }
                }}
              >
                <List.Item.Meta
                  title={
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: token.colorText }}>
                      {item.title}
                    </span>
                  }
                  description={
                    <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
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
  );
}
