/**
 * The Roof HRM - Chart Color Palette
 *
 * A cohesive, brand-aligned color system for all charts.
 * Based on The Roof brand identity kit.
 */

// Primary palette (use for most charts)
export const CHART_COLORS = {
  primary: "#F97316", // Orange - main data series (Actual)
  secondary: "#FDBA74", // Light orange - comparison/secondary (LastYear/Target)
  tertiary: "#FDBA74", // Keep charts limited to orange family
  muted: "#78716C", // Warm gray - grid, axes, "other"

  // Semantic (for status indicators only)
  success: "#22C55E", // Green - positive, healthy, on track
  warning: "#EAB308", // Amber - attention needed
  error: "#EF4444", // Red - negative, over budget

  // UI elements
  grid: "#E7E0DA", // Subtle grid lines
  axis: "#78716C", // Axis labels
  tooltip: {
    bg: "#FFFFFF",
    border: "#E7E0DA",
    text: "#4A1F1C",
  },
}

// For pie/donut charts - ordered dark to light (max 6 segments)
export const PIE_COLORS = [
  "#EA580C", // Dark orange
  "#F97316", // Orange
  "#FB923C", // Medium orange
  "#FDBA74", // Light orange
  "#FED7AA", // Very light orange
  "#78716C", // Gray (for "Other" - always last)
]

// For bar chart comparisons
export const BAR_COLORS = {
  current: "#F97316", // Actual
  previous: "#FDBA74", // Last year / comparison
  target: "#FDBA74", // Target matches last year
  projected: "#FDBA74", // Keep forecasts within the same orange family
}

// For line/area charts
export const LINE_COLORS = {
  primary: "#F97316",
  primaryFill: "rgba(249, 115, 22, 0.10)", // 10% opacity
  secondary: "#FDBA74",
  secondaryFill: "rgba(253, 186, 116, 0.10)",
  reference: "#FDBA74",
}

// For expense categories (semantic)
export const EXPENSE_COLORS = {
  labor: "#EF4444", // Red (semantic)
  cogs: "#F97316", // Orange
  fixed: "#FDBA74", // Light orange
}

// For revenue categories
export const REVENUE_COLORS = {
  wine: "#EA580C",
  cocktails: "#EA580C",
  shisha: "#F97316",
  spirits: "#FB923C",
  food: "#FDBA74",
  beer: "#FED7AA",
  balloons: "#FDBA74",
  other: "#78716C",
}
