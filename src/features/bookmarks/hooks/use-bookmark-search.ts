/**
 * useBookmarkSearch — 书签搜索 Hook
 *
 * 管理搜索状态、执行搜索
 */

import { useState, useCallback } from "react";
import { searchBookmarks, type BookmarkNode } from "@/chrome/bookmarks";

interface UseBookmarkSearchReturn {
  searchQuery: string;
  searchResults: BookmarkNode[];
  searching: boolean;
  handleSearch: (query: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
}

export function useBookmarkSearch(): UseBookmarkSearchReturn {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BookmarkNode[]>([]);
  const [searching, setSearching] = useState(false);

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

  return {
    searchQuery,
    searchResults,
    searching,
    handleSearch,
    setSearchQuery,
  };
}
