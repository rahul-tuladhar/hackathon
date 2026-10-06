// JSON shape a resume is built from. See mike-resume.json for an example.

export type SkillLine = {
  label: string; // e.g. "Languages:"
  items: string; // e.g. "TypeScript, JavaScript, Python"
};

export type ResumeEntry = {
  title: string; // bold lead — role or project name
  subtitle?: string; // normal text after the title — company
  right?: string; // right-aligned date or link
  bullets: string[];
};

export type ResumeSection =
  | { title: string; type: "skills"; skills: SkillLine[] }
  | { title: string; type: "entries"; entries: ResumeEntry[] };

export type ResumeData = {
  name: string;
  contact: string;
  sections: ResumeSection[];
};
