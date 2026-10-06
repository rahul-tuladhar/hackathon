"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import { Bot, Check, FileText, LoaderCircle, RotateCcw, Wrench } from "lucide-react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools } from "@/components/ai-elements/prompt-input";
import { ToolCallCard } from "@/components/assistant/ToolCallCard";
import { useActiveWorkspace, useAgentStore } from "@/lib/store";
import { useMemoryStore } from "@/lib/memory-store";
import { selectRelevantMemories, type ChatTurn } from "@/lib/memory";
import { executeAppTool } from "@/lib/assistant-tool-executor";

const INITIAL_TEXT = "I can tailor a resume, help with recruiting and professional writing, or manage Tailor workspaces. Ask me to inspect a job, check providers, search memory, or run the existing evidence-linked pipeline.";

function archivedMessages(turns: ChatTurn[]): UIMessage[] {
  const source = turns.length ? turns : [{ role: "assistant" as const, text: INITIAL_TEXT, at: Date.now() }];
  return source.map((turn, index) => ({
    id: `archive-${turn.at ?? index}-${index}`,
    role: turn.role,
    parts: [{ type: "text" as const, text: turn.text }],
    ...(turn.memoryIds?.length || turn.historyIds?.length ? { metadata: { memoryIds: turn.memoryIds, historyIds: turn.historyIds } } : {}),
  }));
}

function archivedTurns(messages: UIMessage[], memoryIds: string[]): ChatTurn[] {
  const lastUserIndex = messages.map((message) => message.role).lastIndexOf("user");
  return messages.map((message) => {
    const textParts: string[] = [];
    const events: string[] = [];
    for (const part of message.parts) {
      if (part.type === "text") textParts.push(part.text);
      else if (part.type === "dynamic-tool") {
        const detail = part.state === "output-available" ? JSON.stringify(part.output).slice(0, 600) : JSON.stringify(part.input).slice(0, 250);
        events.push(`Tool ${part.toolName}: ${detail}`);
      } else if (part.type.startsWith("tool-")) {
        const toolPart = part as unknown as { type: string; state: string; input?: unknown; output?: unknown };
        events.push(`Tool ${toolPart.type.slice(5)}: ${JSON.stringify(toolPart.state === "output-available" ? toolPart.output : toolPart.input).slice(0, 600)}`);
      }
    }
    const text = [textParts.join("\n"), ...events].filter(Boolean).join("\n").slice(0, 1200);
    const metadata = message.metadata && typeof message.metadata === "object" ? message.metadata as { memoryIds?: string[]; historyIds?: string[] } : {};
    const currentTurn = messages.indexOf(message) > lastUserIndex;
    return {
      role: message.role === "user" ? "user" as const : "assistant" as const,
      text,
      at: Date.now(),
      ...(message.role === "assistant" && (metadata.memoryIds?.length || (currentTurn && memoryIds.length)) ? { memoryIds: metadata.memoryIds?.length ? metadata.memoryIds : memoryIds } : {}),
      ...(message.role === "assistant" && metadata.historyIds?.length ? { historyIds: metadata.historyIds } : {}),
    };
  }).filter((turn) => turn.text.trim());
}

function statusLabel(status: string) {
  if (status === "routing" || status === "generating" || status === "assessing") return "Working";
  if (status === "done") return "Draft ready";
  if (status === "error") return "Needs attention";
  return "Ready";
}

export function AssistantPane() {
  const activeId = useAgentStore((state) => state.activeId);
  const conversationId = useMemoryStore((state) => state.activeConversationByWorkspace[activeId] ?? "");
  return <AssistantPaneSession key={conversationId || activeId} />;
}

