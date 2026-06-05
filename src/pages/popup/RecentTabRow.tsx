/**
 * Popup 标签页行组件。
 */

import { memo } from "react";
import { X } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import type { RecentTab } from "./sort-utils";

interface RecentTabRowProps {
  tab: RecentTab;
  onClick: () => void;
  onClose: () => void;
  showFavicon?: boolean;
  focused?: boolean;
}

export const RecentTabRow = memo(function RecentTabRow({
  tab,
  onClick,
  onClose,
  showFavicon = true,
  focused = false,
}: RecentTabRowProps) {
  const { t } = useT();
  return (
    <div
      className={`popup-row${focused ? " popup-row--focused" : ""}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      role="button"
    >
      {showFavicon && (
        <img
          src={tab.favIconUrl}
          alt=""
          width={17}
          height={17}
          referrerPolicy="no-referrer"
          className="popup-row-favicon"
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
      )}
      <div
        className="popup-row-content"
        style={showFavicon ? undefined : { paddingLeft: 0 }}
      >
        <span className="popup-row-title">{tab.title}</span>
        {showFavicon && <span className="popup-row-host">{tab.hostname}</span>}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={t("关闭标签页 {title}", { title: tab.title })}
        className="popup-row-close"
      >
        <X size={ICON_SIZE.SMALL} />
      </button>
    </div>
  );
});
