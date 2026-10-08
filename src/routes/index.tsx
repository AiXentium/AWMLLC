import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Building2,
  ClipboardCheck,
  Handshake,
  Quote,
  ShieldCheck,
  Star,
  Truck,
  Waves,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageSections } from "@/components/site/PageSections";
import { useSitePage } from "@/lib/site-pages";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Disclaimer } from "@/components/site/Disclaimer";
import heroImg from "@/assets/hero-florida-dusk.webp";
import interiorImg from "@/assets/interior-coastal.webp";
import coastalImg from "@/assets/coastal-modern.webp";
import windowDetailImg from "@/assets/window-detail.webp";
import detailImg from "@/assets/detail-frame.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AWM LLC | Windows & Patio Doors for Florida Projects" },
      {
        name: "description",
        content:
          "AWM LLC — American Windows Manufacturer LLC — guides Florida projects from takeoff to installation, supplying YKK AP residential windows and patio doors: StyleView, StyleGuard impact, and Precedence replacement lines.",
      },
      { property: "og:title", content: "AWM LLC | Windows & Patio Doors for Florida Projects" },
      {
        property: "og:description",
        content:
          "Takeoff support, honest quoting, and on-time delivery of YKK AP windows and patio doors across Florida and Central Florida. Request a quote.",
      },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: HomePage,
});

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const trustItems = [
  {
    icon: BadgeCheck,
    title: "Authorized YKK AP Distributor",
    copy: "Factory-backed residential windows & patio doors, supplied by AWM",
  },
  {
    icon: Award,
    title: "Florida Product Approvals",
    copy: "FL IDs 8114.7 · 7533.2 · 7533.1 on key YKK AP configurations",
  },
  {
    icon: ShieldCheck,
    title: "Impact-Rated Options",
    copy: "YKK AP StyleGuard® paths for wind-borne debris regions",
  },
  {
    icon: Waves,
    title: "HVHZ-Ready Selections",
    copy: "High-velocity hurricane zone guidance, documented",
  },
];

const pillars = [
  {
    icon: Truck,
    title: "On-Time Delivery",
    copy: "Staged releases coordinated around your framing and dry-in schedule — not ours.",
  },
  {
    icon: BadgeCheck,
    title: "Quality",
    copy: "YKK AP engineering with documented configurations, confirmed with the manufacturer before you commit.",
  },
  {
    icon: ClipboardCheck,
    title: "Performance",
    copy: "DP ratings, impact glass, and Florida Building Code paths reviewed against your project's jurisdiction.",
  },
  {
    icon: Handshake,
    title: "Value",
    copy: "Distributor-direct pricing for builders, GCs, and contractors — plus takeoff support that saves estimating hours.",
  },
];

const whyAwm = [
  {
    icon: Handshake,
    title: "Dedicated Project Support",
    copy: "One point of contact from takeoff to delivery — product expertise, quote support, and supply you can plan around.",
  },
  {
    icon: ClipboardCheck,
    title: "Takeoff & Estimating Support",
    copy: "Send us your plans — our takeoff workspace turns blueprints into verified opening schedules and quote-ready counts.",
  },
  {
    icon: Building2,
    title: "Builder & Multifamily Ready",
    copy: "Repeatable unit packages, phased releases, and quantity discipline for stacked, multi-building work.",
  },
];

const gallery = [
  { src: heroImg, caption: "Florida residence at dusk — windows glowing" },
  { src: interiorImg, caption: "Bright coastal interiors — daylight by design" },
  { src: coastalImg, caption: "Coastal modern — impact-ready window walls" },
  { src: windowDetailImg, caption: "Vinyl frame detail — built for Florida" },
];

