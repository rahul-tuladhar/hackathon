import "server-only";
import type { Contact } from "@/lib/research";
import jobs from "./jobs";
import { getGatewayClient, GATEWAY_MODEL } from "./gateway";

// Name used to sign outreach emails.
const SENDER_NAME = process.env.OUTREACH_SENDER_NAME || "Niklas";

// Writes a short, personal cold email to one contact about one job.
export async function writeOutreachEmail(jobId: number, contact: Contact): Promise<{ subject: string; text: string }> {
  const job = jobs[jobId];
  if (!job) throw new Error(`Unknown job: ${jobId}`);

  const res = await getGatewayClient().chat.completions.create({
    model: GATEWAY_MODEL,
    max_tokens: 700,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You write short cold outreach emails from a job candidate to someone at the hiring company.
Rules: under 120 words, plain text, no markdown. Open with the specific personal detail you are given, if any, in one natural sentence. Say which role the candidate is applying for and ask one easy question or for a 15-minute chat. Sound like a real person, not a template: no flattery, no buzzwords, no "I hope this email finds you well". Do not invent facts about the candidate's background.
Sign off with: ${SENDER_NAME}
Reply with JSON: {"subject": string, "body": string}`,
      },
      {
        role: "user",
        content: `Role: ${job.title} at ${job.company}
Recipient: ${contact.name}${contact.title ? `, ${contact.title}` : ""}
Why they matter: ${contact.reason}
Personal detail to mention: ${contact.hooks ?? "none"}

Job description (excerpt):
${job.description.trim().slice(0, 3000)}`,
      },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? "";
  let parsed: { subject?: unknown; body?: unknown };
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new Error(`Could not parse the drafted email: ${raw.slice(0, 200)}`);
  }
  if (typeof parsed.subject !== "string" || typeof parsed.body !== "string") {
    throw new Error("The drafted email is missing a subject or body");
  }
  return { subject: parsed.subject.trim(), text: parsed.body.trim() };
}
