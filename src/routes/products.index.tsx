import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, ShieldCheck } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero, Section, SectionHeading } from "@/components/site/Section";
import { PageSections } from "@/components/site/PageSections";
import { useSitePage } from "@/lib/site-pages";
import { QuoteCta } from "@/components/site/QuoteCta";
import { Disclaimer } from "@/components/site/Disclaimer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SERIES,
  PRODUCT_TYPES,
  TYPE_VARIANTS_NOTE,
  FL_APPROVAL_NOTE,
  QUOTE_DISCLAIMER,
  type CatalogSeries,
  type ProductTypeId,
} from "@/data/products";
import {
  YKK_TYPE_IMAGES,
  YKK_PRODUCT_PHOTOS,
  YKK_FINISHES,
  YKK_GLASS,
  YKK_GRIDS,
} from "@/assets/ykk-catalog-images";
import detailImg from "@/assets/window-detail.webp";
import luxuryExteriorImg from "@/assets/products-luxury-exterior.webp";

const YKK_BROCHURES = [
  {
    title: "StyleView Flange Windows",
    detail: "Masonry flange option for Florida home building — product brochure (PDF).",
    url: "/docs/ykk/styleview-flange-brochure.pdf",
  },
  {
    title: "StyleView & Precedence HD Sliding Doors",
    detail: "Sliding patio door brochure with performance data (PDF).",
    url: "/docs/ykk/hd-sliding-door-brochure.pdf",
  },
  {
    title: "StyleGuard Double-Hung & Fixed — Installation",
    detail: "System description and installation manual (PDF).",
    url: "/docs/ykk/styleguard-double-hung-fixed-installation.pdf",
  },
  {
    title: "StyleView / StyleGuard Casement & Awning — Installation",
    detail: "System description and installation manual (PDF).",
    url: "/docs/ykk/styleview-styleguard-casement-awning-installation.pdf",
  },
  {
    title: "StyleView / StyleView Classic — Installation",
    detail: "System description and installation manual (PDF).",
    url: "/docs/ykk/styleview-styleview-classic-installation.pdf",
  },
];

const TYPE_IMAGE_KEY: Record<ProductTypeId, string> = {
  "single-hung": "singlehung",
  "single-hung-arch-top": "singlehung",
  "double-hung": "doublehung",
  "fixed-window": "picture",
  "picture-transom": "transom",
  casement: "casement",
  "casement-picture": "casement",
  awning: "awning",
  slider: "slider",
  "single-slider": "slider",
  geometric: "geometric",
  "sliding-patio-door": "patio",
  "sliding-patio-door-hd": "patio",
  "sliding-patio-door-sg-hd": "patio",
};

export const Route = createFileRoute("/products/")({
  head: () => ({
    meta: [
      { title: "Products | Windows & Patio Doors Supplied by AWM LLC" },
      {
        name: "description",
        content:
          "AWM LLC helps you pick the right series for your opening, code path, and budget — then supplies it from the YKK AP residential lineup: 6 window series and 3 sliding patio door series.",
      },
      { property: "og:title", content: "Products | Windows & Patio Doors Supplied by AWM LLC" },
      {
        property: "og:description",
        content:
          "Browse the YKK AP window and patio door series AWM LLC supplies across Florida — matched to your project by our team.",
      },
    ],
  }),
  component: ProductsPage,
});

