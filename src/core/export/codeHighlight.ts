/**
 * 导出链路的代码块语法高亮（Shiki）。
 *
 * 设计要点：
 * - 只替换 marked 产物 `<pre><code class="language-xx">…</code></pre>` 的**内层**内容，
 *   开/闭标签逐字保留：mermaid 围栏转换、下游解析与既有断言都依赖这个形状。
 * - 高亮器走「运行时切片」加载（`dist/extension/markly-code-highlight.cjs`），
 *   避免把整套语法定义塞进扩展入口包（见 resources/BUNDLE_GOVERNANCE.md）；
 *   切片缺失时退回 node_modules 直连（开发 / 单测环境无需先构建切片）。
 * - 任何失败（切片缺失、语言不支持、高亮异常）一律回退原文，导出永不因高亮失败。
 */

import * as path from 'path';
import { createRequire } from 'module';

export type CodeHighlightTheme = 'light' | 'dark';

/** 把一段代码渲染为「内层 HTML」（span 片段）；语言不支持时返回 null。 */
export type CodeTokenizer = (
  code: string,
  lang: string,
  theme: CodeHighlightTheme
) => Promise<string | null>;

/** 生产切片文件名：与扩展入口同目录，按需 require。 */
export const SHIKI_CHUNK_FILENAME = 'markly-code-highlight.cjs';

/**
 * 常见围栏语言别名 → 已内置语言。
 * 只收录文档里高频出现的语言；未收录的语言保持素色代码块（视觉仍统一）。
 */
const LANG_ALIAS: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  node: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  python3: 'python',
  sh: 'bash',
  zsh: 'bash',
  shell: 'bash',
  console: 'bash',
  yml: 'yaml',
  md: 'markdown',
  htm: 'html',
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  rs: 'rust',
  golang: 'go',
  jsonc: 'json',
  patch: 'diff',
};

/** 明确跳过：mermaid 围栏要留给导出管线转换成图表容器。 */
const SKIP_LANGS = new Set(['mermaid']);

const SHIKI_THEMES: Record<CodeHighlightTheme, string> = {
  light: 'github-light',
  dark: 'github-dark',
};

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/** 还原 marked 在代码块里做的实体转义（&amp; 最后处理，避免二次还原）。 */
export function decodeBasicEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x0*27;/gi, "'")
    .replace(/&amp;/g, '&');
}

/**
 * 构建 Shiki 高亮器（开发/单测直连 node_modules；生产优先用切片）。
 * 返回的 tokenizer 对未知语言返回 null，由调用方保留原始代码块。
 */
