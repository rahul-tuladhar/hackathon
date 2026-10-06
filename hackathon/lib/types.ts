// Core domain types for the personal CV + job + JEV agent.
// Everything is in-memory (no DB) per the team's constraint.

export type BulletSource = "sample" | "manual" | "parsed";

/** A single experience bullet in the user's "Big CV". */
export type BigCVBullet = {
  id: string;
  text: string;
  /** Loose tags used for keyword matching (e.g. "backend", "payments", "leadership"). */
  tags: string[];
  source: BulletSource;
  /** Whether this bullet is eligible for the tailored output. */
  selected: boolean;
};

export type JobTarget = {
  title: string;
  company: string;
  url: string;
  description: string;
  /** Set when the job came from the shared job board (app/jobs.ts). */
  sourceId?: string;
  /** Base comp range in USD, when the job board provides one. */
  baseRange?: [number, number];
};

export type PipelineStatus =
  | "idle"
  | "routing"
  | "generating"
  | "assessing"
  | "done"
  | "error";

export type LogLevel = "info" | "jev" | "llm" | "warn" | "error";

export type LogEntry = {
  id: string;
  at: number;
  level: LogLevel;
  message: string;
  detail?: string;
};

/** A capability candidate we hand to JevRouter. Mirrors the JevRouter manifest shape. */
export type CapabilityManifest = {
  id: string;
  name: string;
  description: string;
  type: "mcp_tool" | "skill" | "subagent";
  risk?: { level: "low" | "medium" | "high" | "critical"; categories?: string[] };
  policy?: { requires_confirmation?: boolean };
  permissions?: string[];
  /** Cosmetic metadata for the UI, stripped before sending to JevRouter. */
  ui?: { icon: string; accent: string; kind: string };
};

export type JevCandidate = {
  id: string;
  name: string;
  type: string;
  probability: number | null;
  confidence: number | null;
  rank: number | null;
  stage: string | null;
  riskLevel: string;
  requiresConfirmation: boolean;
  filtered: boolean;
  filterReason: string | null;
  allowed: boolean;
};

export type JevStep = {
  step: number;
  question: string;
  status: string;
  /** The raw Jev choice (may be filtered/unsafe). */
  jevChoice: string | null;
  /** What we actually execute: jev_choice when allowed, else the safest top candidate. */
  resolved: string | null;
  candidates: JevCandidate[];
  fallback: { type: string; reason: string } | null;
};

export type JevPlan = {
  /** How we obtained the decision. */
  transport: "http" | "cli" | "policy";
  provider: string;
  planId: string | null;
  mode: string;
  /** Aggregate status across steps. */
  status: string;
  steps: JevStep[];
  provenance: {
    candidateSnapshotHash: string | null;
    policyHash: string | null;
  };
  /** Capability ids to run, in order, derived from the plan. */
  executionPlan: string[];
  /** Short human-readable explanation of how the plan was derived. */
  rationale: string;
  elapsedMs: number;
  error?: string;
  raw?: unknown;
};

export type GeneratedBullet = {
  id: string;
  text: string;
  /** id of the Big CV bullet this was derived from, if any. */
  evidenceId: string | null;
  rationale: string;
  keywords: string[];
};

export type GeneratedCV = {
  headline: string;
  summary: string;
  skills: string[];
  bullets: GeneratedBullet[];
  coverNote: string;
};

export type AssessmentDimension = {
  key: string;
  label: string;
  score: number;
  note: string;
};

export type Assessment = {
  overall: number;
  verdict: string;
  dimensions: AssessmentDimension[];
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
};

export type ProviderStatus = {
  llm: {
    available: boolean;
    provider: string;
    model: string;
    endpoint: string;
    detail: string;
  };
  jev: {
    available: boolean;
    transport: "http" | "cli" | "policy";
    endpoint: string;
    provider: string;
    detail: string;
  };
};

/**
 * One tab. Each target job keeps its own intent, JEV plan, tailored CV,
 * assessment, trace and status. The Big CV itself is shared across tabs.
 */
export type Workspace = {
  id: string;
  tabName?: string;
  job: JobTarget;
  intent: string;
  /**
   * How much of the tailored CV's bullet wording must remain exactly as it
   * appeared in the source CV. 0 allows a full rewrite; 100 preserves every
   * generated source bullet word-for-word.
   */
  verbatimness: number;
  jev: JevPlan | null;
  relevanceScores?: Record<string, number>;
  cv: GeneratedCV | null;
  assessment: Assessment | null;
  research: string | null;
  status: PipelineStatus;
  activeCapability: string | null;
  /** The pipeline node that failed, retained so the sidebar can show the failure. */
  pipelineErrorNode?: string;
  logs: LogEntry[];
  usedMock: boolean;
  generationProvider: { provider: string; model: string } | null;
  error: string | null;
};
