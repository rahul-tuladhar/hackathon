import type { ProviderStatus } from "./types";

/**
 * OpenAI-compatible chat client with a provider failover chain.
 *
 * Priority (first configured and reachable wins):
 *   1. Neon AI Gateway        NEON_AI_GATEWAY_BASE_URL + NEON_AI_GATEWAY_TOKEN
 *   2. Vercel AI Gateway      AI_GATEWAY_API_KEY (or VERCEL_AI_GATEWAY_API_KEY)
 *   3. Generic OpenAI-compat  LLM_BASE_URL + LLM_API_KEY + LLM_MODEL
 *   4. Local LM Studio        auto-detected, optional, never required
 *   5. OpenCode Zen           OPENCODE_API_KEY
 * If every provider fails, callers fall back to the deterministic mock.
 */

export type Resolved = {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** True for local providers we should probe before trusting. */
  probe?: boolean;
};

const NEON_BASE = process.env.NEON_AI_GATEWAY_BASE_URL || "";
const NEON_TOKEN = process.env.NEON_AI_GATEWAY_TOKEN || "";
const NEON_MODEL = process.env.NEON_MODEL || "gpt-5-mini";

const VERCEL_KEY =
  process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_AI_GATEWAY_API_KEY || "";
const VERCEL_BASE = process.env.AI_GATEWAY_BASE_URL || "https://ai-gateway.vercel.sh/v1";
const VERCEL_MODEL = process.env.AI_GATEWAY_MODEL || "anthropic/claude-sonnet-5";

const GENERIC_BASE = process.env.LLM_BASE_URL || "";
const GENERIC_KEY = process.env.LLM_API_KEY || "";
const GENERIC_MODEL = process.env.LLM_MODEL || "";

const LM_BASE = process.env.LMSTUDIO_BASE_URL || "http://127.0.0.1:1234/v1";
const LM_MODEL = process.env.LMSTUDIO_MODEL || "";

const OPENCODE_BASE = process.env.OPENCODE_BASE_URL || "https://opencode.ai/zen/v1";
const OPENCODE_MODEL = process.env.OPENCODE_MODEL || "gpt-5.5";

/** Candidate providers in priority order. Only configured ones are included. */
export function providerChain(): Resolved[] {
  const chain: Resolved[] = [];

  if (NEON_BASE && NEON_TOKEN) {
    chain.push({
      id: "neon",
      label: "Neon AI Gateway",
      baseUrl: `${NEON_BASE.replace(/\/$/, "")}/v1`,
      apiKey: NEON_TOKEN,
      model: NEON_MODEL,
    });
  }

  if (VERCEL_KEY) {
    chain.push({
      id: "vercel",
      label: "Vercel AI Gateway",
      baseUrl: VERCEL_BASE.replace(/\/$/, ""),
      apiKey: VERCEL_KEY,
      model: VERCEL_MODEL,
    });
  }

  if (GENERIC_BASE && GENERIC_MODEL) {
    chain.push({
      id: "openai-compatible",
      label: "OpenAI-compatible",
      baseUrl: GENERIC_BASE.replace(/\/$/, ""),
      apiKey: GENERIC_KEY || "not-needed",
      model: GENERIC_MODEL,
    });
  }

  // Local LM Studio: optional, and only when explicitly enabled or auto-detected.
  if (process.env.LLM_LOCAL === "1" || LM_MODEL) {
    chain.push({
      id: "lmstudio",
      label: "LM Studio (local)",
      baseUrl: LM_BASE.replace(/\/$/, ""),
      apiKey: process.env.LMSTUDIO_API_KEY || "lmstudio",
      model: LM_MODEL || "auto",
      probe: true,
    });
  }

  if (process.env.OPENCODE_API_KEY) {
    chain.push({
      id: "opencode",
      label: "OpenCode Zen",
      baseUrl: OPENCODE_BASE.replace(/\/$/, ""),
      apiKey: process.env.OPENCODE_API_KEY,
      model: OPENCODE_MODEL,
    });
  }

  return chain;
}

