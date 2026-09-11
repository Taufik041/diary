import { safeEqual, setAdminCookie } from "@/lib/auth";
import { readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limit = rateLimit(`admin:${clientIp(request)}`, 8);
  if (!limit.ok) {
    return Response.json(
      { error: "too many attempts" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return Response.json({ error: "ADMIN_PASSWORD is not set" }, { status: 500 });
  }

  const body = await readJson<{ password?: unknown }>(request, 10_000);
  if (!body) return Response.json({ error: "bad request" }, { status: 400 });
  const password = typeof body.password === "string" ? body.password : "";

  if (!safeEqual(password, expected)) {
    return Response.json({ error: "wrong password" }, { status: 401 });
  }

  await setAdminCookie();
  return Response.json({ ok: true });
}
