// PocketPad Intelli — JavaScript/TypeScript Language Analyzer
import { LanguageAnalyzer, CompletionItem, identifierAt, allIdentifiers, extractFunctions, extractClasses, patternDiagnostics } from './base.js';

const JS_KEYWORDS = [
  'async','await','break','case','catch','class','const','continue','debugger',
  'default','delete','do','else','export','extends','false','finally','for',
  'from','function','get','if','import','in','instanceof','let','new','null',
  'of','return','set','static','super','switch','this','throw','true','try',
  'typeof','undefined','var','void','while','with','yield',
  // ES2020+
  'as','assert','constructor','declare','enum','implements','interface',
  'is','keyof','module','namespace','never','package','private','protected',
  'public','readonly','override','satisfies','type','unknown',
];

const JS_BUILTINS = [
  // Console
  { label: 'console', detail: 'Console', doc: 'The console object provides access to the browser debugging console.' },
  { label: 'console.log', detail: '(...data) → void', doc: 'Outputs a message to the console.' },
  { label: 'console.error', detail: '(...data) → void', doc: 'Outputs an error message to the console.' },
  { label: 'console.warn', detail: '(...data) → void', doc: 'Outputs a warning message to the console.' },
  { label: 'console.info', detail: '(...data) → void', doc: 'Outputs an informational message to the console.' },
  { label: 'console.debug', detail: '(...data) → void', doc: 'Outputs a debug message to the console.' },
  { label: 'console.table', detail: '(data, columns?) → void', doc: 'Displays tabular data as a table.' },
  { label: 'console.time', detail: '(label?) → void', doc: 'Starts a timer.' },
  { label: 'console.timeEnd', detail: '(label?) → void', doc: 'Stops a timer and outputs the elapsed time.' },
  { label: 'console.group', detail: '(label?) → void', doc: 'Groups subsequent console output.' },
  { label: 'console.groupEnd', detail: '() → void', doc: 'Exits the most recently created console group.' },
  { label: 'console.trace', detail: '(...data) → void', doc: 'Outputs a stack trace.' },
  { label: 'console.assert', detail: '(condition, ...data) → void', doc: 'Writes an error message if assertion is false.' },

  // Object
  { label: 'Object', detail: 'constructor', doc: 'The base object constructor.' },
  { label: 'Object.keys', detail: '(obj) → string[]', doc: 'Returns an array of a given object own enumerable string-keyed property names.' },
  { label: 'Object.values', detail: '(obj) → any[]', doc: 'Returns an array of a given object own enumerable string-keyed property values.' },
  { label: 'Object.entries', detail: '(obj) → [string, any][]', doc: 'Returns an array of a given object own enumerable string-keyed property [key, value] pairs.' },
  { label: 'Object.assign', detail: '(target, ...sources) → object', doc: 'Copies all enumerable own properties from one or more source objects.' },
  { label: 'Object.create', detail: '(proto, props?) → object', doc: 'Creates a new object with the specified prototype.' },
  { label: 'Object.freeze', detail: '(obj) → object', doc: 'Freezes an object.' },
  { label: 'Object.keys', detail: '(obj) → string[]', doc: 'Returns own enumerable property names.' },

  // Array
  { label: 'Array', detail: 'constructor', doc: 'The Array constructor.' },
  { label: 'Array.from', detail: '(iterable, mapFn?) → any[]', doc: 'Creates an Array from an iterable.' },
  { label: 'Array.isArray', detail: '(value) → boolean', doc: 'Determines whether the passed value is an Array.' },
  { label: 'Array.of', detail: '(...items) → any[]', doc: 'Creates an Array from the arguments.' },

  // Array prototype
  { label: 'Array.prototype.map', detail: '(fn) → any[]', doc: 'Creates a new array with the results of calling a function on every element.' },
  { label: 'Array.prototype.filter', detail: '(fn) → any[]', doc: 'Creates a new array with elements that pass a test.' },
  { label: 'Array.prototype.reduce', detail: '(fn, init?) → any', doc: 'Reduces an array to a single value.' },
  { label: 'Array.prototype.forEach', detail: '(fn) → void', doc: 'Executes a provided function once per array element.' },
  { label: 'Array.prototype.find', detail: '(fn) → any', doc: 'Returns the first element that satisfies a condition.' },
  { label: 'Array.prototype.findIndex', detail: '(fn) → number', doc: 'Returns the index of the first element that satisfies a condition.' },
  { label: 'Array.prototype.includes', detail: '(value) → boolean', doc: 'Determines whether an array includes a certain value.' },
  { label: 'Array.prototype.push', detail: '(...items) → number', doc: 'Adds elements to the end of an array.' },
  { label: 'Array.prototype.pop', detail: '() → any', doc: 'Removes the last element from an array.' },
  { label: 'Array.prototype.shift', detail: '() → any', doc: 'Removes the first element from an array.' },
  { label: 'Array.prototype.unshift', detail: '(...items) → number', doc: 'Adds elements to the beginning of an array.' },
  { label: 'Array.prototype.slice', detail: '(start?, end?) → any[]', doc: 'Returns a shallow copy of a portion of an array.' },
  { label: 'Array.prototype.splice', detail: '(start, deleteCount?, ...items) → any[]', doc: 'Changes the contents of an array.' },
  { label: 'Array.prototype.flat', detail: '(depth?) → any[]', doc: 'Creates a new array with sub-array elements concatenated.' },
  { label: 'Array.prototype.flatMap', detail: '(fn) → any[]', doc: 'Maps each element then flattens the result.' },
  { label: 'Array.prototype.sort', detail: '(compareFn?) → any[]', doc: 'Sorts the elements of an array.' },
  { label: 'Array.prototype.reverse', detail: '() → any[]', doc: 'Reverses the order of elements.' },
  { label: 'Array.prototype.join', detail: '(separator?) → string', doc: 'Joins all elements into a string.' },
  { label: 'Array.prototype.concat', detail: '(...items) → any[]', doc: 'Returns a new array combining this array with other arrays/values.' },
  { label: 'Array.prototype.some', detail: '(fn) → boolean', doc: 'Tests whether at least one element passes a test.' },
  { label: 'Array.prototype.every', detail: '(fn) → boolean', doc: 'Tests whether all elements pass a test.' },

  // String
  { label: 'String', detail: 'constructor', doc: 'The String constructor.' },
  { label: 'String.prototype.split', detail: '(separator?) → string[]', doc: 'Splits a string into an array of substrings.' },
  { label: 'String.prototype.join', detail: '(separator?) → string', doc: 'Joins an array of substrings.' },
  { label: 'String.prototype.trim', detail: '() → string', doc: 'Removes whitespace from both ends.' },
  { label: 'String.prototype.includes', detail: '(search) → boolean', doc: 'Determines whether a string contains another string.' },
  { label: 'String.prototype.startsWith', detail: '(search) → boolean', doc: 'Determines whether a string begins with another string.' },
  { label: 'String.prototype.endsWith', detail: '(search) → boolean', doc: 'Determines whether a string ends with another string.' },
  { label: 'String.prototype.replace', detail: '(search, replace) → string', doc: 'Returns a new string with replacements.' },
  { label: 'String.prototype.replaceAll', detail: '(search, replace) → string', doc: 'Replaces all occurrences.' },
  { label: 'String.prototype.slice', detail: '(start?, end?) → string', doc: 'Extracts a section of a string.' },
  { label: 'String.prototype.substring', detail: '(start?, end?) → string', doc: 'Returns a substring.' },
  { label: 'String.prototype.toLowerCase', detail: '() → string', doc: 'Converts to lowercase.' },
  { label: 'String.prototype.toUpperCase', detail: '() → string', doc: 'Converts to uppercase.' },
  { label: 'String.prototype.padStart', detail: '(len, fill?) → string', doc: 'Pads from the start.' },
  { label: 'String.prototype.padEnd', detail: '(len, fill?) → string', doc: 'Pads from the end.' },
  { label: 'String.prototype.match', detail: '(regex) → RegExpMatchArray | null', doc: 'Retrieves match results.' },
  { label: 'String.prototype.matchAll', detail: '(regex) → RegExpStringIterator', doc: 'Returns an iterator of all matches.' },
  { label: 'String.prototype.repeat', detail: '(count) → string', doc: 'Repeats the string.' },
  { label: 'String.prototype.charAt', detail: '(index) → string', doc: 'Returns the character at index.' },
  { label: 'String.prototype.charCodeAt', detail: '(index) → number', doc: 'Returns the UTF-16 code unit.' },

  // Number
  { label: 'Number', detail: 'constructor', doc: 'The Number constructor.' },
  { label: 'Number.isNaN', detail: '(value) → boolean', doc: 'Determine whether the passed value is NaN.' },
  { label: 'Number.isFinite', detail: '(value) → boolean', doc: 'Determine whether the passed value is a finite number.' },
  { label: 'Number.parseInt', detail: '(string, radix?) → number', doc: 'Parses a string and returns an integer.' },
  { label: 'Number.parseFloat', detail: '(string) → number', doc: 'Parses a string and returns a floating point number.' },
  { label: 'Number.isInteger', detail: '(value) → boolean', doc: 'Determines whether the passed value is an integer.' },

  // Math
  { label: 'Math', detail: 'Math utilities', doc: 'The Math object contains static methods and properties.' },
  { label: 'Math.floor', detail: '(x) → number', doc: 'Returns the largest integer less than or equal to x.' },
  { label: 'Math.ceil', detail: '(x) → number', doc: 'Returns the smallest integer greater than or equal to x.' },
  { label: 'Math.round', detail: '(x) → number', doc: 'Returns the value of x rounded to the nearest integer.' },
  { label: 'Math.random', detail: '() → number', doc: 'Returns a pseudo-random number between 0 and 1.' },
  { label: 'Math.max', detail: '(...values) → number', doc: 'Returns the largest of the given numbers.' },
  { label: 'Math.min', detail: '(...values) → number', doc: 'Returns the smallest of the given numbers.' },
  { label: 'Math.abs', detail: '(x) → number', doc: 'Returns the absolute value of x.' },
  { label: 'Math.sqrt', detail: '(x) → number', doc: 'Returns the square root of x.' },
  { label: 'Math.pow', detail: '(base, exp) → number', doc: 'Returns base raised to exp.' },
  { label: 'Math.PI', detail: 'number ≈ 3.14159', doc: 'The ratio of a circle circumference to its diameter.' },
  { label: 'Math.E', detail: 'number ≈ 2.71828', doc: "Euler's number." },

  // Date
  { label: 'Date', detail: 'constructor', doc: 'The Date constructor.' },
  { label: 'Date.now', detail: '() → number', doc: 'Returns the number of milliseconds since Jan 1, 1970.' },
  { label: 'Date.prototype.toISOString', detail: '() → string', doc: 'Returns the date as an ISO string.' },
  { label: 'Date.prototype.getFullYear', detail: '() → number', doc: 'Returns the 4-digit year.' },
  { label: 'Date.prototype.getMonth', detail: '() → number', doc: 'Returns the month (0-11).' },
  { label: 'Date.prototype.getDate', detail: '() → number', doc: 'Returns the day of the month.' },

  // JSON
  { label: 'JSON', detail: 'JSON utilities', doc: 'The JSON object contains methods for parsing and stringifying.' },
  { label: 'JSON.parse', detail: '(text, reviver?) → any', doc: 'Parses a JSON string.' },
  { label: 'JSON.stringify', detail: '(value, replacer?, space?) → string', doc: 'Converts a value to a JSON string.' },

  // Promise
  { label: 'Promise', detail: 'constructor', doc: 'The Promise constructor.' },
  { label: 'Promise.all', detail: '(promises) → Promise<any[]>', doc: 'Returns a promise that resolves when all promises resolve.' },
  { label: 'Promise.race', detail: '(promises) → Promise<any>', doc: 'Returns a promise that resolves/rejects with the first result.' },
  { label: 'Promise.allSettled', detail: '(promises) → Promise<any[]>', doc: 'Returns a promise that resolves when all promises settle.' },
  { label: 'Promise.any', detail: '(promises) → Promise<any>', doc: 'Returns a promise that resolves with the first fulfilled.' },
  { label: 'Promise.resolve', detail: '(value?) → Promise<any>', doc: 'Returns a resolved Promise.' },
  { label: 'Promise.reject', detail: '(reason?) → Promise<any>', doc: 'Returns a rejected Promise.' },

  // Map, Set, WeakMap, WeakSet
  { label: 'Map', detail: 'constructor', doc: 'The Map object holds key-value pairs.' },
  { label: 'Set', detail: 'constructor', doc: 'The Set object lets you store unique values.' },
  { label: 'WeakMap', detail: 'constructor', doc: 'A Map with weak references to keys.' },
  { label: 'WeakSet', detail: 'constructor', doc: 'A Set with weak references.' },

  // Reflect & Proxy
  { label: 'Proxy', detail: 'constructor', doc: 'Creates a proxy for an object.' },
  { label: 'Reflect', detail: 'Reflect API', doc: 'A static object providing methods for interceptable JavaScript operations.' },

  // Global
  { label: 'globalThis', detail: 'global object', doc: 'The global This value.' },
  { label: 'window', detail: 'Window', doc: 'The global Window object (browser).' },
  { label: 'document', detail: 'Document', doc: 'The Document object.' },
  { label: 'navigator', detail: 'Navigator', doc: 'The Navigator object.' },
  { label: 'fetch', detail: '(url, init?) → Promise<Response>', doc: 'Fetches a resource from the network.' },
  { label: 'setTimeout', detail: '(fn, ms) → number', doc: 'Schedules a function to run after a delay.' },
  { label: 'setInterval', detail: '(fn, ms) → number', doc: 'Repeats a function at intervals.' },
  { label: 'clearTimeout', detail: '(id) → void', doc: 'Cancels a timeout.' },
  { label: 'clearInterval', detail: '(id) → void', doc: 'Cancels an interval.' },
  { label: 'parseInt', detail: '(string, radix?) → number', doc: 'Parses a string to integer.' },
  { label: 'parseFloat', detail: '(string) → number', doc: 'Parses a string to float.' },
  { label: 'isNaN', detail: '(value) → boolean', doc: 'Determines if value is NaN.' },
  { label: 'isFinite', detail: '(value) → boolean', doc: 'Determines if value is finite.' },
  { label: 'encodeURI', detail: '(uri) → string', doc: 'Encodes a URI.' },
  { label: 'decodeURI', detail: '(uri) → string', doc: 'Decodes a URI.' },
  { label: 'encodeURIComponent', detail: '(str) → string', doc: 'Encodes a URI component.' },
  { label: 'decodeURIComponent', detail: '(str) → string', doc: 'Decodes a URI component.' },
  { label: 'atob', detail: '(str) → string', doc: 'Decodes a base-64 encoded string.' },
  { label: 'btoa', detail: '(str) → string', doc: 'Encodes a string in base-64.' },
  { label: 'structuredClone', detail: '(value) → any', doc: 'Deep clones a value.' },
  { label: 'requestAnimationFrame', detail: '(fn) → number', doc: 'Schedules a callback before the next repaint.' },
  { label: 'cancelAnimationFrame', detail: '(id) → void', doc: 'Cancels an animation frame.' },
  { label: 'queueMicrotask', detail: '(fn) → void', doc: 'Queues a microtask.' },

  // DOM (common)
  { label: 'getElementById', detail: '(id) → HTMLElement | null', doc: 'Returns an element by ID.' },
  { label: 'querySelector', detail: '(selector) → Element | null', doc: 'Returns the first element matching a CSS selector.' },
  { label: 'querySelectorAll', detail: '(selector) → NodeList', doc: 'Returns all elements matching a CSS selector.' },
  { label: 'addEventListener', detail: '(type, fn, opts?) → void', doc: 'Registers an event handler.' },
  { label: 'removeEventListener', detail: '(type, fn) → void', doc: 'Removes an event handler.' },

  // Error classes
  { label: 'Error', detail: 'Error constructor', doc: 'The base Error class.' },
  { label: 'TypeError', detail: 'TypeError constructor', doc: 'An error when an operand is not of the correct type.' },
  { label: 'RangeError', detail: 'RangeError constructor', doc: 'An error when a value is not in the expected range.' },
  { label: 'SyntaxError', detail: 'SyntaxError constructor', doc: 'An error when code cannot be parsed.' },
  { label: 'ReferenceError', detail: 'ReferenceError constructor', doc: 'An error when a reference does not exist.' },
];

