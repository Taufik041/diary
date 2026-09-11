import { clearAdminCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  await clearAdminCookie();
  return Response.json({ ok: true });
}
