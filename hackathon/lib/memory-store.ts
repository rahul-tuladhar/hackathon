"use client";

import { create } from "zustand";
import {
  emptyMemoryData,
  MAX_CONVERSATIONS,
  MAX_MEMORY_ENTRY_LENGTH,
  MAX_TURNS_PER_CONVERSATION,
  MAX_TURN_LENGTH,
  memoryUsage,
  normalizeMemoryData,
  readMemoryData,
  writeMemoryData,
  type CareerConversation,
  type ChatTurn,
  type MemoryCategory,
  type MemorySource,
  type PersonalMemory,
  type PersonalMemoryData,
} from "./memory";

type MemoryState = PersonalMemoryData & {
  ready: boolean;
  load: () => void;
  addMemory: (input: { category: MemoryCategory; content: string; source: MemorySource; status?: "pending" | "approved"; conversationId?: string }) => string | null;
  updateMemory: (id: string, content: string) => string | null;
  approveMemory: (id: string) => string | null;
  rejectMemory: (id: string) => void;
  deleteMemory: (id: string) => void;
  clearAll: () => void;
  ensureConversation: (workspaceId: string, initialMessage: ChatTurn) => string;
  startConversation: (workspaceId: string, initialMessage: ChatTurn) => string;
  appendConversationTurn: (conversationId: string, turn: ChatTurn) => void;
  setConversationMessages: (conversationId: string, messages: ChatTurn[]) => void;
};

const id = () => typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2);

function persist(data: PersonalMemoryData) {
  writeMemoryData(data);
}

function budgetError(memories: PersonalMemory[], category: MemoryCategory, nextContent: string, ignoreId?: string) {
  const other = memories.filter((item) => item.id !== ignoreId);
  const nextUsed = memoryUsage(other, category) + nextContent.length;
  const limits = category === "profile" ? 1375 : 2200;
  return nextUsed > limits
    ? `${category === "profile" ? "Profile" : "Career memory"} is at ${memoryUsage(other, category)}/${limits} characters. Shorten or remove an entry before saving.`
    : null;
}

