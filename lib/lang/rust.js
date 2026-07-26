// PocketPad Intelli — Rust Language Analyzer
import { LanguageAnalyzer, CompletionItem, extractFunctions, extractClasses, patternDiagnostics } from './base.js';

const RUST_KEYWORDS = [
  'as','async','await','break','const','continue','crate','dyn','else','enum',
  'extern','false','fn','for','if','impl','in','let','loop','match','mod',
  'move','mut','pub','ref','return','self','Self','static','struct','super',
  'trait','true','type','unsafe','use','where','while','yield',
  // Rust 2021+
  'gen',
];

const RUST_BUILTINS = [
  { label: 'println!', detail: 'macro', doc: 'Prints to stdout with a newline.' },
  { label: 'print!', detail: 'macro', doc: 'Prints to stdout without a newline.' },
  { label: 'eprintln!', detail: 'macro', doc: 'Prints to stderr with a newline.' },
  { label: 'eprint!', detail: 'macro', doc: 'Prints to stderr without a newline.' },
  { label: 'format!', detail: 'macro', doc: 'Creates a String using format arguments.' },
  { label: 'vec!', detail: 'macro', doc: 'Creates a Vec from elements.' },
  { label: 'macro_rules!', detail: 'macro', doc: 'Defines a declarative macro.' },
  { label: 'dbg!', detail: 'macro', doc: 'Debug print with file/line info.' },
  { label: 'todo!', detail: 'macro', doc: 'Placeholder for unimplemented code.' },
  { label: 'unimplemented!', detail: 'macro', doc: 'Marks code as unimplemented.' },
  { label: 'unreachable!', detail: 'macro', doc: 'Marks code as unreachable.' },
  { label: 'panic!', detail: 'macro', doc: 'Panics with a message.' },
  { label: 'assert!', detail: 'macro', doc: 'Asserts a boolean expression.' },
  { label: 'assert_eq!', detail: 'macro', doc: 'Asserts two values are equal.' },
  { label: 'assert_ne!', detail: 'macro', doc: 'Asserts two values are not equal.' },
  { label: 'include_str!', detail: 'macro', doc: 'Includes a file as a string at compile time.' },
  { label: 'include_bytes!', detail: 'macro', doc: 'Includes a file as bytes at compile time.' },

  { label: 'String', detail: 'struct', doc: 'A UTF-8 encoded, growable string.' },
  { label: 'Vec', detail: 'struct', doc: 'A contiguous growable array type.' },
  { label: 'Option', detail: 'enum', doc: 'A type that may or may not contain a value.' },
  { label: 'Result', detail: 'enum', doc: 'A type that may contain an error.' },
  { label: 'Box', detail: 'struct', doc: 'A smart pointer for heap allocation.' },
  { label: 'Rc', detail: 'struct', doc: 'Reference-counted pointer for shared ownership.' },
  { label: 'Arc', detail: 'struct', doc: 'Atomically reference-counted pointer.' },
  { label: 'Cell', detail: 'struct', doc: 'Mutable memory location (single-thread).' },
  { label: 'RefCell', detail: 'struct', doc: 'Mutable memory with borrow checking at runtime.' },
  { label: 'Mutex', detail: 'struct', doc: 'Mutual exclusion for shared state.' },
  { label: 'RwLock', detail: 'struct', doc: 'Multiple-reader, single-writer lock.' },

  { label: 'Some', detail: 'Option variant', doc: 'Contains a value.' },
  { label: 'None', detail: 'Option variant', doc: 'Contains no value.' },
  { label: 'Ok', detail: 'Result variant', doc: 'Contains a success value.' },
  { label: 'Err', detail: 'Result variant', doc: 'Contains an error value.' },

  { label: 'println', detail: '(...args)', doc: 'Print with newline.' },
  { label: 'vec', detail: '([...items])', doc: 'Create a vector.' },
  { label: 'string', detail: '() → String', doc: 'Create an empty String.' },
  { label: 'to_string', detail: '() → String', doc: 'Convert to String.' },
  { label: 'clone', detail: '() → Self', doc: 'Clone a value.' },
  { label: 'len', detail: '() → usize', doc: 'Return the length.' },
  { label: 'is_empty', detail: '() → bool', doc: 'Check if empty.' },
  { label: 'push', detail: '(item)', doc: 'Append an element.' },
  { label: 'pop', detail: '() → Option<T>', doc: 'Remove the last element.' },
  { label: 'iter', detail: '() → Iterator', doc: 'Return an iterator.' },
  { label: 'map', detail: '(fn) → Iterator', doc: 'Transform each element.' },
  { label: 'filter', detail: '(fn) → Iterator', doc: 'Keep elements matching predicate.' },
  { label: 'fold', detail: '(init, fn) → T', doc: 'Fold elements into a single value.' },
  { label: 'collect', detail: '() → Collection', doc: 'Collect into a collection.' },
  { label: 'unwrap', detail: '() → T', doc: 'Unwrap Option/Result or panic.' },
  { label: 'expect', detail: '(msg) → T', doc: 'Unwrap with custom panic message.' },
  { label: 'unwrap_or', detail: '(default) → T', doc: 'Unwrap or return default.' },
  { label: 'unwrap_or_else', detail: '(fn) → T', doc: 'Unwrap or compute default.' },
  { label: 'is_some', detail: '() → bool', doc: 'Check if Option contains a value.' },
  { label: 'is_none', detail: '() → bool', doc: 'Check if Option is None.' },
  { label: 'is_ok', detail: '() → bool', doc: 'Check if Result is Ok.' },
  { label: 'is_err', detail: '() → bool', doc: 'Check if Result is Err.' },

  { label: 'io', detail: 'module', doc: 'I/O utilities.' },
  { label: 'fs', detail: 'module', doc: 'Filesystem operations.' },
  { label: 'std::fs::read_to_string', detail: '(path) → Result<String>', doc: 'Read a file to string.' },
  { label: 'std::fs::write', detail: '(path, data) → Result<()>', doc: 'Write data to a file.' },
  { label: 'std::fs::read_dir', detail: '(path) → Result<ReadDir>', doc: 'Read a directory.' },
  { label: 'serde', detail: 'crate', doc: 'Serialization/deserialization framework.' },
  { label: 'tokio', detail: 'crate', doc: 'Async runtime for Rust.' },
  { label: 'reqwest', detail: 'crate', doc: 'HTTP client library.' },
];

