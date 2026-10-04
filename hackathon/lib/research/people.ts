import type { AgentRun, CreateAgentRunParams } from "exa-js";
import { domainOf } from "./exa";
import type { Contact, ContactRole, Job, Source } from "./types";

// Bump when the prompt or schema changes; runs from older versions are ignored and redone.
export const PEOPLE_RUN_VERSION = "2";

const ROLES: ContactRole[] =["hiring_manager", "recruiter", "executive", "team_member"];

const contactsSchema = {
  type: "object",
  properties: {
    contacts: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          title: { type: "string", description: "Current job title at the company" },
          role: { type: "string", enum: ROLES },
          profile_url: { type: "string", format: "uri", description: "LinkedIn or other public profile URL" },
          email: { type: "string", format: "email", description: "Work email address" },
          photo_url: { type: "string", format: "uri", description: "Direct URL of their profile photo" },
          priority: { type: "integer", minimum: 1, maximum: 100, description: "How strongly to contact this person first" },
          reason: { type: "string", description: "One sentence: why this person matters for this application" },
          hook: {
            type: "string",
            description: "A specific detail (project, post, talk, background) to mention in a personal outreach message",
          },
        },
        required: ["name", "title", "role", "profile_url", "email", "priority", "reason"],
      },
    },
  },
  required: ["contacts"],
};

const systemPrompt = `You help a job candidate decide who to reach out to about one specific job.
Only include people who currently work at the hiring company; verify this from their profile or the company site and leave out anyone you cannot verify. Never guess a name or profile URL.
Every contact needs a work email you actually found published (company site, profile, talk, paper, repo). Only include people whose email you found; never construct one from a naming pattern, and leave a person out rather than guess. Include a profile photo URL when you can find one.
Roles: hiring_manager = likely manager or team lead for this role; recruiter = recruiting, talent or people team; executive = founders and C-level/VP; team_member = people in the same or an adjacent role.
Order contacts by priority. The likely hiring manager ranks highest, then the recruiter for that area. At companies under ~200 people, founders and CTOs are often directly involved in hiring and should rank high.`;

type AgentContact = {
  name: string;
  title: string;
  role: ContactRole;
  profile_url: string;
  priority: number;
  reason: string;
  hook?: string;
  email: string;
  photo_url?: string;
};

// Profile photo URLs often expire or block hotlinking; only keep ones that actually serve an image.
async function workingImage(url?: string) {
  if (!url) return undefined;
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(4000) });
    return res.ok && res.headers.get("content-type")?.startsWith("image/") ? url : undefined;
  } catch {
    return undefined;
  }
}

// Finding stakeholders is list-building, which Exa routes to the Agent API rather than /search.
// Runs execute on Exa's side, so they are created without waiting and looked up
// again by job id (see people-runs.ts); Exa stores the finished output.
export function peopleRunParams(job: Job): CreateAgentRunParams {
  const domain = domainOf(job.companyUrl);
  const query = `Find the people at ${job.company}${domain ? ` (${domain})` : ""} that a candidate applying for the "${job.title}" role${
    job.location ? ` in ${job.location}` : ""
  } should contact: the likely hiring manager, recruiters, people on the same team, and leadership if the company is small.`;

  return {
    query,
    systemPrompt,
    // The listing itself is the row to research; keeps the long description out of
    // `query`. Its `id` is also how a run is matched back to its job.
    input: { data: [{ ...job, description: job.description?.slice(0, 4000) }] },
    outputSchema: contactsSchema,
    effort: "auto",
    budget: { maxCostDollars: Number(process.env.EXA_AGENT_MAX_COST ?? 2) },
    metadata: { jobId: job.id, version: PEOPLE_RUN_VERSION },
  };
}

export function isCurrentRun(run: AgentRun) {
  return (run.request?.metadata as { version?: unknown } | undefined)?.version === PEOPLE_RUN_VERSION;
}

// Job id a run was created for, read back from its stored request.
export function runJobId(run: AgentRun): string | undefined {
  const data = (run.request?.input as { data?: { id?: unknown }[] } | undefined)?.data;
  const id = data?.[0]?.id;
  return id === undefined ? undefined : String(id);
}

export async function contactsFromRun(run: AgentRun): Promise<{ contacts: Contact[]; cost: number }> {
  if (run.status !== "completed") {
    throw new Error(`Exa agent run ${run.id} ended with status ${run.status}: ${run.error?.message ?? "no error message"}`);
  }

  // Grounding fields look like "contacts[2].title"; collect citations per contact.
  const sources = new Map<number, Source[]>();
  for (const g of run.output?.grounding ?? []) {
    const i = Number(/contacts\[(\d+)\]/.exec(g.field)?.[1]);
    if (Number.isNaN(i)) continue;
    const list = sources.get(i) ?? [];
    for (const c of g.citations) {
      if (!list.some((s) => s.url === c.url)) list.push({ url: c.url, title: c.title ?? undefined });
    }
    sources.set(i, list);
  }

  // Only people we can actually email are useful for outreach; drop the rest.
  // Keep each contact's original index, since grounding citations are keyed by it.
  const raw = ((run.output?.structured as { contacts?: AgentContact[] } | undefined)?.contacts ?? [])
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.email?.trim());
  const photos = await Promise.all(raw.map(({ c }) => workingImage(c.photo_url)));

  const contacts = raw
    .map(
      ({ c, i }, n): Contact => ({
        name: c.name,
        title: c.title,
        role: ROLES.includes(c.role) ? c.role : "team_member",
        profileUrl: c.profile_url,
        email: c.email!.trim(),
        photoUrl: photos[n],
        priority: Math.max(1, Math.min(100, Math.round(c.priority))),
        reason: c.reason,
        hooks: c.hook,
        sources: sources.get(i) ?? [],
      }),
    )
    .sort((a, b) => b.priority - a.priority);

  return { contacts, cost: run.costDollars?.total ?? 0 };
}
