import { type RefObject } from "react";
import { Input, Flex } from "antd";
import { Search } from "lucide-react";
import { useT } from "@/shared/i18n";
import { getBrandDisplayName, getBrandSlogan } from "@/shared/config/brand";
import { BRAND } from "@/shared/config/brand";
import { ICON_SIZE } from "@/shared/utils/icon-size";

/**
 * Hero 区：品牌 Logo + 搜索框
 *
 * 排版策略（参考微软新标签页）：
 *   - 品牌 Logo 居中展示，搜索框紧随其下——形成视觉重心
 *   - Logo 不做太大，保持精致感；品牌名用渐变文字
 *   - 搜索框居中、超宽、带辉光阴影——第一视觉焦点
 *   - 整体垂直节奏：logo → 搜索，保持顶部区域聚焦
 */
export function HeroBar({
  onOpenSearch,
  sentinelRef,
  showLogo,
  showTitle,
  showSlogan,
  showSearch,
}: {
  onOpenSearch: () => void;
  sentinelRef: RefObject<HTMLDivElement | null>;
  showLogo: boolean;
  showTitle: boolean;
  showSlogan: boolean;
  showSearch: boolean;
}) {
  const { t, locale } = useT();
  /** 品牌身份：名称 + slogan 均来自 BRAND 配置层，切换品牌无需改此处 */
  const brandName = getBrandDisplayName(locale);
  const brandSlogan = getBrandSlogan(locale);
  const shouldShowBrandRow = showLogo || showTitle;
  const shouldShowSlogan = showSlogan && brandSlogan !== "";

  return (
    <Flex vertical align="center" gap={16} className="app-hero">
      {/* 品牌 Logo —— 居中展示，参考微软新标签页
          所有内容通过 BRAND 配置层读取，切换品牌预设即可整站换装 */}
      {(shouldShowBrandRow || shouldShowSlogan) && (
        <Flex vertical align="center" gap={6} className="app-hero-brand">
          {shouldShowBrandRow && (
            <Flex align="center" gap={10} className="app-hero-brand-row">
              {showLogo && <img src="/icons/logo.png" alt={BRAND.name} className="app-hero-logo" />}
              {showTitle && <span className="app-hero-title">{brandName}</span>}
            </Flex>
          )}
          {/* Slogan —— 低调次级展示，字号控制在 12px，避免喧宾夺主 */}
          {shouldShowSlogan && <span className="app-hero-slogan">{brandSlogan}</span>}
        </Flex>
      )}

      {/* 搜索框 —— 超宽居中，大圆角 + 品牌辉光
          hover 态、transition 全部交给 .app-hero-search（CSS），
          避免在 React 里写 onMouseEnter/Leave 副作用。 */}
      {showSearch && (
        <div ref={sentinelRef} className="app-hero-search-wrap" data-tour="search">
          <Input
            className="app-hero-search"
            size="large"
            readOnly
            aria-label={t("搜索标签页...")}
            placeholder={t("搜索标签页...")}
            prefix={
              <Search
                size={ICON_SIZE.XXL}
                className="app-icon app-icon--search app-hero-search-icon"
              />
            }
            suffix={<span className="app-kbd">⌘K</span>}
            onFocus={(e) => {
              e.currentTarget.blur();
              onOpenSearch();
            }}
            onClick={onOpenSearch}
          />
        </div>
      )}
    </Flex>
  );
}
