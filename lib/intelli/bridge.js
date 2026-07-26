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
let _loading = false;

async function ensureEngine() {
  if (_engine) return _engine;
  if (_loading) return new Promise(resolve => {
    const check = setInterval(() => { if (_engine) { clearInterval(check); resolve(_engine); } }, 50);
  });
  _loading = true;
  _engine = new PocketIntelli();
  _engine.registerLanguage(new JavaScriptAnalyzer());
  _engine.registerLanguage(new PythonAnalyzer());
  _engine.registerLanguage(new GoAnalyzer());
  _engine.registerLanguage(new RustAnalyzer());
  _engine.registerLanguage(new CppAnalyzer());
  _engine.registerLanguage(new HTMLAnalyzer());
  _engine.registerLanguage(new CSSAnalyzer());
  await _engine.init();
  _loading = false;
  return _engine;
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

// ─── Enhanced autocomplete (replaces hybridCompletionHint) ───
async function intelliCompletionHint(cm, explicit) {
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
        cm.replaceRange(item.insertText, data.from, data.to, 'complete');
      } : undefined,
    })),
    from: CodeMirror.Pos(cur.line, fromCh),
    to: CodeMirror.Pos(cur.line, cur.ch),
  };
}

// ─── Hover provider ───
let _hoverTooltip = null;

async function intelliHover(cm) {
  if (!_engine) return;
  const tab = findTabByCM(cm);
  if (!tab) return;

  const cur = cm.getCursor();
  _engine.docs.update(tab.id, tab.cm.getValue());
  const hover = await _engine.getHover(tab.id, { line: cur.line, ch: cur.ch });

  removeHoverTooltip();
  if (!hover || !hover.contents) return;

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
    cm.scrollIntoView({ from: def.range.start, to: def.range.end }, 100);
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
    div.innerHTML = `
      <span style="color:${diag.severity === 'error' ? '#f92672' : diag.severity === 'warning' ? '#fd971f' : '#75715e'};">●</span>
      <span style="color:#f8f8f2;flex:1;">${diag.message}</span>
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

  _engine.docs.update(tab.id, tab.cm.getValue());
  const symbols = await _engine.getSymbolIndex(tab.id);

  // Build dropdown
  const existing = document.getElementById('intelli-outline');
  if (existing) { existing.remove(); return; }

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
      <span style="color:#f8f8f2;flex:1;">${sym.name}</span>
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
  setTimeout(() => {
    const handler = (e) => {
      if (!panel.contains(e.target)) { panel.remove(); document.removeEventListener('click', handler); }
    };
    document.addEventListener('click', handler);
  }, 100);
}

// ─── Helper: find tab by CM instance ───
function findTabByCM(cm) {
  return window._ppState?.tabs?.find(t => t.cm === cm) || window._ppGetActiveTab?.();
}

function findTabById(docId) {
  return window._ppState?.tabs?.find(t => t.id === docId) || window._ppGetActiveTab?.();
}

function getActiveTab() {
  return window._ppGetActiveTab?.() || window._ppState?.tabs?.find(t => t.active);
}

// ─── Install ───
async function installIntelli() {
  const engine = await ensureEngine();

  // Expose globally for debugging
  window._intelli = engine;
  window._intelliReady = true;
  window._intelliAssistant = assistantEngine;

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
