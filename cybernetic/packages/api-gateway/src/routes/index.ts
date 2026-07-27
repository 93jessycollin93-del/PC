/**
 * Route setup and mounting
 */

import { Express } from "express";
import { taskRoutes } from "./tasks";
import { agentRoutes } from "./agents";
import { systemRoutes } from "./system";
import { syncRoutes } from "./sync";

export function setupRoutes(app: Express) {
  // Task routes: POST /api/tasks, GET /api/tasks/:id, etc.
  app.use("/api/tasks", taskRoutes);

  // Agent routes: GET /api/agents, POST /api/agents/:id/promote, etc.
  app.use("/api/agents", agentRoutes);

  // System routes: GET /api/system/thermal, /memory, /battery
  app.use("/api/system", systemRoutes);

  // Sync routes: POST /api/sync
  app.use("/api/sync", syncRoutes);
}
