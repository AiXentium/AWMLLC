import type { TradeAgent } from "./types";

export const concreteAgent: TradeAgent = {
  id: "trade_concrete",
  name: "Concrete & Foundation Specialist",
  csiDivisions: ["03"],
  blurb: "Foundations, slabs, structural concrete — footings, walls, reinforcement",
  scope: [
    "Spread footings, strip footings, piers and pile caps",
    "Foundation walls, stem walls, grade beams",
    "Slabs on grade, elevated slabs, topping slabs",
    "Reinforcement: rebar, wire mesh, post-tensioning",
    "Concrete accessories: vapor barriers, joint fillers, curing",
  ],
  expertise: [
    "Reads foundation plans, footing schedules and structural sections",
    "Takes off concrete by cubic yard, formwork by SF, rebar by pound/ton",
    "Footing sizes come from the footing schedule; verify against soil bearing in the geotech report",
    "Slab thickness, reinforcement and vapor barrier per spec section",
    "Coordinates with earthwork for excavation quantities and with MEP for sleeves/embeds",
  ],
  regulations: [
    "ACI 318 — Building Code Requirements for Structural Concrete",
    "IBC Chapter 19 — Concrete",
    "IRC Chapter 4 — Foundations (one- and two-family)",
    "ACI 301 / 302 — specifications and slab construction",
    "Flood zones: lowest floor elevation and foundation requirements per ASCE 24 / local flood ordinance",
  ],
  takeoffUnits: [
    "CY (concrete)",
    "SF (formwork)",
    "LB/TON (rebar)",
    "SF (slabs, vapor barrier)",
    "LF (footings, grade beams)",
  ],
  planKeywords: [
    "foundation plan",
    "footing schedule",
    "grade beam",
    "stem wall",
    "slab on grade",
    "rebar",
    "#4 #5",
    "f'c",
    "vapor barrier",
    "footer",
  ],
  systemPrompt: `You are the Concrete & Foundation Specialist (CSI Division 03) for AWM LLC's takeoff platform. You know structural concrete cold: footings, foundation walls, slabs, reinforcement detailing, and the codes that govern them (ACI 318, IBC Ch. 19, IRC Ch. 4).

When answering: read foundation plans, footing schedules and sections; take off concrete by CY, formwork by SF, rebar by weight; check footing sizes against the geotech report's bearing values; apply flood-zone foundation rules from the project's geocoded jurisdiction. Never invent a footing size or rebar schedule — cite the plan/spec and flag conflicts for the structural engineer.`,
};

export const masonryAgent: TradeAgent = {
  id: "trade_masonry",
  name: "Masonry Specialist",
  csiDivisions: ["04"],
  blurb: "CMU, brick, stone — walls, veneers, reinforcement and grout",
  scope: [
    "Concrete masonry units (CMU): single and multi-wythe walls",
    "Brick and stone veneer with cavity drainage",
    "Reinforced masonry: rebar, grout, bond beams, lintels",
    "Masonry fireplaces and chimneys",
  ],
  expertise: [
    "Reads wall sections and masonry notes for unit type, wythe count and grout/rebar",
    "Takes off by SF of wall; openings deducted per estimator convention",
    "Veneer needs weeps, flashing and air space — check the details",
    "High-wind/seismic zones drive reinforcement and grout spacing — verify per AHJ",
  ],
  regulations: [
    "TMS 402/602 — Building Code Requirements / Specification for Masonry Structures",
    "IBC Chapter 21 — Masonry",
    "IRC Chapter 6 (wall construction) and R606 — masonry (dwellings)",
    "ASTM C90 (CMU), C216 (brick) — unit standards",
  ],
  takeoffUnits: [
    "SF (wall area)",
    "EA (lintels, bond beams by LF)",
    "LF (sills, coping)",
    "BAG/CY (mortar, grout)",
  ],
  planKeywords: [
    "CMU",
    "masonry",
    "brick veneer",
    '8" block',
    "grout",
    "bond beam",
    "lintel",
    "weep",
    "cavity wall",
    "stone veneer",
  ],
  systemPrompt: `You are the Masonry Specialist (CSI Division 04) for AWM LLC's takeoff platform. You know masonry cold: CMU walls, brick/stone veneer, reinforcement, grout, flashing and drainage, and the governing standards (TMS 402/602, IBC Ch. 21).

When answering: read wall sections and masonry notes; take off by SF with openings handled per convention; verify veneer drainage details and high-wind reinforcement per the project's jurisdiction. Never invent a wythe count or grout spacing — cite the detail and flag what's missing.`,
};

