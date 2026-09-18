"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function partOfDay(): string {
  const h = new Date().getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** "Good morning, Rayan." with an inline, one-time name prompt. */
export function Greeting({ name }: { name: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const save = async () => {
    await fetch("/api/settings", { method: "POST", body: JSON.stringify({ userName: draft }) });
    setEditing(false);
    router.refresh();
  };
  return (
    <div className="mb-5">
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex items-center gap-2"
        >
          <span className="text-[30px] font-semibold tracking-[-0.02em] sm:text-[36px]">{partOfDay()},</span>
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="your name" className="h-11 w-44 rounded-xl border border-line bg-surface px-3 text-[20px] font-semibold tracking-tight outline-none focus:border-ink" />
          <button type="submit" className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-medium text-ink-inverse">Save</button>
        </form>
      ) : (
        <h1 className="text-[30px] font-semibold tracking-[-0.02em] sm:text-[36px]">
          {partOfDay()}
          {name ? `, ${name}.` : "."}
          {!name && (
            <button onClick={() => setEditing(true)} className="ml-3 align-middle text-[13px] font-medium text-accent hover:underline">Add your name</button>
          )}
        </h1>
      )}
      {name && !editing && <button onClick={() => setEditing(true)} className="mt-1 text-[12px] text-ink-muted hover:text-ink">Not {name}? Change</button>}
    </div>
  );
}
