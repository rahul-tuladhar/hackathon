import { create } from "zustand";
import { persist } from "zustand/middleware";

// A rule is a key/value pair with a fit threshold:
//   key       = what you're evaluating
//   value     = what makes it a good fit
//   threshold = minimum fit % (0-100) the job must hit to count as a fit
export type Rule = {
  id: string;
  key: string;
  value: string;
  threshold: number;
};

export const DEFAULT_THRESHOLD = 50;

type RulesState = {
  rules: Rule[];
  addRule: () => void;
  updateRule: (
    id: string,
    patch: Partial<Pick<Rule, "key" | "value" | "threshold">>,
  ) => void;
  removeRule: (id: string) => void;
};

export const useRulesStore = create<RulesState>()(
  persist(
    (set) => ({
      rules: [],
      addRule: () =>
        set((state) => ({
          rules: [
            ...state.rules,
            {
              id: crypto.randomUUID(),
              key: "",
              value: "",
              threshold: DEFAULT_THRESHOLD,
            },
          ],
        })),
      updateRule: (id, patch) =>
        set((state) => ({
          rules: state.rules.map((rule) =>
            rule.id === id ? { ...rule, ...patch } : rule,
          ),
        })),
      removeRule: (id) =>
        set((state) => ({
          rules: state.rules.filter((rule) => rule.id !== id),
        })),
    }),
    {
      name: "hirehand-rules",
      version: 1,
      // Backfill the threshold for rules saved before it existed.
      migrate: (persisted) => {
        const state = persisted as RulesState | undefined;
        if (state?.rules) {
          state.rules = state.rules.map((rule) => ({
            ...rule,
            threshold: rule.threshold ?? DEFAULT_THRESHOLD,
          }));
        }
        return state as RulesState;
      },
    },
  ),
);
