// PocketPad Intelli — Python Language Analyzer
import { LanguageAnalyzer, CompletionItem, extractFunctions, extractClasses, patternDiagnostics } from './base.js';

const PY_KEYWORDS = [
  'False','None','True','and','as','assert','async','await','break','class',
  'continue','def','del','elif','else','except','finally','for','from',
  'global','if','import','in','is','lambda','nonlocal','not','or','pass',
  'raise','return','try','while','with','yield',
  // Context managers, comprehensions
  'match','case','_',
];

const PY_BUILTINS = [
  { label: 'print', detail: '(*objects, sep=" ", end="\\n", file=sys.stdout)', doc: 'Print objects to the text stream.' },
  { label: 'len', detail: '(obj) → int', doc: 'Return the length of an object.' },
  { label: 'range', detail: '(stop) | (start, stop, step?)', doc: 'Create a range object.' },
  { label: 'type', detail: '(obj) → type', doc: 'Return the type of an object.' },
  { label: 'int', detail: '(x=0) → int', doc: 'Return an integer object.' },
  { label: 'float', detail: '(x=0.0) → float', doc: 'Return a floating point number.' },
  { label: 'str', detail: '(object="") → str', doc: 'Return a string version of an object.' },
  { label: 'bool', detail: '(x=False) → bool', doc: 'Return a Boolean value.' },
  { label: 'list', detail: '(iterable=[]) → list', doc: 'Create a list object.' },
  { label: 'dict', detail: '() → dict', doc: 'Create a dictionary object.' },
  { label: 'set', detail: '(iterable=set()) → set', doc: 'Create a set object.' },
  { label: 'tuple', detail: '(iterable=()) → tuple', doc: 'Create a tuple object.' },
  { label: 'input', detail: '(prompt="") → str', doc: 'Read a line from input.' },
  { label: 'open', detail: '(file, mode="r", ...) → file', doc: 'Open a file and return a file object.' },
  { label: 'isinstance', detail: '(obj, classinfo) → bool', doc: 'Check if an object is an instance of a class.' },
  { label: 'issubclass', detail: '(class, classinfo) → bool', doc: 'Check if a class is a subclass.' },
  { label: 'hasattr', detail: '(obj, name) → bool', doc: 'Check if an object has an attribute.' },
  { label: 'getattr', detail: '(obj, name, default?) → any', doc: 'Get an attribute of an object.' },
  { label: 'setattr', detail: '(obj, name, value) → None', doc: 'Set an attribute on an object.' },
  { label: 'delattr', detail: '(obj, name) → None', doc: 'Delete an attribute from an object.' },
  { label: 'id', detail: '(obj) → int', doc: 'Return the identity of an object.' },
  { label: 'hash', detail: '(obj) → int', doc: 'Return the hash value of an object.' },
  { label: 'repr', detail: '(obj) → str', doc: 'Return a string representation.' },
  { label: 'abs', detail: '(x) → number', doc: 'Return the absolute value.' },
  { label: 'all', detail: '(iterable) → bool', doc: 'Check if all elements are true.' },
  { label: 'any', detail: '(iterable) → bool', doc: 'Check if any element is true.' },
  { label: 'bin', detail: '(x) → str', doc: 'Convert an integer to a binary string.' },
  { label: 'hex', detail: '(x) → str', doc: 'Convert an integer to a hexadecimal string.' },
  { label: 'oct', detail: '(x) → str', doc: 'Convert an integer to an octal string.' },
  { label: 'chr', detail: '(i) → str', doc: 'Return a character from an ASCII code.' },
  { label: 'ord', detail: '(c) → int', doc: 'Return an integer from a character.' },
  { label: 'max', detail: '(*args) → any', doc: 'Return the largest item.' },
  { label: 'min', detail: '(*args) → any', doc: 'Return the smallest item.' },
  { label: 'sum', detail: '(iterable, start=0) → number', doc: 'Sum the items of an iterable.' },
  { label: 'sorted', detail: '(iterable, key?, reverse?) → list', doc: 'Return a new sorted list.' },
  { label: 'reversed', detail: '(seq) → reverse_iterator', doc: 'Return a reversed iterator.' },
  { label: 'enumerate', detail: '(iterable, start=0) → enumerate', doc: 'Return an enumerate object.' },
  { label: 'zip', detail: '(*iterables) → zip', doc: 'Aggregate elements from iterables.' },
  { label: 'map', detail: '(fn, *iterables) → map', doc: 'Apply a function to items.' },
  { label: 'filter', detail: '(fn, iterable) → filter', doc: 'Filter items by a function.' },
  { label: 'reduce', detail: '(fn, iterable, init?) → any', doc: 'Apply a function cumulatively (from functools).' },
  { label: 'iter', detail: '(obj) → iterator', doc: 'Return an iterator object.' },
  { label: 'next', detail: '(iterator, default?) → any', doc: 'Get the next item from an iterator.' },
  { label: 'super', detail: '() → proxy', doc: 'Return a proxy object that delegates to a parent.' },
  { label: 'property', detail: '(fget?, fset?, fdel?, doc?)', doc: 'Return a property attribute.' },
  { label: 'staticmethod', detail: '(fn) → static method', doc: 'Create a static method.' },
  { label: 'classmethod', detail: '(fn) → class method', doc: 'Create a class method.' },

  // Exceptions
  { label: 'Exception', detail: 'Base exception class', doc: 'Base class for all built-in exceptions.' },
  { label: 'ValueError', detail: 'Raised for invalid values', doc: 'Raised when a function receives an argument of the right type but inappropriate value.' },
  { label: 'TypeError', detail: 'Raised for wrong types', doc: 'Raised when an operation is applied to an inappropriate type.' },
  { label: 'KeyError', detail: 'Raised for missing keys', doc: 'Raised when a dictionary key is not found.' },
  { label: 'IndexError', detail: 'Raised for out of range', doc: 'Raised when a sequence subscript is out of range.' },
  { label: 'FileNotFoundError', detail: 'Raised for missing files', doc: 'Raised when a file or directory is not found.' },
  { label: 'ImportError', detail: 'Raised for import failures', doc: 'Raised when an import fails.' },
  { label: 'AttributeError', detail: 'Raised for missing attributes', doc: 'Raised when an attribute reference fails.' },
  { label: 'RuntimeError', detail: 'General runtime error', doc: 'Raised when an error is detected that does not belong in any other category.' },
  { label: 'StopIteration', detail: 'Raised by iterators', doc: 'Raised by next() when an iterator has no more items.' },

  // Common modules (top-level names)
  { label: 'os', detail: 'module', doc: 'OS interface — file operations, paths, environment.' },
  { label: 'sys', detail: 'module', doc: 'System-specific parameters and functions.' },
  { label: 'math', detail: 'module', doc: 'Mathematical functions.' },
  { label: 'json', detail: 'module', doc: 'JSON encoder and decoder.' },
  { label: 're', detail: 'module', doc: 'Regular expression operations.' },
  { label: 'datetime', detail: 'module', doc: 'Basic date and time types.' },
  { label: 'time', detail: 'module', doc: 'Time access and conversions.' },
  { label: 'collections', detail: 'module', doc: 'Container data types.' },
  { label: 'itertools', detail: 'module', doc: 'Functions for creating iterators.' },
  { label: 'functools', detail: 'module', doc: 'Higher-order functions and operations.' },
  { label: 'pathlib', detail: 'module', doc: 'Object-oriented filesystem paths.' },
  { label: 'typing', detail: 'module', doc: 'Type hints for Python.' },
  { label: 'asyncio', detail: 'module', doc: 'Asynchronous I/O.' },
  { label: 'logging', detail: 'module', doc: 'Flexible event logging.' },
  { label: 'unittest', detail: 'module', doc: 'Unit testing framework.' },
  { label: 'dataclasses', detail: 'module', doc: 'Data classes decorator.' },
  { label: 'abc', detail: 'module', doc: 'Abstract Base Classes.' },
  { label: 'io', detail: 'module', doc: 'Core tools for working with streams.' },
  { label: 'subprocess', detail: 'module', doc: 'Spawn and manage subprocesses.' },
  { label: 'shutil', detail: 'module', doc: 'High-level file operations.' },

  // Common module methods
  { label: 'os.path.join', detail: '(*paths) → str', doc: 'Join path components.' },
  { label: 'os.path.exists', detail: '(path) → bool', doc: 'Check if a path exists.' },
  { label: 'os.listdir', detail: '(path=".") → list', doc: 'List directory contents.' },
  { label: 'os.makedirs', detail: '(path, exist_ok=False) → None', doc: 'Create directories recursively.' },
  { label: 'os.environ', detail: 'dict', doc: 'Mapping of environment variables.' },
  { label: 'json.load', detail: '(fp) → any', doc: 'Deserialize a file.' },
  { label: 'json.loads', detail: '(s) → any', doc: 'Deserialize a string.' },
  { label: 'json.dump', detail: '(obj, fp, ...) → None', doc: 'Serialize to a file.' },
  { label: 'json.dumps', detail: '(obj, ...) → str', doc: 'Serialize to a string.' },
  { label: 're.match', detail: '(pattern, string) → Match | None', doc: 'Match a pattern at the beginning.' },
  { label: 're.search', detail: '(pattern, string) → Match | None', doc: 'Search for a pattern.' },
  { label: 're.findall', detail: '(pattern, string) → list', doc: 'Find all matches.' },
  { label: 're.sub', detail: '(pattern, repl, string) → str', doc: 'Replace matches.' },
  { label: 'datetime.datetime.now', detail: '() → datetime', doc: 'Return the current date and time.' },
  { label: 'datetime.date.today', detail: '() → date', doc: "Return today's date." },
  { label: 'print', detail: '(*objects, sep, end, file, flush)', doc: 'Print to stdout.' },

  // Common class methods
  { label: 'append', detail: '(item) → None', doc: 'Add an item to the end of a list.' },
  { label: 'extend', detail: '(iterable) → None', doc: 'Extend list with items from an iterable.' },
  { label: 'insert', detail: '(index, item) → None', doc: 'Insert an item at a given position.' },
  { label: 'remove', detail: '(item) → None', doc: 'Remove the first occurrence of an item.' },
  { label: 'pop', detail: '(index=-1) → item', doc: 'Remove and return item at index.' },
  { label: 'index', detail: '(item) → int', doc: 'Return the first index of an item.' },
  { label: 'count', detail: '(item) → int', doc: 'Count occurrences of an item.' },
  { label: 'sort', detail: '(key=None, reverse=False) → None', doc: 'Sort the list in place.' },
  { label: 'reverse', detail: '() → None', doc: 'Reverse the list in place.' },
  { label: 'copy', detail: '() → list', doc: 'Return a shallow copy.' },
  { label: 'keys', detail: '() → dict_keys', doc: 'Return dictionary keys.' },
  { label: 'values', detail: '() → dict_values', doc: 'Return dictionary values.' },
  { label: 'items', detail: '() → dict_items', doc: 'Return dictionary items as tuples.' },
  { label: 'update', detail: '(other) → None', doc: 'Update dictionary with another mapping.' },
  { label: 'get', detail: '(key, default=None) → any', doc: 'Get a value with default.' },
  { label: 'setdefault', detail: '(key, default=None) → any', doc: 'Set default if key missing.' },
  { label: 'popitem', detail: '() → (key, value)', doc: 'Remove and return the last item.' },
  { label: 'clear', detail: '() → None', doc: 'Remove all items.' },
  { label: 'join', detail: '(iterable) → str', doc: 'Join an iterable into a string.' },
  { label: 'split', detail: '(sep=None, maxsplit=-1) → list', doc: 'Split a string into a list.' },
  { label: 'strip', detail: '() → str', doc: 'Remove leading and trailing whitespace.' },
  { label: 'lower', detail: '() → str', doc: 'Convert to lowercase.' },
  { label: 'upper', detail: '() → str', doc: 'Convert to uppercase.' },
  { label: 'replace', detail: '(old, new, count=-1) → str', doc: 'Replace occurrences.' },
  { label: 'find', detail: '(sub, start?, end?) → int', doc: 'Find a substring.' },
  { label: 'startswith', detail: '(prefix) → bool', doc: 'Check if string starts with prefix.' },
  { label: 'endswith', detail: '(suffix) → bool', doc: 'Check if string ends with suffix.' },
  { label: 'format', detail: '(*args, **kwargs) → str', doc: 'Format a string.' },
  { label: 'encode', detail: '(encoding="utf-8") → bytes', doc: 'Encode to bytes.' },

  // Flask/Django specific
  { label: 'app', detail: 'Flask app', doc: 'The Flask application instance.' },
  { label: 'request', detail: 'Flask request', doc: 'The current request object.' },
  { label: 'jsonify', detail: '(*args, **kwargs) → Response', doc: 'Create a JSON response.' },
  { label: 'redirect', detail: '(url, code=302) → Response', doc: 'Redirect to a URL.' },
  { label: 'render_template', detail: '(template, **context) → str', doc: 'Render a Jinja2 template.' },
];

