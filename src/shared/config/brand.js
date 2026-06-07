/**
 * Brand / Product Identity — 产品身份配置层
 * @i18n-noscan
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
/**
 * 内置品牌预设集合。
 *
 * 如果未来衍生新产品，只需在此添加一项预设并切换 `ACTIVE_BRAND_ID` 即可；
 * 整个仓库的所有 UI 文案/Logo 会自动跟随。
 */
const BRAND_PRESETS = {
    groveTab: {
        id: 'groveTab',
        name: 'GroveTab',
        shortName: 'G',
        localizedName: {
            'zh-CN': '林栖标签页',
            en: 'GroveTab',
        },
        slogan: {
            'zh-CN': '你的标签页，找到归属',
            en: 'Where your tabs find their place.',
        },
        tagline: {
            'zh-CN': 'GroveTab — 轻盈的标签工作台',
            en: 'GroveTab — a breezy workspace for your tabs.',
        },
        description: {
            'zh-CN': 'GroveTab — 你的标签页，找到归属。按域名自动分组、秒搜、归档、隐私全本地。',
            en: 'GroveTab — where your tabs find their place. Auto-grouping, instant search, archive & 100% local.',
        },
        accentColor: '#1677ff',
        accentColorEnd: '#4096ff',
        productUrl: 'https://github.com/hiliyongke/GroveTab',
        logTag: '[GroveTab]',
        storagePrefix: 'canopy_',
    },
};
/**
 * 当前启用的品牌 ID。切换此值即可在编译期切换整个产品身份。
 *
 * 可以通过环境变量 `VITE_BRAND` 在构建时覆盖，如：
 *   VITE_BRAND=groveTab pnpm build
 * 未配置时回退到默认 preset。
 */
const ACTIVE_BRAND_ID = (() => {
    const fromEnv = typeof import.meta !== 'undefined'
        ? import.meta.env?.VITE_BRAND
        : undefined;
    if (fromEnv !== undefined && fromEnv !== '' && BRAND_PRESETS[fromEnv] !== undefined) {
        return fromEnv;
    }
    return 'groveTab';
})();
/**
 * 全局单例品牌对象。
 *
 * 上层任何位置只需 `import { BRAND } from '@/shared/config/brand'` 即可拿到；
 * 不要在运行时试图修改它——品牌身份在进程生命周期内是不可变的。
 */
export const BRAND = Object.freeze(BRAND_PRESETS[ACTIVE_BRAND_ID]);
/**
 * 语言相关的品牌文案解析辅助：从多语言字段中取出当前语言版本。
 *
 * 之所以不用 i18n `t()`——本模块要在 i18n 初始化前也可用（例如
 * `ErrorBoundary` 的 fallback 文案），因此自带轻量回退链。
 */
export function pickLocaleField(field, locale, fallback = 'en') {
    if (field[locale] !== undefined)
        return field[locale];
    if (field[fallback] !== undefined)
        return field[fallback];
    // 最后兜底：返回字段中第一个可用的值
    const first = Object.values(field)[0];
    return first ?? '';
}
/**
 * 便捷：按 locale 取当前品牌的本地化名。
 * 英文环境只返回 `BRAND.name`；其它语言若有 `localizedName[locale]` 则取之。
 */
export function getBrandDisplayName(locale) {
    if (locale === 'en')
        return BRAND.name;
    const localized = BRAND.localizedName?.[locale];
    return (localized !== undefined && localized !== '') ? localized : BRAND.name;
}
/**
 * 便捷：按 locale 取当前品牌的 slogan。
 */
export function getBrandSlogan(locale) {
    return pickLocaleField(BRAND.slogan, locale);
}
/**
 * 便捷：按 locale 取当前品牌的 tagline。
 */
export function getBrandTagline(locale) {
    return pickLocaleField(BRAND.tagline, locale);
}
