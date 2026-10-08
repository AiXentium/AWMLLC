import styleviewImg from "@/assets/family-styleview.jpg";
import styleguardImg from "@/assets/family-styleguard.jpg";
import precedenceImg from "@/assets/family-precedence.jpg";
import { SERIES_CARD_IMAGES } from "@/assets/ykk-catalog-images";

/**
 * AWM LLC product catalog — built from the real YKK AP residential catalog
 * as configured in AWM's ViewBuilder dealer account (observed 2026-10-04).
 *
 * Series, window/door types, and Florida approval IDs below are the confirmed
 * live catalog — do not invent additional series or types.
 * Descriptive only — performance values are configuration-specific and
 * always subject to manufacturer confirmation.
 */

export type FamilyId = "styleview" | "styleguard" | "precedence";
export type ApplicationId = "new-construction" | "coastal-impact" | "replacement";
export type ProductTypeId =
  | "single-hung"
  | "single-hung-arch-top"
  | "double-hung"
  | "fixed-window"
  | "picture-transom"
  | "casement"
  | "casement-picture"
  | "awning"
  | "slider"
  | "single-slider"
  | "geometric"
  | "sliding-patio-door"
  | "sliding-patio-door-hd"
  | "sliding-patio-door-sg-hd";

export interface ProductType {
  id: ProductTypeId;
  name: string;
  category: "window" | "patio-door";
  description: string;
  detail: string;
  considerations: string[];
}

export interface FamilyVariant {
  name: string;
  detail: string;
  types: string[];
}

export interface FamilyOption {
  label: string;
  value: string;
}

export interface FlApproval {
  label: string;
  id: string;
}

export interface ProductFamily {
  id: FamilyId;
  name: string;
  registeredName: string;
  route: "/products/styleview" | "/products/styleguard" | "/products/precedence";
  tagline: string;
  summary: string;
  longDescription: string;
  image: string;
  application: ApplicationId;
  applicationLabel: string;
  bestFor: string[];
  benefits: string[];
  frameOptions: { name: string; description: string }[];
  types: ProductTypeId[];
  /** Sub-series within the family (e.g. Classic / standard / Flange). */
  variants: FamilyVariant[];
  /** Key configuration options shown on the family page. */
  options: FamilyOption[];
  /** Observed Florida Product Approval IDs — verify at floridabuilding.org. */
  flApprovals: FlApproval[];
  /** Maximum standard sizes per window/door type, from YKK AP published specs. */
  sizeGuide: { type: string; maxSize: string; note?: string }[];
}

export interface CatalogSeries {
  id: string;
  name: string;
  registeredName: string;
  category: "window" | "door";
  application: string;
  applicationDetail: string;
  summary: string;
  types: string[];
  options: FamilyOption[];
  flApproval?: FlApproval;
  image: string;
  route?: "/products/styleview" | "/products/styleguard" | "/products/precedence";
  anchorId: string;
}

export const APPLICATIONS: { id: ApplicationId; label: string; blurb: string }[] = [
  {
    id: "new-construction",
    label: "New construction",
    blurb: "Production and custom homes where units are installed before finishes.",
  },
  {
    id: "coastal-impact",
    label: "Coastal / impact",
    blurb: "Wind-borne debris and high-velocity hurricane zone considerations.",
  },
  {
    id: "replacement",
    label: "Replacement / remodel",
    blurb: "Retrofit into existing openings with minimal disruption.",
  },
];

