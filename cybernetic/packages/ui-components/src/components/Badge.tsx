import React from "react";
import { theme } from "../theme";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
  size?: "sm" | "md";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  size = "md",
  className = "",
}) => {
  const baseStyles = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.borders.radius.full,
    fontWeight: 500,
    whiteSpace: "nowrap" as const,
    transition: theme.transitions.fast,
  };

  const sizeStyles = {
    sm: {
      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
      fontSize: "0.75rem",
    },
    md: {
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      fontSize: "0.875rem",
    },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    default: {
      backgroundColor: theme.colors.bg.elevated,
      color: theme.colors.text.primary,
      border: `${theme.borders.width.thin} solid ${theme.colors.bg.active}`,
    },
    success: {
      backgroundColor: `${theme.colors.status.success}20`,
      color: theme.colors.status.success,
      border: `${theme.borders.width.thin} solid ${theme.colors.status.success}40`,
    },
    warning: {
      backgroundColor: `${theme.colors.status.warning}20`,
      color: theme.colors.status.warning,
      border: `${theme.borders.width.thin} solid ${theme.colors.status.warning}40`,
    },
    error: {
      backgroundColor: `${theme.colors.status.error}20`,
      color: theme.colors.status.error,
      border: `${theme.borders.width.thin} solid ${theme.colors.status.error}40`,
    },
    info: {
      backgroundColor: `${theme.colors.status.info}20`,
      color: theme.colors.status.info,
      border: `${theme.borders.width.thin} solid ${theme.colors.status.info}40`,
    },
  };

  const styles = {
    ...baseStyles,
    ...sizeStyles[size],
    ...variantStyles[variant],
  };

  return (
    <span style={styles} className={className}>
      {children}
    </span>
  );
};
