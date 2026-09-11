export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Parse a JSON request body, returning null rather than throwing. Bodies
 *  over `maxBytes` are refused before parsing. */
export async function readJson<T>(request: Request, maxBytes = 1_000_000): Promise<T | null> {
  try {
    const text = await request.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route params are checked before they reach a uuid column, so a bad id is
 *  a 404 rather than a Postgres cast error. */
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
