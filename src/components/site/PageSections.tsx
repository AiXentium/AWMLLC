import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero, Section, SectionHeading } from "@/components/site/Section";
import type { SiteSection } from "@/lib/site-pages";
import { sectionFontClass, siteImageSrc } from "./PageSections.utils";

function CtaButton({ label, href }: { label: string; href: string }) {
  if (!label) return null;
  const to = href || "/contact";
  const external = /^https?:\/\//.test(to);
  if (external) {
    return (
      <Button
        asChild
        size="lg"
        className="border border-brand-red bg-brand-red text-brand-red-foreground hover:bg-brand-red/90"
      >
        <a href={to} target="_blank" rel="noreferrer">
          {label}
          <ArrowRight className="ml-2 size-4" aria-hidden="true" />
        </a>
      </Button>
    );
  }
  return (
    <Button
      asChild
      size="lg"
      className="border border-brand-red bg-brand-red text-brand-red-foreground hover:bg-brand-red/90"
    >
      <Link to={to}>
        {label}
        <ArrowRight className="ml-2 size-4" aria-hidden="true" />
      </Link>
    </Button>
  );
}

function HeroSection({ section }: { section: SiteSection }) {
  return (
    <PageHero
      eyebrow={section.eyebrow || "AWM LLC"}
      title={section.heading}
      intro={section.body}
      image={siteImageSrc(section.image)}
      imageAlt=""
    >
      <CtaButton label={section.cta_label} href={section.cta_href} />
    </PageHero>
  );
}

function TextSection({ section }: { section: SiteSection }) {
  const paragraphs = section.body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const image = siteImageSrc(section.image);
  return (
    <Section>
      <div className={image ? "grid gap-10 lg:grid-cols-2 lg:items-center" : ""}>
        <div>
          <SectionHeading
            eyebrow={section.eyebrow || undefined}
            title={section.heading}
            intro={paragraphs[0]}
          />
          {paragraphs.slice(1).map((p, i) => (
            <p key={i} className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
          {section.cta_label ? (
            <div className="mt-8">
              <CtaButton label={section.cta_label} href={section.cta_href} />
            </div>
          ) : null}
        </div>
        {image ? (
          <img
            src={image}
            alt=""
            width={1200}
            height={800}
            loading="lazy"
            className="aspect-[3/2] w-full rounded-md object-cover"
          />
        ) : null}
      </div>
    </Section>
  );
}

function FeaturesSection({ section }: { section: SiteSection }) {
  const items = section.items ?? [];
  return (
    <Section tone="sand">
      <SectionHeading
        eyebrow={section.eyebrow || undefined}
        title={section.heading}
        intro={section.body || undefined}
      />
      {items.length > 0 ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => (
            <div key={i} className="rounded-md border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-bronze">
                {String(i + 1).padStart(2, "0")}
              </p>
              <p className="mt-3 text-xl text-navy">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

function CtaSection({ section }: { section: SiteSection }) {
  return (
    <Section tone="navy">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          {section.eyebrow ? <p className="eyebrow">{section.eyebrow}</p> : null}
          <h2 className="mt-3 text-3xl text-navy-foreground md:text-4xl">{section.heading}</h2>
          {section.body ? (
            <p className="mt-4 text-base leading-relaxed text-navy-foreground/75">{section.body}</p>
          ) : null}
        </div>
        <div className="shrink-0">
          <CtaButton
            label={section.cta_label || "Contact Us"}
            href={section.cta_href || "/contact"}
          />
        </div>
      </div>
    </Section>
  );
}

function GallerySection({ section }: { section: SiteSection }) {
  const shots = (section.items ?? [])
    .map((item) => ({ caption: item.title, src: siteImageSrc(item.text) }))
    .filter((s) => s.src);
  return (
    <Section>
      <SectionHeading
        eyebrow={section.eyebrow || undefined}
        title={section.heading}
        intro={section.body || undefined}
      />
      {shots.length > 0 ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shots.map((shot, i) => (
            <figure key={i} className="overflow-hidden rounded-md border border-border bg-card">
              <img
                src={shot.src}
                alt={shot.caption}
                width={900}
                height={600}
                loading="lazy"
                className="aspect-[3/2] w-full object-cover"
              />
              {shot.caption ? (
                <figcaption className="px-4 py-3 text-sm text-muted-foreground">
                  {shot.caption}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

/**
 * Renders CMS sections the way the public page would. Used by public
 * routes (when a published site_pages row exists) and by the editor's
 * live preview pane.
 */
export function PageSections({ sections }: { sections: SiteSection[] }) {
  const ordered = sections.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return (
    <>
      {ordered.map((section) => {
        const fontClass = sectionFontClass(section);
        const inner = (() => {
          switch (section.type) {
            case "hero":
              return <HeroSection section={section} />;
            case "text":
              return <TextSection section={section} />;
            case "features":
              return <FeaturesSection section={section} />;
            case "cta":
              return <CtaSection section={section} />;
            case "gallery":
              return <GallerySection section={section} />;
            default:
              return null;
          }
        })();
        return (
          <div key={section.id} className={fontClass || undefined}>
            {inner}
          </div>
        );
      })}
    </>
  );
}
