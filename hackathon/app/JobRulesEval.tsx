"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useRulesStore } from "./rules-store";

type RuleResult = {
  id: string;
  key: string;
  threshold: number;
  pass: boolean;
  probability: number;
};

// Card/text tone scaled by score: red below 50%, a lighter amber in the 50–70%
// "maybe" band, and green at 70%+.
function fitTone(pct: number) {
  if (pct >= 70) {
    return {
      card: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
      text: "text-emerald-700 dark:text-emerald-400",
    };
  }
  if (pct >= 50) {
    return {
      card: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
      text: "text-amber-700 dark:text-amber-400",
    };
  }
  return {
    card: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-400",
  };
}

// Tracks whether the persisted rules store has rehydrated from localStorage, so
// we don't evaluate against an empty list on the first client render.
function useHydrated() {
  return useSyncExternalStore(
    (cb) => useRulesStore.persist.onFinishHydration(cb),
    () => useRulesStore.persist.hasHydrated(),
    () => false,
  );
}

// Runs the candidate's rules against a job via jev and lists the verdicts.
// Mount with a `key` tied to the job id so switching jobs re-evaluates.
export default function JobRulesEval({ jobId }: { jobId: number }) {
  const rules = useRulesStore((s) => s.rules);
  const hydrated = useHydrated();

  const activeRules = useMemo(
    () => rules.filter((r) => r.key.trim() && r.value.trim()),
    [rules],
  );

  const [results, setResults] = useState<RuleResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || activeRules.length === 0) return;

    const controller = new AbortController();

    fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, rules: activeRules }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to evaluate rules");
        if (!controller.signal.aborted) setResults(data.results as RuleResult[]);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to evaluate rules");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [jobId, activeRules, hydrated]);

  if (!hydrated) return null;

  const hasRules = activeRules.length > 0;

  return (
    <section className="mt-6">
      {!hasRules ? (
        <p className="text-sm text-zinc-500">
          No rules yet.{" "}
          <Link
            href="/rules"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Add some rules
          </Link>{" "}
          to see how this job measures up.
        </p>
      ) : error ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p>
      ) : loading && !results?.length ? (
        <p className="text-sm text-zinc-500">Evaluating rules…</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {results?.map((result) => {
            const pct = Math.round(result.probability * 100);
            const tone = fitTone(pct);
            return (
              <li
                key={result.id}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${tone.card}`}
              >
                <span className={`shrink-0 ${tone.text}`}>
                  {result.pass ? (
                    <IconCheck size={16} stroke={2.5} />
                  ) : (
                    <IconX size={16} stroke={2.5} />
                  )}
                </span>
                <span className="text-sm font-medium">{result.key}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
