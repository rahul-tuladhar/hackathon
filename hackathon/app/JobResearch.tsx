"use client";

import { useState, useEffect } from "react";
import { getPeopleResearch, type PeopleResearch } from "./actions";
import OutreachPeople from "./OutreachPeople";

const POLL_MS = 5000;

function formatElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Shows the people to reach out to for a job. Research runs on Exa in the
// background (started at server boot), so this polls until the result is ready.
// Mount with a `key` tied to the job id so switching jobs resets state.
export default function JobResearch({ jobId, company }: { jobId: number; company: string }) {
  const [research, setResearch] = useState<PeopleResearch | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = () => {
      getPeopleResearch(jobId)
        .then((result) => {
          if (cancelled) return;
          setResearch(result);
          if (result.state === "queued" || result.state === "running") {
            timer = setTimeout(poll, POLL_MS);
          }
        })
        .catch((err) => {
          if (cancelled) return;
          setResearch({ state: "error", error: err?.message ?? "Failed to research people" });
        });
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  const pending = !research || research.state === "queued" || research.state === "running";

  // Ticks the elapsed-time counter while research is pending.
  useEffect(() => {
    if (!pending) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [pending]);

  return (
    <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold">People to reach out to</h3>
        {pending && <span className="text-sm text-zinc-500">Researching…</span>}
      </div>

      {pending ? (
        <div className="mt-5 rounded-xl border border-dashed border-zinc-300 p-5 text-sm leading-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          <p>
            Our research agent is finding the hiring manager, recruiters and
            team members at {company}, plus details you can mention when you
            reach out. This takes about 3 minutes and runs in the background
            for all jobs at once, so you can browse other jobs in the meantime.
          </p>
          {research && "startedAt" in research && (
            <p className="mt-2 font-medium text-zinc-500">
              {research.state === "running" ? "Running" : "Queued"} for{" "}
              {formatElapsed(now - research.startedAt)}
            </p>
          )}
        </div>
      ) : research.state === "error" ? (
        <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
          {research.error}
        </p>
      ) : research.state === "done" && research.people.length > 0 ? (
        <OutreachPeople jobId={jobId} people={research.people} />
      ) : (
        <p className="mt-4 text-sm text-zinc-500">No people found.</p>
      )}
    </section>
  );
}
