/**
 * eslint-plugin-tab —— Tab 项目专属 ESLint 插件
 *
 * 规则列表：
 *  1. no-whole-store-subscription  禁止订阅整个 Zustand Store（必须使用选择器）
 *  2. no-relative-cross-dir-import 跨目录引用必须使用路径别名（@/、@features/ 等）
 *  3. no-direct-chrome-api         禁止在业务代码中直接调用 chrome.* API
 *  4. no-direct-storage-api        禁止在非 repositories 层直接调用 chrome.storage.*
 *  5. no-direct-feedback-api       禁止直接使用 antd 静态 message/notification/modal
 *  6. prefer-named-function-component 禁止匿名箭头函数组件（影响 Fast Refresh）
 *  7. no-default-export-component  禁止 export default 匿名组件
 *  8. no-large-component           组件文件超过 400 行时发出警告
 */

'use strict';

// ─── 工具函数 ────────────────────────────────────────────────────────────────

/**
 * 判断文件路径是否属于 repositories 层
 * @param {string} filePath
 */
function isRepositoryFile(filePath) {
  return (
    filePath.includes('/repositories/') ||
    filePath.includes('/repos/') ||
    filePath.includes('\\repositories\\') ||
    filePath.includes('\\repos\\')
  );
}

/**
 * 判断文件路径是否属于 chrome 封装层
 * @param {string} filePath
 */
function isChromeWrapperFile(filePath) {
  return (
    filePath.includes('/src/chrome/') ||
    filePath.includes('\\src\\chrome\\')
  );
}

/**
 * 获取相对路径的目录深度（跨目录层数）
 * @param {string} importPath
 * @returns {number}
 */
function getCrossDirDepth(importPath) {
  const parts = importPath.split('/');
  let depth = 0;
  for (const part of parts) {
    if (part === '..') depth++;
    else break;
  }
  return depth;
}

// ─── 规则 1：no-whole-store-subscription ─────────────────────────────────────
/**
 * 禁止订阅整个 Zustand Store，必须传入选择器函数。
 *
 * ❌ const store = useTabsStore();
 * ✅ const tabs = useTabsStore((s) => s.tabs);
 * ✅ const { tabs, loading } = useTabsStore(useShallow((s) => ({ ... })));
 */
var noWholeStoreSubscriptionRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        '禁止订阅整个 Zustand Store，必须传入选择器函数以避免不必要的重渲染',
      category: 'Performance',
    },
    messages: {
      noWholeStore:
        '禁止调用 {{name}}() 时不传选择器。请使用 {{name}}((s) => s.xxx) 精确订阅，' +
        '多字段时配合 useShallow：{{name}}(useShallow((s) => ({ ... })))',
    },
    schema: [
      {
        type: 'object',
        properties: {
          storeHookPattern: {
            type: 'string',
            description: '匹配 Store Hook 名称的正则表达式，默认 /use.+Store$/',
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const pattern = new RegExp(options.storeHookPattern || 'use.+Store$');

    return {
      CallExpression(node) {
        // 匹配 useXxxStore() 形式的调用
        if (
          node.callee.type === 'Identifier' &&
          pattern.test(node.callee.name) &&
          node.arguments.length === 0
        ) {
          context.report({
            node,
            messageId: 'noWholeStore',
            data: { name: node.callee.name },
          });
        }
      },
    };
  },
};

// ─── 规则 2：no-relative-cross-dir-import ────────────────────────────────────
/**
 * 跨目录（../../ 及以上）的 import 必须使用路径别名。
 *
 * ❌ import { foo } from '../../../store';
 * ✅ import { foo } from '@/store';
 * ✅ import { bar } from './utils';  // 同目录，允许
 * ✅ import { baz } from '../hooks'; // 仅上一级，允许（可配置）
 */
var noRelativeCrossDirImportRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        '跨目录引用（../../ 及以上）必须使用路径别名（@/、@features/ 等），禁止使用相对路径',
      category: 'Best Practices',
    },
    messages: {
      usePathAlias:
        '跨目录引用 "{{path}}" 必须使用路径别名（如 @/、@features/、@shared/ 等），' +
        '禁止使用 ../../ 相对路径。',
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxDepth: {
            type: 'number',
            description: '允许的最大相对路径深度，默认 1（即允许 ../，禁止 ../../）',
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const maxDepth = typeof options.maxDepth === 'number' ? options.maxDepth : 1;

    function check(node, importPath) {
      if (!importPath.startsWith('.')) return; // 非相对路径，跳过
      const depth = getCrossDirDepth(importPath);
      if (depth > maxDepth) {
        context.report({
          node,
          messageId: 'usePathAlias',
          data: { path: importPath },
        });
      }
    }

    return {
      ImportDeclaration(node) {
        check(node, node.source.value);
      },
      // 动态 import()
      ImportExpression(node) {
        if (node.source.type === 'Literal') {
          check(node, node.source.value);
        }
      },
    };
  },
};

// ─── 规则 3：no-direct-chrome-api ────────────────────────────────────────────
/**
 * 禁止在业务代码中直接调用 chrome.* API（chrome 封装层和 SW 除外）。
 *
 * ❌ chrome.tabs.query({ currentWindow: true })
 * ✅ import { getTabs } from '@chrome/tabs';
 *
 * 豁免文件：src/chrome/**、src/sw/**
 */
var noDirectChromeApiRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        '禁止在业务代码中直接调用 chrome.* API，必须通过 @chrome/* 封装层调用',
      category: 'Best Practices',
    },
    messages: {
      noDirectChrome:
        '禁止直接调用 chrome.{{api}}，请通过 @chrome/* 封装层调用。' +
        '（src/chrome/ 和 src/sw/ 目录内除外）',
    },
    schema: [],
  },

  create(context) {
    const filePath = context.getFilename ? context.getFilename() : (context.filename || '');

    // 豁免：chrome 封装层本身 和 Service Worker
    if (
      isChromeWrapperFile(filePath) ||
      filePath.includes('/src/sw/') ||
      filePath.includes('\\src\\sw\\')
    ) {
      return {};
    }

    return {
      MemberExpression(node) {
        // 匹配 chrome.xxx 或 chrome.xxx.yyy
        if (
          node.object.type === 'Identifier' &&
          node.object.name === 'chrome' &&
          // 排除 chrome.runtime.lastError（常见的错误检查）
          !(node.property.name === 'runtime' &&
            node.parent &&
            node.parent.type === 'MemberExpression' &&
            node.parent.property.name === 'lastError')
        ) {
          // 只报告顶层的 chrome.xxx 访问（避免 chrome.tabs.query 报告两次）
          if (
            !node.parent ||
            node.parent.type !== 'MemberExpression' ||
            node.parent.object !== node
          ) {
            const apiName = node.property.name || '(unknown)';
            context.report({
              node,
              messageId: 'noDirectChrome',
              data: { api: apiName },
            });
          }
        }
      },
    };
  },
};

// ─── 规则 4：no-direct-storage-api ───────────────────────────────────────────
/**
 * 禁止在 repositories 层以外直接调用 chrome.storage.*。
 *
 * ❌ chrome.storage.local.get('key')  // 在业务组件中
 * ✅ 通过 @repos/* 层操作
 *
 * 豁免文件：src/repositories/**、src/chrome/**、src/sw/**
 */
var noDirectStorageApiRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        '禁止在 repositories 层以外直接调用 chrome.storage.*，必须通过 @repos/* 层操作',
      category: 'Best Practices',
    },
    messages: {
      noDirectStorage:
        '禁止直接调用 chrome.storage.*，请通过 @repos/* 数据仓库层操作。' +
        '（src/repositories/、src/chrome/、src/sw/ 目录内除外）',
    },
    schema: [],
  },

  create(context) {
    const filePath = context.getFilename ? context.getFilename() : (context.filename || '');

    // 豁免：repositories 层、chrome 封装层、SW
    if (
      isRepositoryFile(filePath) ||
      isChromeWrapperFile(filePath) ||
      filePath.includes('/src/sw/') ||
      filePath.includes('\\src\\sw\\')
    ) {
      return {};
    }

    return {
      MemberExpression(node) {
        // 匹配 chrome.storage
        if (
          node.object.type === 'Identifier' &&
          node.object.name === 'chrome' &&
          node.property.type === 'Identifier' &&
          node.property.name === 'storage'
        ) {
          context.report({
            node,
            messageId: 'noDirectStorage',
          });
        }
      },
    };
  },
};

// ─── 规则 5：no-direct-feedback-api ──────────────────────────────────────────
/**
 * 禁止直接使用 antd 静态 message/notification/modal API，
 * 必须使用项目封装的 feedback 模块（支持主题）。
 *
 * ❌ import { message } from 'antd'; message.success('...')
 * ✅ import { feedback } from '@/shared/ui/feedback'; feedback.message.success('...')
 */
var noDirectFeedbackApiRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        '禁止直接从 antd 导入并使用静态 message/notification/modal，' +
        '请使用项目封装的 feedback 模块（@/shared/ui/feedback）',
      category: 'Best Practices',
    },
    messages: {
      noDirectMessage:
        '禁止直接使用 antd 静态 message API，请使用 feedback.message.* ' +
        '（import { feedback } from "@/shared/ui/feedback"）',
      noDirectNotification:
        '禁止直接使用 antd 静态 notification API，请使用 feedback.notification.* ' +
        '（import { feedback } from "@/shared/ui/feedback"）',
      noDirectModal:
        '禁止直接使用 antd 静态 Modal.confirm/Modal.info 等，请使用 feedback.modal.* ' +
        '（import { feedback } from "@/shared/ui/feedback"）',
    },
    schema: [],
  },

  create(context) {
    // 记录从 antd 导入的 message/notification/Modal 标识符
    const antdImports = new Set();

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'antd') return;
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportSpecifier') {
            const name = specifier.imported.name;
            if (['message', 'notification', 'Modal'].includes(name)) {
              antdImports.add(specifier.local.name);
            }
          }
        }
      },

      CallExpression(node) {
        // 匹配 message.success() / message.error() 等
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          antdImports.has(node.callee.object.name)
        ) {
          const varName = node.callee.object.name;
          if (varName === 'message') {
            context.report({ node, messageId: 'noDirectMessage' });
          } else if (varName === 'notification') {
            context.report({ node, messageId: 'noDirectNotification' });
          } else if (varName === 'Modal') {
            context.report({ node, messageId: 'noDirectModal' });
          }
        }
      },
    };
  },
};

// ─── 规则 6：prefer-named-function-component ─────────────────────────────────
/**
 * 禁止使用匿名箭头函数作为 React 组件（影响 Fast Refresh 和调试体验）。
 *
 * ❌ export default () => <div />;
 * ❌ const Foo = () => <div />;  // 文件名以大写开头时
 * ✅ export function Foo() { return <div />; }
 * ✅ export default function Foo() { return <div />; }
 *
 * 判断依据：变量名首字母大写 + 函数体返回 JSX
 */
var preferNamedFunctionComponentRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        '禁止使用匿名箭头函数定义 React 组件，请使用具名函数组件以支持 Fast Refresh',
      category: 'Best Practices',
    },
    messages: {
      useNamedFunction:
        '"{{name}}" 是 React 组件（首字母大写），请使用具名函数声明：' +
        'export function {{name}}() { ... }，而非箭头函数赋值。',
      noAnonymousDefault:
        '禁止 export default 匿名箭头函数组件，请使用 export default function ComponentName() { ... }',
    },
    schema: [],
  },

  create(context) {
    /**
     * 判断函数体是否可能返回 JSX（简单启发式检测）
     * @param {import('estree').Function} funcNode
     */
    function mightReturnJSX(funcNode) {
      const body = funcNode.body;
      // 箭头函数简写：() => <div />
      if (body.type === 'JSXElement' || body.type === 'JSXFragment') return true;
      // 块体：检查是否有 return <JSX>
      if (body.type === 'BlockStatement') {
        let found = false;
        function walk(node) {
          if (!node || found) return;
          if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
            found = true;
            return;
          }
          for (const key of Object.keys(node)) {
            const child = node[key];
            if (child && typeof child === 'object' && child.type) walk(child);
            else if (Array.isArray(child)) child.forEach(walk);
          }
        }
        walk(body);
        return found;
      }
      return false;
    }

    return {
      // const Foo = () => { return <div /> }
      VariableDeclarator(node) {
        if (
          node.id.type === 'Identifier' &&
          /^[A-Z]/.test(node.id.name) &&
          node.init &&
          (node.init.type === 'ArrowFunctionExpression' ||
            node.init.type === 'FunctionExpression') &&
          mightReturnJSX(node.init)
        ) {
          context.report({
            node,
            messageId: 'useNamedFunction',
            data: { name: node.id.name },
          });
        }
      },

      // export default () => <div />
      ExportDefaultDeclaration(node) {
        const decl = node.declaration;
        if (
          decl &&
          decl.type === 'ArrowFunctionExpression' &&
          mightReturnJSX(decl)
        ) {
          context.report({
            node,
            messageId: 'noAnonymousDefault',
          });
        }
      },
    };
  },
};

// ─── 规则 7：no-default-export-component ─────────────────────────────────────
/**
 * 禁止 export default 匿名组件（无法被 Fast Refresh 识别）。
 * 注意：此规则与 react-refresh/only-export-components 互补，
 * 专门针对匿名 default export 的情况。
 *
 * ❌ export default function() { return <div /> }
 * ✅ export default function MyComponent() { return <div /> }
 */
var noDefaultExportAnonymousComponentRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: '禁止 export default 匿名函数组件，必须为组件命名以支持 Fast Refresh 和调试',
      category: 'Best Practices',
    },
    messages: {
      noAnonymousDefaultExport:
        '禁止 export default 匿名函数，请为组件命名：export default function ComponentName() { ... }',
    },
    schema: [],
  },

  create(context) {
    return {
      ExportDefaultDeclaration(node) {
        const decl = node.declaration;
        // export default function() { ... }（匿名函数声明）
        if (
          decl &&
          decl.type === 'FunctionDeclaration' &&
          !decl.id
        ) {
          context.report({
            node,
            messageId: 'noAnonymousDefaultExport',
          });
        }
      },
    };
  },
};

// ─── 规则 9：no-direct-web-storage-api ────────────────────────────────────────
/**
 * 禁止在业务代码中直接使用 localStorage / sessionStorage，
 * 必须通过 repositories 层操作（chrome.storage 封装或自定义 repo）。
 *
 * ❌ localStorage.getItem('key')
 * ❌ sessionStorage.setItem('key', value)
 * ✅ 通过 @repos/* 层操作
 *
 * 豁免文件：src/repositories/**、src/chrome/**、src/sw/**、src/shared/utils/storage-array.ts
 */
var noDirectWebStorageApiRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        '禁止在业务代码中直接使用 localStorage/sessionStorage，请通过 @repos/* 层操作',
      category: 'Best Practices',
    },
    messages: {
      noDirectLocalStorage:
        '禁止直接调用 localStorage.{{method}}()，请通过 @repos/* 数据仓库层操作。' +
        '（src/repositories/、src/chrome/、src/sw/ 目录内除外）',
      noDirectSessionStorage:
        '禁止直接调用 sessionStorage.{{method}}()，请通过 @repos/* 数据仓库层操作。' +
        '（src/repositories/、src/chrome/、src/sw/ 目录内除外）',
    },
    schema: [],
  },

  create(context) {
    var filePath = context.getFilename ? context.getFilename() : (context.filename || '');

    // 豁免：repositories 层、chrome 封装层、SW、storage-array 工具
    if (
      isRepositoryFile(filePath) ||
      isChromeWrapperFile(filePath) ||
      filePath.includes('/src/sw/') ||
      filePath.includes('\\src\\sw\\') ||
      filePath.includes('storage-array')
    ) {
      return {};
    }

    return {
      MemberExpression(node) {
        if (node.object.type !== 'Identifier') return;

        if (node.object.name === 'localStorage') {
          var method = node.property.name || '(unknown)';
          context.report({
            node,
            messageId: 'noDirectLocalStorage',
            data: { method: method },
          });
        } else if (node.object.name === 'sessionStorage') {
          var method = node.property.name || '(unknown)';
          context.report({
            node,
            messageId: 'noDirectSessionStorage',
            data: { method: method },
          });
        }
      },
    };
  },
};

// ─── 规则 10：no-direct-window-api ──────────────────────────────────────────────
/**
 * 禁止在业务代码中直接调用 window.open / window.close / window.location 等，
 * 必须通过 @chrome/* 封装层调用。
 *
 * ❌ window.open(url, '_blank')
 * ❌ window.close()
 * ❌ window.location.reload()
 * ❌ window.location.hash
 * ✅ 通过 @chrome/* 封装层调用
 *
 * 豁免文件：src/chrome/**、src/sw/**、src/shared/utils/url-safety.ts
 */
var noDirectWindowApiRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        '禁止在业务代码中直接调用 window.* API，请通过 @chrome/* 封装层调用',
      category: 'Best Practices',
    },
    messages: {
      noDirectWindowOpen:
        '禁止直接调用 window.open()，请通过 @chrome/* 封装层调用。' +
        '（src/chrome/ 和 src/sw/ 目录内除外）',
      noDirectWindowClose:
        '禁止直接调用 window.close()，请通过 @chrome/* 封装层调用。' +
        '（src/chrome/ 和 src/sw/ 目录内除外）',
      noDirectWindowLocation:
        '禁止直接访问 window.location.{{property}}，请通过 @chrome/* 封装层调用。' +
        '（src/chrome/ 和 src/sw/ 目录内除外）',
    },
    schema: [],
  },

  create(context) {
    var filePath = context.getFilename ? context.getFilename() : (context.filename || '');

    // 豁免：chrome 封装层本身、SW、url-safety 工具
    if (
      isChromeWrapperFile(filePath) ||
      filePath.includes('/src/sw/') ||
      filePath.includes('\\src\\sw\\') ||
      filePath.includes('url-safety')
    ) {
      return {};
    }

    return {
      MemberExpression(node) {
        if (node.object.type !== 'Identifier' || node.object.name !== 'window') return;

        var prop = node.property.name || '';
        if (prop === 'open') {
          context.report({
            node,
            messageId: 'noDirectWindowOpen',
          });
        } else if (prop === 'close') {
          context.report({
            node,
            messageId: 'noDirectWindowClose',
          });
        } else if (prop === 'location') {
          // window.location 的属性访问（如 .hash, .reload()）
          var locationProp = node.parent &&
            node.parent.type === 'MemberExpression' &&
            node.parent.property &&
            node.parent.property.type === 'Identifier'
            ? node.parent.property.name
            : '(unknown)';
          context.report({
            node,
            messageId: 'noDirectWindowLocation',
            data: { property: locationProp },
          });
        }
      },

      // window.close() 直接调用（非 MemberExpression）
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'close'
        ) {
          context.report({
            node,
            messageId: 'noDirectWindowClose',
          });
        }
      },
    };
  },
};

