/**
 * Jurisdiction intelligence — turns a geocoded project location into the
 * rules and requirements that govern the ENTIRE project, not just windows.
 *
 * Pure deterministic module: no API calls, no model guessing. What it can
 * determine from state/county/city it states; what needs the plans, the AHJ,
 * or a lookup tool it lists under `verify` for the estimator.
 *
 * Florida wind logic (confident):
 * - HVHZ = Miami-Dade or Broward county (FBC 1626) → impact required,
 *   TAS protocols, product approvals (NOA) mandatory.
 * - Wind-borne debris region (FBC 1609.1.2): within 1 mile of the coast
 *   where ultimate wind speed ≥ 130 mph, or anywhere ≥ 140 mph. Distance
 *   to coast needs a map check, so coastal counties are flagged "likely —
 *   verify" rather than asserted.
 */

import type { ShortcutCategory } from "@/lib/takeoff/orchestrator";

export type JurisdictionInput = {
  state: string | null;
  county: string | null;
  city: string | null;
  zip: string | null;
  lat: number | null;
  lon: number | null;
};

export type Requirement = {
  area: "building" | "wind" | "impact" | "energy" | "flood" | "safety";
  title: string;
  detail: string;
  /** "code" = from the codified rule; "verify" = estimator must confirm. */
  status: "code" | "verify";
};

export type JurisdictionRequirements = {
  state: string | null;
  county: string | null;
  city: string | null;
  buildingCode: string;
  buildingCodeEdition: string;
  windStandard: string;
  /** High-Velocity Hurricane Zone (Miami-Dade / Broward). */
  hvhz: boolean;
  /** True = in WBDR, "likely" = coastal county, verify distance to coast. */
  windBorneDebris: boolean | "likely" | false;
  /** Impact glazing/shutters required on glazed openings. */
  impactRequired: boolean;
  energyCode: string;
  requirements: Requirement[];
  /** Per-category product implications for quoting. */
  productImplications: Partial<Record<ShortcutCategory, string[]>>;
  /** Things the estimator must confirm from plans, AHJ, or lookup tools. */
  verify: string[];
  source: "county" | "state" | "model";
};

type StateCode = {
  code: string;
  edition: string;
  windStandard: string;
  energy: string;
};

const STATE_CODES: Record<string, StateCode> = {
  FL: {
    code: "Florida Building Code",
    edition: "8th Edition (2023)",
    windStandard: "ASCE 7-22 (FBC 1609.3)",
    energy: "Florida Energy Conservation Code, 8th Edition",
  },
  GA: {
    code: "Georgia State Minimum Standard Residential Code",
    edition: "IRC 2018-based with GA amendments",
    windStandard: "ASCE 7-16 (GA amendments)",
    energy: "Georgia Energy Code (IECC 2015-based)",
  },
  AL: {
    code: "Alabama Residential Code",
    edition: "IRC 2015-based",
    windStandard: "ASCE 7-10/16 per local adoption",
    energy: "IECC 2015 (state minimum)",
  },
  SC: {
    code: "South Carolina Residential Code",
    edition: "IRC 2021-based",
    windStandard: "ASCE 7-22",
    energy: "IECC 2021",
  },
  NC: {
    code: "North Carolina Residential Code",
    edition: "IRC 2018-based with NC amendments",
    windStandard: "ASCE 7-16",
    energy: "NC Energy Conservation Code",
  },
  LA: {
    code: "Louisiana State Uniform Construction Code",
    edition: "IRC 2021-based",
    windStandard: "ASCE 7-22",
    energy: "IECC 2021",
  },
  MS: {
    code: "Mississippi — locally adopted IRC",
    edition: "varies by AHJ",
    windStandard: "ASCE 7 per AHJ",
    energy: "IECC per AHJ",
  },
  TN: {
    code: "Tennessee — locally adopted IRC",
    edition: "varies by AHJ",
    windStandard: "ASCE 7 per AHJ",
    energy: "IECC per AHJ",
  },
  TX: {
    code: "Texas — locally adopted IRC (no statewide code)",
    edition: "varies by AHJ",
    windStandard: "ASCE 7 per AHJ",
    energy: "IECC per AHJ",
  },
};