const RUST_SNIPPETS = [
  { prefix: 'fn', name: 'function', body: 'fn ${1:name}(${2:params}) -> ${3:ReturnType} {\n\t${4}\n}' },
  { prefix: 'afn', name: 'async function', body: 'async fn ${1:name}(${2:params}) -> ${3:ReturnType} {\n\t${4}\n}' },
  { prefix: 'pub', name: 'public function', body: 'pub fn ${1:name}(${2:params}) -> ${3:ReturnType} {\n\t${4}\n}' },
  { prefix: 'struct', name: 'struct', body: 'struct ${1:Name} {\n\t${2:field}: ${3:Type},\n}' },
  { prefix: 'enum', name: 'enum', body: 'enum ${1:Name} {\n\t${2:Variant1},\n\t${3:Variant2},\n}' },
  { prefix: 'impl', name: 'impl block', body: 'impl ${1:Type} {\n\t${2}\n}' },
  { prefix: 'implt', name: 'impl trait', body: 'impl ${1:Trait} for ${2:Type} {\n\t${3}\n}' },
  { prefix: 'trait', name: 'trait', body: 'trait ${1:Name} {\n\tfn ${2:method}(&self${3:, params});\n}' },
  { prefix: 'match', name: 'match', body: 'match ${1:expression} {\n\t${2:pattern} => ${3:value},\n\t_ => ${4:value},\n}' },
  { prefix: 'ifl', name: 'if let', body: 'if let ${1:Some(value)} = ${2:expression} {\n\t${3}\n}' },
  { prefix: 'whl', name: 'while let', body: 'while let ${1:Some(value)} = ${2:expression} {\n\t${3}\n}' },
  { prefix: 'for', name: 'for loop', body: 'for ${1:item} in ${2:iter} {\n\t${3}\n}' },
  { prefix: 'loop', name: 'loop', body: 'loop {\n\t${1}\n}' },
  { prefix: 'while', name: 'while', body: 'while ${1:condition} {\n\t${2}\n}' },
  { prefix: 'if', name: 'if', body: 'if ${1:condition} {\n\t${2}\n}' },
  { prefix: 'ife', name: 'if/else', body: 'if ${1:condition} {\n\t${2}\n} else {\n\t${3}\n}' },
  { prefix: 'test', name: 'test', body: '#[cfg(test)]\nmod tests {\n\tuse super::*;\n\n\t#[test]\n\tfn test_${1:name}() {\n\t\t${2}\n\t}\n}' },
  { prefix: 'derive', name: 'derive', body: '#[derive(${1:Debug, Clone})]' },
  { prefix: 'mod', name: 'module', body: 'mod ${1:name};' },
  { prefix: 'use', name: 'use', body: 'use ${1:std}::${2:path};' },
  { prefix: 'crate', name: 'crate use', body: 'use crate::${1:path};' },
  { prefix: 'err', name: 'error handling', body: 'match ${1:result} {\n\tOk(${2:value}) => ${3},\n\tErr(${4:e}) => ${5},\n}' },
  { prefix: 'result', name: 'Result type', body: 'fn ${1:name}(${2:params}) -> Result<${3:OkType}, ${4:ErrType}> {\n\t${5}\n}' },
  { prefix: 'option', name: 'Option type', body: 'fn ${1:name}(${2:params}) -> Option<${3:Type}> {\n\t${4}\n}' },
  { prefix: 'arc', name: 'Arc::new', body: 'Arc::new(${1:value})' },
  { prefix: 'rc', name: 'Rc::new', body: 'Rc::new(${1:value})' },
  { prefix: 'box', name: 'Box::new', body: 'Box::new(${1:value})' },
];

