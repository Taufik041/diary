import { requireAdmin } from "@/lib/auth";
import { createPage } from "@/lib/diary/repo";
import { isBackground, parseElements } from "@/lib/diary/validate";
import { errorMessage, isUuid, readJson } from "@/lib/http";

export const runtime = "nodejs";

type Payload = { diaryId?: unknown; at?: unknown; background?: unknown; elements?: unknown };

/** New page at `at`. Duplicates send the source page's current elements, so
 *  edits that haven't autosaved yet are copied too. */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson<Payload>(request);
  if (!body || !isUuid(body.diaryId)) return Response.json({ error: "bad request" }, { status: 400 });
  const at = body.at;
  if (typeof at !== "number" || !Number.isInteger(at) || at < 0 || at > 100_000) {
    return Response.json({ error: "invalid position" }, { status: 400 });
  }
  const elements = body.elements === undefined ? [] : parseElements(body.elements);
  if (elements === null) return Response.json({ error: "invalid elements" }, { status: 400 });
  const background = body.background === undefined ? "blush" : body.background;
  if (!isBackground(background)) return Response.json({ error: "invalid background" }, { status: 400 });

  try {
    const page = await createPage(body.diaryId, at, { background, elements });
    if (!page) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ page });
  } catch (error) {
    // Foreign key violation: no such diary.
    if ((error as { code?: unknown }).code === "23503") {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    return Response.json({ error: errorMessage(error, "could not add the page") }, { status: 500 });
  }
}
