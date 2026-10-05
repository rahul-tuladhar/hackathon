"use client";

import { useEffect, useMemo, useState } from "react";
import { usePDF } from "@react-pdf/renderer";
import { getDocumentProxy } from "unpdf";
import Resume from "./Resume";
import { buildResumeData, useResumeStore } from "./resume-store";

export default function ResumePreview() {
  const experiences = useResumeStore((s) => s.experiences);
  const resume = useMemo(() => buildResumeData(experiences), [experiences]);

  const [instance, update] = usePDF({ document: <Resume data={resume} /> });
  const [pages, setPages] = useState<number | null>(null);

  // Re-render the PDF whenever the resume changes.
  useEffect(() => {
    update(<Resume data={resume} />);
  }, [resume, update]);

  // Read the page count from the generated blob via pdf.js (unpdf).
  useEffect(() => {
    if (!instance.blob) return;
    let cancelled = false;
    (async () => {
      const bytes = new Uint8Array(await instance.blob!.arrayBuffer());
      const doc = await getDocumentProxy(bytes);
      if (!cancelled) setPages(doc.numPages);
    })();
    return () => {
      cancelled = true;
    };
  }, [instance.blob]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="shrink-0 border-b border-zinc-200 px-4 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        {pages == null
          ? "Measuring…"
          : `${pages} page${pages === 1 ? "" : "s"}`}
      </div>
      <div className="min-h-0 flex-1">
        {instance.url && (
          <iframe
            title="Resume preview"
            src={`${instance.url}#toolbar=0&navpanes=0&view=FitH`}
            className="h-full w-full border-0"
          />
        )}
      </div>
    </div>
  );
}
