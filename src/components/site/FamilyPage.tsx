import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BadgeCheck, CheckCircle2, ShieldCheck } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero, Section, SectionHeading } from "@/components/site/Section";
import { QuoteCta } from "@/components/site/QuoteCta";
import { Disclaimer } from "@/components/site/Disclaimer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PRODUCT_TYPES,
  FL_APPROVAL_NOTE,
  QUOTE_DISCLAIMER,
  type ProductFamily,
  type ProductTypeId,
} from "@/data/products";
import { YKK_TYPE_IMAGES, YKK_PRODUCT_PHOTOS } from "@/assets/ykk-catalog-images";

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

export function FamilyPage({ family }: { family: ProductFamily }) {
  const types = PRODUCT_TYPES.filter((t) => family.types.includes(t.id));
  const windows = types.filter((t) => t.category === "window");
  const doors = types.filter((t) => t.category === "patio-door");
  const seriesNames = family.variants.map((v) => v.name);
  const photos = YKK_PRODUCT_PHOTOS.filter((p) =>
    seriesNames.some(
      (n) =>
        p.series.toLowerCase().includes(n.toLowerCase().split("®")[0].trim().toLowerCase()) ||
        n.toLowerCase().includes(p.series.toLowerCase()),
    ),
  );

  return (
    <SiteLayout>
      <PageHero
        eyebrow={`Supplied by AWM LLC · ${family.applicationLabel}`}
        title={`${family.registeredName} — ${family.tagline}`}
        intro={family.summary}
        image={family.image}
        imageAlt=""
      >
        <Button asChild size="lg" variant="secondary">
          <Link to="/contact">Request a Quote</Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="border-navy-foreground/40 bg-transparent text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
        >
          <Link to="/products">All products</Link>
        </Button>
      </PageHero>

      <Section>
        <div className="grid gap-14 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <SectionHeading eyebrow="About the family" title={`What ${family.name} is for`} />
            <p className="mt-6 text-base leading-relaxed text-muted-foreground">
              {family.longDescription}
            </p>

            <h3 className="mt-12 font-serif text-2xl text-navy">Benefits</h3>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {family.benefits.map((b) => (
                <li key={b} className="flex gap-3 text-sm leading-relaxed text-foreground/85">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-bronze" aria-hidden="true" />
                  {b}
                </li>
              ))}
            </ul>

            <h3 className="mt-12 font-serif text-2xl text-navy">Series in this family</h3>
            <div className="mt-5 grid gap-4">
              {family.variants.map((v) => (
                <div key={v.name} className="rounded-lg border border-border bg-card p-6">
                  <p className="text-lg font-semibold text-navy">{v.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{v.detail}</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {v.types.map((t) => (
                      <li
                        key={t}
                        className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-medium text-foreground/85"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <aside className="h-fit rounded-lg border border-border bg-card p-7">
            <h3 className="font-serif text-xl text-navy">Best used for</h3>
            <ul className="mt-4 space-y-3 text-sm text-foreground/85">
              {family.bestFor.map((b) => (
                <li key={b} className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-bronze" />
                  {b}
                </li>
              ))}
            </ul>
            <h3 className="mt-8 font-serif text-xl text-navy">Frame / application options</h3>
            <ul className="mt-4 space-y-4 text-sm">
              {family.frameOptions.map((o) => (
                <li key={o.name}>
                  <p className="font-medium text-navy">{o.name}</p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">{o.description}</p>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <Disclaimer className="mt-14" />
      </Section>

      <Section tone="sand">
        <SectionHeading
          eyebrow="Available types"
          title={`Window styles in ${family.name}`}
          intro="Know it by sight — every window style in this family, illustrated. Type availability depends on size, configuration, and project requirements."
        />
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {windows.map((t) => (
            <div
              key={t.id}
              className="group overflow-hidden rounded-lg border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="bg-white p-4">
                <img
                  src={YKK_TYPE_IMAGES[TYPE_IMAGE_KEY[t.id]]}
                  alt={`${t.name} illustration`}
                  className="mx-auto aspect-square w-full max-w-[140px] object-contain"
                  loading="lazy"
                  width={300}
                  height={300}
                />
              </div>
              <div className="border-t border-border p-4">
                <p className="font-medium text-navy">{t.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t.description}
                </p>
              </div>
            </div>
          ))}
        </div>
        {doors.length > 0 ? (
          <>
            <h3 className="mt-12 font-serif text-2xl text-navy">Patio doors</h3>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {doors.map((t) => (
                <div
                  key={t.id}
                  className="group overflow-hidden rounded-lg border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
                >
                  <div className="bg-white p-4">
                    <img
                      src={YKK_TYPE_IMAGES[TYPE_IMAGE_KEY[t.id]]}
                      alt={`${t.name} illustration`}
                      className="mx-auto aspect-square w-full max-w-[140px] object-contain"
                      loading="lazy"
                      width={300}
                      height={300}
                    />
                  </div>
                  <div className="border-t border-border p-4">
                    <p className="font-medium text-navy">{t.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {t.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </Section>

      {photos.length > 0 ? (
        <Section>
          <SectionHeading
            eyebrow="From the catalog"
            title={`${family.name} product photos`}
            intro="Real YKK AP catalog photography for this family's series."
          />
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p) => (
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
      ) : null}

      <Section>
        <SectionHeading
          eyebrow="Size guide"
          title={`Maximum standard sizes — ${family.name}`}
          intro="Standard maximum dimensions from YKK AP published specifications. Custom sizes available in ⅛″ increments — confirm exact sizing with AWM for your openings."
        />
        <div className="mt-8 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-navy text-navy-foreground">
                <th className="px-6 py-4 font-semibold">Window / door type</th>
                <th className="px-6 py-4 font-semibold">Max standard size (W × H)</th>
                <th className="hidden px-6 py-4 font-semibold sm:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {family.sizeGuide.map((s) => (
                <tr key={s.type} className="transition-colors hover:bg-secondary/40">
                  <td className="px-6 py-4 font-medium text-navy">{s.type}</td>
                  <td className="px-6 py-4 font-mono text-foreground">{s.maxSize}</td>
                  <td className="hidden px-6 py-4 text-muted-foreground sm:table-cell">
                    {s.note ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Sizes shown are manufacturer standard maximums. Rough openings are typically ½″ larger
          than the window frame in each direction. Full size charts with block call sizes are in the
          official YKK AP brochures — see Resources.
        </p>
      </Section>

      <Section>
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Options" title="Sizes, glass, grilles, colors & hardware" />
            <dl className="mt-8 divide-y divide-border rounded-lg border border-border bg-card">
              {family.options.map((o) => (
                <div
                  key={o.label}
                  className="grid gap-1 px-6 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4"
                >
                  <dt className="text-sm font-semibold text-navy">{o.label}</dt>
                  <dd className="text-sm leading-relaxed text-muted-foreground">{o.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <SectionHeading eyebrow="Approvals" title="Florida Product Approvals" />
            {family.flApprovals.length ? (
              <ul className="mt-8 space-y-3">
                {family.flApprovals.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-4"
                  >
                    <BadgeCheck className="size-5 shrink-0 text-brand-red" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-navy">{a.label}</p>
                      <p className="text-sm text-muted-foreground">
                        FL Approval ID <span className="font-mono font-semibold">{a.id}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
                Approval documentation is supplied per confirmed configuration.
              </p>
            )}
            <p className="mt-5 flex gap-2 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-bronze" aria-hidden="true" />
              {FL_APPROVAL_NOTE}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge variant="secondary">{QUOTE_DISCLAIMER}</Badge>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="sand">
        <SectionHeading
          eyebrow="Manufacturer resources"
          title="Official YKK AP documentation"
          intro="Literature, installation instructions, and warranty information are published and maintained by the manufacturer."
        />
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <a href="https://www.ykkap.com/residential/" target="_blank" rel="noopener noreferrer">
              YKK AP Residential
              <ArrowUpRight className="ml-1 size-4" aria-hidden="true" />
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link to="/products">All products</Link>
          </Button>
        </div>
      </Section>

      <QuoteCta title={`Get an AWM quote on ${family.name}`} />
    </SiteLayout>
  );
}