function AssistantPaneSession() {
  const workspace = useActiveWorkspace();
  const activeId = useAgentStore((state) => state.activeId);
  const allWorkspaces = useAgentStore((state) => state.workspaces);
  const rawCV = useAgentStore((state) => state.rawCV);
  const bullets = useAgentStore((state) => state.bullets);
  const sampleLabel = useAgentStore((state) => state.sampleLabel);
  const memoryReady = useMemoryStore((state) => state.ready);
  const memories = useMemoryStore((state) => state.memories);
  const conversations = useMemoryStore((state) => state.conversations);
  const activeConversationByWorkspace = useMemoryStore((state) => state.activeConversationByWorkspace);
  const ensureConversation = useMemoryStore((state) => state.ensureConversation);
  const startConversation = useMemoryStore((state) => state.startConversation);
  const setConversationMessages = useMemoryStore((state) => state.setConversationMessages);
  const memoryState = useMemoryStore.getState;
  const [input, setInput] = useState("");
  const [localNotice, setLocalNotice] = useState("");
  const [appliedMemoryIds, setAppliedMemoryIds] = useState<string[]>([]);
  const approvedMemoryCount = memories.filter((memory) => memory.status === "approved").length;
  const conversationId = activeConversationByWorkspace[activeId] ?? "";
  const activeConversation = conversations.find((item) => item.id === conversationId);
  const [initialMessages] = useState(() => archivedMessages(activeConversation?.messages ?? []));

  useEffect(() => {
    if (memoryReady && activeId) ensureConversation(activeId, { role: "assistant", text: INITIAL_TEXT, at: Date.now() });
  }, [activeId, ensureConversation, memoryReady]);

  const context = useMemo(() => ({
    activeWorkspaceId: activeId,
    workspaces: allWorkspaces.map(({ id, tabName, job, intent, status, cv, assessment }) => ({ id, tabName, job, intent, status, hasDraft: Boolean(cv), score: assessment?.overall })),
    resume: {
      label: sampleLabel,
      loaded: Boolean(rawCV.trim()),
      selectedEvidence: bullets.filter((bullet) => bullet.selected).slice(0, 30).map(({ id, text }) => ({ id, text })),
      selectedCount: bullets.filter((bullet) => bullet.selected).length,
      totalCount: bullets.length,
    },
    activePipeline: {
      status: workspace?.status,
      hasDraft: Boolean(workspace?.cv),
      score: workspace?.assessment?.overall,
    },
  }), [activeId, allWorkspaces, bullets, rawCV, sampleLabel, workspace]);

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/assistant",
    prepareSendMessagesRequest: ({ messages: requestMessages, body }) => {
      const lastUserIndex = requestMessages.map((message) => message.role).lastIndexOf("user");
      // Keep one prior assistant turn for conversational continuity, then the
      // current user turn and its tool-call/result parts. Full history remains
      // searchable in local memory and is retrieved only by conversation_search.
      const startAt = lastUserIndex > 0 ? lastUserIndex - 1 : Math.max(0, requestMessages.length - 2);
      return { body: { ...body, messages: requestMessages.slice(startAt) } };
    },
  }), []);
  const { messages, sendMessage, addToolOutput, status, error } = useChat({
    id: conversationId || activeId,
    messages: initialMessages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (problem) => setLocalNotice(problem.message || "Assistant request failed."),
    onToolCall: ({ toolCall }) => {
      const call = toolCall as unknown as { toolName: string; toolCallId: string; input: Record<string, unknown>; dynamic?: boolean };
      void executeAppTool(call.toolName, call.input ?? {}, conversationId).then((output) => {
        addToolOutput({ tool: call.toolName as never, toolCallId: call.toolCallId, output: output as never });
      }).catch((problem: unknown) => {
        addToolOutput({ tool: call.toolName as never, toolCallId: call.toolCallId, state: "output-error", errorText: problem instanceof Error ? problem.message : "App action failed." } as never);
      });
    },
    onFinish: ({ messages: completedMessages }) => {
      if (!conversationId) return;
      const savedTurns = archivedTurns(completedMessages, appliedMemoryIds);
      setConversationMessages(conversationId, savedTurns);
      const lastUser = [...completedMessages].reverse().find((message) => message.role === "user");
      const userText = lastUser?.parts.filter((part) => part.type === "text").map((part) => part.text).join(" ") ?? "";
      if (/\b(i prefer|i like|i dislike|i hate|i want to|i'm looking for|i am looking for|remember|from now on|in future|please stop|my goal|don't|do not|never)\b/i.test(userText)) {
        const saved = memoryState().conversations.find((item) => item.id === conversationId);
        if (saved) void fetch("/api/memory/propose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: saved.messages.slice(-6).map((message) => ({ role: message.role, content: message.text })) }) })
          .then(async (response) => response.ok ? response.json() as Promise<{ proposals?: Array<{ category: "profile" | "career"; content: string }> }> : null)
          .then((data) => data?.proposals?.forEach((proposal) => useMemoryStore.getState().addMemory({ ...proposal, source: "assistant_suggestion", status: "pending", conversationId })))
          .catch(() => undefined);
      }
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const notice = localNotice || error?.message || (workspace?.status === "error" ? workspace.error ?? "" : "");

  const submit = useCallback((content: string) => {
    const value = content.trim();
    if (!value || busy) return;
    setLocalNotice("");
    const selected = selectRelevantMemories(useMemoryStore.getState().memories, `${value} ${workspace?.job.title ?? ""} ${workspace?.job.description ?? ""}`);
    setAppliedMemoryIds(selected.map((memory) => memory.id));
    const asksPastContext = /\b(earlier|previous(?:ly)?|past conversation|last time|we discussed|we talked about|did i tell you|did we|what did i say|what did we|remember when)\b/i.test(value);
    void sendMessage({ text: value }, { body: { context, memories: selected, recallHistoryRequested: asksPastContext } });
    setInput("");
  }, [busy, context, sendMessage, workspace?.job.description, workspace?.job.title]);

  const resetChat = () => {
    startConversation(activeId, { role: "assistant", text: INITIAL_TEXT, at: Date.now() });
    setLocalNotice("");
  };
  const pipelineBusy = ["routing", "generating", "assessing"].includes(workspace?.status ?? "");
  const phase = workspace?.job.title ? `${workspace.job.title}${workspace.job.company ? ` · ${workspace.job.company}` : ""}` : "No role selected";

  return (
    <aside className="hidden w-[320px] shrink-0 flex-col border-l border-zinc-200 bg-white xl:flex 2xl:w-[380px] dark:border-zinc-800 dark:bg-zinc-950" aria-label="Career assistant">
      <header className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"><Bot className="size-4" aria-hidden="true" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Career agent</h2>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400"><span className={`size-1.5 rounded-full ${busy || pipelineBusy ? "animate-pulse bg-blue-500" : "bg-emerald-500"}`} />{busy ? "Using Tailor tools" : statusLabel(workspace?.status ?? "idle")} · app aware</div>
        </div>
        <button type="button" onClick={resetChat} title="Start a new chat for this role" aria-label="Start a new chat" className="grid size-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"><RotateCcw className="size-3.5" /></button>
      </header>

      <div className="border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-900">
        <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-700 dark:text-zinc-300"><FileText className="size-3.5 text-zinc-400" /><span className="truncate">{phase}</span></div>
        <p className="mt-1 truncate pl-[22px] text-[10px] text-zinc-400" title={sampleLabel ?? "No resume loaded"}>{sampleLabel ?? "No resume loaded"} · {context.resume.selectedCount} selected evidence points</p>
      </div>

      <Conversation className="min-h-0">
        <ConversationContent className="gap-5 p-4">
          {messages.map((message) => (
            <Message key={`${conversationId}-${message.id}`} from={message.role} className="max-w-full gap-1.5">
              {message.parts.map((part, partIndex) => {
                if (part.type === "text") return <MessageContent key={`${message.id}-${partIndex}`} className={message.role === "user" ? "rounded-xl bg-zinc-100 px-3 py-2.5 text-[12px] leading-relaxed dark:bg-zinc-900" : "px-0 py-0 text-[12px] leading-[1.65]"}><MessageResponse>{part.text}</MessageResponse></MessageContent>;
                if (part.type === "dynamic-tool") return <ToolCallCard key={part.toolCallId} toolName={part.toolName} state={part.state} input={part.input} output={part.state === "output-available" ? part.output : undefined} />;
                if (part.type.startsWith("tool-")) {
                  const tool = part as unknown as { type: string; state: string; toolCallId: string; input?: unknown; output?: unknown };
                  return <ToolCallCard key={tool.toolCallId} toolName={tool.type.slice(5)} state={tool.state} input={tool.input} output={tool.output} />;
                }
                return null;
              })}
              {message.role === "assistant" && memoryReady && ((((message.metadata as { memoryIds?: string[] } | undefined)?.memoryIds?.length ?? 0) > 0 || (appliedMemoryIds.length > 0 && message.id === messages.at(-1)?.id))) ? <span className="w-fit rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">Personal memory available to this response</span> : null}
            </Message>
          ))}
          {busy ? <div className="flex items-center gap-2 text-[11px] text-zinc-400" aria-live="polite"><LoaderCircle className="size-3.5 animate-spin" />{pipelineBusy ? "Running the resume workflow…" : "Thinking and using app tools…"}</div> : null}
        </ConversationContent>
        <ConversationScrollButton className="size-7" />
      </Conversation>

      <div className="space-y-3 border-t border-zinc-200 p-3 dark:border-zinc-800">
        {notice ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] leading-relaxed text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200" role="status">{notice}</div> : null}
        {messages.length <= 1 ? <div className="flex flex-wrap gap-1.5">{["Inspect my app and resume", "Check integrations", "List available skills", "How should I prepare for this role?"].map((suggestion) => <button key={suggestion} type="button" disabled={busy} onClick={() => submit(suggestion)} className="rounded-full border border-zinc-200 px-2.5 py-1.5 text-left text-[10px] text-zinc-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-blue-900 dark:hover:bg-blue-950/50 dark:hover:text-blue-300">{suggestion}</button>)}</div> : null}
        <PromptInput onSubmit={() => submit(input)} className="rounded-xl border border-zinc-200 bg-white shadow-sm focus-within:border-blue-300 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-blue-900">
          <PromptInputBody><PromptInputTextarea value={input} onChange={(event) => setInput(event.target.value)} aria-label="Message the career agent" placeholder="Ask Tailor to do something in the app…" className="min-h-[74px] resize-none border-0 px-3 py-2.5 text-[12px] shadow-none focus-visible:ring-0 dark:bg-transparent" disabled={busy} /></PromptInputBody>
          <PromptInputFooter className="px-2 pb-2"><PromptInputTools><span className="flex items-center gap-1 pl-1 text-[9px] text-zinc-400"><Wrench className="size-3" />App tools run visibly</span></PromptInputTools><PromptInputSubmit status={busy ? "submitted" : "ready"} disabled={busy || !input.trim()} className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60" aria-label="Send message" /></PromptInputFooter>
        </PromptInput>
        <div className="flex items-center justify-center gap-1 text-[9px] text-zinc-400"><Check className="size-3 text-emerald-600" />{approvedMemoryCount ? "Approved memory is included when relevant" : "No approved personal memory is active"} · stored in this browser</div>
      </div>
    </aside>
  );
}
