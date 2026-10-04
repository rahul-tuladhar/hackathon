"use client";

import { useEffect } from "react";
import { useActiveWorkspace, useAgentStore } from "@/lib/store";
import { Badge, Dot, type Tone } from "./ui";

export function TopBar() {
  const providers = useAgentStore((s) => s.providers);
  const refreshProviders = useAgentStore((s) => s.refreshProviders);
  const hydrateSample = useAgentStore((s) => s.hydrateSample);
  const clearAll = useAgentStore((s) => s.clearAll);
  const workspace = useActiveWorkspace();

  useEffect(() => {
    refreshProviders();
  }, [refreshProviders]);

  const jevTone: Tone = providers?.jev.available ? "violet" : "rose";
  const llmTone: Tone = providers?.llm.available ? "emerald" : "amber";

  return (
    <header className="z-20 flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-black">
      <div className="min-w-0">
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Tailoring workspace
            </h1>
          </div>
          <p className="max-w-[22rem] truncate text-[11px] text-zinc-500 dark:text-zinc-400">
            {workspace?.job.title
              ? `${workspace.job.title}${workspace.job.company ? ` · ${workspace.job.company}` : ""}`
              : "Choose a target role to begin"}
          </p>
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Badge tone={jevTone}>
          <Dot tone={jevTone} />
          JEV {providers?.jev.transport ?? "…"}
          <span className="text-zinc-400">{providers?.jev.provider ?? ""}</span>
        </Badge>
        <Badge tone={llmTone}>
          <Dot tone={llmTone} />
          LLM {providers?.llm.provider ?? "…"}
          <span className="max-w-[9rem] truncate text-zinc-400">{providers?.llm.model ?? ""}</span>
        </Badge>
        <button
          onClick={hydrateSample}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Sample CV
        </button>
        <button
          onClick={clearAll}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          Reset
        </button>
      </div>
    </header>
  );
}
