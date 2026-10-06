export type MemoryCategory = "profile" | "career";
export type MemoryStatus = "pending" | "approved" | "rejected";
export type MemorySource = "explicit_request" | "assistant_suggestion" | "user_edit";

export type PersonalMemory = {
  id: string;
  category: MemoryCategory;
  content: string;
  source: MemorySource;
  status: MemoryStatus;
  createdAt: number;
  updatedAt: number;
  conversationId?: string;
};

export type ChatTurn = {
  role: "user" | "assistant";
  text: string;
  at?: number;
  memoryIds?: string[];
  historyIds?: string[];
};

export type CareerConversation = {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatTurn[];
};

export type PersonalMemoryData = {
  version: 1;
  memories: PersonalMemory[];
  conversations: CareerConversation[];
  activeConversationByWorkspace: Record<string, string>;
};

export const MEMORY_STORAGE_KEY = "tailor.personalMemory";
export const MEMORY_LIMITS: Record<MemoryCategory, number> = { profile: 1375, career: 2200 };
export const MAX_MEMORY_ENTRY_LENGTH = 300;
export const MAX_CONVERSATIONS = 30;
export const MAX_TURNS_PER_CONVERSATION = 30;
export const MAX_TURN_LENGTH = 1200;

export function emptyMemoryData(): PersonalMemoryData {
  return { version: 1, memories: [], conversations: [], activeConversationByWorkspace: {} };
}

function safeTurn(value: unknown): ChatTurn | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ChatTurn>;
  if ((candidate.role !== "user" && candidate.role !== "assistant") || typeof candidate.text !== "string") return null;
  return {
    role: candidate.role,
    text: candidate.text.slice(0, MAX_TURN_LENGTH),
    at: typeof candidate.at === "number" ? candidate.at : Date.now(),
    ...(Array.isArray(candidate.memoryIds) ? { memoryIds: candidate.memoryIds.filter((id): id is string => typeof id === "string").slice(0, 24) } : {}),
    ...(Array.isArray(candidate.historyIds) ? { historyIds: candidate.historyIds.filter((id): id is string => typeof id === "string").slice(0, 3) } : {}),
  };
}

