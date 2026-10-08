-- Page-scale zoom calibration columns (viewer measurement fix).
-- Code reads page_scales.calibrated_canvas_width/height for zoom-corrected measurements.

alter table public.page_scales
  add column if not exists calibrated_canvas_width double precision,
  add column if not exists calibrated_canvas_height double precision;
