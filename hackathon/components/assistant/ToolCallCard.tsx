"use client";

import { CheckCircle2, CircleDashed, CircleX, Wrench } from "lucide-react";

const LABELS: Record<string, string> = {
  workspace_list: "Job workspaces",
  workspace_create: "Create job workspace",
  workspace_update: "Update job workspace",
  workspace_activate: "Open job workspace",
  workspace_delete: "Delete job workspace",
  workspace_reorder: "Reorder job workspaces",
  job_board_list: "Browse team job board",
  workspace_open_board_job: "Open board role",
  ui_navigate: "Navigate Tailor",
  ui_scroll_to_section: "Open document section",
  resume_inspect: "Resume evidence",
  resume_read_text: "Read Big CV text",
  resume_set_text: "Update Big CV text",
  resume_parse: "Parse resume evidence",
  resume_selection: "Resume evidence selection",
  resume_add_evidence: "Add resume evidence",
  resume_remove_evidence: "Remove resume evidence",
  resume_load_saved: "Load saved resume",
  app_load_sample: "Load sample workspace",
  app_reset: "Reset workspace",
  app_set_section_order: "Reorder document sections",
  pipeline_inspect: "Pipeline status",
  pipeline_run: "Tailor resume pipeline",
  pipeline_flow: "Show pipeline flow",
  integrations_status: "Provider health",
  company_research: "Company research",
  memory_search: "Search personal memory",
  memory_remember: "Remember preference",
  memory_update: "Edit personal memory",
  memory_approve: "Approve personal memory",
  memory_reject: "Reject memory proposal",
  memory_delete: "Delete personal memory",
  memory_clear: "Clear personal memory",
  conversation_search: "Search past conversations",
  skills_list: "Available Tailor skills",
  skills_activate: "Activate Tailor skill",
  document_export_pdf: "Export tailored PDF",
  document_inspect: "Inspect tailored draft",
  document_copy_cv: "Copy tailored CV",
};

function shortOutput(toolName: string, value: unknown) {
  if (!value || typeof value !== "object") return String(value ?? "");
  const data = value as Record<string, unknown>;
  if (data.ok === false) return String(data.message ?? "Action could not be completed.");
  if (toolName === "workspace_list") return `${Array.isArray(data.workspaces) ? data.workspaces.length : 0} job workspaces`;
  if (toolName === "workspace_open_board_job") return `Opened ${String((data.workspace as { job?: { title?: string } } | undefined)?.job?.title ?? "job workspace")}`;
  if (toolName === "job_board_list") return `${Array.isArray(data.jobs) ? data.jobs.length : 0} board roles available`;
  if (toolName === "workspace_reorder") return "Job tabs reordered";
  if (toolName === "ui_navigate") return `Opened ${String(data.page ?? "page")}`;
  if (toolName === "ui_scroll_to_section") return `Showing ${String(data.sectionId ?? "section")}`;
  if (toolName === "resume_inspect") return `${String(data.selected ?? 0)} of ${String(data.total ?? 0)} evidence points selected`;
  if (toolName === "resume_read_text") return `${String(data.characters ?? 0)} characters read`;
  if (toolName === "resume_set_text") return `${String(data.characters ?? 0)} characters placed in Big CV`;
  if (toolName === "resume_parse") return `${String(data.evidenceCount ?? 0)} evidence points parsed`;
  if (toolName === "pipeline_inspect") return `${String(data.status ?? "unknown")} · ${data.hasDraft ? `draft ready${data.assessment && typeof data.assessment === "object" ? ` · ${(data.assessment as { overall?: number }).overall ?? "—"}/100` : ""}` : "no draft yet"}`;
  if (toolName === "pipeline_run") return data.ok ? `Draft ready · ${String(data.score ?? "—")}/100` : String(data.error ?? data.status ?? "Pipeline did not finish");
  if (toolName === "pipeline_flow") return data.open ? `Showing ${String(data.selectedNode ?? "pipeline")} step` : "Pipeline flow closed";
  if (toolName === "app_load_sample") return "Sample resume and role loaded";
  if (toolName === "app_reset") return "Workspace reset";
  if (toolName === "app_set_section_order") return "Document sections reordered";
  if (toolName === "integrations_status") {
    const providers = data.providers as Record<string, { available?: boolean; provider?: string }> | undefined;
    return [`Model: ${providers?.llm?.available ? providers.llm.provider : "unavailable"}`, `JevRouter: ${providers?.jev?.available ? providers.jev.provider : "unavailable"}`].join(" · ");
  }
  if (toolName === "company_research") return `${String(data.provider ?? "Research provider")} · ${String(data.findings ?? "").slice(0, 190)}`;
  if (toolName === "conversation_search") return `${Array.isArray(data.matches) ? data.matches.length : 0} matching conversations`;
  if (toolName === "memory_search") return `${Array.isArray(data.memories) ? data.memories.length : 0} memories found`;
  if (toolName === "skills_list") return `${Array.isArray(data.skills) ? data.skills.length : 0} built-in skills`;
  if (toolName === "skills_activate") return `Using ${(data.skill as { name?: string } | undefined)?.name ?? "Tailor skill"}`;
  if (toolName === "document_inspect") return data.cv ? `Draft ready for ${String((data.job as { title?: string } | undefined)?.title ?? "this role")}` : "No draft in this workspace yet";
  if (toolName === "document_copy_cv") return data.copied ? "CV copied to clipboard" : String(data.message ?? "Copyable CV text is ready");
  return String(data.message ?? (data.ok === true ? "Completed" : JSON.stringify(data))).slice(0, 260);
}

export function ToolCallCard({ toolName, state, input, output }: { toolName: string; state: string; input?: unknown; output?: unknown }) {
  const complete = state === "output-available";
  const failed = state === "output-error" || (complete && output && typeof output === "object" && (output as Record<string, unknown>).ok === false);
  const Icon = failed ? CircleX : complete ? CheckCircle2 : CircleDashed;
  const summary = complete ? shortOutput(toolName, output) : "Running this app action…";
  const args = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const target = typeof args.title === "string" ? args.title : typeof args.workspaceId === "string" ? args.workspaceId : typeof args.query === "string" ? `“${args.query}”` : typeof args.boardId === "string" ? args.boardId : typeof args.page === "string" ? args.page : typeof args.sectionId === "string" ? args.sectionId : typeof args.skillId === "string" ? args.skillId : "";
  return (
    <section className="my-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900" aria-label={`${LABELS[toolName] ?? toolName} tool result`}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"><Wrench className="size-3" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-800 dark:text-zinc-200">
            <span>{LABELS[toolName] ?? toolName}</span>
            {target ? <span className="truncate font-normal text-zinc-400">· {target}</span> : null}
          </div>
          <p className={`mt-1 text-[10px] leading-relaxed ${failed ? "text-rose-600 dark:text-rose-300" : "text-zinc-500 dark:text-zinc-400"}`}>{summary}</p>
        </div>
        <Icon className={`mt-0.5 size-3.5 shrink-0 ${failed ? "text-rose-500" : complete ? "text-emerald-600" : "animate-pulse text-blue-500"}`} aria-hidden="true" />
      </div>
    </section>
  );
}