export function normalizeMemoryData(value: unknown): PersonalMemoryData {
  if (!value || typeof value !== "object") return emptyMemoryData();
  const source = value as Partial<PersonalMemoryData>;
  const memories = Array.isArray(source.memories)
    ? source.memories.flatMap((raw) => {
        if (!raw || typeof raw !== "object") return [];
        const item = raw as Partial<PersonalMemory>;
        if (
          typeof item.id !== "string" ||
          typeof item.content !== "string" ||
          (item.category !== "profile" && item.category !== "career") ||
          (item.status !== "pending" && item.status !== "approved" && item.status !== "rejected")
        ) return [];
        return [{
          id: item.id,
          category: item.category,
          content: item.content.slice(0, MAX_MEMORY_ENTRY_LENGTH),
          source: item.source === "assistant_suggestion" || item.source === "user_edit" ? item.source : "explicit_request",
          status: item.status,
          createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
          updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : Date.now(),
          ...(typeof item.conversationId === "string" ? { conversationId: item.conversationId } : {}),
        } satisfies PersonalMemory];
      })
    : [];
  const conversations = Array.isArray(source.conversations)
    ? source.conversations.flatMap((raw) => {
        if (!raw || typeof raw !== "object") return [];
        const item = raw as Partial<CareerConversation>;
        if (typeof item.id !== "string" || typeof item.workspaceId !== "string") return [];
        const messages = Array.isArray(item.messages) ? item.messages.flatMap((turn) => {
          const parsed = safeTurn(turn);
          return parsed ? [parsed] : [];
        }).slice(-MAX_TURNS_PER_CONVERSATION) : [];
        return [{
          id: item.id,
          workspaceId: item.workspaceId,
          title: typeof item.title === "string" ? item.title.slice(0, 100) : "Career chat",
          createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
          updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : Date.now(),
          messages,
        } satisfies CareerConversation];
      }).slice(-MAX_CONVERSATIONS)
    : [];
  const active = source.activeConversationByWorkspace && typeof source.activeConversationByWorkspace === "object"
    ? Object.fromEntries(Object.entries(source.activeConversationByWorkspace).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
    : {};
  return { version: 1, memories, conversations, activeConversationByWorkspace: active };
}

export function readMemoryData(): PersonalMemoryData {
  if (typeof window === "undefined") return emptyMemoryData();
  try {
    const raw = window.localStorage.getItem(MEMORY_STORAGE_KEY);
    return raw ? normalizeMemoryData(JSON.parse(raw)) : emptyMemoryData();
  } catch {
    return emptyMemoryData();
  }
}

export function writeMemoryData(data: PersonalMemoryData): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function memoryUsage(memories: PersonalMemory[], category: MemoryCategory): number {
  return memories.filter((item) => item.category === category && item.status !== "rejected")
    .reduce((sum, item) => sum + item.content.length, 0);
}

export function normalizeMemoryText(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

const STOP_WORDS = new Set(["about", "after", "again", "also", "because", "being", "could", "from", "have", "into", "just", "more", "most", "other", "over", "same", "that", "their", "there", "these", "they", "this", "those", "through", "want", "what", "when", "where", "which", "with", "would", "your", "work"]);

export function selectRelevantMemories(memories: PersonalMemory[], query: string): PersonalMemory[] {
  const approved = memories.filter((item) => item.status === "approved");
  const profile = approved.filter((item) => item.category === "profile");
  const career = approved.filter((item) => item.category === "career");
  const terms = normalizeMemoryText(query).split(/\s+/).filter((term) => term.length > 2 && !STOP_WORDS.has(term));
  const rankedCareer = career.map((memory) => {
    const text = normalizeMemoryText(memory.content);
    const score = terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
    return { memory, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || b.memory.updatedAt - a.memory.updatedAt);
  const budget = MEMORY_LIMITS.career;
  const selected: PersonalMemory[] = [];
  let used = 0;
  for (const { memory } of rankedCareer) {
    if (used + memory.content.length > budget) continue;
    selected.push(memory);
    used += memory.content.length;
  }
  return [...profile, ...selected];
}

export function searchConversations(conversations: CareerConversation[], query: string): CareerConversation[] {
  const terms = normalizeMemoryText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  return conversations.map((conversation) => {
    const joined = normalizeMemoryText(`${conversation.title} ${conversation.messages.map((message) => message.text).join(" ")}`);
    const score = terms.reduce((total, term) => total + (joined.includes(term) ? 1 : 0), 0);
    return { conversation, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || b.conversation.updatedAt - a.conversation.updatedAt).map(({ conversation }) => conversation);
}

export function memoryConflict(memories: PersonalMemory[], category: MemoryCategory, content: string, ignoreId?: string): PersonalMemory | undefined {
  const incoming = normalizeMemoryText(content).split(/\s+/).filter((word) => word.length > 3 && !STOP_WORDS.has(word));
  const negated = /\b(no|not|never|avoid|don't|do not|dislike|prefer against)\b/i.test(content);
  const opposites = [["concise", "detailed"], ["brief", "thorough"], ["formal", "casual"], ["remote", "onsite"], ["short", "long"], ["direct", "warm"], ["technical", "plain"]];
  return memories.find((item) => {
    if (item.id === ignoreId || item.category !== category || item.status === "rejected") return false;
    const existing = normalizeMemoryText(item.content).split(/\s+/).filter((word) => word.length > 3 && !STOP_WORDS.has(word));
    const common = incoming.filter((word) => existing.includes(word)).length;
    const overlap = common / Math.max(1, Math.min(incoming.length, existing.length));
    const otherNegated = /\b(no|not|never|avoid|don't|do not|dislike|prefer against)\b/i.test(item.content);
    const opposingTerms = opposites.some(([left, right]) =>
      (incoming.includes(left) && existing.includes(right)) || (incoming.includes(right) && existing.includes(left)),
    );
    return (overlap >= 0.5 && negated !== otherNegated) || (opposingTerms && common >= 1);
  });
}
