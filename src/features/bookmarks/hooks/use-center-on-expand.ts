/**
 * 展开后居中功能 Hook
 *
 * 把"展开后居中"能力下发到子节点
 */

import { useCallback, createContext, useRef } from "react";

/** 居中函数类型 */
export type CenterFn = (el: HTMLElement) => void;

/** 上下文：把"展开后居中"能力下发到子节点 */
export const CenterOnExpandContext = createContext<CenterFn | null>(null);

/** PanZoom 暴露给父组件的 imperative API */
export interface PanZoomHandle {
  panToElement: (el: HTMLElement) => void;
}

export function useCenterOnExpand(): {
  panZoomRef: React.RefObject<PanZoomHandle | null>;
  centerOnExpand: CenterFn;
} {
  const panZoomRef = useRef<PanZoomHandle | null>(null);

  const centerOnExpand = useCallback<CenterFn>((el) => {
    panZoomRef.current?.panToElement(el);
  }, []);

  return { panZoomRef, centerOnExpand };
}
