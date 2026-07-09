/**
 * Task routes — Core orchestration workflow
 * POST /api/tasks — Create task and route to agent
 * GET  /api/tasks/:id — Get task status and results
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { OrchestratorService } from "@cybernetic/core-orchestration";
import { Logger } from "winston";
import { ValidationError, NotFoundError } from "../middleware/error-handler";

export const taskRoutes = Router();

// Validation schema
const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  input: z.string().min(1).max(5000),
});

type CreateTaskRequest = z.infer<typeof CreateTaskSchema>;

// Route handler wrapper
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * POST /api/tasks
 * Create a new task and route it to the best available agent
 */
taskRoutes.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = req.app.locals.prisma as PrismaClient;
    const logger = req.app.locals.logger as Logger;

    // Validate input
    const parsed = CreateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        `Invalid request: ${parsed.error.errors.map((e) => e.message).join(", ")}`
      );
    }

    const { title, description, input } = parsed.data;

    // Get all agents
    const agents = await prisma.agent.findMany({
      where: { status: { not: "paused" } },
    });

    if (agents.length === 0) {
      throw new ValidationError("No agents available for routing");
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        title,
        description,
        input,
        status: "pending",
        agentId: agents[0].id, // Will be updated after routing
      },
    });

    // Initialize orchestrator
    const orchestrator = new OrchestratorService(agents);

    // Get system state (simplified for MVP)
    const systemState = {
      gpuTempC: 55, // TODO: Read actual GPU temp
      cpuTempC: 45,
      memoryUsagePercent: 60,
      memoryAvailableMb: 1200,
      batteryPercent: 80,
      batteryDrain: 5.0,
    };

    // Route task
    const routing = await orchestrator.orchestrateTask(task, systemState);

    // Update task with routing result
    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        agentId: routing.agentId,
        confidence: routing.confidence,
        status: "assigned",
      },
    });

    // Log routing decision
    await prisma.auditLog.create({
      data: {
        action: "agent_route",
        resourceType: "Task",
        resourceId: task.id,
        changes: {
          agent: routing.agentId,
          confidence: routing.confidence,
          rationale: routing.rationale,
        },
        status: "success",
      },
    });

    logger.info(`Task routed to agent`, {
      taskId: task.id,
      agentId: routing.agentId,
      confidence: routing.confidence,
    });

    res.status(201).json({
      task: updatedTask,
      routing: {
        agentId: routing.agentId,
        confidence: routing.confidence,
        rationale: routing.rationale,
      },
    });
  })
);

/**
 * GET /api/tasks/:id
 * Get task details and current status
 */
taskRoutes.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = req.app.locals.prisma as PrismaClient;
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { agent: true },
    });

    if (!task) {
      throw new NotFoundError("Task");
    }

    res.json(task);
  })
);

/**
 * GET /api/tasks
 * List all tasks (with optional filtering)
 */
taskRoutes.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = req.app.locals.prisma as PrismaClient;
    const { status, agentId, limit = "20", offset = "0" } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (agentId) where.agentId = agentId;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: { agent: true },
        take: Math.min(parseInt(limit as string) || 20, 100),
        skip: parseInt(offset as string) || 0,
        orderBy: { createdAt: "desc" },
      }),
      prisma.task.count({ where }),
    ]);

    res.json({
      tasks,
      pagination: {
        limit: Math.min(parseInt(limit as string) || 20, 100),
        offset: parseInt(offset as string) || 0,
        total,
      },
    });
  })
);
