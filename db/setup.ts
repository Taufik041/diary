import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { query, queryOne, sql } from "@/lib/db";
import { T } from "@/lib/tables";
import { SEED_PAGES } from "./seed";

/** Split a SQL script into statements. The schema has no semicolons inside
 *  string literals, so a statement-level split is enough. */
function statements(script: string): string[] {
  return script
    .split(/;\s*$/m)
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}

/**
 * Create the schema and seed the defaults. Safe to run any number of times:
 * the DDL is guarded, and seeds only fill what is missing — an existing
 * diary's pages are never touched.
 */
export async function setupDatabase(): Promise<{ diaryCreated: boolean; pagesSeeded: number }> {
  const script = await readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  for (const stmt of statements(script)) {
    await sql().query(stmt);
  }

  let diary = await queryOne<{ id: string }>(`SELECT id FROM ${T.diaries} ORDER BY created_at LIMIT 1`);
  const diaryCreated = !diary;
  if (!diary) {
    diary = await queryOne<{ id: string }>(`INSERT INTO ${T.diaries} (title) VALUES ($1) RETURNING id`, [
      "Diary",
    ]);
  }
  if (!diary) throw new Error("could not create the diary");

  const [{ count }] = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ${T.pages} WHERE diary_id = $1`,
    [diary.id],
  );
  let pagesSeeded = 0;
  if (Number(count) === 0) {
    const db = sql();
    await db.transaction(
      SEED_PAGES.map((page, i) =>
        db.query(
          `INSERT INTO ${T.pages} (diary_id, "index", background, elements) VALUES ($1, $2, $3, $4::jsonb)`,
          [diary.id, i, page.background, JSON.stringify(page.elements)],
        ),
      ),
    );
    pagesSeeded = SEED_PAGES.length;
  }

  return { diaryCreated, pagesSeeded };
}