export const PRODUCT_TYPES: ProductType[] = [
  {
    id: "single-hung",
    name: "Single-hung window",
    category: "window",
    description: "Fixed upper sash with an operable lower sash.",
    detail:
      "A widely specified operable window across Florida residential work. The lower sash raises for ventilation while the upper sash remains fixed, keeping the profile clean and the hardware minimal.",
    considerations: [
      "Common in production and multifamily plans",
      "Arch-top variant available in StyleView Classic and StyleView",
      "Screen and grid options vary by series",
    ],
  },
  {
    id: "single-hung-arch-top",
    name: "Single-hung arch top",
    category: "window",
    description: "Single-hung with an arched head — Classic and StyleView.",
    detail:
      "An arched-head single-hung for entries, gables, and accent elevations. Available in StyleView Classic and StyleView.",
    considerations: ["Accent and entry elevations", "Radius options vary by series"],
  },
  {
    id: "double-hung",
    name: "Double-hung window",
    category: "window",
    description: "Two operable sashes for flexible ventilation.",
    detail:
      "Both sashes operate, allowing airflow from the top, bottom, or both. The core operable type for StyleGuard impact and Precedence replacement lines.",
    considerations: [
      "StyleGuard double-hung observed with FL approval 7533.2",
      "Precedence double-hung observed with FL approval 7533.1",
    ],
  },
  {
    id: "fixed-window",
    name: "Fixed / picture window",
    category: "window",
    description: "Non-operable glass for maximum daylight.",
    detail:
      "Fixed units maximize glass area and sightlines. Frequently combined with operable units or transoms to create larger composite openings.",
    considerations: [
      "Picture window + transom combinations available",
      "No ventilation — pair with operable units",
    ],
  },
  {
    id: "picture-transom",
    name: "Picture window + transom",
    category: "window",
    description: "Fixed picture unit with transom above.",
    detail:
      "A fixed picture window combined with a transom to lift daylight and elevation height. Mulled as a single assembly.",
    considerations: [
      "Mulled assemblies require confirmation",
      "Head height coordination with framing",
    ],
  },
  {
    id: "casement",
    name: "Casement window",
    category: "window",
    description: "Side-hinged sash that cranks outward.",
    detail:
      "Hinged at the side and operated with a crank, casements open fully to capture breezes and offer an unobstructed view when closed.",
    considerations: [
      "Casement picture window variant available",
      "Confirm swing clearance at walkways and patios",
    ],
  },
  {
    id: "casement-picture",
    name: "Casement picture window",
    category: "window",
    description: "Fixed casement-style picture unit.",
    detail:
      "A non-operable unit in the casement sightline, used alongside operating casements for a consistent elevation.",
    considerations: ["Matches operating casement sightlines"],
  },
  {
    id: "awning",
    name: "Awning window",
    category: "window",
    description: "Top-hinged sash that projects outward at the bottom.",
    detail:
      "Awning units hinge at the top so the opening is shielded from above. Often paired above or below fixed glass in Florida elevations.",
    considerations: ["Pairs well with picture and transom units", "Confirm projection clearance"],
  },
  {
    id: "slider",
    name: "Horizontal slider",
    category: "window",
    description: "Sash glides horizontally within the frame.",
    detail:
      "Sliders suit wide openings and low head heights, and are common in Florida single-story and multifamily plans. Not offered in StyleView Flange or StyleGuard.",
    considerations: ["Good fit for wide, short openings", "Confirm screen configuration"],
  },
  {
    id: "single-slider",
    name: "Single slider",
    category: "window",
    description: "One gliding sash beside a fixed panel.",
    detail:
      "A single operating sash that glides beside a fixed lite — a clean option for bedrooms and living areas.",
    considerations: ["Fixed + operable combination in one frame"],
  },
  {
    id: "geometric",
    name: "Geometric window",
    category: "window",
    description: "Shaped fixed units — 20 shapes available.",
    detail:
      "Shaped units accent gables, entries, and stair walls. Twenty geometric shapes are offered across the window series, subject to series and size confirmation.",
    considerations: [
      "20 shapes available — confirm per series",
      "Longer lead times are common",
      "Requires precise field dimensions",
    ],
  },
  {
    id: "sliding-patio-door",
    name: "Sliding patio door (2-panel)",
    category: "patio-door",
    description: "Two-panel gliding door to lanai or patio.",
    detail:
      "The StyleView sliding patio door in a 2-panel configuration, connecting interior living space to the lanai, pool deck, or courtyard. Offered in 5'0\", 6'0\", and 8'0\" widths × 6'8\" height.",
    considerations: [
      "2-panel configuration",
      "Widths 5′0″ / 6′0″ / 8′0″ × 6′8″ height",
      "Confirm rough opening and structural support early",
    ],
  },
  {
    id: "sliding-patio-door-hd",
    name: "Sliding patio door HD (2/3/4-panel)",
    category: "patio-door",
    description: "Heavy-duty slider in 2, 3, or 4 panels.",
    detail:
      "StyleView HD sliding patio doors scale to wide openings with 2, 3, or 4-panel configurations for panoramic indoor-outdoor living.",
    considerations: [
      "2, 3, and 4-panel configurations",
      "Threshold and drainage detailing is project specific",
    ],
  },
  {
    id: "sliding-patio-door-sg-hd",
    name: "StyleGuard HD sliding door (2/3/4-panel)",
    category: "patio-door",
    description: "Hurricane-resistant slider in 2, 3, or 4 panels.",
    detail:
      "StyleGuard HD brings impact-resistant glazing to large sliding door openings, in 2, 3, or 4-panel configurations for coastal projects.",
    considerations: [
      "Impact-resistant for wind-borne debris regions",
      "2, 3, and 4-panel configurations",
    ],
  },
];

