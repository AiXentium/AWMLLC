import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { useScopeFilter } from "@/lib/takeoff/data";

const ALL = "__all__";

/**
 * Building / floor scope selector shared by every Control Center report.
 * Options come only from values present on the project's takeoff items.
 */
export function ScopeFilterBar({ scope }: { scope: ReturnType<typeof useScopeFilter> }) {
  const hasBuildings = scope.buildings.length > 0;
  const hasFloors = scope.floors.length > 0;

  if (!hasBuildings && !hasFloors) {
    return (
      <p className="text-sm text-muted-foreground">
        No building or floor values recorded on this project&apos;s openings yet — reports show the
        full scope.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Scope
      </span>

      {hasBuildings ? (
        <Select
          value={scope.building ?? ALL}
          onValueChange={(v) => scope.setBuilding(v === ALL ? null : v)}
        >
          <SelectTrigger className="w-[13rem]" aria-label="Filter by building">
            <SelectValue placeholder="All buildings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All buildings</SelectItem>
            {scope.buildings.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {hasFloors ? (
        <Select
          value={scope.floor ?? ALL}
          onValueChange={(v) => scope.setFloor(v === ALL ? null : v)}
        >
          <SelectTrigger className="w-[13rem]" aria-label="Filter by floor">
            <SelectValue placeholder="All floors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All floors</SelectItem>
            {scope.floors.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {scope.isFiltered ? (
        <Button variant="ghost" size="sm" onClick={scope.clear}>
          <X className="mr-1.5 size-4" aria-hidden="true" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
