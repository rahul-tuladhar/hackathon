import { keywordsFrom } from "./mock";
import type { BigCVBullet, GeneratedCV, GeneratedBullet, JobTarget } from "./types";

const MIN_EXPERIENCE_BULLETS = 5;
const MAX_EXPERIENCE_BULLETS = 6;

function score(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.reduce((total, keyword) => total + (normalized.includes(keyword) ? 1 : 0), 0);
}

function isExperienceEvidence(text: string) {
  return !/^(education|languages? and frameworks?|technical skills?|certifications?|certification:)/i.test(
    text.trim(),
  ) && !/\b(?:M\.S\.|B\.S\.|Bachelor of|Master of|University|College of Computing)\b/i.test(text);
}

/**
 * Keep model output tied to resume evidence and fill a short result with the
 * strongest original points. More relevant points rank first, checked points
 * win ties, and unchecked points fill only the remaining space.
 */
export function completeResumeEvidence(
  cv: GeneratedCV,
  source: BigCVBullet[],
  job: JobTarget,
): GeneratedCV {
  const keywords = keywordsFrom(`${job.title} ${job.description}`, 30);
  const ranked = source
    .filter((bullet) => isExperienceEvidence(bullet.text))
    .map((bullet, index) => ({
      bullet,
      index,
      score: score(`${bullet.text} ${bullet.tags.join(" ")}`, keywords),
      priority: bullet.selected ? 1 : 0,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.priority - a.priority ||
        Number(/\d/.test(b.bullet.text)) - Number(/\d/.test(a.bullet.text)) ||
        a.index - b.index,
    );
  const evidenceById = new Map(ranked.map(({ bullet }) => [bullet.id, bullet]));
  const topScore = Math.max(0, ...ranked.map(({ score: relevance }) => relevance));
  const minimumScore = topScore > 0 ? Math.max(1, Math.floor(topScore * 0.25)) : 0;
  const seenEvidence = new Set<string>();

  const cleaned = cv.bullets
    .map((bullet) => {
      const evidence = bullet.evidenceId ? evidenceById.get(bullet.evidenceId) : undefined;
      const relevance = score(`${bullet.text} ${bullet.keywords.join(" ")} ${evidence?.text ?? ""}`, keywords);
      return { bullet, evidence, relevance };
    })
    .filter(({ bullet, evidence, relevance }) => {
      if (!bullet.evidenceId || !evidence || seenEvidence.has(bullet.evidenceId)) return false;
      seenEvidence.add(bullet.evidenceId);
      return relevance >= minimumScore;
    })
    .slice(0, MAX_EXPERIENCE_BULLETS);

  const usedEvidence = new Set(
    cleaned.map(({ bullet }) => bullet.evidenceId).filter((id): id is string => Boolean(id)),
  );
  const completed: GeneratedBullet[] = cleaned.map(({ bullet }) => bullet);

  for (const { bullet, score: relevance } of ranked) {
    if (completed.length >= MIN_EXPERIENCE_BULLETS) break;
    if (usedEvidence.has(bullet.id)) continue;

    const defaultPoint: GeneratedBullet = {
      id: `default-${bullet.id}`,
      text: bullet.text,
      evidenceId: bullet.id,
      rationale: relevance > 0
        ? "Original resume point added to keep the tailored version complete."
        : "Strong original resume point added where role-specific evidence was limited.",
      keywords: keywords.filter((keyword) =>
        `${bullet.text} ${bullet.tags.join(" ")}`.toLowerCase().includes(keyword),
      ),
    };
    completed.push(defaultPoint);
    usedEvidence.add(bullet.id);
  }

  return {
    ...cv,
    bullets: completed.slice(0, MAX_EXPERIENCE_BULLETS),
    skills: [...new Set(cv.skills)].slice(0, 12),
  };
}
