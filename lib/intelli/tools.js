// PocketPad Intelli — Editor tools for LLM tool calling
//
// These let the assistant actually drive the editor instead of only talking
// about code: create files, read them, insert and replace text, navigate
// symbols, run the program, and so on.
//
// Every tool talks to the app through `window._ppEditor` (exposed by
// index.html) so this module never needs to know how the editor is built.
// Intelli-backed tools (diagnostics, symbols, go-to-definition) lazily import
// the engine bridge.

const ed = () => (typeof window !== 'undefined' ? window._ppEditor : null);

function fail(msg, extra) {
  return { ok: false, error: msg, ...(extra || {}) };
}

function ok(data) {
  return { ok: true, ...(data || {}) };
}

/**
 * Resolve a target tab from { tabId } or { filename }, defaulting to active.
 *
 * When the caller names a file explicitly we must NOT silently fall back to
 * the active tab — that would edit the wrong file.
 */
function resolveTab(args = {}) {
  const api = ed();
  if (!api) return null;
  if (args.tabId) {
    return api.getTab(args.tabId) || null;
  }
  if (args.filename) {
    const wanted = String(args.filename).toLowerCase();
    const all = api.listTabs();
    const exact = all.find(x => x.filename.toLowerCase() === wanted);
    if (exact) return api.getTab(exact.id);
    // A partial match is only safe when it is unambiguous.
    const partial = all.filter(x => x.filename.toLowerCase().includes(wanted));
    if (partial.length === 1) return api.getTab(partial[0].id);
    return null;
  }
  return api.getActiveTab();
}

function clip(text, max = 8000) {
  const s = String(text ?? '');
  if (s.length <= max) return { text: s, truncated: false };
  return { text: s.slice(0, max), truncated: true };
}

// ─── Tool definitions ───
// `parameters` is plain JSON Schema — Anthropic calls it input_schema,
// OpenAI nests it under function.parameters, Gemini uses functionDeclarations.

