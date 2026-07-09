import React from "react";
import { theme } from "../theme";

interface StatusIndicatorProps {
  status: "safe" | "warning" | "critical" | "unknown";
  label?: string;
  value?: string | number;
  unit?: string;
  animated?: boolean;
  size?: "sm" | "md" | "lg";
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  value,
  unit,
  animated = false,
  size = "md",
}) => {
  const statusColors = {
    safe: theme.colors.status.success,
    warning: theme.colors.status.warning,
    critical: theme.colors.status.error,
    unknown: theme.colors.text.muted,
  };

  const sizeStyles = {
    sm: { dotSize: "8px", fontSize: "0.75rem" },
    md: { dotSize: "12px", fontSize: "0.875rem" },
    lg: { dotSize: "16px", fontSize: "1rem" },
  };

  const currentSize = sizeStyles[size];
  const color = statusColors[status];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        backgroundColor: theme.colors.bg.elevated,
        borderRadius: theme.borders.radius.md,
        border: `${theme.borders.width.thin} solid ${theme.colors.bg.active}`,
      }}
    >
      {/* Animated dot */}
      <div
        style={{
          position: "relative",
          width: currentSize.dotSize,
          height: currentSize.dotSize,
          borderRadius: "50%",
          backgroundColor: color,
          boxShadow: `0 0 ${parseInt(currentSize.dotSize) * 1.5}px ${color}80`,
          animation: animated ? `pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite` : "none",
        }}
      />

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: theme.spacing.xs,
        }}
      >
        {label && (
          <div style={{ fontSize: currentSize.fontSize, color: theme.colors.text.secondary }}>
            {label}
          </div>
        )}
        {value !== undefined && (
          <div
            style={{
              fontSize: currentSize.fontSize,
              fontWeight: 500,
              color: theme.colors.text.primary,
            }}
          >
            {value}
            {unit && ` ${unit}`}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};
