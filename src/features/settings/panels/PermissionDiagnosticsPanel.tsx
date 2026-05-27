/**
 * PermissionDiagnosticsPanel — 权限状态诊断区（任务8）
 *
 * 展示各 Chrome 权限的：
 *   - 当前授权状态（已授权 / 未授权 / 不支持）
 *   - 依赖该权限的功能列表
 *   - 失效时的影响说明
 */

import { useEffect, useState } from "react";
import { Badge, Button, Flex, Space, Tag, Tooltip, Typography } from "antd";
import { CheckCircle, XCircle, AlertCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { useT } from "@/shared/i18n";
import { ICON_SIZE } from "@/shared/utils/icon-size";

interface PermissionEntry {
  /** Chrome 权限名称 */
  permission: string;
  /** 显示名称 */
  label: string;
  /** 依赖此权限的功能 */
  features: string[];
  /** 失效影响说明 */
  impact: string;
  /** 当前状态 */
  status: "granted" | "denied" | "unsupported" | "checking";
}

const PERMISSION_DEFS: Array<Omit<PermissionEntry, "status">> = [
  {
    permission: "tabs",
    label: "tabs",
    features: ["标签工作台", "统一搜索", "内存治理"],
    impact: "核心功能不可用，标签列表无法加载",
  },
  {
    permission: "history",
    label: "history",
    features: ["历史分析", "多维视图", "统一搜索（历史）"],
    impact: "历史记录功能完全失效，无法读取浏览历史",
  },
  {
    permission: "bookmarks",
    label: "bookmarks",
    features: ["书签中心", "书签实时同步", "自动分类规则"],
    impact: "书签功能不可用，无法读取或监听书签变更",
  },
  {
    permission: "sessions",
    label: "sessions",
    features: ["最近关闭标签", "历史对账"],
    impact: "最近关闭标签列表为空，历史对账失效",
  },
  {
    permission: "tabGroups",
    label: "tabGroups",
    features: ["高保真归档", "TabGroup 恢复"],
    impact: "归档时无法记录 Tab Group 信息，恢复时无法重建分组结构",
  },
  {
    permission: "system.memory",
    label: "system.memory",
    features: ["内存压力感知", "智能标签治理"],
    impact: "无法获取内存使用率，内存治理功能失效",
  },
  {
    permission: "system.display",
    label: "system.display",
    // eslint-disable-next-line i18n-zh/no-bare-zh-in-js
    features: ["多显示器识别", "窗口贴边", "分屏布局"],
    // eslint-disable-next-line i18n-zh/no-bare-zh-in-js
    impact: "无法读取显示器工作区，窗口布局将回退到浏览器窗口尺寸",
  },
];

/** 可以通过 chrome.permissions.request 申请的可选权限列表 */
const REQUESTABLE_PERMISSIONS = new Set([
  "history",
  "bookmarks",
  "system.memory",
  "system.display",
]);

async function checkPermission(permission: string): Promise<"granted" | "denied" | "unsupported"> {
  try {
    if (typeof chrome === "undefined" || !chrome.permissions) return "unsupported";
    const result = await chrome.permissions.contains({
      permissions: [permission as chrome.runtime.ManifestPermissions],
    });
    return result ? "granted" : "denied";
  } catch {
    return "unsupported";
  }
}

export function PermissionDiagnosticsPanel() {
  const { t } = useT();
  const [entries, setEntries] = useState<PermissionEntry[]>(
    PERMISSION_DEFS.map((d) => ({ ...d, status: "checking" as const })),
  );
  const [checking, setChecking] = useState(false);
  const [requesting, setRequesting] = useState<string | null>(null);

  const runCheck = async () => {
    setChecking(true);
    const results = await Promise.all(
      PERMISSION_DEFS.map(async (def) => ({
        ...def,
        status: await checkPermission(def.permission),
      })),
    );
    setEntries(results);
    setChecking(false);
  };

  const handleRequest = async (permission: string) => {
    if (requesting) return;
    setRequesting(permission);
    try {
      const granted = await chrome.permissions.request({
        permissions: [permission as chrome.runtime.ManifestPermissions],
      });
      if (granted) {
        setEntries((prev) =>
          prev.map((e) => (e.permission === permission ? { ...e, status: "granted" } : e)),
        );
      }
    } catch {
      // 用户拒绝或不支持，静默处理
    } finally {
      setRequesting(null);
    }
  };

  useEffect(() => {
    void runCheck();
  }, []);

  const grantedCount = entries.filter((e) => e.status === "granted").length;
  const deniedCount = entries.filter((e) => e.status === "denied").length;

  return (
    <Flex vertical gap={12}>
      <Flex align="center" justify="space-between">
        <Space size={8}>
          <Typography.Text strong>{t("权限诊断")}</Typography.Text>
          <Tag color={deniedCount > 0 ? "warning" : "success"}>
            {grantedCount}/{entries.length} {t("已授权")}
          </Tag>
        </Space>
        <Button
          size="small"
          icon={<RefreshCw size={ICON_SIZE.SMALL} />}
          loading={checking}
          onClick={() => {
            void runCheck();
          }}
        >
          {t("重新检测")}
        </Button>
      </Flex>

      <Flex vertical gap={6}>
        {entries.map((entry) => (
          <Flex
            key={entry.permission}
            align="flex-start"
            gap={10}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              background: "var(--color-fill-quaternary, rgba(0,0,0,0.04))",
            }}
          >
            {/* 状态图标 */}
            <div style={{ paddingTop: 2, flexShrink: 0 }}>
              {entry.status === "checking" && <Badge status="processing" />}
              {entry.status === "granted" && (
                <CheckCircle size={ICON_SIZE.MEDIUM} color="var(--color-success, #52c41a)" />
              )}
              {entry.status === "denied" && (
                <Tooltip title={entry.impact}>
                  <XCircle size={ICON_SIZE.MEDIUM} color="var(--color-error, #ff4d4f)" />
                </Tooltip>
              )}
              {entry.status === "unsupported" && (
                <AlertCircle size={ICON_SIZE.MEDIUM} color="var(--color-warning, #faad14)" />
              )}
            </div>

            {/* 权限信息 */}
            <Flex vertical gap={2} style={{ flex: 1, minWidth: 0 }}>
              <Flex align="center" gap={6} wrap="wrap">
                <Typography.Text code style={{ fontSize: 12 }}>
                  {entry.permission}
                </Typography.Text>
                {entry.status === "denied" && (
                  <Tag color="error" style={{ fontSize: 11 }}>
                    {t("未授权")}
                  </Tag>
                )}
                {entry.status === "unsupported" && (
                  <Tag color="warning" style={{ fontSize: 11 }}>
                    {t("不支持")}
                  </Tag>
                )}
              </Flex>
              <Flex gap={4} wrap="wrap">
                {entry.features.map((f) => (
                  <Tag key={f} style={{ fontSize: 11, margin: 0 }}>
                    {f}
                  </Tag>
                ))}
              </Flex>
              {entry.status === "denied" && (
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {entry.impact}
                </Typography.Text>
              )}
            </Flex>

            {/* 授权按钮（仅可选权限且未授权时显示） */}
            {entry.status === "denied" && REQUESTABLE_PERMISSIONS.has(entry.permission) && (
              <Button
                size="small"
                type="primary"
                icon={<ShieldCheck size={ICON_SIZE.SMALL} />}
                loading={requesting === entry.permission}
                onClick={() => {
                  void handleRequest(entry.permission);
                }}
                style={{ flexShrink: 0, alignSelf: "center" }}
              >
                {t("授权")}
              </Button>
            )}
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
}
