// PocketPad Intelli — LLM provider client
// Optional upgrade tier for the assistant. Direct fetch + SSE streaming, no deps.

const PROVIDERS = {
  anthropic: {
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
    body(model, messages, system, maxTokens) {
      return {
        model,
        max_tokens: maxTokens,
        stream: true,
        ...(system ? { system } : {}),
        messages,
      };
    },
    delta(json) {
      return json.delta?.text || '';
    },
    parseModels(data) {
      const list = data?.data || data?.models || [];
      return list
        .map((m) => (typeof m === 'string' ? m : m.id))
        .filter(Boolean);
    },
  },
  openai: {
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
    body(model, messages, system, maxTokens) {
      const all = system ? [{ role: 'system', content: system }, ...messages] : messages;
      return { model, stream: true, max_tokens: maxTokens, messages: all };
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
    body(model, messages, system, maxTokens) {
      const all = system ? [{ role: 'system', content: system }, ...messages] : messages;
      return { model, stream: true, max_tokens: maxTokens, messages: all };
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
  google: {
    label: 'Google AI Studio',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    modelsEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models:generateContent',
    defaultModel: 'gemini-1.5-flash',
    headers(key) {
      return {
        'content-type': 'application/json',
        'x-goog-api-key': key,
      };
    },
    body(model, messages, system, maxTokens) {
      const all = system ? [{ role: 'user', content: system }, ...messages] : messages;
      return { model, stream: true, max_tokens: maxTokens, messages: all };
    },
    delta(json) {
      return json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    },
    parseModels(data) {
      const list = data?.models || data?.modelNames || [];
      // Google API returns names like "models/gemini-1.5-flash-001"
      // Strip the "models/" prefix and keep just the model name
      return list
        .map((m) => (typeof m === 'string' ? m.replace(/^models\//, '') : m))
        .filter((m) => m && !m.includes('embed') && !m.includes('count'));
    },
  },
  groq: {
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
    body(model, messages, system, maxTokens) {
      const all = system ? [{ role: 'system', content: system }, ...messages] : messages;
      return { model, stream: true, max_tokens: maxTokens, messages: all };
    },
    delta(json) {
      return json.choices?.[0]?.delta?.content || '';
    },
    parseModels(data) {
      const list = data?.data || data?.modelos || [];
      return list
        .map((m) => typeof m === 'string' ? m : m.id || m.name)
        .filter(Boolean);
    },
  },
  openrouter: {
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
    body(model, messages, system, maxTokens) {
      const all = system ? [{ role: 'system', content: system }, ...messages] : messages;
      return { model, stream: true, max_tokens: maxTokens, messages: all };
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
- When explaining, lead with the answer, then the reasoning.`;

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

function resolveEndpoint(cfg) {
  if (cfg.provider === 'custom') return cfg.endpoint;
  return PROVIDERS[cfg.provider]?.endpoint;
}

function resolveModelsEndpoint(cfg) {
  if (cfg.provider === 'custom') {
    if (!cfg.endpoint) return '';
    return cfg.endpoint.replace(/\/chat\/completions\/?$/, '/models');
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

function buildMessages(history, input, code, lang) {
  const msgs = [];
  for (const turn of (history || []).slice(-MAX_HISTORY_TURNS)) {
    const role = turn.role === 'assistant' ? 'assistant' : 'user';
    msgs.push({ role, content: turn.text || '' });
  }
  const { text, truncated } = truncate(code, MAX_CODE_CHARS);
  let prompt = input;
  if (text.trim()) {
    const note = truncated ? '\n\n(code truncated)' : '';
    prompt = `${input}\n\nCurrent file (${lang || 'plain text'}):\n\`\`\`\n${text}\n\`\`\`${note}`;
  }
  msgs.push({ role: 'user', content: prompt });
  return msgs;
}

async function* readSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
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
}

function describeError(status, statusText) {
  if (status === 401 || status === 403) return 'API key rejected. Check the key in Settings.';
  if (status === 404) return 'Endpoint or model not found. Check the model name and URL in Settings.';
  if (status === 429) return 'Rate limited or out of credit. Try again shortly.';
  if (status >= 500) return `Provider error ${status}. Try again shortly.`;
  return `Request failed${statusText ? ` (${status} ${statusText})` : ''}.`;
}

export async function* streamCompletion(cfg, { history, input, code, lang, maxTokens = 2048 }) {
  const provider = PROVIDERS[cfg.provider];
  if (!provider) throw new Error(`Unknown provider: ${cfg.provider}`);

  const endpoint = resolveEndpoint(cfg);
  if (!endpoint) throw new Error('No endpoint configured for this provider.');

  const model = (cfg.model || provider.defaultModel).trim();
  const body = provider.body(model, buildMessages(history, input, code, lang), SYSTEM_PROMPT, maxTokens);

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: provider.headers(cfg.apiKey || ''),
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error('Network request failed. The LLM assistant needs a connection.');
  }

  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.error?.message || data?.message || '';
    } catch {
      // non-JSON error body
    }
    const base = describeError(res.status, res.statusText);
    throw new Error(detail ? `${base} (${detail})` : base);
  }

  if (!res.body) throw new Error('Provider returned no response stream.');

  for await (const json of readSSE(res)) {
    const text = provider.delta(json);
    if (text) yield text;
  }
}

export default { PROVIDERS, isConfigured, streamCompletion, listModels, providerDefaults, providerLabel };