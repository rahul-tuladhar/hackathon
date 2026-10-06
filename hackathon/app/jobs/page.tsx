"use client";

import { useState } from "react";
import jobs from "../jobs";

function formatComp([min, max]: [number, number]) {
  const k = (n: number) => `$${Math.round(n / 1000)}K`;
  return `${k(min)} – ${k(max)}`;
}

const jobEntries = Object.entries(jobs);

export default function JobsPage() {
  const [selectedId, setSelectedId] = useState(jobEntries[0]?.[0] ?? null);
  const selected = selectedId ? jobs[Number(selectedId)] : null;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-100">
      {/* Sidebar */}
      <aside className="w-80 shrink-0 overflow-y-auto border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h1 className="text-lg font-semibold">Jobs</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {jobEntries.length} {jobEntries.length === 1 ? "opening" : "openings"}
          </p>
        </div>
        <ul>
          {jobEntries.map(([id, job]) => {
            const isActive = id === selectedId;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(id)}
                  className={`w-full border-b border-zinc-100 px-5 py-4 text-left transition-colors dark:border-zinc-900 ${
                    isActive
                      ? "border-l-2 border-l-blue-600 bg-blue-50 dark:bg-blue-950/40"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  }`}
                >
                  <p className="font-medium leading-snug">{job.title}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {job.company}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
                    {formatComp(job.baseRange)}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Main detail panel */}
      <main className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="mx-auto max-w-3xl px-10 py-10">
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {selected.company}
            </p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">
              {selected.title}
            </h2>
            <p className="mt-3 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              {formatComp(selected.baseRange)} base
            </p>
            <div className="mt-8 whitespace-pre-line text-[15px] leading-7 text-zinc-700 dark:text-zinc-300">
              {selected.description.trim()}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-500">
            Select a job to view details
          </div>
        )}
      </main>
    </div>
  );
}
