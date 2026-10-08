-- ============================================================================
-- YKK catalog seed — values observed live in the ViewBuilder portal 2026-10-04.
-- Nothing guessed: series, product types, baseline LIST prices, FL approval IDs,
-- colors, glass packages. Dealer ≈ 18% off list (observed single data point).
-- ============================================================================

INSERT INTO public.ykk_products
  (family, series, model, product_type, description, application,
   frame_options, glass_options, color_options, florida_approval, verified, active)
SELECT v.family, v.series, v.model, v.product_type, v.description, v.application,
       v.frame_options, v.glass_options, v.color_options, v.florida_approval, v.verified, v.active
FROM (VALUES
-- Windows -------------------------------------------------------------------
('StyleView Classic', 'StyleView Classic', 'SH', 'Single Hung',
 'New construction vinyl single hung, classic wood appearance. Flagship series.',
 'New construction',
 ARRAY['Nail fin','Block & tackle'],
 ARRAY['Dual Glazed Low-E 270','Dual Glazed Low-E 366','Low-E 270 w/ Argon','Low-E 366 w/ Argon','Dual Glazed Clear'],
 ARRAY['White','Stone','Bronze','Black'],
 '8114.7', true, true),
('StyleView Classic', 'StyleView Classic', 'DH', 'Double Hung',
 'New construction vinyl double hung.', 'New construction',
 ARRAY['Nail fin'],
 ARRAY['Dual Glazed Low-E 270','Dual Glazed Low-E 366','Low-E 270 w/ Argon','Low-E 366 w/ Argon','Dual Glazed Clear'],
 ARRAY['White','Stone','Bronze'], NULL, true, true),
('StyleView Classic', 'StyleView Classic', 'PW', 'Fixed Window',
 'Picture window / transom.', 'New construction',
 ARRAY['Nail fin'],
 ARRAY['Dual Glazed Low-E 270','Dual Glazed Low-E 366','Low-E 270 w/ Argon','Low-E 366 w/ Argon','Dual Glazed Clear'],
 ARRAY['White','Stone','Bronze'], NULL, true, true),
('StyleView Classic', 'StyleView Classic', 'CASE', 'Casement',
 'Vinyl casement, DP50 available.', 'New construction',
 ARRAY['Nail fin'],
 ARRAY['Dual Glazed Low-E 270','Dual Glazed Low-E 366','Low-E 270 w/ Argon','Low-E 366 w/ Argon','Dual Glazed Clear'],
 ARRAY['White','Stone','Bronze'], NULL, true, true),
('StyleView Classic', 'StyleView Classic', 'AWN', 'Awning',
 'Vinyl awning window.', 'New construction',
 ARRAY['Nail fin'],
 ARRAY['Dual Glazed Low-E 270','Dual Glazed Low-E 366','Low-E 270 w/ Argon','Low-E 366 w/ Argon','Dual Glazed Clear'],
 ARRAY['White','Stone','Bronze'], NULL, true, true),
('StyleView Classic', 'StyleView Classic', 'SLD', 'Slider',
 'Single slider vinyl window.', 'New construction',
 ARRAY['Nail fin'],
 ARRAY['Dual Glazed Low-E 270','Dual Glazed Low-E 366','Low-E 270 w/ Argon','Low-E 366 w/ Argon','Dual Glazed Clear'],
 ARRAY['White','Stone','Bronze'], NULL, true, true),
('StyleView', 'StyleView', 'SH', 'Single Hung',
 'New construction vinyl, traditional brickmold with J-channel.', 'New construction',
 ARRAY['Brickmold'],
 ARRAY['Dual Glazed Low-E 270','Dual Glazed Low-E 366','Low-E 270 w/ Argon','Low-E 366 w/ Argon','Dual Glazed Clear'],
 ARRAY['White','Stone','Bronze'], NULL, true, true),
('StyleView', 'StyleView', 'DH', 'Double Hung',
 'New construction vinyl double hung, brickmold.', 'New construction',
 ARRAY['Brickmold'],
 ARRAY['Dual Glazed Low-E 270','Dual Glazed Low-E 366','Low-E 270 w/ Argon','Low-E 366 w/ Argon','Dual Glazed Clear'],
 ARRAY['White','Stone','Bronze'], NULL, true, true),
('StyleView Flange', 'StyleView Flange', 'SH', 'Single Hung',
 'Vinyl single hung for block construction (flange application).', 'Block construction',
 ARRAY['Flange'],
 ARRAY['Dual Glazed Low-E 270','Dual Glazed Low-E 366','Low-E 270 w/ Argon','Low-E 366 w/ Argon','Dual Glazed Clear'],
 ARRAY['White','Stone','Bronze'], NULL, true, true),
('StyleView Flange', 'StyleView Flange', 'DH', 'Double Hung',
 'Vinyl double hung for block construction.', 'Block construction',
 ARRAY['Flange'],
 ARRAY['Dual Glazed Low-E 270','Dual Glazed Low-E 366','Low-E 270 w/ Argon','Low-E 366 w/ Argon','Dual Glazed Clear'],
 ARRAY['White','Stone','Bronze'], NULL, true, true),
('Precedence', 'Precedence', 'DH', 'Double Hung',
 'Vinyl REPLACEMENT double hung, box frame (no nail fin).', 'Replacement',
 ARRAY['Box frame'],
 ARRAY['Dual Glazed Low-E 270','Dual Glazed Low-E 366','Low-E 270 w/ Argon','Low-E 366 w/ Argon','Dual Glazed Clear'],
 ARRAY['White','Stone','Bronze'],
 '7533.1', true, true),
('StyleGuard', 'StyleGuard', 'DH', 'Double Hung',
 'Hurricane-resistant vinyl double hung, impact rated, double weather stripping.',
 'Impact / HVHZ',
 ARRAY['Nail fin'],
 ARRAY['Dual Glazed Low-E 270','Dual Glazed Low-E 366','Low-E 270 w/ Argon','Low-E 366 w/ Argon','Dual Glazed Clear'],
 ARRAY['White','Stone','Bronze'],
 '7533.2', true, true),
('StyleGuard Flange', 'StyleGuard Flange', 'DH', 'Double Hung',
 'Hurricane-resistant vinyl double hung for block construction.', 'Impact / block',
 ARRAY['Flange'],
 ARRAY['Dual Glazed Low-E 270','Dual Glazed Low-E 366','Low-E 270 w/ Argon','Low-E 366 w/ Argon','Dual Glazed Clear'],
 ARRAY['White','Stone','Bronze'], NULL, true, true),
-- Doors ---------------------------------------------------------------------
('StyleView', 'StyleView', 'PD2', 'Sliding Patio Door',
 '2-panel sliding patio door, 5''/6''/8'' x 6''8".', 'New construction',
 ARRAY['Nail fin'],
 ARRAY['Dual Glazed Low-E 270','Dual Glazed Low-E 366','Low-E 270 w/ Argon','Low-E 366 w/ Argon','Dual Glazed Clear'],
 ARRAY['White','Stone','Bronze'], NULL, true, true),
('StyleView HD', 'StyleView HD', 'PD234', 'Sliding Patio Door',
 '2/3/4-panel heavy-duty sliding patio door.', 'New construction',
 ARRAY['Nail fin'],
 ARRAY['Dual Glazed Low-E 270','Dual Glazed Low-E 366','Low-E 270 w/ Argon','Low-E 366 w/ Argon','Dual Glazed Clear'],
 ARRAY['White','Stone','Bronze'], NULL, true, true),
('StyleGuard HD', 'StyleGuard HD', 'PD234I', 'Sliding Patio Door',
 'Hurricane-resistant 2/3/4-panel heavy-duty sliding patio door.', 'Impact',
 ARRAY['Nail fin'],
 ARRAY['Dual Glazed Low-E 270','Dual Glazed Low-E 366','Low-E 270 w/ Argon','Low-E 366 w/ Argon','Dual Glazed Clear'],
 ARRAY['White','Stone','Bronze'], NULL, true, true)
) AS v(family, series, model, product_type, description, application,
        frame_options, glass_options, color_options, florida_approval, verified, active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ykk_products y
  WHERE y.series = v.series AND y.model = v.model AND y.org_id IS NULL
);

