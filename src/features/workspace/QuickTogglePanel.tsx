/**
 * QuickTogglePanel —— 主页快捷开关面板
 *
 * 将设置面板中高频切换的开关"浮"到主页面，用户无需打开设置抽屉即可快速操作。
 * 通过 AppHeader 右侧的 SlidersHorizontal 按钮（Modal 触发器）展开。
 *
 * 入选开关（8 项，按切换频率 × 即时可见效果筛选）：
 *   视图：布局密度、减弱动效、域名图标
 *   行为：使用时长、内存治理
 *   隐私：历史记录
 *   显隐：整理建议、常用站点
 *
 * 布局组件复用：
 *   - SwitchRow / SegmentedRow / GroupTitle 来自 @/shared/ui/SettingsRows
 */

import { useCallback } from "react";
import { Flex, Divider, Button } from "antd";
import { Settings, Eye, Zap, Shield, SlidersHorizontal } from "lucide-react";
import { useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { SwitchRow, SegmentedRow, GroupTitle } from "@/shared/ui/SettingsRows";
import styles from "./quick-toggle-panel.module.less";

interface QuickTogglePanelProps {
  /** 点击"完整设置"时回调，用于打开 SettingsPanel */
  onOpenSettings?: () => void;
  /** 面板关闭回调 */
  onClose?: () => void;
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
      <Flex align="center" gap="small" className={styles.header}>
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
        className={styles.toggleRow}
        labelClassName={styles.toggleLabel}
        segmentedClassName={styles.segmented}
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
        className={styles.toggleRow}
        labelClassName={styles.toggleLabel}
        segmentedClassName={styles.segmented}
      />
      <SwitchRow
        label={t("quickToggle.showItemFavicon")}
        checked={showItemFavicon}
        onChange={(v) => handle({ domainGroupShowItemFavicon: v })}
        className={styles.toggleRow}
        labelClassName={styles.toggleLabel}
      />

      <Divider className={styles.divider} />

      {/* ── 行为 ── */}
      <GroupTitle
        icon={<Zap size={ICON_SIZE.SMALL} />}
        label={t("quickToggle.group.behavior")}
      />
      <SwitchRow
        label={t("quickToggle.trackTabFocusTime")}
        checked={trackTabFocusTime}
        onChange={(v) => handle({ trackTabFocusTime: v })}
        className={styles.toggleRow}
        labelClassName={styles.toggleLabel}
      />
      <SwitchRow
        label={t("quickToggle.memoryGovernance")}
        checked={memoryGovernanceEnabled}
        onChange={(v) => handle({ memoryGovernanceEnabled: v })}
        className={styles.toggleRow}
        labelClassName={styles.toggleLabel}
      />

      <Divider className={styles.divider} />

      {/* ── 隐私 ── */}
      <GroupTitle
        icon={<Shield size={ICON_SIZE.SMALL} />}
        label={t("quickToggle.group.privacy")}
      />
      <SwitchRow
        label={t("quickToggle.historyEnabled")}
        checked={historyEnabled}
        onChange={(v) => handle({ historyEnabled: v })}
        className={styles.toggleRow}
        labelClassName={styles.toggleLabel}
      />

      <Divider className={styles.divider} />

      {/* ── 显隐 ── */}
      <GroupTitle
        icon={<Eye size={ICON_SIZE.SMALL} />}
        label={t("uiVisibility.sectionTitle")}
      />
      <SwitchRow
        label={t("uiVisibility.tidySuggestion")}
        checked={tidySuggestion}
        onChange={(v) => handle({ uiVisibility: { tidySuggestion: v } })}
        className={styles.toggleRow}
        labelClassName={styles.toggleLabel}
      />
      <SwitchRow
        label={t("uiVisibility.quickStart")}
        checked={quickStart}
        onChange={(v) => handle({ uiVisibility: { quickStart: v } })}
        className={styles.toggleRow}
        labelClassName={styles.toggleLabel}
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
