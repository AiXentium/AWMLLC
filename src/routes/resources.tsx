import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Building2,
  ClipboardCheck,
  FileText,
  Inbox,
  Leaf,
  Ruler,
  Search,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero, Section } from "@/components/site/Section";
import { PageSections } from "@/components/site/PageSections";
import { useSitePage } from "@/lib/site-pages";
import { Disclaimer } from "@/components/site/Disclaimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import heroImage from "@/assets/resources-craftsman.webp";
import {
  getResourceLibrary,
  type ResourceLibrary,
  type SiteResource,
} from "@/lib/site-resources.functions";

const libraryQuery = queryOptions({
  queryKey: ["site-resources"],
  queryFn: () => getResourceLibrary(),
});

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Resources | Brochures, Approvals & Technical Documents — AWM LLC" },
      {
        name: "description",
        content:
          "Brochures, installation instructions, Florida approvals, Miami-Dade NOAs, warranty, energy data, drawings, and project checklists for AWM window and door systems.",
      },
      {
        property: "og:title",
        content: "Resources | Brochures, Approvals & Technical Documents — AWM LLC",
      },
      {
        property: "og:description",
        content:
          "Everything you need to plan, specify and build with confidence — AWM LLC resource library.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(libraryQuery);
  },
  component: ResourcesPage,
});

const ICONS: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  wrench: Wrench,
  "badge-check": BadgeCheck,
  "building-2": Building2,
  "shield-check": ShieldCheck,
  leaf: Leaf,
  ruler: Ruler,
  "clipboard-check": ClipboardCheck,
};

const SORTS = [
  { value: "recent", label: "Most Recent" },
  { value: "az", label: "Title A–Z" },
  { value: "size", label: "Largest File" },
] as const;

