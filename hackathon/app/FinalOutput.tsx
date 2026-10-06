"use client";

import { createElement, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, FileText, LoaderCircle, Pencil, Plus, RefreshCw, Save, X } from "lucide-react";
import { extractProfile } from "@/lib/resume-profile";
import { useAgentStore } from "@/lib/store";
import type { GeneratedCV, GeneratedBullet } from "@/lib/types";
import { buildRawResume, useResumeStore } from "./resume/resume-store";

type PdfState = {
  workspaceId: string;
  cv: GeneratedCV;
  rawCV: string;
  url: string | null;
  error: string | null;
};

type EditableCV = GeneratedCV;

export default function FinalOutput({
  jobId,
  job,
}: {
  jobId: number;
  job: { title: string; company: string };
}) {
  const workspaces = useAgentStore((state) => state.workspaces);
  const rawCV = useAgentStore((state) => state.rawCV);
  const bullets = useAgentStore((state) => state.bullets);
  const updateWorkspaceCV = useAgentStore((state) => state.updateWorkspaceCV);
  const openBoardJob = useAgentStore((state) => state.openBoardJob);
  const experiences = useResumeStore((state) => state.experiences);
  const sourceResume = useMemo(() => buildRawResume(experiences), [experiences]);
  const sourceBullets = experiences.flatMap((experience) => experience.bullets).filter((bullet) => bullet.trim());
  const workspace =
    workspaces.find((item) => item.job.sourceId === String(jobId)) ??
    workspaces.find((item) => item.job.title === job.title && item.job.company === job.company);
  const cv = workspace?.cv ?? null;
  const workspaceId = workspace?.id;
  const jobTarget = workspace?.job;
  const busy = workspace?.status === "routing" || workspace?.status === "generating" || workspace?.status === "assessing";
  const [pdf, setPdf] = useState<PdfState | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditableCV | null>(null);

  useEffect(() => {
    if (!workspaceId || !jobTarget || !cv) {
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    Promise.all([import("@react-pdf/renderer"), import("@/components/ResumePdf")])
      .then(async ([renderer, resume]) => {
        const profile = extractProfile(rawCV);
        const document = createElement(resume.ResumePdf, { profile, cv, job: jobTarget });
        const blob = await renderer.pdf(
          document as unknown as Parameters<typeof renderer.pdf>[0],
        ).toBlob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPdf({ workspaceId, cv, rawCV, url: objectUrl, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPdf({
            workspaceId,
            cv,
            rawCV,
            url: null,
            error: error instanceof Error ? error.message : "Could not prepare the PDF.",
          });
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [cv, rawCV, workspaceId, jobTarget]);

  const currentPdf = pdf && pdf.workspaceId === workspace?.id && pdf.cv === cv && pdf.rawCV === rawCV ? pdf : null;
  const fileName = `${safeFilePart(extractProfile(rawCV).name) || "Resume"}_Resume_${safeFilePart(job.company) || "Job"}.pdf`;

  const generate = () => {
    if (busy || sourceBullets.length === 0) return;
    setEditing(false);
    setDraft(null);
    const store = useAgentStore.getState();
    store.setRawCV(sourceResume);
    store.parseFromRaw();
    openBoardJob(String(jobId));
    void useAgentStore.getState().runPipeline();
  };

  const startEditing = () => {
    if (!cv) return;
    setDraft(structuredClone(cv));
    setEditing(true);
  };

  const saveEdits = () => {
    if (!workspace || !draft) return;
    updateWorkspaceCV(workspace.id, draft);
    setEditing(false);
    setDraft(null);
  };

  const regenerateLabel = cv ? "Regenerate resume" : "Generate tailored resume";

  return (
    <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-blue-600 dark:text-blue-400">
            Your application
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight">Final output</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Edit the tailored resume for {job.title} at {job.company}, then preview the finished PDF.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cv && !editing && (
            <button
              type="button"
              onClick={startEditing}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <Pencil className="size-4" /> Edit resume
            </button>
          )}
          {editing && draft && (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(null);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <X className="size-4" /> Cancel
              </button>
              <button
                type="button"
                onClick={saveEdits}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                <Save className="size-4" /> Save edits
              </button>
            </>
          )}
          {cv && !editing && currentPdf?.url && (
            <a
              href={currentPdf.url}
              download={fileName}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <ArrowDownToLine className="size-4" /> Download PDF
            </a>
          )}
          <button
            type="button"
            onClick={generate}
            disabled={busy || sourceBullets.length === 0 || editing}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : cv ? <RefreshCw className="size-4" /> : <FileText className="size-4" />}
            {busy ? generationLabel(workspace?.status) : regenerateLabel}
          </button>
        </div>
      </div>

      {!cv && !busy && sourceBullets.length === 0 && (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">
          Add experience to your source resume before generating a tailored PDF. <Link href="/resume" className="underline underline-offset-2">Open the resume workspace</Link>
        </p>
      )}
      {cv && workspace?.usedMock && (
        <p role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          This resume used the deterministic fallback because no LLM provider completed generation. Check <Link href="/api/health" className="underline underline-offset-2">provider status</Link>, then regenerate.
        </p>
      )}
      {cv && !workspace?.usedMock && workspace?.generationProvider && (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Generated with {providerLabel(workspace.generationProvider.provider)} · {workspace.generationProvider.model}
        </p>
      )}
      {workspace?.error && workspace.status === "error" && (
        <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-400">{workspace.error}</p>
      )}

      {workspace?.relevanceScores && bullets.length > 0 && (
        <details className="mt-4 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Jev relevance scores · {bullets.length} source bullets
          </summary>
          <ul className="mt-3 space-y-2">
            {[...bullets]
              .sort((left, right) => (workspace.relevanceScores?.[right.id] ?? 0) - (workspace.relevanceScores?.[left.id] ?? 0))
              .map((bullet) => (
                <li key={bullet.id} className="flex gap-3 text-sm leading-5 text-zinc-600 dark:text-zinc-300">
                  <span className="w-10 shrink-0 font-medium tabular-nums text-zinc-500">
                    {Math.round((workspace.relevanceScores?.[bullet.id] ?? 0) * 100)}%
                  </span>
                  <span>{bullet.text}</span>
                </li>
              ))}
          </ul>
        </details>
      )}

      {editing && draft && workspace && (
        <CVEditor draft={draft} onChange={setDraft} />
      )}

      {cv ? (
        <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {currentPdf?.url ? (
            <iframe
              key={currentPdf.url}
              src={currentPdf.url}
              title={`${job.title} tailored resume PDF`}
              className="h-[780px] w-full bg-white"
            />
          ) : (
            <div className="flex min-h-56 items-center justify-center gap-3 px-6 text-sm text-zinc-500 dark:text-zinc-400">
              {currentPdf?.error ? <FileText className="size-5" /> : <LoaderCircle className="size-5 animate-spin" />}
              <span>{currentPdf?.error ? `PDF preview could not be prepared: ${currentPdf.error}` : "Building the live PDF preview…"}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5 flex flex-col items-start gap-4 rounded-xl border border-dashed border-zinc-300 bg-white p-6 sm:flex-row sm:items-center dark:border-zinc-700 dark:bg-zinc-950">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
            {busy ? <LoaderCircle className="size-5 animate-spin" /> : <FileText className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {busy ? generationLabel(workspace?.status) : "No tailored resume yet"}
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {busy
                ? "This job’s resume is generating in the background. You can switch jobs while it runs."
                : "Generate a resume for this role. It will stay with this job while you review the rest of the details."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function CVEditor({ draft, onChange }: { draft: EditableCV; onChange: (cv: EditableCV) => void }) {
  const setBullet = (id: string, text: string) =>
    onChange({ ...draft, bullets: draft.bullets.map((bullet) => bullet.id === id ? { ...bullet, text } : bullet) });

  const addBullet = () => {
    const bullet: GeneratedBullet = {
      id: `manual-${Date.now()}`,
      text: "",
      evidenceId: null,
      rationale: "Added by user",
      keywords: [],
    };
    onChange({ ...draft, bullets: [...draft.bullets, bullet] });
  };

  return (
    <div className="mt-5 space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4 sm:p-5 dark:border-blue-900 dark:bg-blue-950/20">
      <div>
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Edit your resume</h4>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Save your changes to refresh the PDF preview below.</p>
      </div>
      <label className="block">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Headline</span>
        <input value={draft.headline} onChange={(event) => onChange({ ...draft, headline: event.target.value })} className={editorField} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Summary</span>
        <textarea value={draft.summary} onChange={(event) => onChange({ ...draft, summary: event.target.value })} rows={4} className={`${editorField} resize-y leading-relaxed`} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Skills <span className="font-normal text-zinc-500">· separate with commas</span></span>
        <textarea
          value={draft.skills.join(", ")}
          onChange={(event) => onChange({ ...draft, skills: event.target.value.split(",").map((skill) => skill.trim()).filter(Boolean) })}
          rows={2}
          className={`${editorField} resize-y`}
        />
      </label>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Experience</span>
          <button type="button" onClick={addBullet} className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-300">
            <Plus className="size-3.5" /> Add bullet
          </button>
        </div>
        {draft.bullets.map((bullet, index) => (
          <div key={bullet.id} className="flex items-start gap-2">
            <span className="pt-2.5 font-mono text-[10px] text-zinc-400">{index + 1}</span>
            <textarea
              value={bullet.text}
              onChange={(event) => setBullet(bullet.id, event.target.value)}
              rows={3}
              aria-label={`Experience bullet ${index + 1}`}
              className={`${editorField} resize-y leading-relaxed`}
            />
            <button
              type="button"
              onClick={() => onChange({ ...draft, bullets: draft.bullets.filter((item) => item.id !== bullet.id) })}
              aria-label={`Remove experience bullet ${index + 1}`}
              className="mt-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const editorField = "mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

function generationLabel(status?: string) {
  if (status === "routing") return "Planning resume…";
  if (status === "assessing") return "Reviewing resume…";
  return "Generating resume…";
}

function providerLabel(provider: string) {
  return ({
    neon: "Neon AI Gateway",
    vercel: "Vercel AI Gateway",
    "openai-compatible": "OpenAI-compatible API",
    lmstudio: "LM Studio",
    opencode: "OpenCode Zen",
    mock: "Deterministic fallback",
  } as Record<string, string>)[provider] ?? provider;
}

function safeFilePart(value: string) {
  return value.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "");
}
