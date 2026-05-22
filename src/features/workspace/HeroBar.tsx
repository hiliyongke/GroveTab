import { useMemo, type RefObject } from 'react';
import { Input, Segmented } from 'antd';
import { Search } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useT } from '@/shared/i18n';
import { getBrandDisplayName, getBrandSlogan } from '@/shared/config/brand';
import { BRAND } from '@/shared/config/brand';
import { VIEW_CONFIGS, type ViewMode } from '@/shared/config/views';
import type { ViewTabPosition } from '@/shared/types';

/**
 * Hero 区：品牌 Logo + 搜索框 + 视图切换
 *
 * 排版策略（参考微软新标签页）：
 *   - 品牌 Logo 居中展示，搜索框紧随其下——形成视觉重心
 *   - Logo 不做太大，保持精致感；品牌名用渐变文字
 *   - 搜索框居中、超宽、带辉光阴影——第一视觉焦点
 *   - 视图切换在搜索框下方，紧凑 Tab 行
 *   - 整体垂直节奏：logo → 搜索 → 视图，间距递减
 */
export function HeroBar({
  viewMode,
  onViewChange,
  onOpenSearch,
  sentinelRef,
  showLogo,
  showTitle,
  showSlogan,
  showSearch,
  showViewSwitcher,
  viewTabPosition,
}: {
  viewMode: ViewMode;
  onViewChange: (v: ViewMode) => void;
  onOpenSearch: () => void;
  sentinelRef: RefObject<HTMLDivElement | null>;
  showLogo: boolean;
  showTitle: boolean;
  showSlogan: boolean;
  showSearch: boolean;
  showViewSwitcher: boolean;
  viewTabPosition: ViewTabPosition;
}) {
  const { t, locale } = useT();
  /** 品牌身份：名称 + slogan 均来自 BRAND 配置层，切换品牌无需改此处 */
  const brandName = getBrandDisplayName(locale);
  const brandSlogan = getBrandSlogan(locale);
  const shouldShowBrandRow = showLogo || showTitle;
  const shouldShowSlogan = showSlogan && brandSlogan !== '';

  /**
   * Segmented 视图切换 options。
   *
   * 之前这里每次 AppHeader 渲染都会调用 VIEW_CONFIGS.map 重建整个数组与 label JSX，
   * 导致 antd Segmented 内部判等失败、无意义地重新布局。此处用 useMemo 缓存，
   * 依赖 t——i18n 语言切换时自动刷新标签文案。
   */
  const viewSegmentedOptions = useMemo(
    () =>
      VIEW_CONFIGS.map((v) => ({
        value: v.id,
        label: (
          <span className="app-view-option">
            <v.Icon size={ICON_SIZE.MEDIUM} />
            {t(v.labelKey)}
          </span>
        ),
      })),
    [t],
  );

  return (
    <section className="app-hero">
      {/* 品牌 Logo —— 居中展示，参考微软新标签页
          所有内容通过 BRAND 配置层读取，切换品牌预设即可整站换装 */}
      {(shouldShowBrandRow || shouldShowSlogan) && (
        <div
          className="app-hero-brand"
        >
          {shouldShowBrandRow && (
            <div className="app-hero-brand-row">
              {showLogo && (
                <img
                  src="/icons/logo.png"
                  alt={BRAND.name}
                  className="app-hero-logo"
                />
              )}
              {showTitle && (
                <span className="app-hero-title">
                  {brandName}
                </span>
              )}
            </div>
          )}
          {/* Slogan —— 低调次级展示，字号控制在 12px，避免喧宾夺主 */}
          {shouldShowSlogan && (
            <span className="app-hero-slogan">
              {brandSlogan}
            </span>
          )}
        </div>
      )}

      {/* 搜索框 —— 超宽居中，大圆角 + 品牌辉光
          hover 态、transition 全部交给 .app-hero-search（CSS），
          避免在 React 里写 onMouseEnter/Leave 副作用。 */}
      {showSearch && (
        <div ref={sentinelRef} className="app-hero-search-wrap">
          <Input
            className="app-hero-search"
            size="large"
            readOnly
            placeholder={t('search.placeholder')}
            prefix={<Search size={ICON_SIZE.XXL} className="app-icon app-icon--search app-hero-search-icon" />}
            suffix={<span className="app-kbd">⌘K</span>}
            onFocus={(e) => {
              e.currentTarget.blur();
              onOpenSearch();
            }}
            onClick={onOpenSearch}
          />
        </div>
      )}

      {/* 视图切换 —— 仅在 top 模式下渲染到 HeroBar，left/right 模式由侧边栏接管 */}
      {showViewSwitcher && viewTabPosition === 'top' && (
        <Segmented<ViewMode>
          value={viewMode}
          onChange={(v: ViewMode) => onViewChange(v)}
          options={viewSegmentedOptions}
          size="middle"
          className="app-view-switcher"
          classNames={{ item: 'app-view-switcher__item' }}
        />
      )}
    </section>
  );
}
