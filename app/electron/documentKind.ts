/**
 * 独立应用能打开哪些文件，以及安装包要向系统登记哪些类型。
 * 只看文件名，不读内容。是不是真的文本，打开前再看文件头。
 *
 * 两套名单不要混：
 * - 能打开：文本都收。文件树、打开对话框、拖进窗口、命令行都走这里。
 * - 系统关联：平时没有默认程序的才设成默认打开（比如 .pub）。
 *   已经有程序的（.txt、网页、JSON、代码）只登记成「打开方式」，不抢走原来的程序。
 *   一点就会执行的（.bat、.ps1、.reg、.command）能在应用里看，不向系统登记。
 */
import type { OsFileAssociation } from './fileAssociations';

export type StructuredKind = 'json' | 'jsonl';
export type PreviewKind = 'markdown' | StructuredKind | 'plain';

/** 当作 Markdown 渲染。安装包里这一组是文档的主人。 */
export const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'mdx', 'mkd', 'mkdn', 'mdown', 'mdwn'] as const;

/** JSON 树。geojson 是 JSON；ndjson 按行，和 JSONL 一样。jsonc / json5 不是严格 JSON，当普通文本。 */
const JSON_TREE_EXTENSIONS = ['json', 'geojson'] as const;
const JSONL_EXTENSIONS = ['jsonl', 'ndjson'] as const;

/**
 * 干净的系统上通常没有默认程序。安装后双击用 Markly 打开。
 * .pub 多半是公钥；Publisher 的二进制同名文件打开时会拒绝。
 */
export const UNCLAIMED_TEXT_EXTENSIONS = [
  'adoc',
  'asc',
  'asciidoc',
  'ass',
  'cfg',
  'conf',
  'config',
  'csr',
  'desktop',
  'diff',
  'dockerignore',
  'editorconfig',
  'env',
  'gitattributes',
  'gitignore',
  'ini',
  'key',
  'nfo',
  'npmrc',
  'nvmrc',
  'org',
  'patch',
  'pem',
  'po',
  'pot',
  'properties',
  'pub',
  'rst',
  'service',
  'srt',
  'ssa',
  'sub',
  'textile',
  'toml',
  'vtt',
  'yaml',
  'yml',
] as const;

/**
 * 系统或常见程序已经会打开。只出现在「打开方式」里。
 * JSON 也放这里：这台电脑若已经选过打开方式，不改掉。
 */
export const ALTERNATE_TEXT_EXTENSIONS = [
  'bash',
  'bib',
  'c',
  'cc',
  'cjs',
  'cmake',
  'cpp',
  'cs',
  'css',
  'csv',
  'dart',
  'fish',
  'geojson',
  'go',
  'gradle',
  'h',
  'hh',
  'hpp',
  'htm',
  'html',
  'ics',
  'java',
  'js',
  'json',
  'json5',
  'jsonc',
  'jsonl',
  'jsx',
  'kt',
  'kts',
  'latex',
  'less',
  'log',
  'lua',
  'mjs',
  'mk',
  'ndjson',
  'php',
  'pl',
  'plist',
  'pm',
  'py',
  'r',
  'rb',
  'rs',
  'sass',
  'scala',
  'scss',
  'sh',
  'sql',
  'strings',
  'sty',
  'svelte',
  'svg',
  'swift',
  'tex',
  'text',
  'ts',
  'tsv',
  'tsx',
  'txt',
  'vcf',
  'vue',
  'xhtml',
  'xml',
  'zsh',
] as const;

/** 能在应用里当文本打开，但不写进系统关联，避免双击就不再执行。 */
export const IN_APP_ONLY_EXTENSIONS = ['bat', 'cmd', 'com', 'command', 'lock', 'ps1', 'reg'] as const;

/** 没有扩展名、但约定就是文本的文件名。比较时忽略大小写。 */
const EXTENSIONLESS_TEXT_NAMES = [
  'appfile',
  'authors',
  'brewfile',
  'changelog',
  'codeowners',
  'containerfile',
  'contributing',
  'copying',
  'dockerfile',
  'fastfile',
  'gemfile',
  'go.mod',
  'go.sum',
  'install',
  'jenkinsfile',
  'justfile',
  'licence',
  'license',
  'makefile',
  'notice',
  'pipfile',
  'podfile',
  'procfile',
  'rakefile',
  'readme',
  'todo',
  'vagrantfile',
  'version',
] as const;

/** 以点开头、系统扩展名是空的文本文件。文件树仍会藏起点文件，拖进来可以开。 */
const DOTFILE_TEXT_NAMES = [
  '.babelrc',
  '.bash_profile',
  '.bashrc',
  '.browserslistrc',
  '.dockerignore',
  '.editorconfig',
  '.eslintignore',
  '.eslintrc',
  '.gitattributes',
  '.gitignore',
  '.gitmodules',
  '.htaccess',
  '.node-version',
  '.npmignore',
  '.npmrc',
  '.nvmrc',
  '.prettierignore',
  '.prettierrc',
  '.profile',
  '.python-version',
  '.ruby-version',
  '.stylelintrc',
  '.tool-versions',
  '.vimrc',
  '.yarnrc',
  '.zprofile',
  '.zshrc',
] as const;