const PY_SNIPPETS = [
  { prefix: 'def', name: 'function', body: 'def ${1:name}(${2:params}):\n\t${3:pass}' },
  { prefix: 'adef', name: 'async function', body: 'async def ${1:name}(${2:params}):\n\t${3:pass}' },
  { prefix: 'cls', name: 'class', body: 'class ${1:Name}:\n\tdef __init__(self${2:, params}):\n\t\t${3:pass}' },
  { prefix: 'for', name: 'for loop', body: 'for ${1:item} in ${2:iterable}:\n\t${3:pass}' },
  { prefix: 'forr', name: 'for range', body: 'for ${1:i} in range(${2:count}):\n\t${3:pass}' },
  { prefix: 'while', name: 'while', body: 'while ${1:condition}:\n\t${2:pass}' },
  { prefix: 'ife', name: 'if/else', body: 'if ${1:condition}:\n\t${2:pass}\nelse:\n\t${3:pass}' },
  { prefix: 'elif', name: 'elif', body: 'elif ${1:condition}:\n\t${2:pass}' },
  { prefix: 'try', name: 'try/except', body: 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:pass}' },
  { prefix: 'tryf', name: 'try/except/finally', body: 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:pass}\nfinally:\n\t${5:pass}' },
  { prefix: 'with', name: 'with', body: 'with ${1:expr} as ${2:var}:\n\t${3:pass}' },
  { prefix: 'lambda', name: 'lambda', body: 'lambda ${1:args}: ${2:expr}' },
  { prefix: 'comp', name: 'list comprehension', body: '[${1:x} for ${1:x} in ${2:iterable}]' },
  { prefix: 'dcomp', name: 'dict comprehension', body: '{${1:key}: ${2:val} for ${1:key} in ${3:iterable}}' },
  { prefix: 'scomp', name: 'set comprehension', body: '{${1:x} for ${1:x} in ${2:iterable}}' },
  { prefix: 'genc', name: 'generator expression', body: '(${1:x} for ${1:x} in ${2:iterable})' },
  { prefix: 'ifmain', name: 'if __name__', body: "if __name__ == '__main__':\n\t${1:main()}" },
  { prefix: 'main', name: 'main function', body: 'def main():\n\t${1:pass}\n\n\nif __name__ == \'__main__\':\n\tmain()' },
  { prefix: 'imp', name: 'import', body: 'import ${1:module}' },
  { prefix: 'impf', name: 'from import', body: 'from ${1:module} import ${2:name}' },
  { prefix: 'impa', name: 'import as', body: 'import ${1:module} as ${2:alias}' },
  { prefix: 'log', name: 'logging', body: 'import logging\n\nlogger = logging.getLogger(__name__)\nlogger.info(${1})' },
  { prefix: 'print', name: 'print', body: 'print(${1})' },
  { prefix: 'pprint', name: 'pretty print', body: 'from pprint import pprint\npprint(${1:obj})' },
  { prefix: 'read', name: 'read file', body: "with open('${1:filename}', 'r') as ${2:f}:\n\t${3:data = f.read()}" },
  { prefix: 'write', name: 'write file', body: "with open('${1:filename}', 'w') as ${2:f}:\n\t${3:f.write(data)}" },
  { prefix: 'flask', name: 'Flask app', body: "from flask import Flask, request, jsonify\n\napp = Flask(__name__)\n\n@app.route('/')\ndef index():\n\treturn jsonify({'message': 'Hello, World!'})" },
  { prefix: 'pytest', name: 'test function', body: 'def test_${1:name}():\n\tassert ${2:True}' },
  { prefix: 'async', name: 'async function', body: 'async def ${1:name}(${2:params}):\n\t${3:pass}' },
  { prefix: 'await', name: 'await', body: '${1:result} = await ${2:coroutine}' },
  { prefix: 'dataclass', name: 'dataclass', body: '@dataclasses.dataclass\nclass ${1:Name}:\n\t${2:field}: ${3:type}' },
  { prefix: 'prop', name: 'property', body: '@property\ndef ${1:name}(self):\n\treturn self._${1:name}\n\n@${1:name}.setter\ndef ${1:name}(self, value):\n\tself._${1:name} = value' },
];

