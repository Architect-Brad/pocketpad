// PocketPad Intelli — Go Language Analyzer
import { LanguageAnalyzer, CompletionItem, extractFunctions, extractClasses, patternDiagnostics } from './base.js';

const GO_KEYWORDS = [
  'break','case','chan','const','continue','default','defer','else','fallthrough',
  'for','func','go','goto','if','import','interface','map','package','range',
  'return','select','struct','switch','type','var',
  'true','false','iota','nil',
];

const GO_BUILTINS = [
  { label: 'fmt', detail: 'package', doc: 'Formatted I/O (printf, scanf, etc.).' },
  { label: 'fmt.Println', detail: '(...a any) int, error', doc: 'Println formats using default formats and writes to stdout.' },
  { label: 'fmt.Printf', detail: '(format string, a ...any) int, error', doc: 'Printf formats according to a format specifier and writes to stdout.' },
  { label: 'fmt.Sprintf', detail: '(format string, a ...any) string', doc: 'Sprintf formats according to a format specifier and returns the resulting string.' },
  { label: 'fmt.Errorf', detail: '(format string, a ...any) error', doc: 'Errorf formats according to a format specifier and returns the string as a value that satisfies error.' },
  { label: 'fmt.Fprintf', detail: '(w io.Writer, format string, a ...any) int, error', doc: 'Fprintf formats according to a format specifier and writes to w.' },
  { label: 'fmt.Scan', detail: '(...a any) int, error', doc: 'Scan reads text from standard input, storing successive space-separated values.' },
  { label: 'fmt.Scanf', detail: '(format string, a ...any) int, error', doc: 'Scanf reads text from standard input, storing successive space-separated values.' },
  { label: 'fmt.Sscanf', detail: '(str string, format string, a ...any) int, error', doc: 'Sscanf scans the argument string, storing successive space-separated values.' },

  { label: 'len', detail: '(v Type) int', doc: 'Returns the length of v.' },
  { label: 'cap', detail: '(v Type) int', doc: 'Returns the capacity of v.' },
  { label: 'make', detail: '(T, len int, cap ...int) T', doc: 'Allocates and initializes an array, slice, or map.' },
  { label: 'new', detail: '(Type) *Type', doc: 'Allocates memory for the type and returns a pointer.' },
  { label: 'append', detail: '(s []T, vs ...T) []T', doc: 'Appends elements to the end of a slice.' },
  { label: 'copy', detail: '(dst, src []T) int', doc: 'Copies elements from a source slice to a destination slice.' },
  { label: 'delete', detail: '(m map[K]V, key K)', doc: 'Deletes the element with the specified key from the map.' },
  { label: 'panic', detail: '(v any)', doc: 'Stops the ordinary flow of control and begins panicking.' },
  { label: 'recover', detail: '() any', doc: 'Allows a deferred function to capture the value that was passed to panic.' },
  { label: 'close', detail: '(c chan<- Type)', doc: 'Closes a channel.' },
  { label: 'complex', detail: '(r, i FloatType) ComplexType', doc: 'Creates a complex value from real and imaginary parts.' },
  { label: 'real', detail: '(z ComplexType) FloatType', doc: 'Returns the real part of a complex number.' },
  { label: 'imag', detail: '(z ComplexType) FloatType', doc: 'Returns the imaginary part of a complex number.' },
  { label: 'print', detail: '(args ...any)', doc: 'Prints to standard error (debugging).' },
  { label: 'println', detail: '(args ...any)', doc: 'Prints to standard error with spaces (debugging).' },

  { label: 'error', detail: 'interface { Error() string }', doc: 'The error interface for representing error conditions.' },
  { label: 'string', detail: 'built-in type', doc: 'The string type represents the set of string values.' },
  { label: 'int', detail: 'built-in type', doc: 'The int type represents signed integers.' },
  { label: 'float64', detail: 'built-in type', doc: 'The float64 type represents IEEE 754 64-bit floating-point numbers.' },
  { label: 'bool', detail: 'built-in type', doc: 'The bool type represents boolean values.' },
  { label: 'byte', detail: 'alias for uint8', doc: 'The byte type is an alias for uint8.' },
  { label: 'rune', detail: 'alias for int32', doc: 'The rune type is an alias for int32.' },
  { label: 'any', detail: 'alias for interface{}', doc: 'The any type is an alias for interface{}.' },

  { label: 'http', detail: 'package', doc: 'HTTP client and server implementations.' },
  { label: 'http.HandleFunc', detail: '(pattern string, handler func(ResponseWriter, *Request))', doc: 'Registers the handler function for the given pattern.' },
  { label: 'http.ListenAndServe', detail: '(addr string, handler Handler) error', doc: 'Starts an HTTP server on the given address.' },
  { label: 'http.Get', detail: '(url string) (*Response, error)', doc: 'Issues an HTTP GET request.' },
  { label: 'http.Post', detail: '(url, contentType string, body io.Reader) (*Response, error)', doc: 'Issues an HTTP POST request.' },

  { label: 'io', detail: 'package', doc: 'I/O primitives.' },
  { label: 'os', detail: 'package', doc: 'OS-level functionality (files, env, args).' },
  { label: 'os.Open', detail: '(name string) (*File, error)', doc: 'Opens the named file for reading.' },
  { label: 'os.Create', detail: '(name string) (*File, error)', doc: 'Creates the named file for writing.' },
  { label: 'os.Getenv', detail: '(key string) string', doc: 'Gets an environment variable value.' },
  { label: 'os.Args', detail: '[]string', doc: 'Command-line arguments.' },

  { label: 'strings', detail: 'package', doc: 'String manipulation functions.' },
  { label: 'strings.Contains', detail: '(s, substr string) bool', doc: 'Reports whether substr is within s.' },
  { label: 'strings.HasPrefix', detail: '(s, prefix string) bool', doc: 'Reports whether s begins with prefix.' },
  { label: 'strings.HasSuffix', detail: '(s, suffix string) bool', doc: 'Reports whether s ends with suffix.' },
  { label: 'strings.Join', detail: '(elems []string, sep string) string', doc: 'Concatenates elements with a separator.' },
  { label: 'strings.Split', detail: '(s, sep string) []string', doc: 'Splits s around sep.' },
  { label: 'strings.ToLower', detail: '(s string) string', doc: 'Returns a lowercase copy.' },
  { label: 'strings.ToUpper', detail: '(s string) string', doc: 'Returns an uppercase copy.' },
  { label: 'strings.TrimSpace', detail: '(s string) string', doc: 'Trims whitespace from both sides.' },
  { label: 'strings.Replace', detail: '(s, old, new string, n int) string', doc: 'Returns a copy with n occurrences replaced.' },

  { label: 'strconv', detail: 'package', doc: 'String conversions (Atoi, Itoa, etc).' },
  { label: 'strconv.Atoi', detail: '(s string) (int, error)', doc: 'Converts string to int.' },
  { label: 'strconv.Itoa', detail: '(i int) string', doc: 'Converts int to string.' },
  { label: 'strconv.ParseBool', detail: '(s string) (bool, error)', doc: 'Converts string to bool.' },
  { label: 'strconv.ParseFloat', detail: '(s string, bitSize int) (float64, error)', doc: 'Converts string to float.' },
  { label: 'strconv.ParseInt', detail: '(s string, base, bitSize int) (int64, error)', doc: 'Converts string to int64.' },

  { label: 'json', detail: 'package', doc: 'JSON encoding/decoding.' },
  { label: 'json.Marshal', detail: '(v any) ([]byte, error)', doc: 'Returns the JSON encoding of v.' },
  { label: 'json.Unmarshal', detail: '(data []byte, v any) error', doc: 'Parses the JSON-encoded data.' },
  { label: 'json.NewDecoder', detail: '(r io.Reader) *Decoder', doc: 'Returns a new decoder that reads from r.' },
  { label: 'json.NewEncoder', detail: '(w io.Writer) *Encoder', doc: 'Returns a new encoder that writes to w.' },

  { label: 'sort', detail: 'package', doc: 'Sorting utilities.' },
  { label: 'sort.Strings', detail: '(s []string)', doc: 'Sorts a slice of strings in ascending order.' },
  { label: 'sort.Ints', detail: '(s []int)', doc: 'Sorts a slice of ints in ascending order.' },
  { label: 'sort.Slice', detail: '(x any, less func(i, j int) bool)', doc: 'Sorts a slice using a provided less function.' },

  { label: 'context', detail: 'package', doc: 'Carries deadlines, cancellation signals, and request-scoped values.' },
  { label: 'context.Background', detail: '() Context', doc: 'Returns a non-nil, empty Context.' },
  { label: 'context.TODO', detail: '() Context', doc: 'Returns a non-nil, empty Context.' },
  { label: 'context.WithCancel', detail: '(parent Context) (Context, CancelFunc)', doc: 'Returns a copy of parent with a new Done channel.' },
  { label: 'context.WithTimeout', detail: '(parent Context, timeout time.Duration) (Context, CancelFunc)', doc: 'Returns a copy with a deadline.' },
];

