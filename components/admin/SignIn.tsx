"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import s from "./Admin.module.css";

export function SignIn() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    setBusy(false);
    if (response?.ok) {
      setPassword("");
      router.refresh();
      return;
    }
    const body = (await response?.json().catch(() => ({}))) as { error?: string } | undefined;
    setError(body?.error ?? "sign in failed");
  }

  return (
    <main className={s.screen}>
      <form className={s.card} onSubmit={submit}>
        <h1 className={s.title}>Diary</h1>
        <p className={s.label}>Private · sign in</p>
        <input
          className={s.input}
          type="password"
          value={password}
          autoComplete="current-password"
          aria-label="Password"
          placeholder="password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className={s.button} disabled={busy || !password}>
          {busy ? "checking…" : "Open the diary"}
        </button>
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