const PY_DIAGNOSTIC_RULES = [
  { pattern: /\bprint\s*\(/, severity: 'hint', message: () => 'print() — ensure this is Python 3', source: 'intelli' },
  { pattern: /\bexcept\s*:/, severity: 'warning', message: () => 'Bare except is discouraged. Use specific exception types.', source: 'intelli' },
  { pattern: /\bexcept\s+Exception\b(?!\s+as)/, severity: 'hint', message: () => 'Consider using "as e" to capture the exception', source: 'intelli' },
  { pattern: /==\s*True/, severity: 'hint', message: () => 'Use "if x:" instead of "if x == True:"', source: 'intelli' },
  { pattern: /==\s*False/, severity: 'hint', message: () => 'Use "if not x:" instead of "if x == False:"', source: 'intelli' },
  { pattern: /==\s*None/, severity: 'warning', message: () => 'Use "is None" instead of "== None"', source: 'intelli' },
  { pattern: /!=\s*None/, severity: 'warning', message: () => 'Use "is not None" instead of "!= None"', source: 'intelli' },
  { pattern: /\bimport\s+\*\b/, severity: 'warning', message: () => 'Wildcard imports (*) are discouraged', source: 'intelli' },
  { pattern: /;\s*$/, severity: 'hint', message: () => 'Unnecessary semicolon in Python', source: 'intelli' },
];

class PythonAnalyzer extends LanguageAnalyzer {
  constructor() {
    super({
      id: 'python',
      name: 'Python',
      extensions: ['.py', '.pyw', '.pyi', '.ipynb'],
    });
  }

  getKeywords() { return PY_KEYWORDS; }
  getBuiltins() { return PY_BUILTINS; }

  getCompletions(content, position, language) {
    const prefix = this._getPrefix(content, position);
    if (!prefix) return [];
    const pl = prefix.toLowerCase();
    const items = [];

    // Snippets
    for (const s of PY_SNIPPETS) {
      if (s.prefix.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(s.prefix, 'snippet', {
          detail: s.name,
          insertText: s.body,
          sortOrder: 0,
          source: 'snippet',
        }));
      }
    }

    // Keywords
    for (const kw of PY_KEYWORDS) {
      if (kw.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(kw, 'keyword', {
          detail: 'keyword',
          sortOrder: 10,
          source: 'keyword',
        }));
      }
    }

    // Builtins
    for (const b of PY_BUILTINS) {
      if (b.label.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(b.label, 'builtin', {
          detail: b.detail,
          documentation: b.doc,
          sortOrder: 20,
          source: 'builtin',
        }));
      }
    }

    // Document functions and classes
    const funcs = extractFunctions(content, [
      /\bdef\s+(\w+)\s*\(([^)]*)\)/,
      /\basync\s+def\s+(\w+)\s*\(([^)]*)\)/,
    ]);
    const classes = extractClasses(content, [/\bclass\s+(\w+)/]);

    for (const f of funcs) {
      if (f.name.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(f.name, 'function', {
          detail: `def ${f.name}(${f.params})`,
          sortOrder: 30,
          source: 'document',
        }));
      }
    }
    for (const c of classes) {
      if (c.name.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(c.name, 'class', {
          detail: `class ${c.name}`,
          sortOrder: 30,
          source: 'document',
        }));
      }
    }

    return items;
  }

  _getPrefix(content, position) {
    const lines = content.split('\n');
    const line = lines[position.line] || '';
    const before = line.slice(0, position.ch);
    const m = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
    return m ? m[0] : '';
  }

  getHover(content, position, language) {
    const token = this._getTokenAt(content, position);
    if (!token) return null;

    const builtin = PY_BUILTINS.find(b => b.label === token);
    if (builtin) {
      return {
        contents: [
          { language: 'python', value: `${token}(${builtin.detail || ''})` },
          builtin.doc,
        ],
      };
    }

    const funcs = extractFunctions(content, [
      /\bdef\s+(\w+)\s*\(([^)]*)\)/,
      /\basync\s+def\s+(\w+)\s*\(([^)]*)\)/,
    ]);
    const func = funcs.find(f => f.name === token);
    if (func) {
      return {
        contents: [
          { language: 'python', value: func.signature },
          `Defined at line ${func.line + 1}`,
        ],
      };
    }

    const classes = extractClasses(content, [/\bclass\s+(\w+)/]);
    const cls = classes.find(c => c.name === token);
    if (cls) {
      return {
        contents: [
          { language: 'python', value: cls.declaration },
          `Defined at line ${cls.line + 1}`,
        ],
      };
    }

    return null;
  }

  getDiagnostics(content, language) {
    return patternDiagnostics(content, PY_DIAGNOSTIC_RULES);
  }

  getDefinition(content, position, language) {
    const token = this._getTokenAt(content, position);
    if (!token) return null;

    const lines = content.split('\n');
    const patterns = [
      new RegExp(`\\bdef\\s+${this._escapeRegex(token)}\\s*\\(`),
      new RegExp(`\\bclass\\s+${this._escapeRegex(token)}\\b`),
      new RegExp(`\\b(?:${this._escapeRegex(token)})\\s*=`),
    ];

    for (let i = 0; i < lines.length; i++) {
      for (const pat of patterns) {
        if (pat.test(lines[i])) {
          return { uri: null, range: { start: { line: i, character: 0 }, end: { line: i, character: lines[i].length } } };
        }
      }
    }
    return null;
  }

  getReferences(content, position, language) {
    const token = this._getTokenAt(content, position);
    if (!token) return [];

    const refs = [];
    const lines = content.split('\n');
    const re = new RegExp(`\\b${this._escapeRegex(token)}\\b`, 'g');
    for (let i = 0; i < lines.length; i++) {
      re.lastIndex = 0;
      if (re.test(lines[i])) {
        refs.push({ uri: null, range: { start: { line: i, character: 0 }, end: { line: i, character: lines[i].length } } });
      }
    }
    return refs;
  }

  getSignature(content, position, language) {
    const lines = content.split('\n');
    const line = lines[position.line] || '';
    const before = line.slice(0, position.ch);

    const callMatch = before.match(/(\w+)\s*\([^)]*$/);
    if (!callMatch) return null;
    const funcName = callMatch[1];

    const patterns = [
      new RegExp(`(?:async\\s+)?def\\s+${this._escapeRegex(funcName)}\\s*\\(([^)]*)\\)`),
    ];

    for (const pat of patterns) {
      const m = content.match(pat);
      if (m) {
        return {
          signatures: [{
            label: `${funcName}(${m[1]})`,
            documentation: '',
            parameters: m[1].split(',').map(p => ({ label: p.trim() })),
          }],
          activeParameter: this._countCommas(before),
        };
      }
    }
    return null;
  }

  _getTokenAt(content, position) {
    const lines = content.split('\n');
    const line = lines[position.line] || '';
    const before = line.slice(0, position.ch);
    const m = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
    return m ? m[0] : '';
  }

  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  _countCommas(str) {
    let count = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '(') break;
      if (str[i] === ',') count++;
    }
    return count;
  }
}

export default PythonAnalyzer;
