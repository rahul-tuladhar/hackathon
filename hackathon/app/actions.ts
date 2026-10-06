"use server";

import { getPeopleStatus } from "@/lib/research";
import type { Contact } from "@/lib/research";
import { contactKey, findOutreachDraft, inboxId, saveOutreachDraft, sendOutreachToInbox } from "@/lib/outreach/agentmail";
import { getStoredEmails, updateStoredEmail, type StoredEmail } from "@/lib/outreach/emails";
import { writeOutreachEmail } from "./outreach";
import { toResearchJob } from "./researchJobs";

export type PersonProfile = {
  name: string;
  profilePicUrl: string;
  jobTitle: string;
  // Not every person has a findable work email; fall back to profileUrl.
  email?: string;
  profileUrl: string;
  description: string;
};

// Placeholder avatar with the person's initials when no profile photo is found.
function initialsAvatar(name: string) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="#e4e4e7"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#52525b">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export type PeopleResearch =
  | { state: "queued" | "running"; startedAt: number }
  | { state: "done"; people: PersonProfile[] }
  | { state: "error"; error: string };

// Polled by the people section. The research itself runs on Exa, started at
// server boot (instrumentation.ts) or here if the job has no run yet.
export async function getPeopleResearch(jobId: number): Promise<PeopleResearch> {
  const status = await getPeopleStatus(toResearchJob(jobId));
  if (status.state !== "done") return status;

  // Write everyone's email as soon as they're found, so it's ready when the user looks.
  ensureOutreachEmails(jobId, status.contacts).catch((err) => console.error("[outreach] could not write emails:", err));

  return {
    state: "done",
    people: status.contacts.map((c) => ({
      name: c.name,
      profilePicUrl: c.photoUrl ?? initialsAvatar(c.name),
      jobTitle: c.title ?? "",
      email: c.email,
      profileUrl: c.profileUrl,
      description: [c.reason, c.hooks].filter(Boolean).join(" "),
    })),
  };
}

export type OutreachState = {
  inbox: string;
};

async function doneContacts(jobId: number) {
  const status = await getPeopleStatus(toResearchJob(jobId));
  if (status.state !== "done") throw new Error("People research for this job hasn't finished yet");
  return status.contacts;
}

export async function getOutreachState(): Promise<OutreachState> {
  return { inbox: inboxId() };
}

export type OutreachEmail = {
  subject: string;
  text: string;
  // Whether it's in the AgentMail inbox, and whether it was edited since.
  drafted: boolean;
  changed: boolean;
  sentAt?: string;
};

function toOutreachEmail(e: StoredEmail): OutreachEmail {
  return {
    subject: e.subject,
    text: e.text,
    drafted: Boolean(e.draft),
    changed: Boolean(e.draft) && (e.draft!.subject !== e.subject || e.draft!.text !== e.text),
    sentAt: e.sentAt,
  };
}

// Writing is an LLM call, so concurrent requests for the same contact share one.
const writing = new Map<string, Promise<StoredEmail>>();

// Picks up a draft already in AgentMail (made before emails were stored here), else writes a new email.
function ensureOutreachEmail(jobId: number, contact: Contact, stored?: StoredEmail): Promise<StoredEmail> {
  if (stored) return Promise.resolve(stored);
  const key = `${jobId}:${contactKey(contact.profileUrl)}`;
  let pending = writing.get(key);
  if (!pending) {
    pending = (async () => {
      const existing = await findOutreachDraft(String(jobId), contact.profileUrl).catch(() => undefined);
      const email = existing ?? (await writeOutreachEmail(jobId, contact));
      return updateStoredEmail(jobId, contact.profileUrl, (current) => current ?? { ...email, draft: existing });
    })().finally(() => writing.delete(key));
    writing.set(key, pending);
  }
  return pending;
}

async function ensureOutreachEmails(jobId: number, contacts: Contact[]) {
  const stored = await getStoredEmails(jobId);
  return Promise.allSettled(contacts.map((c) => ensureOutreachEmail(jobId, c, stored[contactKey(c.profileUrl)])));
}

// Every contact's email for this job, keyed by profile URL; writes any that are missing.
export async function getOutreachEmails(jobId: number): Promise<Record<string, OutreachEmail | { error: string }>> {
  const contacts = await doneContacts(jobId);
  const results = await ensureOutreachEmails(jobId, contacts);
  return Object.fromEntries(
    contacts.map((c, i) => {
      const r = results[i];
      return [
        c.profileUrl,
        r.status === "fulfilled"
          ? toOutreachEmail(r.value)
          : { error: r.reason instanceof Error ? r.reason.message : String(r.reason) },
      ];
    }),
  );
}

// Saves edits in our store only; the AgentMail draft changes when the user drafts again.
export async function saveOutreachEmail(jobId: number, profileUrl: string, subject: string, text: string) {
  const saved = await updateStoredEmail(jobId, profileUrl, (current) => ({ ...current, subject, text }));
  return toOutreachEmail(saved);
}

// Only researched contacts of this job can have outreach emails.
async function findContact(jobId: number, profileUrl: string) {
  const contact = (await doneContacts(jobId)).find((c) => c.profileUrl === profileUrl);
  if (!contact) throw new Error("Unknown contact for this job");
}

// Puts the email into the AgentMail inbox as a draft, or updates the contact's draft
// there. Drafts are never sent (see lib/outreach/agentmail.ts).
export async function draftOutreachEmail(jobId: number, profileUrl: string, subject: string, text: string) {
  await findContact(jobId, profileUrl);
  const stored = (await getStoredEmails(jobId))[contactKey(profileUrl)];
  const draftId = stored?.draft?.id ?? (await findOutreachDraft(String(jobId), profileUrl))?.id;
  const draft = await saveOutreachDraft(
    {
      jobId: String(jobId),
      profileUrl,
      subject,
      text,
    },
    draftId,
  );
  const saved = await updateStoredEmail(jobId, profileUrl, (current) => ({
    ...current,
    subject,
    text,
    draft: { id: draft.draft_id, subject, text },
  }));
  return toOutreachEmail(saved);
}

// Sends the email to our own AgentMail inbox, never to the contact.
export async function sendOutreachEmail(jobId: number, profileUrl: string, subject: string, text: string) {
  await findContact(jobId, profileUrl);
  await sendOutreachToInbox({
    jobId: String(jobId),
    profileUrl,
    subject,
    text,
  });
  const saved = await updateStoredEmail(jobId, profileUrl, (current) => ({
    ...current,
    subject,
    text,
    sentAt: new Date().toISOString(),
  }));
  return toOutreachEmail(saved);
}
