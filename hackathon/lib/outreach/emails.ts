import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { contactKey } from "./agentmail";

// Outreach emails as written in our UI, one file per job, keyed by contact.
// This is where edits live; AgentMail only gets a copy when the user drafts it.
// Vercel's filesystem is read-only apart from the (per-instance) temp dir.
const DIR = path.join(process.env.VERCEL ? tmpdir() : process.cwd(), ".cache", "outreach");

export type StoredEmail = {
  subject: string;
  text: string;
  // The AgentMail draft and what was last pushed to it, to tell whether there are unsaved edits.
  draft?: { id: string; subject: string; text: string };
  // When it was last sent to our own inbox (ISO time).
  sentAt?: string;
};

type JobEmails = Record<string, StoredEmail>;

const file = (jobId: number) => path.join(DIR, `job-${jobId}.json`);

// Parallel writes for one job are serialized so they don't overwrite each other.
const queues = new Map<number, Promise<unknown>>();

async function read(jobId: number): Promise<JobEmails> {
  try {
    return JSON.parse(await readFile(file(jobId), "utf8")) as JobEmails;
  } catch {
    return {};
  }
}

export async function getStoredEmails(jobId: number): Promise<Record<string, StoredEmail>> {
  await queues.get(jobId);
  return read(jobId);
}

export function updateStoredEmail(
  jobId: number,
  profileUrl: string,
  update: (current: StoredEmail | undefined) => StoredEmail,
): Promise<StoredEmail> {
  const next = (queues.get(jobId) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const emails = await read(jobId);
    const key = contactKey(profileUrl);
    emails[key] = update(emails[key]);
    await mkdir(DIR, { recursive: true });
    await writeFile(file(jobId), JSON.stringify(emails, null, 2));
    return emails[key];
  });
  queues.set(jobId, next);
  return next;
}
