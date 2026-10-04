"use client";

import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { extractProfile } from "@/lib/resume-profile";
import { useAgentStore } from "@/lib/store";

export default function JobsResume({ jobId }: { jobId: number }) {
  const rawCV = useAgentStore((s) => s.rawCV);
  const bullets = useAgentStore((s) => s.bullets);
  const workspaces = useAgentStore((s) => s.workspaces);
  const loadResume = useAgentStore((s) => s.loadResume);
  const openBoardJob = useAgentStore((s) => s.openBoardJob);
  const [pdfBusy, setPdfBusy] = useState(false);
  const generating = useRef(false);
  const workspace = useMemo(
    () => workspaces.find((item) => item.job.sourceId === String(jobId)),
    [workspaces, jobId],
  );
  const busy = workspace && ["routing", "generating", "assessing"].includes(workspace.status);

  useEffect(() => {
    if (!rawCV) loadResume();
  }, [rawCV, loadResume]);

  const generate = () => {
    if (generating.current || !rawCV || !bullets.length) return;
    generating.current = true;
    openBoardJob(String(jobId));
    void useAgentStore.getState().runPipeline().finally(() => { generating.current = false; });
  };

  const download = async () => {
    if (!workspace?.cv || !rawCV) return;
    setPdfBusy(true);
    try {
      const [{ pdf }, { ResumePdf }] = await Promise.all([
        import("@react-pdf/renderer"), import("@/components/ResumePdf"),
      ]);
      const profile = extractProfile(rawCV);
      const blob = await pdf(createElement(ResumePdf, { profile, cv: workspace.cv, job: workspace.job }) as never).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${profile.name.replace(/[^\p{L}\p{N}]+/gu, "_")}_Resume_${workspace.job.company.replace(/[^\p{L}\p{N}]+/gu, "_")}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <section className="mt-8 border-t border-zinc-200 pt-7 dark:border-zinc-800" aria-labelledby="tailored-resume-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="tailored-resume-title" className="text-lg font-semibold">Tailored one-page resume</h3>
          <p className="mt-1 text-sm text-zinc-500">Jev ranks each source bullet by relevance. Lower-ranked evidence stays if it fits.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={generate} disabled={!rawCV || !bullets.length || Boolean(busy)} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">
            {busy ? "Generating…" : workspace?.cv ? "Regenerate resume" : "Generate resume"}
          </button>
          {workspace?.cv && <button type="button" onClick={download} disabled={pdfBusy} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700">{pdfBusy ? "Building PDF…" : "Download PDF"}</button>}
        </div>
      </div>
      {!rawCV && <p className="mt-4 text-sm text-zinc-500">Loading your resume…</p>}
      {workspace?.error && <p role="alert" className="mt-4 text-sm text-rose-700">{workspace.error}</p>}
      {workspace?.cv && <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h4 className="font-semibold">{workspace.cv.headline}</h4>
        <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{workspace.cv.summary}</p>
        <ul className="mt-4 space-y-2">
          {workspace.cv.bullets.map((bullet) => {
            const probability = bullet.evidenceId ? workspace.relevanceScores?.[bullet.evidenceId] : undefined;
            return <li key={bullet.id} className="flex gap-2 text-sm leading-5"><span className="text-zinc-400">•</span><span className="flex-1">{bullet.text}</span>{probability != null && <span className="shrink-0 text-xs text-zinc-500" title="Jev relevance probability">{Math.round(probability * 100)}%</span>}</li>;
          })}
        </ul>
        <p className="mt-3 text-xs text-zinc-500">{workspace.cv.bullets.length} bullets · US Letter PDF · source wording and facts retained</p>
      </div>}
    </section>
  );
}
