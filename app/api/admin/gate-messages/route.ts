import { requireAdmin } from "@/lib/auth";
import { createMessage, parseBody } from "@/lib/gate/messages";
import { errorMessage, readJson } from "@/lib/http";

export const runtime = "nodejs";

/** New gate note, at the end of the list. */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson<{ body?: unknown }>(request, 10_000);
  const text = parseBody(body?.body);
  if (!text) return Response.json({ error: "a note needs some words" }, { status: 400 });

  try {
    const message = await createMessage(text);
    return Response.json({ message });
  } catch (error) {
    return Response.json({ error: errorMessage(error, "could not add the note") }, { status: 500 });
  }
}
