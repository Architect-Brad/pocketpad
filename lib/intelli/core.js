// PocketPad Intelli — Core Engine
// Message bus, provider registry, worker pool, LRU cache, document manager

// ─── LRU Cache ───
class LRUCache {
  constructor(max = 256) {
    this.max = max;
    this.map = new Map();
  }
  get(key) {
    if (!this.map.has(key)) return undefined;
    const v = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }
  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.max) {
      const first = this.map.keys().next().value;
      this.map.delete(first);
    }
  }
  delete(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

// ─── Message Bus ───
class MessageBus {
  constructor() { this._listeners = new Map(); }
  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this._listeners.get(event)?.delete(fn);
  }
  emit(event, data) {
    const fns = this._listeners.get(event);
    if (fns) fns.forEach(fn => { try { fn(data); } catch(e) { console.error('[Intelli]', event, e); } });
  }
}

// ─── Worker Pool ───
class WorkerPool {
  constructor(bus) {
    this.bus = bus;
    this._workers = new Map();
    this._pending = new Map();
    this._msgId = 0;
  }

  async _getWorker(name) {
    if (this._workers.has(name)) return this._workers.get(name);
    const worker = new Worker(new URL(`./workers/${name}.js`, import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, type, ...rest } = e.data || {};
      if (id && this._pending.has(id)) {
        this._pending.get(id)(e.data);
        this._pending.delete(id);
      }
      this.bus.emit('worker:' + type, rest);
    };
    this._workers.set(name, worker);
    return worker;
  }

  async post(name, msg, transfer) {
    const worker = await this._getWorker(name);
    const id = ++this._msgId;
    return new Promise((resolve) => {
      this._pending.set(id, resolve);
      worker.postMessage({ id, ...msg }, transfer || []);
      setTimeout(() => {
        if (this._pending.has(id)) {
          this._pending.delete(id);
          resolve({ error: 'timeout' });
        }
      }, 30000);
    });
  }

  terminate(name) {
    const w = this._workers.get(name);
    if (w) { w.terminate(); this._workers.delete(name); }
  }

  terminateAll() {
    this._workers.forEach(w => w.terminate());
    this._workers.clear();
    this._pending.clear();
  }
}

// ─── Document Manager ───
class DocumentManager {
  constructor(bus) {
    this.bus = bus;
    this.docs = new Map();
  }

  track(docId, content, language, version = 0) {
    this.docs.set(docId, { content, language, version, symbols: [], diagnostics: [] });
    this.bus.emit('document:change', { docId, content, language, version });
  }

  update(docId, content, version) {
    const doc = this.docs.get(docId);
    if (!doc) return;
    doc.content = content;
    doc.version = version ?? (doc.version + 1);
    this.bus.emit('document:change', { docId, content, language: doc.language, version: doc.version });
  }

  get(docId) { return this.docs.get(docId); }
  remove(docId) { this.docs.delete(docId); this.bus.emit('document:close', { docId }); }
}

// ─── Main Engine ───
class PocketIntelli {
  constructor() {
    this.bus = new MessageBus();
    this.cache = new LRUCache(512);
    this.docs = new DocumentManager(this.bus);
    this.workers = new WorkerPool(this.bus);
    this.languages = new Map();
    this._initialized = false;
  }

  async init() {
    if (this._initialized) return;
    this._initialized = true;

    // Debounced analysis triggers
    let _diagTimer;
    this.bus.on('document:change', ({ docId }) => {
      clearTimeout(_diagTimer);
      _diagTimer = setTimeout(() => this._runDiagnostics(docId), 500);
    });

    this.bus.emit('engine:ready', {});
  }

  dispose() {
    this.workers.terminateAll();
    this.cache.clear();
    this.languages.clear();
    this._initialized = false;
  }

  // ─── Language Registration ───
  registerLanguage(analyzer) {
    this.languages.set(analyzer.id, analyzer);
    if (analyzer.init) analyzer.init(this);
  }

  getLanguage(langId) { return this.languages.get(langId); }

  _resolveLang(docId) {
    const doc = this.docs.get(docId);
    if (!doc) return null;
    const lang = typeof doc.language === 'string'
      ? doc.language.toLowerCase()
      : (doc.language?.name || '').toLowerCase();
    return this.languages.get(lang) || null;
  }

