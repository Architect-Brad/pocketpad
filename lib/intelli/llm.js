// PocketPad Intelli — LLM provider client
// Optional upgrade tier for the assistant. Direct fetch + SSE streaming, no deps.
//
// Three wire formats are supported, grouped by `family`:
//   anthropic — tool_use blocks + input_json_delta
//   openai    — tool_calls deltas with partial JSON arguments
//   google    — functionCall parts inside streamed candidates

const PROVIDERS = {
  anthropic: {
    family: 'anthropic',
    label: 'Anthropic (Claude)',
    endpoint: 'https://api.anthropic.com/v1/messages',
    modelsEndpoint: 'https://api.anthropic.com/v1/models',
    defaultModel: 'claude-sonnet-5',
    headers(key) {
      return {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      };
    },
    delta(json) {
      // The first text chunk of a block arrives in content_block_start.
      if (json?.type === 'content_block_start' && json.content_block?.type === 'text') {
        return json.content_block.text || '';
      }
      return json?.delta?.text || '';
    },
    parseModels(data) {
      const list = data?.data || data?.models || [];
      return list
        .map((m) => (typeof m === 'string' ? m : m.id))
        .filter(Boolean);
    },
  },
  openai: {
    family: 'openai',
    label: 'OpenAI-compatible',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    modelsEndpoint: 'https://api.openai.com/v1/models',
    defaultModel: 'gpt-5.5',
    headers(key) {
      return {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      };
    },
    delta(json) {
      return json.choices?.[0]?.delta?.content || '';
    },
    parseModels(data) {
      const list = data?.data || [];
      return list
        .map((m) => (typeof m === 'string' ? m : m.id))
        .filter(Boolean);
    },
  },
  custom: {
    family: 'openai',
    label: 'Custom (OpenAI-compatible URL)',
    endpoint: '',
    modelsEndpoint: '',
    defaultModel: '',
    headers(key) {
      return {
        'content-type': 'application/json',
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      };
    },
    delta(json) {
      return json.choices?.[0]?.delta?.content || '';
    },
    parseModels(data) {
      const list = data?.data || data?.models || [];
      return list
        .map((m) => (typeof m === 'string' ? m : m.id || m.name))
        .filter(Boolean);
    },
  },
  google: {
    family: 'google',
    label: 'Google AI Studio',
    // The Generative Language API uses a different URL shape and body format
    // from the OpenAI-compatible providers.
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    modelsEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    generateContentPath: ':generateContent',
    streamGenerateContentPath: ':streamGenerateContent?alt=sse',
    defaultModel: 'gemini-2.0-flash',
    buildUrl(endpoint, model) {
      const base = String(endpoint || '').replace(/\/+$/, '');
      return `${base}/${model}:streamGenerateContent?alt=sse`;
    },
    headers(key) {
      return {
        'content-type': 'application/json',
        'x-goog-api-key': key,
      };
    },
    delta(json) {
      const parts = json?.candidates?.[0]?.content?.parts || [];
      let out = '';
      for (const p of parts) if (p?.text) out += p.text;
      return out;
    },
    parseModels(data) {
      const list = data?.models || data?.modelNames || [];
      // Google returns objects like { name: "models/gemini-2.0-flash" }.
      // Calling .includes() on the object threw "m.includes is not a function".
      return list
        .map((m) => (typeof m === 'string' ? m : (m?.name || m?.id || '')))
        .map((m) => m.replace(/^models\//, ''))
        .filter((m) => m && typeof m === 'string' && !m.includes('embed') && !m.includes('count'));
    },
  },
  groq: {
    family: 'openai',
    label: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    modelsEndpoint: 'https://api.groq.com/models',
    defaultModel: 'llama3-70b-8192',
    headers(key) {
      return {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      };
    },
    delta(json) {
      return json.choices?.[0]?.delta?.content || '';
    },
    parseModels(data) {
      const list = data?.data || data?.models || [];
      return list
        .map((m) => typeof m === 'string' ? m : m.id || m.name)
        .filter(Boolean);
    },
  },
  openrouter: {
    family: 'openai',
    label: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    modelsEndpoint: 'https://openrouter.ai/api/v1/models',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    headers(key) {
      return {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      };
    },
    delta(json) {
      return json.choices?.[0]?.delta?.content || '';
    },
    parseModels(data) {
      const list = data?.data || data?.models || [];
      return list
        .map((m) => typeof m === 'string' ? m : m.id || m.name)
        .filter(Boolean);
    },
  },
};

const SYSTEM_PROMPT = `You are the coding assistant inside PocketPad, a mobile-first code editor.

Rules:
- Answer concisely. The user is on a phone.
- Put code in fenced blocks tagged with the language, e.g. \`\`\`python.
- Give runnable code, not pseudo-code, unless asked for pseudo-code.
- If the user asks to generate something, return the code first and keep prose minimal.
- When explaining, lead with the answer, then the reasoning.

Editor tools:
You have tools that act on the editor directly. When the user asks you to
create, change, inspect or run something, CALL THE TOOL — do not just print
the code and ask the user to paste it.

- Use \`list_tabs\` / \`read_file\` before editing a file you have not read.
- Use \`create_file\` to make a new file, \`insert_code\` to add code at the
  cursor, \`replace_text\` to change existing text, \`rename_symbol\` to
  rename across a file, \`set_language\` to fix the syntax mode.
- Use \`search_files\` to find where something lives, \`list_symbols\` for an
  outline, \`get_diagnostics\` to see lint problems.
- Use \`run_code\` to run the file and check the output before claiming it works.
- Prefer editing the existing file over creating a new one unless asked.
- After a tool runs, look at its result before doing the next thing.
- When you are done, summarise briefly what you changed.`;

const MAX_CODE_CHARS = 12000;
const MAX_HISTORY_TURNS = 8;

export function isConfigured(cfg) {
  if (!cfg || !cfg.enabled || !cfg.provider) return false;
  const p = PROVIDERS[cfg.provider];
  if (!p) return false;
  if (cfg.provider === 'custom') return !!cfg.endpoint;
  return !!cfg.apiKey;
}

export function providerDefaults(name) {
  const p = PROVIDERS[name];
  if (!p) return null;
  return { endpoint: p.endpoint, model: p.defaultModel };
}

export function providerLabel(name) {
  return PROVIDERS[name]?.label || name || 'none';
}

/** Per-provider URL builder (Google appends the model + action to the path). */
function resolveRequestUrl(cfg, provider, model) {
  if (cfg.provider === 'custom') return cfg.endpoint;
  if (provider.buildUrl) return provider.buildUrl(provider.endpoint, model);
  return provider.endpoint;
}

function resolveModelsEndpoint(cfg) {
  if (cfg.provider === 'custom') {
    if (!cfg.endpoint) return '';
    const base = cfg.endpoint.replace(/\/+$/, '');
    if (/\/chat\/completions$/i.test(base)) return base.replace(/\/chat\/completions$/i, '/models');
    if (/\/models$/i.test(base)) return base;
    // Fall back to the OpenAI-style sibling path.
    return base + '/models';
  }
  return PROVIDERS[cfg.provider]?.modelsEndpoint || '';
}

function rank(id) {
  const s = id.toLowerCase();
  let score = 0;
  if (/chat|completion|^gpt|^claude/.test(s)) score += 5;
  if (/embedding|whisper|tts|transcribe|moderation|image|audio|realtime|search/.test(s)) score -= 10;
  if (/mini|nano|haiku|luna|light/.test(s)) score -= 2;
  return score;
}

export async function listModels(cfg) {
  const provider = PROVIDERS[cfg.provider];
  if (!provider) throw new Error(`Unknown provider: ${cfg.provider}`);

  const url = resolveModelsEndpoint(cfg);
  if (!url) throw new Error('No model list endpoint for this provider.');

  let res;
  try {
    res = await fetch(url, { headers: provider.headers(cfg.apiKey || '') });
  } catch {
    throw new Error('Could not reach the provider. Check the endpoint and connection.');
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('API key rejected.');
    throw new Error(`Model list failed (${res.status}).`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Provider returned an unreadable model list.');
  }

  const ids = provider.parseModels(data);
  if (!ids.length) throw new Error('Provider returned no models.');

  return [...new Set(ids)].sort((a, b) => rank(b) - rank(a) || a.localeCompare(b));
}

function truncate(text, limit) {
  const s = String(text ?? '');
  if (s.length <= limit) return { text: s, truncated: false };
  return { text: s.slice(0, limit), truncated: true };
}

/**
 * Build the neutral conversation turns for a request.
 *
 * Turns are provider-agnostic:
 *   { role: 'user',      text }
 *   { role: 'assistant', text }
 *   { role: 'assistant', toolCalls: [{ id, name, arguments }] }
 *   { role: 'tool',      toolCallId, name, result }
 */
export function buildTurns(history, input, code, lang) {
  const turns = [];
  for (const h of (history || []).slice(-MAX_HISTORY_TURNS)) {
    turns.push({ role: h.role === 'assistant' ? 'assistant' : 'user', text: h.text || '' });
  }
  const { text, truncated } = truncate(code, MAX_CODE_CHARS);
  let prompt = input || '';
  if (text && text.trim()) {
    const note = truncated ? '\n\n(code truncated)' : '';
    prompt = `${prompt}\n\nCurrent file (${lang || 'plain text'}):\n\`\`\`\n${text}\n\`\`\`${note}`;
  }
  turns.push({ role: 'user', text: prompt });
  return turns;
}

/** Convert neutral turns into the message shape a provider expects. */
function toProviderMessages(family, turns) {
  const msgs = [];
  let i = 0;
  while (i < turns.length) {
    const t = turns[i];

    // Consecutive tool results are grouped into a single message.
    if (t.role === 'tool') {
      const group = [];
      while (i < turns.length && turns[i].role === 'tool') group.push(turns[i++]);
      const results = group.map(g => String(g.result ?? ''));
      if (family === 'anthropic') {
        msgs.push({
          role: 'user',
          content: group.map((g, n) => ({ type: 'tool_result', tool_use_id: g.toolCallId, content: results[n] })),
        });
      } else if (family === 'google') {
        msgs.push({
          role: 'user',
          parts: group.map((g, n) => ({ functionResponse: { name: g.name, response: { result: results[n] } } })),
        });
      } else {
        group.forEach((g, n) => msgs.push({ role: 'tool', tool_call_id: g.toolCallId, content: results[n] }));
      }
      continue;
    }

    if (t.role === 'assistant' && t.toolCalls && t.toolCalls.length) {
      if (family === 'anthropic') {
        msgs.push({
          role: 'assistant',
          content: t.toolCalls.map(c => ({ type: 'tool_use', id: c.id, name: c.name, input: c.arguments || {} })),
        });
      } else if (family === 'google') {
        msgs.push({
          role: 'model',
          parts: t.toolCalls.map(c => ({ functionCall: { name: c.name, args: c.arguments || {} } })),
        });
      } else {
        msgs.push({
          role: 'assistant',
          content: null,
          tool_calls: t.toolCalls.map(c => ({
            id: c.id,
            type: 'function',
            function: { name: c.name, arguments: JSON.stringify(c.arguments || {}) },
          })),
        });
      }
    } else if (t.role === 'assistant') {
      if (family === 'google') msgs.push({ role: 'model', parts: [{ text: t.text || '' }] });
      else msgs.push({ role: 'assistant', content: t.text || '' });
    } else {
      if (family === 'google') msgs.push({ role: 'user', parts: [{ text: t.text || '' }] });
      else msgs.push({ role: 'user', content: t.text || '' });
    }
    i++;
  }
  return msgs;
}

/** Render the tool catalog in the shape a provider expects. */
function buildToolsPayload(family, tools) {
  const defs = (tools || []).filter(t => t && t.name);
  if (family === 'anthropic') {
    return defs.map(t => ({
      name: t.name,
      description: t.description || '',
      input_schema: t.parameters || { type: 'object', properties: {} },
    }));
  }
  if (family === 'google') {
    // Gemini's schema dialect has no additionalProperties.
    return [{
      functionDeclarations: defs.map(t => {
        const params = { ...(t.parameters || { type: 'object', properties: {} }) };
        delete params.additionalProperties;
        return { name: t.name, description: t.description || '', parameters: params };
      }),
    }];
  }
  return defs.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description || '',
      parameters: t.parameters || { type: 'object', properties: {} },
    },
  }));
}

