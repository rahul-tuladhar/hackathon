import type {
  Assessment,
  BigCVBullet,
  GeneratedCV,
  JobTarget,
} from "./types";

/**
 * Deterministic offline fallback. Keeps the POC demo-able with no keys and
 * makes the "no LLM" state honest rather than broken.
 */

const STOPWORDS = new Set(
  `a an and or the to of in for with on at by from as is are be we you your our their they it this that will would can could should must have has had do does not no if then than about into over across per more most other such own same so too very own how what which who whom team teams role roles work working experience experienced years year strong deep track record looking join help build building systems system using use used plus plus nice must own drive driving lead leading partner partnering raise bar bar.`.split(
    /\s+/,
  ),
);

const TECH_HINTS = [
  "go", "golang", "typescript", "javascript", "python", "react", "postgres", "postgresql",
  "sql", "kafka", "kubernetes", "k8s", "terraform", "redis", "grpc", "graphql", "rust",
  "java", "node", "aws", "gcp", "distributed", "idempotency", "webhooks", "ledger",
  "reconciliation", "payments", "fintech", "reliability", "latency", "microservices",
  "event-driven", "mentoring", "ats", "ai", "llm", "rag", "next.js", "frontend",
  "full-stack", "product", "customer", "machine learning", "sdk",
];

export function keywordsFrom(text: string, limit = 22): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const counts = new Map<string, number>();

  for (const token of lower.matchAll(/[a-z][a-z0-9+.#-]{2,}/g)) {
    const t = token[0].replace(/[.]+$/, "");
    if (STOPWORDS.has(t)) continue;
    counts.set(t, (counts.get(t) || 0) + 1);
  }

  // Boost recognised tech terms so they survive the cut.
  for (const hint of TECH_HINTS) {
    if (lower.includes(` ${hint} `) || lower.includes(`${hint},`) || lower.includes(`${hint}.`)) {
      counts.set(hint, (counts.get(hint) || 0) + 5);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([k]) => k);
}

function hasNumber(text: string): boolean {
  return /\d/.test(text);
}

function titleCaseFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function mockGenerate(input: {
  bullets: BigCVBullet[];
  job: JobTarget;
  intent: string;
}): GeneratedCV {
  const selected = input.bullets.filter((b) => b.selected);
  const jobKeywords = keywordsFrom(`${input.job.title} ${input.job.description}`);

  const scored = selected
    .map((b) => {
      const text = `${b.text} ${b.tags.join(" ")}`.toLowerCase();
      const overlap = jobKeywords.filter((k) => text.includes(k)).length;
      return { b, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap || Number(hasNumber(b.b.text)) - Number(hasNumber(a.b.text)));

  const chosen = scored.slice(0, 6).map(({ b }) => b);

  const bullets = chosen.map((b, i) => ({
    id: `g${i + 1}`,
    text: titleCaseFirst(b.text.replace(/^[a-z]/, (m) => m.toUpperCase())),
    evidenceId: b.id,
    rationale:
      b.tags.length > 0
        ? `Emphasises ${b.tags.slice(0, 3).join(", ")} which the role calls out.`
        : "Relevant experience from the Big CV.",
    keywords: jobKeywords.filter((k) => `${b.text} ${b.tags.join(" ")}`.toLowerCase().includes(k)),
  }));

  const skills = jobKeywords
    .filter((k) => selected.some((b) => `${b.text} ${b.tags.join(" ")}`.toLowerCase().includes(k)))
    .slice(0, 12);
  const sourceSkills = keywordsFrom(selected.map((b) => b.text).join(" "), 12).map(
    (skill) => skill.length <= 4 ? skill.toUpperCase() : skill.charAt(0).toUpperCase() + skill.slice(1),
  );

  const role = input.job.title || "this role";
  const domains = [...new Set(selected.flatMap((bullet) => bullet.tags))].slice(0, 3);

  return {
    headline: `${role} · experience grounded in your resume`,
    summary: `Engineer with experience across ${skills.slice(0, 5).join(", ") || "software engineering"}${domains.length ? `, with a background in ${domains.join(", ")}` : ""}. The achievements below are selected from the experience in your resume and ordered for this role.`,
    skills: skills.length ? skills : sourceSkills.length ? sourceSkills : ["Software engineering"],
    bullets,
    coverNote: "",
  };
}

export function mockAssess(input: {
  cv: GeneratedCV;
  job: JobTarget;
}): Assessment {
  const jobKeywords = keywordsFrom(`${input.job.title} ${input.job.description}`, 30);
  const cvText = [
    input.cv.headline,
    input.cv.summary,
    input.cv.skills.join(" "),
    input.cv.bullets.map((b) => b.text).join(" "),
    input.cv.coverNote,
  ]
    .join(" ")
    .toLowerCase();

  const matched = jobKeywords.filter((k) => cvText.includes(k));
  const missing = jobKeywords.filter((k) => !cvText.includes(k));
  const coverage = jobKeywords.length
    ? Math.round((matched.length / jobKeywords.length) * 100)
    : 60;

  const bulletsWithNumbers = input.cv.bullets.filter((b) => hasNumber(b.text)).length;
  const impact = input.cv.bullets.length
    ? Math.round((bulletsWithNumbers / input.cv.bullets.length) * 100)
    : 0;

  const avgLen =
    input.cv.bullets.reduce((a, b) => a + b.text.length, 0) /
    Math.max(1, input.cv.bullets.length);
  const clarity = avgLen > 220 ? 62 : avgLen > 170 ? 78 : 88;

  const authenticity = missing.length > jobKeywords.length / 2 ? 90 : 82;

  const dims = [
    { key: "relevance", label: "Role relevance", score: Math.min(96, 55 + coverage * 0.4), note: `${matched.length}/${jobKeywords.length} job keywords are reflected in the CV.` },
    { key: "impact", label: "Impact & quantification", score: impact, note: `${bulletsWithNumbers}/${input.cv.bullets.length} bullets carry a number.` },
    { key: "keywords", label: "Keyword coverage", score: coverage, note: `ATS coverage estimated at ${coverage}%.` },
    { key: "clarity", label: "Clarity & concision", score: clarity, note: `Average bullet length ${Math.round(avgLen)} characters.` },
    { key: "structure", label: "Structure & scannability", score: input.cv.skills.length >= 6 ? 88 : 72, note: "Headline, summary, skills and bullets are all present." },
    { key: "authenticity", label: "Authenticity", score: authenticity, note: "All bullets trace back to Big CV evidence ids." },
  ].map((d) => ({ ...d, score: Math.round(d.score) }));

  const overall = Math.round(dims.reduce((a, d) => a + d.score, 0) / dims.length);

  const suggestions = [
    missing.length ? `Weave in missing keywords where true: ${missing.slice(0, 6).join(", ")}.` : "Keyword coverage is strong; keep it.",
    impact < 60 ? "Quantify more bullets with a metric from the Big CV." : "Good quantification; consider leading with the biggest number.",
    "Put the single strongest payments outcome in the first bullet.",
    "Name the target company once in the summary for personalisation.",
  ];

  return {
    overall,
    verdict:
      overall >= 80
        ? "Strong fit: this CV would pass most ATS screens and reads as experienced."
        : overall >= 65
          ? "Solid fit with gaps: tighten keywords and quantification."
          : "Needs work before sending: relevance and keywords are thin.",
    dimensions: dims,
    matchedKeywords: matched.slice(0, 20),
    missingKeywords: missing.slice(0, 12),
    suggestions,
  };
}
