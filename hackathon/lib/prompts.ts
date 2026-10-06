import { keywordsFrom } from "./mock";
import { selectRelevantMemories, type PersonalMemory } from "./memory";
import type { Assessment, BigCVBullet, GeneratedCV, JobTarget } from "./types";

const CV_SCHEMA = `{
  "headline": "one punchy line positioning the candidate for THIS role",
  "summary": "2 sentence professional summary tailored to the role and intent",
  "skills": ["8-14 concrete skills drawn from the Big CV, ordered by relevance to the job"],
  "bullets": [
    {
      "id": "short id",
      "text": "rewritten achievement bullet, starts with a strong verb, mirrors job language, keeps every number from the source",
      "evidenceId": "the id of the Big CV bullet it came from, or null for a synthesized skill bullet",
      "rationale": "one short phrase explaining why this bullet is relevant to the job",
      "keywords": ["job keywords this bullet now covers"]
    }
  ],
  "coverNote": "4-6 sentence cover note, specific, no clichés"
}`;

const ASSESS_SCHEMA = `{
  "overall": 0,
  "verdict": "one sentence hire/no-hire leaning summary",
  "dimensions": [
    { "key": "relevance", "label": "Role relevance", "score": 0, "note": "why" },
    { "key": "impact", "label": "Impact & quantification", "score": 0, "note": "why" },
    { "key": "keywords", "label": "Keyword coverage", "score": 0, "note": "why" },
    { "key": "clarity", "label": "Clarity & concision", "score": 0, "note": "why" },
    { "key": "structure", "label": "Structure & scannability", "score": 0, "note": "why" },
    { "key": "authenticity", "label": "Authenticity", "score": 0, "note": "why" }
  ],
  "matchedKeywords": ["keywords from the job present in the CV"],
  "missingKeywords": ["important job keywords absent from the CV"],
  "suggestions": ["3-6 concrete, actionable edits"]
}`;

export function generatePrompt(input: {
  bullets: BigCVBullet[];
  job: JobTarget;
  intent: string;
  plan: string[];
  research?: string | null;
  memories?: PersonalMemory[];
}): { system: string; user: string } {
  const jobKeywords = keywordsFrom(`${input.job.title} ${input.job.description}`);
  const selected = input.bullets.filter((b) => b.selected);
  // Rank bullets by job-keyword overlap so the prompt stays small on long postings.
  const ranked = selected
    .map((b) => ({
      b,
      score: jobKeywords.filter((k) =>
        `${b.text} ${b.tags.join(" ")}`.toLowerCase().includes(k),
      ).length,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(/\d/.test(b.b.text)) - Number(/\d/.test(a.b.text)),
    )
    .slice(0, 14)
    .map((x) => x.b);

  const evidence = ranked
    .map((b) => `[${b.id}] (${b.tags.join(", ") || "general"}) ${b.text}`)
    .join("\n");

  // Keep the job text within a predictable token budget.
  const description = (input.job.description || "(not given)").slice(0, 2600);
  const memories = selectRelevantMemories(input.memories ?? [], `${input.job.title} ${input.job.company} ${input.job.description} ${input.intent}`);
  const memoryContext = memories.map((memory) => `- [${memory.category}] ${memory.content}`).join("\n");

  return {
    system: `You are an expert CV writer and ATS optimisation engine for a personal career agent.
Rules:
- Use ONLY evidence present in the Big CV bullets. Never invent employers, titles, dates, metrics or tools.
- Approved memory may guide tone, role priorities, and formatting. It is not evidence and must never be used to substantiate a career claim.
- Keep every number from the source verbatim.
- Rewrite bullets to mirror the job description's language and priorities.
- Prefer strong verbs, concrete outcomes, and the STAR pattern compressed to one line.
- Return up to 6 strongest experience bullets. If fewer than 5 are clearly relevant, use the strongest remaining original resume points to make the one-page resume feel complete; preserve their facts and numbers.
- Keep the summary to two concise sentences. This CV is exported as a one-page resume; do not add a cover letter to the resume body.
- Return ONLY a single minified JSON object. No markdown, no commentary, no code fences.
Schema:
${CV_SCHEMA}`,
    user: `TARGET JOB
Title: ${input.job.title || "(not given)"}
Company: ${input.job.company || "(not given)"}
Description:
${description}

USER INTENT (highest priority): ${input.intent || "Tailor broadly to the role."}

${memoryContext ? `APPROVED PERSONAL MEMORY (preferences/context only; never evidence):\n${memoryContext}\n` : ""}

CAPABILITY PLAN (from JevRouter): ${input.plan.join(" -> ")}

${input.research ? `ROLE RESEARCH (context only, not CV evidence):\n${input.research}\n` : ""}
BIG CV EVIDENCE (the only source of truth):
${evidence || "(no bullets selected)"}

Produce the tailored CV JSON now.`,
  };
}

export function assessPrompt(input: {
  cv: GeneratedCV;
  job: JobTarget;
}): { system: string; user: string } {
  return {
    system: `You are a demanding senior hiring manager who also runs an ATS.
Score the tailored CV against the job description honestly. Do not inflate.
Every score is 0-100. Be specific in the notes.
Return ONLY a single minified JSON object. No markdown, no commentary, no code fences.
Schema:
${ASSESS_SCHEMA}`,
    user: `JOB
Title: ${input.job.title || "(not given)"}
Company: ${input.job.company || "(not given)"}
Description:
${(input.job.description || "(not given)").slice(0, 2200)}

TAILORED CV (JSON)
${JSON.stringify(input.cv)}

Assess it now. Include the dimension keys exactly as specified, with all six dimensions.`,
  };
}

export const DIMENSION_KEYS: Array<{ key: keyof Assessment | string; label: string }> = [
  { key: "relevance", label: "Role relevance" },
  { key: "impact", label: "Impact & quantification" },
  { key: "keywords", label: "Keyword coverage" },
  { key: "clarity", label: "Clarity & concision" },
  { key: "structure", label: "Structure & scannability" },
  { key: "authenticity", label: "Authenticity" },
];