// ─── 规则 11：no-direct-navigator-api ────────────────────────────────────────────
/**
 * 禁止在业务代码中直接调用 navigator.clipboard / navigator.geolocation 等 Web API，
 * 必须通过 @chrome/* 封装层调用。
 *
 * ❌ navigator.clipboard.writeText(text)
 * ❌ navigator.geolocation.getCurrentPosition(cb)
 * ✅ 通过 @chrome/* 封装层调用
 *
 * 豁免文件：src/chrome/**、src/sw/**
 */
var noDirectNavigatorApiRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        '禁止在业务代码中直接调用 navigator.* Web API，请通过 @chrome/* 封装层调用',
      category: 'Best Practices',
    },
    messages: {
      noDirectClipboard:
        '禁止直接调用 navigator.clipboard.{{method}}()，请通过 @chrome/* 封装层调用。' +
        '（src/chrome/ 和 src/sw/ 目录内除外）',
      noDirectGeolocation:
        '禁止直接调用 navigator.geolocation.{{method}}()，请通过 @chrome/* 封装层调用。',
      noDirectPermissions:
        '禁止直接调用 navigator.permissions.{{method}}()，请通过 @chrome/* 封装层调用。',
      noDirectMediaDevices:
        '禁止直接调用 navigator.mediaDevices.{{method}}()，请通过 @chrome/* 封装层调用。',
      noDirectServiceWorker:
        '禁止直接调用 navigator.serviceWorker.{{method}}()，请通过 @chrome/* 封装层调用。',
    },
    schema: [],
  },

  create(context) {
    var filePath = context.getFilename ? context.getFilename() : (context.filename || '');

    // 豁免：chrome 封装层本身、SW
    if (
      isChromeWrapperFile(filePath) ||
      filePath.includes('/src/sw/') ||
      filePath.includes('\\src\\sw\\')
    ) {
      return {};
    }

    return {
      MemberExpression(node) {
        if (node.object.type !== 'Identifier' || node.object.name !== 'navigator') return;

        var prop = node.property.name || '';
        if (prop === 'clipboard') {
          var method = node.parent &&
            node.parent.type === 'MemberExpression' &&
            node.parent.property &&
            node.parent.property.type === 'Identifier'
            ? node.parent.property.name
            : '(unknown)';
          context.report({
            node,
            messageId: 'noDirectClipboard',
            data: { method: method },
          });
        } else if (prop === 'geolocation') {
          var method = node.parent &&
            node.parent.type === 'MemberExpression' &&
            node.parent.property &&
            node.parent.property.type === 'Identifier'
            ? node.parent.property.name
            : '(unknown)';
          context.report({
            node,
            messageId: 'noDirectGeolocation',
            data: { method: method },
          });
        } else if (prop === 'permissions') {
          var method = node.parent &&
            node.parent.type === 'MemberExpression' &&
            node.parent.property &&
            node.parent.property.type === 'Identifier'
            ? node.parent.property.name
            : '(unknown)';
          context.report({
            node,
            messageId: 'noDirectPermissions',
            data: { method: method },
          });
        } else if (prop === 'mediaDevices') {
          var method = node.parent &&
            node.parent.type === 'MemberExpression' &&
            node.parent.property &&
            node.parent.property.type === 'Identifier'
            ? node.parent.property.name
            : '(unknown)';
          context.report({
            node,
            messageId: 'noDirectMediaDevices',
            data: { method: method },
          });
        } else if (prop === 'serviceWorker') {
          var method = node.parent &&
            node.parent.type === 'MemberExpression' &&
            node.parent.property &&
            node.parent.property.type === 'Identifier'
            ? node.parent.property.name
            : '(unknown)';
          context.report({
            node,
            messageId: 'noDirectServiceWorker',
            data: { method: method },
          });
        }
      },
    };
  },
};