export const TOOLS = [
  {
    name: 'list_tabs',
    description: 'List the files currently open in the editor, with their language and size.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'read_file',
    description: 'Read the full text of a file. Defaults to the active file. Use this before editing a file you have not seen.',
    parameters: {
      type: 'object',
      properties: {
        tabId: { type: 'string', description: 'Id of the tab to read. Omit for the active file.' },
        filename: { type: 'string', description: 'File name to read. Omit for the active file.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'create_file',
    description: 'Create a new file (tab) with the given content and open it in the editor.',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'File name including extension, e.g. "utils.js".' },
        content: { type: 'string', description: 'Full text content of the new file.' },
        language: { type: 'string', description: 'Language name, e.g. "JavaScript", "Python". Optional — inferred from the extension.' },
      },
      required: ['filename'],
      additionalProperties: false,
    },
  },
  {
    name: 'switch_tab',
    description: 'Make a file the active tab so subsequent edits target it.',
    parameters: {
      type: 'object',
      properties: {
        tabId: { type: 'string', description: 'Id of the tab to activate.' },
        filename: { type: 'string', description: 'File name to activate.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'close_tab',
    description: 'Close a file tab.',
    parameters: {
      type: 'object',
      properties: {
        tabId: { type: 'string', description: 'Id of the tab to close.' },
        filename: { type: 'string', description: 'File name to close.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'insert_code',
    description: 'Insert code into a file. With no line/column it inserts at the current cursor position.',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The text to insert.' },
        line: { type: 'integer', description: '1-based line number to insert at. Omit to use the cursor.' },
        column: { type: 'integer', description: '0-based column. Omit to use the cursor.' },
        tabId: { type: 'string', description: 'Target file. Omit for the active file.' },
      },
      required: ['code'],
      additionalProperties: false,
    },
  },
  {
    name: 'replace_text',
    description: 'Find and replace text inside a file. Use read_file first so you know the exact text to match.',
    parameters: {
      type: 'object',
      properties: {
        find: { type: 'string', description: 'Text (or regex when regex is true) to find.' },
        replace: { type: 'string', description: 'Replacement text.' },
        regex: { type: 'boolean', description: 'Treat find as a regular expression. Default false.' },
        all: { type: 'boolean', description: 'Replace every occurrence. Default true.' },
        tabId: { type: 'string', description: 'Target file. Omit for the active file.' },
      },
      required: ['find', 'replace'],
      additionalProperties: false,
    },
  },
  {
    name: 'replace_selection',
    description: 'Replace the text the user currently has selected. If nothing is selected, insert at the cursor.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Replacement text.' },
        tabId: { type: 'string', description: 'Target file. Omit for the active file.' },
      },
      required: ['text'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_language',
    description: 'Set the syntax/language mode of a file.',
    parameters: {
      type: 'object',
      properties: {
        language: { type: 'string', description: 'Language name, e.g. "JavaScript", "Python", "HTML".' },
        tabId: { type: 'string', description: 'Target file. Omit for the active file.' },
      },
      required: ['language'],
      additionalProperties: false,
    },
  },
  {
    name: 'rename_symbol',
    description: 'Rename every occurrence of a symbol in a file.',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Current symbol name.' },
        to: { type: 'string', description: 'New symbol name.' },
        tabId: { type: 'string', description: 'Target file. Omit for the active file.' },
      },
      required: ['from', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'format_code',
    description: 'Format the file (JSON/CSS/HTML get real formatters; other languages get a basic re-indent).',
    parameters: {
      type: 'object',
      properties: {
        tabId: { type: 'string', description: 'Target file. Omit for the active file.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'undo',
    description: 'Undo the last edit in a file.',
    parameters: {
      type: 'object',
      properties: { tabId: { type: 'string', description: 'Target file. Omit for the active file.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'redo',
    description: 'Redo the last undone edit in a file.',
    parameters: {
      type: 'object',
      properties: { tabId: { type: 'string', description: 'Target file. Omit for the active file.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'get_selection',
    description: 'Get the currently selected text plus the cursor position and surrounding lines for context.',
    parameters: {
      type: 'object',
      properties: { tabId: { type: 'string', description: 'Target file. Omit for the active file.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'list_symbols',
    description: 'List the functions, classes and variables defined in a file (a symbol outline).',
    parameters: {
      type: 'object',
      properties: { tabId: { type: 'string', description: 'Target file. Omit for the active file.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'find_definition',
    description: 'Find where a symbol is defined. Pass the symbol name, or omit it to use the symbol under the cursor.',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol name to look up.' },
        tabId: { type: 'string', description: 'Target file. Omit for the active file.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'find_references',
    description: 'Find every place a symbol is used in a file.',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol name to look up.' },
        tabId: { type: 'string', description: 'Target file. Omit for the active file.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_diagnostics',
    description: 'Get the lint/analysis problems detected in a file.',
    parameters: {
      type: 'object',
      properties: { tabId: { type: 'string', description: 'Target file. Omit for the active file.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'search_files',
    description: 'Search every open file for text and return the matching lines.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to search for.' },
        regex: { type: 'boolean', description: 'Treat the query as a regular expression. Default false.' },
        caseSensitive: { type: 'boolean', description: 'Match case exactly. Default false.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'run_code',
    description: 'Run the file and return the console output. Needs a network connection for languages other than JavaScript and Python.',
    parameters: {
      type: 'object',
      properties: { tabId: { type: 'string', description: 'File to run. Omit for the active file.' } },
      additionalProperties: false,
    },
  },
];

// ─── Implementations ───

const IMPL = {
  list_tabs() {
    const api = ed();
    if (!api) return fail('Editor API unavailable');
    return ok({
      tabs: api.listTabs().map(t => ({
        id: t.id,
        filename: t.filename,
        language: t.language,
        modified: t.modified,
        lines: t.lines,
        active: t.active,
      })),
    });
  },

  read_file(args = {}) {
    const tab = resolveTab(args);
    if (!tab) return fail('No such file. Call list_tabs to see the open files.');
    const content = tab.cm.getValue();
    const c = clip(content, 12000);
    return ok({
      filename: tab.filename,
      language: tab.lang?.name || 'Plain Text',
      lines: tab.cm.lineCount(),
      content: c.text,
      truncated: c.truncated,
    });
  },

  create_file(args = {}) {
    const api = ed();
    if (!api) return fail('Editor API unavailable');
    const filename = String(args.filename || '').trim();
    if (!filename) return fail('filename is required');
    const content = String(args.content ?? '');
    const tab = api.newTab(filename, content, args.language || undefined);
    if (!tab) return fail('Could not create the file');
    return ok({ tabId: tab.id, filename: tab.filename, language: tab.lang?.name, lines: tab.cm.lineCount() });
  },

  switch_tab(args = {}) {
    const api = ed();
    if (!api) return fail('Editor API unavailable');
    const tab = resolveTab(args);
    if (!tab) return fail('No such file. Call list_tabs to see the open files.');
    api.switchTab(tab.id);
    return ok({ tabId: tab.id, filename: tab.filename });
  },

  close_tab(args = {}) {
    const api = ed();
    if (!api) return fail('Editor API unavailable');
    const tab = resolveTab(args);
    if (!tab) return fail('No such file. Call list_tabs to see the open files.');
    const name = tab.filename;
    api.closeTab(tab.id);
    return ok({ closed: name });
  },

  insert_code(args = {}) {
    const tab = resolveTab(args);
    if (!tab) return fail('No such file.');
    const code = String(args.code ?? '');
    if (!code) return fail('code is required');
    const cm = tab.cm;
    let pos;
    if (typeof args.line === 'number') {
      const line = Math.max(0, Math.min(cm.lineCount() - 1, args.line - 1));
      pos = { line, ch: Math.max(0, args.column || 0) };
    } else {
      pos = cm.getCursor();
    }
    cm.replaceRange(code, pos, pos, 'end');
    cm.setCursor({ line: pos.line, ch: pos.ch + code.length });
    cm.focus();
    return ok({ filename: tab.filename, line: pos.line + 1, inserted: code.length });
  },

  replace_text(args = {}) {
    const tab = resolveTab(args);
    if (!tab) return fail('No such file.');
    const find = String(args.find ?? '');
    if (!find) return fail('find is required');
    const replace = String(args.replace ?? '');
    const all = args.all !== false;
    const cm = tab.cm;
    const content = cm.getValue();

    let re;
    try {
      re = args.regex ? new RegExp(find, all ? 'g' : '') : new RegExp(escapeRegex(find), all ? 'g' : '');
    } catch (e) {
      return fail('Invalid regular expression: ' + e.message);
    }
    const matches = content.match(re);
    if (!matches || !matches.length) {
      return ok({ filename: tab.filename, replacements: 0, note: 'No match found — read_file first to check the exact text.' });
    }
    const updated = content.replace(re, replace);
    const cursor = cm.getCursor();
    cm.setValue(updated);
    cm.setCursor(cursor);
    cm.focus();
    return ok({ filename: tab.filename, replacements: matches.length });
  },

  replace_selection(args = {}) {
    const tab = resolveTab(args);
    if (!tab) return fail('No such file.');
    const text = String(args.text ?? '');
    const cm = tab.cm;
    const sel = cm.getSelection();
    const from = cm.getCursor('from');
    const to = cm.getCursor('to');
    cm.replaceRange(text, from, to, 'end');
    cm.focus();
    return ok({
      filename: tab.filename,
      replaced: sel.length,
      hadSelection: sel.length > 0,
    });
  },

  set_language(args = {}) {
    const tab = resolveTab(args);
    if (!tab) return fail('No such file.');
    const name = String(args.language || '').trim();
    if (!name) return fail('language is required');
    const applied = ed().setLanguage(tab.id, name);
    if (!applied) return fail(`Unknown language "${name}". Use one of: ${(ed().languageNames?.() || []).join(', ')}`);
    return ok({ filename: tab.filename, language: applied });
  },

  rename_symbol(args = {}) {
    const tab = resolveTab(args);
    if (!tab) return fail('No such file.');
    const from = String(args.from ?? '').trim();
    const to = String(args.to ?? '').trim();
    if (!from || !to) return fail('from and to are required');
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(from) || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(to)) {
      return fail('Symbol names must be valid identifiers');
    }
    const cm = tab.cm;
    const content = cm.getValue();
    const re = new RegExp('\\b' + escapeRegex(from) + '\\b', 'g');
    const matches = content.match(re);
    if (!matches || !matches.length) return ok({ filename: tab.filename, replacements: 0 });
    const cursor = cm.getCursor();
    cm.setValue(content.replace(re, to));
    cm.setCursor(cursor);
    cm.focus();
    return ok({ filename: tab.filename, from, to, replacements: matches.length });
  },

  format_code(args = {}) {
    const tab = resolveTab(args);
    if (!tab) return fail('No such file.');
    const formatted = ed().formatCode(tab.id);
    if (!formatted) return fail('Could not format this file');
    return ok({ filename: tab.filename, formatted: true });
  },

  undo(args = {}) {
    const tab = resolveTab(args);
    if (!tab) return fail('No such file.');
    tab.cm.undo();
    return ok({ filename: tab.filename });
  },

  redo(args = {}) {
    const tab = resolveTab(args);
    if (!tab) return fail('No such file.');
    tab.cm.redo();
    return ok({ filename: tab.filename });
  },

  get_selection(args = {}) {
    const tab = resolveTab(args);
    if (!tab) return fail('No such file.');
    const cm = tab.cm;
    const cursor = cm.getCursor();
    const sel = cm.getSelection();
    const line = cm.getLine(cursor.line) || '';
    const start = Math.max(0, cursor.line - 4);
    const end = Math.min(cm.lineCount() - 1, cursor.line + 4);
    const context = cm.getRange({ line: start, ch: 0 }, { line: end, ch: 0 });
    return ok({
      filename: tab.filename,
      selection: sel,
      hasSelection: sel.length > 0,
      cursor: { line: cursor.line + 1, column: cursor.ch + 1 },
      currentLine: line,
      context,
    });
  },

  async list_symbols(args = {}) {
    const tab = resolveTab(args);
    if (!tab) return fail('No such file.');
    try {
      const bridge = await import('./bridge.js');
      const symbols = await bridge.intelliSymbolOutline(tab.id);
      return ok({ filename: tab.filename, symbols });
    } catch (e) {
      return fail('Symbol index unavailable: ' + (e?.message || e));
    }
  },

  async find_definition(args = {}) {
    const tab = resolveTab(args);
    if (!tab) return fail('No such file.');
    try {
      const bridge = await import('./bridge.js');
      const res = await bridge.intelliFindDefinition(tab.id, args.symbol);
      if (!res) return ok({ filename: tab.filename, found: false });
      return ok({ filename: tab.filename, found: true, ...res });
    } catch (e) {
      return fail('Definition lookup unavailable: ' + (e?.message || e));
    }
  },

  async find_references(args = {}) {
    const tab = resolveTab(args);
    if (!tab) return fail('No such file.');
    try {
      const bridge = await import('./bridge.js');
      const refs = await bridge.intelliFindReferences(tab.id, args.symbol);
      return ok({ filename: tab.filename, count: refs.length, references: refs });
    } catch (e) {
      return fail('Reference lookup unavailable: ' + (e?.message || e));
    }
  },

  async get_diagnostics(args = {}) {
    const tab = resolveTab(args);
    if (!tab) return fail('No such file.');
    try {
      const bridge = await import('./bridge.js');
      const diags = await bridge.intelliGetDiagnostics(tab.id);
      return ok({
        filename: tab.filename,
        count: diags.length,
        problems: diags.map(d => ({ severity: d.severity, message: d.message, line: (d.range?.start?.line ?? 0) + 1 })),
      });
    } catch (e) {
      return fail('Diagnostics unavailable: ' + (e?.message || e));
    }
  },

  search_files(args = {}) {
    const api = ed();
    if (!api) return fail('Editor API unavailable');
    const query = String(args.query ?? '');
    if (!query) return fail('query is required');
    let re;
    try {
      const flags = args.caseSensitive ? 'g' : 'gi';
      re = args.regex ? new RegExp(query, flags) : new RegExp(escapeRegex(query), flags);
    } catch (e) {
      return fail('Invalid regular expression: ' + e.message);
    }
    const results = [];
    for (const info of api.listTabs()) {
      const tab = api.getTab(info.id);
      if (!tab) continue;
      const lines = tab.cm.getValue().split('\n');
      for (let i = 0; i < lines.length; i++) {
        re.lastIndex = 0;
        if (re.test(lines[i])) {
          results.push({ filename: info.filename, line: i + 1, text: lines[i].trim().slice(0, 200) });
          if (results.length >= 100) break;
        }
      }
      if (results.length >= 100) break;
    }
    return ok({ query, count: results.length, matches: results });
  },

  async run_code(args = {}) {
    const tab = resolveTab(args);
    if (!tab) return fail('No such file.');
    const api = ed();
    if (!api) return fail('Editor API unavailable');
    try {
      const output = await api.runAndCapture(tab.id);
      const c = clip(output, 4000);
      return ok({ filename: tab.filename, language: tab.lang?.name, output: c.text, truncated: c.truncated });
    } catch (e) {
      return fail('Run failed: ' + (e?.message || e));
    }
  },
};

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Execute a tool by name.
 * Always resolves — a failing tool returns { ok: false, error } so the model
 * can correct itself instead of the whole turn blowing up.
 */
export async function executeTool(name, args = {}) {
  const fn = IMPL[name];
  if (!fn) return fail(`Unknown tool "${name}"`);
  try {
    const result = await fn(args || {});
    return result && typeof result === 'object' ? result : { ok: true, result };
  } catch (e) {
    return fail(`${name} failed: ${e?.message || e}`);
  }
}

/** One-line human summary of a tool call, for the chat UI. */
export function describeTool(name, args = {}) {
  const a = args || {};
  switch (name) {
    case 'list_tabs': return 'List open files';
    case 'read_file': return `Read ${a.filename || 'active file'}`;
    case 'create_file': return `Create ${a.filename || 'file'}`;
    case 'switch_tab': return `Switch to ${a.filename || a.tabId || 'file'}`;
    case 'close_tab': return `Close ${a.filename || a.tabId || 'file'}`;
    case 'insert_code': return 'Insert code';
    case 'replace_text': return `Replace "${truncate(a.find)}"`;
    case 'replace_selection': return 'Replace selection';
    case 'set_language': return `Set language to ${a.language}`;
    case 'rename_symbol': return `Rename ${a.from} → ${a.to}`;
    case 'format_code': return 'Format code';
    case 'undo': return 'Undo';
    case 'redo': return 'Redo';
    case 'get_selection': return 'Read selection';
    case 'list_symbols': return 'List symbols';
    case 'find_definition': return `Find definition of ${a.symbol || 'symbol'}`;
    case 'find_references': return `Find references to ${a.symbol || 'symbol'}`;
    case 'get_diagnostics': return 'Check diagnostics';
    case 'search_files': return `Search "${truncate(a.query)}"`;
    case 'run_code': return 'Run code';
    default: return name;
  }
}

function truncate(s, n = 40) {
  const t = String(s ?? '');
  return t.length > n ? t.slice(0, n) + '…' : t;
}

export default { TOOLS, executeTool, describeTool };