const WINDOW_OPTIONS: FamilyOption[] = [
  { label: "Sizes", value: "Call sizes — confirm per configuration and opening." },
  {
    label: "Design pressure",
    value: "DP ratings vary by size and configuration — confirmed with the manufacturer.",
  },
  { label: "Glass", value: "LowE glass packages; impact glass on StyleGuard series." },
  { label: "Grilles", value: "Grille patterns and profiles vary by series." },
  { label: "Colors", value: "Exterior and interior color options vary by series." },
  { label: "Hardware", value: "Hardware styles and finishes vary by window type." },
];

const DOOR_OPTIONS: FamilyOption[] = [
  {
    label: "Sizes",
    value: "StyleView patio door: 5'0\", 6'0\", 8'0\" × 6'8\". HD configurations per opening.",
  },
  {
    label: "Design pressure",
    value: "DP ratings vary by size and configuration — confirmed with the manufacturer.",
  },
  { label: "Glass", value: "LowE glass packages; impact glass on StyleGuard HD." },
  { label: "Grilles", value: "Grille options vary by series." },
  { label: "Colors", value: "Exterior and interior color options vary by series." },
  { label: "Hardware", value: "Roller and lock hardware per series; confirm security options." },
];

export const SERIES: CatalogSeries[] = [
  {
    id: "styleview-classic",
    name: "StyleView Classic",
    registeredName: "StyleView® Classic",
    category: "window",
    application: "New construction",
    applicationDetail: "Classic wood appearance — the flagship with the fullest option tree.",
    summary:
      "YKK AP's flagship new-construction vinyl window with a classic wood appearance and the deepest bench of types, variants, and options.",
    types: [
      "Single Hung",
      "Double Hung",
      "Fixed Window",
      "Casement",
      "Awning",
      "Slider",
      "Geometrics",
    ],
    options: WINDOW_OPTIONS,
    flApproval: { label: "StyleView Classic Single Hung", id: "8114.7" },
    image: SERIES_CARD_IMAGES["styleview-classic"],
    route: "/products/styleview",
    anchorId: "styleview-classic",
  },
  {
    id: "styleview",
    name: "StyleView",
    registeredName: "StyleView®",
    category: "window",
    application: "New construction",
    applicationDetail: "Traditional brickmold with J-Channel for siding applications.",
    summary:
      "New-construction vinyl with a traditional brickmold and integral J-Channel that receives siding — the same 7 window types as Classic.",
    types: [
      "Single Hung",
      "Double Hung",
      "Fixed Window",
      "Casement",
      "Awning",
      "Slider",
      "Geometrics",
    ],
    options: WINDOW_OPTIONS,
    image: SERIES_CARD_IMAGES["styleview"],
    route: "/products/styleview",
    anchorId: "styleview",
  },
  {
    id: "styleview-flange",
    name: "StyleView Flange",
    registeredName: "StyleView® Flange",
    category: "window",
    application: "New construction",
    applicationDetail: "Flange application engineered for block construction.",
    summary:
      "The StyleView new-construction window in a flange application for concrete block walls. Six window types — slider not offered in this application.",
    types: ["Single Hung", "Double Hung", "Fixed Window", "Casement", "Awning", "Geometrics"],
    options: WINDOW_OPTIONS,
    image: SERIES_CARD_IMAGES["styleview-flange"],
    route: "/products/styleview",
    anchorId: "styleview-flange",
  },
  {
    id: "precedence",
    name: "Precedence",
    registeredName: "Precedence®",
    category: "window",
    application: "Replacement / remodel",
    applicationDetail: "Box Frame application — no nail fin; fits existing openings.",
    summary:
      "YKK AP's vinyl replacement window. The Box Frame application sets into the existing opening after the old sash is removed — no nail fin, minimal disruption.",
    types: [
      "Single Hung",
      "Double Hung",
      "Fixed Window",
      "Casement",
      "Awning",
      "Slider",
      "Geometrics",
    ],
    options: WINDOW_OPTIONS,
    flApproval: { label: "Precedence Double Hung", id: "7533.1" },
    image: SERIES_CARD_IMAGES["precedence"],
    route: "/products/precedence",
    anchorId: "precedence",
  },
  {
    id: "styleguard",
    name: "StyleGuard",
    registeredName: "StyleGuard®",
    category: "window",
    application: "Coastal / impact",
    applicationDetail:
      "Hurricane-resistant vinyl for large apertures — impact glass, double weather stripping.",
    summary:
      "YKK AP's impact-resistant vinyl window for wind-borne debris regions. Built for large apertures with impact glass and double weather stripping. Five window types — single hung and slider not offered.",
    types: ["Double Hung", "Fixed Window", "Casement", "Awning", "Geometrics"],
    options: WINDOW_OPTIONS,
    flApproval: { label: "StyleGuard Double Hung", id: "7533.2" },
    image: SERIES_CARD_IMAGES["styleguard"],
    route: "/products/styleguard",
    anchorId: "styleguard",
  },
  {
    id: "styleguard-flange",
    name: "StyleGuard Flange",
    registeredName: "StyleGuard® Flange",
    category: "window",
    application: "Coastal / impact",
    applicationDetail: "Hurricane-resistant flange application for block construction.",
    summary:
      "The StyleGuard impact window in a flange application for concrete block walls. Double Hung and Fixed confirmed.",
    types: ["Double Hung", "Fixed Window"],
    options: WINDOW_OPTIONS,
    image: SERIES_CARD_IMAGES["styleguard-flange"],
    route: "/products/styleguard",
    anchorId: "styleguard-flange",
  },
  {
    id: "styleview-patio-door",
    name: "StyleView Sliding Patio Door",
    registeredName: "StyleView® Sliding Patio Door",
    category: "door",
    application: "New construction",
    applicationDetail: "2-panel sliding patio door.",
    summary:
      "The StyleView sliding patio door in a 2-panel configuration — 5'0\", 6'0\", and 8'0\" widths × 6'8\" height for lanai, pool deck, and courtyard openings.",
    types: ["2-Panel Sliding Door"],
    options: DOOR_OPTIONS,
    image: SERIES_CARD_IMAGES["styleview-patio-door"],
    anchorId: "styleview-patio-door",
  },
  {
    id: "styleview-hd",
    name: "StyleView HD",
    registeredName: "StyleView® HD",
    category: "door",
    application: "New construction",
    applicationDetail: "Heavy-duty sliding doors in 2, 3, or 4 panels.",
    summary:
      "StyleView HD scales sliding patio doors to wide openings with 2, 3, or 4-panel configurations for panoramic indoor-outdoor living.",
    types: ["2-Panel", "3-Panel", "4-Panel Sliding Doors"],
    options: DOOR_OPTIONS,
    image: SERIES_CARD_IMAGES["styleview-hd"],
    anchorId: "styleview-hd",
  },
  {
    id: "styleguard-hd",
    name: "StyleGuard HD",
    registeredName: "StyleGuard® HD",
    category: "door",
    application: "Coastal / impact",
    applicationDetail: "Hurricane-resistant sliding doors in 2, 3, or 4 panels.",
    summary:
      "StyleGuard HD brings impact-resistant glazing to large sliding door openings — 2, 3, or 4-panel configurations for coastal projects.",
    types: ["2-Panel", "3-Panel", "4-Panel Impact Sliding Doors"],
    options: DOOR_OPTIONS,
    image: SERIES_CARD_IMAGES["styleguard-hd"],
    anchorId: "styleguard-hd",
  },
];

