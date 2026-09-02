import { highlightJson } from '../jsonHighlight';

const LANG_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  svelte: 'html',
};

const JS_KEYWORDS = [
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'null',
  'of',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'undefined',
  'var',
  'void',
  'while',
  'yield',
  'interface',
  'type',
  'enum',
  'implements',
  'private',
  'protected',
  'public',
  'readonly',
  'declare',
  'namespace',
  'module',
  'require',
];

const PY_KEYWORDS = [
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'False',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'None',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'True',
  'try',
  'while',
  'with',
  'yield',
];

const BASH_KEYWORDS = ['if', 'then', 'else', 'elif', 'fi', 'for', 'do', 'done', 'in', 'case', 'esac', 'function', 'return', 'export', 'local'];

const CSS_KEYWORDS = [
  'important',
  'inherit',
  'initial',
  'unset',
  'revert',
  'from',
  'to',
  'and',
  'or',
  'not',
  'only',
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function span(className: string, text: string): string {
  return `<span class="${className}">${text}</span>`;
}

/** Normalize fenced-code language tags from model output. */
export function normalizeCodeLanguage(lang: string | undefined): string {
  const raw = (lang ?? '').trim().toLowerCase();
  if (!raw) return 'plaintext';
  return LANG_ALIASES[raw] ?? raw;
}

type HighlightProfile = {
  blockComments?: boolean;
  lineComments?: boolean;
  keywords?: readonly string[];
  tagAttrs?: boolean;
};

const PROFILES: Record<string, HighlightProfile> = {
  javascript: { blockComments: true, lineComments: true, keywords: JS_KEYWORDS },
  typescript: { blockComments: true, lineComments: true, keywords: JS_KEYWORDS },
  python: { blockComments: false, lineComments: true, keywords: PY_KEYWORDS },
  bash: { blockComments: false, lineComments: true, keywords: BASH_KEYWORDS },
  css: { blockComments: true, lineComments: false, keywords: CSS_KEYWORDS },
  html: { blockComments: true, lineComments: false, tagAttrs: true },
  yaml: { lineComments: false, keywords: [] },
  markdown: { lineComments: false, keywords: [] },
  plaintext: {},
};

function protectStringsAndComments(source: string, profile: HighlightProfile) {
  const slots: string[] = [];
  let text = escapeHtml(source);

  const stash = (match: string, className: string) => {
    const id = slots.length;
    slots.push(span(className, match));
    return `\uE000${String.fromCharCode(0xf000 + id)}\uE001`;
  };

  text = text.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, (m) =>
    stash(m, 'hljs-string'),
  );

  if (profile.blockComments) {
    text = text.replace(/\/\*[\s\S]*?\*\//g, (m) => stash(m, 'hljs-comment'));
  }
  if (profile.lineComments) {
    text = text.replace(/(^|\n)(\s*)(\/\/[^\n]*|#[^\n]*)/g, (_m, lead, indent, comment) =>
      `${lead}${indent}${stash(comment, 'hljs-comment')}`,
    );
  }

  if (profile.tagAttrs) {
    text = text.replace(/&lt;(\/?)([\w-]+)/g, (_m, slash, tag) =>
      `${span('hljs-punctuation', '&lt;')}${slash}${span('hljs-tag', tag)}`,
    );
    text = text.replace(/\s([\w-]+)(=)/g, (_m, attr, eq) => ` ${span('hljs-attr', attr)}${span('hljs-punctuation', eq)}`);
  }

  if (profile.keywords?.length) {
    const pattern = new RegExp(`\\b(${profile.keywords.join('|')})\\b`, 'g');
    text = text.replace(pattern, (m) => span('hljs-keyword', m));
  }

  text = text.replace(/\b(-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)\b/g, (m) => span('hljs-number', m));
  text = text.replace(/\b([A-Z][A-Z0-9_]{2,})\b/g, (m) => span('hljs-variable constant_', m));

  return text.replace(/\uE000([\uF000-\uF0FF])\uE001/g, (_m, ch) => slots[ch.charCodeAt(0) - 0xf000] ?? '');
}

/** Syntax-highlight a fenced code block for {@html} rendering (sanitize after). */
export function highlightSourceCode(source: string, lang: string | undefined): string {
  const language = normalizeCodeLanguage(lang);

  if (language === 'json') {
    return highlightJson(source);
  }

  const profile = PROFILES[language] ?? PROFILES.plaintext;
  const highlighted = protectStringsAndComments(source, profile);
  return highlighted;
}
