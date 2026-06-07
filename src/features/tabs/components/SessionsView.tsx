import { useState, Suspense, useMemo } from "react";
import { Segmented, Spin, Flex } from "antd";
import { Archive, Trash2 } from "lucide-react";
import { useT } from "@/shared/i18n";
import { getViewComponent } from "@/shared/config/view-registry";

export function SessionsView() {
  const { t } = useT();
  const [tab, setTab] = useState<"archive" | "trash">("archive");

  const ArchiveView = useMemo(() => getViewComponent("archive"), []);
  const TrashView = useMemo(() => getViewComponent("trash"), []);

  const ActiveView = tab === "archive" ? ArchiveView : TrashView;

  return (
    <div>
      <Segmented
        value={tab}
        onChange={(val) => setTab(val as "archive" | "trash")}
        options={[
          { label: t("归档"), value: "archive", icon: <Archive size={14} /> },
          { label: t("回收站"), value: "trash", icon: <Trash2 size={14} /> },
        ]}
      />
      <div style={{ marginTop: "var(--app-space-4)" }}>
        <Suspense fallback={<Flex justify="center" style={{ padding: "var(--app-space-10)" }}><Spin /></Flex>}>
          {ActiveView && <ActiveView />}
        </Suspense>
      </div>
    </div>
  );
}
