/**
 * Assembly cost engine — turns takeoff quantities into material + labor cost.
 *
 * An assembly is a reusable template (seeded per category in the `assemblies`
 * table, org_id NULL = system default). Each line consumes one takeoff
 * quantity driver:
 *   basis "area"      → areaSf      (e.g. glass per SF)
 *   basis "perimeter" → perimeterLf (e.g. framing per LF)
 *   basis undefined   → units       (e.g. one window unit per EA)
 *
 * Waste is applied to the LINE QUANTITY, never to the unit cost:
 *   quantity = driver × qty_per_unit × (1 + waste_pct)
 *   total    = quantity × unitCost
 *
 * Material unit costs come from the estimator (rates.materialRates, keyed by
 * line description). Labor lines always use rates.laborRate as the unit cost.
 * No AI arithmetic anywhere — the estimator's rates in, deterministic math out.
 */
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export type AssemblyLineKind = "material" | "labor";

/** Which takeoff quantity drives this line. Undefined = per unit (EA count). */
export type AssemblyLineBasis = "area" | "perimeter";

export interface AssemblyLine {
  kind: AssemblyLineKind;
  description: string;
  qty_per_unit: number;
  /** Billing unit: EA, LF, SF, HR, ... */
  unit: string;
  waste_pct: number;
  basis?: AssemblyLineBasis;
}

const assemblyLinesSchema = z.array(
  z.object({
    kind: z.enum(["material", "labor"]),
    description: z.string(),
    qty_per_unit: z.number().finite(),
    unit: z.string(),
    waste_pct: z.number().finite(),
    basis: z.enum(["area", "perimeter"]).optional(),
  }),
);

export interface Assembly {
  id: string;
  /** NULL = system template; set for tenant-specific overrides. */
  org_id: string | null;
  category: string;
  name: string;
  lines: AssemblyLine[];
  created_at: string;
}

/** Takeoff quantities feeding one assembly. */
export interface TakeoffQtyInput {
  units: number;
  areaSf: number;
  perimeterLf: number;
}

export interface AssemblyRates {
  /** Material unit cost keyed by line description. */
  materialRates: Record<string, number>;
  /** Hourly rate applied to every labor line. */
  laborRate: number;
}

export interface CostLine {
  kind: AssemblyLineKind;
  description: string;
  /** Driver × qty_per_unit × (1 + waste_pct), rounded to 2 decimals. */
  quantity: number;
  unit: string;
  unitCost: number;
  total: number;
}

/**
 * Loads the system assembly templates for a category (org_id IS NULL).
 * Tenant overrides (org_id set) are a later step; the RLS read policy
 * currently allows any authenticated user to read templates.
 */
export async function fetchAssemblies(category: string): Promise<Assembly[]> {
  const { data, error } = await supabase
    .from("assemblies")
    .select("id,org_id,category,name,lines,created_at")
    .eq("category", category)
    .is("org_id", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((a) => ({
    ...a,
    lines: assemblyLinesSchema.parse(a.lines),
  }));
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Picks the takeoff quantity that drives one assembly line. */
function driverQty(line: AssemblyLine, q: TakeoffQtyInput): number {
  if (line.basis === "area") return q.areaSf;
  if (line.basis === "perimeter") return q.perimeterLf;
  return q.units;
}

/**
 * Explodes one assembly into priced cost lines for the given takeoff
 * quantities and estimator rates.
 */
export function applyAssembly(
  q: TakeoffQtyInput,
  assembly: Assembly,
  rates: AssemblyRates,
): CostLine[] {
  return assembly.lines.map((line) => {
    const quantity = round2(driverQty(line, q) * line.qty_per_unit * (1 + (line.waste_pct ?? 0)));
    const unitCost =
      line.kind === "labor" ? rates.laborRate : (rates.materialRates[line.description] ?? 0);
    return {
      kind: line.kind,
      description: line.description,
      quantity,
      unit: line.unit,
      unitCost: round2(unitCost),
      total: round2(quantity * unitCost),
    };
  });
}

export interface AssemblyCostTotals {
  material: number;
  labor: number;
  total: number;
}

/** Splits cost-line totals into material / labor / combined. */
export function assemblyTotals(costLines: CostLine[]): AssemblyCostTotals {
  const material = round2(
    costLines.filter((l) => l.kind === "material").reduce((s, l) => s + l.total, 0),
  );
  const labor = round2(
    costLines.filter((l) => l.kind === "labor").reduce((s, l) => s + l.total, 0),
  );
  return { material, labor, total: round2(material + labor) };
}

/** USD formatting for cost display. */
export function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
