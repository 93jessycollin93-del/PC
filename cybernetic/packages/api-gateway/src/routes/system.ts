/**
 * System routes — Monitoring and health
 * GET /api/system/thermal — GPU/CPU temperature
 * GET /api/system/memory — RAM usage
 * GET /api/system/battery — Battery status
 * GET /api/system/health — Overall system health
 */

import { Router, Request, Response } from "express";
import { PrismaClient } from "@cybernetic/data-models";

export const systemRoutes = Router();

function asyncHandler(
  fn: (req: Request, res: Response) => Promise<void>
) {
  return (req: Request, res: Response, next: any) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

/**
 * GET /api/system/thermal
 * Latest GPU and CPU temperature
 */
systemRoutes.get(
  "/thermal",
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = req.app.locals.prisma as PrismaClient;

    const latest = await prisma.systemMetric.findFirst({
      orderBy: { timestamp: "desc" },
      select: {
        gpuTempC: true,
        cpuTempC: true,
        timestamp: true,
      },
    });

    if (!latest) {
      res.status(503).json({
        error: "No thermal data available yet",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Determine status based on temperature
    const thermalStatus =
      latest.gpuTempC! >= 75
        ? "critical"
        : latest.gpuTempC! >= 70
          ? "warning"
          : "safe";

    res.json({
      gpu: {
        tempC: latest.gpuTempC,
        status: thermalStatus,
        thresholds: { warning: 70, critical: 75 },
      },
      cpu: {
        tempC: latest.cpuTempC,
        status:
          latest.cpuTempC! >= 85
            ? "critical"
            : latest.cpuTempC! >= 75
              ? "warning"
              : "safe",
        thresholds: { warning: 75, critical: 85 },
      },
      timestamp: latest.timestamp,
    });
  })
);

/**
 * GET /api/system/memory
 * RAM usage and available memory
 */
systemRoutes.get(
  "/memory",
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = req.app.locals.prisma as PrismaClient;

    const latest = await prisma.systemMetric.findFirst({
      orderBy: { timestamp: "desc" },
      select: {
        memoryUsageMb: true,
        memoryAvailableMb: true,
        timestamp: true,
      },
    });

    if (!latest) {
      res.status(503).json({
        error: "No memory data available yet",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const total = latest.memoryUsageMb! + latest.memoryAvailableMb!;
    const usagePercent = (latest.memoryUsageMb! / total) * 100;

    res.json({
      used: {
        mb: latest.memoryUsageMb,
        percent: usagePercent,
      },
      available: {
        mb: latest.memoryAvailableMb,
        percent: 100 - usagePercent,
      },
      total: {
        mb: total,
      },
      status:
        usagePercent > 85
          ? "critical"
          : usagePercent > 70
            ? "warning"
            : "healthy",
      timestamp: latest.timestamp,
    });
  })
);

/**
 * GET /api/system/battery
 * Battery level and drain rate
 */
systemRoutes.get(
  "/battery",
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = req.app.locals.prisma as PrismaClient;

    const latest = await prisma.systemMetric.findFirst({
      orderBy: { timestamp: "desc" },
      select: {
        batteryPercent: true,
        batteryDrain: true,
        timestamp: true,
      },
    });

    if (!latest) {
      res.status(503).json({
        error: "No battery data available yet",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Estimate time to discharge at current drain rate
    let timeToDischargeHours: number | null = null;
    if (latest.batteryDrain && latest.batteryDrain > 0) {
      // batteryDrain is in mW/min, battery is in percent
      // Rough estimate: 1% per mW/min under load
      timeToDischargeHours = latest.batteryPercent! / latest.batteryDrain;
    }

    res.json({
      percent: latest.batteryPercent,
      drainRate: {
        mwPerMin: latest.batteryDrain,
      },
      estimatedTimeHours: timeToDischargeHours,
      status:
        latest.batteryPercent! < 5
          ? "critical"
          : latest.batteryPercent! < 15
            ? "low"
            : latest.batteryPercent! < 30
              ? "moderate"
              : "healthy",
      timestamp: latest.timestamp,
    });
  })
);

/**
 * GET /api/system/health
 * Overall system health summary
 */
systemRoutes.get(
  "/health",
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = req.app.locals.prisma as PrismaClient;

    const latest = await prisma.systemMetric.findFirst({
      orderBy: { timestamp: "desc" },
    });

    if (!latest) {
      res.status(503).json({
        status: "unknown",
        message: "No system metrics available yet",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const thermalOk = latest.gpuTempC! < 70;
    const memoryOk = latest.memoryAvailableMb! > 800;
    const batteryOk = latest.batteryPercent! > 15;

    const overallStatus = thermalOk && memoryOk && batteryOk ? "healthy" : "degraded";

    res.json({
      status: overallStatus,
      components: {
        thermal: thermalOk ? "ok" : "warning",
        memory: memoryOk ? "ok" : "warning",
        battery: batteryOk ? "ok" : "warning",
      },
      metrics: {
        gpuTemp: latest.gpuTempC,
        cpuTemp: latest.cpuTempC,
        memoryAvailable: latest.memoryAvailableMb,
        batteryPercent: latest.batteryPercent,
      },
      timestamp: latest.timestamp,
    });
  })
);