const RUST_DIAGNOSTIC_RULES = [
  { pattern: /\bunwrap\(\)/, severity: 'warning', message: () => 'Use expect() or handle the Result/Option properly', source: 'intelli' },
  { pattern: /\bclone\(\)/, severity: 'hint', message: (): 'Consider using references or Cow to avoid cloning', source: 'intelli' },
  { pattern: /\bprintln!\b/, severity: 'hint', message: () => 'Consider using log crate or tracing for production', source: 'intelli' },
  { pattern: /\bunsafe\s*\{/, severity: 'warning', message: () => 'Unsafe block — ensure memory safety guarantees', source: 'intelli' },
];

class RustAnalyzer extends LanguageAnalyzer {
  constructor() {
    super({ id: 'rust', name: 'Rust', extensions: ['.rs'] });
  }
  getKeywords() { return RUST_KEYWORDS; }
  getBuiltins() { return RUST_BUILTINS; }

  getCompletions(content, position, language) {
    const prefix = this._getPrefix(content, position);
    if (!prefix) return [];
    const pl = prefix.toLowerCase();
    const items = [];

    for (const s of RUST_SNIPPETS) {
      if (s.prefix.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(s.prefix, 'snippet', { detail: s.name, insertText: s.body, sortOrder: 0, source: 'snippet' }));
      }
    }
    for (const kw of RUST_KEYWORDS) {
      if (kw.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(kw, 'keyword', { detail: 'keyword', sortOrder: 10, source: 'keyword' }));
      }
    }
    for (const b of RUST_BUILTINS) {
      if (b.label.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(b.label, 'builtin', { detail: b.detail, documentation: b.doc, sortOrder: 20, source: 'builtin' }));
      }
    }

    const funcs = extractFunctions(content, [/\bfn\s+(\w+)\s*\(([^)]*)\)/, /\bpub\s+fn\s+(\w+)\s*\(([^)]*)\)/, /\basync\s+fn\s+(\w+)\s*\(([^)]*)\)/]);
    for (const f of funcs) {
      if (f.name.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(f.name, 'function', { detail: f.signature, sortOrder: 30, source: 'document' }));
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

  getDiagnostics(content, language) { return patternDiagnostics(content, RUST_DIAGNOSTIC_RULES); }
}

export default RustAnalyzer;
