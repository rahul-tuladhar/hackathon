"use client";

import { useState, useEffect } from "react";
import Markdown from "./Markdown";

// Streams a job summary from /api/summarize so text appears as it's generated.
// Mount with a `key` tied to the job id so selecting a different job remounts
// and re-summarizes.
export default function JobSummary({ jobId }: { jobId: number }) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          setError(await res.text());
          setLoading(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          setSummary((prev) => prev + decoder.decode(value, { stream: true }));
          setLoading(false);
        }
        setLoading(false);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to summarize");
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [jobId]);

  return (
    <div className="mt-6">
      {error ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p>
      ) : summary ? (
        <div className="text-[15px] leading-7 text-zinc-700 dark:text-zinc-300">
          <Markdown>{summary}</Markdown>
        </div>
      ) : (
        loading && <p className="text-sm text-zinc-500">Summarizing…</p>
      )}
    </div>
  );
}