/** Assemble the request body for a provider. */
function buildRequest(provider, model, turns, tools, maxTokens) {
  const family = provider.family || 'openai';
  const msgs = toProviderMessages(family, turns);
  const body = { model };

  if (family === 'anthropic') {
    body.max_tokens = maxTokens;
    body.stream = true;
    body.messages = msgs;
    if (SYSTEM_PROMPT) body.system = SYSTEM_PROMPT;
  } else if (family === 'google') {
    body.contents = msgs;
    body.generationConfig = { maxOutputTokens: maxTokens };
    if (SYSTEM_PROMPT) body.systemInstruction = { parts: [{ text: SYSTEM_PROMPT }] };
  } else {
    body.stream = true;
    body.max_tokens = maxTokens;
    body.messages = SYSTEM_PROMPT ? [{ role: 'system', content: SYSTEM_PROMPT }, ...msgs] : msgs;
  }

  if (tools && tools.length) {
    body.tools = buildToolsPayload(family, tools);
    if (family === 'google') body.toolConfig = { functionCallingConfig: { mode: 'AUTO' } };
    else body.tool_choice = 'auto';
  }
  return body;
}

/**
 * Collects tool calls out of a provider's SSE stream.
 * Each family streams them differently, but they all normalise to
 * [{ id, name, arguments }].
 */
