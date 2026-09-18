import type { Category } from "./types";

/**
 * Category identity colors. Color follows the entity, never its rank:
 * Dining is always the same hue regardless of where it lands in a chart.
 * Palette uses the validated 8-slot categorical order; the remaining
 * categories share neutral tones since they rarely lead a chart.
 */
export const CATEGORY_COLORS: Record<Category, string> = {
  Housing: "#2a78d6",
  Groceries: "#1baf7a",
  Dining: "#eb6834",
  Delivery: "#e34948",
  Transportation: "#4a3aa7",
  Shopping: "#eda100",
  Travel: "#e87ba4",
  Entertainment: "#008300",
  Health: "#0e9aa7",
  Subscriptions: "#6b5bd2",
  Utilities: "var(--chart-axis)",
  Income: "#087443",
  Transfer: "var(--ink-faint)",
  Other: "var(--chart-muted-bar)",
};

export const CATEGORY_ICONS: Record<Category, string> = {
  Housing: "🏠",
  Groceries: "🛒",
  Dining: "🍽️",
  Delivery: "🛵",
  Transportation: "🚗",
  Shopping: "🛍️",
  Travel: "✈️",
  Entertainment: "🎟️",
  Health: "💊",
  Subscriptions: "🔁",
  Utilities: "💡",
  Income: "💵",
  Transfer: "↔️",
  Other: "•",
};

/** Simple 24x24 stroke icon paths per category. */
export const CATEGORY_ICON_PATHS: Record<Category, string> = {
  Housing: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z",
  Groceries: "M3 4h2l2.5 11h11L21 7H6.3M9 20h.01M17 20h.01",
  Dining: "M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 3-3 6v2h3v10M17 3v18",
  Delivery: "M5 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0zM15 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0zM9 17h6M7 17l2-8h5l3 8M14 9l-1-4h3",
  Transportation: "M5 16l1.5-6h11L19 16M3 16h18v3H3zM6.5 19v2M17.5 19v2M7 13h.01M17 13h.01",
  Shopping: "M6 8h12l1 13H5zM9 8V6a3 3 0 0 1 6 0v2",
  Travel: "M2.5 19h19M3.5 13l7-2V5.5a1.5 1.5 0 0 1 3 0V11l7 2v2l-7-1.5V17l2 1.5V20l-3.5-1-3.5 1v-1.5l2-1.5v-3.5L3.5 15z",
  Entertainment: "M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a2 2 0 0 0 0 4v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a2 2 0 0 0 0-4zM9 6v10",
  Health: "M12 21s-7-4.6-9-9.3A5 5 0 0 1 12 6a5 5 0 0 1 9 5.7C19 16.4 12 21 12 21zM7 12h3l1.5-2.5L13 14l1.5-2H17",
  Subscriptions: "M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3",
  Utilities: "M13 2 4 14h7l-1 8 9-12h-7z",
  Income: "M12 3v12M7 10l5 5 5-5M4 21h16",
  Transfer: "M4 8h14l-3-3M20 16H6l3 3",
  Other: "M5 12h.01M12 12h.01M19 12h.01",
};
