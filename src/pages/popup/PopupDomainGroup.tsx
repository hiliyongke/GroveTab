/**
 * Popup 域名分组组件：分组标题（色条+favicon+域名+计数）+ 子项列表。
 */

import { memo } from "react";
import { useAccent } from "@/shared/hooks/use-accent";
import { RecentTabRow } from "./RecentTabRow";
import type { RecentTab } from "./sort-utils";

interface PopupDomainGroupProps {
  hostname: string;
  tabs: RecentTab[];
  baseIndex?: number;
  focusIndex?: number;
  onFocusTab: (tab: RecentTab) => void;
  onCloseTab: (tab: RecentTab) => void;
}

export const PopupDomainGroup = memo(function PopupDomainGroup({
  hostname,
  tabs,
  baseIndex = 0,
  focusIndex = -1,
  onFocusTab,
  onCloseTab,
}: PopupDomainGroupProps) {
  const groupFavicon = tabs[0]?.favIconUrl ?? "";
  const accent = useAccent(groupFavicon, hostname);
  return (
    <div className="popup-domain-group">
      <div className="popup-domain-group-header">
        <span
          className="popup-domain-group-bar"
          style={{ background: accent.barLight }}
        />
        {groupFavicon && (
          <img
            src={groupFavicon}
            alt=""
            width={14}
            height={14}
            referrerPolicy="no-referrer"
            className="popup-domain-group-favicon"
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
          />
        )}
        <span className="popup-domain-group-name">{hostname}</span>
        <span className="popup-domain-group-count">{tabs.length}</span>
      </div>
      {tabs.map((tab, i) => (
        <RecentTabRow
          key={tab.id}
          tab={tab}
          showFavicon={false}
          focused={baseIndex + i === focusIndex}
          onClick={() => onFocusTab(tab)}
          onClose={() => onCloseTab(tab)}
        />
      ))}
    </div>
  );
});