// ─── 规则 12：no-direct-fetch ────────────────────────────────────────────────────────
/**
 * 禁止在业务层（features/pages）直接使用 fetch，
 * 所有 HTTP 请求必须通过 services 层发起。
 *
 * ❌ const res = await fetch('/api/data')
 * ✅ const data = await dataService.fetchData()
 *
 * 豁免文件：src/services/**、src/repositories/**、src/chrome/**、src/sw/**
 */
var noDirectFetchRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        '禁止在业务层直接使用 fetch，所有 HTTP 请求必须通过 services 层发起',
      category: 'Best Practices',
    },
    messages: {
      noDirectFetch:
        '禁止在业务代码中直接调用 fetch()，请通过 services 层发起请求。' +
        '（src/services/、src/repositories/、src/chrome/、src/sw/ 目录内除外）',
    },
    schema: [],
  },

  create(context) {
    var filePath = context.getFilename ? context.getFilename() : (context.filename || '');

    // 豁免：services 层、repositories 层、chrome 封装层、SW
    if (
      filePath.includes('/src/services/') ||
      filePath.includes('\\src\\services\\') ||
      isRepositoryFile(filePath) ||
      isChromeWrapperFile(filePath) ||
      filePath.includes('/src/sw/') ||
      filePath.includes('\\src\\sw\\')
    ) {
      return {};
    }

    return {
      CallExpression(node) {
        // 直接调用 fetch()
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'fetch'
        ) {
          context.report({
            node,
            messageId: 'noDirectFetch',
          });
        }
        // fetch 的变体：window.fetch
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'window' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'fetch'
        ) {
          context.report({
            node,
            messageId: 'noDirectFetch',
          });
        }
      },
    };
  },
};

// ─── 规则 8：no-large-component ──────────────────────────────────────────────
/**
 * 组件文件超过指定行数时发出警告，提示拆分。
 *
 * 默认阈值：400 行（可通过选项配置）
 * 仅检查 .tsx 文件（React 组件文件）
 */
var noLargeComponentRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: '组件文件超过 400 行时发出警告，建议拆分为更小的组件或提取 Hook',
      category: 'Best Practices',
    },
    messages: {
      tooLarge:
        '组件文件过大（{{lines}} 行，超过 {{max}} 行限制）。' +
        '请将复杂逻辑提取到 hooks/ 目录，或将子组件拆分到 components/ 目录。',
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: {
            type: 'number',
            description: '最大允许行数，默认 400',
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const maxLines = typeof options.max === 'number' ? options.max : 400;
    const filePath = context.getFilename ? context.getFilename() : (context.filename || '');

    // 只检查 .tsx 文件
    if (!filePath.endsWith('.tsx')) return {};

    return {
      Program(node) {
        const sourceCode = context.getSourceCode
          ? context.getSourceCode()
          : context.sourceCode;
        const lines = sourceCode.lines.length;
        if (lines > maxLines) {
          context.report({
            node,
            messageId: 'tooLarge',
            data: { lines, max: maxLines },
          });
        }
      },
    };
  },
};

// ─── 导出插件 ────────────────────────────────────────────────────────────────
module.exports = {
  rules: {
    'no-whole-store-subscription': noWholeStoreSubscriptionRule,
    'no-relative-cross-dir-import': noRelativeCrossDirImportRule,
    'no-direct-chrome-api': noDirectChromeApiRule,
    'no-direct-storage-api': noDirectStorageApiRule,
    'no-direct-feedback-api': noDirectFeedbackApiRule,
    'prefer-named-function-component': preferNamedFunctionComponentRule,
    'no-default-export-anonymous-component': noDefaultExportAnonymousComponentRule,
    'no-large-component': noLargeComponentRule,
    'no-direct-web-storage-api': noDirectWebStorageApiRule,
    'no-direct-window-api': noDirectWindowApiRule,
    'no-direct-navigator-api': noDirectNavigatorApiRule,
    'no-direct-fetch': noDirectFetchRule,
  },
};