const SERIES_SHOWCASE = [
  {
    id: "styleview-classic",
    name: "StyleView® Classic",
    shortName: "StyleView Classic",
    application: "New construction",
    tagline: "The classic new-construction vinyl window",
    description:
      "YKK AP's flagship new-construction vinyl window — single-hung, double-hung, casement, awning, sliders, picture, transom, and geometric shapes with a traditional brickmold and integral J-channel that receives siding.",
    features: [
      "9 window types including arch-top single-hung",
      "Florida product approval 8114.7 (single hung)",
      "3/4-inch insulated Low-E glass standard",
    ],
    image: coastalImg,
    imageAlt: "Florida home with StyleView Classic vinyl windows",
    route: "/products/styleview",
  },
  {
    id: "styleguard",
    name: "StyleGuard®",
    shortName: "StyleGuard",
    application: "Coastal / impact",
    tagline: "Hurricane-resistant vinyl for wind-borne debris regions",
    description:
      "Impact-resistant vinyl windows built for Florida's coastal wind-borne debris zones — laminated impact glass, double weather stripping, and corrosion-resistant hardware in double-hung, fixed, casement, awning, and geometric configurations.",
    features: [
      "Impact glass meets ASTM and Miami-Dade protocols",
      "Florida product approval 7533.2 (double hung)",
      "Built for large apertures in coastal projects",
    ],
    image: heroImg,
    imageAlt: "Coastal Florida home with StyleGuard impact windows at dusk",
    route: "/products/styleguard",
  },
  {
    id: "precedence",
    name: "Precedence®",
    shortName: "Precedence",
    application: "Replacement / remodel",
    tagline: "The vinyl replacement window for retrofit work",
    description:
      "YKK AP's replacement window — the box-frame application sets into the existing opening after the old sash is removed. No nail fin, minimal disruption, ideal for remodel and retrofit packages.",
    features: [
      "Box-frame retrofit — fits existing openings",
      "Florida product approval 7533.1 (double hung)",
      "7 window types for whole-house replacement",
    ],
    image: interiorImg,
    imageAlt: "Bright interior with Precedence replacement windows",
    route: "/products/precedence",
  },
  {
    id: "patio-doors",
    name: "Sliding Patio Doors",
    shortName: "Patio Doors",
    application: "Indoor-outdoor living",
    tagline: "StyleView, StyleView HD & StyleGuard HD sliding doors",
    description:
      "Two to four-panel sliding patio doors for lanais, pool decks, and courtyards — including heavy-duty configurations to 16 feet wide and hurricane-resistant StyleGuard HD for coastal openings.",
    features: [
      "2, 3, and 4-panel configurations",
      "StyleGuard HD impact-rated for coastal zones",
      "DP50 structural performance",
    ],
    image: windowDetailImg,
    imageAlt: "Sliding patio door detail",
    route: "/products",
  },
];

/*
 * REPLACE WITH REAL REVIEWS — sample quotes below are placeholders.
 * Swap in verified customer feedback before launch.
 */
