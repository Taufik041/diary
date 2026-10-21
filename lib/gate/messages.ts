import "server-only";
import { isMissingTable, query, queryOne } from "@/lib/db";
import { T } from "@/lib/tables";

// Notes found by catching a petal at the gate. They are shown before sign-in,
// so they are public by design.

export interface GateMessage {
  id: string;
  body: string;
}

export const MAX_MESSAGE = 500;

/** Trimmed body, or null if empty or too long. */
export function parseBody(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const body = v.trim();
  return body && body.length <= MAX_MESSAGE ? body : null;
}

/** In admin order. */
export async function listMessages(): Promise<GateMessage[]> {
  return query<GateMessage>(`SELECT id, body FROM ${T.gateMessages} ORDER BY position, created_at`);
}

/** For the gate: never throws — no notes is better than no way in. */
export async function gateMessages(): Promise<string[]> {
  try {
    return (await listMessages()).map((m) => m.body);
  } catch (error) {
    if (!isMissingTable(error)) console.error("gate messages:", error);
    return [];
  }
}

/** Appends to the end of the list. */
export async function createMessage(body: string): Promise<GateMessage | null> {
  return queryOne<GateMessage>(
    `INSERT INTO ${T.gateMessages} (body, position)
     SELECT $1, COALESCE(max(position) + 1, 0) FROM ${T.gateMessages}
     RETURNING id, body`,
    [body],
  );
}

export async function updateMessage(id: string, body: string): Promise<boolean> {
  const rows = await query(`UPDATE ${T.gateMessages} SET body = $2 WHERE id = $1 RETURNING id`, [id, body]);
  return rows.length > 0;
}

export async function deleteMessage(id: string): Promise<boolean> {
  const rows = await query(`DELETE FROM ${T.gateMessages} WHERE id = $1 RETURNING id`, [id]);
  return rows.length > 0;
}

/** `ids` in their new order. Must name every message exactly once. */
export async function reorderMessages(ids: string[]): Promise<boolean> {
  const [{ ok }] = await query<{ ok: boolean }>(
    `WITH wanted AS (
       SELECT id, ord::int - 1 AS position FROM unnest($1::uuid[]) WITH ORDINALITY AS u(id, ord)
     ),
     valid AS (
       SELECT (SELECT count(*) FROM wanted) = (SELECT count(*) FROM ${T.gateMessages})
          AND (SELECT count(DISTINCT id) FROM wanted) = (SELECT count(*) FROM wanted)
          AND NOT EXISTS (SELECT 1 FROM wanted w WHERE NOT EXISTS
                (SELECT 1 FROM ${T.gateMessages} m WHERE m.id = w.id)) AS ok
     ),
     moved AS (
       UPDATE ${T.gateMessages} m SET position = w.position
         FROM wanted w, valid v
        WHERE m.id = w.id AND v.ok
       RETURNING m.id
     )
     SELECT ok FROM valid`,
    [ids],
  );
  return ok;
}
