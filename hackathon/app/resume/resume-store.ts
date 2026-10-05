import { create } from "zustand";
import { RAHUL_RESUME } from "@/lib/rahul-resume";
import { extractProfile } from "@/lib/resume-profile";
import type { ResumeData } from "./resume-types";

// A single work experience, edited via the form. The resume derives from these.
export type Experience = {
  id: string;
  jobTitle: string;
  company: string;
  timeRange: string;
  bullets: string[];
};

const PROFILE = extractProfile(RAHUL_RESUME);
const experienceHeading = /^(.+?)\s+—\s+(.+?)\s+\(([^)]+)\)$/;

function parseExperienceSeed(raw: string): Experience[] {
  const experiences: Experience[] = [];
  let current: Experience | null = null;
  for (const line of raw.split(/\r?\n/).map((item) => item.trim())) {
    const heading = line.match(experienceHeading);
    if (heading) {
      current = {
        id: `source-exp-${experiences.length + 1}`,
        company: heading[1],
        jobTitle: heading[2],
        timeRange: heading[3],
        bullets: [],
      };
      experiences.push(current);
    } else if (/^(education|technical skills|certifications?)\s*:?$/i.test(line)) {
      current = null;
    } else if (current && /^[-*•●]/.test(line)) {
      current.bullets.push(line.replace(/^[-*•●]\s*/, "").trim());
    }
  }
  return experiences;
}

const seedExperiences = parseExperienceSeed(RAHUL_RESUME);

type ResumeStore = {
  experiences: Experience[];
  addExperience: () => void;
  updateExperience: (
    id: string,
    patch: Partial<Pick<Experience, "jobTitle" | "company" | "timeRange">>,
  ) => void;
  removeExperience: (id: string) => void;
  addBullet: (id: string) => void;
  updateBullet: (id: string, index: number, text: string) => void;
  removeBullet: (id: string, index: number) => void;
};

export const useResumeStore = create<ResumeStore>((set) => ({
  experiences: seedExperiences,
  addExperience: () =>
    set((s) => ({
      experiences: [
        ...s.experiences,
        {
          id: crypto.randomUUID(),
          jobTitle: "",
          company: "",
          timeRange: "",
          bullets: [""],
        },
      ],
    })),
  updateExperience: (id, patch) =>
    set((s) => ({
      experiences: s.experiences.map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      ),
    })),
  removeExperience: (id) =>
    set((s) => ({ experiences: s.experiences.filter((e) => e.id !== id) })),
  addBullet: (id) =>
    set((s) => ({
      experiences: s.experiences.map((e) =>
        e.id === id ? { ...e, bullets: [...e.bullets, ""] } : e,
      ),
    })),
  updateBullet: (id, index, text) =>
    set((s) => ({
      experiences: s.experiences.map((e) =>
        e.id === id
          ? { ...e, bullets: e.bullets.map((b, i) => (i === index ? text : b)) }
          : e,
      ),
    })),
  removeBullet: (id, index) =>
    set((s) => ({
      experiences: s.experiences.map((e) =>
        e.id === id
          ? { ...e, bullets: e.bullets.filter((_, i) => i !== index) }
          : e,
      ),
    })),
}));

// Derive the full resume JSON from the structured store state.
export function buildResumeData(experiences: Experience[]): ResumeData {
  return {
    name: PROFILE.name,
    contact: PROFILE.contacts.join(" | "),
    sections: [
      {
        title: "Experience",
        type: "entries",
        entries: experiences
          .filter((e) => e.jobTitle.trim() || e.company.trim())
          .map((e) => ({
            title: e.jobTitle,
            subtitle: e.company || undefined,
            right: e.timeRange || undefined,
            bullets: e.bullets.filter((b) => b.trim()),
          })),
      },
      {
        title: "Education",
        type: "entries",
        entries: PROFILE.education.map((item) => ({ title: item, bullets: [] })),
      },
      {
        title: "Technical Skills",
        type: "skills",
        skills: [{
          label: "Languages and frameworks",
          items: PROFILE.skills.filter((skill) => !/certification/i.test(skill)).join(", "),
        }],
      },
      {
        title: "Certifications",
        type: "entries",
        entries: PROFILE.certifications.map((certification) => ({ title: certification, bullets: [] })),
      },
    ],
  };
}

/** Serialize the edited real resume back into the Big CV pipeline's source format. */
export function buildRawResume(experiences: Experience[]) {
  const sourceLines = RAHUL_RESUME.split(/\r?\n/);
  const firstExperience = sourceLines.findIndex((line) => experienceHeading.test(line.trim()));
  const education = sourceLines.findIndex((line) => /^Education\s*$/i.test(line.trim()));
  const intro = sourceLines.slice(0, firstExperience).join("\n").trim();
  const footer = education >= 0 ? sourceLines.slice(education).join("\n").trim() : "";
  const experienceText = experiences
    .filter((experience) => experience.company.trim() && experience.jobTitle.trim())
    .map((experience) => {
      const dates = experience.timeRange.trim();
      const heading = `${experience.company.trim()} — ${experience.jobTitle.trim()}${dates ? ` (${dates})` : ""}`;
      const bullets = experience.bullets
        .map((bullet) => bullet.trim())
        .filter(Boolean)
        .map((bullet) => `- ${bullet}`);
      return [heading, ...bullets].join("\n");
    })
    .join("\n\n");
  return [intro, experienceText, footer].filter(Boolean).join("\n\n");
}