export const FAMILIES: ProductFamily[] = [
  {
    id: "styleview",
    name: "StyleView",
    registeredName: "StyleView®",
    route: "/products/styleview",
    tagline: "Premium vinyl windows and patio doors for new construction",
    summary:
      "YKK AP's premium new-construction vinyl line — Classic, standard, and Flange applications covering the full range of framed and block-wall openings, plus sliding patio doors.",
    longDescription:
      "StyleView® is YKK AP's premium vinyl residential line for new-construction openings. StyleView Classic leads with a classic wood appearance and the fullest option tree; the standard StyleView carries a traditional brickmold with J-Channel for siding; and StyleView Flange serves block construction. AWM LLC helps builders and homeowners assemble the right mix across each elevation, then coordinates quantities and delivery against the construction schedule.",
    image: styleviewImg,
    application: "new-construction",
    applicationLabel: "New construction",
    bestFor: [
      "Single-family production and custom homes",
      "Townhome and multifamily new builds",
      "Block-wall construction (Flange application)",
    ],
    benefits: [
      "Broadest selection of operable and fixed window types",
      "Vinyl frames suited to Florida's humidity and salt exposure",
      "Configurations that support mulled and composite openings",
      "Classic, brickmold/J-channel, and flange applications",
    ],
    frameOptions: [
      {
        name: "Classic / flat frame",
        description:
          "A flat frame profile typically used where the exterior finish covers the frame edge, such as stucco applications.",
      },
      {
        name: "J-channel",
        description:
          "An integral channel that receives siding, commonly used with lap or panel siding assemblies.",
      },
      {
        name: "Nailing flange",
        description:
          "An integral flange for fastening to sheathing in new-construction framing, coordinated with the water-resistive barrier.",
      },
      {
        name: "Flange (block construction)",
        description:
          "Flange application engineered for concrete block walls — slider not offered in this application.",
      },
    ],
    types: [
      "single-hung",
      "single-hung-arch-top",
      "double-hung",
      "fixed-window",
      "picture-transom",
      "casement",
      "casement-picture",
      "awning",
      "slider",
      "single-slider",
      "geometric",
      "sliding-patio-door",
      "sliding-patio-door-hd",
    ],
    variants: [
      {
        name: "StyleView Classic",
        detail: "Classic wood appearance. Flagship — the fullest option tree.",
        types: [
          "Single Hung",
          "Double Hung",
          "Fixed Window",
          "Casement",
          "Awning",
          "Slider",
          "Geometrics",
        ],
      },
      {
        name: "StyleView",
        detail: "Traditional brickmold with J-Channel.",
        types: [
          "Single Hung",
          "Double Hung",
          "Fixed Window",
          "Casement",
          "Awning",
          "Slider",
          "Geometrics",
        ],
      },
      {
        name: "StyleView Flange",
        detail: "Flange application for block construction. Slider not offered.",
        types: ["Single Hung", "Double Hung", "Fixed Window", "Casement", "Awning", "Geometrics"],
      },
    ],
    options: WINDOW_OPTIONS,
    flApprovals: [{ label: "StyleView Classic Single Hung", id: "8114.7" }],
    sizeGuide: [
      {
        type: "Single-Hung / Double-Hung",
        maxSize: "53⅛″ × 72¼″",
        note: "Tip-to-tip; twin units to 44½″ × 80½″",
      },
      { type: "Casement", maxSize: "39½″ × 79½″" },
      { type: "Casement Picture", maxSize: "59½″ × 79½″" },
      { type: "Awning (Flange)", maxSize: "59½″ × 35½″" },
      { type: "Horizontal Slider (XX)", maxSize: "96½″ × 60½″" },
      { type: "Picture / Transom", maxSize: "72½″ × 96½″" },
      {
        type: "Sliding Patio Door",
        maxSize: "Up to 16′ wide",
        note: "2, 3, and 4-panel configurations",
      },
    ],
  },
  {
    id: "styleguard",
    name: "StyleGuard",
    registeredName: "StyleGuard®",
    route: "/products/styleguard",
    tagline: "Impact-resistant windows and patio doors for coastal work",
    summary:
      "YKK AP's hurricane-resistant vinyl line for wind-borne debris regions — large apertures, impact glass, and double weather stripping, plus impact sliding doors.",
    longDescription:
      "StyleGuard® is YKK AP's impact-resistant residential line, developed for coastal and high-wind applications — including large apertures with impact glass and double weather stripping. The Flange application serves block construction. Impact ratings, design pressures, glazing makeups, and approval documentation are configuration and jurisdiction specific — AWM LLC works from your plans and the applicable code path, then confirms every line item with the manufacturer before it is quoted.",
    image: styleguardImg,
    application: "coastal-impact",
    applicationLabel: "Coastal / impact",
    bestFor: [
      "Coastal and waterfront residences",
      "Wind-borne debris regions and HVHZ jurisdictions",
      "Block-wall coastal construction (Flange application)",
    ],
    benefits: [
      "Impact-resistant configurations for coastal openings",
      "Large-aperture capability with impact glass",
      "Double weather stripping for driving rain",
      "Product approval documentation supplied per confirmed configuration",
    ],
    frameOptions: [
      {
        name: "Classic / flat frame",
        description:
          "Flat frame profile for stucco and finish-over-frame conditions, subject to configuration availability.",
      },
      {
        name: "J-channel",
        description: "Siding-receiving channel option where the wall assembly calls for it.",
      },
      {
        name: "Nailing flange",
        description:
          "Flange attachment for new-construction framing, detailed with the specified installation instructions.",
      },
      {
        name: "Flange (block construction)",
        description:
          "Hurricane-resistant flange application for concrete block walls — Double Hung and Fixed confirmed.",
      },
    ],
    types: [
      "double-hung",
      "fixed-window",
      "picture-transom",
      "casement",
      "casement-picture",
      "awning",
      "geometric",
      "sliding-patio-door-sg-hd",
    ],
    variants: [
      {
        name: "StyleGuard",
        detail: "Hurricane-resistant vinyl. Single hung and slider not offered.",
        types: ["Double Hung", "Fixed Window", "Casement", "Awning", "Geometrics"],
      },
      {
        name: "StyleGuard Flange",
        detail: "Hurricane-resistant flange application for block construction.",
        types: ["Double Hung", "Fixed Window"],
      },
      {
        name: "StyleGuard HD",
        detail: "Hurricane-resistant sliding patio doors.",
        types: ["2-Panel", "3-Panel", "4-Panel Impact Sliding Doors"],
      },
    ],
    options: WINDOW_OPTIONS,
    flApprovals: [{ label: "StyleGuard Double Hung", id: "7533.2" }],
    sizeGuide: [
      { type: "Double-Hung", maxSize: "43½″ × 75½″", note: "Impact-rated" },
      { type: "Casement", maxSize: "40½″ × 80½″", note: "Impact-rated" },
      { type: "Awning", maxSize: "60″ max dimension", note: "Impact-rated" },
      { type: "Picture Window", maxSize: "60″ max dimension", note: "Impact-rated" },
      { type: "Transom", maxSize: "43½″ × 27½″", note: "Impact-rated" },
      { type: "Geometric", maxSize: "60″ max dimension", note: "Impact-rated" },
      {
        type: "StyleGuard HD Sliding Door",
        maxSize: "Up to 16′ wide",
        note: "Hurricane-resistant",
      },
    ],
  },
  {
    id: "precedence",
    name: "Precedence",
    registeredName: "Precedence®",
    route: "/products/precedence",
    tagline: "Replacement windows for remodel and retrofit",
    summary:
      "YKK AP's vinyl replacement window — Box Frame application with no nail fin, made to fit existing openings with minimal disruption.",
    longDescription:
      "Precedence® is YKK AP's replacement residential window line, intended for remodel work where units are fitted into existing openings. The Box Frame application carries no nail fin — the unit sets into the existing opening after the old sash is removed. AWM LLC supports field measurement coordination, unit selection, and delivery so replacement crews can keep occupied homes moving on schedule.",
    image: precedenceImg,
    application: "replacement",
    applicationLabel: "Replacement / remodel",
    bestFor: [
      "Whole-home window replacement",
      "Condominium and HOA-coordinated retrofits",
      "Phased remodels in occupied homes",
    ],
    benefits: [
      "Box Frame application — no nail fin, fits existing openings",
      "Reduced disturbance to interior and exterior finishes",
      "Familiar operable types for traditional elevations",
      "Selections coordinated with field-measured dimensions",
    ],
    frameOptions: [
      {
        name: "Box frame (replacement)",
        description:
          "A box-frame retrofit profile set into the existing opening after the old sash is removed — no nail fin.",
      },
      {
        name: "Existing-condition detailing",
        description:
          "Trim, sealant, and flashing details depend on the existing wall assembly and are confirmed on site.",
      },
    ],
    types: [
      "single-hung",
      "single-hung-arch-top",
      "double-hung",
      "fixed-window",
      "picture-transom",
      "casement",
      "casement-picture",
      "awning",
      "slider",
      "single-slider",
      "geometric",
    ],
    variants: [
      {
        name: "Precedence",
        detail: "Vinyl replacement — Box Frame application, no nail fin.",
        types: [
          "Single Hung",
          "Double Hung",
          "Fixed Window",
          "Casement",
          "Awning",
          "Slider",
          "Geometrics",
        ],
      },
    ],
    options: WINDOW_OPTIONS,
    flApprovals: [{ label: "Precedence Double Hung", id: "7533.1" }],
    sizeGuide: [
      { type: "Single-Hung / Double-Hung", maxSize: "47½″ × 79½″", note: "Box-frame replacement" },
    ],
  },
];

