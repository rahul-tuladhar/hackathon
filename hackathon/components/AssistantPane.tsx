"use client";

import { useCallback, useMemo, useState } from "react";
import { Bot, Check, FileText, LoaderCircle, RotateCcw } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { useActiveWorkspace, useAgentStore } from "@/lib/store";

type ChatMessage = { role: "user" | "assistant"; text: string };

const INITIAL_MESSAGE: ChatMessage = {
  role: "assistant",
  text: "I can help tailor Rahul’s resume to this role, explain the evidence behind the draft, or run the generation flow. I’ll use the selected resume points and active job as context.",
};

const SUGGESTIONS = [
  "Tailor this resume for the selected job",
  "What should I improve for this role?",
  "Use Rahul’s resume",
];

function statusLabel(status: string) {
  if (status === "routing" || status === "generating" || status === "assessing") {
    return "Working";
  }
  if (status === "done") return "Draft ready";
  if (status === "error") return "Needs attention";
  return "Ready";
}

export function AssistantPane() {
  const workspace = useActiveWorkspace();
  const activeId = useAgentStore((state) => state.activeId);
  const rawCV = useAgentStore((state) => state.rawCV);
  const bullets = useAgentStore((state) => state.bullets);
  const sampleLabel = useAgentStore((state) => state.sampleLabel);
  const loadResume = useAgentStore((state) => state.loadResume);
  const runPipeline = useAgentStore((state) => state.runPipeline);
  const getState = useAgentStore.getState;
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({});
  const [busy, setBusy] = useState(false);
  const [localNotice, setLocalNotice] = useState("");
  const notice = localNotice || (workspace?.status === "error" ? workspace.error ?? "" : "");

  const messages = useMemo(
    () => threads[activeId] ?? [INITIAL_MESSAGE],
    [activeId, threads],
  );
  const setMessages = useCallback(
    (update: (previous: ChatMessage[]) => ChatMessage[]) => {
      setThreads((current) => ({
        ...current,
        [activeId]: update(current[activeId] ?? [INITIAL_MESSAGE]),
      }));
    },
    [activeId],
  );

  const context = useMemo(
    () => ({
      resume: {
        label: sampleLabel,
        loaded: Boolean(rawCV.trim()),
        selectedPoints: bullets
          .filter((bullet) => bullet.selected)
          .slice(0, 30)
          .map((bullet) => bullet.text),
        selectedPointCount: bullets.filter((bullet) => bullet.selected).length,
        availablePointCount: bullets.length,
      },
      job: {
        title: workspace?.job.title,
        company: workspace?.job.company,
        description: workspace?.job.description.slice(0, 6000),
      },
      intent: workspace?.intent,
      pipeline: {
        status: workspace?.status,
        hasTailoredDraft: Boolean(workspace?.cv),
        score: workspace?.assessment?.overall,
        assessment: workspace?.assessment?.suggestions,
        usedFallback: workspace?.usedMock,
      },
      defaultsCanFillSparseContent: true,
    }),
    [bullets, rawCV, sampleLabel, workspace],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || busy) return;
      setLocalNotice("");
      setMessages((previous) => [...previous, { role: "user", text: content }]);

      if (/^(please\s+)?(load|use)\s+rahul(?:['’]s)?\s+(saved\s+)?resume\.?$/i.test(content)) {
        loadResume();
        setMessages((previous) => [
          ...previous,
          { role: "assistant", text: "Loading Rahul’s saved resume into the workspace now." },
        ]);
        return;
      }

      const explicitPipelineRequest =
        /^(please\s+)?(?:(?:can|could)\s+you\s+)?(?:run\s+(?:the\s+)?(?:pipeline|workflow)|(?:tailor|generate|create|make)\b)/i.test(content) &&
        /\b(resume|cv|pdf|draft|pipeline|workflow)\b/i.test(content);
      if (explicitPipelineRequest) {
        setBusy(true);
        try {
          await runPipeline();
          const state = getState();
          const result = state.workspaces.find((item) => item.id === activeId);
          const score = result?.assessment?.overall;
          if (result?.cv && score !== undefined) {
            const requestedPdf = /\bpdf\b/i.test(content);
            if (requestedPdf) window.dispatchEvent(new Event("tailor:download-pdf"));
            setMessages((previous) => [
              ...previous,
              {
                role: "assistant",
                text: `The tailored draft is ready. Its quality score is ${score}/100.${requestedPdf ? " I’ve started the one-page PDF download." : " Download the one-page PDF from the Tailored CV section when you’re ready."} Confirm any default fallback points before using them.`,
              },
            ]);
          } else {
            const problem = result?.error ?? "The pipeline did not produce a draft.";
            setLocalNotice(problem);
            setMessages((previous) => [
              ...previous,
              { role: "assistant", text: `I couldn’t finish the tailoring run: ${problem}` },
            ]);
          }
        } finally {
          setBusy(false);
        }
        return;
      }

      setBusy(true);
      try {
        const conversation = [...messages, { role: "user" as const, text: content }]
          .slice(-12)
          .map((message) => ({ role: message.role, content: message.text }));
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: conversation, context }),
        });
        const data = (await response.json()) as { reply?: string; error?: string };
        if (!response.ok || !data.reply) throw new Error(data.error ?? "No answer returned.");
        setMessages((previous) => [...previous, { role: "assistant", text: data.reply! }]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setLocalNotice(message);
        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            text: "I couldn’t reach the configured language model. You can still use the workspace buttons to load Rahul’s resume or run the existing tailoring flow.",
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [activeId, busy, context, getState, loadResume, messages, runPipeline, setMessages],
  );

  const resetChat = () => {
    setThreads((current) => ({ ...current, [activeId]: [INITIAL_MESSAGE] }));
    setLocalNotice("");
  };

  const pipelineBusy = ["routing", "generating", "assessing"].includes(workspace?.status ?? "");
  const phase = useMemo(() => {
    if (!workspace) return "No active workspace";
    if (workspace.status === "done") return "Tailored draft ready";
    if (workspace.status === "error") return "Pipeline needs attention";
    return workspace.job.title
      ? `${workspace.job.title}${workspace.job.company ? ` · ${workspace.job.company}` : ""}`
      : "No role selected";
  }, [workspace]);

  return (
    <aside className="hidden w-[320px] shrink-0 flex-col border-l border-zinc-200 bg-white xl:flex 2xl:w-[380px] dark:border-zinc-800 dark:bg-zinc-950" aria-label="Resume assistant">
      <header className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
          <Bot className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Assistant</h2>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
            <span className={`size-1.5 rounded-full ${pipelineBusy ? "animate-pulse bg-blue-500" : "bg-emerald-500"}`} />
            {statusLabel(workspace?.status ?? "idle")} · workspace aware
          </div>
        </div>
        <button
          type="button"
          onClick={resetChat}
          title="Start a new chat for this role"
          aria-label="Start a new chat"
          className="grid size-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </header>

      <div className="border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-900">
        <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
          <FileText className="size-3.5 text-zinc-400" />
          <span className="truncate">{phase}</span>
        </div>
        <p className="mt-1 truncate pl-[22px] text-[10px] text-zinc-400" title={sampleLabel ?? "No resume loaded"}>
          {sampleLabel ?? "No resume loaded"} · {context.resume.selectedPointCount} selected points
        </p>
      </div>

      <Conversation className="min-h-0">
        <ConversationContent className="gap-5 p-4">
          {messages.map((message, index) => (
            <Message key={`${activeId}-${index}`} from={message.role} className="max-w-full gap-1.5">
              <MessageContent className={message.role === "user" ? "rounded-xl bg-zinc-100 px-3 py-2.5 text-[12px] leading-relaxed dark:bg-zinc-900" : "px-0 py-0 text-[12px] leading-[1.65]"}>
                <MessageResponse>{message.text}</MessageResponse>
              </MessageContent>
            </Message>
          ))}
          {busy ? (
            <div className="flex items-center gap-2 text-[11px] text-zinc-400" aria-live="polite">
              <LoaderCircle className="size-3.5 animate-spin" />
              {pipelineBusy ? "Running the resume workflow…" : "Thinking…"}
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton className="size-7" />
      </Conversation>

      <div className="space-y-3 border-t border-zinc-200 p-3 dark:border-zinc-800">
        {notice ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] leading-relaxed text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200" role="status">
            {notice}
          </div>
        ) : null}
        {messages.length === 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={busy}
                onClick={() => void sendMessage(suggestion)}
                className="rounded-full border border-zinc-200 px-2.5 py-1.5 text-left text-[10px] text-zinc-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-blue-900 dark:hover:bg-blue-950/50 dark:hover:text-blue-300"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
        <PromptInput
          onSubmit={({ text }) => sendMessage(text)}
          className="rounded-xl border border-zinc-200 bg-white shadow-sm focus-within:border-blue-300 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-blue-900"
        >
          <PromptInputBody>
            <PromptInputTextarea
              aria-label="Message the resume assistant"
              placeholder="Ask about this resume…"
              className="min-h-[74px] resize-none border-0 px-3 py-2.5 text-[12px] shadow-none focus-visible:ring-0 dark:bg-transparent"
              disabled={busy}
            />
          </PromptInputBody>
          <PromptInputFooter className="px-2 pb-2">
            <PromptInputTools>
              <span className="pl-1 text-[9px] text-zinc-400">Enter to send · Shift+Enter for newline</span>
            </PromptInputTools>
            <PromptInputSubmit
              status={busy ? "submitted" : "ready"}
              disabled={busy}
              className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              aria-label="Send message"
            />
          </PromptInputFooter>
        </PromptInput>
        <div className="flex items-center justify-center gap-1 text-[9px] text-zinc-400">
          <Check className="size-3 text-emerald-600" />
          Resume points and job context are sent when you message
        </div>
      </div>
    </aside>
  );
}
