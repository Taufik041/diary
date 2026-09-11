import { setupDatabase } from "@/db/setup";
import { requireAdmin } from "@/lib/auth";
import { errorMessage } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const result = await setupDatabase();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ error: errorMessage(error, "setup failed") }, { status: 500 });
  }
}
