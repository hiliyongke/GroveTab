/**
 * BookmarkTreeView — 书签树状视图
 *
 * 支持两种排布方向：
 *   - horizontal（脑图/思维导图风格）：根在左，子节点向右逐级展开
 *   - vertical  （组织架构图风格）  ：根在上，子节点向下逐级展开
 *
 * 设计要点：
 *   - 父子节点之间用 SVG 贝塞尔曲线连接，柔和过渡
 *   - 文件夹节点可点击折叠/展开，默认仅展开第一层
 *   - 叶子（书签）节点复用 favicon + accent 色，点击直接打开
 *   - 纯 CSS/SVG 实现，不引入第三方依赖
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, createContext, useContext, forwardRef, useImperativeHandle } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, ZoomIn, ZoomOut, Maximize2, RotateCcw, Eye, EyeOff } from 'lucide-react';
import type { BookmarkNode } from '@/chrome/bookmarks';
import { getFaviconUrl } from '@/chrome';
import { useAccent } from '@/shared/hooks/use-accent';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useT } from '@/shared/i18n';
import styles from './styles/bookmark-tree.module.less';

/**
 * 从 URL 提取 hostname
 *
 * @param url - 待提取的 URL
 * @returns hostname 或原始 URL（解析失败时）
 */
function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * 取首字母作为 favicon 回退
 *
 * @param title - 书签标题
 * @param url - 书签 URL
 * @returns 首字母大写
 */
function getFallbackLetter(title: string, url: string): string {
  if (title) return title.charAt(0).toUpperCase();
  try {
    return new URL(url).hostname.charAt(0).toUpperCase();
  } catch {
    return '?';
  }
}

/**
 * 递归统计
 *
 * @param nodes - 书签节点数组
 * @returns 书签总数（非文件夹节点）
 */
function countBookmarks(nodes: BookmarkNode[] | undefined): number {
  if (!nodes) return 0;
  return nodes.reduce((sum, n) => {
    if (n.url) return sum + 1;
    return sum + countBookmarks(n.children);
  }, 0);
}

/** 树排布方向 */
export type TreeOrientation = 'horizontal' | 'vertical';

/** 偏好：是否在卡片中常驻显示 hostname（持久化到 localStorage） */
const SHOW_HOST_KEY = 'app:bookmark-tree:showHost';

/**
 * 读取是否显示 hostname 的偏好设置
 *
 * 从 localStorage 读取用户偏好（键：'app:bookmark-tree:showHost'）。
 *
 * @returns 是否显示 hostname
 */
