import type { Metadata } from "next";
import Link from "next/link";
import { SetupButton, SignOutButton } from "@/components/admin/AdminActions";
import { SignIn } from "@/components/admin/SignIn";
import s from "@/components/admin/Admin.module.css";
import { hasAdminCookie } from "@/lib/auth";

export const metadata: Metadata = { title: "Diary · admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await hasAdminCookie())) return <SignIn />;

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
