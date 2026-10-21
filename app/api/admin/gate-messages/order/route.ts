import { requireAdmin } from "@/lib/auth";
import { reorderMessages } from "@/lib/gate/messages";
import { errorMessage, isUuid, readJson } from "@/lib/http";

export const runtime = "nodejs";

/** The whole list's ids, in their new order. */
export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson<{ ids?: unknown }>(request, 100_000);
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length > 1000 || !ids.every(isUuid)) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  try {
    if (!(await reorderMessages(ids))) {
      return Response.json({ error: "the list changed — reload and try again" }, { status: 409 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error, "reorder failed") }, { status: 500 });
  }
}