const GO_SNIPPETS = [
  { prefix: 'fn', name: 'func', body: 'func ${1:name}(${2:params}) ${3:return} {\n\t${4}\n}' },
  { prefix: 'method', name: 'method', body: 'func (${1:receiver} *${2:Type}) ${3:name}(${4:params}) ${5:return} {\n\t${6}\n}' },
  { prefix: 'ife', name: 'if/else', body: 'if ${1:condition} {\n\t${2}\n} else {\n\t${3}\n}' },
  { prefix: 'for', name: 'for loop', body: 'for ${1:i} := 0; ${1:i} < ${2:n}; ${1:i}++ {\n\t${3}\n}' },
  { prefix: 'forr', name: 'for range', body: 'for ${1:i}, ${2:v} := range ${3:collection} {\n\t${4}\n}' },
  { prefix: 'fori', name: 'for infinite', body: 'for {\n\t${1}\n}' },
  { prefix: 'switch', name: 'switch', body: 'switch ${1:expression} {\ncase ${2:value}:\n\t${3}\ndefault:\n\t${4}\n}' },
  { prefix: 'typeswitch', name: 'type switch', body: 'switch ${1:v} := ${2:expression}.(type) {\ncase ${3:Type}:\n\t${4}\ndefault:\n\t${5}\n}' },
  { prefix: 'select', name: 'select', body: 'select {\ncase ${1:msg} := <-${2:ch}:\n\t${3}\ndefault:\n\t${4}\n}' },
  { prefix: 'goroutine', name: 'goroutine', body: 'go ${1:funcName}(${2})' },
  { prefix: 'chan', name: 'channel', body: '${1:ch} := make(chan ${2:Type})' },
  { prefix: 'struct', name: 'struct', body: 'type ${1:Name} struct {\n\t${2:Field} ${3:Type}\n}' },
  { prefix: 'interface', name: 'interface', body: 'type ${1:Name} interface {\n\t${2:Method}(${3:params}) ${4:return}\n}' },
  { prefix: 'defer', name: 'defer', body: 'defer ${1:funcName}(${2})' },
  { prefix: 'handler', name: 'HTTP handler', body: 'func ${1:handlerName}(w http.ResponseWriter, r *http.Request) {\n\t${2}\n}' },
  { prefix: 'main', name: 'main function', body: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, World!")\n}' },
  { prefix: 'err', name: 'error check', body: 'if ${1:err} != nil {\n\t${2:return err}\n}' },
  { prefix: 'errf', name: 'error with fmt', body: 'if ${1:err} != nil {\n\treturn fmt.Errorf("${2:operation}: %w", ${1:err})\n}' },
  { prefix: 'json', name: 'JSON tag', body: '`json:"${1:field_name}"`' },
  { prefix: 'test', name: 'test function', body: 'func Test${1:Name}(t *testing.T) {\n\t${2}\n}' },
  { prefix: 'bench', name: 'benchmark', body: 'func Benchmark${1:Name}(b *testing.B) {\n\tfor ${2:i} := 0; ${2:i} < ${3:b.N}; ${2:i}++ {\n\t\t${4}\n\t}\n}' },
];

const GO_DIAGNOSTIC_RULES = [
  { pattern: /\bfmt\.Print(ln)?\b(?!.*fmt\.Println.*(?:\(|"))/, severity: 'hint', message: () => 'Consider using fmt.Printf or structured logging instead of Print', source: 'intelli' },
  { pattern: /panic\(/, severity: 'warning', message: () => 'Use error returns instead of panic in production code', source: 'intelli' },
  { pattern: /\bif err != nil \{\s*\n\s*return err\s*\n\s*\}/, severity: 'hint', message: () => 'Consider wrapping errors with fmt.Errorf for context', source: 'intelli' },
  { pattern: /\b_ =/, severity: 'hint', message: () => 'Unused return value — consider handling the error', source: 'intelli' },
];

class GoAnalyzer extends LanguageAnalyzer {
  constructor() {
    super({ id: 'go', name: 'Go', extensions: ['.go'] });
  }
  getKeywords() { return GO_KEYWORDS; }
  getBuiltins() { return GO_BUILTINS; }

  getCompletions(content, position, language) {
    const prefix = this._getPrefix(content, position);
    if (!prefix) return [];
    const pl = prefix.toLowerCase();
    const items = [];

    for (const s of GO_SNIPPETS) {
      if (s.prefix.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(s.prefix, 'snippet', { detail: s.name, insertText: s.body, sortOrder: 0, source: 'snippet' }));
      }
    }
    for (const kw of GO_KEYWORDS) {
      if (kw.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(kw, 'keyword', { detail: 'keyword', sortOrder: 10, source: 'keyword' }));
      }
    }
    for (const b of GO_BUILTINS) {
      if (b.label.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(b.label, 'builtin', { detail: b.detail, documentation: b.doc, sortOrder: 20, source: 'builtin' }));
      }
    }

    const funcs = extractFunctions(content, [/\bfunc\s+(\w+)\s*\(([^)]*)\)/, /\bfunc\s*\([^)]+\)\s+(\w+)\s*\(([^)]*)\)/]);
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

  getDiagnostics(content, language) { return patternDiagnostics(content, GO_DIAGNOSTIC_RULES); }
}

export default GoAnalyzer;
