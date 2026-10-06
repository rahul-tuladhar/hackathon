import type { AgentRun } from "exa-js";
import { exa } from "./exa";
import { contactsFromRun, isCurrentRun, peopleRunParams, runJobId } from "./people";
import type { Contact, Job } from "./types";

// People research runs on Exa's servers, independent of our server or any user.
// We only create one run per job and later look it up by job id. Exa keeps the
// finished runs, so they act as the store for now (a database comes later).

export type PeopleStatus =
  | { state: "queued"; startedAt: number }
  | { state: "running"; startedAt: number }
  | { state: "done"; contacts: Contact[] }
  | { state: "error"; error: string };

type Store = {
  // jobId -> runId, so we don't list all runs on every status check.
  runIds: Map<string, string>;
  // Dedupes concurrent creates for the same job within this process.
  creating: Map<string, Promise<AgentRun>>;
  // runId -> parsed contacts (parsing checks photo URLs, so only do it once).
  contacts: Map<string, Contact[]>;
};

const initialStore: Store = { runIds: new Map(), creating: new Map(), contacts: new Map() };
const store = ((globalThis as { __peopleRuns?: Store }).__peopleRuns ??= initialStore);

const MAX_RUNS_SCANNED = 500;

function usable(run: AgentRun) {
  return run.status !== "failed" && run.status !== "cancelled" && isCurrentRun(run);
}

// Newest usable run per job id, from the runs stored at Exa.
async function existingRunsByJob(): Promise<Map<string, AgentRun>> {
  const byJob = new Map<string, AgentRun>();
  let scanned = 0;
  for await (const run of exa().agent.runs.listAll({ limit: 100 })) {
    const jobId = runJobId(run);
    const current = jobId ? byJob.get(jobId) : undefined;
    if (jobId && usable(run) && (!current || (run.createdAt ?? "") > (current.createdAt ?? ""))) {
      byJob.set(jobId, run);
    }
    if (++scanned >= MAX_RUNS_SCANNED) break;
  }
  return byJob;
}

async function createRun(job: Job): Promise<AgentRun> {
  const pending = store.creating.get(job.id);
  if (pending) return pending;

  const promise = exa()
    .agent.runs.create(peopleRunParams(job))
    .then((run) => {
      store.runIds.set(job.id, run.id);
      console.log(`[research] started people run ${run.id} for ${job.company} / ${job.title}`);
      return run;
    })
    .finally(() => store.creating.delete(job.id));
  store.creating.set(job.id, promise);
  return promise;
}

// Returns the job's current run, creating one if the job has none (or only failed ones).
export async function ensurePeopleRun(job: Job, known?: Map<string, AgentRun>): Promise<AgentRun> {
  const runId = store.runIds.get(job.id);
  if (runId) {
    const run = await exa().agent.runs.get(runId);
    if (usable(run)) return run;
  }

  const pending = store.creating.get(job.id);
  if (pending) return pending;

  const existing = (known ?? (await existingRunsByJob())).get(job.id);
  if (existing) {
    store.runIds.set(job.id, existing.id);
    return existing;
  }
  return createRun(job);
}

// Makes sure every job has a run at Exa. Cheap: one listing plus one create per missing job.
// Sequential, because Exa rate-limits requests (10/s) and creates are quick anyway.
export async function startAllPeopleRuns(jobs: Job[]) {
  const known = await existingRunsByJob();
  for (const job of jobs) {
    try {
      await ensurePeopleRun(job, known);
    } catch (err) {
      console.error(`[research] could not start people run for ${job.company}:`, err);
    }
  }
}

export async function getPeopleStatus(job: Job): Promise<PeopleStatus> {
  try {
    const run = await ensurePeopleRun(job);
    const startedAt = run.createdAt ? Date.parse(run.createdAt) : Date.now();
    if (run.status === "queued") return { state: "queued", startedAt };
    if (run.status === "running") return { state: "running", startedAt };

    let contacts = store.contacts.get(run.id);
    if (!contacts) {
      contacts = (await contactsFromRun(run)).contacts;
      store.contacts.set(run.id, contacts);
    }
    return { state: "done", contacts };
  } catch (err) {
    return { state: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

// Blocking variant for callers that want the finished result (e.g. /api/research).
export async function researchPeople(job: Job): Promise<{ contacts: Contact[]; cost: number }> {
  let run = await ensurePeopleRun(job);
  if (run.status === "queued" || run.status === "running") {
    run = await exa().agent.runs.pollUntilFinished(run.id, { pollInterval: 4000, timeoutMs: 280_000 });
  }
  return contactsFromRun(run);
}