class ToolCallAccumulator {
  constructor(family) {
    this.family = family || 'openai';
    this.calls = new Map();
    this.order = [];
  }

  push(json) {
    if (this.family === 'anthropic') this._pushAnthropic(json);
    else if (this.family === 'google') this._pushGoogle(json);
    else this._pushOpenAI(json);
  }

  _pushAnthropic(json) {
    if (json?.type === 'content_block_start') {
      const cb = json.content_block;
      if (cb?.type === 'tool_use') {
        const key = json.index ?? this.order.length;
        this.calls.set(key, { id: cb.id || 'toolu_' + key, name: cb.name || '', raw: '' });
        this.order.push(key);
      }
    } else if (json?.type === 'content_block_delta') {
      const d = json.delta;
      if (d?.type === 'input_json_delta') {
        const c = this.calls.get(json.index);
        if (c) c.raw += d.partial_json || '';
      }
    }
  }

  _pushOpenAI(json) {
    const tcs = json?.choices?.[0]?.delta?.tool_calls;
    if (!Array.isArray(tcs)) return;
    for (const t of tcs) {
      const key = t.index ?? 0;
      if (!this.calls.has(key)) {
        this.calls.set(key, { id: t.id || 'call_' + key, name: '', raw: '' });
        this.order.push(key);
      }
      const c = this.calls.get(key);
      if (t.function?.name) c.name = t.function.name;
      if (t.function?.arguments) c.raw += t.function.arguments;
    }
  }

