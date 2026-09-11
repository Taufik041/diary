import "server-only";
import { isMissingTable, query, queryOne } from "@/lib/db";
import { T } from "@/lib/tables";
import type { Diary, Page, PageBackground, PageElement } from "./types";
import { isBackground, readElements } from "./validate";

interface DiaryRow {
  id: string;
  title: string;
  created_at: string | Date;
}

interface PageRow {
  id: string;
  diary_id: string;
  index: number;
  background: string;
  elements: unknown;
}

const PAGE_COLUMNS = `id, diary_id, "index", background, elements`;

const toDiary = (r: DiaryRow): Diary => ({
  id: r.id,
  title: r.title,
  created_at: new Date(r.created_at).toISOString(),
});

export const toPage = (r: PageRow): Page => ({
  id: r.id,
  diary_id: r.diary_id,
  index: r.index,
  background: isBackground(r.background) ? r.background : "blush",
  elements: readElements(r.elements),
});

export type LoadResult = { status: "ok"; diary: Diary; pages: Page[] } | { status: "setup-needed" };

/** The (single) diary and all of its pages, in order. */
export async function loadDiary(): Promise<LoadResult> {
  let diary: DiaryRow | null;
  try {
    diary = await queryOne<DiaryRow>(`SELECT id, title, created_at FROM ${T.diaries} ORDER BY created_at LIMIT 1`);
  } catch (error) {
    if (isMissingTable(error)) return { status: "setup-needed" };
    throw error;
  }
  if (!diary) return { status: "setup-needed" };

  const rows = await query<PageRow>(
    `SELECT ${PAGE_COLUMNS} FROM ${T.pages} WHERE diary_id = $1 ORDER BY "index"`,
    [diary.id],
  );
  return { status: "ok", diary: toDiary(diary), pages: rows.map(toPage) };
}

/**
 * Insert a page at position `at` (clamped to the end), shifting later pages
 * up by one. One statement, so it's atomic; the deferrable unique constraint
 * is checked once the shift and the insert have both happened.
 */
export async function createPage(
  diaryId: string,
  at: number,
  page: { background: PageBackground; elements: PageElement[] },
): Promise<Page | null> {
  const row = await queryOne<PageRow>(
    `WITH pos AS (
       SELECT LEAST($2::int, count(*)::int) AS at FROM ${T.pages} WHERE diary_id = $1
     ),
     shifted AS (
       UPDATE ${T.pages} SET "index" = "index" + 1
        WHERE diary_id = $1 AND "index" >= (SELECT at FROM pos)
       RETURNING id
     )
     INSERT INTO ${T.pages} (diary_id, "index", background, elements)
     SELECT $1, at, $3, $4::jsonb FROM pos
     RETURNING ${PAGE_COLUMNS}`,
    [diaryId, at, page.background, JSON.stringify(page.elements)],
  );
  return row ? toPage(row) : null;
}

/**
 * Delete a page and close the gap in the indexes. Refuses to delete a
 * diary's last page. One statement, so it's atomic.
 */
export async function deletePage(id: string): Promise<"deleted" | "not-found" | "last-page"> {
  const [result] = await query<{ found: number; deleted: number }>(
    `WITH target AS (
       SELECT id, diary_id, "index" FROM ${T.pages} WHERE id = $1
     ),
     gone AS (
       DELETE FROM ${T.pages} p USING target t
        WHERE p.id = t.id
          AND (SELECT count(*) FROM ${T.pages} q WHERE q.diary_id = t.diary_id) > 1
       RETURNING t.diary_id, t."index"
     ),
     shifted AS (
       UPDATE ${T.pages} p SET "index" = p."index" - 1
         FROM gone g
        WHERE p.diary_id = g.diary_id AND p."index" > g."index"
       RETURNING p.id
     )
     SELECT (SELECT count(*) FROM target)::int AS found,
            (SELECT count(*) FROM gone)::int AS deleted`,
    [id],
  );
  if (!result?.found) return "not-found";
  return result.deleted ? "deleted" : "last-page";
}

/** Autosave. Returns false if the page no longer exists. */
export async function savePage(
  id: string,
  patch: { elements?: PageElement[]; background?: PageBackground },
): Promise<boolean> {
  const rows = await query(
    `UPDATE ${T.pages}
        SET elements = COALESCE($2::jsonb, elements),
            background = COALESCE($3, background),
            updated_at = now()
      WHERE id = $1
  RETURNING id`,
    [id, patch.elements ? JSON.stringify(patch.elements) : null, patch.background ?? null],
  );
  return rows.length > 0;
}
