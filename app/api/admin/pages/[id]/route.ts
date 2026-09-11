import { requireAdmin } from "@/lib/auth";
import { deletePage, savePage } from "@/lib/diary/repo";
import { isBackground, parseElements } from "@/lib/diary/validate";
import { errorMessage, isUuid, readJson } from "@/lib/http";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Autosave: replaces the page's elements and/or background. */
export async function PUT(request: Request, { params }: Params) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "not found" }, { status: 404 });

  const body = await readJson<{ elements?: unknown; background?: unknown }>(request);
  if (!body) return Response.json({ error: "bad request" }, { status: 400 });

  const elements = body.elements === undefined ? undefined : parseElements(body.elements);
  if (elements === null) return Response.json({ error: "invalid elements" }, { status: 400 });
  if (body.background !== undefined && !isBackground(body.background)) {
    return Response.json({ error: "invalid background" }, { status: 400 });
  }

  try {
    const found = await savePage(id, { elements, background: body.background });
    if (!found) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error, "save failed") }, { status: 500 });
  }
}

/** Delete a page; later pages move up. A diary always keeps one page. */
export async function DELETE(_request: Request, { params }: Params) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "not found" }, { status: 404 });

  try {
    const result = await deletePage(id);
    if (result === "not-found") return Response.json({ error: "not found" }, { status: 404 });
    if (result === "last-page") {
      return Response.json({ error: "a diary needs at least one page" }, { status: 409 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error, "delete failed") }, { status: 500 });
  }
}