export async function createShikiTokenizer(): Promise<CodeTokenizer> {
  const [core, engineMod, themes, langs] = await Promise.all([
    import('shiki/core'),
    import('shiki/engine/javascript'),
    loadShikiThemes(),
    loadShikiLangs(),
  ]);

  const highlighter = await core.createHighlighterCore({
    themes: [themes.githubLight, themes.githubDark],
    langs: Object.values(langs),
    engine: engineMod.createJavaScriptRegexEngine({ forgiving: true }),
  });

  const loaded = new Set(highlighter.getLoadedLanguages());

  return async (code, lang, theme) => {
    const resolved = resolveLang(lang, loaded);
    if (!resolved) return null;
    try {
      const html = await highlighter.codeToHtml(code, {
        lang: resolved,
        theme: SHIKI_THEMES[theme] ?? SHIKI_THEMES.light,
      });
      // 只取 <code> 内层：外层 <pre> 由导出样式统一负责
      const match = /<code>([\s\S]*?)<\/code>/.exec(html);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };
}

function resolveLang(lang: string, loaded: Set<string>): string | null {
  const raw = String(lang ?? '').trim().toLowerCase();
  if (!raw || SKIP_LANGS.has(raw)) return null;
  const name = LANG_ALIAS[raw] ?? raw;
  return loaded.has(name) ? name : null;
}

/** 字面量动态导入：esbuild 既能打成切片，又能在入口包里保持外部按需加载。 */
async function loadShikiThemes() {
  const [light, dark] = await Promise.all([
    import('@shikijs/themes/github-light'),
    import('@shikijs/themes/github-dark'),
  ]);
  return { githubLight: light.default, githubDark: dark.default };
}

async function loadShikiLangs() {
  const [
    javascript,
    typescript,
    python,
    bash,
    json,
    yaml,
    markdown,
    html,
    css,
    sql,
    java,
    go,
    rust,
    c,
    cpp,
    csharp,
    diff,
    xml,
  ] = await Promise.all([
    import('@shikijs/langs/javascript'),
    import('@shikijs/langs/typescript'),
    import('@shikijs/langs/python'),
    import('@shikijs/langs/bash'),
    import('@shikijs/langs/json'),
    import('@shikijs/langs/yaml'),
    import('@shikijs/langs/markdown'),
    import('@shikijs/langs/html'),
    import('@shikijs/langs/css'),
    import('@shikijs/langs/sql'),
    import('@shikijs/langs/java'),
    import('@shikijs/langs/go'),
    import('@shikijs/langs/rust'),
    import('@shikijs/langs/c'),
    import('@shikijs/langs/cpp'),
    import('@shikijs/langs/csharp'),
    import('@shikijs/langs/diff'),
    import('@shikijs/langs/xml'),
  ]);
  return {
    javascript: javascript.default,
    typescript: typescript.default,
    python: python.default,
    bash: bash.default,
    json: json.default,
    yaml: yaml.default,
    markdown: markdown.default,
    html: html.default,
    css: css.default,
    sql: sql.default,
    java: java.default,
    go: go.default,
    rust: rust.default,
    c: c.default,
    cpp: cpp.default,
    csharp: csharp.default,
    diff: diff.default,
    xml: xml.default,
  };
}

function runtimeRequire() {
  const base =
    typeof __filename === 'string' ? __filename : path.join(process.cwd(), 'markly-runtime.js');
  return createRequire(base);
}

function resolveChunkPath(): string {
  return typeof __dirname === 'string'
    ? path.join(__dirname, SHIKI_CHUNK_FILENAME)
    : path.join(process.cwd(), 'dist', 'extension', SHIKI_CHUNK_FILENAME);
}

let tokenizerPromise: Promise<CodeTokenizer> | null = null;

/** 语言表就绪后长期缓存（同一进程内多次导出/预览复用）。 */
function getTokenizer(): Promise<CodeTokenizer> {
  if (!tokenizerPromise) {
    tokenizerPromise = loadTokenizer().catch((err) => {
      tokenizerPromise = null;
      throw err;
    });
  }
  return tokenizerPromise;
}

async function loadTokenizer(): Promise<CodeTokenizer> {
  // 1) 生产：同目录切片（含完整 Shiki，扩展入口不承担体积）
  try {
    const chunkPath = resolveChunkPath();
    const chunk = runtimeRequire()(chunkPath) as { createShikiTokenizer?: () => Promise<CodeTokenizer> };
    if (typeof chunk?.createShikiTokenizer === 'function') {
      return await chunk.createShikiTokenizer();
    }
  } catch {
    /* 切片缺失/加载失败 → 继续走直连 */
  }
  // 2) 开发 / 单测：node_modules 直连（入口包把 shiki* 标为 external，不会被内联）
  return createShikiTokenizer();
}

const CODE_BLOCK_RE = /<pre><code class="language-([A-Za-z0-9_+#.-]+)">([\s\S]*?)<\/code><\/pre>/g;

/**
 * 给整段导出 HTML 里的围栏代码块上色。
 * 保持 `<pre><code class="language-xx">` 形状不变，只替换内层 token。
 */
export async function highlightFencedCodeInHtml(
  html: string,
  theme: CodeHighlightTheme = 'light'
): Promise<string> {
  const source = String(html ?? '');
  if (!source.includes('language-')) return source;

  let tokenizer: CodeTokenizer;
  try {
    tokenizer = await getTokenizer();
  } catch {
    return source;
  }

  const blocks: Array<{ lang: string; code: string; start: number; end: number }> = [];
  CODE_BLOCK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CODE_BLOCK_RE.exec(source)) !== null) {
    blocks.push({
      lang: match[1],
      code: decodeBasicEntities(match[2]),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  if (blocks.length === 0) return source;

  let out = '';
  let cursor = 0;
  for (const block of blocks) {
    let inner: string | null = null;
    try {
      inner = await tokenizer(block.code, block.lang, theme);
    } catch {
      inner = null;
    }
    out += source.slice(cursor, block.start);
    out += inner
      ? `<pre><code class="language-${escapeHtml(block.lang)}">${inner}</code></pre>`
      : source.slice(block.start, block.end);
    cursor = block.end;
  }
  out += source.slice(cursor);
  return out;
}
