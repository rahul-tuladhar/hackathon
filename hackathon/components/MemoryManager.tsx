"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, Database, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { memoryConflict, memoryUsage, MEMORY_LIMITS, searchConversations, type MemoryCategory } from "@/lib/memory";
import { useMemoryStore } from "@/lib/memory-store";
import { useAgentStore } from "@/lib/store";

function dateLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}

function sourceLabel(source: string) {
  if (source === "assistant_suggestion") return "Suggested by assistant";
  if (source === "explicit_request") return "Saved at your request";
  return "Edited by you";
}

export function MemoryManager() {
  const ready = useMemoryStore((state) => state.ready);
  const memories = useMemoryStore((state) => state.memories);
  const conversations = useMemoryStore((state) => state.conversations);
  const addMemory = useMemoryStore((state) => state.addMemory);
  const updateMemory = useMemoryStore((state) => state.updateMemory);
  const approveMemory = useMemoryStore((state) => state.approveMemory);
  const rejectMemory = useMemoryStore((state) => state.rejectMemory);
  const deleteMemory = useMemoryStore((state) => state.deleteMemory);
  const clearAll = useMemoryStore((state) => state.clearAll);
  const providers = useAgentStore((state) => state.providers);
  const refreshProviders = useAgentStore((state) => state.refreshProviders);
  const [category, setCategory] = useState<MemoryCategory>("profile");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editText, setEditText] = useState("");

  const pending = memories.filter((memory) => memory.status === "pending");
  const approved = memories.filter((memory) => memory.status === "approved");
  const visibleConversations = useMemo(() => searchConversations(conversations, search), [conversations, search]);
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedConversationId);
  const conflict = content.trim() ? memoryConflict(memories, category, content) : undefined;
  const profileUsage = memoryUsage(memories, "profile");
  const careerUsage = memoryUsage(memories, "career");

  useEffect(() => {
    if (!ready) useMemoryStore.getState().load();
    void refreshProviders();
  }, [ready, refreshProviders]);

  const submitMemory = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const result = addMemory({ category, content, source: "user_edit", status: "approved" });
    if (result) {
      setError(result);
      return;
    }
    setContent("");
  };

  const clearEverything = () => {
    if (window.confirm("Delete all saved memories and conversation history from this browser? This cannot be undone.")) {
      clearAll();
      setSelectedConversationId("");
    }
  };

  const providerLabel = providers?.llm.provider ?? "Checking configured provider…";
  const localProvider = /local|lm studio/i.test(providerLabel);

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 px-5 py-7 text-zinc-900 dark:bg-black dark:text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-7">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-600 dark:text-blue-400">Personalization</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Profile & memory</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">Teach Tailor how you want to work. Your preferences travel across job workspaces; resume evidence stays separate.</p>
          </div>
          <button type="button" onClick={clearEverything} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-rose-300 dark:hover:bg-rose-950/40">
            <Trash2 className="size-3.5" /> Clear local memory
          </button>
        </header>

        <section className="grid gap-3 sm:grid-cols-3" aria-label="Memory status">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs text-zinc-500">Approved memories</p><p className="mt-1 text-2xl font-semibold">{approved.length}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs text-zinc-500">Awaiting your review</p><p className="mt-1 text-2xl font-semibold">{pending.length}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs text-zinc-500">Saved conversations</p><p className="mt-1 text-2xl font-semibold">{conversations.length}</p>
          </div>
        </section>

        <section className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="text-sm font-semibold">Add a memory</h2><p className="mt-1 text-xs leading-5 text-zinc-500">Save a durable preference or recruiting note. “Remember that I prefer concise, direct cover letters.”</p></div>
                <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
              </div>
              <form className="mt-4 space-y-3" onSubmit={submitMemory}>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Memory category">
                  {(["profile", "career"] as const).map((item) => (
                    <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${category === item ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"}`}>{item === "profile" ? "Profile preference" : "Career & workflow"}</button>
                  ))}
                </div>
                <textarea value={content} onChange={(event) => { setContent(event.target.value); setError(""); }} maxLength={300} rows={3} aria-label="New memory" placeholder="Write one useful, lasting note…" className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-blue-800 dark:focus:ring-blue-950" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[11px] text-zinc-400">{content.length}/300 · {category === "profile" ? profileUsage : careerUsage}/{MEMORY_LIMITS[category]} stored characters</span>
                  <button type="submit" disabled={!ready || !content.trim()} className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Save approved memory</button>
                </div>
                {conflict ? <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">This may conflict with “{conflict.content}”. Review both before saving.</p> : null}
                {error ? <p role="alert" className="text-xs text-rose-600 dark:text-rose-300">{error}</p> : null}
              </form>
            </section>

            {pending.length ? <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
              <div className="flex items-center gap-2"><Clock3 className="size-4 text-amber-700 dark:text-amber-300" /><h2 className="text-sm font-semibold">Review suggestions</h2></div>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">These are proposals from conversations. They do not affect Tailor until you approve them.</p>
              <div className="mt-4 space-y-3">
                {pending.map((memory) => <MemoryCard key={memory.id} memory={memory} editing={editingId === memory.id} editText={editText} onEdit={() => { setEditingId(memory.id); setEditText(memory.content); }} onCancelEdit={() => setEditingId("")} onEditText={setEditText} onSaveEdit={() => { const result = updateMemory(memory.id, editText); setError(result ?? ""); if (!result) setEditingId(""); }} onApprove={() => { const result = approveMemory(memory.id); setError(result ?? ""); }} onReject={() => rejectMemory(memory.id)} onDelete={() => deleteMemory(memory.id)} />)}
              </div>
            </section> : null}

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Saved memories</h2><span className="text-[11px] text-zinc-400">Approved memories can guide prompts</span></div>
              <div className="mt-4 space-y-3">
                {memories.filter((memory) => memory.status !== "pending").length ? memories.filter((memory) => memory.status !== "pending").map((memory) => <MemoryCard key={memory.id} memory={memory} editing={editingId === memory.id} editText={editText} onEdit={() => { setEditingId(memory.id); setEditText(memory.content); }} onCancelEdit={() => setEditingId("")} onEditText={setEditText} onSaveEdit={() => { const result = updateMemory(memory.id, editText); setError(result ?? ""); if (!result) setEditingId(""); }} onApprove={() => { const result = approveMemory(memory.id); setError(result ?? ""); }} onReject={() => rejectMemory(memory.id)} onDelete={() => deleteMemory(memory.id)} />) : <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-xs text-zinc-500 dark:border-zinc-800">No saved memories yet. Add one here or ask the assistant to remember something.</p>}
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2"><Database className="size-4 text-blue-600" /><h2 className="text-sm font-semibold">Storage & privacy</h2></div>
              <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">Memories and up to 30 recent conversations are stored in this browser only. They are not uploaded for storage or synced to another device.</p>
              <div className="mt-3 rounded-xl bg-zinc-50 p-3 text-xs leading-5 dark:bg-zinc-900">
                <p className="font-medium">Model provider: {providerLabel}</p>
                <p className="mt-1 text-zinc-500 dark:text-zinc-400">When you send a request, Tailor includes only relevant approved memories. This request and its selected resume/job context go to the configured provider{localProvider ? ", which is local to this machine." : "."} Resume claims must still come from resume evidence.</p>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-zinc-400">Conversation history stays local unless a message is sent again as context for a new request. Searching history runs in this browser.</p>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2"><Search className="size-4 text-zinc-500" /><h2 className="text-sm font-semibold">Search past conversations</h2></div>
              <div className="relative mt-3"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search saved chats…" aria-label="Search conversations" className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900" /></div>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                {visibleConversations.length ? visibleConversations.map((conversation) => <button key={conversation.id} type="button" onClick={() => setSelectedConversationId(conversation.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedConversationId === conversation.id ? "border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30" : "border-zinc-100 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900"}`}><span className="block truncate text-xs font-medium">{conversation.title}</span><span className="mt-1 block text-[10px] text-zinc-400">{dateLabel(conversation.updatedAt)} · {conversation.messages.length} messages</span></button>) : <p className="py-6 text-center text-xs text-zinc-400">{search ? "No matches found." : "Chats will appear here as you talk with Tailor."}</p>}
              </div>
              {selectedConversation ? <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-900"><div className="flex items-center justify-between gap-2"><h3 className="truncate text-xs font-semibold">{selectedConversation.title}</h3><button type="button" onClick={() => setSelectedConversationId("")} className="text-zinc-400 hover:text-zinc-700" aria-label="Close conversation preview"><X className="size-3.5" /></button></div><div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{selectedConversation.messages.map((message, index) => <div key={`${selectedConversation.id}-${index}`} className={`rounded-lg px-3 py-2 text-xs leading-5 ${message.role === "user" ? "bg-zinc-100 dark:bg-zinc-900" : "bg-transparent text-zinc-600 dark:text-zinc-400"}`}><span className="mb-1 block text-[9px] font-semibold uppercase text-zinc-400">{message.role}{message.memoryIds?.length ? " · memory applied" : ""}</span>{message.text}</div>)}</div></div> : null}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function MemoryCard({
  memory, editing, editText, onEdit, onCancelEdit, onEditText, onSaveEdit, onApprove, onReject, onDelete,
}: {
  memory: ReturnType<typeof useMemoryStore.getState>["memories"][number];
  editing: boolean;
  editText: string;
  onEdit: () => void;
  onCancelEdit: () => void;
  onEditText: (value: string) => void;
  onSaveEdit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  const allMemories = useMemoryStore((state) => state.memories);
  const conflict = memoryConflict(allMemories, memory.category, memory.content, memory.id);
  return <article className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
    <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">{memory.category}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${memory.status === "approved" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : memory.status === "pending" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900"}`}>{memory.status}</span><span className="ml-auto text-[9px] text-zinc-400">{sourceLabel(memory.source)} · {dateLabel(memory.updatedAt)}</span></div>
    {editing ? <textarea autoFocus value={editText} onChange={(event) => onEditText(event.target.value)} maxLength={300} rows={2} className="mt-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900" /> : <p className="mt-3 whitespace-pre-wrap text-xs leading-5">{memory.content}</p>}
    {conflict ? <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[10px] leading-4 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Potential conflict with “{conflict.content}”. Review both before approving or relying on them.</p> : null}
    <div className="mt-3 flex flex-wrap gap-2">
      {editing ? <><button type="button" onClick={onSaveEdit} className="rounded-md bg-blue-600 px-2.5 py-1.5 text-[10px] font-medium text-white">Save edit</button><button type="button" onClick={onCancelEdit} className="rounded-md px-2.5 py-1.5 text-[10px] text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900">Cancel</button></> : <button type="button" onClick={onEdit} className="rounded-md px-2.5 py-1.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900">Edit</button>}
      {memory.status === "pending" ? <><button type="button" onClick={onApprove} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[10px] font-medium text-white"><Check className="size-3" /> Approve</button><button type="button" onClick={onReject} className="rounded-md px-2.5 py-1.5 text-[10px] text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950/50">Reject</button></> : null}
      <button type="button" onClick={onDelete} className="ml-auto inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[10px] text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"><Trash2 className="size-3" /> Delete</button>
    </div>
  </article>;
}
