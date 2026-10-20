// PocketPad Intelli — Bridge to existing PocketPad editor
// This module connects the Intelli engine to the CodeMirror-based editor

import { PocketIntelli } from './core.js';
import JavaScriptAnalyzer from '../lang/javascript.js';
import PythonAnalyzer from '../lang/python.js';
import GoAnalyzer from '../lang/go.js';
import RustAnalyzer from '../lang/rust.js';
import CppAnalyzer from '../lang/cpp.js';
import { HTMLAnalyzer, CSSAnalyzer } from '../lang/html-css.js';
import assistantEngine from './assistant.js';

// ─── Lazy singleton ───
let _engine = null;
let _loading = null;   // shared promise while the engine is being created

async function ensureEngine() {
  if (_engine) return _engine;
  // Share a single in-flight promise. The old code polled with setInterval and
  // never cleared _loading on failure, so a single throw hung every caller.
  if (_loading) return _loading;

  _loading = (async () => {
    const engine = new PocketIntelli();
    engine.registerLanguage(new JavaScriptAnalyzer());
    engine.registerLanguage(new PythonAnalyzer());
    engine.registerLanguage(new GoAnalyzer());
    engine.registerLanguage(new RustAnalyzer());
    engine.registerLanguage(new CppAnalyzer());
    engine.registerLanguage(new HTMLAnalyzer());
    engine.registerLanguage(new CSSAnalyzer());
    await engine.init();
    _engine = engine;
    return engine;
  })();

  try {
    return await _loading;
  } catch (err) {
    _loading = null;   // allow a later retry
    throw err;
  }
}

// ─── Sync tab state to engine ───
function syncTabToEngine(tab) {
  if (!tab || !_engine) return;
  const docId = tab.id;
  const content = tab.cm.getValue();
  // tab.lang can be string or {name: string}
  const langName = typeof tab.lang === 'string'
    ? tab.lang
    : (tab.lang?.name || 'Plain Text');
  _engine.docs.track(docId, content, langName);
}

function syncAllTabs(state) {
  if (!state || !_engine) return;
  state.tabs.forEach(syncTabToEngine);
}

// ─── Snippet placeholder expansion ───
// Snippet bodies use ${1:name} / ${2} placeholders. Inserting them verbatim
// left the raw "${1:name}" text in the editor.
function expandSnippet(text) {
  const placeholders = [];
  let out = '';
  let i = 0;
  const re = /\$\{(\d+):?([^}]*)\}|\$(\d+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    out += text.slice(i, m.index);
    const index = m[1] ? parseInt(m[1], 10) : parseInt(m[3], 10);
    const def = m[2] !== undefined ? m[2] : '';
    const start = out.length;
    out += def;
    placeholders.push({ index, start, end: out.length });
    i = m.index + m[0].length;
  }
  out += text.slice(i);
  return { text: out, placeholders };
}

