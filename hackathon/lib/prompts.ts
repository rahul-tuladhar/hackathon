import { keywordsFrom } from "./mock";
import type { Assessment, BigCVBullet, GeneratedCV, JobTarget } from "./types";

const CV_SCHEMA = `{
  "headline": "one punchy line positioning the candidate for THIS role",
  "summary": "2 sentence professional summary tailored to the role and intent",
  "skills": ["concrete skills explicitly supported by the Big CV, ordered by relevance to the job"],
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
  sourceSkills?: string[];
  job: JobTarget;
  intent: string;
  verbatimness?: number;
  plan: string[];
  research?: string | null;
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
    .slice(0, 20)
    .map((x) => x.b);

  const evidence = ranked
    .map((b) => `[${b.id}] (${b.tags.join(", ") || "general"}) ${b.text}`)
    .join("\n");

  // Keep the job text within a predictable token budget.
  const description = (input.job.description || "(not given)").slice(0, 6000);
  const verbatimness = Math.max(0, Math.min(100, Math.round(input.verbatimness ?? 0)));

  return {
    system: `You are an expert CV writer and ATS optimisation engine for a personal career agent.
Rules:
- Use ONLY evidence present in the Big CV bullets. Never invent employers, titles, dates, metrics or tools.
- Only list a skill when it appears in the supplied source skills or selected experience evidence. Never copy a requirement from the job description into the candidate's skills unless the source supports it.
- Keep every number from the source verbatim.
- Rewrite bullets to reflect the job description's priorities while preserving the source meaning and scope. Do not claim adjacent tools, responsibilities, scale or outcomes that the source does not state.
- Prefer strong verbs, concrete outcomes, and the STAR pattern compressed to one line.
- Obey the requested source-wording preservation level exactly. A verbatim bullet must have the same text as its source Big CV bullet, character-for-character (other than surrounding whitespace).
- Choose evidence for the role's actual responsibilities, not broad keyword overlap alone. When equally relevant points come from different roles, show that range and avoid repeating the same kind of achievement.
- Make the two-sentence summary specific to the role and include a concrete, source-supported outcome. Avoid generic filler.
- Return up to 10 strong, distinct experience bullets that fit the one-page limit. Prioritize relevant evidence; do not add tangential bullets to reach a quota or pad a shorter resume.
- Use the available one-page space for distinct relevant evidence while keeping bullets concise and scannable. This CV is exported as a one-page resume; do not add a cover letter to the resume body.
- Return ONLY a single minified JSON object. No markdown, no commentary, no code fences.
Schema:
${CV_SCHEMA}`,
    user: `TARGET JOB
Title: ${input.job.title || "(not given)"}
Company: ${input.job.company || "(not given)"}
Description:
${description}

USER INTENT (highest priority): ${input.intent || "Tailor broadly to the role."}

SOURCE-WORDING PRESERVATION: ${verbatimness}%
Make approximately ${verbatimness}% of output bullets verbatim copies of their cited Big CV source bullet. The remaining bullets may be rewritten for the target role, but must still use only the cited source evidence. At 100%, every output bullet must be copied exactly from its source; at 0%, you may rewrite all output bullets.

CAPABILITY PLAN (from JevRouter): ${input.plan.join(" -> ")}

${input.research ? `ROLE RESEARCH (context only, not CV evidence):\n${input.research}\n` : ""}
BIG CV EVIDENCE (the only source of truth):
${evidence || "(no bullets selected)"}

EXPLICIT SOURCE SKILLS (also grounded evidence; only use these and skills stated in the experience bullets):
${input.sourceSkills?.join(", ") || "(none supplied)"}

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
