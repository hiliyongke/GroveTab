/**
 * Stealth Mode Type Definitions
 * 偷摸模式配置类型
 */

/** 偷摸模式配置 */
export interface StealthModeConfig {
  /** 是否开启偷摸模式 */
  enabled: boolean;
  /** 伪装页面类型 */
  disguise: 'email' | 'doc' | 'spreadsheet' | 'code';
}
