/**
 * Best-effort extraction of a name and contact line from the raw Big CV text.
 * Keeps the PDF header populated without asking the user for extra fields.
 */
export type ResumeProfile = {
  name: string;
  contacts: string[];
  experienceByBulletId: Record<string, { company: string; title: string; dates: string; location?: string }>;
  education: string[];
  skills: string[];
  certifications: string[];
};

function parseExperienceHeading(line: string): {
  company: string;
  title: string;
  dates: string;
  location?: string;
} | null {
  const splitAt = line.search(/[—–]/);
  const firstYear = line.search(/\b(?:19|20)\d{2}\b/);
  if (splitAt <= 0 || (firstYear >= 0 && splitAt > firstYear)) return null;

  const company = line.slice(0, splitAt).trim();
  const details = line.slice(splitAt + 1).trim();
  const dateMatch = details.match(/\(([^)]*(?:19|20)\d{2}[^)]*)\)/);
  const title = details.replace(/\s*\([^)]*(?:19|20)\d{2}[^)]*\)\s*$/, "").trim();
  if (!company || !title) return null;
  return { company, title, dates: dateMatch?.[1] ?? "" };
}

export function extractProfile(rawCV: string): ResumeProfile {
  const lines = rawCV
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const head = lines[0] ?? "";
  const name =
    head
      .split(/\s+[—–|·:]\s+/)[0]
      .replace(/[|,].*$/, "")
      .trim() || "Your Name";

  const email = rawCV.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0];
  const phone = rawCV.match(/(\+?\(?\d[\d\s().-]{7,}\d)/)?.[0]?.trim();
  const linkedin = rawCV.match(/linkedin\.com\/[^\s|,)]+/i)?.[0];
  const github = rawCV.match(/github\.com\/[^\s|,)]+/i)?.[0];
  const site = rawCV.match(/https?:\/\/(?!.*(?:linkedin|github))[^\s|,)]+/i)?.[0];
  const location = rawCV.match(
    /([A-Z][a-z]+(?: [A-Z][a-z]+)*,\s*[A-Z]{2}(?:\s+\d{5})?)/,
  )?.[1];

  const contacts = [phone, email, linkedin, github, site, location].filter(
    (v): v is string => Boolean(v),
  ).sort((a, b) => {
    const order = (value: string) =>
      value === phone ? 0 :
      value === email ? 1 :
      value === linkedin ? 2 :
      value === github ? 3 :
      value === site ? 4 : 5;
    return order(a) - order(b);
  });

  const experienceByBulletId: ResumeProfile["experienceByBulletId"] = {};
  const education: string[] = [];
  const skills = new Set<string>();
  const certifications: string[] = [];
  let section: "experience" | "summary" | "education" | "skills" | "certifications" = "experience";
  let currentExperience: ReturnType<typeof parseExperienceHeading> = null;
  let pendingCompany = "";
  let pendingLocation = "";
  let bulletIndex = 0;

  for (const line of lines) {
    const isBullet = /^[-*•●]/.test(line);
    const body = line.replace(/^[-*•●]\s*/, "").trim();

    if (!isBullet) {
      if (/^(summary|profile|objective)\s*:?$/i.test(line)) {
        section = "summary";
        currentExperience = null;
      } else if (/^(work experience|professional experience|experience|employment history)\s*:?$/i.test(line)) {
        section = "experience";
        currentExperience = null;
        pendingCompany = "";
        pendingLocation = "";
      } else if (/^(education|academic background)\s*:?$/i.test(line)) {
        section = "education";
        currentExperience = null;
      } else if (/^(technical skills|skills|technologies)\s*:?$/i.test(line)) {
        section = "skills";
        currentExperience = null;
      } else if (/^(certifications?|licenses)\s*:?$/i.test(line)) {
        section = "certifications";
        currentExperience = null;
      } else if (section === "education") {
        education.push(line);
      } else if (section === "skills" && !/^certifications?\s*:/i.test(line)) {
        for (const skill of line.replace(/^(?:languages and frameworks|technical skills|skills)\s*:\s*/i, "").split(/[,;|]/)) {
          if (skill.trim()) skills.add(skill.trim());
        }
      } else if (section !== "skills" && section !== "certifications") {
        if (pendingCompany && /\b(?:19|20)\d{2}\b/.test(line) && line.includes("|")) {
          const [title, ...dateParts] = line.split("|").map((part) => part.trim());
          currentExperience = {
            company: pendingCompany,
            title,
            dates: dateParts.join(" | "),
            location: pendingLocation,
          };
          pendingCompany = "";
          pendingLocation = "";
          section = "experience";
        } else {
          const parsed = parseExperienceHeading(line);
          if (parsed) {
            currentExperience = parsed;
            section = "experience";
            pendingCompany = "";
            pendingLocation = "";
          } else if (line.includes("|") && !/\b(?:19|20)\d{2}\b/.test(line)) {
            const parts = line.split("|").map((part) => part.trim());
            pendingCompany = parts.length > 2 ? parts.slice(0, -1).join(" | ") : parts[0];
            pendingLocation = parts.length > 1 ? parts[parts.length - 1] : "";
            currentExperience = null;
            section = "experience";
          }
        }
      }
      continue;
    }

    if (body.length < 24) continue;

    if (section === "education") education.push(body);
    if (section === "skills" && !/^certifications?\s*:/i.test(body)) {
      for (const skill of body.replace(/^(?:languages and frameworks|technical skills|skills)\s*:\s*/i, "").split(/[,;|]/)) {
        if (skill.trim()) skills.add(skill.trim());
      }
    }
    if (section === "certifications" || /\bcertification\s*:/i.test(body) || /\bcertified\b/i.test(body)) {
      certifications.push(body.replace(/^certification\s*:\s*/i, ""));
    }
    if (section === "experience") {
      bulletIndex += 1;
      if (currentExperience) experienceByBulletId[`b${bulletIndex}`] = currentExperience;
    }
  }

  return {
    name,
    contacts,
    experienceByBulletId,
    education,
    skills: [...skills],
    certifications,
  };
}