function formatSize(bytes: number | null) {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function unique(values: (string | null)[]) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function ResourceRow({ resource }: { resource: SiteResource }) {
  const size = formatSize(resource.file_size_bytes);
  const body = (
    <div className="flex items-start gap-4 rounded-md border border-border bg-card p-3 transition-colors hover:border-bronze/60">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
        {resource.thumbnail_url ? (
          <img
            src={resource.thumbnail_url}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <FileText className="size-6 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug text-navy">{resource.title}</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-brand-red">
          {resource.file_type}
          {size ? <span className="text-muted-foreground"> • {size}</span> : null}
        </p>
      </div>
    </div>
  );

  if (!resource.external_url) return body;
  return (
    <a href={resource.external_url} target="_blank" rel="noreferrer noopener" className="block">
      {body}
    </a>
  );
}

function ResourcesPage() {
  const { data } = useSuspenseQuery(libraryQuery);
  // Visual editor override: when a published site_pages row exists, it wins.
  const { data: cms } = useSitePage("resources");
  const cmsSections = cms?.content.sections;
  if (cmsSections && cmsSections.length > 0) {
    return (
      <SiteLayout>
        <PageSections sections={cmsSections} />
      </SiteLayout>
    );
  }
  return <ResourcesView library={data} />;
}

function ResourcesView({ library }: { library: ResourceLibrary }) {
  const { categories, resources } = library;
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [productCategory, setProductCategory] = useState("all");
  const [series, setSeries] = useState("all");
  const [fileType, setFileType] = useState("all");
  const [sort, setSort] = useState<string>("recent");

  const productCategories = useMemo(
    () => unique(resources.map((item) => item.product_category)),
    [resources],
  );
  const seriesOptions = useMemo(() => unique(resources.map((item) => item.series)), [resources]);
  const fileTypes = useMemo(() => unique(resources.map((item) => item.file_type)), [resources]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = resources.filter((item) => {
      if (type !== "all" && item.category_slug !== type) return false;
      if (productCategory !== "all" && item.product_category !== productCategory) return false;
      if (series !== "all" && item.series !== series) return false;
      if (fileType !== "all" && item.file_type !== fileType) return false;
      if (term && !`${item.title} ${item.description ?? ""}`.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sort === "az") return a.title.localeCompare(b.title);
      if (sort === "size") return (b.file_size_bytes ?? 0) - (a.file_size_bytes ?? 0);
      return b.published_at.localeCompare(a.published_at);
    });
  }, [resources, search, type, productCategory, series, fileType, sort]);

  const filtersActive =
    search.trim() !== "" ||
    type !== "all" ||
    productCategory !== "all" ||
    series !== "all" ||
    fileType !== "all";

  function clearFilters() {
    setSearch("");
    setType("all");
    setProductCategory("all");
    setSeries("all");
    setFileType("all");
  }

  const visibleCategories = categories.filter(
    (category) => type === "all" || category.slug === type,
  );

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Documentation"
        title="Resources"
        intro="AWM's document library — brochures, approvals, and technical documents for the YKK AP products we supply."
        image={heroImage}
        imageAlt="Impact-rated window and door details on a Florida residence"
      />

      <Section tone="sand" className="py-14 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-8">
            <div>
              <h2 className="eyebrow">Quick Links</h2>
              <div className="mt-4 space-y-1 border-t border-border pt-4">
                {categories.map((category) => {
                  const Icon = ICONS[category.icon ?? ""] ?? FileText;
                  return (
                    <button
                      key={category.slug}
                      type="button"
                      onClick={() => setType(type === category.slug ? "all" : category.slug)}
                      className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                        type === category.slug
                          ? "bg-navy/5 font-semibold text-navy"
                          : "text-foreground hover:bg-navy/5"
                      }`}
                    >
                      <Icon className="size-4 text-navy" aria-hidden="true" />
                      {category.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="eyebrow">Search Resources</h2>
              <div className="mt-4 flex">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search resources..."
                  aria-label="Search resources"
                  className="rounded-r-none bg-card"
                />
                <span className="flex items-center rounded-r-md border border-l-0 border-border bg-muted px-3">
                  <Search className="size-4 text-muted-foreground" aria-hidden="true" />
                </span>
              </div>
            </div>

            <div>
              <h2 className="eyebrow">Filter By</h2>
              <div className="mt-4 space-y-3">
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger aria-label="Resource type" className="bg-card">
                    <SelectValue placeholder="Resource Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Resource Type</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.slug} value={category.slug}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={productCategory} onValueChange={setProductCategory}>
                  <SelectTrigger aria-label="Product category" className="bg-card">
                    <SelectValue placeholder="Product Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Product Category</SelectItem>
                    {productCategories.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={series} onValueChange={setSeries}>
                  <SelectTrigger aria-label="Series or system" className="bg-card">
                    <SelectValue placeholder="Series / System" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Series / System</SelectItem>
                    {seriesOptions.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={fileType} onValueChange={setFileType}>
                  <SelectTrigger aria-label="File type" className="bg-card">
                    <SelectValue placeholder="File Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">File Type</SelectItem>
                    {fileTypes.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs uppercase tracking-wide text-workspace-blue"
                  onClick={clearFilters}
                  disabled={!filtersActive}
                >
                  Clear filters
                </Button>
              </div>
            </div>
          </aside>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Showing {filtered.length} {filtered.length === 1 ? "resource" : "resources"}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Sort by:</span>
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger aria-label="Sort resources" className="w-44 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORTS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {visibleCategories.map((category) => {
                const Icon = ICONS[category.icon ?? ""] ?? FileText;
                const items = filtered.filter((item) => item.category_slug === category.slug);
                const featured = items.find((item) => item.is_featured) ?? items[0];
                return (
                  <article
                    key={category.slug}
                    className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-card"
                  >
                    <div className="flex size-11 items-center justify-center rounded-full bg-navy text-navy-foreground">
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-lg text-navy">{category.name}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {category.description}
                      </p>
                      <p className="mt-3 text-sm font-semibold text-workspace-blue">
                        {items.length} {items.length === 1 ? "Document" : "Documents"}
                      </p>
                    </div>
                    {featured ? (
                      <ResourceRow resource={featured} />
                    ) : (
                      <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                        No documents published in this category yet.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>

            {resources.length === 0 ? (
              <div className="mt-8 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center">
                <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />
                <h3 className="text-xl text-navy">No resources published yet</h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  Brochures, approvals, NOAs, and technical documents will appear here as soon as
                  they are published. Contact our team and we&apos;ll send what you need directly.
                </p>
                <Button asChild className="mt-2">
                  <Link to="/contact">Contact our team</Link>
                </Button>
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-6 shadow-card">
              <div className="flex items-start gap-4">
                <ClipboardCheck className="mt-1 size-6 text-workspace-blue" aria-hidden="true" />
                <div>
                  <h3 className="text-lg text-navy">
                    Can&apos;t find what you&apos;re looking for?
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Our team is here to help. Contact us for additional resources or support.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline">
                <Link to="/contact">
                  Contact our team
                  <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>

            <div className="mt-8">
              <Disclaimer text="External resources are published and maintained by their respective owners. AWM LLC does not control their content and is not responsible for changes to published documentation. Always confirm the current revision for your project." />
            </div>
          </div>
        </div>
      </Section>
    </SiteLayout>
  );
}
