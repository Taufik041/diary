"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import s from "./Admin.module.css";

type SetupResult = { ok?: boolean; diaryCreated?: boolean; pagesSeeded?: number; error?: string };

/** Creates the tables and seeds the defaults. Safe to press again. */
export function SetupButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    const response = await fetch("/api/admin/setup", { method: "POST" }).catch(() => null);
    const body = ((await response?.json().catch(() => ({}))) ?? {}) as SetupResult;
    setBusy(false);
    if (!response?.ok) {
      setResult({ ok: false, text: body.error ?? "setup failed" });
      return;
    }
    const parts = [
      "tables ready",
      body.diaryCreated ? "diary created" : null,
      body.pagesSeeded ? `${body.pagesSeeded} pages seeded` : "nothing to seed",
    ].filter(Boolean);
    setResult({ ok: true, text: parts.join(" · ") });
  }

  return (
    <div className={s.row}>
      <button type="button" className={s.button} disabled={busy} onClick={run}>
        {busy ? "setting up…" : "Set up database"}
      </button>
      {result && (
        <span className={result.ok ? s.ok : s.error} role="status">
          {result.text}
        </span>
      )}
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={s.quiet}
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
