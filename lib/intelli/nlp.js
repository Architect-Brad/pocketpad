// PocketPad Intelli — NLP Engine
// Tokenization, stemming, intent classification, entity extraction, context management

// ─── Stop Words ───
const STOP_WORDS = new Set([
  'a','an','the','is','it','its','in','on','at','to','for','of','with','by',
  'and','or','but','not','this','that','these','those','from','as','be',
  'are','was','were','been','being','have','has','had','do','does','did',
  'will','would','shall','should','may','might','can','could','must',
  'i','me','my','we','our','you','your','he','she','they','them',
  'what','which','who','whom','how','where','when','why',
  'all','each','every','both','few','more','most','other','some','such',
  'no','nor','too','very','just','than','also','now','here','there',
  'if','then','else','so','up','out','about','into','through','during',
  'before','after','above','below','between','same','own','only',
  'am','been','being','let','like','much','many','well','back','even',
  'still','new','way','use','her','him','old','see','come','made','could',
  'did','get','make','go','know','say','take','think','want','give',
  'first','last','long','great','little','right','big','high','small',
  'large','next','early','young','important','public','bad','same','able'
]);

// ─── Porter Stemmer (12 suffix rules) ───
const STEMS = [
  [/(ation|ment|ness|ible|able|tion|sion|ence|ance|ious|eous|ling)$/,''],
  [/(ful|ish|ive|ily|aly|ize|ise|ify)$/,''],
  [/(ies|ied|eer|ier)$/,''],
  [/(sses|ies)$/,'s'],
  [/([^aeiou])y$/,'$1i'],
  [/(ing)$/,''],
  [/ss$/,'s'],
  [/s$/,'']
];

