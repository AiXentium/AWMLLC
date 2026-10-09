-- ============================================================================
-- AWM commercial-grade migration — verification, quoting, bids, multi-tenancy
-- ============================================================================
-- 1. Soft delete for working sets (never-delete rule)
-- 2. verification_events — append-only audit trail for every takeoff item
-- 3. quote_snapshots — frozen bid-defense records
-- 4. assemblies — quantity -> material + labor cost templates
-- 5. bids — bid board pipeline
-- 6. orgs + org_members — multi-tenant licensing foundation
-- 7. takeoff_items: source, multiplier (typical), verification stamps
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Org membership helpers (SECURITY DEFINER so RLS policies can call them
--    without recursive self-referencing subqueries, which Postgres rejects
--    as infinite recursion). Defined up-front because policies below use them.
-- ----------------------------------------------------------------------------
-- Tables must exist before SQL-language membership helpers are parsed.
CREATE TABLE IF NOT EXISTS public.orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan text NOT NULL DEFAULT 'trial',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'estimator',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orgs, public.org_members TO authenticated;
GRANT ALL ON public.orgs, public.org_members TO service_role;
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = p_org_id AND user_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members
                 WHERE org_id = p_org_id AND user_id = auth.uid() AND role IN ('owner','admin'));
$$;

-- ----------------------------------------------------------------------------
-- 1. Working sets soft delete
-- ----------------------------------------------------------------------------
ALTER TABLE public.working_sets ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ----------------------------------------------------------------------------
-- 2. Verification events (append-only audit)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  takeoff_item_id uuid REFERENCES public.takeoff_items(id) ON DELETE CASCADE,
  event text NOT NULL,
  actor text,
  note text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.verification_events TO authenticated;
GRANT ALL ON public.verification_events TO service_role;
ALTER TABLE public.verification_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ve read" ON public.verification_events FOR SELECT TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));
CREATE POLICY "ve insert" ON public.verification_events FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));
CREATE INDEX IF NOT EXISTS ve_item_idx ON public.verification_events (takeoff_item_id);
CREATE INDEX IF NOT EXISTS ve_project_idx ON public.verification_events (project_id);

-- ----------------------------------------------------------------------------
-- 3. Quote snapshots (frozen bid defense)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  name text NOT NULL,
  estimator text,
  notes text,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  jurisdiction jsonb NOT NULL DEFAULT '{}'::jsonb,
  overrides jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.quote_snapshots TO authenticated;
GRANT ALL ON public.quote_snapshots TO service_role;
ALTER TABLE public.quote_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qs read" ON public.quote_snapshots FOR SELECT TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));
CREATE POLICY "qs insert" ON public.quote_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));

-- ----------------------------------------------------------------------------
-- 4. Assemblies (quantity -> material + labor)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assemblies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  category text NOT NULL,
  name text NOT NULL,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assemblies TO authenticated;
GRANT ALL ON public.assemblies TO service_role;
ALTER TABLE public.assemblies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asm read" ON public.assemblies FOR SELECT TO authenticated
  USING (org_id IS NULL OR public.is_org_member(org_id));
