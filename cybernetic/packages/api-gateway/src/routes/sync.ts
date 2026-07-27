/**
 * Sync routes — PWA offline sync
 * POST /api/sync — Trigger synchronization of queued actions
 */

import { Router, Request, Response } from "express";
import { PrismaClient } from "@cybernetic/data-models";
import { Logger } from "winston";

export const syncRoutes = Router();

function asyncHandler(
  fn: (req: Request, res: Response) => Promise<void>
) {
  return (req: Request, res: Response, next: any) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

/**
 * POST /api/sync
 * Manual sync trigger for PWA offline queue
 */
syncRoutes.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = req.app.locals.prisma as PrismaClient;
    const logger = req.app.locals.logger as Logger;

    logger.info("Sync requested from PWA client");

    // In a full implementation, this would:
    // 1. Get pending tasks from IndexedDB (sent by PWA)
    // 2. Process each queued action
    // 3. Return sync results

    // For MVP, just return current state
    const [pendingTasks, agents, latestMetric] = await Promise.all([
      prisma.task.findMany({
        where: { status: "pending" },
        take: 100,
      }),
      prisma.agent.findMany(),
      prisma.systemMetric.findFirst({
        orderBy: { timestamp: "desc" },
      }),
    ]);

    res.json({
      status: "synced",
      timestamp: new Date().toISOString(),
      data: {
        pendingTasks: pendingTasks.length,
        agents: agents.map((a: any) => ({
          id: a.id,
          name: a.name,
          status: a.status,
        })),
        systemMetric: latestMetric
          ? {
              gpuTempC: latestMetric.gpuTempC,
              cpuTempC: latestMetric.cpuTempC,
              memoryUsageMb: latestMetric.memoryUsageMb,
              memoryAvailableMb: latestMetric.memoryAvailableMb,
              batteryPercent: latestMetric.batteryPercent,
            }
          : null,
      },
    });
  })
);
