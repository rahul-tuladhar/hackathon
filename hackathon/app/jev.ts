import "server-only";
import {
  experimental_evaluate as evaluate,
  type Experimental_EvaluationQuestion,
} from "ai";
import { createGateway } from "@ai-sdk/gateway";

// Jev — TypeSafe AI's "System One" decision model, served through the Vercel AI
// Gateway. This is the one model we route through Vercel; every text/chat model
// still goes through the Neon gateway (see gateway.ts).
//
// Jev is an *evaluation* model, not a chat model: you give it one shared `state`
// plus a map of typed `questions` (boolean / choice / score) and it returns
// structured verdicts with probabilities. Call it with `experimental_evaluate`,
// re-exported here as `evaluate`.
//
// Required env vars (set in .env.local):
//   VERCEL_AI_GATEWAY   Vercel AI Gateway key, e.g. vck_...
//
// Optional:
//   JEV_MODEL           Model slug (defaults to typesafe-ai/jev)

export { evaluate };
export type { Experimental_EvaluationQuestion as JevQuestion };

export const JEV_MODEL = process.env.JEV_MODEL ?? "typesafe-ai/jev";

export function isJevConfigured() {
  return Boolean(process.env.VERCEL_AI_GATEWAY);
}

export function getJevModel() {
  const apiKey = process.env.VERCEL_AI_GATEWAY;

  if (!apiKey) {
    throw new Error(
      "Jev is not configured. Set VERCEL_AI_GATEWAY in .env.local.",
    );
  }

  return createGateway({ apiKey }).evaluation(JEV_MODEL);
}

// Thin convenience wrapper so callers just pass `state` + `questions`; the model
// is wired up for them. Returns the same `EvaluationResult` as `evaluate`.
export function evaluateWithJev<
  const QUESTIONS extends Record<string, Experimental_EvaluationQuestion>,
>(options: {
  state: Parameters<typeof evaluate>[0]["state"];
  questions: QUESTIONS;
  maxRetries?: number;
  abortSignal?: AbortSignal;
  headers?: Record<string, string>;
}) {
  return evaluate({ model: getJevModel(), ...options });
}
