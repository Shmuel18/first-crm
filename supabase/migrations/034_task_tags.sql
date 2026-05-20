-- Task tags (the Kanban card chips). Fixed taxonomy enforced by a CHECK so only
-- known tags can be stored; defaults to an empty array.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_tags_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_tags_check
  CHECK (tags <@ ARRAY['meeting', 'lead', 'export', 'legal', 'docs', 'followup', 'bank']::text[]);
