import { cn } from "@/lib/utils";

/**
 * Technical estimator table: sticky header, scrollable body, tabular numerals.
 * Kept presentational so every Control Center report shares the same rhythm.
 */
export function StickyTable({
  children,
  className,
  maxHeight = "70vh",
}: {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}) {
  return (
    <div
      className={cn("overflow-auto rounded-lg border border-border bg-card", className)}
      style={{ maxHeight }}
    >
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function StickyHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-navy text-primary-foreground">
      <tr>{children}</tr>
    </thead>
  );
}

export function Th({
  children,
  align = "left",
  className,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className,
  colSpan,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border-t border-border px-3 py-2 align-middle",
        align === "right" && "text-right tabular-nums",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}
