export type TakeoffCategory = "window" | "door" | "glazing";

export type MarkerType = {
  key: string;
  label: string;
  category: TakeoffCategory;
  color: string;
  markPrefix: string;
};

export const MARKER_TYPES: MarkerType[] = [
  {
    key: "single_hung",
    label: "Single Hung",
    category: "window",
    color: "#1d4ed8",
    markPrefix: "W",
  },
  {
    key: "double_hung",
    label: "Double Hung",
    category: "window",
    color: "#0ea5e9",
    markPrefix: "W",
  },
  {
    key: "horizontal_slider",
    label: "Horizontal Slider",
    category: "window",
    color: "#0f766e",
    markPrefix: "W",
  },
  {
    key: "fixed_picture",
    label: "Fixed / Picture",
    category: "window",
    color: "#7c3aed",
    markPrefix: "W",
  },
  {
    key: "casement",
    label: "Casement",
    category: "window",
    color: "#c2410c",
    markPrefix: "W",
  },
  {
    key: "awning",
    label: "Awning",
    category: "window",
    color: "#a16207",
    markPrefix: "W",
  },
  {
    key: "transom",
    label: "Transom",
    category: "window",
    color: "#4d7c0f",
    markPrefix: "W",
  },
  {
    key: "geometric",
    label: "Geometric",
    category: "window",
    color: "#be185d",
    markPrefix: "W",
  },
  {
    key: "custom_window",
    label: "Custom Window",
    category: "window",
    color: "#475569",
    markPrefix: "W",
  },

  {
    key: "sliding_glass",
    label: "Sliding Glass Door",
    category: "door",
    color: "#b91c1c",
    markPrefix: "D",
  },
  {
    key: "french",
    label: "French Door",
    category: "door",
    color: "#dc2626",
    markPrefix: "D",
  },
  {
    key: "aluminum_entrance",
    label: "Aluminum Entrance",
    category: "door",
    color: "#9f1239",
    markPrefix: "D",
  },
  {
    key: "storefront_door",
    label: "Storefront Door",
    category: "door",
    color: "#7f1d1d",
    markPrefix: "D",
  },
  {
    key: "hollow_metal",
    label: "Hollow Metal",
    category: "door",
    color: "#78350f",
    markPrefix: "D",
  },
  {
    key: "wood_door",
    label: "Wood Door",
    category: "door",
    color: "#92400e",
    markPrefix: "D",
  },
  {
    key: "exterior_door",
    label: "Exterior Door",
    category: "door",
    color: "#ea580c",
    markPrefix: "D",
  },
  {
    key: "custom_door",
    label: "Custom Door",
    category: "door",
    color: "#57534e",
    markPrefix: "D",
  },

  {
    key: "storefront",
    label: "Storefront",
    category: "glazing",
    color: "#0891b2",
    markPrefix: "SF",
  },
  {
    key: "curtain_wall",
    label: "Curtain Wall",
    category: "glazing",
    color: "#0d9488",
    markPrefix: "CW",
  },
  {
    key: "fixed_glass",
    label: "Fixed Glass",
    category: "glazing",
    color: "#2563eb",
    markPrefix: "G",
  },
  {
    key: "glass_panel",
    label: "Glass Panel",
    category: "glazing",
    color: "#7dd3fc",
    markPrefix: "G",
  },
  {
    key: "window_wall",
    label: "Window Wall",
    category: "glazing",
    color: "#6366f1",
    markPrefix: "WW",
  },
  {
    key: "custom_glazing",
    label: "Custom Glazing",
    category: "glazing",
    color: "#64748b",
    markPrefix: "G",
  },
];

export const MARKER_TYPE_MAP = new Map(MARKER_TYPES.map((t) => [t.key, t]));

export function markerType(key: string | null | undefined): MarkerType | undefined {
  return key ? MARKER_TYPE_MAP.get(key) : undefined;
}

export function typeLabel(key: string | null | undefined) {
  return markerType(key)?.label ?? key ?? "Unclassified";
}

export const CATEGORY_LABEL: Record<TakeoffCategory, string> = {
  window: "Windows",
  door: "Doors",
  glazing: "Glass & Glazing",
};

export const WORKING_SET_CATEGORIES = [
  "Window Takeoff",
  "Door Takeoff",
  "Storefront",
  "Curtain Wall",
  "Floor Plans",
  "Elevations",
  "Window Schedule",
  "Door Schedule",
  "Glazing Schedule",
  "Details",
  "Addendum Review",
  "Custom",
] as const;
