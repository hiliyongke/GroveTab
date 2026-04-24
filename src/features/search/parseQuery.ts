/**
 * parseQuery —— 搜索语法解析器（F-05b）
 *
 * 支持的语法（多条可空格组合，AND 关系）：
 *   · `site:<domain>`    仅 hostname 匹配
 *   · `in:archive`       仅搜归档会话
 *   · `in:live`          仅搜实时 Tab
 *   · `in:bookmark`      仅搜书签
 *   · `tag:<name>`       仅命中打过该 tag 的 Tab/会话
 *   · `has:note`         仅带 note 的 Tab
 *   · `pinned:true`      仅 metadata.pin 为 true 的 Tab
 *
 * 解析输出：
 *   - keywords：剩余的自由关键词（空格切分）
 *   - filters：结构化过滤条件
 */

export interface ParsedQuery {
  /** 去掉语法后的自由关键词（已 trim） */
  keywords: string[];
  /** 合并后的关键词（空格连接），供 MiniSearch 等模糊匹配使用 */
  text: string;
  filters: {
    sites?: string[];
    scopes?: Array<'archive' | 'live' | 'bookmark'>;
    tags?: string[];
    hasNote?: boolean;
    pinnedTrue?: boolean;
  };
  /** 解析过程中识别出的原始 token（调试用） */
  tokens: string[];
}

const SCOPE_VALUES = new Set(['archive', 'live', 'bookmark']);

export function parseQuery(input: string): ParsedQuery {
  const raw = (input ?? '').trim();
  const tokens: string[] = [];
  const keywords: string[] = [];
  const filters: ParsedQuery['filters'] = {};

  if (raw === '') {
    return { keywords, text: '', filters, tokens };
  }

  // 按空格拆分；保留引号包裹的"复合关键词"不切（未来可扩展）
  const parts = raw.split(/\s+/);

  for (const part of parts) {
    if (part === '') continue;
    tokens.push(part);

    const idx = part.indexOf(':');
    if (idx <= 0 || idx === part.length - 1) {
      keywords.push(part);
      continue;
    }
    const key = part.slice(0, idx).toLowerCase();
    const value = part.slice(idx + 1);

    switch (key) {
      case 'site': {
        if (value !== '') {
          filters.sites = filters.sites ?? [];
          filters.sites.push(value.toLowerCase());
        }
        break;
      }
      case 'in': {
        const v = value.toLowerCase();
        if (SCOPE_VALUES.has(v)) {
          filters.scopes = filters.scopes ?? [];
          filters.scopes.push(v as 'archive' | 'live' | 'bookmark');
        } else {
          keywords.push(part);
        }
        break;
      }
      case 'tag': {
        if (value !== '') {
          filters.tags = filters.tags ?? [];
          filters.tags.push(value);
        }
        break;
      }
      case 'has': {
        if (value.toLowerCase() === 'note') {
          filters.hasNote = true;
        } else {
          keywords.push(part);
        }
        break;
      }
      case 'pinned': {
        if (value.toLowerCase() === 'true') {
          filters.pinnedTrue = true;
        } else {
          keywords.push(part);
        }
        break;
      }
      default: {
        keywords.push(part);
        break;
      }
    }
  }

  return {
    keywords,
    text: keywords.join(' ').trim(),
    filters,
    tokens,
  };
}

/** 判断某 URL 是否匹配 site 过滤器（任一域名匹配即通过） */
export function matchesSiteFilter(url: string, sites: string[] | undefined): boolean {
  if (!sites || sites.length === 0) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return sites.some((s) => host === s || host.endsWith(`.${s}`));
  } catch {
    return false;
  }
}
