import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

/** White estimator report card used across every Control Center screen. */
export function ReportCard({
  title,
  description,
  icon: Icon,
  meta,
  tone = "neutral",
  to,
  linkLabel = "Open",
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  meta?: React.ReactNode;
  tone?: "neutral" | "ready" | "attention" | "blocked";
  to?: string;
  linkLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="surface-panel flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {Icon ? (
            <span
              className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md ${TONE_CHIP[tone]}`}
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>
          ) : null}
          <div>
            <h3 className="font-serif text-lg leading-tight text-navy">{title}</h3>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {meta}
      </div>

      {children ? <div className="mt-4 flex-1">{children}</div> : <div className="flex-1" />}

      {to ? (
        <Link
          to={to}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          {linkLabel}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </section>
  );
}

const TONE_CHIP: Record<string, string> = {
  neutral: "bg-secondary text-navy",
  ready: "bg-emerald-100 text-emerald-800",
  attention: "bg-amber-100 text-amber-800",
  blocked: "bg-destructive/10 text-destructive",
};

/** Renders a value, or an explicit "not found" flag — never a fabricated one. */
export function MissingValue({ label = "Not found in plans" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">
      {label}
    </span>
  );
}

export function FieldValue({
  value,
  missingLabel,
}: {
  value: string | number | null | undefined;
  missingLabel?: string;
}) {
  if (value === null || value === undefined || value === "")
    return <MissingValue label={missingLabel} />;
  return <>{value}</>;
}
