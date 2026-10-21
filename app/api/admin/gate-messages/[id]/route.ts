import { requireAdmin } from "@/lib/auth";
import { deleteMessage, parseBody, updateMessage } from "@/lib/gate/messages";
import { errorMessage, isUuid, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function PUT(request: Request, ctx: RouteContext<"/api/admin/gate-messages/[id]">) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: "not found" }, { status: 404 });
  const body = await readJson<{ body?: unknown }>(request, 10_000);
  const text = parseBody(body?.body);
  if (!text) return Response.json({ error: "a note needs some words" }, { status: 400 });

  try {
    if (!(await updateMessage(id, text))) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error, "save failed") }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/gate-messages/[id]">) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: "not found" }, { status: 404 });

  try {
    if (!(await deleteMessage(id))) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error, "delete failed") }, { status: 500 });
  }
}