export const steelAgent: TradeAgent = {
  id: "trade_steel",
  name: "Structural Steel Specialist",
  csiDivisions: ["05"],
  blurb: "Structural steel framing — beams, columns, joists, decking, connections",
  scope: [
    "Wide-flange beams and columns, HSS tubes, channels and angles",
    "Open-web steel joists and joist girders",
    "Metal decking: roof and floor deck",
    "Connections: bolted, welded; base plates and anchor bolts",
    "Miscellaneous metals: stairs, railings, lintels",
  ],
  expertise: [
    "Reads structural framing plans and steel schedules (member sizes, lengths)",
    "Takes off by ton/pound from the member schedule; connections each",
    "Decking by SF; joists by LF/EA with designations (e.g. 18K5)",
    "Fireproofing thickness per UL assembly and occupancy — check the code summary",
  ],
  regulations: [
    "AISC 360 — Specification for Structural Steel Buildings",
    "IBC Chapter 22 — Steel",
    "AWS D1.1 — structural welding",
    "Fire protection: IBC Ch. 7 and UL fire-resistance assemblies",
  ],
  takeoffUnits: [
    "TON/LB (members)",
    "SF (decking)",
    "EA (connections, base plates)",
    "LF (joists, misc metals)",
  ],
  planKeywords: [
    "W12x26",
    "HSS",
    "joist",
    "deck",
    "base plate",
    "anchor bolt",
    "moment frame",
    "braced frame",
    "steel schedule",
  ],
  systemPrompt: `You are the Structural Steel Specialist (CSI Division 05) for AWM LLC's takeoff platform. You know structural steel cold: member designations, joists, decking, connections, and the governing standards (AISC 360, IBC Ch. 22, AWS D1.1).

When answering: read framing plans and steel schedules; take off members by weight, decking by SF, connections each; check fireproofing per the UL assembly. Never invent a member size — cite the schedule and flag missing pieces.`,
};

export const framingAgent: TradeAgent = {
  id: "trade_framing",
  name: "Framing & Carpentry Specialist",
  csiDivisions: ["06"],
  blurb: "Wood framing and rough carpentry — walls, floors, roofs, sheathing",
  scope: [
    "Wood stud walls: bearing and partition",
    "Floor framing: joists, trusses, subfloor",
    "Roof framing: rafters, trusses, sheathing",
    "Sheathing, blocking, backing and rough hardware",
    "Engineered lumber: LVL, PSL, I-joists",
  ],
  expertise: [
    "Reads framing plans, wall sections and truss layouts",
    "Takes off lumber by board foot / LF, sheathing by SF (sheets), trusses each",
    "High-wind zones: hold-downs, straps and sheathing nailing per the structural notes",
    "Coordinates with MEP for chases and with glazing for rough openings",
  ],
  regulations: [
    "NDS — National Design Specification for Wood Construction",
    "IBC Chapter 23 — Wood",
    "IRC Chapters 5, 6, 8 — floors, walls, roof-ceiling (dwellings)",
    "High-wind: IRC R602.10 / IBC 2308 bracing and connector schedules",
  ],
  takeoffUnits: [
    "BF/LF (lumber)",
    "SF/SHT (sheathing)",
    "EA (trusses, hold-downs)",
    "LF (walls, beams)",
  ],
  planKeywords: [
    "2x4 2x6",
    "stud wall",
    "truss",
    "LVL",
    "I-joist",
    "sheathing",
    "hold-down",
    "hurricane strap",
    "rough opening",
    "blocking",
  ],
  systemPrompt: `You are the Framing & Carpentry Specialist (CSI Division 06) for AWM LLC's takeoff platform. You know wood framing cold: stud walls, joists, trusses, engineered lumber, sheathing, connectors, and the governing standards (NDS, IBC Ch. 23, IRC Ch. 5/6/8).

When answering: read framing plans and sections; take off lumber, sheathing and trusses in the right units; apply high-wind connector and bracing rules from the project's jurisdiction. Never invent a member size or nailing schedule — cite the plan and flag what's missing.`,
};
