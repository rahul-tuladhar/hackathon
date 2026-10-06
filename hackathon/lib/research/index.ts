import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { researchCompany } from "./company";
import { researchPeople } from "./people-runs";
import type { Job, JobResearch } from "./types";

export { getPeopleStatus, startAllPeopleRuns, type PeopleStatus } from "./people-runs";
export { normalizeJob, normalizeJobs } from "./jobs";
export type * from "./types";

// Disk cache so re-running the demo does not burn Exa credits.
// Vercel's filesystem is read-only apart from the (per-instance) temp dir.
const CACHE_DIR = path.join(process.env.VERCEL ? tmpdir() : process.cwd(), ".cache", "research");

function cacheFile(job: Job) {
  const slug = `${job.company}-${job.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);
  return path.join(CACHE_DIR, `${slug}-${job.id}.json`);
}

export async function getCachedResearch(job: Job): Promise<JobResearch | undefined> {
  try {
    return JSON.parse(await readFile(cacheFile(job), "utf8")) as JobResearch;
  } catch {
    return undefined;
  }
}

async function writeCache(result: JobResearch) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cacheFile(result.job), JSON.stringify(result, null, 2));
}

export async function researchJob(job: Job, opts: { refresh?: boolean } = {}): Promise<JobResearch> {
  if (!opts.refresh) {
    const cached = await getCachedResearch(job);
    if (cached) return cached;
  }

  const [company, people] = await Promise.all([researchCompany(job), researchPeople(job)]);

  const result: JobResearch = {
    job,
    company: company.company,
    contacts: people.contacts,
    researchedAt: new Date().toISOString(),
    costDollars: Number((company.cost + people.cost).toFixed(4)),
  };
  await writeCache(result);
  return result;
}

export async function researchJobs(jobs: Job[], opts: { refresh?: boolean; concurrency?: number } = {}) {
  const results: (JobResearch | { job: Job; error: string })[] = new Array(jobs.length);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++;
      try {
        results[i] = await researchJob(jobs[i], opts);
      } catch (err) {
        results[i] = { job: jobs[i], error: err instanceof Error ? err.message : String(err) };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 3, jobs.length) }, worker));
  return results;
}
