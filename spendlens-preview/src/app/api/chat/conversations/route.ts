import { NextResponse } from "next/server";
import { deleteConversation, listConversations, listMessages } from "@/lib/db/chat";
import { hasOpenAICredentials, DEFAULT_CHAT_MODEL } from "@/services/chat/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?id=… → messages of one conversation; without id → recent conversations. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (id) return NextResponse.json({ messages: listMessages(id) });
  return NextResponse.json({ conversations: listConversations(), ai: { available: hasOpenAICredentials(), model: DEFAULT_CHAT_MODEL } });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  deleteConversation(id);
  return NextResponse.json({ ok: true });
}
