"use client";

import { useState } from "react";
import s from "./Admin.module.css";

type Message = { id: string; body: string };

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  const data = ((await response?.json().catch(() => ({}))) ?? {}) as { error?: string; message?: Message };
  if (!response?.ok) throw new Error(data.error ?? (response ? `error ${response.status}` : "offline"));
  return data;
}

const without = (drafts: Record<string, string>, id: string) => {
  const rest = { ...drafts };
  delete rest[id];
  return rest;
};

/** The notes found by catching a petal at the gate: add, edit, delete, reorder. */
export function GateMessages({ initial }: { initial: Message[] }) {
  const [messages, setMessages] = useState(initial);
  // Unsaved edits, by id.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const add = () =>
    run(async () => {
      const { message } = await send("/api/admin/gate-messages", "POST", { body: adding });
      if (message) setMessages((ms) => [...ms, message]);
      setAdding("");
    });

  const save = (id: string) =>
    run(async () => {
      const body = drafts[id].trim();
      await send(`/api/admin/gate-messages/${id}`, "PUT", { body });
      setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, body } : m)));
      setDrafts((d) => without(d, id));
    });

  const remove = (id: string) =>
    run(async () => {
      await send(`/api/admin/gate-messages/${id}`, "DELETE");
      setMessages((ms) => ms.filter((m) => m.id !== id));
      setDrafts((d) => without(d, id));
    });

  const move = (from: number, to: number) =>
    run(async () => {
      const next = [...messages];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      await send("/api/admin/gate-messages/order", "PUT", { ids: next.map((n) => n.id) });
      setMessages(next);
    });

  return (
    <div className={s.messages}>
      {messages.length === 0 && <p className={s.note}>No notes yet — the petals are blank.</p>}
      <ol className={s.list}>
        {messages.map((m, i) => {
          const draft = drafts[m.id];
          const dirty = draft !== undefined && draft.trim() !== m.body;
          return (
            <li key={m.id} className={s.item}>
              <textarea
                className={s.textarea}
                value={draft ?? m.body}
                rows={2}
                aria-label={`Note ${i + 1}`}
                onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
              />
              <div className={s.itemActions}>
                <button
                  type="button"
                  className={s.small}
                  disabled={busy || i === 0}
                  aria-label="Move up"
                  onClick={() => move(i, i - 1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={s.small}
                  disabled={busy || i === messages.length - 1}
                  aria-label="Move down"
                  onClick={() => move(i, i + 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={s.small}
                  disabled={busy || !dirty || !draft.trim()}
                  onClick={() => save(m.id)}
                >
                  Save
                </button>
                <button
                  type="button"
                  className={`${s.small} ${s.danger}`}
                  disabled={busy}
                  onClick={() => remove(m.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <form
        className={s.item}
        onSubmit={(e) => {
          e.preventDefault();
          if (adding.trim()) add();
        }}
      >
        <textarea
          className={s.textarea}
          value={adding}
          rows={2}
          placeholder="a new note for a petal"
          aria-label="New note"
          onChange={(e) => setAdding(e.target.value)}
        />
        <div className={s.itemActions}>
          <button className={s.small} disabled={busy || !adding.trim()}>
            Add note
          </button>
        </div>
      </form>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
