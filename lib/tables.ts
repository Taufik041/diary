/**
 * Everything lives in a dedicated schema so the database can be shared with
 * other projects without name collisions.
 *
 * The Neon HTTP driver is stateless, so there is no connection-level
 * search_path to lean on — every table name is qualified, and every one of
 * them comes from this file rather than from a request.
 */
export const SCHEMA = "diary";

export const T = {
  diaries: `${SCHEMA}.diaries`,
  pages: `${SCHEMA}.pages`,
} as const;
