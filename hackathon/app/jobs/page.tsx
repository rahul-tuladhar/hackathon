"use client";

import { useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import jobs from "../jobs";
import JobResearch from "../JobResearch";
import JobsResume from "../JobsResume";
import JobRulesEval from "../JobRulesEval";
import JobSummary from "../JobSummary";
import FinalOutput from "../FinalOutput";

function formatComp([min, max]: [number, number]) {
  const k = (n: number) => `$${Math.round(n / 1000)}K`;
  return `${k(min)} – ${k(max)}`;
}

const jobEntries = Object.entries(jobs);

export default function JobsPage() {
  const [selectedId, setSelectedId] = useState(jobEntries[0]?.[0] ?? null);
  const selected = selectedId ? jobs[Number(selectedId)] : null;

  return (
    <div className="flex min-h-0 flex-1 bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-100">
    <Group orientation="horizontal" className="h-full w-full">
      {/* Sidebar */}
      <Panel
        defaultSize="320px"
        minSize="240px"
        maxSize="480px"
        className="overflow-y-auto no-scrollbar"
      >
        <aside className="h-full">
        <ul className="flex flex-col gap-2 p-3">
          {jobEntries.map(([id, job]) => {
            const isActive = id === selectedId;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    isActive
                      ? "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40"
                      : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
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
      </Panel>

      <Separator className="w-px bg-zinc-200 dark:bg-zinc-800" />

      {/* Main detail panel */}
      <Panel className="overflow-y-auto">
      <main className="h-full">
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
            <JobSummary key={`summary-${selectedId}`} jobId={Number(selectedId)} />

            <JobRulesEval key={`rules-${selectedId}`} jobId={Number(selectedId)} />

            <JobsResume key={`resume-${selectedId}`} jobId={Number(selectedId)} />

            <FinalOutput key={`final-output-${selectedId}`} jobId={Number(selectedId)} job={selected} />

            <JobResearch key={selectedId} jobId={Number(selectedId)} company={selected.company} />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-500">
            Select a job to view details
          </div>
        )}
      </main>
      </Panel>
    </Group>
    </div>
  );
}
