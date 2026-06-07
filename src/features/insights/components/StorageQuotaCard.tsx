/**
 * StorageQuotaCard — 存储占用卡片
 *
 * 展示 chrome.storage.local 与 OPFS 占用比例，使用 antd Progress。
 */

import { Card, Col, Flex, Progress, Row, Typography } from "antd";
import { useT } from "@/shared/i18n";
import type { StorageQuotaInfo } from "@/shared/utils/opfs-storage";
import { formatBytes } from "../utils/format";

interface Props {
  info: StorageQuotaInfo | null;
  loading: boolean;
}

export function StorageQuotaCard({ info, loading }: Props) {
  const { t } = useT();

  if (loading || info === null) {
    return null;
  }

  return (
    <Card size="small" title={t("存储占用")}>
      <Row gutter={24}>
        <Col xs={24} sm={12}>
          <Flex vertical gap={4}>
            <Typography.Text type="secondary">chrome.storage</Typography.Text>
            <Progress
              percent={Math.round(info.chromeStorageRatio * 100)}
              status={
                info.chromeStorageRatio >= 0.9
                  ? "exception"
                  : info.chromeStorageRatio >= 0.7
                    ? "active"
                    : "normal"
              }
              size="small"
            />
            <Typography.Text type="secondary">
              {formatBytes(info.chromeStorageUsed)} / {formatBytes(info.chromeStorageTotal)}
            </Typography.Text>
          </Flex>
        </Col>
        <Col xs={24} sm={12}>
          <Flex vertical gap={4}>
            <Typography.Text type="secondary">OPFS</Typography.Text>
            <Progress
              percent={info.opfsTotal > 0 ? Math.round(info.opfsRatio * 100) : 0}
              status={info.opfsRatio >= 0.9 ? "exception" : "normal"}
              size="small"
            />
            <Typography.Text type="secondary">
              {formatBytes(info.opfsUsed)}
              {info.opfsTotal > 0 ? ` / ${formatBytes(info.opfsTotal)}` : ""}
            </Typography.Text>
          </Flex>
        </Col>
      </Row>
    </Card>
  );
}