  // ─── Completions ───
  async getCompletions(docId, position) {
    const key = `comp:${docId}:${position.line}:${position.ch}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const analyzer = this._resolveLang(docId);
    const doc = this.docs.get(docId);
    if (!doc || !analyzer) return [];

    const items = analyzer.getCompletions(doc.content, position, doc.language) || [];
    const docWords = this._getDocumentWords(docId, position);
    const all = [...items, ...docWords];

    // Rank and dedupe
    const ranked = this._rankCompletions(all, docId);
    this.cache.set(key, ranked);
    return ranked;
  }

  _getDocumentWords(docId, position) {
    const doc = this.docs.get(docId);
    if (!doc) return [];
    const prefix = this._getPrefix(doc.content, position);
    if (!prefix) return [];
    const words = new Set();
    const wordRe = /[A-Za-z_$][A-Za-z0-9_$]{2,}/g;
    let m;
    wordRe.lastIndex = 0;
    while ((m = wordRe.exec(doc.content)) !== null) {
      if (m[0].toLowerCase().startsWith(prefix.toLowerCase()) && m[0] !== prefix) {
        words.add(m[0]);
      }
    }
    return Array.from(words).slice(0, 30).map(w => ({
      label: w, kind: 'text', source: 'document', sortOrder: 90
    }));
  }

  _getPrefix(content, position) {
    const lines = content.split('\n');
    const line = lines[position.line] || '';
    const before = line.slice(0, position.ch);
    const m = before.match(/[A-Za-z_$][A-Za-z0-9_$]*$/);
    return m ? m[0] : '';
  }

  _rankCompletions(items, docId) {
    const kindRank = { snippet: 0, keyword: 1, builtin: 2, function: 3, class: 4, variable: 5, text: 9 };
    const seen = new Set();
    return items
      .filter(item => {
        if (seen.has(item.label)) return false;
        seen.add(item.label);
        return true;
      })
      .sort((a, b) => {
        const ra = kindRank[a.kind] ?? 9;
        const rb = kindRank[b.kind] ?? 9;
        if (ra !== rb) return ra - rb;
        return (a.sortOrder ?? 50) - (b.sortOrder ?? 50) || a.label.localeCompare(b.label);
      })
      .slice(0, 100);
  }

  // ─── Hover ───
  async getHover(docId, position) {
    const key = `hover:${docId}:${position.line}:${position.ch}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const analyzer = this._resolveLang(docId);
    const doc = this.docs.get(docId);
    if (!doc || !analyzer?.getHover) { this.cache.set(key, null); return null; }

    const result = analyzer.getHover(doc.content, position, doc.language);
    this.cache.set(key, result);
    return result;
  }

  // ─── Diagnostics ───
  async _runDiagnostics(docId) {
    const analyzer = this._resolveLang(docId);
    const doc = this.docs.get(docId);
    if (!doc || !analyzer?.getDiagnostics) return;

    const diags = analyzer.getDiagnostics(doc.content, doc.language);
    doc.diagnostics = diags;
    this.bus.emit('diagnostics:update', { docId, diagnostics: diags });
  }

  async getDiagnostics(docId) {
    const doc = this.docs.get(docId);
    return doc?.diagnostics || [];
  }

  // ─── Navigation ───
  async getDefinition(docId, position) {
    const analyzer = this._resolveLang(docId);
    const doc = this.docs.get(docId);
    if (!doc || !analyzer?.getDefinition) return null;
    return analyzer.getDefinition(doc.content, position, doc.language);
  }

  async getReferences(docId, position) {
    const analyzer = this._resolveLang(docId);
    const doc = this.docs.get(docId);
    if (!doc || !analyzer?.getReferences) return [];
    return analyzer.getReferences(doc.content, position, doc.language);
  }

  // ─── Symbol Index (via worker) ───
  async getSymbolIndex(docId) {
    const doc = this.docs.get(docId);
    if (!doc) return [];
    if (doc.symbols.length) return doc.symbols;

    const result = await this.workers.post('analyzer', {
      type: 'index-symbols',
      content: doc.content,
      language: typeof doc.language === 'string' ? doc.language : doc.language?.name || 'text',
      docId
    });
    doc.symbols = result.symbols || [];
    return doc.symbols;
  }

  // ─── Signature Help ───
  async getSignature(docId, position) {
    const analyzer = this._resolveLang(docId);
    const doc = this.docs.get(docId);
    if (!doc || !analyzer?.getSignature) return null;
    return analyzer.getSignature(doc.content, position, doc.language);
  }
}

export { PocketIntelli, MessageBus, LRUCache, WorkerPool, DocumentManager };
