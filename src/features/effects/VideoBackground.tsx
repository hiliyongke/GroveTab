/**
 * VideoBackground —— 动态视频背景组件
 *
 * 渲染：
 *   全屏 fixed <video>，autoplay muted loop playsinline；
 *   zIndex: -1（在 body 背景之上、内容之下）；
 *   opacity 由 backgroundOverlay 控制（不在本组件处理，保持职责单一）。
 *
 * 数据源：
 *   settings.videoBackground:
 *     { type: 'url', src: 'https://...' }
 *     { type: 'file', fileKey: 'v_xxx' } → 从 IndexedDB 读 Blob → objectURL
 *
 * 降级：
 *   - settings.reducedMotion=='on' 或系统 prefers-reduced-motion → 只展示第一帧（video.pause()）
 *   - loadVideoBlobUrl 失败（文件被外部清了）→ 静默降级为无视频
 *   - 标签不可见时（visibilitychange → hidden）pause 省电，回来时 play。
 */

import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/store';
import { loadVideoBlobUrl } from './video-storage';

export function VideoBackground() {
  const conf = useSettingsStore((s) => s.settings.videoBackground);
  const reducedMotion = useSettingsStore((s) => s.settings.reducedMotion) ?? 'auto';
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  const type = conf?.type ?? 'none';
  const rawSrc = conf?.src ?? '';
  const fileKey = conf?.fileKey ?? '';
  const playbackRate = conf?.playbackRate ?? 1;
  const muted = conf?.muted !== false;

  /**
   * 解析最终视频 URL：
   *   - url 模式：直接用 conf.src
   *   - file 模式：读 IndexedDB 取 Blob → URL.createObjectURL
   * 在组件卸载或切换源时 revoke 掉 blob URL，避免内存泄漏。
   */
  useEffect(() => {
    let blobUrl: string | null = null;
    let cancelled = false;

    const resolve = async () => {
      if (type === 'url' && rawSrc !== '') {
        setResolvedSrc(rawSrc);
        return;
      }
      if (type === 'file' && fileKey !== '') {
        const url = await loadVideoBlobUrl(fileKey);
        if (cancelled) return;
        if (url !== null) {
          blobUrl = url;
          setResolvedSrc(url);
        } else {
          setResolvedSrc(null);
        }
        return;
      }
      setResolvedSrc(null);
    };

    void resolve();

    return () => {
      cancelled = true;
      if (blobUrl !== null) URL.revokeObjectURL(blobUrl);
    };
  }, [type, rawSrc, fileKey]);

  /** 播放速率同步 */
  useEffect(() => {
    const v = videoRef.current;
    if (v === null) return;
    v.playbackRate = Math.min(Math.max(playbackRate, 0.25), 2);
  }, [playbackRate, resolvedSrc]);

  /** 后台自动暂停，前台恢复；prefers-reduced-motion 时强制暂停。 */
  useEffect(() => {
    const v = videoRef.current;
    if (v === null || resolvedSrc === null) return undefined;

    const systemReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shouldPause =
      reducedMotion === 'on' || (reducedMotion === 'auto' && systemReduced);

    const onVis = () => {
      if (document.hidden || shouldPause) {
        v.pause();
      } else {
        void v.play().catch(() => {
          // autoplay 拒绝：用户未交互过，不打扰
        });
      }
    };
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [resolvedSrc, reducedMotion]);

  if (type === 'none' || resolvedSrc === null) return null;

  return (
    <video
      ref={videoRef}
      src={resolvedSrc}
      autoPlay
      loop
      muted={muted}
      playsInline
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        objectFit: 'cover',
        zIndex: -1,
        pointerEvents: 'none',
        /** 视频初始黑屏时，不要让它把下方渐变色背景也遮掉 */
        background: 'transparent',
      }}
    />
  );
}
