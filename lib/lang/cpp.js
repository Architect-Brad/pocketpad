// PocketPad Intelli — C/C++ Language Analyzer
import { LanguageAnalyzer, CompletionItem, extractFunctions, extractClasses, patternDiagnostics } from './base.js';

const C_KEYWORDS = [
  'auto','break','case','char','const','continue','default','do','double',
  'else','enum','extern','float','for','goto','if','inline','int','long',
  'register','restrict','return','short','signed','sizeof','static','struct',
  'switch','typedef','union','unsigned','void','volatile','while',
  // C11
  '_Alignas','_Alignof','_Atomic','_Bool','_Complex','_Generic','_Imaginary',
  '_Noreturn','_Static_assert','_Thread_local',
  // C++
  'alignas','alignof','and','and_eq','asm','bitand','bitor','bool','catch',
  'char8_t','char16_t','char32_t','class','co_await','co_return','co_yield',
  'compl','concept','consteval','constexpr','constinit','const_cast','decltype',
  'delete','dynamic_cast','explicit','export','false','friend','mutable',
  'namespace','new','noexcept','not','not_eq','nullptr','operator','or',
  'or_eq','private','protected','public','reinterpret_cast','requires','static_assert',
  'static_cast','template','this','thread_local','throw','true','try','typeid',
  'typename','using','virtual','wchar_t','xor','xor_eq',
];

const C_BUILTINS = [
  { label: 'printf', detail: '(format, ...) → int', doc: 'Formatted output to stdout.' },
  { label: 'scanf', detail: '(format, ...) → int', doc: 'Read formatted input from stdin.' },
  { label: 'sprintf', detail: '(str, format, ...) → int', doc: 'Write formatted output to a string.' },
  { label: 'fprintf', detail: '(stream, format, ...) → int', doc: 'Write formatted output to a stream.' },
  { label: 'fopen', detail: '(filename, mode) → FILE*', doc: 'Open a file.' },
  { label: 'fclose', detail: '(stream) → int', doc: 'Close a file.' },
  { label: 'fread', detail: '(ptr, size, count, stream) → size_t', doc: 'Read from a file.' },
  { label: 'fwrite', detail: '(ptr, size, count, stream) → size_t', doc: 'Write to a file.' },
  { label: 'fgets', detail: '(str, n, stream) → char*', doc: 'Read a line from a file.' },
  { label: 'fputs', detail: '(str, stream) → int', doc: 'Write a string to a file.' },
  { label: 'malloc', detail: '(size) → void*', doc: 'Allocate memory.' },
  { label: 'calloc', detail: '(num, size) → void*', doc: 'Allocate zero-initialized memory.' },
  { label: 'realloc', detail: '(ptr, size) → void*', doc: 'Reallocate memory.' },
  { label: 'free', detail: '(ptr)', doc: 'Free allocated memory.' },
  { label: 'strlen', detail: '(str) → size_t', doc: 'String length.' },
  { label: 'strcpy', detail: '(dest, src) → char*', doc: 'Copy string.' },
  { label: 'strncpy', detail: '(dest, src, n) → char*', doc: 'Copy n bytes of string.' },
  { label: 'strcmp', detail: '(s1, s2) → int', doc: 'Compare strings.' },
  { label: 'strncmp', detail: '(s1, s2, n) → int', doc: 'Compare n bytes of strings.' },
  { label: 'strcat', detail: '(dest, src) → char*', doc: 'Concatenate strings.' },
  { label: 'strchr', detail: '(str, c) → char*', doc: 'Find character in string.' },
  { label: 'strstr', detail: '(haystack, needle) → char*', doc: 'Find substring.' },
  { label: 'memcpy', detail: '(dest, src, n) → void*', doc: 'Copy memory block.' },
  { label: 'memset', detail: '(ptr, value, n) → void*', doc: 'Set memory block.' },
  { label: 'memcmp', detail: '(s1, s2, n) → int', doc: 'Compare memory blocks.' },
  { label: 'exit', detail: '(status)', doc: 'Terminate the program.' },
  { label: 'abs', detail: '(x) → int', doc: 'Absolute value.' },
  { label: 'pow', detail: '(x, y) → double', doc: 'Power function.' },
  { label: 'sqrt', detail: '(x) → double', doc: 'Square root.' },
  { label: 'sin', detail: '(x) → double', doc: 'Sine.' },
  { label: 'cos', detail: '(x) → double', doc: 'Cosine.' },
  { label: 'tan', detail: '(x) → double', doc: 'Tangent.' },
  { label: 'rand', detail: '() → int', doc: 'Random number.' },
  { label: 'srand', detail: '(seed)', doc: 'Seed random number generator.' },

  // C++ specific
  { label: 'std::cout', detail: 'std::ostream', doc: 'Standard output stream.' },
  { label: 'std::cin', detail: 'std::istream', doc: 'Standard input stream.' },
  { label: 'std::cerr', detail: 'std::ostream', doc: 'Standard error stream.' },
  { label: 'std::string', detail: 'class', doc: 'Dynamic string class.' },
  { label: 'std::vector', detail: 'class template', doc: 'Dynamic array container.' },
  { label: 'std::map', detail: 'class template', doc: 'Associative array container.' },
  { label: 'std::set', detail: 'class template', doc: 'Sorted set container.' },
  { label: 'std::unordered_map', detail: 'class template', doc: 'Hash map container.' },
  { label: 'std::array', detail: 'class template', doc: 'Fixed-size array container.' },
  { label: 'std::shared_ptr', detail: 'class template', doc: 'Shared ownership pointer.' },
  { label: 'std::unique_ptr', detail: 'class template', doc: 'Exclusive ownership pointer.' },
  { label: 'std::make_shared', detail: '(args) → shared_ptr', doc: 'Create a shared pointer.' },
  { label: 'std::make_unique', detail: '(args) → unique_ptr', doc: 'Create a unique pointer.' },
  { label: 'std::move', detail: '(x) → T&&', doc: 'Cast to rvalue reference.' },
  { label: 'std::swap', detail: '(a, b)', doc: 'Swap two values.' },
  { label: 'std::min', detail: '(a, b) → T', doc: 'Return the smaller value.' },
  { label: 'std::max', detail: '(a, b) → T', doc: 'Return the larger value.' },
  { label: 'std::begin', detail: '(c) → iterator', doc: 'Return iterator to beginning.' },
  { label: 'std::end', detail: '(c) → iterator', doc: 'Return iterator to end.' },
  { label: 'std::sort', detail: '(first, last)', doc: 'Sort a range.' },
  { label: 'std::find', detail: '(first, last, val) → iterator', doc: 'Find element in range.' },
  { label: 'std::for_each', detail: '(first, last, fn)', doc: 'Apply function to range.' },
  { label: 'std::transform', detail: '(first, last, result, fn)', doc: 'Transform range.' },
  { label: 'std::accumulate', detail: '(first, last, init) → T', doc: 'Sum up range.' },
  { label: 'std::push_back', detail: '(val)', doc: 'Add element to vector end.' },
  { label: 'std::emplace_back', detail: '(args...)', doc: 'Construct element at vector end.' },
  { label: 'std::size', detail: '(c) → size_t', doc: 'Return container size.' },
  { label: 'std::empty', detail: '(c) → bool', doc: 'Check if container is empty.' },
  { label: 'std::to_string', detail: '(val) → string', doc: 'Convert to string.' },
  { label: 'std::stoi', detail: '(str) → int', doc: 'Convert string to int.' },
  { label: 'std::stod', detail: '(str) → double', doc: 'Convert string to double.' },
];

