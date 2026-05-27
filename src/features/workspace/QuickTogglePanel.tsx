/**
 * QuickTogglePanel —— 主页快捷开关面板
 *
 * 将设置面板中高频切换的开关"浮"到主页面，用户无需打开设置抽屉即可快速操作。
 * 通过 AppHeader 右侧的 SlidersHorizontal 按钮（Popover 触发器）展开。
 *
 * 入选开关（8 项，按切换频率 × 即时可见效果筛选）：
 *   视图：布局密度、减弱动效、域名图标
 *   行为：使用时长、内存治理
 *   隐私：历史记录
 *   显隐：整理建议、常用站点
 */

import { useCallback } from "react";
import { Flex, Switch, Segmented, Divider, Button } from "antd";
import { Settings, Eye, Zap, Shield, SlidersHorizontal } from "lucide-react";
import { useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import styles from "./quick-toggle-panel.module.less";

interface QuickTogglePanelProps {
  /** 点击"完整设置"时回调，用于打开 SettingsPanel */
  onOpenSettings?: () => void;
  /** Popover 关闭回调 */
  onClose?: () => void;
}

/** 分组标题 */
function GroupTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Flex align="center" gap={6} className={styles.groupTitle}>
      {icon}
      <span>{label}</span>
    </Flex>
  );
}

/** Switch 行：左侧 label，右侧 Switch */
function ToggleRow({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Flex align="center" justify="space-between" className={styles.toggleRow}>
      <span className={styles.toggleLabel}>{label}</span>
      <Switch size="small" checked={checked} onChange={onChange} />
    </Flex>
  );
}

/** Segmented 行：左侧 label，右侧 Segmented */
function SegmentedRow<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <Flex align="center" justify="space-between" className={styles.toggleRow}>
      <span className={styles.toggleLabel}>{label}</span>
      <Segmented
        size="small"
        value={value}
        options={options}
        onChange={(v) => onChange(v as T)}
        className={styles.segmented}
      />
    </Flex>
  );
}

export function QuickTogglePanel({ onOpenSettings, onClose }: QuickTogglePanelProps) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const { t } = useT();

  const handle = useCallback(
    (patch: Record<string, unknown>) => void updateSettings(patch),
    [updateSettings],
  );

  const handleOpenSettings = useCallback(() => {
    onClose?.();
    onOpenSettings?.();
  }, [onClose, onOpenSettings]);

  // ── 读取当前值 ──
  const layoutDensity = settings.layoutDensity ?? "default";
  const reducedMotion = settings.reducedMotion ?? "auto";
  const showItemFavicon = settings.domainGroupShowItemFavicon ?? true;
  const trackTabFocusTime = settings.trackTabFocusTime ?? true;
  const memoryGovernanceEnabled = settings.memoryGovernanceEnabled ?? false;
  const historyEnabled = settings.historyEnabled ?? true;
  const tidySuggestion = settings.uiVisibility?.tidySuggestion ?? true;
  const quickStart = settings.uiVisibility?.quickStart ?? true;

  return (
    <div className={styles.root}>
      {/* ── 标题 ── */}
      <Flex align="center" gap={6} className={styles.header}>
        <SlidersHorizontal size={ICON_SIZE.DEFAULT} />
        <span className={styles.headerTitle}>{t("quickToggle.title")}</span>
      </Flex>

      {/* ── 视图 ── */}
      <GroupTitle
        icon={<Eye size={ICON_SIZE.SMALL} />}
        label={t("quickToggle.group.view")}
      />
      <SegmentedRow
        label={t("layout.density")}
        value={layoutDensity}
        options={[
          { value: "compact", label: t("density.compact") },
          { value: "default", label: t("density.default") },
          { value: "comfortable", label: t("density.comfortable") },
        ]}
        onChange={(v) => handle({ layoutDensity: v })}
      />
      <SegmentedRow
        label={t("a11y.reducedMotion")}
        value={reducedMotion}
        options={[
          { value: "auto", label: t("motion.auto") },
          { value: "on", label: t("motion.on") },
          { value: "off", label: t("motion.off") },
        ]}
        onChange={(v) => handle({ reducedMotion: v })}
      />
      <ToggleRow
        label={t("quickToggle.showItemFavicon")}
        checked={showItemFavicon}
        onChange={(v) => handle({ domainGroupShowItemFavicon: v })}
      />

      <Divider className={styles.divider} />

      {/* ── 行为 ── */}
      <GroupTitle
        icon={<Zap size={ICON_SIZE.SMALL} />}
        label={t("quickToggle.group.behavior")}
      />
      <ToggleRow
        label={t("quickToggle.trackTabFocusTime")}
        checked={trackTabFocusTime}
        onChange={(v) => handle({ trackTabFocusTime: v })}
      />
      <ToggleRow
        label={t("quickToggle.memoryGovernance")}
        checked={memoryGovernanceEnabled}
        onChange={(v) => handle({ memoryGovernanceEnabled: v })}
      />

      <Divider className={styles.divider} />

      {/* ── 隐私 ── */}
      <GroupTitle
        icon={<Shield size={ICON_SIZE.SMALL} />}
        label={t("quickToggle.group.privacy")}
      />
      <ToggleRow
        label={t("quickToggle.historyEnabled")}
        checked={historyEnabled}
        onChange={(v) => handle({ historyEnabled: v })}
      />

      <Divider className={styles.divider} />

      {/* ── 显隐 ── */}
      <GroupTitle
        icon={<Eye size={ICON_SIZE.SMALL} />}
        label={t("uiVisibility.sectionTitle")}
      />
      <ToggleRow
        label={t("uiVisibility.tidySuggestion")}
        checked={tidySuggestion}
        onChange={(v) => handle({ uiVisibility: { tidySuggestion: v } })}
      />
      <ToggleRow
        label={t("uiVisibility.quickStart")}
        checked={quickStart}
        onChange={(v) => handle({ uiVisibility: { quickStart: v } })}
      />

      <Divider className={styles.divider} />

      {/* ── 底部：完整设置入口 ── */}
      <Button
        type="text"
        size="small"
        block
        icon={<Settings size={ICON_SIZE.SMALL} />}
        className={styles.fullSettingsBtn}
        onClick={handleOpenSettings}
      >
        {t("quickToggle.fullSettings")}
      </Button>
    </div>
  );
}
