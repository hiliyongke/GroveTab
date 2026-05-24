/**
 * URL metadata key 归一化工具
 *
 * 统一 metadata store（tags / notes / pins）与搜索模块对 URL 的归一化逻辑，
 * 确保两边对同一条 URL 的 key 计算完全一致。
 *
 * 实现委托给 @/shared/utils/url 中的统一 normalizeMetadataKey。
 */

export { normalizeMetadataKey } from "@/shared/utils/url";
