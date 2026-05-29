/**
 * PanZoom 容器
 *
 * 提供画布缩放、平移、适应屏幕等功能
 */

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Button, Divider } from "antd";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from "lucide-react";
import { useT } from "@/shared/i18n";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import type { PanZoomHandle } from "../hooks/use-center-on-expand";
import styles from "../styles/bookmark-tree.module.less";

/** 缩放/平移参数 */
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

interface PanZoomProps {
  children: React.ReactNode;
  /** 工具栏右侧追加的额外按钮（如"显示域名"开关） */
  extraToolbar?: React.ReactNode;
  /** 布局方向：决定初始定位策略 */
  orientation?: "horizontal" | "vertical";
}

/**
 * 是否点在「可交互节点」上（避免误触发拖拽）
 */
function isOnInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(
    ".app-bm-tree__folder, .app-bm-tree__leaf, .app-bm-tree__panzoom-toolbar",
  );
}

export const PanZoom = forwardRef<PanZoomHandle, PanZoomProps>(function PanZoom(
  { children, extraToolbar, orientation = "horizontal" },
  ref,
) {
  const { t } = useT();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const draggingRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const clampScale = useCallback((s: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s)), []);

  /** 在视口某点（vx, vy 相对 viewport 左上）锚定缩放 */
  const zoomAt = useCallback(
    (nextScale: number, vx: number, vy: number) => {
      setScale((prev) => {
        const ns = clampScale(nextScale);
        if (ns === prev) return prev;
        // 保持鼠标下方的内容点不动：tx' = vx - (vx - tx) * ns/prev
        setTx((prevTx) => vx - ((vx - prevTx) * ns) / prev);
        setTy((prevTy) => vy - ((vy - prevTy) * ns) / prev);
        return ns;
      });
    },
    [clampScale],
  );

  /** 滚轮缩放 - React onWheel 事件处理 */
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const vx = e.clientX - rect.left;
      const vy = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setScale((prev) => {
        const ns = clampScale(prev * factor);
        if (ns === prev) return prev;
        setTx((prevTx) => vx - ((vx - prevTx) * ns) / prev);
        setTy((prevTy) => vy - ((vy - prevTy) * ns) / prev);
        return ns;
      });
    },
    [clampScale],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (isOnInteractive(e.target)) return;
      draggingRef.current = { x: e.clientX, y: e.clientY, tx, ty };
      setIsDragging(true);
    },
    [tx, ty],
  );

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const d = draggingRef.current;
      if (!d) return;
      setTx(d.tx + (e.clientX - d.x));
      setTy(d.ty + (e.clientY - d.y));
    };
    const onUp = () => {
      draggingRef.current = null;
      setIsDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  /** 适应屏幕：按内容 bounding box 缩放并居中 */
  const fit = useCallback(() => {
    const vp = viewportRef.current;
    const ct = contentRef.current;
    if (!vp || !ct) return;
    const cw = ct.scrollWidth;
    const ch = ct.scrollHeight;
    if (cw === 0 || ch === 0) return;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const padding = 32;
    const ns = clampScale(Math.min((vw - padding * 2) / cw, (vh - padding * 2) / ch, 1));
    setIsAnimating(true);
    setScale(ns);
    setTx((vw - cw * ns) / 2);
    // vertical（架构图）：根节点偏上约 28%，子树向下铺开自然进入视野
    // horizontal（脑图）：双向居中
    setTy(orientation === "vertical" ? Math.max(24, vh * 0.28 - 60) : (vh - ch * ns) / 2);
    window.setTimeout(() => setIsAnimating(false), 260);
  }, [clampScale, orientation]);

  const reset = useCallback(() => {
    setIsAnimating(true);
    setScale(1);
    setTx(0);
    setTy(0);
    window.setTimeout(() => setIsAnimating(false), 260);
  }, []);

  /**
   * 平滑把目标元素居中到视口中央
   */
  const panToElement = useCallback((el: HTMLElement) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const vpRect = vp.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const elCx = elRect.left - vpRect.left + elRect.width / 2;
    const elCy = elRect.top - vpRect.top + elRect.height / 2;
    const vCx = vpRect.width / 2;
    // 略微偏上：让展开后向下铺开的子树自然进入视野
    const vCy = vpRect.height * 0.32;
    setIsAnimating(true);
    setTx((prev) => prev + (vCx - elCx));
    setTy((prev) => prev + (vCy - elCy));
    window.setTimeout(() => setIsAnimating(false), 260);
  }, []);

  useImperativeHandle(ref, () => ({ panToElement }), [panToElement]);

  /** 初始定位 */
  const initialPositionedRef = useRef(false);
  const tryInitialPosition = useCallback(() => {
    if (initialPositionedRef.current) return;
    fit();
    initialPositionedRef.current = true;
  }, [fit]);

  useLayoutEffect(() => {
    tryInitialPosition();
  }, [tryInitialPosition]);

  /** 兜底：viewport 尺寸变化时重试初始定位 */
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      fit();
    });
    ro.observe(vp);
    return () => ro.disconnect();
  }, [fit]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isOnInteractive(e.target)) return;
      reset();
    },
    [reset],
  );

  /** 阻止滚轮事件被 viewport 自身吞掉 */
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const listener = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const vx = e.clientX - rect.left;
      const vy = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setScale((prev) => {
        const ns = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev * factor));
        if (ns === prev) return prev;
        setTx((prevTx) => vx - ((vx - prevTx) * ns) / prev);
        setTy((prevTy) => vy - ((vy - prevTy) * ns) / prev);
        return ns;
      });
    };
    vp.addEventListener("wheel", listener, { passive: false });
    return () => vp.removeEventListener("wheel", listener);
  }, []);

  const zoomPercent = Math.round(scale * 100);

  return (
    <div
      ref={viewportRef}
      className={`app-bm-tree__panzoom${isDragging ? " is-dragging" : ""}${isAnimating ? " is-animating" : ""}`}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
    >
      <div
        ref={contentRef}
        className="app-bm-tree__panzoom-content"
        data-tx={tx}
        data-ty={ty}
        data-scale={scale}
      >
        {children}
      </div>

      <div
        className="app-bm-tree__panzoom-toolbar"
        role="toolbar"
        aria-label={t("画布缩放")}
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <Button
          type="text"
          size="small"
          className={styles["app-bm-tree__panzoom-btn"]}
          onClick={() => {
            const vp = viewportRef.current;
            if (!vp) return;
            const rect = vp.getBoundingClientRect();
            zoomAt(scale - ZOOM_STEP, rect.width / 2, rect.height / 2);
          }}
          title={t("缩小")}
          aria-label={t("缩小")}
          disabled={scale <= ZOOM_MIN + 1e-3}
        >
          <ZoomOut size={ICON_SIZE.SMALL} />
        </Button>
        <Button
          type="text"
          size="small"
          className={styles["app-bm-tree__panzoom-percent"]}
          onClick={reset}
          title={t("重置缩放")}
          aria-label={t("重置缩放")}
        >
          {zoomPercent}%
        </Button>
        <Button
          type="text"
          size="small"
          className={styles["app-bm-tree__panzoom-btn"]}
          onClick={() => {
            const vp = viewportRef.current;
            if (!vp) return;
            const rect = vp.getBoundingClientRect();
            zoomAt(scale + ZOOM_STEP, rect.width / 2, rect.height / 2);
          }}
          title={t("放大")}
          aria-label={t("放大")}
          disabled={scale >= ZOOM_MAX - 1e-3}
        >
          <ZoomIn size={ICON_SIZE.SMALL} />
        </Button>
        <Divider
          orientation="vertical"
          className={styles["app-bm-tree__panzoom-divider"]}
          aria-hidden="true"
        />
        <Button
          type="text"
          size="small"
          className={styles["app-bm-tree__panzoom-btn"]}
          onClick={fit}
          title={t("适应画布")}
          aria-label={t("适应画布")}
        >
          <Maximize2 size={ICON_SIZE.SMALL} />
        </Button>
        <Button
          type="text"
          size="small"
          className={styles["app-bm-tree__panzoom-btn"]}
          onClick={reset}
          title={t("重置缩放")}
          aria-label={t("重置缩放")}
        >
          <RotateCcw size={ICON_SIZE.SMALL} />
        </Button>
        {extraToolbar && (
          <>
            <Divider type="vertical" className="app-bm-tree__panzoom-divider" aria-hidden="true" />
            {extraToolbar}
          </>
        )}
      </div>
    </div>
  );
});
