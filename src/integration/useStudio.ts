/**
 * React Hook - useStudio
 * Simple interface for AI Studio orchestration within React components
 */

import { useCallback, useRef, useState } from 'react';
import StudioOrchestrator, { type StudioConfig, type StudioTask } from './studio-orchestrator';

export function useStudio(config: StudioConfig) {
  const orchestratorRef = useRef<StudioOrchestrator | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [tasks, setTasks] = useState<StudioTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentTask, setCurrentTask] = useState<StudioTask | null>(null);

  // Initialize orchestrator
  if (!orchestratorRef.current) {
    orchestratorRef.current = new StudioOrchestrator(config);
    setIsReady(true);
  }

  const generateComponent = useCallback(
    async (description: string, imageUrl?: string) => {
      if (!orchestratorRef.current) {
        setError('Orchestrator not initialized');
        return;
      }

      try {
        setError(null);
        const task = await orchestratorRef.current.generateComponent(description, imageUrl);
        setCurrentTask(task);
        setTasks((prev) => [...prev, task]);
        return task;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        throw err;
      }
    },
    []
  );

  const analyzeCode = useCallback(async (code: string) => {
    if (!orchestratorRef.current) {
      setError('Orchestrator not initialized');
      return;
    }

    try {
      setError(null);
      const task = await orchestratorRef.current.analyzeCode(code);
      setCurrentTask(task);
      setTasks((prev) => [...prev, task]);
      return task;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const enhanceCode = useCallback(
    async (code: string, enhancement: string) => {
      if (!orchestratorRef.current) {
        setError('Orchestrator not initialized');
        return;
      }

      try {
        setError(null);
        const task = await orchestratorRef.current.enhanceCode(code, enhancement);
        setCurrentTask(task);
        setTasks((prev) => [...prev, task]);
        return task;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        throw err;
      }
    },
    []
  );

  const debugIssue = useCallback(
    async (error: string, context?: string) => {
      if (!orchestratorRef.current) {
        setError('Orchestrator not initialized');
        return;
      }

      try {
        setError(null);
        const task = await orchestratorRef.current.debugIssue(error, context);
        setCurrentTask(task);
        setTasks((prev) => [...prev, task]);
        return task;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        throw err;
      }
    },
    []
  );

  const generateDocumentation = useCallback(async (code: string) => {
    if (!orchestratorRef.current) {
      setError('Orchestrator not initialized');
      return;
    }

    try {
      setError(null);
      const task = await orchestratorRef.current.generateDocumentation(code);
      setCurrentTask(task);
      setTasks((prev) => [...prev, task]);
      return task;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const clearHistory = useCallback(() => {
    if (orchestratorRef.current) {
      orchestratorRef.current.clearHistory();
      setTasks([]);
      setCurrentTask(null);
    }
  }, []);

  const getStatus = useCallback(() => {
    if (!orchestratorRef.current) return null;
    return orchestratorRef.current.getStatus();
  }, []);

  return {
    isReady,
    tasks,
    currentTask,
    error,
    generateComponent,
    analyzeCode,
    enhanceCode,
    debugIssue,
    generateDocumentation,
    clearHistory,
    getStatus,
    orchestrator: orchestratorRef.current,
  };
}

export type UseStudioReturn = ReturnType<typeof useStudio>;