const C_SNIPPETS = [
  { prefix: 'fn', name: 'function', body: '${1:void} ${2:name}(${3:params}) {\n\t${4}\n}' },
  { prefix: 'main', name: 'main', body: 'int main(${1:int argc, char *argv[]}) {\n\t${2}\n\treturn 0;\n}' },
  { prefix: 'if', name: 'if', body: 'if (${1:condition}) {\n\t${2}\n}' },
  { prefix: 'ife', name: 'if/else', body: 'if (${1:condition}) {\n\t${2}\n} else {\n\t${3}\n}' },
  { prefix: 'for', name: 'for', body: 'for (${1:int i = 0}; ${1:i} < ${2:n}; ${1:i}++) {\n\t${3}\n}' },
  { prefix: 'while', name: 'while', body: 'while (${1:condition}) {\n\t${2}\n}' },
  { prefix: 'switch', name: 'switch', body: 'switch (${1:expression}) {\n\tcase ${2:value}:\n\t\t${3}\n\t\tbreak;\n\tdefault:\n\t\t${4}\n}' },
  { prefix: 'struct', name: 'struct', body: 'struct ${1:Name} {\n\t${2:type} ${3:field};\n};' },
  { prefix: 'enum', name: 'enum', body: 'enum ${1:Name} {\n\t${2:VALUE1},\n\t${3:VALUE2},\n};' },
  { prefix: 'typedef', name: 'typedef', body: 'typedef ${1:existing_type} ${2:new_name};' },
  { prefix: 'malloc', name: 'malloc', body: '(${1:type} *)malloc(sizeof(${1:type}) * ${2:count});' },
  { prefix: 'calloc', name: 'calloc', body: '(${1:type} *)calloc(${2:count}, sizeof(${1:type}));' },
  { prefix: 'free', name: 'free', body: 'free(${1:ptr});\n${1:ptr} = NULL;' },
  { prefix: 'include', name: 'include', body: '#include <${1:stdio}.h>' },
  { prefix: 'define', name: 'define', body: '#define ${1:NAME} ${2:value}' },
  { prefix: 'ifdef', name: 'ifdef', body: '#ifdef ${1:MACRO}\n\t${2}\n#endif' },
  { prefix: 'ifdefe', name: 'ifdef/else', body: '#ifdef ${1:MACRO}\n\t${2}\n#else\n\t${3}\n#endif' },
  { prefix: 'prin', name: 'printf', body: 'printf("${1:%s}\\n", ${2:arg});' },
  { prefix: 'scan', name: 'scanf', body: 'scanf("${1:%d}", &${2:var});' },
  { prefix: 'class', name: 'C++ class', body: 'class ${1:Name} {\npublic:\n\t${1:Name}(${2:params});\n\t~${1:Name}();\n\nprivate:\n\t${3:Type} ${4:member};\n};' },
  { prefix: 'try', name: 'try/catch', body: 'try {\n\t${1}\n} catch (${2:const std::exception &e}) {\n\tstd::cerr << e.what() << std::endl;\n}' },
  { prefix: 'lambda', name: 'lambda', body: '[${1:captures}](${2:params}) -> ${3:ReturnType} {\n\t${4}\n}' },
  { prefix: 'cout', name: 'cout', body: 'std::cout << ${1:value} << std::endl;' },
  { prefix: 'cin', name: 'cin', body: 'std::cin >> ${1:var};' },
];

