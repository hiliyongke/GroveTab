import { Button } from "antd";
import {
  Activity,
  Binary,
  Braces,
  Clock,
  Code2,
  Dices,
  FileJson,
  FileType,
  GitCompare,
  Globe2,
  Hash,
  Heart,
  KeyRound,
  Link,
  Palette,
  Regex,
  Ruler,
  Shield,
  Terminal,
  Type,
  Wrench,
} from "lucide-react";
import type { DevToolDefinition } from "../tool-registry";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import styles from "../DeveloperToolsPage.module.less";

/** 工具图标映射（导出供 DeveloperToolsPage 使用） */
export const TOOL_ICONS: Record<string, React.ReactNode> = {
  "json-format": <Braces size={ICON_SIZE.LARGE} />,
  "json-to-ts": <FileJson size={ICON_SIZE.LARGE} />,
  "json-path": <Braces size={ICON_SIZE.LARGE} />,
  "yaml-json": <FileJson size={ICON_SIZE.LARGE} />,
  "csv-json": <FileType size={ICON_SIZE.LARGE} />,
  "jwt-decoder": <KeyRound size={ICON_SIZE.LARGE} />,
  "basic-auth": <Shield size={ICON_SIZE.LARGE} />,
  "sql-format": <Terminal size={ICON_SIZE.LARGE} />,
  "url-parse": <Globe2 size={ICON_SIZE.LARGE} />,
  "url-query": <Globe2 size={ICON_SIZE.LARGE} />,
  "url-codec": <Link size={ICON_SIZE.LARGE} />,
  "curl-fetch": <Terminal size={ICON_SIZE.LARGE} />,
  "http-status": <Activity size={ICON_SIZE.LARGE} />,
  "http-header": <Globe2 size={ICON_SIZE.LARGE} />,
  "ua-parse": <Globe2 size={ICON_SIZE.LARGE} />,
  "base64-codec": <Binary size={ICON_SIZE.LARGE} />,
  "html-entity": <Code2 size={ICON_SIZE.LARGE} />,
  "string-escape": <Code2 size={ICON_SIZE.LARGE} />,
  "regex-test": <Regex size={ICON_SIZE.LARGE} />,
  "text-diff": <GitCompare size={ICON_SIZE.LARGE} />,
  "case-convert": <Type size={ICON_SIZE.LARGE} />,
  "text-stats": <Type size={ICON_SIZE.LARGE} />,
  timestamp: <Clock size={ICON_SIZE.LARGE} />,
  cron: <Clock size={ICON_SIZE.LARGE} />,
  hash: <Shield size={ICON_SIZE.LARGE} />,
  radix: <Hash size={ICON_SIZE.LARGE} />,
  "css-unit": <Ruler size={ICON_SIZE.LARGE} />,
  "color-preview": <Palette size={ICON_SIZE.LARGE} />,
  "mime-type": <FileType size={ICON_SIZE.LARGE} />,
  "random-gen": <Dices size={ICON_SIZE.LARGE} />,
};

interface ToolCardProps {
  tool: DevToolDefinition;
  title: string;
  description: string;
  selected: boolean;
  favorited: boolean;
  onClick: () => void;
  onToggleFavorite: (event: React.MouseEvent) => void;
}

export function ToolCard({
  tool,
  title,
  description,
  selected,
  favorited,
  onClick,
  onToggleFavorite,
}: ToolCardProps) {
  return (
    <Button
      type="text"
      className={`devtools-card${selected ? " is-selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className={styles["devtools-card-icon"]}>
        {TOOL_ICONS[tool.id] ?? <Wrench size={ICON_SIZE.DEFAULT} />}
      </span>
      <div className={styles["devtools-card-body"]}>
        <div className={styles["devtools-card-title"]}>
          <span>{title}</span>
          {tool.localOnly && <span className={styles["devtools-local-badge"]}>Local</span>}
        </div>
        <div className={styles["devtools-card-desc"]}>{description}</div>
      </div>
      <span
        className={`devtools-fav-btn${favorited ? " is-active" : ""}`}
        onClick={onToggleFavorite}
        role="button"
        tabIndex={0}
        aria-label="收藏"
      >
        <Heart size={12} />
      </span>
    </Button>
  );
}
