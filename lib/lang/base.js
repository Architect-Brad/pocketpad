// PocketPad Intelli — Base Language Analyzer
// Every language plugin extends this class

export class LanguageAnalyzer {
  constructor(config) {
    this.id = config.id;               // 'javascript', 'python', etc.
    this.name = config.name;            // 'JavaScript', 'Python', etc.
    this.extensions = config.extensions || []; // ['.js', '.ts', '.jsx', '.tsx']
    this._engine = null;
  }

  init(engine) {
    this._engine = engine;
  }

  // ─── Required: Completions ───
  getCompletions(content, position, language) { return []; }

  // ─── Required: Keywords & Builtins ───
  getKeywords() { return []; }
  getBuiltins() { return []; }

  // ─── Optional: Richer features ───
  getHover(content, position, language) { return null; }
  getDiagnostics(content, language) { return []; }
  getDefinition(content, position, language) { return null; }
  getReferences(content, position, language) { return []; }
  getSignature(content, position, language) { return null; }
  getSymbolIndex(content, language) { return []; }
}

// ─── Completion Item Builder ───
export function CompletionItem(label, kind, opts = {}) {
  return {
    label,
    kind, // 'keyword', 'builtin', 'function', 'class', 'variable', 'snippet', 'text', 'property'
    detail: opts.detail || '',
    documentation: opts.documentation || '',
    insertText: opts.insertText || label,
    sortOrder: opts.sortOrder ?? 50,
    source: opts.source || 'language',
    deprecated: opts.deprecated || false,
    ...(opts.extra || {}),
  };
}

// ─── Helper: Extract identifier at position ───
export function identifierAt(content, position) {
  const lines = content.split('\n');
  const line = lines[position.line] || '';
  const before = line.slice(0, position.ch);
  const m = before.match(/[A-Za-z_$][A-Za-z0-9_$]*$/);
  return m ? m[0] : '';
}

// ─── Helper: Find all identifiers in content ───
export function allIdentifiers(content) {
  const ids = new Map();
  const re = /\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g;
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(content)) !== null) {
    const name = m[1];
    if (!ids.has(name)) ids.set(name, 0);
    ids.set(name, ids.get(name) + 1);
  }
  return ids;
}

// ─── Helper: Extract function names from patterns ───
export function extractFunctions(content, patterns) {
  const funcs = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const pat of patterns) {
      const m = lines[i].match(pat);
      if (m) {
        funcs.push({
          name: m[1],
          line: i,
          signature: m[0],
          params: m[2] || '',
        });
      }
    }
  }
  return funcs;
}

// ─── Helper: Extract class names ───
export function extractClasses(content, patterns) {
  const classes = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const pat of patterns) {
      const m = lines[i].match(pat);
      if (m) {
        classes.push({
          name: m[1],
          line: i,
          declaration: m[0],
        });
      }
    }
  }
  return classes;
}

// ─── Helper: Simple diagnostics from patterns ───
export function patternDiagnostics(content, rules) {
  const diags = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of rules) {
      if (rule.pattern.test(line)) {
        diags.push({
          range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } },
          severity: rule.severity || 'warning',
          message: rule.message(line, i),
          source: rule.source || 'intelli',
        });
      }
    }
  }
  return diags;
}
