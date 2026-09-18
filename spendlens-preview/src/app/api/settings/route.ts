import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/db/settings";
import { hasAnthropicCredentials } from "@/services/ai";
import { hasOpenAICredentials } from "@/services/chat/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ settings: getSettings(), aiAvailable: hasOpenAICredentials() || hasAnthropicCredentials() });
}

/** POST { aiEnabled?: boolean, aiModel?: string } */
export async function POST(req: Request) {
  const body = (await req.json()) as { aiEnabled?: boolean; aiModel?: string; userName?: string };
  const settings = updateSettings({ aiEnabled: body.aiEnabled, aiModel: body.aiModel, userName: body.userName });
  return NextResponse.json({ settings, aiAvailable: hasOpenAICredentials() || hasAnthropicCredentials() });
}
