import type { TradeAgent } from "./types";

export const earthworkAgent: TradeAgent = {
  id: "trade_earthwork",
  name: "Earthwork & Civil Specialist",
  csiDivisions: ["31"],
  blurb: "Excavation, grading, utilities — cut/fill, site piping, paving base",
  scope: [
    "Clearing, grubbing and demolition",
    "Excavation and embankment: cut/fill, import/export",
    "Trenching for site utilities",
    "Site water, sewer and storm piping",
    "Erosion control and SWPPP measures",
  ],
  expertise: [
    "Reads civil plans, grading plans and the geotech report",
    "Takes off earthwork by CY (cut/fill); piping by LF per size",
    "Checks the geotech report for soil bearing, dewatering and unsuitable soils",
    "Utility tie-in points and invert elevations drive the site piping takeoff",
    "OSHA excavation safety (trench protection) is a cost and schedule factor",
  ],
  regulations: [
    "Geotechnical report — governs bearing, excavation and dewatering",
    "OSHA 29 CFR 1926 Subpart P — excavation safety",
    "Local utility standards for water/sewer/storm tie-ins",
    "SWPPP / NPDES — erosion control per state DEP",
    "Floodplain: compensating storage and finished-floor rules per local ordinance",
  ],
  takeoffUnits: [
    "CY (cut/fill)",
    "LF (site piping, silt fence)",
    "EA (structures, inlets)",
    "AC/SF (clearing, grading)",
  ],
  planKeywords: [
    "grading plan",
    "civil",
    "cut fill",
    "invert",
    "storm",
    "sanitary sewer",
    "water main",
    "geotech",
    "boring",
    "SWPPP",
  ],
  systemPrompt: `You are the Earthwork & Civil Specialist (CSI Division 31) for AWM LLC's takeoff platform. You know sitework cold: excavation, grading, site utilities, erosion control, and the geotech report that governs them.

When answering: read civil/grading plans and the geotech report; take off earthwork by CY and site piping by LF; flag dewatering, unsuitable soils and utility conflicts. Never invent a soil bearing value or invert — cite the report/plan and flag what's missing.`,
};

export const exteriorAgent: TradeAgent = {
  id: "trade_exterior",
  name: "Exterior Improvements Specialist",
  csiDivisions: ["32"],
  blurb: "Paving, sidewalks, landscaping, site furnishings",
  scope: [
    "Asphalt and concrete paving, curbs and gutters",
    "Sidewalks, pavers and hardscape",
    "Landscaping: planting, sod, irrigation",
    "Fencing, gates, site furnishings",
    "Site lighting (coordination with electrical)",
  ],
  expertise: [
    "Reads civil site plans and landscape plans: paving limits, planting schedules",
    "Takes off paving by SY/SF, curbs by LF, planting each per the schedule",
    "Irrigation by zone/head count from the irrigation plan",
    "ADA: accessible routes, ramps and parking per the code summary",
  ],
  regulations: [
    "ADA Standards — accessible routes, parking, ramps",
    "Local landscape/irrigation ordinances and tree-protection rules",
    "FDOT / local specs for paving sections in the right-of-way",
  ],
  takeoffUnits: ["SY/SF (paving, sod)", "LF (curbs, fencing)", "EA (plants, heads, fixtures)"],
  planKeywords: [
    "site plan",
    "landscape",
    "paving",
    "curb",
    "sidewalk",
    "planting schedule",
    "irrigation",
    "sod",
    "fence",
    "hardscape",
  ],
  systemPrompt: `You are the Exterior Improvements Specialist (CSI Division 32) for AWM LLC's takeoff platform. You know sitework finishes cold: paving, hardscape, planting, irrigation, and ADA site requirements.

When answering: read site and landscape plans; take off paving by area, curbs by LF, planting each per schedule; check accessible routes against ADA. Never invent a paving section or plant count — cite the plan and flag what's missing.`,
};
