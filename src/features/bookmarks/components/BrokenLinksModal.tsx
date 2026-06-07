/**
 * BrokenLinksModal — 失效链接检测（v2 流式预览版）
 *
 * 特性：
 *   - 实时进度条 + 计数（"12/200"）
 *   - 实时列表：最近检测的 N 条 + 所有失效项
 *   - 暂停/取消按钮
 *   - 完成后展示汇总
 *   - 空态：所有链接正常
 */

import { useMemo } from "react";
import { Modal, Button, Flex, Progress, Typography, Space, Popconfirm } from "antd";
import { AlertTriangle, CheckCircle2, ExternalLink, Trash2, Play, X } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import type { BrokenLinkInfo } from "../hooks/use-link-checker";

interface Props {
  open: boolean;
  /** 全部已检测（含正常 + 失效） */
  partialResults: BrokenLinkInfo[];
  /** 失效子集 */
  broken: BrokenLinkInfo[];
  /** 检测进度 */
  total: number;
  checked: number;
  running: boolean;
  totalDurationMs: number;
  onClose: () => void;
  onCancel: () => void;
  onDeleteOne: (id: string) => Promise<void>;
  onDeleteAll: () => Promise<void>;
}

const RECENT_PREVIEW_COUNT = 6;

export function BrokenLinksModal({
  open,
  partialResults,
  broken,
  total,
  checked,
  running,
  totalDurationMs,
  onClose,
  onCancel,
  onDeleteOne,
  onDeleteAll,
}: Props) {
  const { t } = useT();

  // 最近检测的几条（默认 6 条）
  const recent = useMemo(
    () => partialResults.slice(-RECENT_PREVIEW_COUNT).reverse(),
    [partialResults],
  );

  const failedCount = broken.length;
  const passedCount = partialResults.length - failedCount;
  const progressPct = total > 0 ? Math.round((checked / total) * 100) : 0;

  return (
    <Modal
      open={open}
      title={running ? t("检测失效链接中…") : t("失效链接检测")}
      onCancel={onClose}
      footer={
        failedCount > 0 && !running ? (
          <Space>
            <Popconfirm
              title={t("确定删除全部 {n} 个失效链接？", { n: failedCount })}
              okText={t("删除")}
              cancelText={t("取消")}
              onConfirm={() => {
                void onDeleteAll();
              }}
            >
              <Button danger>{t("一键清理")}</Button>
            </Popconfirm>
            <Button onClick={onClose}>{t("关闭")}</Button>
          </Space>
        ) : (
          <Button onClick={onClose}>{t("关闭")}</Button>
        )
      }
      width={680}
      maskClosable={false}
    >
      {/* ── 检测中：进度 + 实时预览 ── */}
      {running && (
        <Flex vertical gap={12} className="bookmark-broken-modal__running">
          <Flex align="center" justify="space-between">
            <Typography.Text type="secondary">
              {t("检测中 {checked}/{total}", { checked, total })}
            </Typography.Text>
            <Typography.Text type="secondary">
              {t("已发现 {n} 个失效", { n: failedCount })}
            </Typography.Text>
          </Flex>
          <Progress
            percent={progressPct}
            status="active"
            showInfo={false}
            size="small"
            strokeLinecap="round"
          />
          <Flex align="center" gap={8} className="bookmark-broken-modal__running-actions">
            <Typography.Text type="secondary" className="bookmark-broken-modal__hint">
              {t("流式预览 — 失败项会立即出现在下方")}
            </Typography.Text>
            <Button
              size="small"
              icon={<X size={ICON_SIZE.MICRO} />}
              onClick={onCancel}
              aria-label={t("停止检测")}
            >
              {t("停止")}
            </Button>
          </Flex>
          {recent.length > 0 && (
            <div className="bookmark-broken-modal__preview">
              {recent.map((item, idx) => (
                <PreviewRow key={`${item.bookmarkId}-${idx}`} item={item} />
              ))}
            </div>
          )}
        </Flex>
      )}

      {/* ── 检测完成：全部结果 ── */}
      {!running && partialResults.length > 0 && (
        <Flex vertical gap={12} className="bookmark-broken-modal__done">
          <Flex align="center" gap={16} className="bookmark-broken-modal__summary">
            <Flex align="center" gap={4}>
              <CheckCircle2 size={ICON_SIZE.SMALL} className="bookmark-broken-modal__ok-icon" />
              <Typography.Text type="success">
                {t("{n} 个正常", { n: passedCount })}
              </Typography.Text>
            </Flex>
            <Flex align="center" gap={4}>
              <AlertTriangle size={ICON_SIZE.SMALL} className="bookmark-broken-modal__err-icon" />
              <Typography.Text type="danger">
                {t("{n} 个失效", { n: failedCount })}
              </Typography.Text>
            </Flex>
            <Typography.Text type="secondary" className="bookmark-broken-modal__duration">
              {t("耗时 {ms} ms", { ms: Math.round(totalDurationMs) })}
            </Typography.Text>
          </Flex>

          {failedCount === 0 ? (
            <Flex vertical align="center" gap={8} className="bookmark-broken-modal__allok">
              <CheckCircle2 size={32} className="bookmark-broken-modal__success-icon" />
              <Typography.Text type="success">{t("所有书签链接正常！")}</Typography.Text>
              <Typography.Text type="secondary">
                {t("继续使用浏览器，定期复查即可")}
              </Typography.Text>
            </Flex>
          ) : (
            <div className="bookmark-broken-modal__scroll">
              {broken.map((item) => (
                <Flex
                  key={item.bookmarkId}
                  align="center"
                  gap={8}
                  className="bookmark-broken-modal__item"
                >
                  <AlertTriangle size={14} className="bookmark-broken-modal__item-icon" />
                  <Flex vertical className="bookmark-broken-modal__item-text">
                    <span className="bookmark-broken-modal__item-title">{item.title}</span>
                    <span className="bookmark-broken-modal__item-url">{item.url}</span>
                  </Flex>
                  <Typography.Text type="secondary" className="bookmark-broken-modal__item-duration">
                    {t("{ms}ms", { ms: Math.round(item.durationMs) })}
                  </Typography.Text>
                  <Space size={4}>
                    <Button
                      size="small"
                      type="text"
                      icon={<ExternalLink size={12} />}
                      aria-label={t("打开")}
                      onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
                    />
                    <Popconfirm
                      title={t("删除此书签？")}
                      okText={t("删除")}
                      cancelText={t("取消")}
                      onConfirm={() => {
                        void onDeleteOne(item.bookmarkId);
                      }}
                    >
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<Trash2 size={12} />}
                        aria-label={t("删除")}
                      />
                    </Popconfirm>
                  </Space>
                </Flex>
              ))}
            </div>
          )}
        </Flex>
      )}

      {/* ── 初始状态：未开始 ── */}
      {!running && partialResults.length === 0 && (
        <Flex vertical align="center" gap={8} className="bookmark-broken-modal__idle">
          <Play size={ICON_SIZE.LARGE} className="bookmark-broken-modal__idle-icon" />
          <Typography.Text>{t("准备开始检测")}</Typography.Text>
          <Typography.Text type="secondary">
            {t("工具栏 → 工具 → 检测失效链接 即可开始")}
          </Typography.Text>
        </Flex>
      )}
    </Modal>
  );
}

/** 预览行（检测中时使用） */
function PreviewRow({ item }: { item: BrokenLinkInfo }) {
  const { t } = useT();
  return (
    <Flex align="center" gap={6} className="bookmark-broken-modal__preview-row">
      {item.ok ? (
        <CheckCircle2 size={12} className="bookmark-broken-modal__preview-ok" />
      ) : (
        <AlertTriangle size={12} className="bookmark-broken-modal__preview-err" />
      )}
      <span className="bookmark-broken-modal__preview-title">{item.title}</span>
      <Typography.Text type="secondary" className="bookmark-broken-modal__preview-time">
        {t("{ms}ms", { ms: Math.round(item.durationMs) })}
      </Typography.Text>
    </Flex>
  );
}