const C_DIAGNOSTIC_RULES = [
  { pattern: /\bgets\s*\(/, severity: 'error', message: () => 'gets() is unsafe — use fgets() or getline()', source: 'intelli' },
  { pattern: /\bsprintf\s*\(/, severity: 'warning', message: () => 'sprintf() is unsafe — use snprintf()', source: 'intelli' },
  { pattern: /\bscanf\s*\(/, severity: 'hint', message: () => 'scanf() can fail — check return value', source: 'intelli' },
  { pattern: /\bmalloc\s*\(/, severity: 'hint', message: () => 'Check malloc return value for NULL', source: 'intelli' },
  { pattern: /\bprintf\s*\(/, severity: 'hint', message: () => 'Ensure format string matches arguments', source: 'intelli' },
];

class CppAnalyzer extends LanguageAnalyzer {
  constructor() {
    super({ id: 'cpp', name: 'C++', extensions: ['.c', '.h', '.cpp', '.hpp', '.cc', '.cxx', '.hxx'] });
  }
  getKeywords() { return C_KEYWORDS; }
  getBuiltins() { return C_BUILTINS; }

  getCompletions(content, position, language) {
    const prefix = this._getPrefix(content, position);
    if (!prefix) return [];
    const pl = prefix.toLowerCase();
    const items = [];

    for (const s of C_SNIPPETS) {
      if (s.prefix.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(s.prefix, 'snippet', { detail: s.name, insertText: s.body, sortOrder: 0, source: 'snippet' }));
      }
    }
    for (const kw of C_KEYWORDS) {
      if (kw.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(kw, 'keyword', { detail: 'keyword', sortOrder: 10, source: 'keyword' }));
      }
    }
    for (const b of C_BUILTINS) {
      if (b.label.toLowerCase().startsWith(pl)) {
        items.push(CompletionItem(b.label, 'builtin', { detail: b.detail, documentation: b.doc, sortOrder: 20, source: 'builtin' }));
      }
    }

    const funcs = extractFunctions(content, [
      /\b(\w+)\s+(\w+)\s*\(([^)]*)\)\s*\{/,
      /\b(\w+)\s*\(([^)]*)\)\s*\{/,
    ]);
    for (const f of funcs) {
      if (f.name.toLowerCase().startsWith(pl) && !C_KEYWORDS.includes(f.name)) {
        items.push(CompletionItem(f.name, 'function', { detail: f.signature, sortOrder: 30, source: 'document' }));
      }
    }

    return items;
  }

  _getPrefix(content, position) {
    const lines = content.split('\n');
    const line = lines[position.line] || '';
    const before = line.slice(0, position.ch);
    const m = before.match(/[A-Za-z_:][A-Za-z0-9_:]*$/);
    return m ? m[0] : '';
  }

  getDiagnostics(content, language) { return patternDiagnostics(content, C_DIAGNOSTIC_RULES); }
}

export default CppAnalyzer;
