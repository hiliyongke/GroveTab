/**
 * SearchEngineSelector 组件
 *
 * 搜索引擎选择器，显示为 Popover + 按钮触发
 */

import { useState } from "react";
import { Popover } from "antd";
import { ChevronDown, Check } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import type { SearchEngineId, SearchEngineOption } from "@/shared/config/search-engines";
import { cx, cssVars } from "../utils/searchUtils";
import styles from "../SearchBox.module.less";

interface SearchEngineSelectorProps {
  /** 当前选中的搜索引擎 ID */
  currentEngine: SearchEngineId;
  /** 搜索引擎选项列表 */
  engineOptions: SearchEngineOption[];
  /** 切换搜索引擎回调 */
  onEngineChange: (engineId: SearchEngineId) => void;
  /** 国际化函数 */
  t: (key: string) => string;
}

interface EngineTriggerProps {
  currentEngineOption: SearchEngineOption;
  isOpen: boolean;
  onClick: () => void;
  t: (key: string) => string;
}

/**
 * 搜索引擎触发按钮
 * @param root0
 * @param root0.currentEngineOption
 * @param root0.isOpen
 * @param root0.onClick
 * @param root0.t
 */
function EngineTrigger({ currentEngineOption, isOpen, onClick, t }: EngineTriggerProps) {
  return (
    <button
      type="button"
      className={cx(styles["search-box-engine-trigger"], isOpen && styles["is-open"])}
      style={cssVars({ "--searchbox-engine-color": currentEngineOption.color })}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-label={t("search")}
      title={currentEngineOption.label}
      onClick={onClick}
    >
      <span className={styles["search-box-engine-logo"]} aria-hidden="true">
        {currentEngineOption.iconUrl ? (
          <img src={currentEngineOption.iconUrl} alt="" />
        ) : (
          currentEngineOption.label.slice(0, 1)
        )}
      </span>
      <ChevronDown
        size={ICON_SIZE.TINY}
        className={styles["search-box-engine-trigger-caret"]}
        aria-hidden="true"
      />
    </button>
  );
}

/**
 * 搜索引擎选择器组件
 *
 * @param props - 组件属性
 * @param props.currentEngine
 * @param props.engineOptions
 * @param props.onEngineChange
 * @param props.t
 * @returns JSX 元素
 */
export function SearchEngineSelector({
  currentEngine,
  engineOptions,
  onEngineChange,
  t,
}: SearchEngineSelectorProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const currentEngineOption =
    engineOptions.find((opt) => opt.id === currentEngine) ?? engineOptions[0];

  if (currentEngineOption === undefined) return null;

  const trigger = (
    <EngineTrigger
      currentEngineOption={currentEngineOption}
      isOpen={popoverOpen}
      onClick={() => setPopoverOpen(!popoverOpen)}
      t={t}
    />
  );

  return (
    <Popover
      open={popoverOpen}
      onOpenChange={setPopoverOpen}
      trigger="click"
      placement="bottomLeft"
      arrow={false}
      overlayClassName={styles["search-box-engine-popover"]}
      content={
        <ul className={styles["search-box-engine-menu"]} role="listbox" aria-label={t("search")}>
          {engineOptions.map((option, idx) => {
            const active = option.id === currentEngine;
            const shortcut = idx < 9 ? `\u2318${idx + 1}` : undefined;
            return (
              <li
                key={option.id}
                role="option"
                aria-selected={active}
                className={cx(styles["search-box-engine-menu-item"], active && styles["is-active"])}
                style={cssVars({ "--searchbox-engine-color": option.color })}
                onClick={() => {
                  onEngineChange(option.id as SearchEngineId);
                  setPopoverOpen(false);
                }}
              >
                <span className={styles["search-box-engine-logo"]} aria-hidden="true">
                  {option.iconUrl ? <img src={option.iconUrl} alt="" /> : option.label.slice(0, 1)}
                </span>
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
      }
    >
      {trigger}
    </Popover>
  );
}
