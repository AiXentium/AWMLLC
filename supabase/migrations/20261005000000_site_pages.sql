-- AWM visual site editor: CMS pages backing the public marketing site.
-- Public (anon + authenticated) can read published pages.
-- Only owner_admin users can write. Reuses public.is_admin(auth.uid())
-- and the public.update_updated_at_column() trigger helper.

create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  is_published boolean not null default true,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_pages enable row level security;

drop policy if exists "site_pages public read" on public.site_pages;
create policy "site_pages public read" on public.site_pages
  for select to anon, authenticated
  using (is_published = true);

drop policy if exists "site_pages admin insert" on public.site_pages;
create policy "site_pages admin insert" on public.site_pages
  for insert to authenticated
  with check (public.is_admin(auth.uid()));

drop policy if exists "site_pages admin update" on public.site_pages;
create policy "site_pages admin update" on public.site_pages
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "site_pages admin delete" on public.site_pages;
create policy "site_pages admin delete" on public.site_pages
  for delete to authenticated
  using (public.is_admin(auth.uid()));

drop trigger if exists t_site_pages_updated on public.site_pages;
create trigger t_site_pages_updated
  before update on public.site_pages
  for each row execute function public.update_updated_at_column();

-- Seed the five public pages. Idempotent: never overwrites existing rows.
insert into public.site_pages (slug, title, content) values
('home', 'Home', '{"sections": [
  {"id": "home-hero", "type": "hero", "order": 1, "eyebrow": "Authorized YKK AP Distributor — Florida & the Southeast", "heading": "YKK Windows, Engineered for Florida Living", "body": "AWM LLC supplies YKK AP residential windows and patio doors for new construction, impact and coastal work, multifamily projects, and replacement packages across Florida and the Southeast.", "image": "hero-home.jpg", "cta_label": "Request a Quote", "cta_href": "/contact"},
  {"id": "home-trust", "type": "features", "order": 2, "heading": "Why builders and homeowners choose AWM", "body": "", "items": [
    {"title": "YKK AP Distributor", "text": "Genuine YKK AP residential product lines, sourced and supported by a Florida distributor."},
    {"title": "Florida Product Approvals", "text": "Impact and coastal selections matched to FL approvals such as 8114.7, 7533.2, and 7533.1."},
    {"title": "Impact-Rated Options", "text": "StyleGuard paths for projects where opening protection and approvals matter."},
    {"title": "Takeoff Support", "text": "Opening schedules and quantity support from the AWM Takeoff AI workspace."}
  ]},
  {"id": "home-impact", "type": "text", "order": 3, "eyebrow": "Coastal performance", "heading": "Designed for the most demanding conditions", "body": "Florida coastal projects face wind-borne debris, driving rain, and strict building codes. We help identify candidate YKK AP configurations for the stated project code path, then confirm specifics with current manufacturer documentation before quoting.\n\nApprovals, availability, and specifications are always subject to manufacturer confirmation.", "image": "detail-frame.jpg"},
  {"id": "home-cta", "type": "cta", "order": 4, "heading": "Ready to start your project?", "body": "Send project details for a quote request, or browse the YKK AP product catalog.", "cta_label": "Request a Quote", "cta_href": "/contact"}
]}'),
('products', 'Products', '{"sections": [
  {"id": "products-hero", "type": "hero", "order": 1, "eyebrow": "Product catalog", "heading": "YKK AP Windows & Patio Doors", "body": "StyleView, StyleGuard, and Precedence residential lines — supplied by AWM LLC for Florida new construction, coastal, multifamily, and replacement projects.", "image": "detail-frame.jpg", "cta_label": "Request a Quote", "cta_href": "/contact"},
  {"id": "products-families", "type": "features", "order": 2, "heading": "Product families", "body": "", "items": [
    {"title": "StyleView", "text": "Classic and flange vinyl windows and patio doors for new construction and replacement."},
    {"title": "StyleGuard", "text": "Impact-rated windows and patio doors for coastal and wind-borne debris regions."},
    {"title": "Precedence", "text": "Replacement-focused window line for retrofit and remodel work."}
  ]},
  {"id": "products-cta", "type": "cta", "order": 3, "heading": "Not sure which family fits?", "body": "Send your plans or opening schedule and we will recommend candidate configurations.", "cta_label": "Contact Us", "cta_href": "/contact"}
]}'),
('resources', 'Resources', '{"sections": [
  {"id": "resources-hero", "type": "hero", "order": 1, "eyebrow": "Resources", "heading": "Guides for Florida window projects", "body": "Practical references for product selection, coastal requirements, and project planning.", "image": "builders.jpg", "cta_label": "", "cta_href": ""},
  {"id": "resources-list", "type": "features", "order": 2, "heading": "Start here", "body": "", "items": [
    {"title": "Understanding Florida Product Approvals", "text": "What FL approval numbers mean and how to verify them at floridabuilding.org."},
    {"title": "Impact vs. Non-Impact: Which Openings Need What", "text": "How wind-borne debris regions and HVHZ rules affect product selection."},
    {"title": "Reading a Window Schedule", "text": "How to pull marks, sizes, and counts from architectural schedules for quoting."},
    {"title": "New Construction vs. Replacement Frames", "text": "Flange, block, and retrofit frame conditions and where each applies."}
  ]},
  {"id": "resources-cta", "type": "cta", "order": 3, "heading": "Have a project question?", "body": "Reach out — we answer selection and quoting questions for Florida projects.", "cta_label": "Contact Us", "cta_href": "/contact"}
]}'),
('about', 'About', '{"sections": [
  {"id": "about-hero", "type": "hero", "order": 1, "eyebrow": "About AWM LLC", "heading": "A Florida distributor for YKK AP windows & doors", "body": "AWM LLC — American Windows Manufacturer LLC — supplies YKK AP residential windows and patio doors to homeowners, builders, contractors, architects, and multifamily teams across Florida and the Southeast.", "image": "builders.jpg", "cta_label": "", "cta_href": ""},
  {"id": "about-story", "type": "text", "order": 2, "heading": "What we do", "body": "We focus on one thing: getting the right YKK AP windows and patio doors onto Florida projects. That means selection guidance against the stated code path, opening schedules and quantity support from our Takeoff AI workspace, and staged delivery coordination around the job schedule.\n\nWe are a distributor — product availability, approvals, and specifications are confirmed with the manufacturer before any quote is released.", "image": ""},
  {"id": "about-cta", "type": "cta", "order": 3, "heading": "Work with AWM", "body": "Tell us about your project and we will take it from there.", "cta_label": "Contact Us", "cta_href": "/contact"}
]}'),
('contact', 'Contact', '{"sections": [
  {"id": "contact-hero", "type": "hero", "order": 1, "eyebrow": "Contact", "heading": "Request a quote", "body": "Send project details — plans, opening schedules, or just a description — and we will respond with next steps.", "image": "", "cta_label": "", "cta_href": ""},
  {"id": "contact-info", "type": "text", "order": 2, "heading": "What to include", "body": "Project address and timeline, the product families or types you are considering, approximate opening counts or a window schedule if you have one, and whether any openings need impact ratings.\n\nUse the quote request form on this page and attach plans when you can — it speeds up the takeoff.", "image": ""}
]}')
on conflict (slug) do nothing;
