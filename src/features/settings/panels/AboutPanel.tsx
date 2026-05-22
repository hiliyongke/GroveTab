/**
 * AboutPanel —— 产品介绍页（作为设置 Tab 渲染）
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
 *   1) SettingsPanel 的 "关于" Tab
 *   2) Popup 底部"关于"链接：打开新 Tab，URL hash #about，App 监听后自动打开设置面板并切到 about Tab
 */

import { Button, Divider } from 'antd';
import { cssVars } from '@/shared/utils/css-vars';
import {
  Package,
  Sparkles,
  Archive,
  Search as SearchIcon,
  BookmarkIcon,
  Palette,
  Code2,
  ExternalLink,
  Mail,
} from 'lucide-react';

import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useT } from '@/shared/i18n';
import { BRAND, getBrandDisplayName, getBrandSlogan } from '@/shared/config/brand';
import styles from './styles/about.module.less';

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
  { icon: Palette, titleKey: 'about.feature.skin.title', descKey: 'about.feature.skin.desc', color: '#9B8EC4' },
];

export function AboutPanel() {
  const { t, locale } = useT();
  const brandName = getBrandDisplayName(locale);
  const slogan = getBrandSlogan(locale);
  const heroStyle: React.CSSProperties = cssVars({
    '--about-hero-gradient': 'linear-gradient(135deg, var(--ant-color-bg-elevated) 0%, var(--ant-color-fill-quaternary) 100%)',
  });

  return (
    <div className={styles['about-panel settings-panel-stack']}>
      <section className="settings-section">
        <div className={styles['about-panel__hero']} style={heroStyle}>
        <div className={styles['about-panel__logo']}>{BRAND.shortName}</div>
        <div className={styles['about-panel__brand']}>{brandName}</div>
        <div className={styles['about-panel__slogan']}>「{slogan}」</div>
        <div className={styles['about-panel__version']}>v{PKG_VERSION}</div>
      </div>
      </section>

      <section className="settings-section">
        <div>
        <div className={styles['about-panel__section-title']}>{t('about.featuresTitle')}</div>
        <div className={styles['about-panel__feature-grid']}>
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            const featureStyle: React.CSSProperties = cssVars({
              '--about-feature-color': feature.color,
            });
            return (
              <div key={feature.titleKey} className={styles['about-panel__feature-card']}>
                <div className={styles['about-panel__feature-icon']} style={featureStyle}>
                  <Icon size={ICON_SIZE.LARGE} />
                </div>
                <div className={styles['about-panel__feature-copy']}>
                  <div className={styles['about-panel__feature-title']}>{t(feature.titleKey)}</div>
                  <div className={styles['about-panel__feature-desc']}>{t(feature.descKey)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </section>

      <section className="settings-section">
        <div>
        <div className={styles['about-panel__tips-title']}>
          <Sparkles size={ICON_SIZE.MEDIUM} />
          {t('about.tipsTitle')}
        </div>
        <ul className={styles['about-panel__tips-list']}>
          <li>{t('about.tip1')}</li>
          <li>{t('about.tip2')}</li>
          <li>{t('about.tip3')}</li>
          <li>{t('about.tip4')}</li>
        </ul>
      </div>
      </section>

      <Divider className={styles['about-panel__divider']} />

      <section className="settings-section">
        <div className={styles['about-panel__support']}>
        <div className={styles['about-panel__support-title']}>{t('about.supportTitle')}</div>
        <div className={styles['about-panel__support-actions']}>
          <Button
            icon={<Code2 size={ICON_SIZE.MEDIUM} />}
            onClick={() => {
              if (typeof chrome !== 'undefined' && chrome.tabs !== undefined) {
                void chrome.tabs.create({ url: BRAND.productUrl });
              } else {
                window.open(BRAND.productUrl, '_blank', 'noopener,noreferrer');
              }
            }}
          >
            {t('about.openSource')}
          </Button>
          <Button
            icon={<Mail size={ICON_SIZE.MEDIUM} />}
            onClick={() => {
              const url = `${BRAND.productUrl}/issues/new`;
              if (typeof chrome !== 'undefined' && chrome.tabs !== undefined) {
                void chrome.tabs.create({ url });
              } else {
                window.open(url, '_blank', 'noopener,noreferrer');
              }
            }}
          >
            {t('about.feedback')}
          </Button>
          <Button
            icon={<ExternalLink size={ICON_SIZE.MEDIUM} />}
            onClick={() => {
              const url = `${BRAND.productUrl}/blob/main/CHANGELOG.md`;
              if (typeof chrome !== 'undefined' && chrome.tabs !== undefined) {
                void chrome.tabs.create({ url });
              } else {
                window.open(url, '_blank', 'noopener,noreferrer');
              }
            }}
          >
            {t('about.changelog')}
          </Button>
        </div>
        <div className={styles['about-panel__support-copy']}>{t('about.madeWith')} ❤️ · {t('about.privacyLocal')}</div>
      </div>
      </section>
    </div>
  );
}
