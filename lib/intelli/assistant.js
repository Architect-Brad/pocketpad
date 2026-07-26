// PocketPad Intelli — Assistant Integration
// Multi-turn context, enhanced code generation, conversation memory

import { ContextManager, classifyIntent, detectLanguage, analyzeCode, extractEntities } from './nlp.js';

// ─── Enhanced Code Generator ───
const CODE_TEMPLATES = {
  javascript: {
    class: (name) => `class ${name} {\n  constructor(options = {}) {\n    this.options = options;\n    this._initialized = false;\n    this.init();\n  }\n\n  init() {\n    this._initialized = true;\n  }\n\n  destroy() {\n    this._initialized = false;\n  }\n}`,
    function: (name, params) => `function ${name}(${params || ''}) {\n  // TODO: implement\n  return result;\n}`,
    module: (name) => `// ${name} — module\n\nexport function ${name.replace(/[^a-zA-Z0-9]/g, '_')}() {\n  // TODO: implement\n}\n\nexport default ${name.replace(/[^a-zA-Z0-9]/g, '_')};`,
    component: (name) => `import React from 'react';\n\nexport default function ${name}(props) {\n  return (\n    <div className="${name.toLowerCase()}">\n      {props.children}\n    </div>\n  );\n}`,
    hook: (name) => `import { useState, useEffect } from 'react';\n\nexport function ${name.startsWith('use') ? name : 'use' + name.charAt(0).toUpperCase() + name.slice(1)}(${params || ''}) {\n  const [state, setState] = useState(initialValue);\n\n  useEffect(() => {\n    // effect\n    return () => cleanup;\n  }, [dependencies]);\n\n  return [state, setState];\n}`,
    middleware: (name) => `export function ${name}(req, res, next) {\n  try {\n    // middleware logic\n    next();\n  } catch (err) {\n    next(err);\n  }\n}`,
    reducer: (name) => `const initialState = {};\n\nexport function ${name}(state = initialState, action) {\n  switch (action.type) {\n    case 'ACTION_TYPE':\n      return { ...state, ...action.payload };\n    default:\n      return state;\n  }\n}`,
    route: (name) => `router.${'{method}' || 'get'}('/${name}', async (req, res) => {\n  try {\n    const result = {};\n    res.json(result);\n  } catch (err) {\n    res.status(500).json({ error: err.message });\n  }\n});`,
    test: (name) => `describe('${name}', () => {\n  test('should work with valid input', () => {\n    const result = ${name}(/* input */);\n    expect(result).toBeDefined();\n  });\n\n  test('should handle edge cases', () => {\n    expect(() => ${name}(null)).not.toThrow();\n  });\n\n  test('should handle empty input', () => {\n    expect(() => ${name}()).not.toThrow();\n  });\n});`,
  },
  python: {
    class: (name) => `class ${name}:\n    """TODO: Add class docstring."""\n\n    def __init__(self, **kwargs):\n        self._initialized = False\n        self.init()\n\n    def init(self):\n        self._initialized = True\n\n    def __repr__(self):\n        return f"${name}()"`,
    function: (name, params) => `def ${name}(${params || ''}):\n    """TODO: Add function docstring."""\n    pass`,
    module: (name) => `"""${name} — module"""\n\n\ndef ${name.replace(/[^a-zA-Z0-9_]/g, '_')}():\n    """TODO: implement"""\n    pass`,
    test: (name) => `import pytest\n\n\nclass Test${name.charAt(0).toUpperCase() + name.slice(1)}:\n    """Tests for ${name}."""\n\n    def test_normal_input(self):\n        result = ${name}(/* input */)\n        assert result is not None\n\n    def test_edge_cases(self):\n        with pytest.raises(Exception):\n            ${name}(None)\n\n    def test_empty_input(self):\n        with pytest.raises(Exception):\n            ${name}()`,
  },
  go: {
    function: (name, params) => `func ${name}(${params || ''}) {\n\t// TODO: implement\n}`,
    struct: (name) => `type ${name} struct {\n\t// TODO: add fields\n}`,
    method: (name, recv, params) => `func (${recv} *${name}) ${params || 'Method'}() {\n\t// TODO: implement\n}`,
    test: (name) => `func Test${name.charAt(0).toUpperCase() + name.slice(1)}(t *testing.T) {\n\t// TODO: implement\n}`,
  },
  rust: {
    function: (name, params) => `fn ${name}(${params || ''}) -> Result<(), Box<dyn std::error::Error>> {\n\t// TODO: implement\n\tOk(())\n}`,
    struct: (name) => `#[derive(Debug, Clone)]\npub struct ${name} {\n\t// TODO: add fields\n}`,
    enum: (name) => `#[derive(Debug, Clone)]\npub enum ${name} {\n\tVariant1,\n\tVariant2,\n}`,
    test: (name) => `#[cfg(test)]\nmod tests {\n\tuse super::*;\n\n\t#[test]\n\tfn test_${name}() {\n\t\t// TODO: implement\n\t}\n}`,
  },
  typescript: {
    class: (name) => `class ${name} {\n  private _initialized: boolean = false;\n\n  constructor(options: ${name}Options = {}) {\n    this.init();\n  }\n\n  private init(): void {\n    this._initialized = true;\n  }\n}\n\ninterface ${name}Options {\n  // TODO: define options\n}`,
    function: (name, params) => `function ${name}(${params || ''}): ReturnType {\n  // TODO: implement\n  throw new Error('Not implemented');\n}`,
    interface: (name) => `interface ${name} {\n  // TODO: define properties\n}`,
    type: (name) => `type ${name} = {\n  // TODO: define shape\n};`,
  },
};