const JSON_TREE_SET = new Set<string>(JSON_TREE_EXTENSIONS);
const JSONL_SET = new Set<string>(JSONL_EXTENSIONS);
const MARKDOWN_SET = new Set<string>(MARKDOWN_EXTENSIONS);
const EXTENSIONLESS_SET = new Set<string>(EXTENSIONLESS_TEXT_NAMES);
const DOTFILE_SET = new Set<string>(DOTFILE_TEXT_NAMES);

export const OPEN_TEXT_EXTENSIONS: readonly string[] = [
  ...MARKDOWN_EXTENSIONS,
  ...JSON_TREE_EXTENSIONS,
  ...JSONL_EXTENSIONS,
  ...UNCLAIMED_TEXT_EXTENSIONS,
  ...ALTERNATE_TEXT_EXTENSIONS,
  ...IN_APP_ONLY_EXTENSIONS,
].filter((ext, index, all) => all.indexOf(ext) === index);

const OPEN_TEXT_SET = new Set<string>(OPEN_TEXT_EXTENSIONS);

export const OS_FILE_ASSOCIATIONS: readonly OsFileAssociation[] = [
  {
    ext: [...MARKDOWN_EXTENSIONS],
    name: 'Markdown Document',
    description: 'Markdown Document',
    role: 'Editor',
    rank: 'Owner',
  },
  {
    ext: [...UNCLAIMED_TEXT_EXTENSIONS],
    name: 'Unclaimed Text',
    description: 'Text file without a usual application',
    role: 'Editor',
    rank: 'Default',
  },
  {
    ext: [...ALTERNATE_TEXT_EXTENSIONS],
    name: 'Text Document',
    description: 'Text Document',
    role: 'Editor',
    rank: 'Alternate',
  },
];

export function fileBasename(name: string): string {
  const base = String(name ?? '').split(/[/\\]/).pop() ?? '';
  return base.trim();
}

/** 最后一个点后面的扩展名，不含点。`.gitignore` 这种没有扩展名。 */
export function fileExtension(name: string): string {
  const base = fileBasename(name);
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

function isEnvStyleName(base: string): boolean {
  const lower = base.toLowerCase();
  return lower === '.env' || lower.startsWith('.env.') || lower.endsWith('.env') || lower.includes('.env.');
}

export function isMarkdownFileName(name: string): boolean {
  return MARKDOWN_SET.has(fileExtension(name));
}

/** 从文件名或完整路径判断是不是 JSON / JSONL。先认 JSONL，避免被 JSON 前缀吃掉。 */
export function structuredKindFromName(name: string): StructuredKind | null {
  const ext = fileExtension(name);
  if (JSONL_SET.has(ext)) return 'jsonl';
  if (JSON_TREE_SET.has(ext)) return 'json';
  return null;
}

/**
 * 预览怎么画。没有路径的空白标签仍是 Markdown。
 * 其它文本不送进 Markdown，避免井号和星号被排成标题和强调。
 */
export function previewKindFromName(name: string): PreviewKind {
  if (!fileBasename(name)) return 'markdown';
  if (isMarkdownFileName(name)) return 'markdown';
  return structuredKindFromName(name) ?? 'plain';
}

/** 文件树、打开对话框、拖拽候选：只看名字像不像文本。 */
export function isOpenableDocumentName(name: string): boolean {
  const base = fileBasename(name);
  if (!base || base === '.' || base === '..') return false;
  const lower = base.toLowerCase();
  if (EXTENSIONLESS_SET.has(lower) || DOTFILE_SET.has(lower) || isEnvStyleName(base)) return true;
  if (lower.endsWith('.lock')) return true;
  const ext = fileExtension(base);
  return ext !== '' && OPEN_TEXT_SET.has(ext);
}

/** 开发时 argv 是 [可执行文件, 脚本, ...用户参数]；打包后是 [应用, ...用户参数]。 */
export function userLaunchArgs(argv: readonly string[], packaged: boolean): string[] {
  const start = packaged ? 1 : 2;
  const out: string[] = [];
  for (let i = Math.max(0, start); i < argv.length; i++) {
    const raw = argv[i];
    if (typeof raw !== 'string') continue;
    const arg = raw.trim();
    if (!arg || arg.startsWith('-')) continue;
    out.push(arg);
  }
  return out;
}

export function openDocumentFilters(): { name: string; extensions: string[] }[] {
  return [
    { name: '文本文件', extensions: [...OPEN_TEXT_EXTENSIONS] },
    { name: 'Markdown', extensions: [...MARKDOWN_EXTENSIONS] },
    { name: 'JSON', extensions: ['json', 'jsonl', 'ndjson', 'geojson'] },
    { name: '所有文件', extensions: ['*'] },
  ];
}

export function saveDocumentFilters(): { name: string; extensions: string[] }[] {
  return [
    { name: 'Markdown', extensions: ['md', 'markdown', 'mdx'] },
    { name: 'JSON', extensions: ['json', 'jsonl'] },
    { name: '文本文件', extensions: [...OPEN_TEXT_EXTENSIONS] },
    { name: '所有文件', extensions: ['*'] },
  ];
}
