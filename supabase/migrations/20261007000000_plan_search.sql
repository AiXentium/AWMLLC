-- Plan-wide search (Togal-style "search, don't trace").
-- Persists the extracted sheet text from pre-analysis so the estimator can
-- search for window/door tags (e.g. "W6") across every sheet of a project.
--
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)

-- 1. Store the extracted text alongside each sheet classification.
--    The runner writes up to ~8000 chars per sheet (see extractPageText limit).
alter table plan_sheet_classifications
  add column if not exists sheet_text text;

comment on column plan_sheet_classifications.sheet_text is
  'Extracted plain text of the sheet, persisted during pre-analysis for plan-wide tag search.';

-- 2. Trigram index so ILIKE tag searches stay fast as sheet counts grow.
create extension if not exists pg_trgm;

create index if not exists idx_plan_sheet_class_text_trgm
  on plan_sheet_classifications using gin (sheet_text gin_trgm_ops);

-- 3. Helpful composite index for the per-project search query.
create index if not exists idx_plan_sheet_class_project_text
  on plan_sheet_classifications (project_id)
  where sheet_text is not null;