// ─── Intent-to-Template Mapping ───
function detectCodeType(input) {
  const lower = input.toLowerCase();
  if (/\b(class|struct|type|interface)\b/.test(lower)) return 'class';
  if (/\b(function|func|fn|def|method)\b/.test(lower)) return 'function';
  if (/\b(module|package|lib|file)\b/.test(lower)) return 'module';
  if (/\b(component|element|view|widget)\b/.test(lower)) return 'component';
  if (/\b(hook|use[A-Z])\b/.test(lower)) return 'hook';
  if (/\b(test|spec|assert|verify)\b/.test(lower)) return 'test';
  if (/\b(route|endpoint|api|handler)\b/.test(lower)) return 'route';
  if (/\b(middleware|interceptor|filter)\b/.test(lower)) return 'middleware';
  if (/\b(reducer|action|dispatch|store)\b/.test(lower)) return 'reducer';
  if (/\b(struct|enum|impl)\b/.test(lower)) return 'struct';
  return 'function';
}

function detectName(input) {
  const lower = input.toLowerCase();
  // Try to extract a name from the input
  const nameMatch = input.match(/(?:called?|named?|for|called)\s+["']?([A-Za-z_][A-Za-z0-9_]*)["']?/i);
  if (nameMatch) return nameMatch[1];

  // Generate from context
  const words = lower.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  if (words.length >= 2) return words.slice(0, 3).map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('');
  if (words.length === 1) return words[0];
  return 'myFunction';
}

// ─── Enhanced Response Generator ───
class AssistantEngine {
  constructor() {
    this.context = new ContextManager(20);
    this._lastIntent = null;
    this._lastCode = '';
    this._lastLang = '';
  }

  generate(input, currentCode, currentLang) {
    // Track conversation
    this.context.addTurn('user', input, { lang: currentLang, hasCode: !!currentCode });

    const intent = classifyIntent(input);
    const lang = detectLanguage(input) || currentLang || 'javascript';
    const analysis = currentCode ? analyzeCode(currentCode) : { empty: true };

    // Build context-enriched prompt understanding
    const recentContext = this.context.getRecentContext(3);
    const hasFollowUp = recentContext.length > 1 && recentContext[recentContext.length - 2]?.role === 'assistant';

    let response;

    if (intent === 'generate' || intent === 'create') {
      response = this._enhancedGenerate(input, lang, analysis, currentCode);
    } else if (intent === 'refactor' && hasFollowUp && this._lastIntent === 'generate') {
      response = this._handleFollowUpRefactor(input, lang, currentCode);
    } else {
      // Delegate to existing handlers
      response = this._delegateToExisting(intent, input, currentCode, analysis, lang);
    }

    this.context.addTurn('assistant', response, { intent, lang });
    this._lastIntent = intent;
    this._lastLang = lang;
    this._lastCode = currentCode;

    return response;
  }

  _enhancedGenerate(input, lang, analysis, currentCode) {
    const codeType = detectCodeType(input);
    const name = detectName(input);

    const templates = CODE_TEMPLATES[lang] || CODE_TEMPLATES['javascript'];
    const templateFn = templates[codeType] || templates.function;

    if (!templateFn) {
      return this._generateGeneric(input, lang, analysis);
    }

    const code = templateFn(name);
    const parts = [];

    parts.push(`Here's a **${codeType}** for \`${name}\` in **${lang}**:\n`);
    parts.push('```' + lang + '\n' + code + '\n```\n');

    // Add context-aware suggestions
    if (analysis && !analysis.empty) {
      const entities = extractEntities(currentCode);
      if (entities.functions.length > 0) {
        parts.push(`**Related functions in your code:** ${entities.functions.slice(0, 5).map(f => `\`${f.name}\``).join(', ')}`);
      }
    }

    // Add usage hints based on type
    parts.push(this._getUsageHint(codeType, lang));

    return parts.join('\n');
  }

  _generateGeneric(input, lang, analysis) {
    const lower = input.toLowerCase();

    // Try to detect what the user wants
    if (/api|fetch|http|request|endpoint/.test(lower)) {
      return this._generateAPIHandler(lang);
    }
    if (/validate|validation|check/.test(lower)) {
      return this._generateValidator(lang);
    }
    if (/format|pretty|display/.test(lower)) {
      return this._generateFormatter(lang);
    }

    return `I can generate code for you! Try asking for:\n• A **class** — "create a User class"\n• A **function** — "write a function to sort data"\n• **Tests** — "generate tests for my code"\n• An **API handler** — "create an API endpoint"\n• A **component** — "build a React component"\n\nCurrently working in **${lang}**.`;
  }

  _generateAPIHandler(lang) {
    if (lang === 'javascript' || lang === 'typescript') {
      return `**API Handler** in ${lang}:\n\`\`\`${lang}\nasync function handleRequest(req, res) {\n  try {\n    const { method, body, query } = req;\n\n    switch (method) {\n      case 'GET':\n        const data = await fetchData(query);\n        res.json({ success: true, data });\n        break;\n      case 'POST':\n        const created = await createData(body);\n        res.status(201).json({ success: true, data: created });\n        break;\n      default:\n        res.status(405).json({ error: 'Method not allowed' });\n    }\n  } catch (err) {\n    console.error('API Error:', err);\n    res.status(500).json({ error: 'Internal server error' });\n  }\n}\n\`\`\``;
    }
    if (lang === 'python') {
      return `**API Handler** in Python:\n\`\`\`python\nfrom flask import Flask, request, jsonify\n\napp = Flask(__name__)\n\n@app.route('/api/endpoint', methods=['GET', 'POST'])\ndef handle_request():\n    try:\n        if request.method == 'GET':\n            data = fetch_data(request.args)\n            return jsonify({'success': True, 'data': data})\n        elif request.method == 'POST':\n            created = create_data(request.json)\n            return jsonify({'success': True, 'data': created}), 201\n    except Exception as e:\n        return jsonify({'error': str(e)}), 500\n\`\`\``;
    }
    return `API handler template for ${lang} — describe the endpoint details for a more specific template.`;
  }

  _generateValidator(lang) {
    if (lang === 'javascript' || lang === 'typescript') {
      return `**Validator** in ${lang}:\n\`\`\`${lang}\nconst validators = {\n  email: v => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v),\n  url: v => /^https?:\\/\\//.test(v),\n  phone: v => /^\\+?[\\d\\s()-]{7,}$/.test(v),\n  min: (v, n) => v.length >= n,\n  max: (v, n) => v.length <= n,\n  required: v => v != null && v !== '',\n  number: v => !isNaN(Number(v)),\n  integer: v => Number.isInteger(Number(v)),\n};\n\nfunction validate(data, rules) {\n  const errors = [];\n  for (const [field, fieldRules] of Object.entries(rules)) {\n    for (const [rule, ...args] of fieldRules) {\n      if (!validators[rule]?.(data[field], ...args)) {\n        errors.push({ field, rule, message: \`\${field} failed \${rule}\` });\n      }\n    }\n  }\n  return errors.length ? { valid: false, errors } : { valid: true };\n}\n\`\`\``;
    }
    return `Validator template for ${lang} — describe what you want to validate for a more specific implementation.`;
  }

  _generateFormatter(lang) {
    if (lang === 'javascript') {
      return `**Formatter** in JavaScript:\n\`\`\`javascript\nconst formatters = {\n  currency: (n, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n),\n  date: (d, opts = {}) => new Date(d).toLocaleDateString('en-US', opts),\n  phone: s => s.replace(/(\\d{3})(\\d{3})(\\d{4})/,'($1) $2-$3'),\n  truncate: (s, n = 50) => s.length > n ? s.slice(0, n) + '...' : s,\n  capitalize: s => s.charAt(0).toUpperCase() + s.slice(1),\n  kebab: s => s.replace(/[A-Z]/g, m => '-' + m.toLowerCase()),\n  camel: s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase()),\n};\n\`\`\``;
    }
    return `Formatter template for ${lang} — describe what you want to format.`;
  }

  _handleFollowUpRefactor(input, lang, currentCode) {
    const lower = input.toLowerCase();

    if (/split|break|separate/.test(lower)) {
      return `To split this code:\n\n1. **Identify cohesive groups** — functions that work on the same data\n2. **Extract into modules** — create separate files for each group\n3. **Define interfaces** — create clear exports/imports\n4. **Move step by step** — move one function at a time and test after each move\n\nWould you like me to suggest which functions to group together?`;
    }

    if (/rename|naming/.test(lower)) {
      const analysis = analyzeCode(currentCode);
      const suggestions = analysis.funcs?.map(f => {
        const name = f.text.match(/(?:function|def|fn|func)\s+(\w+)/)?.[1];
        return name ? `• \`${name}\` → ${this._suggestBetterName(name)}` : null;
      }).filter(Boolean) || [];
      return suggestions.length ? `**Naming suggestions:**\n\n${suggestions.join('\n')}` : 'I don\'t see any functions to rename in the current code.';
    }

    return 'What specifically would you like to refactor? I can help with:\n• **Split** — break into smaller modules\n• **Rename** — improve naming conventions\n• **Simplify** — reduce complexity\n• **Optimize** — improve performance';
  }

  _suggestBetterName(name) {
    if (/^f$|^fn$|^func$|^func1$/.test(name)) return 'use a descriptive name';
    if (/^[a-z]$/.test(name)) return 'use a more descriptive name';
    if (/do|handle|process|run|exec/.test(name)) return 'add what is being processed';
    return name;
  }

  _getUsageHint(codeType, lang) {
    const hints = {
      class: 'You can now add methods to this class and instantiate it.',
      function: 'Call this function with the appropriate arguments.',
      module: 'Import this module where needed: `import { ... } from "./module"`',
      component: 'Use this component in your JSX: `<${'{Name}'} />`',
      hook: 'Use this hook in your component: `const [state, setState] = ${'{useHook()}'}"',
      test: 'Run your tests with: `npm test` or your test runner.',
      route: 'Register this route with your framework\'s router.',
      middleware: 'Add this middleware to your Express app.',
      reducer: 'Connect this reducer to your Redux store.',
      struct: 'Add fields to this struct and implement methods.',
      enum: 'Use this enum with pattern matching.',
    };
    return hints[codeType] ? `\n💡 **Next step:** ${hints[codeType]}` : '';
  }

  _delegateToExisting(intent, input, code, analysis, lang) {
    // Re-use existing handlers from index.html
    switch (intent) {
      case 'explain':
        return window._ppExplainHandler?.(code, analysis, lang, input) || 'I need code to explain. Open a file first!';
      case 'bug':
        return window._ppBugHandler?.(code, analysis, lang, input) || 'I need code to analyze for bugs. Open a file first!';
      case 'refactor':
        return window._ppRefactorHandler?.(code, analysis, lang, input) || 'I need code to refactor. Open a file first!';
      case 'document':
        return window._ppDocumentHandler?.(code, analysis, lang, input) || 'I need code to document. Open a file first!';
      case 'test':
        return window._ppTestHandler?.(code, analysis, lang, input) || 'I need code to write tests for. Open a file first!';
      case 'review':
        return window._ppReviewHandler?.(code, analysis, lang, input) || 'I need code to review. Open a file first!';
      case 'convert':
        return window._ppConvertHandler?.(code, analysis, lang, input) || 'I need code to convert. Open a file first!';
      case 'complexity':
        return window._ppComplexityHandler?.(code, analysis, lang, input) || 'I need code to analyze. Open a file first!';
      case 'security':
        return window._ppSecurityHandler?.(code, analysis, lang, input) || 'I need code to scan. Open a file first!';
      default:
        return this._handleGeneral(input, code, analysis, lang);
    }
  }

  _handleGeneral(input, code, analysis, lang) {
    const lower = input.toLowerCase();
    if (/^(hi|hello|hey|howdy|sup|yo)\b/.test(lower)) {
      return "Hey! 👋 I'm **PocketPad Intelli** — your NLP-powered code assistant. I can explain code, find bugs, suggest refactors, generate code from natural language, and more. What would you like help with?";
    }
    if (/help|what can you do|commands|features/.test(lower)) {
      return "**Here's what I can do:**\n\n🔍 **Explain code** — Understand what code does\n🐛 **Find bugs** — Detect issues and anti-patterns\n♻️ **Refactor** — Get improvement suggestions\n⚡ **Generate** — Create code from descriptions\n📝 **Document** — Add JSDoc/docstrings\n🧪 **Test** — Generate test templates\n👁️ **Review** — Code quality assessment\n🔄 **Convert** — Language translation guidance\n📊 **Complexity** — Big-O analysis\n🔒 **Security** — Vulnerability scan\n\nJust type naturally or use the suggestion chips below!";
    }
    if (!code || analysis.empty) {
      return `I'd love to help! For the best results, open a code file first. Right now I can:\n• **Generate code** — describe what you need\n• **Answer questions** about programming concepts\n• **Help debug** — paste error messages or describe the issue\n\nWhat can I help with?`;
    }
    return `I see you're working with **${lang}** code (${analysis.lines} lines). Here are some things I can do:\n\n• Say **"explain this"** for a code overview\n• Say **"find bugs"** for issue detection\n• Say **"refactor this"** for improvement suggestions\n• Say **"write tests"** for test templates\n• Say **"review code"** for a quality check\n• Say **"optimize"** for performance analysis\n• Or just describe what you need in natural language!`;
  }

  getConversationHistory() {
    return this.context.getConversationSummary();
  }

  clearHistory() {
    this.context.clear();
  }
}

// ─── Export singleton ───
const assistantEngine = new AssistantEngine();
export default assistantEngine;
export { AssistantEngine, detectCodeType, detectName, CODE_TEMPLATES };