const IRC_MODEL: StateCode = {
  code: "IRC-based residential code (confirm AHJ adoption)",
  edition: "per local AHJ",
  windStandard: "ASCE 7 per AHJ",
  energy: "IECC per AHJ",
};

/** All Florida coastal counties — WBDR screening candidates. */
const FL_COASTAL_COUNTIES = new Set(
  [
    "miami-dade",
    "dade",
    "broward",
    "palm beach",
    "martin",
    "st. lucie",
    "saint lucie",
    "indian river",
    "brevard",
    "volusia",
    "flagler",
    "st. johns",
    "saint johns",
    "duval",
    "nassau",
    "monroe",
    "collier",
    "lee",
    "charlotte",
    "sarasota",
    "manatee",
    "hillsborough",
    "pinellas",
    "pasco",
    "hernando",
    "citrus",
    "levy",
    "dixie",
    "taylor",
    "jefferson",
    "wakulla",
    "franklin",
    "gulf",
    "bay",
    "walton",
    "okaloosa",
    "santa rosa",
    "escambia",
  ].map((c) => c.toLowerCase()),
);

function normCounty(county: string | null): string {
  return (county ?? "")
    .toLowerCase()
    .replace(/\s+county$/, "")
    .trim();
}

export function getJurisdictionRequirements(input: JurisdictionInput): JurisdictionRequirements {
  const state = (input.state ?? "").trim().toUpperCase() || null;
  const county = input.county?.trim() || null;
  const city = input.city?.trim() || null;
  const sc = state ? STATE_CODES[state] : undefined;
  const code = sc ?? IRC_MODEL;

  const requirements: Requirement[] = [];
  const verify: string[] = [];
  const productImplications: Partial<Record<ShortcutCategory, string[]>> = {};

  let hvhz = false;
  let windBorneDebris: boolean | "likely" | false = false;
  let impactRequired = false;

  // ---- Building code ----
  requirements.push({
    area: "building",
    title: "Building code",
    detail: `${code.code}, ${code.edition}`,
    status: sc ? "code" : "verify",
  });
  if (!sc) verify.push("Confirm the adopted building code and edition with the local AHJ.");

  // ---- Wind ----
  requirements.push({
    area: "wind",
    title: "Design wind standard",
    detail: code.windStandard,
    status: sc ? "code" : "verify",
  });
  verify.push(
    "Confirm the ultimate design wind speed (Vult) and exposure category from the structural plans or the ASCE 7 Hazard Tool.",
  );

  // ---- Florida wind-borne debris / HVHZ ----
  if (state === "FL") {
    const c = normCounty(county);
    if (c === "miami-dade" || c === "dade" || c === "broward") {
      hvhz = true;
      windBorneDebris = true;
      impactRequired = true;
    } else if (FL_COASTAL_COUNTIES.has(c)) {
      windBorneDebris = "likely";
    }
    if (hvhz) {
      requirements.push({
        area: "wind",
        title: "High-Velocity Hurricane Zone (HVHZ)",
        detail: `${county} is in the HVHZ (FBC 1626). All exterior glazing needs Miami-Dade NOA / FL product approval; large-missile impact protocol (TAS 201/202/203).`,
        status: "code",
      });
      requirements.push({
        area: "impact",
        title: "Impact protection required",
        detail:
          "Impact glazing or approved shutters on every glazed opening, including doors with glass. Non-impact product cannot be quoted here.",
        status: "code",
      });
    } else if (windBorneDebris === "likely") {
      requirements.push({
        area: "wind",
        title: "Possible wind-borne debris region",
        detail: `${county} is a coastal county. WBDR applies within 1 mile of the coast where Vult ≥ 130 mph, or anywhere Vult ≥ 140 mph (FBC 1609.1.2) — verify the site's distance to coast and wind speed.`,
        status: "verify",
      });
      verify.push(
        `Verify whether the ${city ?? "project"} site falls in the wind-borne debris region (distance to coast + Vult).`,
      );
    } else {
      requirements.push({
        area: "wind",
        title: "Wind-borne debris region",
        detail: `${county ?? "This county"} is not coastal — WBDR unlikely, but confirm Vult ≥ 140 mph areas on the wind map.`,
        status: "verify",
      });
    }
  } else {
    verify.push(
      "Check the state wind map / local amendments for wind-borne debris or hurricane provisions.",
    );
  }

  // ---- Energy ----
  requirements.push({
    area: "energy",
    title: "Energy code",
    detail: code.energy,
    status: sc ? "code" : "verify",
  });
  verify.push("Confirm fenestration U-factor / SHGC limits for the project's climate zone.");

  // ---- Flood ----
  requirements.push({
    area: "flood",
    title: "Flood zone",
    detail:
      "Check the FEMA Flood Map (msc.fema.gov) for the site — flood zone drives opening protection and finished-floor elevation.",
    status: "verify",
  });
  verify.push("Look up the FEMA flood zone for the site address.");

  // ---- Safety (WOCD handled by the orchestrator's state-driven rule) ----
  requirements.push({
    area: "safety",
    title: "Window opening control devices",
    detail: state
      ? `Per ${code.code} §R312.2 (IRC model): WOCD required where the opening is < 24 in. above the floor and > 72 in. above exterior grade. The takeoff flags windows above floor 2 as a working proxy.`
      : "WOCD rule depends on the project state — geocode the site address first.",
    status: state ? "code" : "verify",
  });

  // ---- Product implications ----
  if (impactRequired) {
    const impactNote = hvhz
      ? "Impact glazing required — large-missile (TAS 201), NOA / FL approval mandatory."
      : "Impact glazing or approved shutters required in the WBDR.";
    productImplications.windows = [impactNote, "Quote YKK impact-rated series only."];
    productImplications.sliding_doors = [impactNote, "Quote YKK impact-rated sliding doors only."];
    productImplications.doors = ["Glazed doors need impact rating in the WBDR/HVHZ."];
    productImplications.storefront_curtainwall = [
      impactNote,
      "Curtain wall: large-missile impact per FBC 1626 (HVHZ).",
    ];
    productImplications.skylights = ["Skylights in the WBDR/HVHZ need impact-rated glazing."];
  } else if (windBorneDebris === "likely") {
    productImplications.windows = [
      "Confirm WBDR status — if inside, impact glazing or shutters required.",
    ];
    productImplications.sliding_doors = [
      "Confirm WBDR status — if inside, impact-rated sliding doors required.",
    ];
  }
  if (state === "FL") {
    productImplications.louvers = [
      "Louvers in the WBDR/HVHZ need FL product approval for wind-driven rain.",
    ];
  }

  return {
    state,
    county,
    city,
    buildingCode: code.code,
    buildingCodeEdition: code.edition,
    windStandard: code.windStandard,
    hvhz,
    windBorneDebris,
    impactRequired,
    energyCode: code.energy,
    requirements,
    productImplications,
    verify,
    source: county ? "county" : state ? "state" : "model",
  };
}

/** One-line jurisdiction summary for cards and headers. */
export function jurisdictionSummary(j: JurisdictionRequirements): string {
  const bits: string[] = [];
  if (j.state) bits.push(j.state);
  if (j.county) bits.push(j.county);
  bits.push(j.buildingCodeEdition);
  if (j.hvhz) bits.push("HVHZ — impact required");
  else if (j.impactRequired) bits.push("Impact required");
  else if (j.windBorneDebris === "likely") bits.push("WBDR likely — verify");
  return bits.join(" · ");
}
