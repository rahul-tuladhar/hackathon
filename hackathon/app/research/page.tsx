import { normalizeJobs } from "@/lib/research";
import jobs from "../jobs";
import ResearchView from "./research-view";

export default function ResearchPage() {
  const list = normalizeJobs(Object.entries(jobs).map(([id, job]) => ({ ...job, id })));
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-4 py-10">
      <h1 className="text-2xl font-semibold">Company and contact research</h1>
      <p className="mt-1 text-sm text-zinc-500">Researches each job&apos;s company and finds the people worth contacting, using Exa.</p>
      <ResearchView jobs={list} />
    </main>
  );
}