function SeriesCard({ series }: { series: CatalogSeries }) {
  return (
    <article
      id={series.anchorId}
      className="surface-panel group scroll-mt-28 overflow-hidden p-0 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
    >
      <div className="overflow-hidden">
        <img
          src={series.image}
          alt={`${series.registeredName} — ${series.applicationDetail}`}
          className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          width={1200}
          height={760}
        />
      </div>
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
            {series.application}
          </Badge>
          <Badge variant="secondary">
            {series.category === "window" ? "Windows" : "Patio doors"}
          </Badge>
        </div>
        <h3 className="mt-4 text-2xl text-navy md:text-3xl">{series.registeredName}</h3>
        <p className="mt-1 text-sm font-medium text-bronze">{series.applicationDetail}</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{series.summary}</p>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-navy">
          Available types
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {series.types.map((t) => (
            <li
              key={t}
              className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-medium text-foreground/85"
            >
              {t}
            </li>
          ))}
        </ul>

        {series.flApproval ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
            <BadgeCheck className="size-3.5" aria-hidden="true" />
            FL Approval {series.flApproval.id} — {series.flApproval.label}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-5">
          {series.route ? (
            <Button asChild size="sm" variant="outline">
              <Link to={series.route}>
                View family <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
          <Button asChild size="sm">
            <Link to="/contact">Request a Quote</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function ProductsPage() {
  const windows = SERIES.filter((s) => s.category === "window");
  const doors = SERIES.filter((s) => s.category === "door");

  // Visual editor override: when a published site_pages row exists, it wins.
  const { data: cms } = useSitePage("products");
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
      <PageHero
        eyebrow="What we supply"
        title="The right series for every opening"
        intro="Tell us the application — new construction, coastal impact, or replacement — and AWM will match the series to your opening, code path, and budget. Below is the YKK AP residential lineup we supply: six window series and three sliding patio door series."
        image={detailImg}
        imageAlt=""
      >
        <Button asChild size="lg" variant="secondary">
          <Link to="/contact">Request a Quote</Link>
        </Button>
      </PageHero>

      <Section>
        <SectionHeading
          eyebrow="Windows — 6 series"
          title="Window series"
          intro="New construction, coastal impact, and replacement. Tell us the application and AWM will point you to the right series."
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {windows.map((s) => (
            <SeriesCard key={s.id} series={s} />
          ))}
        </div>
      </Section>

      <Section tone="sand">
        <SectionHeading
          eyebrow="Patio doors — 3 series"
          title="Sliding patio door series"
          intro="Two-panel to four-panel configurations, including hurricane-resistant StyleGuard HD."
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {doors.map((s) => (
            <SeriesCard key={s.id} series={s} />
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Know it by sight"
          title="Window & door types"
          intro="Every opening type in the YKK AP residential catalog, illustrated. If you can point at it, we can quote it."
        />
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {PRODUCT_TYPES.map((t) => (
            <div
              key={t.id}
              className="group overflow-hidden rounded-lg border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="bg-white p-4">
                <img
                  src={YKK_TYPE_IMAGES[TYPE_IMAGE_KEY[t.id]]}
                  alt={`${t.name} illustration`}
                  className="mx-auto aspect-square w-full max-w-[160px] object-contain"
                  loading="lazy"
                  width={300}
                  height={300}
                />
              </div>
              <div className="border-t border-border p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-bronze">
                  {t.category === "window" ? "Window" : "Patio door"}
                </p>
                <p className="mt-1 font-medium text-navy">{t.name}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="sand">
        <SectionHeading
          eyebrow="From the catalog"
          title="Product showcase"
          intro="Real YKK AP catalog photography — the actual window styles, by series. This is what shows up on the job."
        />
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {YKK_PRODUCT_PHOTOS.map((p) => (
            <figure
              key={`${p.series}-${p.type}`}
              className="group overflow-hidden rounded-lg border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="overflow-hidden bg-white">
                <img
                  src={p.src}
                  alt={`${p.series} ${p.type}`}
                  className="aspect-[6/5] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                  width={768}
                  height={640}
                />
              </div>
              <figcaption className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-bronze">
                  {p.series}
                </p>
                <p className="mt-1 font-medium text-navy">{p.type}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Finishes"
          title="Vinyl colors & finishes"
          intro="Five stock vinyl finishes across the residential lineup. Color availability varies by series — AWM confirms it on your quote."
        />
        <div className="mt-10 flex flex-wrap gap-6">
          {YKK_FINISHES.map((f) => (
            <div key={f.name} className="flex flex-col items-center gap-3">
              <img
                src={f.src}
                alt={`${f.name} vinyl finish`}
                className="size-24 rounded-full border border-border object-cover shadow-sm"
                loading="lazy"
                width={120}
                height={120}
              />
              <p className="text-sm font-medium text-navy">{f.name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="sand">
        <SectionHeading
          eyebrow="Glass"
          title="Glass packages & options"
          intro="3/4-inch insulated glass with Low-E and low-conductance spacers is standard. Pick the performance and the look."
        />
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {YKK_GLASS.map((g) => (
            <div key={g.name} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="bg-white p-4">
                <img
                  src={g.src}
                  alt={`${g.name} glass`}
                  className="mx-auto aspect-square w-full max-w-[140px] object-contain"
                  loading="lazy"
                  width={200}
                  height={200}
                />
              </div>
              <div className="border-t border-border p-4">
                <p className="font-medium text-navy">{g.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{g.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Grids"
          title="Grid patterns & styles"
          intro="Colonial to contemporary — grids between the glass or simulated divided lines."
        />
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {YKK_GRIDS.map((g) => (
            <div key={g.name} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="bg-white p-3">
                <img
                  src={g.src}
                  alt={`${g.name} grid pattern`}
                  className="mx-auto aspect-square w-full max-w-[120px] object-contain"
                  loading="lazy"
                  width={200}
                  height={200}
                />
              </div>
              <div className="border-t border-border p-3">
                <p className="text-sm font-medium text-navy">{g.name}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="sand">
        <SectionHeading
          eyebrow="Literature"
          title="YKK AP brochures & documents"
          intro="Official YKK AP product literature. YKK publishes series-specific brochures rather than one master catalog — these are the current ones."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {YKK_BROCHURES.map((b) => (
            <a
              key={b.url}
              href={b.url}
              target="_blank"
              rel="noreferrer noopener"
              className="group rounded-lg border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
            >
              <p className="font-medium text-navy group-hover:text-brand-red">{b.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{b.detail}</p>
              <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-red">
                Open PDF <ArrowRight className="size-4" aria-hidden="true" />
              </p>
            </a>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-7">
            <h3 className="font-serif text-xl text-navy">Type variants</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {TYPE_VARIANTS_NOTE}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-7">
            <h3 className="flex items-center gap-2 font-serif text-xl text-navy">
              <ShieldCheck className="size-5 text-brand-red" aria-hidden="true" />
              Florida approvals
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{FL_APPROVAL_NOTE}</p>
            <p className="mt-3 text-sm font-medium text-navy">{QUOTE_DISCLAIMER}</p>
          </div>
        </div>
        <Disclaimer className="mt-10" />
      </Section>

      <section className="shell">
        <div className="overflow-hidden rounded-lg">
          <img
            src={luxuryExteriorImg}
            alt="Luxury Florida home at golden hour with walls of windows"
            className="aspect-[21/9] w-full object-cover"
            loading="lazy"
          />
        </div>
      </section>

      <QuoteCta title="Let AWM price your openings" />
    </SiteLayout>
  );
}