// ─── Enhanced autocomplete (replaces hybridCompletionHint) ───
async function intelliCompletionHint(cm, explicitOverride) {
  if (!_engine) return null;
  const tab = findTabByCM(cm);
  if (!tab) return null;

  const cur = cm.getCursor();
  const token = cm.getTokenAt(cur);
  const raw = token.string || '';
  const prefixMatch = raw.match(/[A-Za-z_$#][A-Za-z0-9_$#]*$/);
  let prefix = prefixMatch ? prefixMatch[0] : '';

  if (!prefix && /<$/.test(cm.getRange({ line: cur.line, ch: Math.max(0, cur.ch - 1) }, cur))) {
    prefix = '';
  }
  // CodeMirror's show-hint calls the hint function as hint(cm, options), so a
  // second "explicit" parameter would always receive a truthy options object.
  // Read the flag the app sets on cm.state instead (or an explicit override
  // captured before an async boundary).
  const explicit = explicitOverride !== undefined ? !!explicitOverride : !!cm.state?._acExplicit;
  if (prefix.length < 1 && !explicit) return null;

  // Sync current doc to engine
  _engine.docs.update(tab.id, tab.cm.getValue());

  const items = await _engine.getCompletions(tab.id, { line: cur.line, ch: cur.ch });
  if (!items.length) return null;

  const fromCh = prefix ? cur.ch - prefix.length : cur.ch;

  return {
    list: items.slice(0, 80).map(item => ({
      text: item.label,
      displayText: item.label,
      acType: {
        keyword: 'k', builtin: 'b', snippet: 's', function: 'f',
        class: 'c', variable: 'v', property: 'p', text: 'w'
      }[item.kind] || 'w',
      detail: item.detail || '',
      source: item.source || '',
      documentation: item.documentation || '',
      render: function(element, self, data) {
        const badge = document.createElement('span');
        const badgeClass = {
          keyword: 'k', builtin: 'b', snippet: 's', function: 'f',
          class: 'c', variable: 'v', property: 'p'
        }[item.kind] || 'w';
        badge.className = 'cm-hint-badge cm-hint-badge-' + badgeClass;
        const badgeLabels = { k: 'K', b: 'B', s: 'S', f: 'F', c: 'C', v: 'V', p: 'P', w: 'W' };
        badge.textContent = badgeLabels[badgeClass] || 'W';

        const label = document.createElement('span');
        label.className = 'cm-hint-label';
        label.textContent = item.label;

        element.appendChild(badge);
        element.appendChild(label);

        if (item.detail) {
          const d = document.createElement('span');
          d.className = 'cm-hint-detail';
          d.textContent = item.detail;
          element.appendChild(d);
        }

        // Documentation tooltip on hover
        if (item.documentation) {
          element.title = item.documentation;
        }
      },
      hint: item.insertText !== item.label ? function(cm, data) {
        const ex = expandSnippet(item.insertText);
        cm.replaceRange(ex.text, data.from, data.to, 'complete');
        // Select the first placeholder so the user can type over it.
        if (ex.placeholders.length && !ex.text.includes('\n')) {
          const p = ex.placeholders[0];
          cm.setSelection(
            { line: data.from.line, ch: data.from.ch + p.start },
            { line: data.from.line, ch: data.from.ch + p.end }
          );
        }
      } : undefined,
    })),
    from: CodeMirror.Pos(cur.line, fromCh),
    to: CodeMirror.Pos(cur.line, cur.ch),
  };
}

// ─── Hover provider ───
let _hoverTooltip = null;
let _hoverToken = 0;

async function intelliHover(cm) {
  if (!_engine) return;
  const tab = findTabByCM(cm);
  if (!tab) return;

  const cur = cm.getCursor();
  _engine.docs.update(tab.id, tab.cm.getValue());
  const hover = await _engine.getHover(tab.id, { line: cur.line, ch: cur.ch });

  // Two overlapping hovers could delete each other's tooltip. Remove the old
  // one BEFORE awaiting, and bail out if a newer hover already claimed it.
  removeHoverTooltip();
  if (!hover || !hover.contents) return;
  const token = ++_hoverToken;
  if (token !== _hoverToken) return;

  // Build tooltip
  const tooltip = document.createElement('div');
  tooltip.id = 'intelli-hover';
  tooltip.className = 'intelli-hover-tooltip';
  tooltip.style.cssText = `
    position: absolute; z-index: 600; background: #1e1f1b; border: 1px solid #5a5a52;
    border-radius: 6px; padding: 8px 12px; font-family: 'Courier New', monospace;
    font-size: 12px; color: #f8f8f2; max-width: 400px; box-shadow: 0 8px 28px rgba(0,0,0,0.55);
    pointer-events: none;
  `;

  for (const part of hover.contents) {
    if (typeof part === 'string') {
      const div = document.createElement('div');
      div.textContent = part;
      div.style.color = '#75715e';
      div.style.fontSize = '11px';
      div.style.marginTop = '4px';
      tooltip.appendChild(div);
    } else if (part.language) {
      const code = document.createElement('div');
      code.style.cssText = 'color: #a6e22e; font-weight: bold;';
      code.textContent = part.value;
      tooltip.appendChild(code);
    }
  }

  // Position near cursor
  const cursorCoords = cm.cursorCoords(cur, 'page');
  tooltip.style.left = cursorCoords.left + 'px';
  tooltip.style.top = (cursorCoords.bottom + 4) + 'px';

  document.body.appendChild(tooltip);
  _hoverTooltip = tooltip;
}

function removeHoverTooltip() {
  if (_hoverTooltip) {
    _hoverTooltip.remove();
    _hoverTooltip = null;
  }
}

// ─── Go to definition ───
async function intelliGoToDefinition(cm) {
  if (!_engine) return false;
  const tab = findTabByCM(cm);
  if (!tab) return false;

  const cur = cm.getCursor();
  _engine.docs.update(tab.id, cm.getValue());
  const def = await _engine.getDefinition(tab.id, { line: cur.line, ch: cur.ch });

  if (def && def.range) {
    cm.setCursor(def.range.start.line, def.range.start.character);
    // CodeMirror 5 expects { line, ch } — the analyzers emit LSP-style
    // { line, character }, which produced a bogus scroll target.
    const line = def.range.start.line;
    const ch = def.range.start.character || 0;
    cm.scrollIntoView({ from: { line, ch }, to: { line, ch } }, 100);
    return true;
  }
  return false;
}

// ─── Find references ───
async function intelliFindReferences(cm) {
  if (!_engine) return [];
  const tab = findTabByCM(cm);
  if (!tab) return [];

  const cur = cm.getCursor();
  _engine.docs.update(tab.id, cm.getValue());
  return await _engine.getReferences(tab.id, { line: cur.line, ch: cur.ch });
}

// ─── Diagnostics display ───
function setupDiagnosticsDisplay(engine) {
  engine.bus.on('diagnostics:update', ({ docId, diagnostics }) => {
    const tab = findTabById(docId);
    if (!tab) return;

    // Clear previous marks
    tab.cm.getAllMarks().forEach(m => {
      if (m.className && m.className.includes('intelli-diag')) m.clear();
    });

    // Add diagnostic marks
    for (const diag of diagnostics) {
      const { start, end } = diag.range;
      const className = diag.severity === 'error'
        ? 'intelli-diag-error'
        : diag.severity === 'warning'
          ? 'intelli-diag-warning'
          : 'intelli-diag-hint';

      tab.cm.markText(
        { line: start.line, ch: start.character },
        { line: end.line, ch: Math.min(end.character, tab.cm.getLine(end.line)?.length || 0) },
        { className, attributes: { title: diag.message } }
      );
    }

    // Update problems panel if open
    updateProblemsPanel(diagnostics);
  });
}

// ─── Problems Panel ───
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function updateProblemsPanel(diagnostics) {
  const panel = document.getElementById('intelli-problems');
  if (!panel) return;

  panel.innerHTML = '';
  if (!diagnostics.length) {
    panel.innerHTML = '<div style="color:#75715e;padding:12px;text-align:center;">No problems detected</div>';
    return;
  }

  for (const diag of diagnostics) {
    const div = document.createElement('div');
    div.className = 'intelli-problem-item';
    div.style.cssText = `
      display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      border-bottom: 1px solid #2a2b26; cursor: pointer; font-size: 12px;
    `;
    // The message comes from the document — escape it before it reaches innerHTML.
    div.innerHTML = `
      <span style="color:${diag.severity === 'error' ? '#f92672' : diag.severity === 'warning' ? '#fd971f' : '#75715e'};">●</span>
      <span style="color:#f8f8f2;flex:1;">${escapeHtml(diag.message)}</span>
      <span style="color:#75715e;">Ln ${diag.range.start.line + 1}</span>
    `;
    panel.appendChild(div);
  }
}

// ─── Symbol Outline ───
async function showSymbolOutline() {
  if (!_engine) return;
  const tab = getActiveTab();
  if (!tab) return;

  // Toggle first — indexing the document before the toggle check meant the
  // work was done even when the panel was only being closed.
  const existing = document.getElementById('intelli-outline');
  if (existing) { existing.remove(); return; }

  _engine.docs.update(tab.id, tab.cm.getValue());
  const symbols = await _engine.getSymbolIndex(tab.id);

  // A second call may have opened the panel while we were indexing.
  if (document.getElementById('intelli-outline')) return;

  const panel = document.createElement('div');
  panel.id = 'intelli-outline';
  panel.className = 'intelli-outline-panel';
  panel.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    z-index: 1000; background: #1e1f1b; border: 1px solid #5a5a52;
    border-radius: 8px; padding: 0; width: min(400px, 90vw);
    max-height: 60vh; overflow: hidden; box-shadow: 0 16px 48px rgba(0,0,0,0.6);
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    padding: 12px 16px; border-bottom: 1px solid #2a2b26;
    font-size: 14px; font-weight: 600; color: #f8f8f2;
    display: flex; justify-content: space-between; align-items: center;
  `;
  header.innerHTML = `<span>Symbol Outline</span><button onclick="this.closest('.intelli-outline-panel').remove()" style="background:none;border:none;color:#75715e;cursor:pointer;font-size:18px;">×</button>`;
  panel.appendChild(header);

  const list = document.createElement('div');
  list.style.cssText = 'overflow-y: auto; max-height: calc(60vh - 50px);';

  for (const sym of symbols) {
    const item = document.createElement('div');
    item.style.cssText = `
      display: flex; align-items: center; gap: 8px; padding: 8px 16px;
      border-bottom: 1px solid #2a2b26; cursor: pointer; font-size: 13px;
      font-family: 'Courier New', monospace;
    `;
    const icon = { function: 'ƒ', class: 'C', variable: 'V' }[sym.kind] || '?';
    const iconColor = { function: '#a6e22e', class: '#66d9e8', variable: '#ae81ff' }[sym.kind] || '#75715e';
    item.innerHTML = `
      <span style="color:${iconColor};font-weight:bold;width:16px;text-align:center;">${icon}</span>
      <span style="color:#f8f8f2;flex:1;">${escapeHtml(sym.name)}</span>
      <span style="color:#75715e;font-size:11px;">Ln ${sym.line + 1}</span>
    `;
    item.addEventListener('click', () => {
      tab.cm.setCursor({ line: sym.line, ch: 0 });
      tab.cm.scrollIntoView({ line: sym.line, ch: 0 }, 200);
      panel.remove();
    });
    list.appendChild(item);
  }

  if (!symbols.length) {
    list.innerHTML = '<div style="color:#75715e;padding:16px;text-align:center;">No symbols found</div>';
  }

  panel.appendChild(list);
  document.body.appendChild(panel);

  // Close on outside click
  const handler = (e) => {
    if (!panel.contains(e.target)) { panel.remove(); document.removeEventListener('click', handler); }
  };
  setTimeout(() => {
    // The panel may already be gone — don't attach a listener to a dead node.
    if (document.body.contains(panel)) document.addEventListener('click', handler);
  }, 100);
}

// ─── Helper: find tab by CM instance ───
// These must NOT fall back to the active tab — that would apply diagnostics
// and hover to the wrong document.
function findTabByCM(cm) {
  return window._ppState?.tabs?.find(t => t.cm === cm) || null;
}

function findTabById(docId) {
  return window._ppState?.tabs?.find(t => t.id === docId) || null;
}

function getActiveTab() {
  return window._ppGetActiveTab?.() || window._ppState?.tabs?.find(t => t.active);
}

// ─── Install ───
let _installed = false;

async function installIntelli() {
  const engine = await ensureEngine();

  // Expose globally for debugging
  window._intelli = engine;
  window._intelliReady = true;
  window._intelliAssistant = assistantEngine;

  // installIntelli must be idempotent: calling it twice used to add a second
  // diagnostics listener and wrap window._ppSwitchTab a second time.
  if (_installed) {
    syncAllTabs(window._ppState);
    return engine;
  }
  _installed = true;

  // Setup diagnostics display
  setupDiagnosticsDisplay(engine);

  // Sync with existing tab switching
  const origSwitchTab = window._ppSwitchTab;
  if (typeof origSwitchTab === 'function') {
    window._ppSwitchTab = function(...args) {
      origSwitchTab.apply(this, args);
      const tab = getActiveTab();
      if (tab) syncTabToEngine(tab);
    };
  }

  // Sync initial tabs
  syncAllTabs(window._ppState);

  console.log('[PocketPad Intelli] Engine initialized');
  return engine;
}

export {
  ensureEngine,
  installIntelli,
  syncTabToEngine,
  intelliCompletionHint,
  intelliHover,
  intelliGoToDefinition,
  intelliFindReferences,
  showSymbolOutline,
  removeHoverTooltip,
};