const JS_SNIPPETS = [
  { prefix: 'fn', name: 'function', body: 'function ${1:name}(${2:params}) {\n\t${3}\n}' },
  { prefix: 'afn', name: 'async function', body: 'async function ${1:name}(${2:params}) {\n\t${3}\n}' },
  { prefix: 'iife', name: 'Immediately Invoked Function', body: '(function(${1}) {\n\t${2}\n})(${3});' },
  { prefix: 'arrow', name: 'arrow function', body: '(${1}) => {\n\t${2}\n}' },
  { prefix: 'class', name: 'class', body: 'class ${1:Name} {\n\tconstructor(${2:params}) {\n\t\t${3}\n\t}\n}' },
  { prefix: 'for', name: 'for loop', body: 'for (let ${1:i} = 0; ${1:i} < ${2:count}; ${1:i}++) {\n\t${3}\n}' },
  { prefix: 'forin', name: 'for...in', body: 'for (const ${1:key} in ${2:obj}) {\n\t${3}\n}' },
  { prefix: 'forof', name: 'for...of', body: 'for (const ${1:item} of ${2:iterable}) {\n\t${3}\n}' },
  { prefix: 'while', name: 'while loop', body: 'while (${1:condition}) {\n\t${2}\n}' },
  { prefix: 'if', name: 'if', body: 'if (${1:condition}) {\n\t${2}\n}' },
  { prefix: 'ife', name: 'if...else', body: 'if (${1:condition}) {\n\t${2}\n} else {\n\t${3}\n}' },
  { prefix: 'switch', name: 'switch', body: 'switch (${1:value}) {\n\tcase ${2:x}:\n\t\t${3}\n\t\tbreak;\n\tdefault:\n\t\t${4}\n}' },
  { prefix: 'try', name: 'try...catch', body: 'try {\n\t${1}\n} catch (${2:e}) {\n\t${3}\n}' },
  { prefix: 'tryf', name: 'try...catch...finally', body: 'try {\n\t${1}\n} catch (${2:e}) {\n\t${3}\n} finally {\n\t${4}\n}' },
  { prefix: 'prom', name: 'Promise', body: 'new Promise((resolve, reject) => {\n\t${1}\n});' },
  { prefix: 'aprom', name: 'async Promise', body: 'async () => {\n\tconst ${1:result} = await ${2:value};\n\t${3}\n}' },
  { prefix: 'cb', name: 'callback', body: 'function ${1:name}(${2:err}, ${3:result}) {\n\tif (${2:err}) throw ${2:err};\n\t${4}\n}' },
  { prefix: 'map', name: '.map()', body: '.map((${1:item}) => {\n\t${2}\n})' },
  { prefix: 'filter', name: '.filter()', body: '.filter((${1:item}) => {\n\t${2}\n})' },
  { prefix: 'reduce', name: '.reduce()', body: '.reduce((${1:acc}, ${2:item}) => {\n\t${3}\n}, ${4:init})' },
  { prefix: 'foreach', name: '.forEach()', body: '.forEach((${1:item}) => {\n\t${2}\n})' },
  { prefix: 'find', name: '.find()', body: '.find((${1:item}) => {\n\t${2}\n})' },
  { prefix: 'import', name: 'import', body: "import { ${1} } from '${2}';" },
  { prefix: 'importd', name: 'import default', body: "import ${1:name} from '${2}';" },
  { prefix: 'export', name: 'export', body: 'export ${1}' },
  { prefix: 'exportd', name: 'export default', body: 'export default ${1}' },
  { prefix: 'await', name: 'await', body: 'const ${1:result} = await ${2:promise};' },
  { prefix: 'req', name: 'require', body: "const ${1:module} = require('${2}');" },
  { prefix: 'tern', name: 'ternary', body: '${1:condition} ? ${2:true} : ${3:false}' },
  { prefix: 'log', name: 'console.log', body: 'console.log(${1});' },
  { prefix: 'err', name: 'console.error', body: 'console.error(${1});' },
  { prefix: 'json', name: 'JSON.parse', body: 'JSON.parse(${1:str})' },
  { prefix: 'str', name: 'JSON.stringify', body: 'JSON.stringify(${1:obj}, null, 2)' },
  { prefix: 'dom', name: 'getElementById', body: "document.getElementById('${1:id}')" },
  { prefix: 'qs', name: 'querySelector', body: "document.querySelector('${1:selector}')" },
  { prefix: 'qsa', name: 'querySelectorAll', body: "document.querySelectorAll('${1:selector}')" },
  { prefix: 'add', name: 'addEventListener', body: "${1:el}.addEventListener('${2:click}', (${3:e}) => {\n\t${4}\n});" },
  { prefix: 'local', name: 'localStorage.getItem', body: "JSON.parse(localStorage.getItem('${1:key}'))" },
  { prefix: 'locals', name: 'localStorage.setItem', body: "localStorage.setItem('${1:key}', JSON.stringify(${2:value}));" },
  { prefix: 'fetch', name: 'fetch', body: "fetch('${1:url}')\n\t.then(res => res.json())\n\t.then(data => {\n\t\t${2}\n\t})\n\t.catch(err => console.error(err));" },
  { prefix: 'afetch', name: 'async fetch', body: "const ${1:response} = await fetch('${2:url}');\nconst ${3:data} = await ${1:response}.json();\n${4}" },
  { prefix: 'debounce', name: 'debounce', body: "function debounce(${1:fn}, ${2:delay = 300}) {\n\tlet timer;\n\treturn (...args) => {\n\t\tclearTimeout(timer);\n\t\ttimer = setTimeout(() => ${1:fn}(...args), ${2:delay});\n\t};\n}" },
  { prefix: 'throttle', name: 'throttle', body: "function throttle(${1:fn}, ${2:limit = 300}) {\n\tlet inThrottle;\n\treturn (...args) => {\n\t\tif (!inThrottle) {\n\t\t\t${1:fn}(...args);\n\t\t\tinThrottle = true;\n\t\t\tsetTimeout(() => inThrottle = false, ${2:limit});\n\t\t}\n\t};\n}" },
];

