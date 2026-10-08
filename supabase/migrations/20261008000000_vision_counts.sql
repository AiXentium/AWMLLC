-- Vision-first counting (Togal-style): persist visual detection aggregates
-- alongside the text-pipeline counts on each pre-analysis run.
--
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)

-- Vision aggregate columns on the run row. Text-pipeline counts stay in
-- window_count / door_count so both remain visible for cross-checking.
-- All writes from the runner are best-effort (try/catch) so scans keep
-- working when this migration hasn't been pushed yet.
alter table plan_analysis_runs
  add column if not exists vision_window_count integer not null default 0;

alter table plan_analysis_runs
  add column if not exists vision_door_count integer not null default 0;

alter table plan_analysis_runs
  add column if not exists vision_sheets_scanned integer not null default 0;

alter table plan_analysis_runs
  add column if not exists vision_detail jsonb;

comment on column plan_analysis_runs.vision_window_count is
  'Window units visually detected by vision AI across working-set sheets (this run).';
comment on column plan_analysis_runs.vision_door_count is
  'Door units visually detected by vision AI across working-set sheets (this run).';
comment on column plan_analysis_runs.vision_sheets_scanned is
  'Number of working-set sheets the vision pass completed.';
comment on column plan_analysis_runs.vision_detail is
  'Per-sheet vision breakdown plus label-deduped totals (JSON) for cross-checking against schedule/callout counts.';
