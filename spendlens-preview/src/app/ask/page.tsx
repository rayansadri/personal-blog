import { Suspense } from "react";
import { AskChat } from "@/components/ask/AskChat";
import { countTransactions } from "@/lib/db/repository";
import { hasOpenAICredentials } from "@/services/chat/openai";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ask" };

export default function AskPage() {
  const hasData = countTransactions() > 0;
  return (
    <div className="flex min-h-[calc(100vh-140px)] flex-col">
      <div className="mb-2 sr-only">
        <h1>Ask SpendLens</h1>
      </div>
      <Suspense>
        <AskChat hasData={hasData} aiAvailable={hasOpenAICredentials()} />
      </Suspense>
    </div>
  );
}