// ─── Diagnostic Rules ───
const JS_DIAGNOSTIC_RULES = [
  { pattern: /\bconsole\.log\b/, severity: 'hint', message: () => 'Consider removing console.log in production', source: 'intelli' },
  { pattern: /==(?!=)/, severity: 'warning', message: () => 'Use strict equality (===) instead of ==', source: 'intelli' },
  { pattern: /!=(?!=)/, severity: 'warning', message: () => 'Use strict inequality (!==) instead of !=', source: 'intelli' },
  { pattern: /\beval\s*\(/, severity: 'error', message: () => 'eval() is a security risk and bad practice', source: 'intelli' },
  { pattern: /\bwith\s*\(/, severity: 'warning', message: () => 'The "with" statement is deprecated', source: 'intelli' },
  { pattern: /\bvar\b/, severity: 'hint', message: () => 'Prefer "const" or "let" over "var"', source: 'intelli' },
  { pattern: /\balert\s*\(/, severity: 'hint', message: () => 'Consider using a UI notification instead of alert()', source: 'intelli' },
];

class JavaScriptAnalyzer extends LanguageAnalyzer {
  constructor() {
    super({
      id: 'javascript',
      name: 'JavaScript',
      extensions: ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.d.ts'],
    });
  }

  getKeywords() { return JS_KEYWORDS; }
  getBuiltins() { return JS_BUILTINS; }

  getCompletions(content, position, language) {
    const prefix = this._getPrefix(content, position);
    if (!prefix) return [];
    const pl = prefix.toLowerCase();
    const items = [];

    // Snippets
    for (const s of JS_SNIPPETS) {
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
    for (const kw of JS_KEYWORDS) {
      if (kw.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(kw, 'keyword', {
          detail: 'keyword',
          sortOrder: 10,
          source: 'keyword',
        }));
      }
    }

    // Builtins
    for (const b of JS_BUILTINS) {
      if (b.label.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(b.label, 'builtin', {
          detail: b.detail,
          documentation: b.doc,
          sortOrder: 20,
          source: 'builtin',
        }));
      }
    }

    // Document symbols (functions, classes, variables)
    const funcs = extractFunctions(content, [
      /\bfunction\s+(\w+)\s*\(([^)]*)\)/,
      /\b(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/,
      /\b(\w+)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/,
    ]);
    const classes = extractClasses(content, [/\bclass\s+(\w+)/]);

    for (const f of funcs) {
      if (f.name.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(f.name, 'function', {
          detail: `function ${f.name}(${f.params})`,
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

    // Member completions (after .)
    const memberPrefix = this._getMemberPrefix(content, position);
    if (memberPrefix) {
      const objName = memberPrefix.object;
      const propPrefix = memberPrefix.property.toLowerCase();
      const protoMap = this._getObjectProtos();
      if (protoMap[objName]) {
        for (const prop of protoMap[objName]) {
          if (prop.label.toLowerCase().startsWith(propPrefix)) {
            items.push(CompletionItem(prop.label, 'property', {
              detail: prop.detail,
              documentation: prop.doc,
              sortOrder: 15,
              source: 'builtin',
            }));
          }
        }
      }
    }

    return items;
  }

  _getPrefix(content, position) {
    const lines = content.split('\n');
    const line = lines[position.line] || '';
    const before = line.slice(0, position.ch);
    const m = before.match(/[A-Za-z_$][A-Za-z0-9_$]*$/);
    return m ? m[0] : '';
  }

  _getMemberPrefix(content, position) {
    const lines = content.split('\n');
    const line = lines[position.line] || '';
    const before = line.slice(0, position.ch);
    const m = before.match(/([A-Za-z_$][A-Za-z0-9_$]*)\.([A-Za-z_$][A-Za-z0-9_$]*)$/);
    if (!m) return null;
    return { object: m[1], property: m[2] };
  }

  _getObjectProtos() {
    return {
      console: JS_BUILTINS.filter(b => b.label.startsWith('console.')),
      'Array.prototype': JS_BUILTINS.filter(b => b.label.startsWith('Array.prototype.')),
      'String.prototype': JS_BUILTINS.filter(b => b.label.startsWith('String.prototype.')),
      'Object': JS_BUILTINS.filter(b => b.label.startsWith('Object.')),
      'Math': JS_BUILTINS.filter(b => b.label.startsWith('Math.')),
      'JSON': JS_BUILTINS.filter(b => b.label.startsWith('JSON.')),
      'Promise': JS_BUILTINS.filter(b => b.label.startsWith('Promise.')),
      'Date': JS_BUILTINS.filter(b => b.label.startsWith('Date.')),
      'Number': JS_BUILTINS.filter(b => b.label.startsWith('Number.')),
      // Common variable names
      'req': [
        { label: 'body', detail: 'any', doc: 'Request body' },
        { label: 'params', detail: 'object', doc: 'Route parameters' },
        { label: 'query', detail: 'object', doc: 'Query string parameters' },
        { label: 'headers', detail: 'Headers', doc: 'Request headers' },
        { label: 'method', detail: 'string', doc: 'HTTP method' },
        { label: 'url', detail: 'string', doc: 'Request URL' },
      ],
      'res': [
        { label: 'send', detail: '(body) → Response', doc: 'Send a response' },
        { label: 'json', detail: '(body) → Response', doc: 'Send JSON response' },
        { label: 'status', detail: '(code) → Response', doc: 'Set status code' },
        { label: 'redirect', detail: '(url) → void', doc: 'Redirect to URL' },
      ],
    };
  }

  getHover(content, position, language) {
    const token = this._getTokenAt(content, position);
    if (!token) return null;

    // Check builtins
    const builtin = JS_BUILTINS.find(b => b.label === token);
    if (builtin) {
      return {
        contents: [
          { language: 'javascript', value: builtin.detail || builtin.label },
          builtin.doc,
        ],
      };
    }

    // Check functions in document
    const funcs = extractFunctions(content, [
      /\bfunction\s+(\w+)\s*\(([^)]*)\)/,
      /\b(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/,
      /\b(\w+)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/,
    ]);
    const func = funcs.find(f => f.name === token);
    if (func) {
      return {
        contents: [
          { language: 'javascript', value: func.signature },
          `Defined at line ${func.line + 1}`,
        ],
      };
    }

    // Check classes
    const classes = extractClasses(content, [/\bclass\s+(\w+)/]);
    const cls = classes.find(c => c.name === token);
    if (cls) {
      return {
        contents: [
          { language: 'javascript', value: cls.declaration },
          `Defined at line ${cls.line + 1}`,
        ],
      };
    }

    return null;
  }

  getDiagnostics(content, language) {
    return patternDiagnostics(content, JS_DIAGNOSTIC_RULES);
  }

  getDefinition(content, position, language) {
    const token = this._getTokenAt(content, position);
    if (!token) return null;

    const lines = content.split('\n');
    const patterns = [
      new RegExp(`\\bfunction\\s+${this._escapeRegex(token)}\\s*\\(`),
      new RegExp(`\\b(class|const|let|var)\\s+${this._escapeRegex(token)}\\b`),
      new RegExp(`\\b${this._escapeRegex(token)}\\s*=\\s*(?:async\\s+)?(?:function|\\()`),
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

    // Find function call: name(
    const callMatch = before.match(/(\w+)\s*\([^)]*$/);
    if (!callMatch) return null;
    const funcName = callMatch[1];

    // Search for function definition
    const patterns = [
      new RegExp(`function\\s+${this._escapeRegex(funcName)}\\s*\\(([^)]*)\\)`),
      new RegExp(`(?:const|let|var)\\s+${this._escapeRegex(funcName)}\\s*=\\s*(?:async\\s+)?\\(([^)]*)\\)\\s*=>`),
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
    const m = before.match(/[A-Za-z_$][A-Za-z0-9_$]*$/);
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

export default JavaScriptAnalyzer;
