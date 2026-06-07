/**
 * BookmarkStatsBar — 统计行（书签数 / 文件夹数 / 检测进度 / 失效数）
 *
 * 失败链接用 Badge 展示，鼠标悬停显示完整列表入口。
 *
 * 检测中状态显示：实时 "X/Y" + 进度条
 */

import { Badge, Flex, Progress, Space, Typography } from "antd";
import { useT } from "@/shared/i18n";

interface Props {
  total: number;
  folders: number;
  linkCheckRunning: boolean;
  linkCheckChecked: number;
  linkCheckTotal: number;
  brokenCount: number;
  onShowBroken: () => void;
}

export function BookmarkStatsBar({
  total,
  folders,
  linkCheckRunning,
  linkCheckChecked,
  linkCheckTotal,
  brokenCount,
  onShowBroken,
}: Props) {
  const { t } = useT();
  return (
    <Flex className="bookmark-stats-bar" gap={16} align="center" wrap="wrap">
      <span>{t("共 {n} 个书签", { n: total })}</span>
      <span>{t("{n} 个文件夹", { n: folders })}</span>
      {linkCheckRunning && (
        <Space size={6} className="bookmark-stats-bar__progress">
          <Typography.Text type="secondary">
            {t("检测中 {checked}/{total}", {
              checked: linkCheckChecked,
              total: linkCheckTotal,
            })}
          </Typography.Text>
          <Progress
            type="line"
            percent={
              linkCheckTotal > 0
                ? Math.round((linkCheckChecked / linkCheckTotal) * 100)
                : 0
            }
            showInfo={false}
            size="small"
            strokeLinecap="round"
            className="bookmark-stats-bar__progress-bar"
          />
        </Space>
      )}
      {brokenCount > 0 && !linkCheckRunning && (
        <Badge
          count={brokenCount}
          size="small"
          title={t("失效链接")}
          onClick={onShowBroken}
          className="bookmark-stats-bar__broken-badge"
        />
      )}
    </Flex>
  );
}
