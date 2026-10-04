import "server-only";
import { createHash } from "node:crypto";

// Minimal AgentMail client for outreach drafts.
//
// Safety: nothing in this repo ever goes to a researched contact. Every draft and
// every sent message is addressed to our own AgentMail inbox (inboxId()); the
// contact's address is never used as a recipient. Drafts are never sent, and
// `send_at` is never set (AgentMail sends scheduled drafts on its own).
//
// Env (set in .env.local):
//   AGENTMAIL_API_KEY          AgentMail API key
//   AGENTMAIL_INBOX_ID         Inbox to draft in and send to, e.g. name@agentmail.to

const BASE_URL = "https://api.agentmail.to/v0";
const OUTREACH_LABEL = "outreach";

export function inboxId() {
  const id = process.env.AGENTMAIL_INBOX_ID;
  if (!id || !process.env.AGENTMAIL_API_KEY) {
    throw new Error("AgentMail is not configured. Set AGENTMAIL_API_KEY and AGENTMAIL_INBOX_ID in .env.local.");
  }
  return id;
}

async function agentmail<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}/inboxes/${encodeURIComponent(inboxId())}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`AgentMail ${init?.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// Labels can't hold a URL, so contacts are tagged with a short hash of their profile URL.
export function contactKey(profileUrl: string) {
  return createHash("sha1").update(profileUrl).digest("hex").slice(0, 12);
}

const jobLabel = (jobId: string) => `job-${jobId}`;
const contactLabel = (profileUrl: string) => `contact-${contactKey(profileUrl)}`;

export type OutreachDraftInput = {
  jobId: string;
  profileUrl: string;
  subject: string;
  text: string;
};

// Who it was meant for is in the contact label; the recipient is always our own inbox.
const labels = (input: OutreachDraftInput) => [OUTREACH_LABEL, jobLabel(input.jobId), contactLabel(input.profileUrl)];

// Creates the contact's draft, or updates it in place when `draftId` is given.
export async function saveOutreachDraft(input: OutreachDraftInput, draftId?: string) {
  const fields = { to: [inboxId()], subject: input.subject, text: input.text };
  if (draftId) {
    return agentmail<{ draft_id: string }>(`/drafts/${encodeURIComponent(draftId)}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    });
  }
  return agentmail<{ draft_id: string }>("/drafts", {
    method: "POST",
    body: JSON.stringify({
      ...fields,
      labels: labels(input),
      client_id: `outreach-${input.jobId}-${contactKey(input.profileUrl)}`,
    }),
  });
}

// Sends the email, exactly as the contact would get it, to our own AgentMail inbox.
export async function sendOutreachToInbox(input: OutreachDraftInput) {
  return agentmail<{ message_id: string }>("/messages/send", {
    method: "POST",
    body: JSON.stringify({
      to: [inboxId()],
      subject: input.subject,
      text: input.text,
      labels: labels(input),
    }),
  });
}

// Older drafts start with a note saying who they were meant for.
const TEST_PREFIX = "[Test draft, intended for ";

// The contact's existing draft for this job, with that note stripped from its text.
export async function findOutreachDraft(jobId: string, profileUrl: string) {
  const params = new URLSearchParams({ limit: "1" });
  for (const label of [OUTREACH_LABEL, jobLabel(jobId), contactLabel(profileUrl)]) params.append("labels", label);
  const [found] = (await agentmail<DraftList>(`/drafts?${params}`)).drafts;
  if (!found) return undefined;

  const draft = await agentmail<{ draft_id: string; subject?: string; text?: string }>(
    `/drafts/${encodeURIComponent(found.draft_id)}`,
  );
  let text = draft.text ?? "";
  if (text.startsWith(TEST_PREFIX)) text = text.slice(text.indexOf("\n\n") + 2);
  return { id: draft.draft_id, subject: draft.subject ?? "", text };
}

type DraftList = { drafts: { draft_id: string; labels: string[] }[]; next_page_token?: string };
