// PocketPad Intelli — LLM agent loop
//
// Runs the assistant turn: stream the model's reply, execute any editor tools
// it asks for, feed the results back, and repeat until the model stops
// calling tools. Kept out of index.html so it can be unit tested and so the
// app script stays manageable.

import { TOOLS, executeTool, describeTool } from './tools.js';

const DEFAULT_MAX_ROUNDS = 8;

/** Compact, model-friendly rendering of a tool result. */
export function formatToolResult(res) {
  if (!res || typeof res !== 'object') return String(res ?? '');
  if (res.ok === false) return 'ERROR: ' + (res.error || 'unknown error');
  const { ok, ...rest } = res;
  let text;
  try { text = JSON.stringify(rest); }
  catch { text = String(rest); }
  return text.length > 2000 ? text.slice(0, 2000) + '… (truncated)' : text;
}

/**
 * Run one assistant turn.
 *
 * @param {object}   o
 * @param {object}   o.mod        the llm.js module
 * @param {object}   o.cfg        LLM configuration
 * @param {Array}    o.turns      conversation turns (mutated in place)
 * @param {Array}   [o.tools]     tool definitions to expose
 * @param {boolean} [o.useTools]  false → the model gets no tools at all
 * @param {Function}[o.onText]    (allText, roundText) => void
 * @param {Function}[o.onToolStart] (call) => void
 * @param {Function}[o.onToolEnd] (call, result) => void
 * @param {AbortSignal}[o.signal]
 * @returns {Promise<{text: string, turns: Array, toolCalls: Array}>}
 */
export async function runAgentTurn({
  mod,
  cfg,
  turns,
  tools = TOOLS,
  useTools = true,
  onText,
  onToolStart,
  onToolEnd,
  signal,
  maxRounds = DEFAULT_MAX_ROUNDS,
}) {
  let text = '';
  const allToolCalls = [];

  for (let round = 0; round < maxRounds; round++) {
    const stream = mod.streamCompletion(cfg, {
      turns,
      tools: useTools ? tools : null,
      signal,
    });

    let roundText = '';
    let calls = [];

    for await (const ev of stream) {
      if (ev.type === 'text') {
        roundText += ev.text;
        text += ev.text;
        if (onText) onText(text, roundText);
      } else if (ev.type === 'tool_calls') {
        calls = ev.calls || [];
      }
    }

    // No tool calls → the model is done talking.
    if (!calls.length) break;

    // Record what the model asked for, then run it.
    turns.push({ role: 'assistant', text: roundText, toolCalls: calls });
    allToolCalls.push(...calls);

    for (const call of calls) {
      if (onToolStart) onToolStart(call, describeTool(call.name, call.arguments));
      let res;
      try {
        res = await executeTool(call.name, call.arguments);
      } catch (e) {
        res = { ok: false, error: e?.message || String(e) };
      }
      if (onToolEnd) onToolEnd(call, res);
      turns.push({
        role: 'tool',
        toolCallId: call.id,
        name: call.name,
        result: formatToolResult(res),
      });
    }
  }

  return { text, turns, toolCalls: allToolCalls };
}

export { TOOLS, executeTool, describeTool };
export default { runAgentTurn, formatToolResult, TOOLS, executeTool, describeTool };
