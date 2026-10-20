// PocketPad Intelli — Static Analyzer Web Worker
// Runs in a separate thread for heavy code analysis

// Lightweight symbol indexer
function indexSymbols(content, language) {
  if (!content) return [];
  const lines = content.split('\n');
  const symbols = [];
  const lang = (language || '').toLowerCase();

  const patterns = {
    function: lang === 'python'
      ? /\b(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/
      : /\b(?:function|async\s+function)\s+(\w+)\s*\(([^)]*)\)|(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/,
    class: /\b(?:class|struct|interface|enum)\s+(\w+)/,
    variable: lang === 'python'
      ? /^\s*(\w+)\s*=(?!=)/
      : /\b(?:const|let|var|static|final)\s+(\w+)/,
    method: /\b(\w+)\s*\(([^)]*)\)\s*\{/,
    import: /\b(?:import|from|require|include|use)\s+([^\s;]+)/,
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Functions — the JS pattern has 4 capture groups, not 5.
    let m = patterns.function.exec(line);
    if (m) {
      symbols.push({
        name: m[1] || m[3],
        kind: 'function',
        line: i,
        col: line.indexOf(m[0]),
        detail: m[0].trim(),
        params: (m[2] || m[4] || '').trim(),
      });
    }

    // Classes
    m = patterns.class.exec(line);
    if (m) {
      symbols.push({
        name: m[1],
        kind: 'class',
        line: i,
        col: line.indexOf(m[0]),
        detail: m[0].trim(),
      });
    }

    // Methods
    m = patterns.method.exec(line);
    if (m && !symbols.some(s => s.line === i && s.kind === 'function')) {
      symbols.push({
        name: m[1],
        kind: 'method',
        line: i,
        col: line.indexOf(m[0]),
        detail: m[0].trim(),
        params: (m[2] || '').trim(),
      });
    }

    // Imports
    m = patterns.import.exec(line);
    if (m) {
      symbols.push({
        name: m[1],
        kind: 'import',
        line: i,
        col: line.indexOf(m[0]),
        detail: m[0].trim(),
      });
    }

    // Variables
    const varMatch = line.match(patterns.variable);
    if (varMatch) {
      symbols.push({
        name: varMatch[1],
        kind: 'variable',
        line: i,
        col: line.indexOf(varMatch[0]),
        detail: varMatch[0].trim(),
      });
    }
  }

  return symbols;
}

// Simple complexity analysis
function analyzeComplexity(content) {
  if (!content) return { complexity: 0, lines: 0, functions: 0 };
  const lines = content.split('\n');
  let complexity = 1;
  let functions = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/\b(if|else if|elif|else|case|catch|except)\b/.test(trimmed)) complexity++;
    if (/\b(for|while|do)\b/.test(trimmed)) complexity++;
    // \b is meaningless around non-word characters — match them directly.
    if (/(\?|&&|\|\|)/.test(trimmed)) complexity += 0.5;
    if (/\b(function|def|fn|func)\b/.test(trimmed)) functions++;
  }

  return { complexity: Math.round(complexity), lines: lines.length, functions };
}

// Message handler
self.onmessage = function(e) {
  const { id, type, content, language, docId } = e.data || {};

  try {
    let result;

    switch (type) {
      case 'index-symbols':
        result = { symbols: indexSymbols(content, language) };
        break;

      case 'analyze-complexity':
        result = analyzeComplexity(content);
        break;

      case 'analyze-all':
        result = {
          symbols: indexSymbols(content, language),
          ...analyzeComplexity(content),
        };
        break;

      default:
        result = { error: 'Unknown message type: ' + type };
    }

    self.postMessage({ id, type: type + ':result', ...result, docId });
  } catch (err) {
    self.postMessage({ id, type: 'error', error: err.message, docId });
  }
};
