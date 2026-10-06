"use client";

import { useRef, useState } from "react";
import jobs from "@/app/jobs";
import { useAgentStore } from "@/lib/store";
import type { PipelineStatus } from "@/lib/types";
import { useDragReorder } from "./Reorder";

const boardJobs = Object.entries(jobs).map(([id, job]) => ({ id, ...job }));

const STATUS_DOT: Record<PipelineStatus, string> = {
  idle: "bg-zinc-300 dark:bg-zinc-700",
  routing: "bg-blue-500 animate-pulse",
  generating: "bg-blue-500 animate-pulse",
  assessing: "bg-blue-500 animate-pulse",
  done: "bg-emerald-500",
  error: "bg-rose-500",
};

function formatComp([min, max]: [number, number]) {
  const k = (n: number) => `$${Math.round(n / 1000)}K`;
  return `${k(min)} - ${k(max)}`;
}

function Grip() {
  return (
    <svg viewBox="0 0 10 16" className="size-3" fill="currentColor">
      <circle cx="3" cy="3" r="1" />
      <circle cx="7" cy="3" r="1" />
      <circle cx="3" cy="8" r="1" />
      <circle cx="7" cy="8" r="1" />
      <circle cx="3" cy="13" r="1" />
      <circle cx="7" cy="13" r="1" />
    </svg>
  );
}

export function JobTabs() {
  const workspaces = useAgentStore((s) => s.workspaces);
  const activeId = useAgentStore((s) => s.activeId);
  const setActiveId = useAgentStore((s) => s.setActiveId);
  const removeWorkspace = useAgentStore((s) => s.removeWorkspace);
  const addWorkspace = useAgentStore((s) => s.addWorkspace);
  const openBoardJob = useAgentStore((s) => s.openBoardJob);
  const runPipeline = useAgentStore((s) => s.runPipeline);
  const setWorkspaceTabName = useAgentStore((s) => s.setWorkspaceTabName);
  const reorderWorkspaces = useAgentStore((s) => s.reorderWorkspaces);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const cancelRenameOnBlur = useRef(false);

  const { containerRef, dragIndex, overIndex, onPointerDown } = useDragReorder({
    orientation: "horizontal",
    count: workspaces.length,
    onReorder: reorderWorkspaces,
  });

  const active = workspaces.find((w) => w.id === activeId);
  const busy =
    active?.status === "routing" ||
    active?.status === "generating" ||
    active?.status === "assessing";

  return (
    <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-black">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <div ref={containerRef} className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {workspaces.map((w, i) => {
          const isActive = w.id === activeId;
          const label = w.tabName || w.job.title || "Untitled job";
          const isDropTarget = overIndex === i && dragIndex !== i;
          return (
            <div
              key={w.id}
              className={`group relative flex h-8 shrink-0 items-center gap-1 rounded-full border px-1.5 transition-colors ${
                isActive
                  ? "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/50"
                  : "border-transparent bg-zinc-50 hover:border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-900/60 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
              } ${dragIndex === i ? "opacity-40" : ""} ${
                isDropTarget ? "ring-2 ring-blue-400/70 ring-inset" : ""
              }`}
            >
              <button
                onPointerDown={onPointerDown(i)}
                aria-label="Drag to reorder tab"
                title="Drag to reorder"
                className="shrink-0 cursor-grab touch-none rounded-full p-0.5 text-zinc-400 transition hover:bg-white hover:text-zinc-600 active:cursor-grabbing dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <Grip />
              </button>
              {editingId === w.id ? (
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onFocus={(event) => event.currentTarget.select()}
                  onBlur={() => {
                    if (cancelRenameOnBlur.current) {
                      cancelRenameOnBlur.current = false;
                      setEditingId(null);
                      return;
                    }
                    setWorkspaceTabName(w.id, nameDraft.trim() || null);
                    setEditingId(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") {
                      cancelRenameOnBlur.current = true;
                      event.currentTarget.blur();
                    }
                  }}
                  aria-label="Rename job tab"
                  className="w-36 rounded-full border border-blue-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-900 outline-none ring-2 ring-blue-100 dark:border-blue-800 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-blue-950"
                />
              ) : (
                <button
                  onClick={() => setActiveId(w.id)}
                  onDoubleClick={() => {
                    setActiveId(w.id);
                    setNameDraft(label);
                    setEditingId(w.id);
                  }}
                  title={`${w.job.title || "Untitled job"}${w.job.company ? ` · ${w.job.company}` : ""} (double-click to rename)`}
                  className="flex max-w-56 items-center gap-1.5 text-left"
                >
                  <span className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[w.status]}`} />
                  <span className={`max-w-48 truncate text-[11px] font-medium ${isActive ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400"}`}>
                    {label}
                  </span>
                </button>
              )}
              {editingId !== w.id && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(w.id);
                    setNameDraft(label);
                    setEditingId(w.id);
                  }}
                  aria-label={`Rename ${label}`}
                  title="Rename tab"
                  className="shrink-0 rounded-full p-1 text-zinc-400 opacity-100 transition hover:bg-white hover:text-zinc-700 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="m10.8 2.7 2.5 2.5M3 13l2.7-.6 7.7-7.7a1.8 1.8 0 0 0-2.5-2.5l-7.7 7.7L3 13Z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
              {workspaces.length > 1 && (
                <button
                  onClick={() => removeWorkspace(w.id)}
                  aria-label={`Close ${label}`}
                  title="Close tab"
                  className="shrink-0 rounded-full p-1 text-zinc-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-rose-950/50"
                >
                  <svg viewBox="0 0 14 14" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M3 3l8 8M11 3l-8 8" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            className="rounded-full border border-dashed border-zinc-300 px-2.5 py-1.5 text-[11px] font-medium text-zinc-500 transition hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            + Job
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-0 z-20 mt-1 w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
                <div className="border-b border-zinc-200 px-3 py-2 text-[10px] uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  From the team job board
                </div>
                {boardJobs.map((j) => (
                  <button
                    key={j.id}
                    onClick={() => {
                      openBoardJob(j.id);
                      setMenuOpen(false);
                    }}
                    className="block w-full px-3 py-2.5 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <span className="block text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
                      {j.title}
                    </span>
                    <span className="block text-[10px] text-zinc-500 dark:text-zinc-400">
                      {j.company} · {formatComp(j.baseRange)}
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => {
                    addWorkspace();
                    setMenuOpen(false);
                  }}
                  className="block w-full border-t border-zinc-200 px-3 py-2.5 text-left text-[12px] text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                >
                  Blank job (paste your own)
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <button
        onClick={runPipeline}
        disabled={busy}
        className="mb-1 shrink-0 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Running…" : "Run agent"}
      </button>
    </div>
  );
}
