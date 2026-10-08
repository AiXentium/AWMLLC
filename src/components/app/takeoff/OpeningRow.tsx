import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { MissingValue } from "./ReportCard";
import { Td } from "./StickyTable";
import { qtyOf, sizeLabel } from "@/lib/takeoff/hierarchy";
import { typeLabel } from "@/lib/takeoff-types";
import type { TakeoffItemRow } from "@/lib/takeoff/data";

/**
 * One opening line. Every cell renders the recorded value or an explicit
 * "not recorded" flag — no defaults, no inferred sizes.
 */
export function OpeningRow({ item, depth }: { item: TakeoffItemRow; depth: number }) {
  const size = sizeLabel(item);
  const type = item.type_name ?? item.product_type ?? item.category;
  const traceable = item.page_id && item.source_x !== null && item.source_y !== null;

  return (
    <tr className="hover:bg-muted/40">
      <Td>
        <span className="flex items-center" style={{ paddingLeft: depth * 16 }}>
          <span className="font-medium text-foreground">
            {item.mark ?? <MissingValue label="No mark" />}
          </span>
        </span>
      </Td>
      <Td>{type ? typeLabel(type) : <MissingValue label="Unclassified" />}</Td>
      <Td>{size ?? <MissingValue label="Size not recorded" />}</Td>
      <Td>{item.room ?? item.elevation ?? <MissingValue label="Location not recorded" />}</Td>
      <Td align="right">{qtyOf(item)}</Td>
      <Td align="right">
        {item.ai_confidence === null ? (
          <span className="text-muted-foreground">Manual</span>
        ) : (
          `${Math.round(item.ai_confidence * 100)}%`
        )}
      </Td>
      <Td>
        {traceable ? (
          <Link
            to="/app/viewer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
            aria-label={`Open ${item.mark ?? "opening"} on its plan sheet`}
          >
            Sheet
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Link>
        ) : (
          <MissingValue label="No plan coordinates" />
        )}
      </Td>
    </tr>
  );
}
