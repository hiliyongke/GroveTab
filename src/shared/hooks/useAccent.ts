/**
 * useAccent —— 统一获取分组强调色
 *
 * 逻辑：
 *   1. 优先从 favicon 提取主色（每个站点独立色，解决哈希色重复问题）
 *   2. favicon 加载中或提取失败，回退到 `stringToAccent(colorKey)`
 *   3. 结果自动缓存，同一 favicon 只计算一次
 *
 * 使用示例：
 *   const accent = useAccent(group.tabs[0]?.favIconUrl, group.colorKey);
 *
 * 实现细节：
 * - 使用 React 官方「在渲染中根据 props 派生 state」的合法模式：
 *   把 key 与 value 打包进同一个 `useState`，发现 key 变化就在渲染期调用 setState
 *   —— 这会立即重入渲染并拿到新值，既无 effect 反模式，也不碰 ref
 *   （参见 https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes）。
 * - Effect 只承担"缓存 miss 时发起异步取色"这一真正的外部同步职责。
 */

import { useEffect, useState } from 'react';
import { stringToAccent } from '@/shared/utils/color';
import {
  getAccentFromFavicon,
  peekFaviconAccent,
  type Accent,
} from '@/shared/utils/favicon-color';

/** 内部 state：记录上一次的 (favicon,colorKey) 以及对应的同步结果 */
interface AccentState {
  key: string;
  value: Accent;
}

/** 组合 key，变化即触发派生重算 */
function composeKey(favicon: string | undefined, colorKey: string): string {
  return `${favicon ?? ''}|${colorKey}`;
}

/** 根据 favicon/colorKey 立即可得的强调色：缓存命中用缓存，否则走哈希兜底 */
function resolveSync(
  favicon: string | undefined,
  colorKey: string,
): Accent {
  const fallback = stringToAccent(colorKey);
  if (!favicon) return fallback;
  const cached = peekFaviconAccent(favicon);
  // cached === null 表示"已知提取失败"，也走兜底；undefined 才代表"还没跑过"
  if (cached === undefined) return fallback;
  return cached ?? fallback;
}

/**
 * 根据 favicon + 色键拿到 Accent
 * @param favicon favicon URL（可空）
 * @param colorKey 兜底色键（通常是注册域）
 */
export function useAccent(favicon: string | undefined, colorKey: string): Accent {
  const currKey = composeKey(favicon, colorKey);
  const [state, setState] = useState<AccentState>(() => ({
    key: currKey,
    value: resolveSync(favicon, colorKey),
  }));

  // 渲染期派生：key 变则立刻重算并 set，React 会立即重入渲染（非 effect）
  if (state.key !== currKey) {
    setState({ key: currKey, value: resolveSync(favicon, colorKey) });
  }

  useEffect(() => {
    // 已有缓存（成功或已知失败）无需再异步
    if (!favicon || peekFaviconAccent(favicon) !== undefined) return;
    let alive = true;
    getAccentFromFavicon(favicon).then((result) => {
      if (!alive) return;
      setState({
        key: composeKey(favicon, colorKey),
        value: result ?? stringToAccent(colorKey),
      });
    });
    return () => {
      alive = false;
    };
  }, [favicon, colorKey]);

  return state.value;
}
