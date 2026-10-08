CREATE TABLE public.site_resource_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_resource_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_resource_categories TO authenticated;
GRANT ALL ON public.site_resource_categories TO service_role;
ALTER TABLE public.site_resource_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read resource categories" ON public.site_resource_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage resource categories" ON public.site_resource_categories FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.site_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug text NOT NULL REFERENCES public.site_resource_categories(slug) ON UPDATE CASCADE,
  title text NOT NULL,
  description text,
  product_category text,
  series text,
  file_type text NOT NULL DEFAULT 'PDF',
  file_size_bytes bigint,
  external_url text,
  storage_path text,
  thumbnail_url text,
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX site_resources_category_idx ON public.site_resources (category_slug);
GRANT SELECT ON public.site_resources TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_resources TO authenticated;
GRANT ALL ON public.site_resources TO service_role;
ALTER TABLE public.site_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read published resources" ON public.site_resources FOR SELECT USING (is_published = true);
CREATE POLICY "Admins manage resources" ON public.site_resources FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER site_resource_categories_updated_at BEFORE UPDATE ON public.site_resource_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER site_resources_updated_at BEFORE UPDATE ON public.site_resources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.site_resource_categories (slug, name, description, icon, sort_order) VALUES
 ('brochures','Brochures','Product brochures and marketing materials.','book-open',1),
 ('installation','Installation Instructions','Step-by-step installation guides for our systems.','wrench',2),
 ('florida-approvals','Florida Approvals','State of Florida product approvals and certifications.','badge-check',3),
 ('miami-dade-noa','Miami-Dade NOAs','Miami-Dade Notice of Acceptance documents.','building-2',4),
 ('warranty','Warranty','Warranty information and coverage details.','shield-check',5),
 ('energy','Energy Information','Energy performance data and certifications.','leaf',6),
 ('drawings','Drawings','CAD details, elevations, and technical drawings.','ruler',7),
 ('checklists','Project Checklists','Specification and project planning checklists.','clipboard-check',8);