function withConversation(data: PersonalMemoryData, conversation: CareerConversation): PersonalMemoryData {
  const conversations = [...data.conversations.filter((item) => item.id !== conversation.id), conversation]
    .sort((a, b) => a.updatedAt - b.updatedAt)
    .slice(-MAX_CONVERSATIONS);
  return { ...data, conversations };
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  ...emptyMemoryData(),
  ready: false,

  load: () => {
    const saved = readMemoryData();
    set({ ...saved, ready: true });
  },

  addMemory: ({ category, content, source, status = "pending", conversationId }) => {
    const clean = content.trim().slice(0, MAX_MEMORY_ENTRY_LENGTH);
    if (!clean) return "Enter a memory before saving.";
    const current = get();
    const normalized = clean.toLocaleLowerCase().replace(/\s+/g, " ");
    if (current.memories.some((item) => item.category === category && item.status !== "rejected" && item.content.toLocaleLowerCase().replace(/\s+/g, " ") === normalized)) {
      return "That memory already exists.";
    }
    const error = budgetError(current.memories, category, clean);
    if (error) return error;
    const now = Date.now();
    const memory: PersonalMemory = { id: id(), category, content: clean, source, status, createdAt: now, updatedAt: now, ...(conversationId ? { conversationId } : {}) };
    const next = { version: 1 as const, memories: [...current.memories, memory], conversations: current.conversations, activeConversationByWorkspace: current.activeConversationByWorkspace };
    persist(next);
    set(next);
    return null;
  },

  updateMemory: (memoryId, content) => {
    const clean = content.trim().slice(0, MAX_MEMORY_ENTRY_LENGTH);
    if (!clean) return "Memory cannot be empty.";
    const current = get();
    const target = current.memories.find((item) => item.id === memoryId);
    if (!target) return "Memory no longer exists.";
    const normalized = clean.toLocaleLowerCase().replace(/\s+/g, " ");
    if (current.memories.some((item) => item.id !== memoryId && item.category === target.category && item.status !== "rejected" && item.content.toLocaleLowerCase().replace(/\s+/g, " ") === normalized)) {
      return "That memory already exists.";
    }
    const error = budgetError(current.memories, target.category, clean, memoryId);
    if (error) return error;
    const memories = current.memories.map((item) => item.id === memoryId ? { ...item, content: clean, source: "user_edit" as const, updatedAt: Date.now() } : item);
    const next = { version: 1 as const, memories, conversations: current.conversations, activeConversationByWorkspace: current.activeConversationByWorkspace };
    persist(next);
    set(next);
    return null;
  },

  approveMemory: (memoryId) => {
    const current = get();
    const target = current.memories.find((item) => item.id === memoryId);
    if (!target) return "Memory no longer exists.";
    const error = budgetError(current.memories.filter((item) => item.id !== memoryId && item.status !== "rejected"), target.category, target.content);
    if (error) return error;
    const memories = current.memories.map((item) => item.id === memoryId ? { ...item, status: "approved" as const, updatedAt: Date.now() } : item);
    const next = { version: 1 as const, memories, conversations: current.conversations, activeConversationByWorkspace: current.activeConversationByWorkspace };
    persist(next);
    set(next);
    return null;
  },

  rejectMemory: (memoryId) => {
    const current = get();
    const memories = current.memories.map((item) => item.id === memoryId ? { ...item, status: "rejected" as const, updatedAt: Date.now() } : item);
    const next = { version: 1 as const, memories, conversations: current.conversations, activeConversationByWorkspace: current.activeConversationByWorkspace };
    persist(next);
    set(next);
  },

  deleteMemory: (memoryId) => {
    const current = get();
    const next = { version: 1 as const, memories: current.memories.filter((item) => item.id !== memoryId), conversations: current.conversations, activeConversationByWorkspace: current.activeConversationByWorkspace };
    persist(next);
    set(next);
  },

  clearAll: () => {
    const next = emptyMemoryData();
    persist(next);
    set({ ...next, ready: true });
  },

  ensureConversation: (workspaceId, initialMessage) => {
    const current = get();
    const activeId = current.activeConversationByWorkspace[workspaceId];
    if (activeId && current.conversations.some((item) => item.id === activeId)) return activeId;
    const conversationId = id();
    const now = Date.now();
    const conversation: CareerConversation = { id: conversationId, workspaceId, title: "New career chat", createdAt: now, updatedAt: now, messages: [initialMessage] };
    const next = withConversation({ version: 1, memories: current.memories, conversations: current.conversations, activeConversationByWorkspace: { ...current.activeConversationByWorkspace, [workspaceId]: conversationId } }, conversation);
    persist(next);
    set(next);
    return conversationId;
  },

  startConversation: (workspaceId, initialMessage) => {
    const current = get();
    const conversationId = id();
    const now = Date.now();
    const conversation: CareerConversation = { id: conversationId, workspaceId, title: "New career chat", createdAt: now, updatedAt: now, messages: [initialMessage] };
    const next = withConversation({ version: 1, memories: current.memories, conversations: current.conversations, activeConversationByWorkspace: { ...current.activeConversationByWorkspace, [workspaceId]: conversationId } }, conversation);
    persist(next);
    set(next);
    return conversationId;
  },

  appendConversationTurn: (conversationId, rawTurn) => {
    const current = get();
    const conversation = current.conversations.find((item) => item.id === conversationId);
    if (!conversation) return;
    const turn = { ...rawTurn, at: rawTurn.at ?? Date.now(), text: rawTurn.text.slice(0, MAX_TURN_LENGTH) };
    const messages = [...conversation.messages, turn].slice(-MAX_TURNS_PER_CONVERSATION);
    const firstUser = messages.find((item) => item.role === "user")?.text;
    const title = firstUser ? firstUser.slice(0, 70) : conversation.title;
    const next = withConversation(current, { ...conversation, title, updatedAt: Date.now(), messages });
    persist(next);
    set(next);
  },

  setConversationMessages: (conversationId, messages) => {
    const current = get();
    const conversation = current.conversations.find((item) => item.id === conversationId);
    if (!conversation) return;
    const safeMessages = messages.slice(-MAX_TURNS_PER_CONVERSATION).map((turn) => ({ ...turn, at: turn.at ?? Date.now(), text: turn.text.slice(0, MAX_TURN_LENGTH) }));
    const firstUser = safeMessages.find((item) => item.role === "user")?.text;
    const next = withConversation(current, { ...conversation, title: firstUser?.slice(0, 70) || conversation.title, updatedAt: Date.now(), messages: safeMessages });
    persist(next);
    set(next);
  },
}));

export function loadStoredMemory(): PersonalMemoryData {
  return normalizeMemoryData(readMemoryData());
}
