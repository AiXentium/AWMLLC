-- Trade-focused scanning: records which trade a plan analysis run targeted.
-- Code writes plan_analysis_runs.trade_focus ('all' or a trade key like 'windows').

alter table public.plan_analysis_runs
  add column if not exists trade_focus text not null default 'all';
