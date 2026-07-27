import React from "react";
import { theme } from "../theme";
import { Badge } from "./Badge";

interface AgentCardProps {
  id: string;
  name: string;
  status: "active" | "paused" | "dormant" | "error";
  confidence?: number;
  activeTasks?: number;
  description?: string;
  model?: string;
  onSelect?: (id: string) => void;
  onPromote?: (id: string) => void;
  onPause?: (id: string) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  id,
  name,
  status,
  confidence,
  activeTasks = 0,
  description,
  model,
  onSelect,
  onPromote,
  onPause,
}) => {
  const statusColor = {
    active: theme.colors.status.success,
    paused: theme.colors.status.warning,
    dormant: theme.colors.text.muted,
    error: theme.colors.status.error,
  }[status];

  const statusLabel = {
    active: "Active",
    paused: "Paused",
    dormant: "Dormant",
    error: "Error",
  }[status];

  return (
    <div
      onClick={() => onSelect?.(id)}
      style={{
        backgroundColor: theme.colors.bg.elevated,
        border: `${theme.borders.width.normal} solid ${theme.colors.bg.active}`,
        borderRadius: theme.borders.radius.lg,
        padding: theme.spacing.lg,
        cursor: "pointer",
        transition: theme.transitions.fast,
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.backgroundColor = theme.colors.bg.hover;
        el.style.borderColor = theme.colors.accent.primary;
        el.style.boxShadow = theme.shadows.glow;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.backgroundColor = theme.colors.bg.elevated;
        el.style.borderColor = theme.colors.bg.active;
        el.style.boxShadow = "none";
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          marginBottom: theme.spacing.md,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: theme.typography.heading.fontSize,
              fontWeight: theme.typography.heading.fontWeight,
              color: theme.colors.text.primary,
            }}
          >
            {name}
          </h3>
        </div>
        <Badge variant={status === "active" ? "success" : status === "error" ? "error" : "default"}>
          {statusLabel}
        </Badge>
      </div>

      {/* Description */}
      {description && (
        <p
          style={{
            margin: 0,
            marginBottom: theme.spacing.md,
            fontSize: theme.typography.caption.fontSize,
            color: theme.colors.text.secondary,
            lineHeight: theme.typography.caption.lineHeight,
          }}
        >
          {description}
        </p>
      )}

      {/* Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: theme.spacing.md,
          marginBottom: theme.spacing.lg,
        }}
      >
        {activeTasks !== undefined && (
          <div>
            <div
              style={{
                fontSize: theme.typography.caption.fontSize,
                color: theme.colors.text.secondary,
                marginBottom: theme.spacing.xs,
              }}
            >
              Tasks
            </div>
            <div
              style={{
                fontSize: theme.typography.heading.fontSize,
                fontWeight: 600,
                color: theme.colors.accent.primary,
              }}
            >
              {activeTasks}
            </div>
          </div>
        )}

        {confidence !== undefined && (
          <div>
            <div
              style={{
                fontSize: theme.typography.caption.fontSize,
                color: theme.colors.text.secondary,
                marginBottom: theme.spacing.xs,
              }}
            >
              Confidence
            </div>
            <div
              style={{
                fontSize: theme.typography.heading.fontSize,
                fontWeight: 600,
                color:
                  confidence > 75
                    ? theme.colors.status.success
                    : confidence > 50
                      ? theme.colors.status.warning
                      : theme.colors.status.error,
              }}
            >
              {confidence}%
            </div>
          </div>
        )}
      </div>

      {/* Model */}
      {model && (
        <div
          style={{
            fontSize: theme.typography.caption.fontSize,
            color: theme.colors.text.muted,
            marginBottom: theme.spacing.md,
            fontFamily: theme.typography.mono.fontFamily,
          }}
        >
          {model}
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: theme.spacing.sm,
        }}
      >
        {status === "dormant" && onPromote && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPromote(id);
            }}
            style={{
              flex: 1,
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              backgroundColor: theme.colors.accent.primary,
              color: theme.colors.bg.base,
              border: "none",
              borderRadius: theme.borders.radius.md,
              fontWeight: 500,
              cursor: "pointer",
              transition: theme.transitions.fast,
              fontSize: theme.typography.caption.fontSize,
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor =
                theme.colors.accent.hover;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor =
                theme.colors.accent.primary;
            }}
          >
            Activate
          </button>
        )}

        {status === "active" && onPause && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPause(id);
            }}
            style={{
              flex: 1,
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              backgroundColor: theme.colors.bg.active,
              color: theme.colors.text.primary,
              border: `${theme.borders.width.thin} solid ${theme.colors.bg.active}`,
              borderRadius: theme.borders.radius.md,
              fontWeight: 500,
              cursor: "pointer",
              transition: theme.transitions.fast,
              fontSize: theme.typography.caption.fontSize,
            }}
            onMouseEnter={(e) => {
              const btn = e.target as HTMLButtonElement;
              btn.style.backgroundColor = theme.colors.status.warning + "40";
              btn.style.borderColor = theme.colors.status.warning;
            }}
            onMouseLeave={(e) => {
              const btn = e.target as HTMLButtonElement;
              btn.style.backgroundColor = theme.colors.bg.active;
              btn.style.borderColor = theme.colors.bg.active;
            }}
          >
            Pause
          </button>
        )}
      </div>
    </div>
  );
};
