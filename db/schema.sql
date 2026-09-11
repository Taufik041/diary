-- Diary schema. Single admin, no tenant key.
-- Safe to run repeatedly: every statement is guarded.
--
-- Everything lives in the `diary` schema so the database can be shared with
-- other projects, and the whole thing removed with `DROP SCHEMA diary CASCADE`.

CREATE SCHEMA IF NOT EXISTS diary;

CREATE TABLE IF NOT EXISTS diary.diaries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL DEFAULT 'Diary',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per page. `elements` is the jsonb array described in SPEC.md,
-- in 800 x 1100 page coordinates. `background` is an enum in spirit; a CHECK
-- keeps it extendable without ALTER TYPE.
CREATE TABLE IF NOT EXISTS diary.pages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_id   uuid NOT NULL REFERENCES diary.diaries (id) ON DELETE CASCADE,
  "index"    int  NOT NULL,
  background text NOT NULL DEFAULT 'blush',
  elements   jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pages_background CHECK (background IN ('blush', 'cream')),
  CONSTRAINT pages_elements_array CHECK (jsonb_typeof(elements) = 'array'),
  CONSTRAINT pages_index_nonnegative CHECK ("index" >= 0),
  -- Deferrable so a single UPDATE can shift a run of indexes by one.
  CONSTRAINT pages_diary_index UNIQUE (diary_id, "index") DEFERRABLE INITIALLY IMMEDIATE
);
