"use client";

import { useSyncExternalStore } from "react";
import { IconX } from "@tabler/icons-react";
import { useRulesStore } from "../rules-store";

// Tracks whether the persisted store has rehydrated from localStorage.
// useSyncExternalStore keeps SSR and the first client render in sync, avoiding
// a hydration mismatch when there are already-saved rules.
function useHydrated() {
  return useSyncExternalStore(
    (cb) => useRulesStore.persist.onFinishHydration(cb),
    () => useRulesStore.persist.hasHydrated(),
    () => false,
  );
}

export default function RulesEditor() {
  const rules = useRulesStore((s) => s.rules);
  const addRule = useRulesStore((s) => s.addRule);
  const updateRule = useRulesStore((s) => s.updateRule);
  const removeRule = useRulesStore((s) => s.removeRule);

  const hydrated = useHydrated();
  if (!hydrated) return null;

  return (
    <div className="mt-6">
      {rules.length === 0 && (
        <p className="text-sm text-zinc-500">
          No rules yet. Add one to describe what you care about in a job.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="relative rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
          >
          <button
            type="button"
            onClick={() => removeRule(rule.id)}
            aria-label="Delete rule"
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            <IconX size={18} stroke={1.5} />
          </button>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              What you&apos;re evaluating
            </span>
            <input
              type="text"
              value={rule.key}
              onChange={(e) => updateRule(rule.id, { key: e.target.value })}
              placeholder="e.g. Compensation"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              What makes it a good fit
            </span>
            <textarea
              value={rule.value}
              onChange={(e) => updateRule(rule.id, { value: e.target.value })}
              placeholder="e.g. Base salary above $200k, meaningful equity"
              rows={3}
              className="mt-1 w-full resize-y rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700"
            />
          </label>

          <div className="mt-4 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span>Counts as a fit at</span>
            <input
              type="number"
              min={0}
              max={100}
              value={rule.threshold}
              onChange={(e) =>
                updateRule(rule.id, {
                  threshold: Math.max(
                    0,
                    Math.min(100, Math.round(Number(e.target.value) || 0)),
                  ),
                })
              }
              className="w-16 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm tabular-nums outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700"
            />
            <span>% fit or higher</span>
          </div>
        </div>
        ))}
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={addRule}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Add rule
        </button>
      </div>
    </div>
  );
}
