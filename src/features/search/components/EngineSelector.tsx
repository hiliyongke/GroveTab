/**
 * EngineSelector —— 搜索引擎选择器 Popover
 *
 * 提取自 SearchBox，职责单一：
 *   - 渲染引擎列表
 *   - 处理引擎切换
 *   - 键盘快捷键（⌘1-9）
 */

import { memo, useCallback, useState } from "react";
import { Popover, Button, Image } from "antd";
import { Check, ChevronDown } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { setLastSearchEngine } from "@/repositories";
import type { SearchEngineOption } from "@/shared/config/search-engines";
import styles from "../SearchBox.module.less";

interface EngineSelectorProps {
  currentEngine: string;
  engineOptions: SearchEngineOption[];
  currentEngineOption: SearchEngineOption;
  onChange: (engineId: string) => void;
}

function EngineSelectorBase({
  currentEngine,
  engineOptions,
  currentEngineOption,
  onChange,
}: EngineSelectorProps) {
  const { t } = useT();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleSelect = useCallback(
    (engineId: string) => {
      onChange(engineId);
      setLastSearchEngine(engineId);
      setPopoverOpen(false);
    },
    [onChange],
  );

  const menuContent = (
    <ul
      className={styles["search-box-engine-menu"]}
      role="listbox"
      aria-label={t("搜索引擎切换")}
    >
      {engineOptions.map((option, idx) => {
        const active = option.id === currentEngine;
        const shortcut = idx < 9 ? `⌘${idx + 1}` : undefined;
        return (
          <li
            key={option.id}
            role="option"
            aria-selected={active}
            className={`${styles["search-box-engine-menu-item"]} ${active ? styles["is-active"] : ""}`}
            onClick={() => handleSelect(option.id)}
          >
            <EngineLogo option={option} />
            <span className={styles["search-box-engine-menu-label"]}>{option.label}</span>
            {shortcut !== undefined && (
              <span className={styles["search-box-engine-menu-shortcut"]} aria-hidden="true">
                {shortcut}
              </span>
            )}
            {active && (
              <Check
                size={ICON_SIZE.TINY}
                className={styles["search-box-engine-menu-check"]}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <Popover
      open={popoverOpen}
      onOpenChange={setPopoverOpen}
      trigger="click"
      placement="bottomLeft"
      arrow={false}
      classNames={{ root: styles["search-box-engine-popover"] }}
      content={menuContent}
    >
      <Button
        type="text"
        className={`${styles["search-box-engine-trigger"]} ${popoverOpen ? styles["is-open"] : ""}`}
        aria-haspopup="listbox"
        aria-expanded={popoverOpen}
        aria-label={t("搜索引擎切换")}
        title={currentEngineOption.label}
      >
        <EngineLogo option={currentEngineOption} />
        <ChevronDown
          size={ICON_SIZE.TINY}
          className={styles["search-box-engine-trigger-caret"]}
          aria-hidden="true"
        />
      </Button>
    </Popover>
  );
}

/** 引擎 Logo（memo 化避免重复创建 Image 组件） */
const EngineLogo = memo(function EngineLogo({
  option,
}: {
  option: SearchEngineOption;
}) {
  return (
    <span className={styles["search-box-engine-logo"]} aria-hidden="true">
      {option.iconUrl ? (
        <Image
          src={option.iconUrl}
          alt=""
          preview={false}
          fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        />
      ) : (
        option.label.slice(0, 1).toUpperCase()
      )}
    </span>
  );
});

export const EngineSelector = memo(EngineSelectorBase);
