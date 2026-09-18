import { randomUUID } from "node:crypto";
import { getDb } from "./index";
import type { CardSpec, EvidenceItem } from "@/services/chat/tools";

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  cards: CardSpec[];
  evidence: EvidenceItem[];
  followups: string[];
  source: "ai" | "deterministic" | null;
  createdAt: string;
}

export interface ChatConversation {
  id: string;
  title: string | null;
  lastResponseId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConvRow { id: string; title: string | null; last_response_id: string | null; created_at: string; updated_at: string }
interface MsgRow { id: string; conversation_id: string; role: string; content: string; cards: string; evidence: string; followups: string; source: string | null; created_at: string }

const toConv = (r: ConvRow): ChatConversation => ({ id: r.id, title: r.title, lastResponseId: r.last_response_id, createdAt: r.created_at, updatedAt: r.updated_at });
const toMsg = (r: MsgRow): ChatMessage => ({ id: r.id, conversationId: r.conversation_id, role: r.role as ChatMessage["role"], content: r.content, cards: JSON.parse(r.cards), evidence: JSON.parse(r.evidence), followups: JSON.parse(r.followups), source: r.source as ChatMessage["source"], createdAt: r.created_at });

export function getConversation(id: string): ChatConversation | null {
  const r = getDb().prepare(`SELECT * FROM chat_conversations WHERE id = ?`).get(id) as ConvRow | undefined;
  return r ? toConv(r) : null;
}

export function createConversation(title: string | null): ChatConversation {
  const now = new Date().toISOString();
  const c: ChatConversation = { id: randomUUID(), title, lastResponseId: null, createdAt: now, updatedAt: now };
  getDb().prepare(`INSERT INTO chat_conversations (id, title, last_response_id, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)`).run(c.id, title, now, now);
  return c;
}

export function setLastResponseId(id: string, responseId: string | null): void {
  getDb().prepare(`UPDATE chat_conversations SET last_response_id = ?, updated_at = ? WHERE id = ?`).run(responseId, new Date().toISOString(), id);
}

export function listConversations(limit = 20): ChatConversation[] {
  return (getDb().prepare(`SELECT * FROM chat_conversations ORDER BY updated_at DESC LIMIT ?`).all(limit) as ConvRow[]).map(toConv);
}

export function listMessages(conversationId: string): ChatMessage[] {
  return (getDb().prepare(`SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at, rowid`).all(conversationId) as MsgRow[]).map(toMsg);
}

export function addMessage(m: Omit<ChatMessage, "id" | "createdAt">): ChatMessage {
  const row: ChatMessage = { ...m, id: randomUUID(), createdAt: new Date().toISOString() };
  getDb()
    .prepare(`INSERT INTO chat_messages (id, conversation_id, role, content, cards, evidence, followups, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(row.id, row.conversationId, row.role, row.content, JSON.stringify(row.cards), JSON.stringify(row.evidence), JSON.stringify(row.followups), row.source, row.createdAt);
  getDb().prepare(`UPDATE chat_conversations SET updated_at = ? WHERE id = ?`).run(row.createdAt, row.conversationId);
  return row;
}

export function deleteConversation(id: string): void {
  getDb().prepare(`DELETE FROM chat_conversations WHERE id = ?`).run(id);
}
