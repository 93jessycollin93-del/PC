/**
 * Cybernetic Dark Theme — optimized for security UI
 * Color palette: deep space (#0a0e27) + neon cyan accent (#00d4ff)
 */

export const theme = {
  colors: {
    // Background layers
    bg: {
      base: "#0a0e27", // Deep space black
      elevated: "#111633", // Slightly elevated
      hover: "#16213e", // Interactive hover state
      active: "#1a2747", // Active state
    },
    // Text
    text: {
      primary: "#e8eef7", // Off-white
      secondary: "#a0a8c0", // Muted
      muted: "#6b7280", // Further muted
      inverse: "#0a0e27", // For light backgrounds
    },
    // Accent — neon cyan
    accent: {
      primary: "#00d4ff", // Primary accent
      hover: "#00b8d4", // Darker variant
      light: "#40e0ff", // Lighter variant
    },
    // Semantic colors
    status: {
      success: "#10b981", // Green
      warning: "#f59e0b", // Amber
      error: "#ef4444", // Red
      info: "#3b82f6", // Blue
    },
    // Thermal gradients (GPU monitoring)
    thermal: {
      safe: "#10b981", // Green < 60°C
      warning: "#f59e0b", // Amber 60-70°C
      critical: "#ef4444", // Red > 75°C
    },
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    xxl: "3rem",
  },
  typography: {
    // Display (headings)
    display: {
      fontSize: "2rem",
      fontWeight: 700,
      lineHeight: 1.2,
      fontFamily: "system-ui, -apple-system, sans-serif",
    },
    // Heading
    heading: {
      fontSize: "1.5rem",
      fontWeight: 600,
      lineHeight: 1.3,
      fontFamily: "system-ui, -apple-system, sans-serif",
    },
    // Body
    body: {
      fontSize: "1rem",
      fontWeight: 400,
      lineHeight: 1.5,
      fontFamily: "system-ui, -apple-system, sans-serif",
    },
    // Small/caption
    caption: {
      fontSize: "0.875rem",
      fontWeight: 400,
      lineHeight: 1.4,
      fontFamily: "system-ui, -apple-system, sans-serif",
    },
    // Monospace (data, codes)
    mono: {
      fontSize: "0.875rem",
      fontWeight: 500,
      lineHeight: 1.4,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
    },
  },
  borders: {
    radius: {
      sm: "0.375rem",
      md: "0.5rem",
      lg: "0.75rem",
      xl: "1rem",
      full: "9999px",
    },
    width: {
      thin: "1px",
      normal: "2px",
      thick: "3px",
    },
  },
  shadows: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.3)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.4)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
    xl: "0 20px 25px -5px rgba(0, 0, 0, 0.6)",
    glow: "0 0 20px rgba(0, 212, 255, 0.3)", // Accent glow
  },
  transitions: {
    fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
    base: "250ms cubic-bezier(0.4, 0, 0.2, 1)",
    slow: "350ms cubic-bezier(0.4, 0, 0.2, 1)",
  },
};

export type Theme = typeof theme;
