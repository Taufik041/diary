import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "diary_admin";

// A private diary on your own phone: a month between sign-ins.
const ADMIN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SCOPE = "admin";

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

function sign(expiry: string): string {
  return crypto.createHmac("sha256", secret()).update(`${SCOPE}.${expiry}`).digest("hex");
}

/** Constant-time compare. Both sides are hashed first so the buffers handed
 *  to timingSafeEqual are always the same length — comparing raw strings of
 *  different lengths throws, and the throw itself leaks the length. */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest();
  const hb = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(ha, hb);
}

function issueToken(): { value: string; maxAge: number } {
  const expiry = String(Date.now() + ADMIN_TTL_MS);
  return { value: `${expiry}.${sign(expiry)}`, maxAge: Math.floor(ADMIN_TTL_MS / 1000) };
}

function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expiry = token.slice(0, dot);
  const expiresAt = Number(expiry);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  return safeEqual(token.slice(dot + 1), sign(expiry));
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function hasAdminCookie(): Promise<boolean> {
  const jar = await cookies();
  return verifyToken(jar.get(ADMIN_COOKIE)?.value);
}

/** Guard for route handlers. */
export async function requireAdmin(): Promise<Response | null> {
  if (await hasAdminCookie()) return null;
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

export async function setAdminCookie(): Promise<void> {
  const token = issueToken();
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token.value, cookieOptions(token.maxAge));
}

export async function clearAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
}
