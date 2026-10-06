"use client";

import { useAgentStore } from "@/lib/store";
import { useMemoryStore } from "@/lib/memory-store";
import { searchConversations } from "@/lib/memory";
import { getTailorSkill, TAILOR_SKILLS } from "@/lib/assistant-skills";
import jobs from "@/app/jobs";
import { DEFAULT_SECTION_ORDER } from "@/lib/store";
import { FLOW_NODES } from "@/lib/pipeline";

type Input = Record<string, unknown>;

const text = (value: unknown, max = 6000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const fail = (message: string) => ({ ok: false, message });

/** Execute only tools declared by /api/assistant; never interprets code or URLs. */
export async function executeAppTool(name: string, input: Input, conversationId?: string): Promise<unknown> {
  const app = useAgentStore.getState();
  const memory = useMemoryStore.getState();
  const targetId = text(input.workspaceId) || app.activeId;
  const workspace = (id = targetId) => useAgentStore.getState().workspaces.find((item) => item.id === id);

  switch (name) {
    case "workspace_list": {
      const state = useAgentStore.getState();
      return { ok: true, activeId: state.activeId, workspaces: state.workspaces.map(({ id, tabName, job, intent, status, cv, assessment }) => ({ id, tabName, job, intent, status, hasDraft: Boolean(cv), score: assessment?.overall })) };
    }
    case "workspace_create": {
      const job = { title: text(input.title, 180), company: text(input.company, 180), url: text(input.url, 1000), description: text(input.description, 10000) };
      app.addWorkspace(job);
      const createdId = useAgentStore.getState().activeId;
      if (typeof input.intent === "string") useAgentStore.getState().updateWorkspace(createdId, { intent: text(input.intent, 2000) });
      return { ok: true, created: workspace(createdId), activeId: createdId };
    }
    case "workspace_update": {
      const id = text(input.workspaceId, 100);
      if (!workspace(id)) return fail("That workspace ID does not exist.");
      const job: Record<string, string> = {};
      for (const key of ["title", "company", "url", "description"] as const) if (typeof input[key] === "string") job[key] = text(input[key], key === "description" ? 10000 : key === "url" ? 1000 : 180);
      useAgentStore.getState().updateWorkspace(id, { ...(input.tabName !== undefined ? { tabName: text(input.tabName, 80) || null } : {}), ...(Object.keys(job).length ? { job } : {}), ...(typeof input.intent === "string" ? { intent: text(input.intent, 2000) } : {}) });
      return { ok: true, workspace: workspace(id) };
    }
    case "workspace_activate": {
      const id = text(input.workspaceId, 100);
      if (!workspace(id)) return fail("That workspace ID does not exist.");
      useAgentStore.getState().setActiveId(id);
      return { ok: true, activeWorkspace: workspace(id) };
    }
    case "workspace_delete": {
      const id = text(input.workspaceId, 100);
      if (!workspace(id)) return fail("That workspace ID does not exist.");
      if (useAgentStore.getState().workspaces.length <= 1) return fail("Tailor keeps one workspace open; create another before deleting this one.");
      useAgentStore.getState().removeWorkspace(id);
      return { ok: true, deletedWorkspaceId: id, remaining: useAgentStore.getState().workspaces.length };
    }
    case "workspace_reorder": {
      const state = useAgentStore.getState();
      const from = Number(input.from);
      const to = Number(input.to);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= state.workspaces.length || to >= state.workspaces.length) return fail("Tab positions must be valid zero-based workspace indexes.");
      state.reorderWorkspaces(from, to);
      return { ok: true, order: useAgentStore.getState().workspaces.map(({ id, tabName, job }) => ({ id, name: tabName || job.title || "Untitled job" })) };
    }
    case "job_board_list":
      return { ok: true, jobs: Object.entries(jobs).map(([id, job]) => ({ id, title: job.title, company: job.company, baseRange: job.baseRange, description: job.description })) };
    case "workspace_open_board_job": {
      const boardId = text(input.boardId, 100);
      if (!Object.hasOwn(jobs, boardId)) return fail("That job-board ID does not exist. Use job_board_list to inspect current options.");
      useAgentStore.getState().openBoardJob(boardId);
      const activeId = useAgentStore.getState().activeId;
      return { ok: true, workspace: workspace(activeId), activeId };
    }
    case "ui_navigate": {
      const page = input.page;
      if (page !== "workspace" && page !== "jobs" && page !== "profile") return fail("Choose workspace, jobs, or profile.");
      window.dispatchEvent(new CustomEvent("tailor:navigate", { detail: page }));
      return { ok: true, page, route: page === "workspace" ? "/" : page === "jobs" ? "/jobs" : "/profile" };
    }
    case "ui_scroll_to_section": {
      const sectionId = text(input.sectionId, 30);
      if (!DEFAULT_SECTION_ORDER.includes(sectionId)) return fail("Choose one of the six workspace sections: resume, target, pipeline, cv, quality, trace.");
      const element = document.getElementById(sectionId);
      if (!element) return fail("That section is not currently mounted. Navigate to the workspace first.");
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      return { ok: true, sectionId };
    }
    case "resume_inspect": {
      const state = useAgentStore.getState();
      return { ok: true, resume: state.sampleLabel, rawResumeLoaded: Boolean(state.rawCV.trim()), selected: state.bullets.filter((b) => b.selected).length, total: state.bullets.length, evidence: state.bullets.map(({ id, text: content, tags, source, selected }) => ({ id, text: content, tags, source, selected })) };
    }
    case "resume_read_text": {
      const rawCV = useAgentStore.getState().rawCV;
      return { ok: true, characters: rawCV.length, text: rawCV };
    }
    case "resume_set_text": {
      const resumeText = typeof input.text === "string" ? input.text.trim() : "";
      if (!resumeText) return fail("Provide resume text to put into the Big CV editor.");
      if (resumeText.length > 30000) return fail("Resume text is longer than Tailor's 30,000 character editor limit.");
      useAgentStore.getState().setRawCV(resumeText);
      return { ok: true, characters: resumeText.length, parsedEvidenceCount: useAgentStore.getState().bullets.length, message: "Resume text replaced. Call resume_parse to turn it into evidence points." };
    }
    case "resume_parse":
      useAgentStore.getState().parseFromRaw();
      return { ok: true, evidenceCount: useAgentStore.getState().bullets.length, evidence: useAgentStore.getState().bullets.map(({ id, text: content, source }) => ({ id, text: content, source })) };
    case "resume_selection": {
      const ids = Array.isArray(input.bulletIds) ? input.bulletIds.filter((id): id is string => typeof id === "string") : [];
      const selected = input.selected === true;
      const known = new Set(useAgentStore.getState().bullets.map((b) => b.id));
      const changed = ids.filter((id) => known.has(id));
      changed.forEach((id) => {
        const bullet = useAgentStore.getState().bullets.find((item) => item.id === id);
        if (bullet && bullet.selected !== selected) useAgentStore.getState().toggleBullet(id);
      });
      return { ok: true, requested: ids.length, updated: changed.length, missingIds: ids.filter((id) => !known.has(id)), selected };
    }
    case "resume_add_evidence": {
      const content = text(input.text, 1200);
      if (!content) return fail("Evidence text is required.");
      useAgentStore.getState().addBullet(content);
      return { ok: true, added: useAgentStore.getState().bullets.at(-1) };
    }
    case "resume_remove_evidence": {
      const id = text(input.evidenceId, 100);
      if (!useAgentStore.getState().bullets.some((bullet) => bullet.id === id)) return fail("That evidence ID does not exist.");
      useAgentStore.getState().removeBullet(id);
      return { ok: true, removedEvidenceId: id };
    }
    case "resume_load_saved": {
      await useAgentStore.getState().loadResume();
      return { ok: true, message: "Saved resume loaded into the shared resume evidence pool.", evidenceCount: useAgentStore.getState().bullets.length };
    }
    case "app_load_sample":
      await useAgentStore.getState().hydrateSample();
      return { ok: true, activeId: useAgentStore.getState().activeId, workspaces: useAgentStore.getState().workspaces.length, evidenceCount: useAgentStore.getState().bullets.length };
    case "app_reset":
      useAgentStore.getState().clearAll();
      return { ok: true, activeId: useAgentStore.getState().activeId, workspaces: 1, evidenceCount: 0 };
    case "app_set_section_order": {
      const order = Array.isArray(input.sectionIds) ? input.sectionIds.filter((id): id is string => typeof id === "string") : [];
      if (order.length !== DEFAULT_SECTION_ORDER.length || new Set(order).size !== DEFAULT_SECTION_ORDER.length || DEFAULT_SECTION_ORDER.some((id) => !order.includes(id))) return fail("Provide each of these section IDs exactly once: resume, target, pipeline, cv, quality, trace.");
      useAgentStore.getState().setSectionOrder(order);
      return { ok: true, sectionOrder: order };
    }
    case "pipeline_inspect": {
      const item = workspace();
      if (!item) return fail("That workspace does not exist.");
      return { ok: true, workspaceId: item.id, title: item.job.title, company: item.job.company, status: item.status, error: item.error, hasDraft: Boolean(item.cv), assessment: item.assessment, jev: item.jev ? { provider: item.jev.provider, transport: item.jev.transport, executionPlan: item.jev.executionPlan, rationale: item.jev.rationale } : null, recentLogs: item.logs.slice(-12) };
    }
    case "pipeline_run": {
      if (!workspace()) return fail("That workspace does not exist.");
      useAgentStore.getState().setActiveId(targetId);
      await useAgentStore.getState().runPipeline();
      const result = workspace();
      return { ok: result?.status === "done", workspaceId: targetId, status: result?.status, error: result?.error, score: result?.assessment?.overall, hasDraft: Boolean(result?.cv), evidenceIds: result?.cv?.bullets.map((bullet) => bullet.evidenceId), fallbackCopyNeedsReview: result?.usedMock };
    }
    case "pipeline_flow": {
      const open = input.open === true;
      if (input.step !== undefined && !FLOW_NODES.some((node) => node.key === input.step)) return fail("That pipeline step does not exist.");
      const state = useAgentStore.getState();
      state.setFlowOpen(open);
      if (open && typeof input.step === "string") state.selectNode(input.step);
      return { ok: true, open, selectedNode: open ? (typeof input.step === "string" ? input.step : state.selectedNode) : null };
    }
    case "integrations_status": {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) return fail(`Provider status request failed (${response.status}).`);
      const providers = await response.json();
      useAgentStore.setState({ providers });
      return { ok: true, providers, availableActions: ["Tailor generation and assessment", "JevRouter planning", "Company research when configured"], unavailable: ["Email sending is not configured; Tailor can draft messages for review but cannot send them."] };
    }
    case "company_research": {
      const item = workspace();
      if (!item) return fail("That workspace does not exist.");
      const response = await fetch("/api/research", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ job: item.job, intent: item.intent }) });
      const result = await response.json();
      if (!response.ok) return fail(result.error ?? `Research failed (${response.status}).`);
      useAgentStore.setState((state) => ({ workspaces: state.workspaces.map((ws) => ws.id === item.id ? { ...ws, research: result.findings } : ws) }));
      return { ok: true, workspaceId: item.id, provider: result.provider, findings: result.findings };
    }
    case "memory_search": {
      const query = text(input.query, 200);
      const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const matches = memory.memories.filter((item) => !terms.length || terms.some((term) => item.content.toLocaleLowerCase().includes(term)));
      return { ok: true, query, memories: matches.map(({ id, category, content, source, status, createdAt, updatedAt }) => ({ id, category, content, source, status, createdAt, updatedAt })) };
    }
    case "memory_remember": {
      const category = input.category === "career" ? "career" : input.category === "profile" ? "profile" : null;
      if (!category) return fail("Choose the profile or career memory category.");
      const content = text(input.content, 300);
      const error = useMemoryStore.getState().addMemory({ category, content, source: "explicit_request", status: "approved", conversationId });
      if (error) return fail(error);
      return { ok: true, saved: useMemoryStore.getState().memories.at(-1) };
    }
    case "memory_update": {
      const error = useMemoryStore.getState().updateMemory(text(input.memoryId, 100), text(input.content, 300));
      return error ? fail(error) : { ok: true, memory: useMemoryStore.getState().memories.find((item) => item.id === input.memoryId) };
    }
    case "memory_approve": {
      const error = useMemoryStore.getState().approveMemory(text(input.memoryId, 100));
      return error ? fail(error) : { ok: true, memory: useMemoryStore.getState().memories.find((item) => item.id === input.memoryId) };
    }
    case "memory_reject": {
      const id = text(input.memoryId, 100);
      if (!memory.memories.some((item) => item.id === id)) return fail("That memory ID does not exist.");
      useMemoryStore.getState().rejectMemory(id);
      return { ok: true, memoryId: id, status: "rejected" };
    }
    case "memory_delete": {
      const id = text(input.memoryId, 100);
      if (!memory.memories.some((item) => item.id === id)) return fail("That memory ID does not exist.");
      useMemoryStore.getState().deleteMemory(id);
      return { ok: true, deletedMemoryId: id };
    }
    case "memory_clear":
      useMemoryStore.getState().clearAll();
      return { ok: true, memoryCount: 0, conversationCount: 0 };
    case "conversation_search": {
      const found = searchConversations(memory.conversations, text(input.query, 200)).slice(0, 5);
      return { ok: true, matches: found.map((conversation) => ({ id: conversation.id, workspaceId: conversation.workspaceId, title: conversation.title, updatedAt: conversation.updatedAt, excerpts: conversation.messages.slice(-8).map(({ role, text: content }) => ({ role, text: content.slice(0, 350) })) })) };
    }
    case "skills_list":
      return { ok: true, skills: TAILOR_SKILLS.map(({ id, name, summary }) => ({ id, name, summary })) };
    case "skills_activate": {
      const skill = getTailorSkill(text(input.skillId, 80));
      return skill ? { ok: true, skill: { id: skill.id, name: skill.name, instructions: skill.instructions } } : fail("That Tailor skill does not exist. Use skills_list to inspect available skills.");
    }
    case "document_export_pdf": {
      const item = workspace(targetId);
      if (!item) return fail("That workspace does not exist.");
      if (!item.cv) return fail("There is no tailored draft in that workspace yet. Run pipeline_run first.");
      useAgentStore.getState().setActiveId(targetId);
      window.dispatchEvent(new Event("tailor:download-pdf"));
      return { ok: true, workspaceId: targetId, message: "PDF download started." };
    }
    case "document_inspect": {
      const item = workspace(targetId);
      if (!item) return fail("That workspace does not exist.");
      const evidence = new Map(useAgentStore.getState().bullets.map((bullet) => [bullet.id, bullet.text]));
      return { ok: true, workspaceId: item.id, job: item.job, intent: item.intent, cv: item.cv ? { ...item.cv, bullets: item.cv.bullets.map((bullet) => ({ ...bullet, evidenceText: bullet.evidenceId ? evidence.get(bullet.evidenceId) ?? null : null })) } : null, assessment: item.assessment, status: item.status, usedMock: item.usedMock };
    }
    case "document_copy_cv": {
      const item = workspace(targetId);
      if (!item) return fail("That workspace does not exist.");
      if (!item.cv) return fail("There is no tailored draft in that workspace yet. Run pipeline_run first.");
      const skills = item.cv.skills.join(" · ");
      const bullets = item.cv.bullets.map((bullet) => `- ${bullet.text}${bullet.evidenceId ? `  \`← ${bullet.evidenceId}\`` : ""}`).join("\n");
      const cover = item.cv.coverNote ? `\n## Cover note\n\n> ${item.cv.coverNote}` : "";
      const markdown = `# ${item.cv.headline}\n\n${item.cv.summary}\n\n**Skills:** ${skills}\n\n## Experience\n\n${bullets}\n${cover}`;
      useAgentStore.getState().setActiveId(targetId);
      try {
        await navigator.clipboard.writeText(markdown);
        return { ok: true, copied: true, workspaceId: targetId, markdown };
      } catch {
        return { ok: true, copied: false, workspaceId: targetId, markdown, message: "Clipboard access was unavailable; the Markdown is included for you to copy." };
      }
    }
    default:
      return fail(`Unknown app tool: ${name}`);
  }
}
