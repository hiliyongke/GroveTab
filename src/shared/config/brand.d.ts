/**
 * Brand / Product Identity — 产品身份配置层
 *
 * 本模块将所有与「品牌」相关的硬编码文案/Logo/主色/URL 抽象为一份可配置的
 * 数据包 `BrandIdentity`，上层 UI、manifest 生成、日志前缀、SW 通知、
 * CHANGELOG 等一律通过 `BRAND` 常量消费。
 *
 * 设计动机：
 *   - 当前产品线未正式发布，后续可能衍生多个产品（企业定制/白标/子品牌）。
 *     把「名称 / Slogan / Logo / 主色 / URL」集中到一个入口，后续衍生
 *     只需切换 active preset（或覆盖字段），而不用 sed 全仓替换。
 *   - 与 `skin-presets` 分层：皮肤（视觉主题）与品牌（身份）彼此正交——
 *     同一品牌可以套多套皮肤；同一皮肤也可以服务多个品牌。
 *
 * 约束：
 *   - 本文件零副作用、零外部依赖，纯数据 + 类型；任何地方 `import { BRAND }`
 *     都必须在模块初始化阶段完成，不得用异步替换。
 *   - 存储键名（canopy_*）不在本文件中暴露；那是向下兼容用的历史常量，
 *     位于 `storage-repo.ts`，改动会破坏老用户数据。
 */
/** 品牌身份数据包 */
export interface BrandIdentity {
    /** 内部 ID，用于切换、埋点分流；不展示给用户 */
    id: string;
    /**
     * 用户可见的产品名（英文或品牌官方书写名）。
     * 出现场景：manifest 名称、Header 品牌字、Modal 标题等。
     */
    name: string;
    /**
     * 简短产品名缩写（1-3 字母或单字），用于 16px 小 logo 徽标。
     * 如果品牌名是中文，可填中文单字；英文品牌填首字母。
     */
    shortName: string;
    /**
     * 国际化副名——当 UI 语言为非英文时可追加显示的本地化名。
     * 例：zh-CN 下 `林栖标签页`，de 下可加德语名；英文环境下不展示。
     */
    localizedName?: Record<string, string>;
    /**
     * 极简口号（Slogan），展示在 HeroBar 品牌下方，12-16 字以内最佳。
     * 支持多语言。
     */
    slogan: Record<string, string>;
    /**
     * 更长的产品副标题（Tagline），用于设置页、商店描述等较长展示位。
     */
    tagline: Record<string, string>;
    /**
     * 一句话产品描述，用于 manifest 的 `description`。
     */
    description: Record<string, string>;
    /**
     * 品牌主色（HEX），供 Logo 背景渐变起点、默认 accent 使用。
     * 皮肤预设可以覆盖 antd 的 `colorPrimary`，但 Logo 字色固定走这里。
     */
    accentColor: string;
    /**
     * Logo 渐变终点色；与 accentColor 一起构成线性渐变。
     */
    accentColorEnd: string;
    /**
     * 产品官网（或 docs / github 首页），用于 About 面板、Onboarding 链接。
     */
    productUrl: string;
    /**
     * 隐私政策页；留空则指向扩展内置的 PRIVACY.md。
     */
    privacyUrl?: string;
    /**
     * 日志前缀，如 `[GroveTab SW]`。
     * Service Worker / feedback / ErrorBoundary 统一消费此字段。
     */
    logTag: string;
    /**
     * 存储键名前缀——**仅在新建键时使用**。
     * 老键（canopy_*）通过 `storage-repo.ts` 的迁移层向下兼容，不要改。
     */
    storagePrefix: string;
}
/**
 * 全局单例品牌对象。
 *
 * 上层任何位置只需 `import { BRAND } from '@/shared/config/brand'` 即可拿到；
 * 不要在运行时试图修改它——品牌身份在进程生命周期内是不可变的。
 */
export declare const BRAND: BrandIdentity;
/**
 * 语言相关的品牌文案解析辅助：从多语言字段中取出当前语言版本。
 *
 * 之所以不用 i18n `t()`——本模块要在 i18n 初始化前也可用（例如
 * `ErrorBoundary` 的 fallback 文案），因此自带轻量回退链。
 *
 * @param field 多语言字段（如 `BRAND.slogan`）
 * @param locale 目标语言（如 'zh-CN'、'en'）
 * @param fallback 回退文案（可选）
 * @returns 当前语言的文案字符串
 */
export declare function pickLocaleField(field: Record<string, string>, locale: string, fallback?: string): string;
/**
 * 便捷：按 locale 取当前品牌的本地化名。
 *
 * 英文环境只返回 `BRAND.name`；其它语言若有 `localizedName[locale]` 则取之。
 *
 * @param locale 目标语言（如 'zh-CN'、'en'）
 * @returns 本地化的品牌显示名
 */
export declare function getBrandDisplayName(locale: string): string;
/**
 * 便捷：按 locale 取当前品牌的 slogan。
 *
 * @param locale 目标语言（如 'zh-CN'、'en'）
 * @returns 当前语言的品牌 slogan
 */
export declare function getBrandSlogan(locale: string): string;
/**
 * 便捷：按 locale 取当前品牌的 tagline。
 *
 * @param locale 目标语言（如 'zh-CN'、'en'）
 * @returns 当前语言的品牌 tagline
 */
export declare function getBrandTagline(locale: string): string;
