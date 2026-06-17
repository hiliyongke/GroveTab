import { Suspense } from "react";
import { Segmented, Spin, Flex } from "antd";
import { Archive, History, Trash2 } from "lucide-react";
import { useT } from "@/shared/i18n";
import { getViewComponent } from "@/shared/config/view-registry";
import { useSettingsStore } from "@/store";
import type { SessionsSubView } from "@/shared/config/views";

const SESSION_VIEW_COMPONENTS = {
  archive: getViewComponent("archive"),
  trash: getViewComponent("trash"),
  history: getViewComponent("history"),
};

export function SessionsView() {
  const { t } = useT();
  const tab = useSettingsStore((s) => s.settings.sessionsSubView ?? "archive");
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const ActiveView = SESSION_VIEW_COMPONENTS[tab];

  return (
    <div>
      <Segmented
        value={tab}
        onChange={(val) => {
          void updateSettings({ sessionsSubView: val as SessionsSubView });
        }}
        options={[
          { label: t("归档"), value: "archive", icon: <Archive size={14} /> },
          { label: t("回收站"), value: "trash", icon: <Trash2 size={14} /> },
          { label: t("历史"), value: "history", icon: <History size={14} /> },
        ]}
      />
      <div style={{ marginTop: "var(--app-space-4)" }}>
        <Suspense
          fallback={
            <Flex justify="center" style={{ padding: "var(--app-space-10)" }}>
              <Spin />
            </Flex>
          }
        >
          {ActiveView && <ActiveView />}
        </Suspense>
      </div>
    </div>
  );
}
