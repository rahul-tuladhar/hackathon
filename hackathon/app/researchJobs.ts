import jobs from "./jobs";
import type { Job } from "@/lib/research";

// Maps a listing from jobs.ts to the shape the research module expects.
// The id must stay stable: it is how Exa runs are matched back to their job.
export function toResearchJob(jobId: number): Job {
  const job = jobs[jobId];
  if (!job) {
    throw new Error(`Unknown job: ${jobId}`);
  }
  return {
    id: String(jobId),
    title: job.title,
    company: job.company,
    description: job.description.trim(),
  };
}

export function allResearchJobs(): Job[] {
  return Object.keys(jobs).map((id) => toResearchJob(Number(id)));
}
