import type { Metadata } from "next";
import Link from "next/link";
import { SetupButton, SignOutButton } from "@/components/admin/AdminActions";
import { GateMessages } from "@/components/admin/GateMessages";
import s from "@/components/admin/Admin.module.css";
import { Gate } from "@/components/gate/Gate";
import { hasAdminCookie } from "@/lib/auth";
import { isMissingTable } from "@/lib/db";
import { gateMessages, listMessages, type GateMessage } from "@/lib/gate/messages";
import { errorMessage } from "@/lib/http";

export const metadata: Metadata = { title: "Diary · admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await hasAdminCookie())) return <Gate messages={await gateMessages()} />;

  const messages: GateMessage[] | "setup-needed" | { error: string } = await listMessages().catch((error) =>
    isMissingTable(error) ? "setup-needed" : { error: errorMessage(error, "unknown error") },
  );

  return (
    <main className={s.screen}>
      <section className={s.card}>
        <p className={s.label}>Diary · admin</p>
        <h1 className={s.title}>Admin</h1>
        <SetupButton />
        <p className={s.note}>
          Creates the tables in the diary schema and seeds the first spread. Safe to press again — an
          existing diary is never overwritten.
        </p>
        <section className={s.section}>
          <p className={s.label}>Notes on the petals</p>
          {messages === "setup-needed" ? (
            <p className={s.note}>Press “Set up database” to add the notes table.</p>
          ) : "error" in messages ? (
            <p className={s.error}>{messages.error}</p>
          ) : (
            <GateMessages initial={messages} />
          )}
        </section>
        <div className={s.row}>
          <Link href="/" className={s.quiet}>
            Back to the diary
          </Link>
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
