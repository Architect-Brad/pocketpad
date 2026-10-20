// PocketPad Intelli — Base Language Analyzer
// Every language plugin extends this class

export class LanguageAnalyzer {
  constructor(config) {
    this.id = config.id;               // 'javascript', 'python', etc.
    this.name = config.name;            // 'JavaScript', 'Python', etc.
    this.extensions = config.extensions || []; // ['.js', '.ts', '.jsx', '.tsx']
    // Alternate names the app may use for this language (lowercased).
    // e.g. the app calls it 'C++' while the analyzer id is 'cpp'.
    this.aliases = (config.aliases || []).map(a => a.toLowerCase());
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
// Patterns may be a RegExp (name = group 1, params = group 2) or an object
// { pattern, nameGroup, paramsGroup } for languages whose capture-group
// layout differs (e.g. C++ puts the return type in group 1).
export function extractFunctions(content, patterns) {
  const funcs = [];
  const seen = new Set();
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const entry of patterns) {
      const isRegExp = entry instanceof RegExp;
      const pat = isRegExp ? entry : entry.pattern;
      const nameGroup = isRegExp ? 1 : (entry.nameGroup ?? 1);
      const paramsGroup = isRegExp ? 2 : (entry.paramsGroup ?? 2);
      const m = lines[i].match(pat);
      if (m) {
        const name = m[nameGroup];
        if (!name) continue;
        // The same declaration can match several patterns — keep one entry.
        const key = `${i}:${name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        funcs.push({
          name,
          line: i,
          signature: m[0],
          params: m[paramsGroup] || '',
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
      const pattern = rule.pattern;
      // A /g regex carries lastIndex between calls to .test() and would fire
      // on alternating lines — clone it so every line is tested from the start.
      const re = pattern.global ? new RegExp(pattern.source, pattern.flags.replace('g', '')) : pattern;
      const m = re.exec(line);
      if (m) {
        // Point at the offending match rather than the whole line.
        const start = m.index;
        const end = start + (m[0] ? m[0].length : line.length);
        diags.push({
          range: { start: { line: i, character: start }, end: { line: i, character: end } },
          severity: rule.severity || 'warning',
          message: rule.message(line, i),
          source: rule.source || 'intelli',
        });
      }
    }
  }
  return diags;
}
