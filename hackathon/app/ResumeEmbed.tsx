"use client";

import { useEffect, useMemo, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { getDocumentProxy } from "unpdf";
import Resume from "./tmp/Resume";
import {
  buildResumeData,
  useResumeStore,
  type Experience,
} from "./tmp/resume-store";

type Scores = Record<string, number[]>;

type Fitted = {
  url: string;
  kept: number;
  total: number;
  pages: number;
};

// Keep the `keep` highest-scoring bullets across all experiences (every
// experience keeps at least its best bullet), preserving original order.
function trimToTop(experiences: Experience[], scores: Scores, keep: number) {
  const ranked = experiences
    .flatMap((exp) =>
      exp.bullets.map((_, i) => ({
        expId: exp.id,
        index: i,
        score: scores[exp.id]?.[i] ?? 0,
      })),
    )
    .sort((a, b) => b.score - a.score);

  const kept = new Set<string>();
  for (const exp of experiences) {
    const best = ranked.find((r) => r.expId === exp.id);
    if (best) kept.add(`${best.expId}:${best.index}`);
  }
  for (const r of ranked) {
    if (kept.size >= keep) break;
    kept.add(`${r.expId}:${r.index}`);
  }

  return experiences.map((exp) => ({
    ...exp,
    bullets: exp.bullets.filter((_, i) => kept.has(`${exp.id}:${i}`)),
  }));
}

async function renderPdf(experiences: Experience[]) {
  const blob = await pdf(<Resume data={buildResumeData(experiences)} />).toBlob();
  const doc = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()));
  return { blob, pages: doc.numPages };
}

// Renders the resume tailored to a job: jev scores each bullet's relevance, then
// the least relevant bullets are dropped until the PDF fits on one page.
export default function ResumeEmbed({ jobId }: { jobId: number }) {
  const storeExperiences = useResumeStore((s) => s.experiences);
  const experiences = useMemo(
    () =>
      storeExperiences
        .filter((e) => e.jobTitle.trim() || e.company.trim())
        .map((e) => ({ ...e, bullets: e.bullets.filter((b) => b.trim()) })),
    [storeExperiences],
  );

  const [scores, setScores] = useState<Scores | null>(null);
  const [fitted, setFitted] = useState<Fitted | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. Score every bullet against the job with jev.
  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/resume/relevance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId,
        experiences: experiences.map(({ id, jobTitle, company, bullets }) => ({
          id,
          jobTitle,
          company,
          bullets,
        })),
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to score bullets");
        if (!controller.signal.aborted) setScores(data.scores as Scores);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to score bullets");
      });

    return () => controller.abort();
  }, [jobId, experiences]);

  // 2. Binary-search the largest number of top bullets that fits on one page.
  useEffect(() => {
    if (!scores) return;
    let cancelled = false;

    (async () => {
      const total = experiences.reduce((n, e) => n + e.bullets.length, 0);
      let lo = 0;
      let hi = total;
      let best = await renderPdf(trimToTop(experiences, scores, 0));
      let bestKeep = 0;

      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const attempt = await renderPdf(trimToTop(experiences, scores, mid));
        if (cancelled) return;
        if (attempt.pages <= 1) {
          lo = mid;
          best = attempt;
          bestKeep = mid;
        } else {
          hi = mid - 1;
        }
      }

      if (cancelled) return;
      const kept = trimToTop(experiences, scores, bestKeep).reduce(
        (n, e) => n + e.bullets.length,
        0,
      );
      setFitted((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return {
          url: URL.createObjectURL(best.blob),
          kept,
          total,
          pages: best.pages,
        };
      });
    })().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Failed to render resume");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [scores, experiences]);

  const status = error
    ? error
    : !scores
      ? "Scoring bullets with jev…"
      : !fitted
        ? "Fitting to one page…"
        : `Kept the ${fitted.kept} most relevant of ${fitted.total} bullets · ${fitted.pages} page${fitted.pages === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-col gap-2">
      <p
        className={`text-sm ${error ? "text-amber-600 dark:text-amber-400" : "text-zinc-500"}`}
      >
        {status}
      </p>
      <div className="h-[560px] w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        {fitted && (
          <iframe
            title="Resume"
            src={`${fitted.url}#toolbar=0&navpanes=0&view=FitH`}
            className="h-full w-full border-0"
          />
        )}
      </div>
    </div>
  );
}
