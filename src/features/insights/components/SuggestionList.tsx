/**
 * SuggestionList — 智能建议列表
 *
 * 把 useSmartSuggestions 的输出渲染为 antd Alert 列表。
 */

import { Alert, Button, Card, Flex } from "antd";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { useT } from "@/shared/i18n";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import type { SmartSuggestion } from "../hooks/use-smart-suggestions";

interface Props {
  suggestions: SmartSuggestion[];
}

export function SuggestionList({ suggestions }: Props) {
  const { t } = useT();

  if (suggestions.length === 0) return null;

  return (
    <Card title={t("智能建议")}>
      <Flex vertical gap={8} className="insights-suggestion-list" role="list">
        {suggestions.map((s) => (
          <Alert
            key={s.id}
            type={
              s.level === "warning" ? "warning" : s.level === "success" ? "success" : "info"
            }
            showIcon
            icon={
              s.level === "success" ? (
                <CheckCircle2 size={ICON_SIZE.SMALL} />
              ) : s.level === "warning" ? (
                <AlertTriangle size={ICON_SIZE.SMALL} />
              ) : (
                <Info size={ICON_SIZE.SMALL} />
              )
            }
            title={s.titleKey}
            description={s.descKey}
            action={
              s.actionKey !== undefined && s.onAction !== undefined ? (
                <Button type="link" onClick={s.onAction}>
                  {s.actionKey}
                </Button>
              ) : undefined
            }
            role="listitem"
          />
        ))}
      </Flex>
    </Card>
  );
}
