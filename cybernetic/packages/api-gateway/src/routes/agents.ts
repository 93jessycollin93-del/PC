/**
 * Agent routes — Agent lifecycle management
 * GET /api/agents — List all agents
 * POST /api/agents/:id/promote — Wake agent from dormant state
 * POST /api/agents/:id/pause — Pause active agent
 */

import { Router, Request, Response } from "express";
import { PrismaClient } from "@cybernetic/data-models";
import { Logger } from "winston";
import { NotFoundError } from "../middleware/error-handler";

export const agentRoutes = Router();

function asyncHandler(
  fn: (req: Request, res: Response) => Promise<void>
) {
  return (req: Request, res: Response, next: any) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

/**
 * GET /api/agents
 * List all agents with their current status
 */
agentRoutes.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = req.app.locals.prisma as PrismaClient;

    const agents = await prisma.agent.findMany({
      include: {
        tasks: {
          where: { status: { not: "completed" } },
          select: { id: true, status: true, confidence: true },
          take: 5,
        },
        metrics: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
    });

    res.json({
      agents: agents.map((agent: any) => ({
        ...agent,
        activeTasks: agent.tasks.length,
        metrics: agent.metrics[0] || null,
      })),
    });
  })
);

/**
 * GET /api/agents/:id
 * Get specific agent details
 */
agentRoutes.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = req.app.locals.prisma as PrismaClient;
    const { id } = req.params;

    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        tasks: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        metrics: {
          orderBy: { timestamp: "desc" },
          take: 5,
        },
      },
    });

    if (!agent) {
      throw new NotFoundError("Agent");
    }

    res.json(agent);
  })
);

/**
 * POST /api/agents/:id/promote
 * Wake agent from dormant state → active
 */
agentRoutes.post(
  "/:id/promote",
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = req.app.locals.prisma as PrismaClient;
    const logger = req.app.locals.logger as Logger;
    const { id } = req.params;

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      throw new NotFoundError("Agent");
    }

    if (agent.status === "active") {
      res.status(400).json({
        error: "Agent is already active",
        currentStatus: agent.status,
      });
      return;
    }

    // Update status
    const updated = await prisma.agent.update({
      where: { id },
      data: { status: "active" },
    });

    // Log action
    await prisma.auditLog.create({
      data: {
        action: "agent_promote",
        resourceType: "Agent",
        resourceId: id,
        changes: { from: agent.status, to: "active" },
        status: "success",
      },
    });

    logger.info(`Agent promoted to active`, {
      agentId: id,
      agentName: agent.name,
      previousStatus: agent.status,
    });

    res.json({
      agent: updated,
      message: `Agent "${agent.name}" promoted to active`,
    });
  })
);

/**
 * POST /api/agents/:id/pause
 * Pause active agent → paused
 */
agentRoutes.post(
  "/:id/pause",
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = req.app.locals.prisma as PrismaClient;
    const logger = req.app.locals.logger as Logger;
    const { id } = req.params;

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      throw new NotFoundError("Agent");
    }

    // Update status
    const updated = await prisma.agent.update({
      where: { id },
      data: { status: "paused" },
    });

    // Log action
    await prisma.auditLog.create({
      data: {
        action: "agent_pause",
        resourceType: "Agent",
        resourceId: id,
        changes: { from: agent.status, to: "paused" },
        status: "success",
      },
    });

    logger.info(`Agent paused`, {
      agentId: id,
      agentName: agent.name,
      previousStatus: agent.status,
    });

    res.json({
      agent: updated,
      message: `Agent "${agent.name}" paused`,
    });
  })
);