function readShowHost(): boolean {
  try {
    return localStorage.getItem(SHOW_HOST_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * 写入是否显示 hostname 的偏好设置
 *
 * 将用户偏好持久化到 localStorage（键：'app:bookmark-tree:showHost'）。
 *
 * @param v - 是否显示 hostname
 * @returns void
 */
function writeShowHost(v: boolean) {
  try {
    localStorage.setItem(SHOW_HOST_KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** 上下文：是否显示 hostname */
const ShowHostContext = createContext<boolean>(false);

/** 上下文：把"展开后居中"能力下发到子节点 */
type CenterFn = (el: HTMLElement) => void;
const CenterOnExpandContext = createContext<CenterFn | null>(null);

/**
 * 叶子节点（书签卡片）
 *
 * 渲染单个书签节点，包含 favicon、标题和 URL 提示。
 * 点击后在新标签页中打开书签。
 *
 * @param props - 组件属性
 * @param props.node - 书签节点
 * @param props.onOpen - 打开书签回调
 * @returns 叶子节点 JSX 元素
 */
function TreeLeafNode({
  node,
  onOpen,
}: {
  node: BookmarkNode;
  onOpen: (url: string) => void;
}) {
  const url = node.url ?? '';
  const hostname = getHostname(url);
  const faviconUrl = getFaviconUrl(url);
  const accent = useAccent(faviconUrl || undefined, hostname);
  const [faviconError, setFaviconError] = useState(false);
  const showHost = useContext(ShowHostContext);

  const titleText = node.title || hostname;

  return (
    <div
      className={`app-bm-tree__leaf ${styles['app-bm-tree__leaf']}`}
      style={{ '--app-bm-accent': accent.bar } as React.CSSProperties}
      onClick={() => url && onOpen(url)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' && url) onOpen(url); }}
      data-url={url}
    >
      <span className={styles['app-bm-tree__leaf-bar']} />
      {faviconUrl && !faviconError ? (
        <img
          src={faviconUrl}
          alt=""
          className={styles['app-bm-tree__leaf-favicon']}
          onError={() => setFaviconError(true)}
        />
      ) : (
        <span
          className={styles['app-bm-tree__leaf-favicon-fallback']}
          style={{ background: accent.soft, color: accent.text }}
        >
          {getFallbackLetter(node.title ?? '', url)}
        </span>
      )}
      <div className={styles['app-bm-tree__leaf-main']}>
        <div className={styles['app-bm-tree__leaf-title']}>{titleText}</div>
        {showHost && <div className={styles['app-bm-tree__leaf-host']}>{hostname}</div>}
      </div>

      {/* 自定义 hover 气泡：显示标题 + 完整 URL（hostname 加粗高亮） */}
      <div className={styles['app-bm-tree__tooltip']} role="tooltip">
        <div className={styles['app-bm-tree__tooltip-title']}>{titleText}</div>
        <div className={styles['app-bm-tree__tooltip-url']}>
          <span className={styles['app-bm-tree__tooltip-host']}>{hostname}</span>
          <span className={styles['app-bm-tree__tooltip-path']}>{url.replace(/^https?:\/\/[^/]+/i, '') || '/'}</span>
        </div>
        <div className={styles['app-bm-tree__tooltip-arrow']} aria-hidden="true" />
      </div>
    </div>
  );
}

/**
 * 文件夹节点（可折叠/展开）
 *
 * 渲染文件夹节点，支持展开/折叠子节点。
 * - horizontal：自身在左，children 在右
 * - vertical  ：自身在上，children 在下
 *
 * @param props - 组件属性
 * @param props.folder - 文件夹节点
 * @param props.onOpenBookmark - 打开书签回调
 * @param props.resolveTitle - 解析标题函数
 * @param props.defaultExpanded - 默认是否展开
 * @param props.depth - 嵌套深度
 * @param props.orientation - 布局方向
 * @returns 文件夹节点 JSX 元素
 */
function TreeFolderNode({
  folder,
  onOpenBookmark,
  resolveTitle,
  defaultExpanded,
  depth,
  orientation,
}: {
  folder: BookmarkNode;
  onOpenBookmark: (url: string) => void;
  resolveTitle: (n: BookmarkNode) => string;
  defaultExpanded: boolean;
  depth: number;
  orientation: TreeOrientation;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const folderBtnRef = useRef<HTMLButtonElement | null>(null);
  const centerOnExpand = useContext(CenterOnExpandContext);
  const children = useMemo(() => folder.children ?? [], [folder.children]);
  const total = useMemo(() => countBookmarks(children), [children]);
  const folderCount = useMemo(() => children.filter((c) => !c.url).length, [children]);
  const linkCount = total;

  const title = resolveTitle(folder);
  const isEmpty = children.length === 0;

  // 排序：文件夹优先，然后是书签，保持 Chrome 默认顺序
  const orderedChildren = useMemo(() => {
    const folders = children.filter((c) => !c.url);
    const links = children.filter((c) => !!c.url);
    return [...folders, ...links];
  }, [children]);

  const handleToggle = useCallback(() => {
    if (isEmpty) return;
    setExpanded((prev) => {
      const next = !prev;
      // 仅在「即将展开」时把节点居中，避免折叠也跳动
      if (next && folderBtnRef.current && centerOnExpand) {
        // 等子树渲染后再居中，确保几何位置稳定
        requestAnimationFrame(() => {
          if (folderBtnRef.current) centerOnExpand(folderBtnRef.current);
        });
      }
      return next;
    });
  }, [isEmpty, centerOnExpand]);

  return (
    <div className={styles['app-bm-tree__folder-wrap']} data-depth={depth}>
      <button
        ref={folderBtnRef}
        type="button"
        className={`app-bm-tree__folder ${styles['app-bm-tree__folder']}${expanded ? ` ${styles['is-expanded']}` : ''}${isEmpty ? ` ${styles['is-empty']}` : ''}`}
        onClick={handleToggle}
        aria-expanded={expanded}
        title={title}
      >
        <span className={styles['app-bm-tree__folder-icon']}>
          {expanded ? <FolderOpen size={ICON_SIZE.SMALL} /> : <Folder size={ICON_SIZE.SMALL} />}
        </span>
        <span className={styles['app-bm-tree__folder-text']}>
          <span className={styles['app-bm-tree__folder-title']}>{title}</span>
          <span className={styles['app-bm-tree__folder-meta']}>
            {folderCount > 0 && <span className={styles['app-bm-tree__folder-stat']}>📁 {folderCount}</span>}
            {linkCount > 0 && <span className={styles['app-bm-tree__folder-stat']}>🔗 {linkCount}</span>}
            {isEmpty && <span className={`${styles['app-bm-tree__folder-stat']} ${styles['is-muted']}`}>空</span>}
          </span>
        </span>
        {!isEmpty && (
          orientation === 'horizontal' ? (
            <ChevronRight
              size={ICON_SIZE.SMALL}
              className={`${styles['app-bm-tree__folder-chevron']}${expanded ? ` ${styles['is-expanded']}` : ''}`}
            />
          ) : (
            <ChevronDown
              size={ICON_SIZE.SMALL}
              className={`${styles['app-bm-tree__folder-chevron']} ${styles['is-vertical']}${expanded ? ` ${styles['is-expanded']}` : ''}`}
            />
          )
        )}
      </button>
      {expanded && !isEmpty && (
        <div className={styles['app-bm-tree__children']} role="group">
          {/* 横向（脑图）模式：仍用 SVG 贝塞尔曲线；垂直（组织架构图）模式：用纯 CSS 伪元素绘制直角连线，永不错位 */}
          {orientation === 'horizontal' && (
            <svg
              className={styles['app-bm-tree__connector']}
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              {orderedChildren.map((_, idx) => {
                const childCount = orderedChildren.length;
                const cross = childCount === 1 ? 50 : (idx + 0.5) * (100 / childCount);
                const d = `M 0 50 C 50 50, 50 ${cross}, 100 ${cross}`;
                return (
                  <path
                    key={idx}
                    className={styles['app-bm-tree__connector-path']}
                    d={d}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
          )}

          <div
            className={`${styles['app-bm-tree__children-col']}${orderedChildren.length === 1 ? ` ${styles['is-single']}` : ''}`}
          >
            {orderedChildren.map((child) =>
              child.url ? (
                <TreeLeafNode key={child.id} node={child} onOpen={onOpenBookmark} />
              ) : (
                <TreeFolderNode
                  key={child.id}
                  folder={child}
                  onOpenBookmark={onOpenBookmark}
                  resolveTitle={resolveTitle}
                  defaultExpanded={false}
                  depth={depth + 1}
                  orientation={orientation}
                />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** 缩放/平移参数 */
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

/** PanZoom 暴露给父组件的 imperative API */
export interface PanZoomHandle {
  panToElement: (el: HTMLElement) => void;
}

/**
 * PanZoom 容器
 */
const PanZoom = forwardRef<PanZoomHandle, {
  children: React.ReactNode;
  /** 工具栏右侧追加的额外按钮（如"显示域名"开关） */
  extraToolbar?: React.ReactNode;
  /** 布局方向：决定初始定位策略 */
  orientation?: TreeOrientation;
}>(function PanZoom({ children, extraToolbar, orientation = 'horizontal' }, ref) {
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
  const zoomAt = useCallback((nextScale: number, vx: number, vy: number) => {
    setScale((prev) => {
      const ns = clampScale(nextScale);
      if (ns === prev) return prev;
      // 保持鼠标下方的内容点不动：tx' = vx - (vx - tx) * ns/prev
      setTx((prevTx) => vx - ((vx - prevTx) * ns) / prev);
      setTy((prevTy) => vy - ((vy - prevTy) * ns) / prev);
      return ns;
    });
  }, [clampScale]);

  /** 滚轮缩放 */
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // 只在持续按 Ctrl/Cmd 或非垂直滚动时缩放，避免误触；这里直接拦截所有滚轮以提供画布体验
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;
    // 触控板 deltaY 通常更小；统一按比例换算
    const factor = Math.exp(-e.deltaY * 0.0015);
    setScale((prev) => {
      const ns = clampScale(prev * factor);
      if (ns === prev) return prev;
      setTx((prevTx) => vx - ((vx - prevTx) * ns) / prev);
      setTy((prevTy) => vy - ((vy - prevTy) * ns) / prev);
      return ns;
    });
  }, [clampScale]);

  /** 是否点在「可交互节点」上（避免误触发拖拽） */
  const isOnInteractive = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return !!target.closest('.app-bm-tree__folder, .app-bm-tree__leaf, .app-bm-tree__panzoom-toolbar');
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (isOnInteractive(e.target)) return;
    draggingRef.current = { x: e.clientX, y: e.clientY, tx, ty };
    setIsDragging(true);
  }, [tx, ty, isOnInteractive]);

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
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  /** 适应屏幕：按内容 bounding box 缩放并居中 */
  const fit = useCallback(() => {
    const vp = viewportRef.current;
    const ct = contentRef.current;
    if (!vp || !ct) return;
    // 用未变换前的尺寸来计算
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
    setTy(orientation === 'vertical'
      ? Math.max(24, vh * 0.28 - 60)
      : (vh - ch * ns) / 2);
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
   * 思路：当前 transform = translate(tx, ty) scale(scale)
   * 元素相对 viewport 的 left/top = elRect - vpRect
   * 期望：元素中心 == viewport 中心
   *   newTx = tx + (vw/2 - (elLeft + elW/2))
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

  /**
   * 初始定位：内容首次拿到稳定的非零尺寸后，缩放并居中到视口。
   * 直接复用 fit() 逻辑：按内容 bounding box 缩放并居中。
   * 关键修复：
   *   1) 不再用 Math.max(0, ...) 限定 tx/ty，允许负值，确保「内容比画布大」时仍能居中
   *   2) useLayoutEffect 首次执行时 vw/vh 可能仍为 0（dvh/flex 链路尚未稳定），
   *      再用 ResizeObserver 监听 viewport 尺寸，等到真实尺寸就绪再补一次定位
   */
  const initialPositionedRef = useRef(false);
  const tryInitialPosition = useCallback(() => {
    if (initialPositionedRef.current) return;
    fit();
    initialPositionedRef.current = true;
  }, [fit]);

  useLayoutEffect(() => {
    tryInitialPosition();
  }, [tryInitialPosition]);

  /** 兜底：viewport 尺寸变化（首次从 0 变为真实值，或窗口尺寸变化）时重试初始定位 */
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      fit();
    });
    ro.observe(vp);
    return () => ro.disconnect();
  }, [tryInitialPosition]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isOnInteractive(e.target)) return;
    reset();
  }, [reset, isOnInteractive]);

  /** 阻止滚轮事件被 viewport 自身吞掉（React onWheel 在 passive: true 时 preventDefault 无效，这里手动绑非 passive） */
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
    vp.addEventListener('wheel', listener, { passive: false });
    return () => vp.removeEventListener('wheel', listener);
  }, []);

  const zoomPercent = Math.round(scale * 100);

  return (
    <div
      ref={viewportRef}
      className={`${styles['app-bm-tree__panzoom']}${isDragging ? ` ${styles['is-dragging']}` : ''}${isAnimating ? ` ${styles['is-animating']}` : ''}`}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      // onWheel 仍保留作为类型占位，真正绑定在 useEffect 中（非 passive）
      onWheel={handleWheel}
    >
      <div
        ref={contentRef}
        className={styles['app-bm-tree__panzoom-content']}
        style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
      >
        {children}
      </div>

      <div
        className={`app-bm-tree__panzoom-toolbar ${styles['app-bm-tree__panzoom-toolbar']}`}
        role="toolbar"
        aria-label={t('bookmark.tree.zoomToolbar')}
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles['app-bm-tree__panzoom-btn']}
          onClick={() => {
            const vp = viewportRef.current;
            if (!vp) return;
            const rect = vp.getBoundingClientRect();
            zoomAt(scale - ZOOM_STEP, rect.width / 2, rect.height / 2);
          }}
          title={t('bookmark.tree.zoomOut')}
          aria-label={t('bookmark.tree.zoomOut')}
          disabled={scale <= ZOOM_MIN + 1e-3}
        >
          <ZoomOut size={ICON_SIZE.SMALL} />
        </button>
        <button
          type="button"
          className={styles['app-bm-tree__panzoom-percent']}
          onClick={reset}
          title={t('bookmark.tree.resetZoom')}
          aria-label={t('bookmark.tree.resetZoom')}
        >
          {zoomPercent}%
        </button>
        <button
          type="button"
          className={styles['app-bm-tree__panzoom-btn']}
          onClick={() => {
            const vp = viewportRef.current;
            if (!vp) return;
            const rect = vp.getBoundingClientRect();
            zoomAt(scale + ZOOM_STEP, rect.width / 2, rect.height / 2);
          }}
          title={t('bookmark.tree.zoomIn')}
          aria-label={t('bookmark.tree.zoomIn')}
          disabled={scale >= ZOOM_MAX - 1e-3}
        >
          <ZoomIn size={ICON_SIZE.SMALL} />
        </button>
        <span className={styles['app-bm-tree__panzoom-divider']} aria-hidden="true" />
        <button
          type="button"
          className={styles['app-bm-tree__panzoom-btn']}
          onClick={fit}
          title={t('bookmark.tree.fitScreen')}
          aria-label={t('bookmark.tree.fitScreen')}
        >
          <Maximize2 size={ICON_SIZE.SMALL} />
        </button>
        <button
          type="button"
          className={styles['app-bm-tree__panzoom-btn']}
          onClick={reset}
          title={t('bookmark.tree.resetZoom')}
          aria-label={t('bookmark.tree.resetZoom')}
        >
          <RotateCcw size={ICON_SIZE.SMALL} />
        </button>
        {extraToolbar && (
          <>
            <span className={styles['app-bm-tree__panzoom-divider']} aria-hidden="true" />
            {extraToolbar}
          </>
        )}
      </div>
    </div>
  );
});

/**
 * 主组件：书签树
 *
 * 按文件夹层级展示书签，支持脑图和组织架构图两种布局。
 * - orientation='horizontal'：脑图风格，根在左，子节点向右展开
 * - orientation='vertical'  ：组织架构图风格，根在上，子节点向下展开
 *
 * @param props - 组件属性
 * @param props.topSections - 顶层文件夹节点数组
 * @param props.onOpenBookmark - 打开书签回调
 * @param props.resolveTitle - 解析标题函数
 * @param props.orientation - 布局方向（可选，默认 'horizontal'）
 * @returns 书签树视图 JSX 元素
 */
export function BookmarkTreeView({
  topSections,
  onOpenBookmark,
  resolveTitle,
  orientation = 'horizontal',
}: {
  topSections: BookmarkNode[];
  onOpenBookmark: (url: string) => void;
  resolveTitle: (n: BookmarkNode) => string;
  orientation?: TreeOrientation;
}) {
  const { t } = useT();
  const handleOpen = useCallback((url: string) => onOpenBookmark(url), [onOpenBookmark]);
  const panZoomRef = useRef<PanZoomHandle | null>(null);
  const [showHost, setShowHost] = useState<boolean>(() => readShowHost());

  const toggleShowHost = useCallback(() => {
    setShowHost((prev) => {
      const next = !prev;
      writeShowHost(next);
      return next;
    });
  }, []);

  const centerOnExpand = useCallback<CenterFn>((el) => {
    panZoomRef.current?.panToElement(el);
  }, []);

  const extraToolbar = (
    <button
      type="button"
      className={`${styles['app-bm-tree__panzoom-btn']}${showHost ? ` ${styles['is-active']}` : ''}`}
      onClick={toggleShowHost}
      title={showHost ? t('bookmark.tree.hideHost') : t('bookmark.tree.showHost')}
      aria-label={showHost ? t('bookmark.tree.hideHost') : t('bookmark.tree.showHost')}
      aria-pressed={showHost}
    >
      {showHost ? <Eye size={ICON_SIZE.SMALL} /> : <EyeOff size={ICON_SIZE.SMALL} />}
    </button>
  );

  return (
    <div className={`app-bm-tree ${styles['app-bm-tree']} ${styles[`is-${orientation}`]}${showHost ? ` ${styles['show-host']}` : ''}`}>
      <ShowHostContext.Provider value={showHost}>
        <CenterOnExpandContext.Provider value={centerOnExpand}>
          <PanZoom ref={panZoomRef} extraToolbar={extraToolbar} orientation={orientation}>
            <div className={styles['app-bm-tree__canvas']}>
              <div className={styles['app-bm-tree__roots']}>
                {topSections.map((section, idx) => (
                  <TreeFolderNode
                    key={section.id}
                    folder={section}
                    onOpenBookmark={handleOpen}
                    resolveTitle={resolveTitle}
                    defaultExpanded={idx === 0}
                    depth={0}
                    orientation={orientation}
                  />
                ))}
              </div>
            </div>
          </PanZoom>
        </CenterOnExpandContext.Provider>
      </ShowHostContext.Provider>
    </div>
  );
}
