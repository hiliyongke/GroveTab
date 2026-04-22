/**
 * useGroupAccents —— 批量计算并**去重**分组强调色
 *
 * 背景：
 *   单独的 `useAccent(favicon, colorKey)` 只能各自为政地给单个分组选色，
 *   当前批次里若多个域名哈希到同一色相、或 favicon 主色近似，颜色条就会撞车。
 *   用户反馈"域名分组的颜色很难区分"——根因就在这里。
 *
 * 本 hook 的职责：
 *   1. 对当前可见的全部分组，先拿到每个分组的"初始 Accent"（favicon 优先，哈希兜底）
 *   2. 按序为每个分组分配一个**全局唯一的色相**——若初始 hue 与已分配集合冲突，
 *      就在色相圆上找到距离已用 hue 最远的空位，重建 Accent
 *   3. 输出 `Record<colorKey, Accent>`
 *
 * 算法：贪心"最大最小距离"分配
 *   - MIN_SEPARATION：两色相最小容忍距离（默认 24°，色相圆 360° 理论上能排 15 组不撞车）
 *   - 当分组数 > 360/MIN_SEPARATION 时，退化到"尽量散开"——仍保证每个色相都是当前批次里
 *     与邻居距离最大的，不会出现两卡紧贴相同色
 *
 * 性能：
 *   - favicon 异步取色由 `useAccent` 的 Promise 驱动；本 hook 只做同步聚合
 *   - 分组数量变化 / favicon 结果刷新时重新分配，整体 O(N²) 可接受（N 一般 < 50）
 */

import { useEffect, useMemo, useState } from 'react';
import type { Accent } from '@/shared/utils/favicon-color';
import {
  buildAccentFromHue,
  getAccentFromFavicon,
  hexToHue,
  peekFaviconAccent,
} from '@/shared/utils/favicon-color';
import { stringToAccent } from '@/shared/utils/color';

/**
 * 批次去重的最小色相距离（度，0-180）
 *
 * 2026-04-22 从 35° 降回 **20°**（水彩版）：
 *   - 色相池扩大到 20 色后，平均间隔 18°，MIN_SEPARATION=20° 刚好匹配
 *   - 水彩参数（S=0.48）下，20° 已足够让人眼区分两色（相邻色不会被识别为"同系"）
 *   - 更小的阈值让更多分组保留自己的"天然色"（favicon 主色 / 哈希选中色），
 *     只有真正撞车时才触发重新分配
 *   - 超出 20 色容量后由 **明度抖动** 接管，给同 hue 的分组 ±5% 的亮度差
 */
const MIN_SEPARATION = 20;

/** 同色相下的明度抖动幅度（±范围，0-1） */
const L_SHIFT_RANGE = 0.05;

/** 分组输入：最小信息——colorKey + favicon URL（可空） */
export interface GroupAccentInput {
  /** 唯一 key，一般是域名或 normalize 后的 colorKey */
  colorKey: string;
  /** favicon URL（可空；空则直接走哈希兜底） */
  favicon?: string;
}

