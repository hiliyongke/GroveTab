/**
 * eslint-plugin-i18n-zh —— 自定义 ESLint 插件
 * 检测代码中的硬编码中文文本，强制使用 t() 翻译函数
 *
 * 两条规则：
 * 1. no-bare-zh-in-jsx: 检测 JSX 文本节点中的硬编码中文
 * 2. no-bare-zh-in-js:  检测 JS 字符串字面量中的硬编码中文
 */

// 中文字符正则（匹配 CJK 统一汉字区间）
var CHINESE_REGEX = /[\u4e00-\u9fff]/;

/**
 * no-bare-zh-in-jsx
 *
 * 检测 JSX 文本节点中的硬编码中文。
 * 合法场景（不警告）：
 *   - t() / translate() 函数的参数（如 t("搜索标签页")）
 *   - <Trans> 组件内的文本
 *   - 注释中的中文
 *   - console.log / console.warn / console.error 的参数
 *
 * 非法场景（发出警告）：
 *   - <div>搜索</div> 中的"搜索"
 *   - <span>共 {count} 个</span> 中的"共"和"个"
 */
var noBareZhInJsxRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: '禁止在 JSX 文本节点中直接使用硬编码中文，请使用 t() 翻译函数',
      category: 'Best Practices',
    },
    messages: {
      bareZhInJsx:
        'JSX 中发现硬编码中文 "{{text}}"，请使用 t("{{text}}") 替代以支持国际化。',
    },
    schema: [], // 无额外配置
  },

  create(context) {
    return {
      JSXText(node) {
        var text = node.value.trim();
        if (!text) return;

        // 检查是否包含中文
        if (!CHINESE_REGEX.test(text)) return;

        // 检查是否在 <Trans> 组件内（合法）
        var parent = node.parent;
        if (
          parent &&
          parent.type === 'JSXElement' &&
          parent.openingElement.name.name === 'Trans'
        ) {
          // <Trans> 组件内的文本是合法的
          return;
        }

        context.report({
          node: node,
          messageId: 'bareZhInJsx',
          data: { text: text },
        });
      },
    };
  },
};

/**
 * no-bare-zh-in-js
 *
 * 检测 JS 字符串字面量中的硬编码中文。
 * 合法场景（不警告）：
 *   - t() / translate() 函数的参数
 *   - console.log / console.warn / console.error 的参数
 *   - 注释中的中文
 *   - import 语句中的路径
 *
 * 非法场景（发出警告）：
 *   - const label = "搜索";
 *   - const msg = '找到 ' + count + ' 个';
 */
var noBareZhInJsRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: '禁止在 JS 字符串字面量中直接使用硬编码中文，请使用 t() 翻译函数',
      category: 'Best Practices',
    },
    messages: {
      bareZhInJs:
        '字符串中发现硬编码中文 "{{text}}"，请使用 t("{{text}}") 替代以支持国际化。',
    },
    schema: [],
  },

  create(context) {
    /**
     * 检查节点是否在合法上下文中（不应报警）
     */
    function isInAllowedContext(node) {
      var current = node.parent;

      while (current) {
        // t() / translate() 函数调用的参数
        if (
          current.type === 'CallExpression' &&
          (current.callee.type === 'Identifier' &&
            (current.callee.name === 't' || current.callee.name === 'translate'))
        ) {
          return true;
        }

        // console.log / warn / error 的参数
        if (
          current.type === 'CallExpression' &&
          current.callee.type === 'MemberExpression' &&
          current.callee.object.type === 'Identifier' &&
          current.callee.object.name === 'console' &&
          ['log', 'warn', 'error', 'info', 'debug'].includes(
            current.callee.property.name,
          )
        ) {
          return true;
        }

        // 跳过 import 声明
        if (current.type === 'ImportDeclaration') {
          return true;
        }

        current = current.parent;
      }

      return false;
    }

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        var text = node.value;
        if (!CHINESE_REGEX.test(text)) return;

        // 检查是否在合法上下文中
        if (isInAllowedContext(node)) return;

        context.report({
          node: node,
          messageId: 'bareZhInJs',
          data: { text: text },
        });
      },

      TemplateLiteral(node) {
        // 检查模板字面量中的中文字符
        for (var i = 0; i < node.quasis.length; i++) {
          var quasi = node.quasis[i];
          var text = quasi.value.cooked || quasi.value.raw;
          if (CHINESE_REGEX.test(text)) {
            if (isInAllowedContext(node)) return;
            // 仅报告包含中文的 quasi 节点

            context.report({
              node: quasi,
              messageId: 'bareZhInJs',
              data: { text: text.trim() || text },
            });
          }
        }
      },
    };
  },
};

// ─── 规则 3：no-explicit-any ──────────────────────────────────────────────────────
/**
 * 禁止在 TypeScript 代码中显式使用 `any` 类型，
 * 强制使用更精确的类型定义。
 *
 * ❌ const data: any = response;
 * ❌ function process(input: any) { ... }
 * ❌ let obj: any = {};
 * ✅ const data: unknown = response;    // 使用 unknown 更安全
 * ✅ function process(input: Record<string, unknown>) { ... }
 * ✅ let obj: MyInterface = {};
 *
 * 豁免：
 *   - 类型断言中的 any（如 value as any）→ 建议使用 unknown 替代
 *   - 测试文件中的 any（*.test.ts, *.spec.ts）
 *   - 类型定义文件中的 any（*.d.ts）
 *   - 配置文件中的 any（*.config.ts, *.config.js）
 */
var noExplicitAnyRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        '禁止显式使用 TypeScript any 类型，请使用 unknown 或更精确的类型',
      category: 'Best Practices',
    },
    messages: {
      noExplicitAny:
        '禁止使用 any 类型。' +
        '请使用 unknown（然后通过类型守卫收窄）或定义更精确的类型。',
      noTsAny:
        '禁止使用 ts 命名空间中的 any（TsAny）。请使用 unknown 替代。',
    },
    schema: [],
  },

  create(context) {
    var filePath = context.getFilename ? context.getFilename() : (context.filename || '');

    // 豁免：测试文件、类型定义文件、配置文件
    if (
      filePath.endsWith('.test.ts') ||
      filePath.endsWith('.test.tsx') ||
      filePath.endsWith('.spec.ts') ||
      filePath.endsWith('.spec.tsx') ||
      filePath.endsWith('.d.ts') ||
      filePath.endsWith('.config.ts') ||
      filePath.endsWith('.config.js') ||
      filePath.endsWith('.config.cjs')
    ) {
      return {};
    }

    return {
      // 匹配显式的 : any 类型注解
      TSAnyKeyword(node) {
        context.report({
          node,
          messageId: 'noExplicitAny',
        });
      },

      // 匹配 as any 类型断言
      TSAsExpression(node) {
        if (
          node.typeAnnotation &&
          node.typeAnnotation.type === 'TSAnyKeyword'
        ) {
          context.report({
            node,
            messageId: 'noExplicitAny',
          });
        }
      },
    };
  },
};

// ─── 导出插件 ────────────────────────────────────────────────
module.exports = {
  rules: {
    'no-bare-zh-in-jsx': noBareZhInJsxRule,
    'no-bare-zh-in-js': noBareZhInJsRule,
    'no-explicit-any': noExplicitAnyRule,
  },
};