-- Baseline list prices live in a companion table for clean updates ----------
CREATE TABLE IF NOT EXISTS public.ykk_baseline_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ykk_products(id) ON DELETE CASCADE,
  baseline_list_price numeric NOT NULL,
  observed_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text
);
GRANT SELECT ON public.ykk_baseline_prices TO authenticated;
GRANT SELECT ON public.ykk_baseline_prices TO anon;
GRANT ALL ON public.ykk_baseline_prices TO service_role;
ALTER TABLE public.ykk_baseline_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ykk bp read" ON public.ykk_baseline_prices FOR SELECT TO anon USING (true);
CREATE POLICY "ykk bp auth read" ON public.ykk_baseline_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "ykk bp admin write" ON public.ykk_baseline_prices FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.ykk_baseline_prices (product_id, baseline_list_price, notes)
SELECT id, p.price, 'Baseline list price observed in ViewBuilder configurator, 2026-10-04'
FROM public.ykk_products y
JOIN (VALUES
  ('StyleView Classic','SH',189.66),
  ('StyleView Classic','DH',263.81),
  ('StyleView Classic','PW',186.35),
  ('StyleView Classic','CASE',436.68),
  ('StyleView Classic','AWN',382.21),
  ('StyleView Classic','SLD',258.19),
  ('Precedence','DH',311.36),
  ('StyleGuard','DH',678.07),
  ('StyleView','PD2',1477.40),
  ('StyleView HD','PD234',1576.75),
  ('StyleGuard HD','PD234I',3318.07)
) AS p(series, model, price) ON p.series = y.series AND p.model = y.model
WHERE NOT EXISTS (SELECT 1 FROM public.ykk_baseline_prices bp WHERE bp.product_id = y.id);
