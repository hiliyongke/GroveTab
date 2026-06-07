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

import { useMemo } from "react";
import { Button, Divider, Flex, List, Typography } from "antd";
import { cssVars } from "@/shared/utils/css-vars";
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
} from "lucide-react";

import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { BRAND, getBrandDisplayName, getBrandSlogan } from "@/shared/config/brand";
import styles from "./styles/about.module.less";

const PKG_VERSION = (() => {
  try {
    const manifest =
      typeof chrome !== "undefined" && typeof chrome.runtime?.getManifest === "function"
        ? chrome.runtime.getManifest()
        : null;
    return manifest?.version ?? "1.2.0";
  } catch {
    return "1.2.0";
  }
})();

interface FeatureCard {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  desc: string;
  color: string;
}

export function AboutPanel() {
  const { t, locale } = useT();
  const brandName = getBrandDisplayName(locale);
  const slogan = getBrandSlogan(locale);

  const features: FeatureCard[] = useMemo(
    () => [
      { icon: Package, title: t("多工作区管理"), desc: t("按项目、场景创建灵活工作区，一键切换和恢复所需标签组合"), color: "#0EA5E9" },
      { icon: Archive, title: t("智能归档"), desc: t("自动保存会话快照，支持定时归档、手动归档和跨设备恢复"), color: "#F59E0B" },
      { icon: SearchIcon, title: t("全局搜索"), desc: t("实时搜索所有标签页、书签和浏览历史，支持多引擎切换"), color: "#8B5CF6" },
      { icon: BookmarkIcon, title: t("书签管理"), desc: t("树形管理书签，支持拖拽、批量导入、文件夹嵌套和隐私密码锁"), color: "#10B981" },
      { icon: Palette, title: t("主题皮肤"), desc: t("内置多款高质量皮肤，支持毛玻璃、暗色模式、自定义配色和设计 Token"), color: "#9B8EC4" },
    ],
    [t],
  );
  const heroStyle: React.CSSProperties = cssVars({
    "--about-hero-gradient":
      "linear-gradient(135deg, var(--ant-color-bg-elevated) 0%, var(--ant-color-fill-quaternary) 100%)",
  });

  return (
    <Flex vertical className={`${styles["about-panel"]} settings-panel-stack`}>
      <section className="settings-section">
        <Flex vertical align="center" className={styles["about-panel__hero"]} style={heroStyle}>
          <Flex align="center" justify="center" className={styles["about-panel__logo"]}>
            {BRAND.shortName}
          </Flex>
          <Typography.Title level={3} className={styles["about-panel__brand"]}>
            {brandName}
          </Typography.Title>
          <Typography.Text className={styles["about-panel__slogan"]}>「{slogan}」</Typography.Text>
          <Typography.Text className={styles["about-panel__version"]}>
            v{PKG_VERSION}
          </Typography.Text>
        </Flex>
      </section>

      <section className="settings-section">
        <Flex vertical>
          <Typography.Title level={4} className={styles["about-panel__section-title"]}>
            {t("核心能力")}
          </Typography.Title>
          <div className={styles["about-panel__feature-grid"]}>
            {features.map((feature) => {
              const Icon = feature.icon;
              const featureStyle: React.CSSProperties = cssVars({
                "--about-feature-color": feature.color,
              });
              return (
                <Flex key={feature.title} className={styles["about-panel__feature-card"]}>
                  <Flex
                    align="center"
                    justify="center"
                    className={styles["about-panel__feature-icon"]}
                    style={featureStyle}
                  >
                    <Icon size={ICON_SIZE.LARGE} />
                  </Flex>
                  <Flex vertical className={styles["about-panel__feature-copy"]}>
                    <Typography.Text className={styles["about-panel__feature-title"]}>
                      {feature.title}
                    </Typography.Text>
                    <Typography.Text className={styles["about-panel__feature-desc"]}>
                      {feature.desc}
                    </Typography.Text>
                  </Flex>
                </Flex>
              );
            })}
          </div>
        </Flex>
      </section>

      <section className="settings-section">
        <Flex vertical>
          <Flex align="center" className={styles["about-panel__tips-title"]}>
            <Sparkles size={ICON_SIZE.MEDIUM} />
            {t("使用小贴士")}
          </Flex>
          <List
            className={styles["about-panel__tips-list"]}
            dataSource={[
              t("⌘/Ctrl + K 呼出搜索；再按一次关闭；Cmd + 1..9 切换搜索引擎。"),
              t("在「数据」Tab 可以一键恢复默认配置 / 重播引导 / 全量重置。"),
              t("右键点击标签页可以快速归档、固定或添加书签。"),
              t("在「外观」Tab 可以尝试极客模式定制圆角、字号、主色等细节。"),
            ]}
            renderItem={(item) => (
              <List.Item className={styles["about-panel__tip-item"]}>{item}</List.Item>
            )}
          />
        </Flex>
      </section>

      <Divider className={styles["about-panel__divider"]} />

      <section className="settings-section">
        <Flex vertical className={styles["about-panel__support"]}>
          <Typography.Title level={4} className={styles["about-panel__support-title"]}>
            {t("反馈与开源")}
          </Typography.Title>
          <Flex wrap="wrap" className={styles["about-panel__support-actions"]}>
            <Button
              icon={<Code2 size={ICON_SIZE.MEDIUM} />}
              onClick={() => {
                if (typeof chrome !== "undefined" && chrome.tabs !== undefined) {
                  void chrome.tabs.create({ url: BRAND.productUrl });
                } else {
                  window.open(BRAND.productUrl, "_blank", "noopener,noreferrer");
                }
              }}
            >
              {t("开源地址")}
            </Button>
            <Button
              icon={<Mail size={ICON_SIZE.MEDIUM} />}
              onClick={() => {
                const url = `${BRAND.productUrl}/issues/new`;
                if (typeof chrome !== "undefined" && chrome.tabs !== undefined) {
                  void chrome.tabs.create({ url });
                } else {
                  window.open(url, "_blank", "noopener,noreferrer");
                }
              }}
            >
              {t("问题反馈")}
            </Button>
            <Button
              icon={<ExternalLink size={ICON_SIZE.MEDIUM} />}
              onClick={() => {
                const url = `${BRAND.productUrl}/blob/main/CHANGELOG.md`;
                if (typeof chrome !== "undefined" && chrome.tabs !== undefined) {
                  void chrome.tabs.create({ url });
                } else {
                  window.open(url, "_blank", "noopener,noreferrer");
                }
              }}
            >
              {t("更新日志")}
            </Button>
          </Flex>
          <Typography.Text className={styles["about-panel__support-copy"]}>
            {t("Made with")} ❤️ · {t("100% 本地优先 · 零数据上传")}
          </Typography.Text>
        </Flex>
      </section>
    </Flex>
  );
}