// ─── Tokenizer ───
function tokenize(text) {
  return (text || '').toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

// ─── Stemmer ───
function stem(word) {
  if (STOP_WORDS.has(word)) return null;
  let w = word;
  for (const [pat, rep] of STEMS) {
    if (pat.test(w)) { w = w.replace(pat, rep); break; }
  }
  return w.length > 2 ? w : word;
}

function extractTokens(text) {
  return tokenize(text).map(stem).filter(Boolean);
}

// ─── Intent Classification ───
const INTENTS = {
  explain: {
    keywords: ['explain','understand','what','mean','reading','read','interpret','walk','through','overview','breakdown','describe','tell me about'],
    boost: ['code','this','function','class','method','block','loop','line','snippet','algorithm','logic','doing','purpose','role']
  },
  bug: {
    keywords: ['bug','error','fix','issue','problem','wrong','broken','failing','crash','debug','troubleshoot','diagnose','not working','doesn\'t work'],
    boost: ['exception','undefined','null','type','runtime','syntax','memory','leak','race','condition','unexpected','fail']
  },
  refactor: {
    keywords: ['refactor','clean','improve','restructure','reorganize','simplify','rewrite','modernize','optimize','enhance'],
    boost: ['pattern','code','structure','design','performance','readability','maintainability','dRY','srp','smell']
  },
  generate: {
    keywords: ['generate','create','write','make','build','implement','add','function','class','module','component','snippet','code for'],
    boost: ['from','describe','natural','language','spec','requirement','want','need','like','example']
  },
  document: {
    keywords: ['document','doc','comment','jsdoc','javadoc','readme','describe','explanation','annotation','note','add comments'],
    boost: ['add','write','generate','missing','inline','header','block']
  },
  test: {
    keywords: ['test','spec','unittest','assert','verify','check','coverage','jest','mocha','pytest'],
    boost: ['write','create','add','test','case','fixture','mock','stub','assertion']
  },
  review: {
    keywords: ['review','code review','audit','inspect','evaluate','assess','check','quality'],
    boost: ['code','safety','security','performance','best','practice','standard','good','bad']
  },
  convert: {
    keywords: ['convert','translate','transform','change','switch','port','migrate'],
    boost: ['to','from','language','python','javascript','java','go','rust','c','ruby']
  },
  complexity: {
    keywords: ['complexity','big-o','time','space','complex','performance','slow','bottleneck','optimize'],
    boost: ['algorithm','loop','nested','iteration','recursive','o(n)','o(1)','o(log']
  },
  security: {
    keywords: ['security','vulnerable','injection','xss','csrf','sanitize','validate','safe','insecure'],
    boost: ['input','user','data','auth','token','password','hash','encrypt']
  }
};

// ─── Language Detection Keywords ───
const LANG_KEYWORDS = {
  javascript: ['javascript','js','node','nodejs','typescript','ts','es6','es2015','npm','yarn','vite','webpack','react','vue','angular','svelte','express','nextjs','deno','bun'],
  python: ['python','py','pip','conda','django','flask','fastapi','numpy','pandas','scikit','jupyter','anaconda'],
  html: ['html','markup','dom','element','tag','div','span','anchor','heading','semantic'],
  css: ['css','style','stylesheet','scss','sass','less','flexbox','grid','animation','responsive','media query'],
  java: ['java','spring','maven','gradle','junit','hibernate','tomcat','kotlin','android'],
  go: ['go','golang','goroutine','channel','gorilla','gin'],
  rust: ['rust','cargo','rustc','clippy','tokio','serde'],
  c: ['c','gcc','clang','malloc','pointer','struct','stdio','glib'],
  'c++': ['cpp','c++','cmake','stl','template','class','boost'],
  csharp: ['c#','csharp','dotnet','.net','nuget','aspnet','entity framework'],
  ruby: ['ruby','rails','gem','bundler','rspec','sinatra'],
  php: ['php','laravel','composer','symfony','artisan','wp'],
  swift: ['swift','ios','xcode','cocoa','uikit','swiftui'],
  kotlin: ['kotlin','android','kotlinx','coroutines'],
  sql: ['sql','database','query','mysql','postgres','sqlite','mongo','redis'],
  shell: ['shell','bash','zsh','terminal','command','script','grep','awk','sed']
};

// ─── Code Entity Extraction ───
const CODE_PATTERNS = {
  function: /\b(?:function|def|fn|func|sub|proc|lambda|async)\s+(\w+)\s*\(([^)]*)\)/g,
  class: /\b(?:class|struct|interface|enum|type)\s+(\w+)/g,
  variable: /\b(?:const|let|var|static|final|public|private|protected)\s+(\w+)/g,
  import: /\b(?:import|from|require|include|use)\s+([^\s;]+)/g,
  method: /\.(\w+)\s*\(/g,
  property: /\.(\w+)/g,
};

function extractEntities(text) {
  const entities = { functions: [], classes: [], variables: [], methods: [], imports: [] };
  let m;

  CODE_PATTERNS.function.lastIndex = 0;
  while ((m = CODE_PATTERNS.function.exec(text)) !== null) {
    entities.functions.push({ name: m[1], params: m[2], line: text.slice(0, m.index).split('\n').length - 1 });
  }

  CODE_PATTERNS.class.lastIndex = 0;
  while ((m = CODE_PATTERNS.class.exec(text)) !== null) {
    entities.classes.push({ name: m[1], line: text.slice(0, m.index).split('\n').length - 1 });
  }

  CODE_PATTERNS.variable.lastIndex = 0;
  while ((m = CODE_PATTERNS.variable.exec(text)) !== null) {
    entities.variables.push({ name: m[1], line: text.slice(0, m.index).split('\n').length - 1 });
  }

  CODE_PATTERNS.import.lastIndex = 0;
  while ((m = CODE_PATTERNS.import.exec(text)) !== null) {
    entities.imports.push({ path: m[1], line: text.slice(0, m.index).split('\n').length - 1 });
  }

  return entities;
}

// ─── Code Analysis (Enhanced) ───
function analyzeCode(code) {
  if (!code || !code.trim()) return { empty: true };
  const lines = code.split('\n');
  const funcs = [];
  const classes = [];
  const loops = [];
  const conditions = [];
  const imports = [];
  const comments = [];
  const exports = [];
  let maxDepth = 0, depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (/^\/\/|^\/\*|^\*/.test(l) || /^#(?!!)/.test(l)) comments.push(i + 1);
    if (/\b(function|def|fn|func|sub|proc|lambda|=>\s*{)\b/.test(l)) funcs.push({ line: i + 1, text: l });
    if (/\b(class|struct|interface|enum|type)\s+\w+/.test(l)) classes.push({ line: i + 1, text: l });
    if (/\b(for|while|do|loop|each)\b/.test(l)) loops.push({ line: i + 1, text: l });
    if (/\b(if|else|switch|case|match|when|elif|elseif)\b/.test(l)) conditions.push({ line: i + 1 });
    if (/\b(import|from|require|include|use)\b/.test(l)) imports.push({ line: i + 1, text: l });
    if (/\b(export|module\.exports|pub|public)\b/.test(l)) exports.push({ line: i + 1, text: l });
    depth += (l.match(/{/g)||[]).length - (l.match(/}/g)||[]).length;
    if (depth > maxDepth) maxDepth = depth;
  }

  return {
    empty: false,
    lines: lines.length,
    chars: code.length,
    funcs, classes, loops, conditions, imports, comments, exports,
    maxDepth,
    hasErrorHandling: /\b(try|catch|except|throw|raise|error)\b/.test(code),
    hasAsync: /\b(async|await|promise|future)\b/i.test(code),
    hasRecursion: funcs.some(f => code.includes(f.text.match(/(\w+)\s*\(/)?.[1] || '___NOMATCH___')),
    complexity: loops.length + conditions.length + (funcs.length * 0.5),
    entities: extractEntities(code),
  };
}

// ─── Context Manager (Multi-turn) ───
class ContextManager {
  constructor(maxHistory = 20) {
    this.maxHistory = maxHistory;
    this.history = [];
    this.preferences = new Map();
  }

  addTurn(role, text, meta = {}) {
    this.history.push({ role, text, meta, timestamp: Date.now() });
    if (this.history.length > this.maxHistory) this.history.shift();
  }

  getRecentContext(n = 5) {
    return this.history.slice(-n);
  }

  getConversationSummary() {
    return this.history.map(h => `${h.role}: ${h.text}`).join('\n');
  }

  trackPreference(key, value) {
    this.preferences.set(key, (this.preferences.get(key) || 0) + 1);
  }

  getMostFrequentPrefs(n = 5) {
    return Array.from(this.preferences.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k]) => k);
  }

  clear() { this.history = []; this.preferences.clear(); }
}

// ─── NLP Engine Public API ───
const IntelliNLP = {
  tokenize,
  stem,
  extractTokens,
  classifyIntent,
  detectLanguage,
  analyzeCode,
  extractEntities,
  STOP_WORDS,
  ContextManager,
  INTENTS,
  LANG_KEYWORDS,
};

export default IntelliNLP;
export { tokenize, stem, extractTokens, classifyIntent, detectLanguage, analyzeCode, extractEntities, STOP_WORDS, ContextManager };