  _pushGoogle(json) {
    const parts = json?.candidates?.[0]?.content?.parts || [];
    for (const p of parts) {
      if (p?.functionCall) {
        const key = 'g' + this.order.length;
        this.calls.set(key, { id: key, name: p.functionCall.name || '', obj: p.functionCall.args || {} });
        this.order.push(key);
      }
    }
  }

  finalize() {
    const out = [];
    for (const key of this.order) {
      const c = this.calls.get(key);
      if (!c || !c.name) continue;
      let args = c.obj || {};
      if (c.raw) {
        try { args = JSON.parse(c.raw); }
        catch { args = { _raw: c.raw }; }
      }
      out.push({ id: c.id, name: c.name, arguments: args });
    }
    return out;
  }
}


async function* readSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          yield JSON.parse(payload);
        } catch {
          // keep-alive or partial frame
        }
      }
    }
  } finally {
    // Always release the reader — otherwise the body stays locked and the
    // connection is never torn down.
    try { reader.releaseLock(); } catch {}
  }
}

function describeError(status, statusText) {
  if (status === 401 || status === 403) return 'API key rejected. Check the key in Settings.';
  if (status === 404) return 'Endpoint or model not found. Check the model name and URL in Settings.';
  if (status === 429) return 'Rate limited or out of credit. Try again shortly.';
  if (status >= 500) return `Provider error ${status}. Try again shortly.`;
  return `Request failed${statusText ? ` (${status} ${statusText})` : ''}.`;
}

/**
 * Stream a completion.
 *
 * Yields events:
 *   { type: 'text',      text }     — a chunk of assistant prose
 *   { type: 'tool_calls', calls }    — the model asked for tools to run
 *   { type: 'done',       text }     — the turn is complete
 *
 * Pass `tools` to let the model call editor tools. Pass `turns` to continue a
 * conversation (otherwise one is built from `history`/`input`/`code`).
 */
export async function* streamCompletion(cfg, {
  turns, history, input, code, lang,
  maxTokens = 2048, signal, tools,
} = {}) {
  const provider = PROVIDERS[cfg.provider];
  if (!provider) throw new Error(`Unknown provider: ${cfg.provider}`);

  const model = (cfg.model || provider.defaultModel).trim();
  const url = resolveRequestUrl(cfg, provider, model);
  if (!url) throw new Error('No endpoint configured for this provider.');

  const conversation = (turns && turns.length) ? turns : buildTurns(history, input, code, lang);
  const body = buildRequest(provider, model, conversation, tools, maxTokens);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: provider.headers(cfg.apiKey || ''),
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new Error('Network request failed. The LLM assistant needs a connection.');
  }

  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.error?.message || data?.message || data?.error || '';
      if (detail && typeof detail === 'object') detail = JSON.stringify(detail).slice(0, 300);
    } catch {
      // non-JSON error body
    }
    const base = describeError(res.status, res.statusText);
    throw new Error(detail ? `${base} (${detail})` : base);
  }

  if (!res.body) throw new Error('Provider returned no response stream.');

  const acc = new ToolCallAccumulator(provider.family);
  let text = '';
  for await (const json of readSSE(res)) {
    acc.push(json);
    const chunk = provider.delta(json);
    if (chunk) {
      text += chunk;
      yield { type: 'text', text: chunk };
    }
  }

  const calls = acc.finalize();
  if (calls.length) yield { type: 'tool_calls', calls };
  yield { type: 'done', text };
}

export default {
  PROVIDERS,
  isConfigured,
  streamCompletion,
  buildTurns,
  listModels,
  providerDefaults,
  providerLabel,
};