"use client";

import jobs from "@/app/jobs";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { inferTags, parseBigCV } from "./sample";
import { extractProfile } from "./resume-profile";
import type {
  Assessment,
  BigCVBullet,
  GeneratedCV,
  JevPlan,
  JobTarget,
  LogLevel,
  ProviderStatus,
  Workspace,
} from "./types";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const BLANK_JOB: JobTarget = { title: "", company: "", url: "", description: "" };

export const DEFAULT_SECTION_ORDER = [
  "resume",
  "target",
  "pipeline",
  "cv",
  "quality",
  "trace",
];

function makeWorkspace(job: JobTarget = BLANK_JOB, intent = ""): Workspace {
  return {
    id: uid(),
    job,
    intent,
    verbatimness: 50,
    jev: null,
    relevanceScores: undefined,
    cv: null,
    assessment: null,
    research: null,
    status: "idle",
    activeCapability: null,
    pipelineErrorNode: undefined,
    logs: [],
    usedMock: false,
    generationProvider: null,
    error: null,
  };
}

/** Clear derived results but keep the job and intent. */
function cleared(ws: Workspace): Workspace {
  return {
    ...ws,
    jev: null,
    cv: null,
    assessment: null,
    research: null,
    status: "idle",
    activeCapability: null,
    pipelineErrorNode: undefined,
    logs: [],
    usedMock: false,
    generationProvider: null,
    error: null,
  };
}

const firstWorkspace = makeWorkspace();
const IN_PROGRESS_STATUSES = new Set(["routing", "generating", "assessing"]);

type State = {
  rawCV: string;
  bullets: BigCVBullet[];
  sampleLabel: string | null;
  sourceFilename: string | null;
  sourceKind: "pdf" | "markdown" | "text" | "docx" | null;
  sourcePreviewUrl: string | null;
  providers: ProviderStatus | null;
  workspaces: Workspace[];
  activeId: string;
  flowOpen: boolean;
  selectedNode: string | null;
  sectionOrder: string[];
};

type Actions = {
  // shared
  hydrateSample: () => void;
  loadResume: () => void;
  uploadResume: (file: File) => Promise<void>;
  clearAll: () => void;
  setRawCV: (text: string) => void;
  parseFromRaw: () => void;
  toggleBullet: (id: string) => void;
  updateBullet: (id: string, text: string) => void;
  updateCV: (cv: GeneratedCV) => void;
  updateWorkspaceCV: (workspaceId: string, cv: GeneratedCV) => void;
  addBullet: (text: string) => void;
  removeBullet: (id: string) => void;
  refreshProviders: () => Promise<void>;
  // workspaces
  addWorkspace: (job?: JobTarget) => void;
  openBoardJob: (boardId: string) => void;
  removeWorkspace: (id: string) => void;
  setActiveId: (id: string) => void;
  setWorkspaceTabName: (id: string, name: string | null) => void;
  setJob: (patch: Partial<JobTarget>) => void;
  setIntent: (intent: string) => void;
  setVerbatimness: (verbatimness: number) => void;
  // flow ui
  setFlowOpen: (open: boolean) => void;
  selectNode: (key: string | null) => void;
  // layout
  setSectionOrder: (order: string[]) => void;
  reorderWorkspaces: (from: number, to: number) => void;
  loadPrefs: () => void;
  // pipeline
  runPipeline: () => Promise<void>;
};

type PersistedState = Pick<
  State,
  "rawCV" | "bullets" | "sampleLabel" | "sourceFilename" | "sourceKind" | "workspaces" | "activeId"
>;

