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
