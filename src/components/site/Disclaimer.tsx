import { Info } from "lucide-react";
import { AVAILABILITY_NOTE } from "@/data/products";
import { cn } from "@/lib/utils";

export function Disclaimer({ className, text }: { className?: string; text?: string }) {
  return (
    <p
      className={cn(
        "flex gap-3 rounded-md border border-border bg-secondary/60 p-4 text-sm leading-relaxed text-muted-foreground",
        className,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0 text-bronze" aria-hidden="true" />
      <span>{text ?? AVAILABILITY_NOTE}</span>
    </p>
  );
}
