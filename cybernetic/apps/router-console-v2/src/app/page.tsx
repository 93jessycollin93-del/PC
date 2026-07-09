"use client";

import { useEffect, useState } from "react";
import { AgentCard, StatusIndicator, Badge, theme } from "@cybernetic/ui-components";

interface Agent {
  id: string;
  name: string;
  status: "active" | "paused" | "dormant" | "error";
  confidence?: number;
  activeTasks?: number;
  description?: string;
  model?: string;
}

interface SystemMetrics {
  gpuTempC: number;
  cpuTempC: number;
  memoryPercent: number;
  batteryPercent: number;
}

export default function RouterConsole() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics>({
    gpuTempC: 55,
    cpuTempC: 45,
    memoryPercent: 60,
    batteryPercent: 85,
  });
  const [isOffline, setIsOffline] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  useEffect(() => {
    // Check connection status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    setIsOffline(!navigator.onLine);

    // Fetch agents
    fetchAgents();

    // Poll metrics every 5 seconds
    const metricsInterval = setInterval(fetchMetrics, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(metricsInterval);
    };
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch (error) {
      console.log("Offline — using cached agents");
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/system/health");
      if (res.ok) {
        const data = await res.json();
        setMetrics({
          gpuTempC: data.metrics.gpuTemp || metrics.gpuTempC,
          cpuTempC: data.metrics.cpuTemp || metrics.cpuTempC,
          memoryPercent:
            ((data.metrics.memoryUsage || 0) / (data.metrics.memoryTotal || 1)) * 100 ||
            metrics.memoryPercent,
          batteryPercent: data.metrics.batteryPercent || metrics.batteryPercent,
        });
      }
    } catch (error) {
      // Silent fail for offline mode
    }
  };

  const handlePromoteAgent = async (id: string) => {
    try {
      await fetch(`/api/agents/${id}/promote`, { method: "POST" });
      fetchAgents();
    } catch (error) {
      console.error("Failed to promote agent");
    }
  };

  const handlePauseAgent = async (id: string) => {
    try {
      await fetch(`/api/agents/${id}/pause`, { method: "POST" });
      fetchAgents();
    } catch (error) {
      console.error("Failed to pause agent");
    }
  };

  const getThermalStatus = (temp: number): "safe" | "warning" | "critical" => {
    if (temp >= 75) return "critical";
    if (temp >= 70) return "warning";
    return "safe";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: theme.colors.bg.base,
        color: theme.colors.text.primary,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header
        style={{
          backgroundColor: theme.colors.bg.elevated,
          borderBottom: `1px solid ${theme.colors.bg.active}`,
          padding: theme.spacing.lg,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            maxWidth: "1200px",
            margin: "0 auto",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>
            Router Console
          </h1>
          <div style={{ display: "flex", gap: theme.spacing.md, alignItems: "center" }}>
            {isOffline && (
              <Badge variant="warning">
                <span style={{ fontSize: "0.75rem" }}>Offline</span>
              </Badge>
            )}
            <Badge variant="success">
              <span style={{ fontSize: "0.75rem" }}>{agents.length} Agents</span>
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          padding: theme.spacing.lg,
          maxWidth: "1200px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* System Monitoring */}
        <section style={{ marginBottom: theme.spacing.xxl }}>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 600,
              marginBottom: theme.spacing.lg,
              color: theme.colors.text.primary,
            }}
          >
            System Status
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: theme.spacing.lg,
            }}
          >
            <StatusIndicator
              status={getThermalStatus(metrics.gpuTempC)}
              label="GPU Temperature"
              value={metrics.gpuTempC}
              unit="°C"
              animated={getThermalStatus(metrics.gpuTempC) !== "safe"}
              size="md"
            />
            <StatusIndicator
              status={getThermalStatus(metrics.cpuTempC)}
              label="CPU Temperature"
              value={metrics.cpuTempC}
              unit="°C"
              animated={getThermalStatus(metrics.cpuTempC) !== "safe"}
              size="md"
            />
            <StatusIndicator
              status={metrics.memoryPercent > 85 ? "warning" : "safe"}
              label="Memory Usage"
              value={Math.round(metrics.memoryPercent)}
              unit="%"
              size="md"
            />
            <StatusIndicator
              status={
                metrics.batteryPercent < 15
                  ? "critical"
                  : metrics.batteryPercent < 30
                    ? "warning"
                    : "safe"
              }
              label="Battery"
              value={metrics.batteryPercent}
              unit="%"
              size="md"
            />
          </div>
        </section>

        {/* Agent Grid */}
        <section>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 600,
              marginBottom: theme.spacing.lg,
              color: theme.colors.text.primary,
            }}
          >
            Agents
          </h2>
          {agents.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: theme.spacing.xxl,
                backgroundColor: theme.colors.bg.elevated,
                borderRadius: theme.borders.radius.lg,
                color: theme.colors.text.secondary,
              }}
            >
              <p>No agents available</p>
              {isOffline && <p style={{ fontSize: "0.875rem" }}>Offline — Pull to refresh</p>}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: theme.spacing.lg,
              }}
            >
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  id={agent.id}
                  name={agent.name}
                  status={agent.status}
                  confidence={agent.confidence}
                  activeTasks={agent.activeTasks}
                  description={agent.description}
                  model={agent.model}
                  onSelect={setSelectedAgent}
                  onPromote={handlePromoteAgent}
                  onPause={handlePauseAgent}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer
        style={{
          backgroundColor: theme.colors.bg.elevated,
          borderTop: `1px solid ${theme.colors.bg.active}`,
          padding: theme.spacing.lg,
          textAlign: "center",
          color: theme.colors.text.muted,
          fontSize: "0.875rem",
        }}
      >
        <p>Cybernetic Router Console v2 • Offline-First PWA</p>
      </footer>
    </div>
  );
}
