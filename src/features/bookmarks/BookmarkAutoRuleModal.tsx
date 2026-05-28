/**
 * BookmarkAutoRuleModal —— 书签自动分类规则配置界面（需求 5.2）
 *
 * 功能：
 *   - 展示现有规则列表（启用/禁用/删除）
 *   - 新增规则（URLPattern + 目标文件夹名）
 *   - 一键对全部书签应用规则
 */

import { useState, useEffect, useCallback } from "react";
import {
  Modal,
  Button,
  Form,
  Input,
  Switch,
  List,
  Tag,
  Flex,
  Typography,
  Tooltip,
  Empty,
  Alert,
} from "antd";
import { Plus, Trash2, Play, FolderInput } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { feedback } from "@/shared/ui/feedback";
import { translate } from "@/shared/i18n/core";
import type { BookmarkAutoRule } from "./bookmark-auto-rules";
import styles from "./BookmarkAutoRuleModal.module.less";
import {
  getBookmarkAutoRules,
  addBookmarkAutoRule,
  deleteBookmarkAutoRule,
  updateBookmarkAutoRule,
  applyAutoRulesToAll,
  ensureTargetFolder,
} from "./bookmark-auto-rules";

interface BookmarkAutoRuleModalProps {
  open: boolean;
  onClose: () => void;
  onMutated: () => void;
}

interface RuleFormValues {
  name: string;
  pattern: string;
  targetFolderName: string;
}

export function BookmarkAutoRuleModal({ open, onClose, onMutated }: BookmarkAutoRuleModalProps) {
  const { t } = useT();
  const [rules, setRules] = useState<BookmarkAutoRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [form] = Form.useForm<RuleFormValues>();

  const loadRules = useCallback(async () => {
    const data = await getBookmarkAutoRules();
    setRules(data);
  }, []);

  useEffect(() => {
    if (open) void loadRules();
  }, [open, loadRules]);

  const handleAdd = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      // 确保目标文件夹存在
      const folderId = await ensureTargetFolder(values.targetFolderName);
      if (!folderId) {
        feedback.error(translate("创建目标文件夹失败"));
        return;
      }
      await addBookmarkAutoRule({
        name: values.name,
        pattern: values.pattern,
        targetFolderId: folderId,
        targetFolderName: values.targetFolderName,
        enabled: true,
      });
      form.resetFields();
      await loadRules();
      feedback.success(translate("规则已添加"));
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return; // 表单校验失败
      feedback.error(translate("添加规则失败"), err);
    } finally {
      setLoading(false);
    }
  }, [form, loadRules]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteBookmarkAutoRule(id);
      await loadRules();
    },
    [loadRules],
  );

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      await updateBookmarkAutoRule(id, { enabled });
      await loadRules();
    },
    [loadRules],
  );

  const handleApplyAll = useCallback(async () => {
    setApplying(true);
    try {
      const moved = await applyAutoRulesToAll();
      feedback.success(translate("已移动 {count} 个书签", { count: moved }));
      onMutated();
    } catch (err) {
      feedback.error(translate("应用规则失败"), err);
    } finally {
      setApplying(false);
    }
  }, [onMutated]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      title={
        <Flex align="center" gap={8}>
          <FolderInput size={ICON_SIZE.MEDIUM} />
          <Typography.Text>{t("自动分类规则")}</Typography.Text>
        </Flex>
      }
      destroyOnHidden
    >
      <Flex vertical gap={20}>
        <Alert
          type="info"
          showIcon
          message={t("使用 URLPattern 语法匹配书签 URL，自动移动到指定文件夹。")}
          description={
            <Typography.Text>
              {t("示例：")} <Typography.Text code>{"https://github.com/*"}</Typography.Text>
              {" → "}
              <Typography.Text code>{t("GitHub")}</Typography.Text>
            </Typography.Text>
          }
        />

        {/* 新增规则表单 */}
        <Form form={form} layout="vertical">
          <Flex gap={12}>
            <Form.Item
              name="name"
              label={t("规则名称")}
              rules={[{ required: true, message: t("请输入规则名称") }]}
              className={styles["bookmark-rule-field"]}
            >
              <Input placeholder={t("如：GitHub 书签")} />
            </Form.Item>
            <Form.Item
              name="targetFolderName"
              label={t("目标文件夹")}
              rules={[{ required: true, message: t("请输入目标文件夹名") }]}
              className={styles["bookmark-rule-field"]}
            >
              <Input placeholder={t("如：GitHub")} />
            </Form.Item>
          </Flex>
          <Form.Item
            name="pattern"
            label={t("URL 匹配规则（URLPattern）")}
            rules={[
              { required: true, message: t("请输入 URL 匹配规则") },
              {
                validator: (_, value: unknown) => {
                  if (!value) return Promise.resolve();
                  try {
                    new URLPattern(String(value));
                    return Promise.resolve();
                  } catch {
                    return Promise.reject(new Error(t("URLPattern 格式无效")));
                  }
                },
              },
            ]}
          >
            <Input placeholder="https://github.com/*" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<Plus size={ICON_SIZE.SMALL} />}
              loading={loading}
              onClick={() => void handleAdd()}
            >
              {t("添加规则")}
            </Button>
          </Form.Item>
        </Form>

        {/* 规则列表 */}
        {rules.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("暂无规则，添加后书签将自动分类")}
          />
        ) : (
          <List
            size="small"
            dataSource={rules}
            renderItem={(rule) => (
              <List.Item
                actions={[
                  <Tooltip key="toggle" title={rule.enabled ? t("禁用") : t("启用")}>
                    <Switch
                      size="small"
                      checked={rule.enabled}
                      onChange={(checked) => void handleToggle(rule.id, checked)}
                    />
                  </Tooltip>,
                  <Tooltip key="delete" title={t("删除")}>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<Trash2 size={ICON_SIZE.SMALL} />}
                      onClick={() => void handleDelete(rule.id)}
                    />
                  </Tooltip>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Flex align="center" gap={8}>
                      <Typography.Text>{rule.name}</Typography.Text>
                      {!rule.enabled && <Tag color="default">{t("已禁用")}</Tag>}
                    </Flex>
                  }
                  description={
                    <Flex gap={8} align="center">
                      <Typography.Text code className={styles["bookmark-rule-value"]}>
                        {rule.pattern}
                      </Typography.Text>
                      <Typography.Text type="secondary">→</Typography.Text>
                      <Tag color="blue">{rule.targetFolderName}</Tag>
                    </Flex>
                  }
                />
              </List.Item>
            )}
          />
        )}

        {/* 应用规则按钮 */}
        {rules.some((r) => r.enabled) && (
          <Button
            icon={<Play size={ICON_SIZE.SMALL} />}
            loading={applying}
            onClick={() => void handleApplyAll()}
          >
            {t("对全部书签应用规则")}
          </Button>
        )}
      </Flex>
    </Modal>
  );
}
