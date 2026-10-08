import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, SlidersHorizontal } from "lucide-react";
import {
  APPLICATIONS,
  CATALOG,
  FAMILIES,
  PRODUCT_TYPES,
  type ApplicationId,
  type CatalogItem,
  type FamilyId,
  type ProductTypeId,
} from "@/data/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Disclaimer } from "./Disclaimer";
import { cn } from "@/lib/utils";

type CategoryFilter = "all" | "window" | "patio-door";

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                active
                  ? "border-navy bg-navy text-navy-foreground"
                  : "border-border bg-card text-foreground/80 hover:border-bronze hover:text-bronze",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ProductExplorer({ lockedFamily }: { lockedFamily?: FamilyId }) {
  const [family, setFamily] = useState<FamilyId | "all">(lockedFamily ?? "all");
  const [application, setApplication] = useState<ApplicationId | "all">("all");
  const [type, setType] = useState<ProductTypeId | "all">("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [frame, setFrame] = useState<string>("all");
  const [active, setActive] = useState<CatalogItem | null>(null);

  const frameOptions = useMemo(() => {
    const names = new Set<string>();
    FAMILIES.forEach((f) => f.frameOptions.forEach((o) => names.add(o.name)));
    return [{ id: "all", label: "All" }, ...[...names].map((n) => ({ id: n, label: n }))];
  }, []);

  const results = useMemo(
    () =>
      CATALOG.filter((item) => {
        if (lockedFamily && item.family.id !== lockedFamily) return false;
        if (!lockedFamily && family !== "all" && item.family.id !== family) return false;
        if (application !== "all" && item.family.application !== application) return false;
        if (type !== "all" && item.type.id !== type) return false;
        if (category !== "all" && item.type.category !== category) return false;
        if (frame !== "all" && !item.family.frameOptions.some((o) => o.name === frame))
          return false;
        return true;
      }),
    [lockedFamily, family, application, type, category, frame],
  );

  const reset = () => {
    if (!lockedFamily) setFamily("all");
    setApplication("all");
    setType("all");
    setCategory("all");
    setFrame("all");
  };

  return (
    <div>
      <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)] md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <p className="flex items-center gap-2 font-serif text-xl text-navy">
            <SlidersHorizontal className="size-4 text-bronze" aria-hidden="true" />
            Filter products
          </p>
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset filters
          </Button>
        </div>

        <div className="grid gap-7 md:grid-cols-2">
          {!lockedFamily && (
            <FilterGroup
              label="Product family"
              value={family}
              onChange={(id) => setFamily(id as FamilyId | "all")}
              options={[
                { id: "all", label: "All families" },
                ...FAMILIES.map((f) => ({ id: f.id, label: f.registeredName })),
              ]}
            />
          )}
          <FilterGroup
            label="Application"
            value={application}
            onChange={(id) => setApplication(id as ApplicationId | "all")}
            options={[
              { id: "all", label: "All applications" },
              ...APPLICATIONS.map((a) => ({ id: a.id, label: a.label })),
            ]}
          />
          <FilterGroup
            label="Category"
            value={category}
            onChange={(id) => setCategory(id as CategoryFilter)}
            options={[
              { id: "all", label: "Windows & doors" },
              { id: "window", label: "Windows" },
              { id: "patio-door", label: "Patio doors" },
            ]}
          />
          <FilterGroup
            label="Frame / application style"
            value={frame}
            onChange={setFrame}
            options={frameOptions}
          />
          <div className="md:col-span-2">
            <FilterGroup
              label="Product type"
              value={type}
              onChange={(id) => setType(id as ProductTypeId | "all")}
              options={[
                { id: "all", label: "All types" },
                ...PRODUCT_TYPES.map((t) => ({ id: t.id, label: t.name.replace(" window", "") })),
              ]}
            />
          </div>
        </div>
      </div>

      <p className="mt-8 text-sm text-muted-foreground" role="status" aria-live="polite">
        Showing {results.length} {results.length === 1 ? "configuration" : "configurations"}
      </p>

      {results.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border p-12 text-center">
          <p className="font-serif text-xl text-navy">No matching configurations</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try clearing a filter, or contact us and we'll confirm options with the manufacturer.
          </p>
          <Button className="mt-6" variant="outline" onClick={reset}>
            Reset filters
          </Button>
        </div>
      ) : (
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setActive(item)}
                className="group flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  <img
                    src={item.family.image}
                    alt={`${item.type.name} shown in a ${item.family.name} application`}
                    loading="lazy"
                    width={1600}
                    height={1008}
                    className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-navy/90 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-navy-foreground">
                    {item.family.registeredName}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-serif text-xl text-navy">{item.type.name}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {item.type.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="secondary">{item.family.applicationLabel}</Badge>
                    <Badge variant="outline">
                      {item.type.category === "window" ? "Window" : "Patio door"}
                    </Badge>
                  </div>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-bronze">
                    View details
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          {active ? (
            <>
              <DialogHeader>
                <p className="eyebrow">{active.family.registeredName}</p>
                <DialogTitle className="font-serif text-2xl text-navy">
                  {active.type.name}
                </DialogTitle>
                <DialogDescription className="text-base leading-relaxed">
                  {active.type.detail}
                </DialogDescription>
              </DialogHeader>

              <img
                src={active.family.image}
                alt={`${active.family.name} ${active.type.name} application example`}
                loading="lazy"
                width={1600}
                height={1008}
                className="aspect-[16/9] w-full rounded-md object-cover"
              />

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Typical considerations
                  </h4>
                  <ul className="mt-3 space-y-2 text-sm text-foreground/85">
                    {active.type.considerations.map((c) => (
                      <li key={c} className="flex gap-2">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-bronze" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Frame / application options
                  </h4>
                  <ul className="mt-3 space-y-2 text-sm text-foreground/85">
                    {active.family.frameOptions.map((o) => (
                      <li key={o.name} className="flex gap-2">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-bronze" />
                        {o.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <Disclaimer />

              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/contact">Request a Quote</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={active.family.route}>Explore {active.family.name}</Link>
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
