/**
 * ClipboardImport — 从剪贴板批量导入 URL
 *
 * 自动解析剪贴板中的多行 URL，选择目标窗口后批量创建标签。
 * 非法 URL 跳过并提示。
 */

import { useState, useCallback, memo } from "react";
import { Button, Flex, Input, Modal, Typography } from "antd";
import { ClipboardPaste, ExternalLink } from "lucide-react";

import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { useTabsStore } from "@/store";
import { createTab } from "@/chrome";
import { feedback } from "@/shared/ui/feedback";

interface ClipboardImportProps {
  onRefresh: () => void;
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseUrls(text: string): { valid: string[]; invalid: string[] } {
  const lines = text
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const line of lines) {
    // 支持带空格前缀的 URL
    const url = line.startsWith("http") ? line : `https://${line}`;
    if (isValidUrl(url)) {
      valid.push(url);
    } else if (isValidUrl(line)) {
      valid.push(line);
    } else {
      invalid.push(line);
    }
  }
  return { valid, invalid };
}

export const ClipboardImport = memo(function ClipboardImport({ onRefresh }: ClipboardImportProps) {
  const { t } = useT();
  const windows = useTabsStore((s) => s.windows);
  const currentWindowId = useTabsStore((s) => s.currentWindowId);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);

  const { valid, invalid } = parseUrls(text);

  const handleImport = useCallback(
    async (windowId: number) => {
      if (valid.length === 0 || importing) return;
      setImporting(true);
      let created = 0;
      for (const url of valid) {
        try {
          await createTab({ url, windowId, active: false });
          created += 1;
        } catch {
          // 跳过失败的 URL
        }
      }
      setImporting(false);
      setOpen(false);
      setText("");
      onRefresh();
      feedback.success(t("已导入 {count} 个标签", { count: created }));
      if (invalid.length > 0) {
        feedback.warning(t("跳过 {count} 个非法 URL", { count: invalid.length }));
      }
    },
    [valid, invalid, importing, onRefresh, t],
  );

  const handlePaste = useCallback(async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      setText(clipboardText);
    } catch {
      feedback.warning(t("无法读取剪贴板，请手动粘贴"));
    }
  }, [t]);

  return (
    <>
      <Button
        type="text"
        size="small"
        icon={<ClipboardPaste size={ICON_SIZE.SMALL} />}
        onClick={() => setOpen(true)}
      />
      <Modal
        title={t("从剪贴板导入 URL")}
        open={open}
        onCancel={() => {
          setOpen(false);
          setText("");
        }}
        footer={null}
        width={440}
      >
        <Flex vertical gap={12}>
          <Input.TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("粘贴 URL 列表，每行一个...")}
            rows={6}
          />
          <Flex gap={8}>
            <Button size="small" onClick={() => void handlePaste()}>
              {t("粘贴剪贴板")}
            </Button>
            {valid.length > 0 && (
              <Typography.Text style={{ fontSize: 12, color: "var(--ant-color-text-secondary)" }}>
                {t("识别到 {count} 个有效 URL", { count: valid.length })}
              </Typography.Text>
            )}
            {invalid.length > 0 && (
              <Typography.Text style={{ fontSize: 12, color: "var(--ant-color-text-tertiary)" }}>
                {t("跳过 {count} 个非法 URL", { count: invalid.length })}
              </Typography.Text>
            )}
          </Flex>
          {valid.length > 0 && (
            <Flex vertical gap={4}>
              <Typography.Text style={{ fontSize: 12, fontWeight: 500 }}>
                {t("选择目标窗口")}
              </Typography.Text>
              {[...windows.values()]
                .filter((w) => w.type === "normal")
                .map((w) => (
                  <Button
                    key={w.id}
                    block
                    size="small"
                    type={w.id === currentWindowId ? "primary" : "default"}
                    icon={<ExternalLink size={ICON_SIZE.SMALL} />}
                    loading={importing}
                    onClick={() => void handleImport(w.id)}
                    style={{ textAlign: "left" }}
                  >
                    {w.id === currentWindowId
                      ? t("window.current")
                      : `${t("window.otherWithId", { id: w.id })} (${w.tabsCount})`}
                  </Button>
                ))}
            </Flex>
          )}
        </Flex>
      </Modal>
    </>
  );
});
