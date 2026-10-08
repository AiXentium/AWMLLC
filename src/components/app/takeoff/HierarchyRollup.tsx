import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { OpeningRow } from "./OpeningRow";
import { Td } from "./StickyTable";
import { unrecordedLabel, type HierarchyNode } from "@/lib/takeoff/hierarchy";
import { cn } from "@/lib/utils";

const LEVEL_STYLE: Record<HierarchyNode["level"], string> = {
  building: "bg-secondary font-serif text-base text-navy",
  floor: "bg-secondary/60 font-medium text-navy",
  area: "bg-muted/50 text-foreground",
  type: "bg-transparent text-foreground",
};

/** Collapsible rollup row plus its children / openings. */
export function HierarchyRollup({
  node,
  depth = 0,
  defaultOpen = true,
}: {
  node: HierarchyNode;
  depth?: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <>
      <tr className={cn("border-t border-border", LEVEL_STYLE[node.level])}>
        <Td className="border-t-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-1.5 text-left"
            style={{ paddingLeft: depth * 16 }}
          >
            <Chevron className="size-4 shrink-0 opacity-70" aria-hidden="true" />
            {node.label ?? (
              <span className="italic text-muted-foreground">{unrecordedLabel(node.level)}</span>
            )}
          </button>
        </Td>
        <Td className="border-t-0 text-xs uppercase tracking-[0.1em] text-muted-foreground">
          {node.level}
        </Td>
        <Td className="border-t-0" />
        <Td className="border-t-0" />
        <Td align="right" className="border-t-0 font-semibold">
          {node.units}
        </Td>
        <Td align="right" className="border-t-0 text-muted-foreground">
          {node.openings} line{node.openings === 1 ? "" : "s"}
        </Td>
        <Td className="border-t-0" />
      </tr>

      {open
        ? node.level === "type"
          ? node.items.map((item) => <OpeningRow key={item.id} item={item} depth={depth + 1} />)
          : node.children.map((child) => (
              <HierarchyRollup
                key={child.key}
                node={child}
                depth={depth + 1}
                defaultOpen={depth < 1}
              />
            ))
        : null}
    </>
  );
}
