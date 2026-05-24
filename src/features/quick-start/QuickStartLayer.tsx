/**
 * QuickStartLayer — 首页轻启动层
 *
 * 常用站点快捷入口，位于 Hero 搜索框下方。
 * 参考 Chrome 新标签页设计：大图标 + 标题，居中排列。
 */

import { useEffect, useMemo, useState } from "react";
import { Button, Tooltip } from "antd";
import { Plus, Settings2 } from "lucide-react";
import { useSpeedDialStore, useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { SpeedDialGrid } from "./SpeedDialGrid";
import { SpeedDialAddModal } from "./SpeedDialAddModal";
import styles from "./QuickStartLayer.module.less";

interface QuickStartLayerProps {
  onOpenSettings?: () => void;
}

export function QuickStartLayer({ onOpenSettings }: QuickStartLayerProps) {
  const { t } = useT();
  const sites = useSpeedDialStore((s) => s.sites);
  const loaded = useSpeedDialStore((s) => s.loaded);
  const loadSites = useSpeedDialStore((s) => s.loadSites);
  const quickStartVisible = useSettingsStore((s) => s.settings.uiVisibility?.quickStart !== false);

  const [addModalOpen, setAddModalOpen] = useState(false);

  useEffect(() => {
    if (!loaded) {
      void loadSites();
    }
  }, [loaded, loadSites]);

  const existingGroups = useMemo(() => {
    const set = new Set<string>();
    for (const s of sites) {
      if (s.group) set.add(s.group);
    }
    return [...set].sort();
  }, [sites]);

  if (!quickStartVisible) return null;

  return (
    <section className={styles["app-quick-start"]}>
      <div className={styles["quick-start-header"]}>
        <span className={styles["quick-start-title"]}>{t("quickStart.title")}</span>
        <div className={styles["quick-start-actions"]}>
          <Tooltip title={t("quickStart.addSite")} placement="top">
            <Button
              type="text"
              size="small"
              icon={<Plus size={ICON_SIZE.SMALL} />}
              onClick={() => setAddModalOpen(true)}
              className={styles["quick-start-action-btn"]}
            />
          </Tooltip>
          {onOpenSettings && (
            <Tooltip title={t("settings.title")} placement="top">
              <Button
                type="text"
                size="small"
                icon={<Settings2 size={ICON_SIZE.SMALL} />}
                onClick={onOpenSettings}
                className={styles["quick-start-action-btn"]}
              />
            </Tooltip>
          )}
        </div>
      </div>
      <SpeedDialGrid sites={sites} onAdd={() => setAddModalOpen(true)} />
      <SpeedDialAddModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        editingSite={null}
        existingGroups={existingGroups}
      />
    </section>
  );
}
