// Shared contract between job input, research output, and the CV / outreach steps.

export type Job = {
  id: string;
  title: string;
  company: string;
  companyUrl?: string;
  location?: string;
  description?: string;
  url?: string;
};

export type CompanyBrief = {
  name: string;
  website?: string;
  overview: string;
  product?: string;
  stage?: string;
  headcount?: string;
  headquarters?: string;
  culture?: string;
  techStack: string[];
  recentNews: NewsItem[];
  hiringSignals?: string;
  // Concrete facts the outreach writer can reference to sound informed.
  talkingPoints: string[];
  // Citations Exa used for the brief.
  sources: Source[];
};

export type Source = {
  url: string;
  title?: string;
};

export type NewsItem = {
  title: string;
  url: string;
  publishedDate?: string;
  snippet?: string;
};

export type ContactRole = "hiring_manager" | "recruiter" | "executive" | "team_member";

export type Contact = {
  name: string;
  title?: string;
  role: ContactRole;
  profileUrl: string;
  email?: string;
  photoUrl?: string;
  location?: string;
  // 0-100, higher means contact first.
  priority: number;
  reason: string;
  // Personal details from the profile that can open an outreach message.
  hooks?: string;
  // Citations backing this contact (profile, team page, posts).
  sources: Source[];
};

export type JobResearch = {
  job: Job;
  company: CompanyBrief;
  contacts: Contact[];
  researchedAt: string;
  costDollars?: number;
};
