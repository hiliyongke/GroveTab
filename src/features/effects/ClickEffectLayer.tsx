/**
 * ClickEffectLayer —— 全屏点击动效图层
 *
 * 设计要点：
 *   1. 全屏 position:fixed Canvas2D，pointer-events:none 不挡 UI；
 *   2. 监听 window 'click' 事件（capture=true，避免被业务 stopPropagation 吞掉）；
 *   3. 粒子系统：每次点击生成 4~20 个粒子，生命周期 500~900ms；
 *   4. rAF 驱动；无粒子时停止 rAF，占用接近 0；
 *   5. prefers-reduced-motion 或 settings.reducedMotion=='on' 时禁用；
 *   6. 5 套预设效果：ripple / sparkle / confetti / petal / off。
 *
 * 性能：
 *   - 同时存活粒子上限 150（超出裁剪最老），避免连续点击堆积。
 *   - DPR 感知：window.devicePixelRatio 适配高清屏，无锯齿。
 *   - gzipped 约 2.5KB，进 feat-effects chunk，默认 off 不参与首屏。
 */

import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/store';
import './effects.css';

/** 点击动效类型 */
export type ClickEffectType = 'off' | 'ripple' | 'sparkle' | 'confetti' | 'petal';

/** 单个粒子 */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 剩余寿命（ms） */
  life: number;
  /** 总寿命（ms），用于归一化透明度 */
  max: number;
  /** 类型相关参数 */
  size: number;
  color: string;
  /** petal 专用：旋转角度 */
  rot?: number;
  vrot?: number;
}

const MAX_PARTICLES = 150;

/** 从色环取一个鲜亮颜色（彩纸用） */
function pickConfettiColor(): string {
  const palette = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c74dff', '#ff8fab'];
  return palette[Math.floor(Math.random() * palette.length)] ?? '#ff6b6b';
}

/** 根据动效类型在 (x,y) 生成一批粒子 */
function spawn(type: Exclude<ClickEffectType, 'off'>, x: number, y: number, brand: string): Particle[] {
  const out: Particle[] = [];
  switch (type) {
    case 'ripple': {
      // 单发环形粒子：用一个特殊 life 作为环半径
      out.push({ x, y, vx: 0, vy: 0, life: 600, max: 600, size: 0, color: brand });
      break;
    }
    case 'sparkle': {
      // 6~10 个小星点，向四周外扩，上下抖动
      const n = 6 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.3;
        const speed = 1.4 + Math.random() * 1.1;
        out.push({
          x,
          y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - 0.4,
          life: 600 + Math.random() * 250,
          max: 850,
          size: 2 + Math.random() * 2,
          color: '#fff8b0',
        });
      }
      break;
    }
    case 'confetti': {
      // 16~20 个彩纸片，初速度向上半空扇形
      const n = 16 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        const ang = Math.PI + (Math.PI * (i / n - 0.5));
        const speed = 3 + Math.random() * 2;
        out.push({
          x,
          y,
          vx: Math.cos(ang) * speed + (Math.random() - 0.5) * 0.6,
          vy: Math.sin(ang) * speed,
          life: 700 + Math.random() * 300,
          max: 1000,
          size: 4 + Math.random() * 3,
          color: pickConfettiColor(),
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 0.3,
        });
      }
      break;
    }
    case 'petal': {
      // 8~12 个樱花瓣，向下缓慢飘落，带旋转
      const n = 8 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        out.push({
          x: x + (Math.random() - 0.5) * 40,
          y,
          vx: (Math.random() - 0.5) * 1.6,
          vy: 0.6 + Math.random() * 1.2,
          life: 800 + Math.random() * 400,
          max: 1200,
          size: 5 + Math.random() * 3,
          color: '#ffb7c5',
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 0.12,
        });
      }
      break;
    }
  }
  return out;
}

/** 单粒子绘制（按类型切换渲染方式） */
function drawParticle(
  ctx: CanvasRenderingContext2D,
  p: Particle,
  type: Exclude<ClickEffectType, 'off'>,
): void {
  const t = 1 - p.life / p.max; // 0→1
  const alpha = Math.max(0, 1 - t);

  if (type === 'ripple') {
    const r = 6 + t * 60;
    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (type === 'sparkle') {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (type === 'confetti') {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot ?? 0);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
    return;
  }

  if (type === 'petal') {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot ?? 0);
    // 简单椭圆当花瓣
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function ClickEffectLayer() {
  const effect = useSettingsStore((s) => s.settings.clickEffect) ?? 'off';
  const reducedMotion = useSettingsStore((s) => s.settings.reducedMotion) ?? 'auto';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const brandColorRef = useRef<string>('#2F6F5E');

  useEffect(() => {
    // 尊重系统 prefers-reduced-motion
    const systemReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const disabled =
      effect === 'off' ||
      reducedMotion === 'on' ||
      (reducedMotion === 'auto' && systemReduced);

    if (disabled) return undefined;

    const canvas = canvasRef.current;
    if (canvas === null) return undefined;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return undefined;

    // 读取当前主题主色（供 ripple 使用）
    const cssBrand = getComputedStyle(document.documentElement).getPropertyValue('--app-brand')
      .trim();
    if (cssBrand !== '') brandColorRef.current = cssBrand;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let lastTs = performance.now();

    const tick = (ts: number) => {
      const dt = Math.min(ts - lastTs, 48); // 防后台回来时一跳过大
      lastTs = ts;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const arr = particlesRef.current;
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        if (!p) continue;
        p.life -= dt;
        if (p.life <= 0) {
          arr.splice(i, 1);
          continue;
        }
        p.x += p.vx;
        p.y += p.vy;
        // 重力（仅 confetti/petal 生效）
        if (effect === 'confetti') p.vy += 0.12;
        if (effect === 'petal') p.vy += 0.02;
        if (p.vrot !== undefined && p.rot !== undefined) p.rot += p.vrot;
        drawParticle(ctx, p, effect);
      }

      if (arr.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    const onClick = (e: MouseEvent) => {
      const t = effect;
      const newOnes = spawn(t, e.clientX, e.clientY, brandColorRef.current);
      // 粒子上限截断
      const arr = particlesRef.current;
      arr.push(...newOnes);
      if (arr.length > MAX_PARTICLES) arr.splice(0, arr.length - MAX_PARTICLES);
      // 启动循环（若已停）
      if (rafRef.current === null) {
        lastTs = performance.now();
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    window.addEventListener('click', onClick, { capture: true });

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('click', onClick, { capture: true });
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      particlesRef.current = [];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [effect, reducedMotion]);

  // 禁用时不渲染 Canvas
  if (effect === 'off') return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="app-click-effect-layer"
    />
  );
}
