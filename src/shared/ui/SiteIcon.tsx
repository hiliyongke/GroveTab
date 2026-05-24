/**
 * SiteIcon —— 通用 favicon 图标，附域名首字母兜底。
 *
 * 用于书签、历史、搜索等场景统一展示站点图标。
 */

import { useState } from "react";
import { Image } from "antd";
import { getFaviconUrl } from "@/chrome";

interface SiteIconProps {
  /** 站点 URL */
  url: string;
  /** 图标尺寸（默认 18） */
  size?: number;
  /** 附加 className（可选） */
  className?: string;
}

export function SiteIcon({ url, size = 18, className }: SiteIconProps) {
  const fav = getFaviconUrl(url);
  const [err, setErr] = useState(false);

  let host = url;
  try {
    host = new URL(url).hostname;
  } catch {
    // 保留原始 url
  }

  if (fav && !err) {
    return (
      <Image
        src={fav}
        alt=""
        className={className}
        style={{ width: size, height: size, flexShrink: 0 }}
        onError={() => setErr(true)}
        preview={false}
        fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
      />
    );
  }

  const letter = (host.charAt(0) || "?").toUpperCase();
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        borderRadius: 4,
        backgroundColor: "var(--ant-color-fill-secondary)",
        fontSize: size * 0.6,
        fontWeight: 600,
        color: "var(--ant-color-text-secondary)",
      }}
    >
      {letter}
    </span>
  );
}