async function listModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/models`, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { data?: Array<{ id: string }> };
  return (data.data || []).map((m) => m.id);
}

/** Resolve the concrete model id for a provider, probing local servers. */
async function resolveModel(p: Resolved): Promise<Resolved | null> {
  if (p.model !== "auto") return p;
  try {
    const models = await listModels(p.baseUrl, p.apiKey).then((ids) =>
      ids.filter((id) => !/embed|abliterat/i.test(id)),
    );
    if (models.length === 0) return null;
    return { ...p, model: models[0] };
  } catch {
    return null;
  }
}

/** When no gateway is configured, allow LM Studio auto-detection as a fallback. */
async function withLocalFallback(chain: Resolved[]): Promise<Resolved[]> {
  if (chain.some((p) => p.id === "lmstudio")) return chain;
  if (process.env.LLM_LOCAL === "0") return chain;
  try {
    const models = await listModels(LM_BASE, "lmstudio").then((ids) =>
      ids.filter((id) => !/embed|abliterat/i.test(id)),
    );
    if (models.length === 0) return chain;
    const local: Resolved = {
      id: "lmstudio",
      label: "LM Studio (local)",
      baseUrl: LM_BASE,
      apiKey: "lmstudio",
      model: LM_MODEL || models[0],
    };
    // Insert before opencode so a real local model beats the (possibly
    // unfunded) OpenCode gateway, but still after the hosted gateways.
    const idx = chain.findIndex((p) => p.id === "opencode");
    if (idx === -1) return [...chain, local];
    return [...chain.slice(0, idx), local, ...chain.slice(idx)];
  } catch {
    return chain;
  }
}

/** Select the same configured OpenAI-compatible provider used by chatComplete. */
export async function resolveAgentProviders(): Promise<Resolved[]> {
  const chain = await withLocalFallback(providerChain());
  const resolvedProviders: Resolved[] = [];
  for (const candidate of chain) {
    const resolved = await resolveModel(candidate);
    if (resolved) resolvedProviders.push(resolved);
  }
  if (!resolvedProviders.length) throw new Error("No language model provider is configured or reachable.");
  return resolvedProviders;
}

export async function resolveAgentProvider(): Promise<Resolved> {
  return (await resolveAgentProviders())[0];
}

type ChatResult = { text: string; provider: string; model: string };

async function callProvider(
  p: Resolved,
  system: string,
  user: string,
  opts: { maxTokens?: number; temperature?: number },
): Promise<ChatResult> {
  const body = {
    model: p.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 2400,
    stream: false,
  };

  const send = (payload: Record<string, unknown>) =>
    fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${p.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(180_000),
    });

  let res = await send(body);

  // Some OpenAI models reject max_tokens and want max_completion_tokens.
  if (res.status === 400) {
    const errText = await res.text().catch(() => "");
    if (/max_completion_tokens|max_tokens/i.test(errText)) {
      const { max_tokens, ...rest } = body;
      res = await send({ ...rest, max_completion_tokens: max_tokens });
    } else {
      throw new Error(`${p.id} 400: ${errText.slice(0, 200)}`);
    }
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`${p.id} ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{
      message?: { content?: string | null; reasoning_content?: string | null };
    }>;
  };
  const msg = data.choices?.[0]?.message;
  // Some reasoning-capable OpenAI-compatible providers expose private chain
  // of thought separately. Never return that as a user-facing completion.
  const text = (msg?.content || "").trim();
  if (!text) throw new Error(`${p.id} returned an empty completion`);
  return { text, provider: p.id, model: p.model };
}

export async function chatComplete(
  system: string,
  user: string,
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<ChatResult> {
  const base = providerChain();
  const chain = await withLocalFallback(base);
  if (chain.length === 0) {
    throw new Error("No LLM provider configured");
  }

  const errors: string[] = [];
  for (const candidate of chain) {
    const p = await resolveModel(candidate);
    if (!p) {
      errors.push(`${candidate.id}: unavailable`);
      continue;
    }
    try {
      return await callProvider(p, system, user, opts);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  throw new Error(`All LLM providers failed. ${errors.join(" | ")}`);
}

/** Extract the first balanced JSON object/array from arbitrary text. */
export function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through to brace scanning
  }

  for (const [open, close] of [
    ["{", "}"],
    ["[", "]"],
  ] as const) {
    const start = cleaned.indexOf(open);
    if (start === -1) continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(cleaned.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error("Model did not return parseable JSON");
}

export async function jsonComplete<T>(
  system: string,
  user: string,
  opts: { maxTokens?: number } = {},
): Promise<{ data: T; provider: string; model: string }> {
  const { text, provider, model } = await chatComplete(system, user, {
    maxTokens: opts.maxTokens ?? 2600,
  });
  const data = extractJson(text) as T;
  return { data, provider, model };
}

export async function llmHealth(): Promise<ProviderStatus["llm"]> {
  const base = providerChain();
  const chain = await withLocalFallback(base);

  if (chain.length === 0) {
    return {
      available: false,
      provider: "none",
      model: "-",
      endpoint: "-",
      detail: "no provider configured; using deterministic mock",
    };
  }

  const first = chain[0];
  // For hosted gateways we trust configuration; for local we probe the model list.
  if (!first.probe) {
    return {
      available: true,
      provider: first.label,
      model: first.model,
      endpoint: first.baseUrl,
      detail: `primary of ${chain.length} provider(s)`,
    };
  }

  const resolved = await resolveModel(first);
  return {
    available: Boolean(resolved),
    provider: first.label,
    model: resolved?.model ?? first.model,
    endpoint: first.baseUrl,
    detail: resolved ? "local model loaded" : "local server not ready",
  };
}
