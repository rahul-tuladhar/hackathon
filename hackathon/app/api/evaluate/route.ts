import jobs from "../../jobs";
import { evaluateWithJev, isJevConfigured, type JevQuestion } from "../../jev";

// Evaluates a job against the candidate's rules using jev (Vercel AI Gateway).
// The whole job is handed to jev as JSON `state`, and each rule becomes one
// boolean question ("is this a good fit?"). Returns a verdict per rule.
// POST { jobId, rules: { id, key, value, threshold }[] } -> { results } | { error }.

type IncomingRule = {
  id: string;
  key: string;
  value: string;
  threshold?: number;
};

const DEFAULT_THRESHOLD = 50;

export async function POST(request: Request) {
  if (!isJevConfigured()) {
    return Response.json(
      { error: "Jev is not configured. Set VERCEL_AI_GATEWAY in .env.local." },
      { status: 503 },
    );
  }

  const { jobId, rules } = (await request.json()) as {
    jobId?: number;
    rules?: IncomingRule[];
  };

  const job = jobId != null ? jobs[jobId] : undefined;
  if (!job) {
    return Response.json({ error: `Unknown job: ${jobId}` }, { status: 404 });
  }

  // Only rules that are actually filled in are worth asking about.
  const activeRules = (rules ?? []).filter(
    (rule) => rule.key.trim() && rule.value.trim(),
  );
  if (activeRules.length === 0) {
    return Response.json({ results: [] });
  }

  // One boolean question per rule, keyed by the rule's id so we can match the
  // answers back up afterwards.
  const questions: Record<string, JevQuestion> = {};
  for (const rule of activeRules) {
    questions[rule.id] = {
      type: "boolean",
      instructions: `The candidate cares about "${rule.key.trim()}". It is a good fit when: ${rule.value.trim()}. Based on the job, does it satisfy this?`,
    };
  }

  // The full job as JSON context for jev to reason over.
  const state = JSON.stringify({ id: jobId, ...job });

  try {
    const { answers } = await evaluateWithJev({ state, questions });
    const results = activeRules.map((rule) => {
      const answer = answers[rule.id];
      const probability = answer?.type === "boolean" ? answer.probability : 0;
      const threshold = rule.threshold ?? DEFAULT_THRESHOLD;
      return {
        id: rule.id,
        key: rule.key.trim(),
        threshold,
        pass: probability >= threshold / 100,
        probability,
      };
    });
    return Response.json({ results });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to evaluate rules" },
      { status: 500 },
    );
  }
}