export const useAgentStore = create<State & Actions>()(persist((set, get) => {
  const patch = (id: string, p: Partial<Workspace>) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, ...p } : w)),
    }));

  const appendLog = (id: string, level: LogLevel, message: string, detail?: string) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === id
          ? {
              ...w,
              logs: [...w.logs, { id: uid(), at: Date.now(), level, message, detail }].slice(-200),
            }
          : w,
      ),
    }));

  return {
    rawCV: "",
    bullets: [],
    sampleLabel: null,
    sourceFilename: null,
    sourceKind: null,
    sourcePreviewUrl: null,
    providers: null,
    workspaces: [firstWorkspace],
    activeId: firstWorkspace.id,
    flowOpen: false,
    selectedNode: null,
    sectionOrder: DEFAULT_SECTION_ORDER,

    hydrateSample: () => {
      import("./sample").then(({ SAMPLE_BIG_CV, SAMPLE_JOB }) => {
        const previousPreview = get().sourcePreviewUrl;
        if (previousPreview) URL.revokeObjectURL(previousPreview);
        const ws = makeWorkspace(
          SAMPLE_JOB,
          "Tailor this for the payments platform role and emphasise reliability and scale. Keep it to one page, ATS-friendly.",
        );
        set({
          rawCV: SAMPLE_BIG_CV,
          bullets: parseBigCV(SAMPLE_BIG_CV),
          sampleLabel: "Payments sample",
          sourceFilename: "payments-resume.md",
          sourceKind: "markdown",
          sourcePreviewUrl: null,
          workspaces: [ws],
          activeId: ws.id,
        });
      });
    },

    loadResume: () => {
      import("./rahul-resume").then(({ RAHUL_RESUME, RAHUL_DEFAULT_INTENT }) => {
        const previousPreview = get().sourcePreviewUrl;
        if (previousPreview) URL.revokeObjectURL(previousPreview);
        set((s) => ({
          rawCV: RAHUL_RESUME,
          bullets: parseBigCV(RAHUL_RESUME),
          sampleLabel: "Rahul Tuladhar (real resume)",
          sourceFilename: "rahul-resume.md",
          sourceKind: "markdown",
          sourcePreviewUrl: null,
          workspaces: s.workspaces.map((w) =>
            cleared({ ...w, intent: w.intent || RAHUL_DEFAULT_INTENT }),
          ),
        }));
      });
    },

    uploadResume: async (file: File) => {
      appendLog(get().activeId, "info", `Uploading ${file.name}…`);
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/parse-resume", { method: "POST", body });
        const data = (await res.json()) as {
          text?: string;
          kind?: string;
          pages?: number;
          error?: string;
        };
        if (!res.ok || !data.text) {
          appendLog(get().activeId, "error", "Resume parse failed", data.error);
          set((s) => ({
            workspaces: s.workspaces.map((w) =>
              w.id === s.activeId ? { ...w, error: data.error || "Could not parse that file." } : w,
            ),
          }));
          return;
        }
        const bullets = parseBigCV(data.text);
        const extension = file.name.split(".").pop()?.toLowerCase();
        const sourceKind = extension === "pdf" || file.type === "application/pdf"
          ? "pdf"
          : extension === "docx" || file.type.includes("wordprocessingml")
            ? "docx"
            : extension === "md" || extension === "markdown"
              ? "markdown"
              : "text";
        const sourcePreviewUrl = sourceKind === "pdf" ? URL.createObjectURL(file) : null;
        const previousPreview = get().sourcePreviewUrl;
        if (previousPreview) URL.revokeObjectURL(previousPreview);
        set((s) => ({
          rawCV: data.text,
          bullets,
          sampleLabel: `${file.name} · ${bullets.length} bullets`,
          sourceFilename: file.name,
          sourceKind,
          sourcePreviewUrl,
          workspaces: s.workspaces.map(cleared),
        }));
        appendLog(
          get().activeId,
          "info",
          `Imported ${file.name}: ${bullets.length} bullets`,
          `${data.kind ?? "text"}${data.pages ? ` · ${data.pages} page(s)` : ""}`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        appendLog(get().activeId, "error", "Resume upload failed", message);
      }
    },

    clearAll: () => {
      const previousPreview = get().sourcePreviewUrl;
      if (previousPreview) URL.revokeObjectURL(previousPreview);
      const ws = makeWorkspace();
      set({
        rawCV: "",
        bullets: [],
        sampleLabel: null,
        sourceFilename: null,
        sourceKind: null,
        sourcePreviewUrl: null,
        workspaces: [ws],
        activeId: ws.id,
        flowOpen: false,
        selectedNode: null,
      });
    },

    setRawCV: (text) => {
      const previousPreview = get().sourcePreviewUrl;
      if (previousPreview) URL.revokeObjectURL(previousPreview);
      set({
        rawCV: text,
        sampleLabel: null,
        sourceFilename: "Edited resume.md",
        sourceKind: "markdown",
        sourcePreviewUrl: null,
      });
    },

    parseFromRaw: () => {
      const bullets = parseBigCV(get().rawCV);
      set((s) => ({
        bullets,
        workspaces: s.workspaces.map(cleared),
      }));
      appendLog(get().activeId, "info", `Parsed ${bullets.length} bullets from the Big CV`);
    },

    toggleBullet: (id) =>
      set((s) => ({
        bullets: s.bullets.map((b) => (b.id === id ? { ...b, selected: !b.selected } : b)),
      })),

    updateBullet: (id, text) =>
      set((s) => {
        const original = s.bullets.find((b) => b.id === id);
        return {
          rawCV:
            original?.source === "parsed" && original.text
              ? s.rawCV.replace(original.text, text)
              : s.rawCV,
          bullets: s.bullets.map((b) =>
            b.id === id ? { ...b, text, tags: inferTags(text) } : b,
          ),
        };
      }),

    updateCV: (cv) =>
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w.id === s.activeId ? { ...w, cv } : w)),
      })),

    updateWorkspaceCV: (workspaceId, cv) =>
      set((s) => ({
        workspaces: s.workspaces.map((w) =>
          w.id === workspaceId ? { ...w, cv, assessment: null } : w,
        ),
      })),

    addBullet: (text) =>
      set((s) => ({
        bullets: [
          ...s.bullets,
          { id: `m${s.bullets.length + 1}`, text, tags: [], source: "manual", selected: true },
        ],
      })),

    removeBullet: (id) =>
      set((s) => ({ bullets: s.bullets.filter((b) => b.id !== id) })),

    refreshProviders: async () => {
      try {
        const res = await fetch("/api/health");
        set({ providers: (await res.json()) as ProviderStatus });
      } catch {
        set({ providers: null });
      }
    },

    addWorkspace: (job) => {
      const ws = makeWorkspace(job ?? BLANK_JOB, get().workspaces[0]?.intent ?? "");
      set((s) => ({ workspaces: [...s.workspaces, ws], activeId: ws.id }));
    },

    openBoardJob: (boardId) => {
      const existing = get().workspaces.find((w) => w.job.sourceId === boardId);
      if (existing) {
        set({ activeId: existing.id });
        return;
      }
      const entry = Object.entries(jobs).find(([id]) => id === boardId);
      if (!entry) return;
      const [, job] = entry;
      const ws = makeWorkspace(
        {
          title: job.title,
          company: job.company,
          url: "",
          description: job.description,
          sourceId: boardId,
          baseRange: job.baseRange,
        },
        get().workspaces[0]?.intent ?? "",
      );
      set((s) => ({ workspaces: [...s.workspaces, ws], activeId: ws.id }));
    },

    removeWorkspace: (id) =>
      set((s) => {
        if (s.workspaces.length <= 1) return {};
        const workspaces = s.workspaces.filter((w) => w.id !== id);
        const activeId = s.activeId === id ? workspaces[0].id : s.activeId;
        return { workspaces, activeId };
      }),

    setActiveId: (id) => set({ activeId: id, flowOpen: false, selectedNode: null }),

    setWorkspaceTabName: (id, name) =>
      set((s) => ({
        workspaces: s.workspaces.map((w) =>
          w.id === id ? { ...w, tabName: name || undefined } : w,
        ),
      })),

    setJob: (patchObj) =>
      set((s) => ({
        workspaces: s.workspaces.map((w) =>
          w.id === s.activeId ? { ...w, job: { ...w.job, ...patchObj } } : w,
        ),
      })),

    setIntent: (intent) =>
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w.id === s.activeId ? { ...w, intent } : w)),
      })),

    setVerbatimness: (verbatimness) =>
      set((s) => ({
        workspaces: s.workspaces.map((w) =>
          w.id === s.activeId
            ? { ...w, verbatimness: Math.max(0, Math.min(100, Math.round(verbatimness))) }
            : w,
        ),
      })),

    setFlowOpen: (open) => set({ flowOpen: open, selectedNode: open ? get().selectedNode : null }),
    selectNode: (key) => set({ selectedNode: key }),

    setSectionOrder: (order) => {
      set({ sectionOrder: order });
      try {
        window.localStorage.setItem("tailor.sectionOrder", JSON.stringify(order));
      } catch {
        /* ignore */
      }
    },

    reorderWorkspaces: (from, to) =>
      set((s) => {
        const next = [...s.workspaces];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return { workspaces: next };
      }),

    loadPrefs: () => {
      try {
        const raw = window.localStorage.getItem("tailor.sectionOrder");
        if (!raw) return;
        const parsed = JSON.parse(raw) as string[];
        if (
          Array.isArray(parsed) &&
          parsed.length === DEFAULT_SECTION_ORDER.length &&
          DEFAULT_SECTION_ORDER.every((id) => parsed.includes(id))
        ) {
          set({ sectionOrder: parsed });
        }
      } catch {
        /* ignore */
      }
    },

    runPipeline: async () => {
      const state = get();
      const id = state.activeId;
      const ws = state.workspaces.find((w) => w.id === id);
      if (!ws) return;

      const selected = state.bullets.filter((b) => b.selected);
      if (selected.length === 0) {
        patch(id, {
          status: "error",
          error: "Select at least one Big CV bullet first.",
          pipelineErrorNode: "bullets",
        });
        appendLog(id, "warn", "No bullets selected; nothing to tailor.");
        return;
      }
      if (!ws.job.description.trim()) {
        patch(id, {
          status: "error",
          error: "Paste a job description first.",
          pipelineErrorNode: "jev",
        });
        appendLog(id, "warn", "No job description; nothing to target.");
        return;
      }

      patch(id, cleared({ ...ws, status: "routing" }));
      appendLog(id, "info", `Pipeline start: ${selected.length} bullets -> ${ws.job.title || "role"}`);

      let currentNode = "jev";
      try {
        appendLog(id, "jev", "Asking JevRouter to plan the capability order…");
        const jevRes = await fetch("/api/jev", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            intent: ws.intent,
            jobTitle: ws.job.title,
            jobCompany: ws.job.company,
          }),
        });
        if (!jevRes.ok) throw new Error(`JEV route failed: ${jevRes.status}`);
        const jev = (await jevRes.json()) as JevPlan;
        patch(id, { jev });
        appendLog(
          id,
          "jev",
          `JevRouter (${jev.transport}/${jev.provider}) -> ${jev.executionPlan.join(" \u2192 ")}`,
          `${jev.rationale}${jev.error ? `\n(CLI error: ${jev.error})` : ""}`,
        );

        currentNode = "jev";
        appendLog(id, "jev", `Scoring ${selected.length} source bullets with Jev relevance probabilities…`);
        const scoreRes = await fetch("/api/score-bullets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ bullets: state.bullets, job: ws.job }),
        });
        if (!scoreRes.ok) {
          const detail = await scoreRes.json().catch(() => null) as { error?: string } | null;
          throw new Error(detail?.error || `Jev bullet scoring failed: ${scoreRes.status}`);
        }
        const scored = (await scoreRes.json()) as { scores: Record<string, number>; provider: string };
        patch(id, { relevanceScores: scored.scores });
        for (const bullet of selected) {
          appendLog(id, "jev", `Jev relevance ${Math.round((scored.scores[bullet.id] ?? 0.5) * 100)}%`, bullet.text);
        }

        let research: string | null = null;
        if (jev.executionPlan.includes("company_research")) {
          currentNode = "research";
          patch(id, { activeCapability: "company_research" });
          appendLog(id, "jev", "Capability company_research: grounding the role…");
          try {
            const r = await fetch("/api/company-research", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ job: ws.job, intent: ws.intent }),
            });
            if (r.ok) {
              const data = (await r.json()) as { findings: string; provider: string };
              research = data.findings;
              patch(id, { research });
              appendLog(id, "llm", `Research (${data.provider}) ready`, data.findings.slice(0, 240));
            }
          } catch {
            appendLog(id, "warn", "Research step skipped");
          }
        }

        currentNode = "generate";
        patch(id, { activeCapability: "cv_generate", status: "generating" });
        appendLog(id, "llm", "Capability cv_generate: tailoring the CV…");
        const genRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            bullets: state.bullets,
            sourceSkills: extractProfile(state.rawCV).skills,
            job: ws.job,
            intent: ws.intent,
            verbatimness: ws.verbatimness,
            plan: jev.executionPlan,
            research,
            relevanceById: scored.scores,
          }),
        });
        if (!genRes.ok) {
          const errorBody = await genRes.json().catch(() => null) as { error?: string } | null;
          throw new Error(errorBody?.error || `Generate failed: ${genRes.status}`);
        }
        if (!genRes.body) throw new Error("Generate stream was not available");

        const reader = genRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const generation: { result?: {
          cv: GeneratedCV;
          provider: string;
          model: string;
          warning?: string;
        } } = {};

        const consumeEvent = (frame: string) => {
          let event = "message";
          const data: string[] = [];
          for (const line of frame.split(/\r?\n/)) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
          }
          if (data.length === 0) return;

          const payload = JSON.parse(data.join("\n")) as {
            cv?: GeneratedCV;
            provider?: string;
            model?: string;
            message?: string;
            warning?: string;
          };

          if (event === "draft" && payload.cv) {
            patch(id, {
              cv: payload.cv,
              usedMock: payload.provider === "mock",
            });
          } else if (event === "warning" && payload.message) {
            appendLog(id, "warn", "Using the offline CV fallback", payload.message);
          } else if (event === "complete" && payload.cv) {
            generation.result = {
              cv: payload.cv,
              provider: payload.provider || "unknown",
              model: payload.model || "unknown",
              warning: payload.warning,
            };
          } else if (event === "error") {
            throw new Error(payload.message || "CV generation stream failed");
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const frames = buffer.split(/\r?\n\r?\n/);
          buffer = frames.pop() ?? "";
          for (const frame of frames) consumeEvent(frame);
          if (done) break;
        }
        if (buffer.trim()) consumeEvent(buffer);
        reader.releaseLock();
        const genData = generation.result;
        if (!genData) throw new Error("CV generation stream ended before the draft was complete");

        patch(id, {
          cv: genData.cv,
          usedMock: genData.provider === "mock",
          generationProvider: { provider: genData.provider, model: genData.model },
        });
        appendLog(id, "llm", `Tailored CV generated via ${genData.provider}/${genData.model}`);

        currentNode = "assess";
        patch(id, { activeCapability: "cv_assess", status: "assessing" });
        appendLog(id, "llm", "Capability cv_assess: scoring the CV…");
        const assessRes = await fetch("/api/assess", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cv: genData.cv, job: ws.job }),
        });
        if (!assessRes.ok) throw new Error(`Assess failed: ${assessRes.status}`);
        const assessData = (await assessRes.json()) as {
          assessment: Assessment;
          provider: string;
        };
        patch(id, { assessment: assessData.assessment, status: "done", activeCapability: null, pipelineErrorNode: undefined });
        appendLog(id, "info", `Done. Quality score ${assessData.assessment.overall}/100`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        patch(id, { status: "error", error: message, activeCapability: null, pipelineErrorNode: currentNode });
        appendLog(id, "error", "Pipeline failed", message);
      }
    },
  };
}, {
  name: "hirehand-workspaces-v1",
  version: 1,
  storage: createJSONStorage(() => localStorage),
  skipHydration: true,
  partialize: (state): PersistedState => ({
    rawCV: state.rawCV,
    bullets: state.bullets,
    sampleLabel: state.sampleLabel,
    sourceFilename: state.sourceFilename,
    sourceKind: state.sourceKind,
    workspaces: state.workspaces,
    activeId: state.activeId,
  }),
  merge: (persisted, current) => {
    const saved = persisted as Partial<PersistedState> | undefined;
    const workspaces = (saved?.workspaces ?? current.workspaces).map((workspace) => {
      if (!IN_PROGRESS_STATUSES.has(workspace.status)) return workspace;
      return {
        ...workspace,
        status: workspace.cv ? "done" as const : "idle" as const,
        activeCapability: null,
        error: workspace.cv ? null : "Generation was interrupted. Run it again to continue.",
      };
    });

    return {
      ...current,
      ...saved,
      sourcePreviewUrl: null,
      providers: null,
      flowOpen: false,
      selectedNode: null,
      workspaces,
      activeId: workspaces.some((workspace) => workspace.id === saved?.activeId)
        ? saved?.activeId ?? current.activeId
        : workspaces[0]?.id ?? current.activeId,
    };
  },
}));

/** The active workspace, or the first one as a fallback. */
export function useActiveWorkspace(): Workspace {
  return useAgentStore(
    (s) => s.workspaces.find((w) => w.id === s.activeId) ?? s.workspaces[0],
  );
}
