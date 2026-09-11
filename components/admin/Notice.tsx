import Link from "next/link";
import s from "./Admin.module.css";

/** Full-screen message for when the diary can't be shown. */
export function Notice({ title, detail, adminLink }: { title: string; detail: string; adminLink?: boolean }) {
  return (
    <main className={s.screen}>
      <section className={s.card}>
        <p className={s.label}>Diary</p>
        <h1 className={s.title} style={{ fontSize: 32 }}>
          {title}
        </h1>
        <p className={s.note}>{detail}</p>
        {adminLink && (
          <div className={s.row}>
            <Link href="/admin" className={s.quiet}>
              Open admin
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
