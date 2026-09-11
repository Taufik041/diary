import "server-only";
import { neon } from "@neondatabase/serverless";

let cached: ReturnType<typeof neon> | null = null;

/** Lazily-created Neon HTTP client. Kept lazy so a missing URL fails at
 *  request time with a clear message instead of at module load / build. */
export function sql() {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    cached = neon(url);
  }
  return cached;
}

/** Run a parameterised query and get back plain rows. */
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const rows = await sql().query(text, params as never[]);
  return rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Postgres "relation does not exist" / "schema does not exist". */
export function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "42P01" || code === "3F000";
}