export interface CatalogItem {
  id: string;
  family: ProductFamily;
  type: ProductType;
}

export const CATALOG: CatalogItem[] = FAMILIES.flatMap((family) =>
  family.types.map((typeId) => {
    const type = PRODUCT_TYPES.find((t) => t.id === typeId)!;
    return { id: `${family.id}-${typeId}`, family, type };
  }),
);

export function getFamily(id: FamilyId) {
  return FAMILIES.find((f) => f.id === id)!;
}

export function getSeries(id: string) {
  return SERIES.find((s) => s.id === id);
}

export const TYPE_VARIANTS_NOTE =
  "Type variants include Single Hung Arch Top (StyleView Classic & StyleView), Picture Window + Transom, Casement Picture Window, Single Slider, and 20 geometric shapes — availability varies by series.";

export const FL_APPROVAL_NOTE =
  "Florida Product Approval IDs shown were observed in AWM's YKK AP ViewBuilder catalog. Verify current approvals at floridabuilding.org — approvals are configuration-specific.";

export const AVAILABILITY_NOTE =
  "Availability, performance values, colors, glazing packages, impact ratings, sizes, and installation requirements vary by configuration, elevation, and jurisdiction. All selections are subject to manufacturer confirmation.";

export const QUOTE_DISCLAIMER =
  "Configurations are confirmed with the manufacturer before any written pricing is released.";

export const LEGAL_NOTE =
  "YKK AP®, StyleView®, StyleGuard®, and Precedence® are trademarks of their respective owner. AWM LLC is an independent supplier/distributor. Product availability and specifications are subject to manufacturer confirmation.";