/** 色相圆上两点的最短弧距（0-180） */
function hueDistance(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * 查询某 hue 与一组 hue 的"最小距离"——即这个 hue 周围最近的邻居有多远
 */
function minDistanceTo(hue: number, used: number[]): number {
  if (used.length === 0) return 180;
  let min = 180;
  for (const u of used) {
    const d = hueDistance(hue, u);
    if (d < min) min = d;
  }
  return min;
}

/**
 * 在色相圆上找到距离已用集合**最远**的 hue（1° 精度扫描）
 *
 * @param used 已被占用的 hue 集合
 * @param seed 可选的稳定随机种子——用于在"等距空位"之间二次抖动，
 *   避免 N 组超出色相容量后所有卡都落在同一 hue 点上。
 */
function findFarthestHue(used: number[], seed?: string): number {
  if (used.length === 0) {
    // 空集合情况下也应用 seed 抖动，让首色不总是 0
    return seed ? hashDeg(seed) : 0;
  }
  // 先扫一遍，找到"最大最小距离"
  let bestMin = -1;
  for (let h = 0; h < 360; h++) {
    const m = minDistanceTo(h, used);
    if (m > bestMin) bestMin = m;
  }
  // 收集**所有**达到最大距离的候选 hue（通常是等距多个点）
  const candidates: number[] = [];
  for (let h = 0; h < 360; h++) {
    if (minDistanceTo(h, used) >= bestMin - 0.5) candidates.push(h);
  }
  // 用 seed 哈希从候选中稳定挑选——同一 colorKey 永远挑到同一位置
  if (!seed) return candidates[0];
  const idx = hashDeg(seed) % candidates.length;
  return candidates[idx];
}

/**
 * 字符串 → 0-359 稳定偏移
 * 给 findFarthestHue 在"等距候选"里做稳定抖动用
 */
function hashDeg(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % 360;
}

/**
 * 从已有 Accent 反推出它代表的色相（用 bar 字段采样）
 */
function accentToHue(accent: Accent): number {
  return hexToHue(accent.bar);
}

/**
 * 批量为分组分配去重后的 Accent
 *
 * @param inputs 当前可见的全部分组（顺序敏感：越靠前越"保住"自己的初始色）
 * @returns `Record<colorKey, Accent>`
 */
export function useGroupAccents(inputs: GroupAccentInput[]): Record<string, Accent> {
  /**
   * 异步 favicon 取色的 tick——每当某个 favicon 的结果从 pending 变为 resolved，
   * 就自增一次，触发本 hook 的 useMemo 重新分配。
   */
  const [tick, setTick] = useState(0);

  /**
   * 订阅所有当前分组的 favicon 取色 Promise。只要有一个结果落地就 tick++，
   * 让下面的 useMemo 重算。cleanup 用 alive 标记避免过时 setState。
   */
  useEffect(() => {
    let alive = true;
    const pendingUrls = inputs
      .map((g) => g.favicon)
      .filter((u): u is string => !!u && peekFaviconAccent(u) === undefined);
    if (pendingUrls.length === 0) return;

    // 去重
    const unique = Array.from(new Set(pendingUrls));
    Promise.all(unique.map((u) => getAccentFromFavicon(u))).then(() => {
      if (alive) setTick((t) => t + 1);
    });

    return () => {
      alive = false;
    };
    // 仅当 favicon 列表发生变化时重新订阅
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.map((g) => g.favicon ?? '').join('|')]);

  return useMemo(() => {
    // tick 是异步 favicon 结果落地的信号依赖，引用一下防止 ESLint 把它剔除
    void tick;

    const result: Record<string, Accent> = {};
    /** 已分配 hue 集合，驱动去重决策 */
    const usedHues: number[] = [];
    /**
     * 已分配 hue → 出现次数
     * 用于同 hue 的第 2/3/... 个分组累积 L 偏移，让它们在亮度维度上逐步拉开
     */
    const hueCount = new Map<number, number>();

    for (const input of inputs) {
      // 1. 确定初始 Accent 与 hue：favicon 取色成功 > 哈希兜底
      let initialAccent: Accent;
      if (input.favicon) {
        const cached = peekFaviconAccent(input.favicon);
        initialAccent = cached ?? stringToAccent(input.colorKey);
      } else {
        initialAccent = stringToAccent(input.colorKey);
      }
      const initialHue = accentToHue(initialAccent);

      // 2. 若初始 hue 与已用集合冲突（距离 < MIN_SEPARATION），推到最远空位
      //    传入 colorKey 作为 seed，让"等距候选"里的选择稳定但差异化，
      //    打破 N > 容量时所有后续卡都落到同一最远点的系统性撞色
      const finalHue =
        minDistanceTo(initialHue, usedHues) >= MIN_SEPARATION
          ? initialHue
          : findFarthestHue(usedHues, input.colorKey);

      usedHues.push(finalHue);

      // 3. 记录 hue 出现次数，决定明度抖动方向
      //    第一次出现 → shift=0；第二次 → +L_SHIFT_RANGE；第三次 → -L_SHIFT_RANGE；
      //    第四次 → +2*L_SHIFT_RANGE（实际被 buildAccentFromHue 裁剪到 ±0.06）
      //    基于 hueCount 按序号生成符号，保证同 hue 多卡肉眼可分（亮度差）
      const roundedHue = Math.round(finalHue);
      const occurrence = hueCount.get(roundedHue) ?? 0;
      hueCount.set(roundedHue, occurrence + 1);
      // occurrence=0 时 shift=0；>0 时按序号摆动：1→+, 2→-, 3→+(大), 4→-(大)
      const lShift =
        occurrence === 0
          ? 0
          : ((occurrence % 2 === 1 ? 1 : -1) * L_SHIFT_RANGE * Math.ceil(occurrence / 2));

      // 4. 重建 Accent：hue 替换 or 有 L 抖动 → 重算；否则沿用初始 Accent
      const needsRebuild = Math.abs(finalHue - initialHue) >= 0.5 || lShift !== 0;
      const finalAccent = needsRebuild ? buildAccentFromHue(finalHue, lShift) : initialAccent;

      result[input.colorKey] = finalAccent;
    }

    return result;
  }, [inputs, tick]);
}
