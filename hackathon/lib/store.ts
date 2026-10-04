"use client";

import jobs from "@/app/jobs";
import { create } from "zustand";
import { parseBigCV } from "./sample";
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
    jev: null,
    cv: null,
    assessment: null,
    research: null,
    status: "idle",
    activeCapability: null,
    pipelineErrorNode: undefined,
    logs: [],
    usedMock: false,
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
    error: null,
  };
}

const firstWorkspace = makeWorkspace();

type State = {
  rawCV: string;
  bullets: BigCVBullet[];
  sampleLabel: string | null;
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
  addBullet: (text: string) => void;
  removeBullet: (id: string) => void;
  refreshProviders: () => Promise<void>;
  // workspaces
  addWorkspace: (job?: JobTarget) => void;
  openBoardJob: (boardId: string) => void;
  removeWorkspace: (id: string) => void;
  setActiveId: (id: string) => void;
  setJob: (patch: Partial<JobTarget>) => void;
  setIntent: (intent: string) => void;
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

export const useAgentStore = create<State & Actions>((set, get) => {
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
    providers: null,
    workspaces: [firstWorkspace],
    activeId: firstWorkspace.id,
    flowOpen: false,
    selectedNode: null,
    sectionOrder: DEFAULT_SECTION_ORDER,

    hydrateSample: () => {
      import("./sample").then(({ SAMPLE_BIG_CV, SAMPLE_JOB }) => {
        const ws = makeWorkspace(
          SAMPLE_JOB,
          "Tailor this for the payments platform role and emphasise reliability and scale. Keep it to one page, ATS-friendly.",
        );
        set({
          rawCV: SAMPLE_BIG_CV,
          bullets: parseBigCV(SAMPLE_BIG_CV),
          sampleLabel: "Payments sample",
          workspaces: [ws],
          activeId: ws.id,
        });
      });
    },

    loadResume: () => {
      import("./rahul-resume").then(({ RAHUL_RESUME, RAHUL_DEFAULT_INTENT }) => {
        set((s) => ({
          rawCV: RAHUL_RESUME,
          bullets: parseBigCV(RAHUL_RESUME),
          sampleLabel: "Rahul Tuladhar (real resume)",
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
        set((s) => ({
          rawCV: data.text,
          bullets,
          sampleLabel: `${file.name} · ${bullets.length} bullets`,
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
      const ws = makeWorkspace();
      set({
        rawCV: "",
        bullets: [],
        sampleLabel: null,
        workspaces: [ws],
        activeId: ws.id,
        flowOpen: false,
        selectedNode: null,
      });
    },

    setRawCV: (text) => set({ rawCV: text }),

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

        let research: string | null = null;
        if (jev.executionPlan.includes("company_research")) {
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

        patch(id, { activeCapability: "cv_generate", status: "generating" });
        appendLog(id, "llm", "Capability cv_generate: tailoring the CV…");
        const genRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            bullets: state.bullets,
            job: ws.job,
            intent: ws.intent,
            plan: jev.executionPlan,
            research,
          }),
        });
        if (!genRes.ok) throw new Error(`Generate failed: ${genRes.status}`);
        const genData = (await genRes.json()) as {
          cv: GeneratedCV;
          provider: string;
          model: string;
        };
        patch(id, { cv: genData.cv, usedMock: genData.provider === "mock" });
        appendLog(id, "llm", `Tailored CV generated via ${genData.provider}/${genData.model}`);

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
        patch(id, { assessment: assessData.assessment, status: "done", activeCapability: null });
        appendLog(id, "info", `Done. Quality score ${assessData.assessment.overall}/100`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const current = get().workspaces.find((w) => w.id === id);
        const failedNode = current?.activeCapability === "company_research"
          ? "research"
          : current?.activeCapability === "cv_generate"
            ? "generate"
            : current?.activeCapability === "cv_assess"
              ? "assess"
              : current?.jev
                ? "generate"
                : "jev";
        patch(id, {
          status: "error",
          error: message,
          activeCapability: null,
          pipelineErrorNode: failedNode,
        });
        appendLog(id, "error", "Pipeline failed", message);
      }
    },
  };
});

/** The active workspace, or the first one as a fallback. */
export function useActiveWorkspace(): Workspace {
  return useAgentStore(
    (s) => s.workspaces.find((w) => w.id === s.activeId) ?? s.workspaces[0],
  );
}