const reviews = [
  {
    quote:
      "They turned our window schedule around in days, not weeks. Every opening was verified against the plans before we ordered — zero surprises on site.",
    attribution: "Florida General Contractor",
  },
  {
    quote:
      "We compared three suppliers. AWM's YKK pricing was sharp, but the real difference was how fast they answered technical questions about impact requirements.",
    attribution: "Custom Home Builder",
  },
  {
    quote:
      "From takeoff to delivery, the process was documented and on schedule. Our multifamily phases released exactly when framing needed them.",
    attribution: "Multifamily Developer",
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function HomePage() {
  // Visual editor override: when a published site_pages row exists, it wins.
  // Before `supabase db push` this resolves to null and the hardcoded page renders.
  const { data: cms } = useSitePage("home");
  const cmsSections = cms?.content.sections;
  if (cmsSections && cmsSections.length > 0) {
    return (
      <SiteLayout>
        <PageSections sections={cmsSections} />
      </SiteLayout>
    );
  }
  return (
    <SiteLayout>
      {/* Utility bar */}
      <div className="bg-navy-soft text-navy-foreground">
        <div className="shell flex h-10 items-center justify-between gap-4 text-xs">
          <p className="truncate font-medium tracking-wide text-navy-foreground/75">
            AWM LLC — Windows &amp; Patio Doors for Florida and Central Florida Projects
          </p>
          <div className="flex shrink-0 items-center gap-4">
            <Link
              to="/contact"
              className="font-bold uppercase tracking-[0.14em] text-bronze transition-colors hover:text-navy-foreground"
            >
              Request a Quote
            </Link>
            <Link
              to="/takeoff-login"
              className="hidden font-semibold uppercase tracking-[0.14em] text-navy-foreground/70 transition-colors hover:text-navy-foreground sm:inline"
            >
              Takeoff Login
            </Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-navy text-navy-foreground">
        <img
          src={heroImg}
          alt="Modern Florida waterfront home with expansive YKK windows and sliding glass doors"
          width={1920}
          height={1088}
          className="absolute inset-0 -z-20 size-full object-cover"
        />
        <div
          className="absolute inset-0 -z-10 bg-linear-to-r from-navy via-navy/85 to-navy/20"
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-linear-to-t from-navy to-transparent"
          aria-hidden="true"
        />
        <div className="shell pb-16 pt-16 md:pb-24 md:pt-24">
          <div className="max-w-3xl fade-up">
            <p className="eyebrow">Authorized YKK AP Distributor</p>
            <h1 className="mt-4 text-5xl leading-[1.02] md:text-7xl">
              Florida Projects, Done Right
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-navy-foreground/85 md:text-lg">
              AWM LLC takes your project from takeoff to installation — supplying YKK AP residential
              windows and patio doors for new construction, coastal impact, multifamily, and
              replacement packages across Florida and Central Florida, with honest quoting and
              on-time delivery.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="border border-brand-red bg-brand-red text-base font-bold uppercase tracking-wide text-brand-red-foreground hover:bg-brand-red/90"
              >
                <Link to="/contact">Request a Quote</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-navy-foreground/40 bg-navy-foreground/10 text-base font-semibold text-navy-foreground backdrop-blur-sm hover:bg-navy-foreground/20 hover:text-navy-foreground"
              >
                <Link to="/products">Explore Products</Link>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-navy-foreground/70">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4 text-bronze" aria-hidden="true" />
                StyleView® · StyleGuard® · Precedence® — the YKK AP lineup AWM supplies
              </span>
              <span className="inline-flex items-center gap-2">
                <Award className="size-4 text-bronze" aria-hidden="true" />
                FL Approval IDs 8114.7 · 7533.2 · 7533.1
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-b border-border bg-card">
        <div className="shell grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <item.icon className="mt-0.5 size-6 shrink-0 text-brand-red" aria-hidden="true" />
              <div>
                <p className="font-semibold text-navy">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* YKK Series Showcase — Renaissance-style alternating image/text */}
      <section className="bg-sand py-16 md:py-24">
        <div className="shell">
          <div className="max-w-2xl">
            <p className="eyebrow">The YKK AP lineup we supply</p>
            <h2 className="mt-3 text-3xl text-navy md:text-5xl">
              Windows &amp; Patio Doors, by Series
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
              AWM helps you pick the right series for your opening, code path, and budget — then
              supplies it from the YKK AP residential lineup.
            </p>
          </div>

          <div className="mt-12 space-y-16 md:space-y-24">
            {SERIES_SHOWCASE.map((s, i) => (
              <div
                key={s.id}
                className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-12 ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}
              >
                <div className="group overflow-hidden rounded-lg">
                  <img
                    src={s.image}
                    alt={s.imageAlt}
                    className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    width={1200}
                    height={900}
                  />
                </div>
                <div>
                  <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                    {s.application}
                  </Badge>
                  <h3 className="mt-4 text-3xl text-navy md:text-4xl">{s.name}</h3>
                  <p className="mt-2 text-sm font-medium text-bronze">{s.tagline}</p>
                  <p className="mt-4 leading-relaxed text-muted-foreground">{s.description}</p>
                  <ul className="mt-5 space-y-2">
                    {s.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-foreground/90">
                        <BadgeCheck
                          className="mt-0.5 size-4 shrink-0 text-brand-red"
                          aria-hidden="true"
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button asChild>
                      <Link to={s.route}>View {s.shortName}</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/contact">Request a Quote</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button asChild variant="outline" size="lg">
              <Link to="/products">Open full product catalog</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Pillars — On Time Delivery, Quality, Performance & Value */}
      <section className="bg-navy py-16 text-navy-foreground md:py-24">
        <div className="shell">
          <div className="max-w-3xl">
            <p className="eyebrow">Our difference</p>
            <h2 className="mt-3 text-3xl md:text-5xl">
              On-Time Delivery, Quality, Performance &amp; Value
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-navy-foreground/75 md:text-base">
              We know from experience that these four top every customer's list. Here's how a
              distributor earns them.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((pillar, index) => (
              <div
                key={pillar.title}
                className="rounded-lg border border-navy-foreground/12 bg-navy-soft/60 p-6 transition-colors hover:border-bronze/40"
              >
                <div className="flex items-center justify-between">
                  <pillar.icon className="size-7 text-bronze" aria-hidden="true" />
                  <span className="font-serif text-4xl text-navy-foreground/15">0{index + 1}</span>
                </div>
                <h3 className="mt-4 text-2xl">{pillar.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-navy-foreground/72">
                  {pillar.copy}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact / coastal section */}
      <section className="bg-background py-16 md:py-24">
        <div className="shell grid items-center gap-10 lg:grid-cols-2">
          <div className="relative">
            <img
              src={detailImg}
              alt="Close-up of a YKK window frame engineered for coastal conditions"
              className="aspect-[4/3] w-full rounded-lg object-cover shadow-[var(--shadow-elevated)]"
              loading="lazy"
              width={1200}
              height={900}
            />
            <div className="absolute -bottom-6 -right-2 hidden rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)] md:block lg:-right-6">
              <p className="font-serif text-4xl text-brand-red">
                50<span className="text-xl"> psf</span>
              </p>
              <p className="mt-1 max-w-[12rem] text-xs leading-relaxed text-muted-foreground">
                Design-pressure paths available on impact configurations — confirmed per project.
              </p>
            </div>
          </div>
          <div>
            <p className="eyebrow">Hurricane protection</p>
            <h2 className="mt-3 text-3xl text-navy md:text-5xl">
              Coastal work, handled by people who know Florida
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground md:text-base">
              Florida's wind-borne debris regions and coastal codes leave no room for guesswork. AWM
              matches YKK AP StyleGuard® impact configurations to your project's wind speed,
              exposure, and jurisdiction — then confirms every approval with current manufacturer
              documentation before quoting.
            </p>
            <ul className="mt-7 space-y-4">
              {[
                "Impact-resistant glass and reinforced frames for debris-region projects",
                "Florida Building Code and HVHZ path guidance, documented per opening",
                "Approvals, availability, and specifications always confirmed with YKK AP",
              ].map((point) => (
                <li
                  key={point}
                  className="flex gap-3 text-sm leading-relaxed text-foreground md:text-base"
                >
                  <ShieldCheck
                    className="mt-0.5 size-5 shrink-0 text-brand-red"
                    aria-hidden="true"
                  />
                  {point}
                </li>
              ))}
            </ul>
            <Button
              asChild
              className="mt-8 border border-brand-red bg-brand-red text-brand-red-foreground hover:bg-brand-red/90"
            >
              <Link to="/products/styleguard">
                Explore StyleGuard® impact line <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Why AWM */}
      <section className="bg-sand py-16 md:py-24">
        <div className="shell">
          <div className="max-w-3xl">
            <p className="eyebrow">Why AWM</p>
            <h2 className="mt-3 text-3xl text-navy md:text-5xl">
              One partner for the whole opening package
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {whyAwm.map((item) => (
              <div key={item.title} className="surface-panel p-7">
                <item.icon className="size-7 text-brand-red" aria-hidden="true" />
                <h3 className="mt-4 text-2xl text-navy">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="overflow-hidden bg-background py-16 md:py-24">
        <div className="shell">
          <div className="max-w-3xl">
            <p className="eyebrow">Gallery</p>
            <h2 className="mt-3 text-3xl text-navy md:text-5xl">
              Beautifully crafted for Florida homes
            </h2>
          </div>
        </div>
        <div className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 md:px-8">
          {gallery.map((shot) => (
            <figure
              key={shot.caption}
              className="group relative w-72 shrink-0 snap-start overflow-hidden rounded-lg md:w-96"
            >
              <img
                src={shot.src}
                alt={shot.caption}
                loading="lazy"
                width={800}
                height={600}
                className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-navy/90 to-transparent p-4 pt-10 text-sm font-medium text-navy-foreground">
                {shot.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Reviews */}
      <section className="bg-navy py-16 text-navy-foreground md:py-24">
        <div className="shell">
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow">Reviews</p>
            <h2 className="mt-3 text-3xl md:text-5xl">What our customers say</h2>
            <div
              className="mt-2 flex items-center justify-center gap-1"
              aria-label="Five star rating"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-5 fill-bronze text-bronze" aria-hidden="true" />
              ))}
            </div>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {reviews.map((review) => (
              <blockquote
                key={review.attribution}
                className="flex flex-col rounded-lg border border-navy-foreground/12 bg-navy-soft/60 p-7"
              >
                <Quote className="size-7 text-bronze" aria-hidden="true" />
                <p className="mt-4 flex-1 text-sm leading-relaxed text-navy-foreground/85">
                  “{review.quote}”
                </p>
                <footer className="mt-6 border-t border-navy-foreground/12 pt-4 text-sm font-semibold text-bronze">
                  — {review.attribution}
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* Quote band */}
      <section className="relative isolate overflow-hidden bg-brand-red text-brand-red-foreground">
        <div
          className="absolute inset-0 -z-10 bg-linear-to-r from-brand-red via-brand-red to-navy/40"
          aria-hidden="true"
        />
        <div className="shell py-16 md:py-20">
          <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-red-foreground/70">
                Get started
              </p>
              <h2 className="mt-3 text-4xl md:text-6xl">Let's talk about your project</h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-brand-red-foreground/85 md:text-base">
                Send your plans or opening list — we'll review the selections, confirm
                configurations with YKK AP, and come back with a quote package.
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="shrink-0 border border-navy-foreground/30 bg-navy text-base font-bold uppercase tracking-wide text-navy-foreground hover:bg-navy-soft"
            >
              <Link to="/contact">
                Request a Quote <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-background py-16 md:py-20">
        <div className="shell surface-panel flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between lg:p-12">
          <div className="max-w-2xl">
            <p className="eyebrow">Ready to start?</p>
            <h2 className="mt-3 text-3xl text-navy md:text-4xl">
              Request a quote for your project
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
              Send your plans for a detailed quote tailored to your openings, schedule, and
              jurisdiction — or step into the AWM Takeoff workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="border border-brand-red bg-brand-red text-brand-red-foreground hover:bg-brand-red/90"
            >
              <Link to="/contact">Request a Quote</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/takeoff-login">Takeoff Login</Link>
            </Button>
          </div>
        </div>
        <div className="shell mt-8">
          <Disclaimer />
        </div>
      </section>
    </SiteLayout>
  );
}
