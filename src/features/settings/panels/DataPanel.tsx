/**
 * DataPanel — 数据管理 Tab
 *
 * 包含：
 *   - 配置预设（保存/加载/切换/删除）
 *   - 存储配额可视化
 *   - 导出归档 JSON
 *   - 导入归档 JSON
 *   - 清空所有归档
 */

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Space,
  Progress,
  Alert,
  App,
  Input,
  Popconfirm,
  Empty,
  Divider,
  Upload,
  Flex,
  Typography,
} from "antd";
import {
  Download,
  Upload as UploadIcon,
  Trash2,
  HardDrive,
  Save,
  ArrowLeftRight,
  Pencil,
  RotateCcw,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { PermissionDiagnosticsPanel } from "./PermissionDiagnosticsPanel";

import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { useSettingsStore } from "@/store";
import { exportSessionsJSON, downloadFile, parseImportJSON } from "@/shared/utils/import-export";
import { getArchivedSessions, saveSessions } from "@/services";
import { getQuotaStatus, formatBytes } from "@/shared/utils/quota";
import { Field } from "@/features/settings/components/Field";
import { getAllDataKeys, removeData } from "@/repositories/storage-repo";
import { APP_RESOURCE_NAMES, STORAGE_KEYS, isAppStorageKey } from "@/shared/config/storage-keys";
import type { SettingsProfile } from "@/shared/utils/profiles";
import { getProfiles, createProfile, renameProfile, deleteProfile } from "@/shared/utils/profiles";
import styles from "./styles/data.module.less";

interface QuotaInfo {
  usedBytes: number;
  totalBytes: number;
  percentage: number;
  isWarning: boolean;
}

const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;

export function DataPanel() {
  const { t } = useT();
  const { modal, message } = App.useApp();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const resetSettings = useSettingsStore((s) => s.resetSettings);

  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
  const [profiles, setProfiles] = useState<SettingsProfile[]>([]);
  const [profileName, setProfileName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    void getQuotaStatus().then(setQuotaInfo);
    void getProfiles().then(setProfiles);
  }, []);

  const handleCreateProfile = useCallback(async () => {
    if (!profileName.trim()) return;
    await createProfile(profileName.trim(), settings);
    setProfileName("");
    const updated = await getProfiles();
    setProfiles(updated);
    message.success(t("预设已保存"));
  }, [profileName, settings, message, t]);

  const handleApplyProfile = useCallback(
    (profile: SettingsProfile) => {
      void updateSettings(profile.settings);
      message.success(t("已应用预设「{name}」", { name: profile.name }));
    },
    [updateSettings, message, t],
  );

  const handleDeleteProfile = useCallback(
    async (id: string) => {
      await deleteProfile(id);
      const updated = await getProfiles();
      setProfiles(updated);
      message.success(t("预设已删除"));
    },
    [message, t],
  );

  const handleRenameProfile = useCallback(
    async (id: string) => {
      if (!editingName.trim()) return;
      await renameProfile(id, editingName.trim());
      setEditingId(null);
      setEditingName("");
      const updated = await getProfiles();
      setProfiles(updated);
      message.success(t("预设已重命名"));
    },
    [editingName, message, t],
  );

  const handleExport = async () => {
    const sessions = await getArchivedSessions();
    const sessionPayload = exportSessionsJSON(sessions);
    const parsedSessions = JSON.parse(sessionPayload) as unknown;
    const bundle = {
      version: 2,
      exportedAt: new Date().toISOString(),
      sessions: parsedSessions,
      settings,
    };
    downloadFile(
      JSON.stringify(bundle, null, 2),
      `${APP_RESOURCE_NAMES.backupFilePrefix}-${new Date().toISOString().slice(0, 10)}.json`,
    );
    message.success(t("已导出归档 + 工作台配置"));
  };

  const handleImport = async (file: File) => {
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setImportStatus(t("导入文件过大，请控制在 {size} 以内", { size: "2 MB" }));
      return;
    }

    const text = await file.text();
    let importText = text;
    try {
      const parsed = JSON.parse(text) as { sessions?: unknown; settings?: typeof settings };
      if (parsed && Array.isArray(parsed.sessions)) {
        importText = JSON.stringify(parsed.sessions);
      }
      if (parsed?.settings) {
        await updateSettings(parsed.settings);
      }
    } catch {
      // 兼容旧版仅 sessions JSON
    }

    const { sessions, errors } = parseImportJSON(importText);
    if (errors.length > 0) {
      setImportStatus(t("导入失败：{count} 个错误", { count: errors.length }));
      return;
    }
    const existing = await getArchivedSessions();
    const existingIds = new Set(existing.map((session) => session.id));
    const newSessions = sessions.filter((session) => !existingIds.has(session.id));
    await saveSessions([...newSessions, ...existing]);
    setImportStatus(t("已导入 {count} 个归档，并恢复工作台配置", { count: newSessions.length }));
  };

  const handleClearAll = () => {
    modal.confirm({
      title: t("清空所有归档"),
      content: t("确认清空？点击执行"),
      okButtonProps: { danger: true },
      okText: t("清空所有归档"),
      cancelText: t("取消"),
      onOk: async () => {
        try {
          await saveSessions([]);
          message.success(t("清空所有归档"));
        } catch (err) {
          console.error("[DataPanel] clearAll failed:", err);
        }
      },
    });
  };

  return (
    <Flex vertical className={`${styles["data-panel"]} settings-panel-stack`}>
      <section className="settings-section">
        <Field label={t("配置预设")} hint={t("保存当前配置为预设，一键切换不同的使用场景")}>
          <Flex className={styles["data-panel__profile-create"]}>
            <Input
              size="small"
              placeholder={t("输入预设名称…")}
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              onPressEnter={() => {
                void handleCreateProfile();
              }}
              onKeyDown={undefined}
              className={styles["data-panel__profile-input"]}
            />
            <Button
              size="small"
              type="primary"
              icon={<Save size={ICON_SIZE.MEDIUM} />}
              disabled={!profileName.trim()}
              onClick={() => {
                void handleCreateProfile();
              }}
            >
              {t("保存")}
            </Button>
          </Flex>
          {profiles.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("暂无预设")}
              className={styles["data-panel__empty"]}
            />
          ) : (
            <Flex vertical className={styles["data-panel__profile-list"]}>
              {profiles.map((profile) => (
                <Flex
                  key={profile.id}
                  align="center"
                  justify="space-between"
                  className={styles["data-panel__profile-card"]}
                >
                  {editingId === profile.id ? (
                    <Input
                      size="small"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onPressEnter={() => {
                        void handleRenameProfile(profile.id);
                      }}
                      onBlur={() => {
                        void handleRenameProfile(profile.id);
                      }}
                      className={styles["data-panel__profile-edit-input"]}
                      autoFocus
                    />
                  ) : (
                    <Typography.Text className={styles["data-panel__profile-name"]}>
                      {profile.name}
                    </Typography.Text>
                  )}
                  <Space size={4}>
                    <Button
                      type="text"
                      size="small"
                      icon={<ArrowLeftRight size={ICON_SIZE.MEDIUM} />}
                      title={t("应用此预设")}
                      onClick={() => {
                        void handleApplyProfile(profile);
                      }}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<Pencil size={ICON_SIZE.MEDIUM} />}
                      title={t("重命名")}
                      onClick={() => {
                        setEditingId(profile.id);
                        setEditingName(profile.name);
                      }}
                    />
                    <Popconfirm
                      title={t("确认删除此预设？")}
                      onConfirm={() => {
                        void handleDeleteProfile(profile.id);
                      }}
                      okText={t("删除")}
                      cancelText={t("取消")}
                      okButtonProps={{ danger: true }}
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<Trash2 size={ICON_SIZE.MEDIUM} />}
                        title={t("删除")}
                      />
                    </Popconfirm>
                  </Space>
                </Flex>
              ))}
            </Flex>
          )}
        </Field>
      </section>

      {quotaInfo !== null && (
        <section className="settings-section">
          <div className={styles["data-panel__quota"]}>
            <Flex
              align="center"
              justify="space-between"
              className={styles["data-panel__quota-header"]}
            >
              <Flex align="center" className={styles["data-panel__quota-label"]}>
                <HardDrive size={ICON_SIZE.MEDIUM} className={styles["data-panel__quota-icon"]} />
                {t("存储空间")}
              </Flex>
              <Typography.Text
                className={`${styles["data-panel__quota-meta"]}${quotaInfo.isWarning ? ` ${styles["is-warning"]}` : ""}`}
              >
                {formatBytes(quotaInfo.usedBytes)} / {formatBytes(quotaInfo.totalBytes)}
              </Typography.Text>
            </Flex>
            <Progress
              percent={Math.round(quotaInfo.percentage)}
              size="small"
              status={quotaInfo.isWarning ? "exception" : "normal"}
              showInfo={false}
            />
            {quotaInfo.isWarning && (
              <Alert
                type="error"
                showIcon
                description={t("存储空间即将用完，建议清理归档数据")}
                className={styles["data-panel__quota-alert"]}
              />
            )}
          </div>
        </section>
      )}

      <section className="settings-section">
        <Flex vertical className={styles["data-panel__actions"]}>
          <Button
            block
            icon={<Download size={ICON_SIZE.MEDIUM} />}
            onClick={() => {
              void handleExport();
            }}
          >
            {t("导出归档数据")}
          </Button>
          <Upload
            accept=".json"
            showUploadList={false}
            beforeUpload={(file) => {
              void handleImport(file as File);
              return false; // 阻止实际上传
            }}
          >
            <Button block icon={<UploadIcon size={ICON_SIZE.MEDIUM} />}>
              {t("导入归档数据")}
            </Button>
          </Upload>
          {importStatus !== null && (
            <Typography.Text className={styles["data-panel__import-status"]}>
              {importStatus}
            </Typography.Text>
          )}
        </Flex>
      </section>

      <section className="settings-section">
        <Button block danger icon={<Trash2 size={ICON_SIZE.MEDIUM} />} onClick={handleClearAll}>
          {t("清空所有归档")}
        </Button>

        <Divider className={styles["data-panel__divider"]}>{t("危险区")}</Divider>

        <Popconfirm
          title={t("恢复默认配置？")}
          description={t(
            "将重置全部设置（主题/皮肤/快捷键…）为默认值；所有归档、书签、历史记录数据继续保留。",
          )}
          onConfirm={() => {
            void (async () => {
              try {
                await resetSettings();
                message.success(t("配置已恢复默认，页面即将刷新"));
              } catch (err) {
                console.error("[DataPanel] resetSettings failed:", err);
                message.error(t("恢复默认配置失败，请重试"));
              }
            })();
          }}
        >
          <Button block icon={<RotateCcw size={ICON_SIZE.MEDIUM} />}>
            {t("恢复默认配置")}
          </Button>
        </Popconfirm>

        <Popconfirm
          title={t("重播欢迎教程？下次打开新标签页将重新弹出。")}
          onConfirm={() => {
            void (async () => {
              try {
                await removeData(STORAGE_KEYS.onboardingDone);
                message.success(t("欢迎教程已重置"));
              } catch (err) {
                console.error("[DataPanel] replayOnboarding failed:", err);
              }
            })();
          }}
        >
          <Button block icon={<Sparkles size={ICON_SIZE.MEDIUM} />}>
            {t("重播欢迎教程")}
          </Button>
        </Popconfirm>

        <Button
          block
          danger
          icon={<AlertTriangle size={ICON_SIZE.MEDIUM} />}
          onClick={() => {
            let confirmText = "";
            modal.confirm({
              title: t("恢复出厂设置"),
              content: (
                <Flex vertical className={styles["data-panel__factory-confirm"]}>
                  <Alert
                    type="error"
                    showIcon
                    message={t(
                      "此操作不可撤销：将清除所有归档、书签元数据、设置、历史记录。请确认已导出备份。",
                    )}
                  />
                  <Typography.Text className={styles["data-panel__factory-copy"]}>
                    {t("输入 RESET 以确认执行：")}
                  </Typography.Text>
                  <Input
                    placeholder="RESET"
                    onChange={(e) => {
                      confirmText = e.target.value;
                    }}
                  />
                </Flex>
              ),
              okText: t("全量重置"),
              okButtonProps: { danger: true },
              cancelText: t("取消"),
              onOk: async () => {
                if (confirmText.trim().toUpperCase() !== "RESET") {
                  message.error(t("请输入 RESET 以确认"));
                  return Promise.reject(new Error("must type RESET"));
                }
                try {
                  const keys = await getAllDataKeys();
                  for (const key of keys) {
                    if (isAppStorageKey(key)) {
                      await removeData(key);
                    }
                  }
                  await resetSettings();
                  message.success(t("已恢复出厂设置，页面即将刷新"));
                  setTimeout(() => window.location.reload(), 400);
                } catch (err) {
                  console.error("[DataPanel] factoryReset failed:", err);
                  message.error(t("请输入 RESET 以确认"));
                  return Promise.reject(err instanceof Error ? err : new Error(String(err)));
                }
                return undefined;
              },
            });
          }}
        >
          {t("恢复出厂设置")}
        </Button>
      </section>

      {/* 任务8：权限诊断区 */}
      <section className="settings-section">
        <Flex align="center" gap={6} style={{ marginBottom: 8 }}>
          <ShieldCheck size={ICON_SIZE.MEDIUM} />
          <Typography.Text strong>{t("权限状态")}</Typography.Text>
        </Flex>
        <PermissionDiagnosticsPanel />
      </section>
    </Flex>
  );
}
