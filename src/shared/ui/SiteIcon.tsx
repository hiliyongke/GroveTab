/**
 * SiteIcon —— 通用 favicon 图标，附域名首字母兜底。
 *
 * 用于书签、历史、搜索等场景统一展示站点图标。
 */

import { useState, useMemo } from "react";
import { Image } from "antd";
import { getFaviconUrl } from "@/chrome";
import styles from "./SiteIcon.module.less";

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

  /* 用 CSS 变量驱动尺寸，避免每次 size 变化都创建新 style 对象 */
  const cssVars = useMemo(
    () => ({ "--site-icon-size": `${size}px` }) as React.CSSProperties,
    [size],
  );

  if (fav && !err) {
    return (
      <Image
        src={fav}
        alt=""
        className={`${styles.image} ${className ?? ""}`.trim()}
        style={cssVars}
        onError={() => setErr(true)}
        preview={false}
        fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
      />
    );
  }

  const letter = (host.charAt(0) || "?").toUpperCase();
  return (
    <span className={`${styles.fallback} ${className ?? ""}`.trim()} style={cssVars}>
      {letter}
    </span>
  );
}
