import type { BigCVBullet, GeneratedCV, GeneratedBullet } from "./types";

// Approximate the vertical space used by a Times 9 pt bullet on letter paper.
// The PDF has room for roughly 38 weighted lines after its header and sections.
const PAGE_BULLET_UNITS = 41;
const CHARS_PER_LINE = 108;

function isExperienceEvidence(text: string) {
  return !/^(education|languages? and frameworks?|technical skills?|certifications?|certification:)/i.test(
    text.trim(),
  ) && !/\b(?:M\.S\.|B\.S\.|Bachelor of|Master of|University|College of Computing)\b/i.test(text);
}

function bulletUnits(text: string) {
  const lines = Math.max(1, Math.ceil(text.replace(/\s+/g, " ").trim().length / CHARS_PER_LINE));
  return lines + 0.25;
}

/**
 * Keep generated claims tied to selected source evidence, then add the strongest
 * remaining selected points until the estimated one-page space is used. There
 * is deliberately no minimum: sparse source material stays sparse.
 */
export function completeResumeEvidence(
  cv: GeneratedCV,
  source: BigCVBullet[],
  relevanceById: Record<string, number> = {},
): GeneratedCV {
  const ranked = source
    .filter((bullet) => bullet.selected && isExperienceEvidence(bullet.text))
    .map((bullet, index) => ({
      bullet,
      index,
      score: relevanceById[bullet.id] ?? 0.5,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(/\d/.test(b.bullet.text)) - Number(/\d/.test(a.bullet.text)) ||
        a.index - b.index,
    );
  const evidenceById = new Map(ranked.map(({ bullet }) => [bullet.id, bullet]));
  const seenEvidence = new Set<string>();
  const completed: GeneratedBullet[] = [];
  let usedUnits = 0;

  const add = (bullet: GeneratedBullet) => {
    if (usedUnits + bulletUnits(bullet.text) > PAGE_BULLET_UNITS) return false;
    completed.push(bullet);
    usedUnits += bulletUnits(bullet.text);
    if (bullet.evidenceId) seenEvidence.add(bullet.evidenceId);
    return true;
  };

  const generatedByEvidenceId = new Map(
    cv.bullets
      .filter((bullet) => Boolean(bullet.evidenceId && evidenceById.has(bullet.evidenceId)))
      .map((bullet) => [bullet.evidenceId!, bullet]),
  );

  for (const { bullet } of ranked) {
    if (seenEvidence.has(bullet.id)) continue;
    const rewritten = generatedByEvidenceId.get(bullet.id);
    const original: GeneratedBullet = rewritten ? {
      ...rewritten,
      text: rewritten.text.replace(/\s+/g, " ").trim(),
    } : {
      id: `source-${bullet.id}`,
      text: bullet.text,
      evidenceId: bullet.id,
      rationale: "Selected source experience included to preserve relevant detail.",
      keywords: [],
    };
    add(original);
  }

  return {
    ...cv,
    bullets: completed,
    skills: [...new Set(cv.skills)].slice(0, 14),
  };
}
