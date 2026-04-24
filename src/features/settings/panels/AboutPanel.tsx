/**
 * AboutPanel —— GroveTab 产品介绍页（作为设置 Tab 渲染）
 *
 * 结构：
 *   Section 1 - 品牌头图（Logo + 名称 + Slogan + 版本号）
 *   Section 2 - 核心能力卡片（6 项核心功能）
 *   Section 3 - 快捷键速览
 *   Section 4 - 版本信息 / 反馈 / 开源地址
 *
 * 渲染策略：
 *   - 作为 SettingsPanel 内一个 Tab，不走独立页面，复用主题 token / i18n / CSS。
 *   - 完整文案走 i18n，支持 zh-CN / en 切换。
 *   - 版本号从 import.meta.env.PACKAGE_VERSION 或 manifest 解析（这里走 BRAND 或兜底常量）。
 *
 * 入口：
 *   1) SettingsPanel 的 "关于 GroveTab" Tab
 *   2) Popup 底部"关于"链接：打开新 Tab，URL hash #about，App 监听后自动打开设置面板并切到 about Tab
 */

import { theme, Button, Divider } from 'antd';
import {
  Package,
  Sparkles,
  Archive,
  Search as SearchIcon,
  BookmarkIcon,
  Palette,
  Quote as QuoteIcon,
  Code2,
  ExternalLink,
  Mail,
} from 'lucide-react';
import { useT } from '@/shared/i18n';
import { BRAND, getBrandDisplayName, getBrandSlogan } from '@/shared/config/brand';
// 版本号在运行时读 manifest（避免 build 时字段被替换）
const PKG_VERSION = (() => {
  try {
    const manifest =
      typeof chrome !== 'undefined' && typeof chrome.runtime?.getManifest === 'function'
        ? chrome.runtime.getManifest()
        : null;
    return manifest?.version ?? '1.2.0';
  } catch {
    return '1.2.0';
  }
})();

/** 能力卡片元数据；i18n key 定义在 about.feature.* 下。 */
interface FeatureCard {
  icon: React.ComponentType<{ size?: number }>;
  titleKey: string;
  descKey: string;
  color: string;
}

const FEATURES: FeatureCard[] = [
  { icon: Package, titleKey: 'about.feature.workspace.title', descKey: 'about.feature.workspace.desc', color: '#0EA5E9' },
  { icon: Archive, titleKey: 'about.feature.archive.title', descKey: 'about.feature.archive.desc', color: '#F59E0B' },
  { icon: SearchIcon, titleKey: 'about.feature.search.title', descKey: 'about.feature.search.desc', color: '#8B5CF6' },
  { icon: BookmarkIcon, titleKey: 'about.feature.bookmark.title', descKey: 'about.feature.bookmark.desc', color: '#10B981' },
  { icon: Palette, titleKey: 'about.feature.skin.title', descKey: 'about.feature.skin.desc', color: '#EC4899' },
  { icon: QuoteIcon, titleKey: 'about.feature.quote.title', descKey: 'about.feature.quote.desc', color: '#059669' },
];

export function AboutPanel() {
  const { token } = theme.useToken();
  const { t, locale } = useT();

  const brandName = getBrandDisplayName(locale);
  const slogan = getBrandSlogan(locale);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingBottom: 16 }}>
      {/* Section 1 —— Hero：Logo + 品牌名 + Slogan + 版本号 */}
      <div
        style={{
          borderRadius: token.borderRadiusLG,
          padding: '28px 20px',
          background: `linear-gradient(135deg, ${BRAND.accentColor} 0%, ${BRAND.accentColorEnd} 100%)`,
          color: '#fff',
          textAlign: 'center',
          boxShadow: token.boxShadowSecondary,
        }}
      >
        {/* 大 Logo 徽标 */}
        <div
          style={{
            width: 64,
            height: 64,
            margin: '0 auto 12px',
            borderRadius: 18,
            background: 'rgba(255,255,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            border: '2px solid rgba(255,255,255,0.32)',
          }}
        >
          {BRAND.shortName}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {brandName}
        </div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>
          「{slogan}」
        </div>
        <div style={{ fontSize: 11, opacity: 0.72, marginTop: 10, fontVariantNumeric: 'tabular-nums' }}>
          v{PKG_VERSION}
        </div>
      </div>

      {/* Section 2 —— 核心能力 */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: token.colorText }}>
          {t('about.featuresTitle')}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 10,
          }}
        >
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.titleKey}
                style={{
                  padding: 12,
                  borderRadius: token.borderRadiusLG,
                  background: token.colorFillQuaternary,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: `${f.color}1A`,
                    color: f.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={16} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: token.colorText, lineHeight: 1.3 }}>
                    {t(f.titleKey)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: token.colorTextTertiary,
                      marginTop: 3,
                      lineHeight: 1.5,
                    }}
                  >
                    {t(f.descKey)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3 —— 使用小贴士 */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: token.colorText }}>
          <Sparkles size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
          {t('about.tipsTitle')}
        </div>
        <ul
          style={{
            margin: 0,
            padding: '0 0 0 20px',
            fontSize: 12,
            color: token.colorTextSecondary,
            lineHeight: 1.8,
          }}
        >
          <li>{t('about.tip1')}</li>
          <li>{t('about.tip2')}</li>
          <li>{t('about.tip3')}</li>
          <li>{t('about.tip4')}</li>
        </ul>
      </div>

      <Divider style={{ margin: '8px 0' }} />

      {/* Section 4 —— 反馈与开源 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>
          {t('about.supportTitle')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button
            icon={<Code2 size={14} />}
            onClick={() => {
              if (typeof chrome !== 'undefined' && chrome.tabs !== undefined) {
                void chrome.tabs.create({ url: BRAND.productUrl });
              } else {
                window.open(BRAND.productUrl, '_blank');
              }
            }}
          >
            {t('about.openSource')}
          </Button>
          <Button
            icon={<Mail size={14} />}
            onClick={() => {
              const url = `${BRAND.productUrl}/issues/new`;
              if (typeof chrome !== 'undefined' && chrome.tabs !== undefined) {
                void chrome.tabs.create({ url });
              } else {
                window.open(url, '_blank');
              }
            }}
          >
            {t('about.feedback')}
          </Button>
          <Button
            icon={<ExternalLink size={14} />}
            onClick={() => {
              const url = `${BRAND.productUrl}/blob/main/CHANGELOG.md`;
              if (typeof chrome !== 'undefined' && chrome.tabs !== undefined) {
                void chrome.tabs.create({ url });
              } else {
                window.open(url, '_blank');
              }
            }}
          >
            {t('about.changelog')}
          </Button>
        </div>
        <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 6 }}>
          {t('about.madeWith')} ❤️ · {t('about.privacyLocal')}
        </div>
      </div>
    </div>
  );
}
