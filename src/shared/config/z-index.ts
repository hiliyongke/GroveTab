/**
 * z-index 层级常量 —— 统一管理全局层叠顺序
 *
 * 层级规范（由低到高）：
 *   -1    视频背景（VideoBackground）
 *    1    内容区 / 噪点纹理
 *   20    Header 吸顶
 *   50    点击动效 Canvas（pointer-events:none）
 *  100    批量操作栏（BatchActionBar）
 * 1000    antd Modal / Drawer 默认层级
 * 1050    右键菜单（TabContextMenu）
 * 1100    UndoToast
 */
export const Z = {
  /** 视频背景层 */
  videoBg: -1,
  /** 内容区 / 噪点纹理 */
  content: 1,
  /** Header 吸顶 */
  header: 20,
  /** 点击动效 Canvas（pointer-events:none） */
  clickEffect: 50,
  /** 批量操作栏 */
  batchBar: 100,
  /** antd Modal / Drawer 默认层级 */
  modal: 1000,
  /** 右键菜单 */
  contextMenu: 1050,
  /** UndoToast */
  undoToast: 1100,
} as const;
