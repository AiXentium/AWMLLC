import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { ProductFamily } from "@/data/products";

export function FamilyCard({ family }: { family: ProductFamily }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]">
      <div className="aspect-[16/10] overflow-hidden bg-muted">
        <img
          src={family.image}
          alt={`${family.name} application: ${family.tagline}`}
          loading="lazy"
          width={1600}
          height={1008}
          className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col p-7">
        <p className="eyebrow">{family.applicationLabel}</p>
        <h3 className="mt-3 font-serif text-2xl text-navy">{family.registeredName}</h3>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
          {family.summary}
        </p>
        <Link
          to={family.route}
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-bronze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Explore {family.name}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </article>
  );
}