CREATE POLICY "asm write" ON public.assemblies FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Seed: glazing assembly templates (system defaults, org_id NULL).
-- Idempotent: skips categories already seeded, so re-running never duplicates.
INSERT INTO public.assemblies (org_id, category, name, lines)
SELECT NULL, v.category, v.name, v.lines::jsonb
FROM (VALUES
('windows', 'Window install — per unit', '[{"kind":"material","description":"Window unit","qty_per_unit":1,"unit":"EA","waste_pct":0},{"kind":"material","description":"Flashing tape","qty_per_unit":20,"unit":"LF","waste_pct":0.1},{"kind":"material","description":"Sealant tubes","qty_per_unit":2,"unit":"EA","waste_pct":0.1},{"kind":"labor","description":"Install labor","qty_per_unit":1.5,"unit":"HR","waste_pct":0}]'),
('doors', 'Door install — per unit', '[{"kind":"material","description":"Door unit","qty_per_unit":1,"unit":"EA","waste_pct":0},{"kind":"material","description":"Shims & fasteners kit","qty_per_unit":1,"unit":"EA","waste_pct":0.05},{"kind":"labor","description":"Install labor","qty_per_unit":2,"unit":"HR","waste_pct":0}]'),
('sliding_doors', 'Sliding door install — per unit', '[{"kind":"material","description":"Sliding door unit","qty_per_unit":1,"unit":"EA","waste_pct":0},{"kind":"material","description":"Sill pan flashing","qty_per_unit":1,"unit":"EA","waste_pct":0.05},{"kind":"labor","description":"Install labor","qty_per_unit":3,"unit":"HR","waste_pct":0}]'),
('storefront_curtainwall', 'Storefront — per SF glass / LF frame', '[{"kind":"material","description":"Glass","qty_per_unit":1,"unit":"SF","waste_pct":0.05,"basis":"area"},{"kind":"material","description":"Aluminum framing","qty_per_unit":1,"unit":"LF","waste_pct":0.07,"basis":"perimeter"},{"kind":"labor","description":"Glazing labor","qty_per_unit":0.4,"unit":"HR","waste_pct":0,"basis":"area"}]'),
('louvers', 'Louver install — per unit', '[{"kind":"material","description":"Louver unit","qty_per_unit":1,"unit":"EA","waste_pct":0},{"kind":"labor","description":"Install labor","qty_per_unit":1,"unit":"HR","waste_pct":0}]'),
('skylights', 'Skylight install — per unit', '[{"kind":"material","description":"Skylight unit","qty_per_unit":1,"unit":"EA","waste_pct":0},{"kind":"material","description":"Flashing kit","qty_per_unit":1,"unit":"EA","waste_pct":0.05},{"kind":"labor","description":"Install labor","qty_per_unit":2.5,"unit":"HR","waste_pct":0}]')
) AS v(category, name, lines)
WHERE NOT EXISTS (
  SELECT 1 FROM public.assemblies a WHERE a.org_id IS NULL AND a.category = v.category
);

-- ----------------------------------------------------------------------------
-- 5. Bids (bid board pipeline)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  stage text NOT NULL DEFAULT 'lead',
  gc_name text,
  contact_name text,
  contact_email text,
  contact_phone text,
  due_date date,
  notes text,
  win_loss_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bids TO authenticated;
GRANT ALL ON public.bids TO service_role;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bids read" ON public.bids FOR SELECT TO authenticated
  USING (project_id IS NULL OR public.can_view_project(project_id, auth.uid()));
CREATE POLICY "bids write" ON public.bids FOR ALL TO authenticated
  USING (project_id IS NULL OR public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (project_id IS NULL OR public.can_edit_project(project_id, auth.uid()));
CREATE TRIGGER t_bids_updated BEFORE UPDATE ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 6. Multi-tenancy: orgs + org_members
-- ----------------------------------------------------------------------------
CREATE POLICY "orgs read" ON public.orgs FOR SELECT TO authenticated
  USING (public.is_org_member(orgs.id));
CREATE POLICY "orgs insert" ON public.orgs FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "org members read" ON public.org_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(org_members.org_id));
CREATE POLICY "org members manage" ON public.org_members FOR ALL TO authenticated
  USING (public.is_org_admin(org_members.org_id))
  WITH CHECK (public.is_org_admin(org_members.org_id));
CREATE POLICY "org members self join" ON public.org_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Tenant scoping columns (nullable during transition; enforced per-tenant later)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id);
ALTER TABLE public.ykk_products ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id);
CREATE INDEX IF NOT EXISTS projects_org_idx ON public.projects (org_id);
CREATE INDEX IF NOT EXISTS ykk_products_org_idx ON public.ykk_products (org_id);

-- ----------------------------------------------------------------------------
-- 7. Takeoff items: source, typical multiplier, verification stamps
-- ----------------------------------------------------------------------------
ALTER TABLE public.takeoff_items ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'ai';
ALTER TABLE public.takeoff_items ADD COLUMN IF NOT EXISTS multiplier integer NOT NULL DEFAULT 1;
ALTER TABLE public.takeoff_items ADD COLUMN IF NOT EXISTS verified_by uuid;
ALTER TABLE public.takeoff_items ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.takeoff_items ADD COLUMN IF NOT EXISTS override_reason text;
