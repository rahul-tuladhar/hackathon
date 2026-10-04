"use client";

import { useRef, useState } from "react";
import { activeNodeKey, FLOW_NODES, nodeState, type NodeStatus } from "@/lib/pipeline";
import { useActiveWorkspace, useAgentStore } from "@/lib/store";

const STEP_LABELS: Record<string, string> = {
  bullets: "Source bullets",
  jev: "Plan the work",
  research: "Company research",
  generate: "Tailor the CV",
  assess: "Score quality",
  output: "Ready to export",
};

const STEP_DESTINATION: Record<string, string> = {
  bullets: "resume",
  jev: "pipeline",
  research: "pipeline",
  generate: "cv",
  assess: "quality",
  output: "cv",
};

const DOT: Record<NodeStatus, string> = {
  done: "bg-emerald-500",
  running: "bg-blue-600 motion-safe:animate-pulse",
  skipped: "bg-zinc-400 dark:bg-zinc-600",
  idle: "bg-zinc-300 dark:bg-zinc-700",
  error: "bg-rose-500",
};

const STATE_LABEL: Record<NodeStatus, string> = {
  done: "Done",
  running: "Working",
  skipped: "Skipped",
  idle: "Waiting",
  error: "Failed",
};

export function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function ContentsRail() {
  const ws = useActiveWorkspace();
  const bullets = useAgentStore((s) => s.bullets);
  const sampleLabel = useAgentStore((s) => s.sampleLabel);
  const uploadResume = useAgentStore((s) => s.uploadResume);
  const parseFromRaw = useAgentStore((s) => s.parseFromRaw);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = bullets.filter((b) => b.selected).length;
  const currentStep = activeNodeKey(ws);
  const states = FLOW_NODES.map((node) => ({
    node,
    state: nodeState(node.key, ws, selected),
  }));
  const completed = states.filter(
    ({ state }) => state.status === "done" || state.status === "skipped",
  ).length;
  const active = states.find(({ state }) => state.status === "running");
  const summary = ws.status === "error"
    ? "Step needs attention"
    : active
      ? `${STEP_LABELS[active.node.key]} in progress`
      : ws.status === "done"
        ? "All steps complete"
        : ws.status === "idle"
          ? selected > 0 && ws.job.description.trim()
            ? "Ready to tailor"
            : "Add source bullets and a target job"
          : `${completed} of ${FLOW_NODES.length} steps complete`;
  const progress = (completed / FLOW_NODES.length) * 100;

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto border-r border-zinc-200 bg-white px-4 py-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          Pipeline
        </div>
        <div className="text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
          {completed}/{FLOW_NODES.length}
        </div>
      </div>

      <div className="mb-2 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p aria-live="polite" className="mb-3 min-h-4 text-[10px] text-zinc-500 dark:text-zinc-400">
        {summary}
      </p>

      <nav aria-label="Pipeline steps" className="space-y-0.5">
        {states.map(({ node, state }, i) => {
          const isCurrent = node.key === currentStep && (ws.status !== "idle" || state.status === "running");
          const detail = state.status === "running" || state.status === "error"
            ? state.lines[0]
            : null;

          return (
            <button
              key={node.key}
              type="button"
              onClick={() => scrollToSection(STEP_DESTINATION[node.key])}
              aria-current={isCurrent ? "step" : undefined}
              className={`group flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                isCurrent ? "bg-blue-50/70 dark:bg-blue-950/20" : ""
              }`}
            >
              <span className="relative flex w-4 shrink-0 justify-center pt-1">
                {i < states.length - 1 && (
                  <span className="absolute left-1/2 top-3 h-[calc(100%_+_13px)] w-px -translate-x-1/2 bg-zinc-200 dark:bg-zinc-800" />
                )}
                <span className={`relative size-2 rounded-full ring-2 ring-white dark:ring-zinc-950 ${DOT[state.status]}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-1">
                  <span className={`truncate text-[11px] font-medium ${
                    isCurrent ? "text-blue-700 dark:text-blue-300" : "text-zinc-700 dark:text-zinc-300"
                  }`}>
                    {STEP_LABELS[node.key] ?? node.title}
                  </span>
                  <span className={`shrink-0 text-[9px] ${
                    state.status === "running" ? "font-semibold text-blue-600 dark:text-blue-400" :
                    state.status === "error" ? "font-semibold text-rose-600 dark:text-rose-400" :
                    state.status === "done" ? "text-emerald-600 dark:text-emerald-500" :
                    "text-zinc-400 dark:text-zinc-600"
                  }`}>
                    {STATE_LABEL[state.status]}
                  </span>
                </span>
                {detail && (
                  <span className="mt-0.5 block line-clamp-2 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                    {detail}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          Source
        </div>
        <p
          className="mb-1 truncate text-[11px] text-zinc-600 dark:text-zinc-400"
          title={sampleLabel ?? "No resume loaded"}
        >
          {sampleLabel ?? "No resume loaded"}
        </p>
        <p className="mb-3 text-[11px] text-zinc-400 dark:text-zinc-600">
          {selected}/{bullets.length} bullets in play
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,.markdown,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              await uploadResume(file);
            } finally {
              setBusy(false);
              if (fileRef.current) fileRef.current.value = "";
            }
          }}
        />
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex-1 rounded-lg bg-blue-600 px-2 py-1.5 text-[11px] font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Parsing…" : "Upload"}
          </button>
          <button
            onClick={parseFromRaw}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Parse
          </button>
        </div>
      </div>
    </aside>
  );
}
