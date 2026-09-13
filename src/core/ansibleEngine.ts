/**
 * Ansible-inspired automation engine for PC Jackie
 * Parses YAML playbooks and executes tasks with state management
 */

export type TaskModule =
  | 'file'
  | 'command'
  | 'service'
  | 'config'
  | 'notify'
  | 'debug'
  | 'shell'
  | 'set_fact'
  | 'wait'
  | 'loop'

export interface TaskResult {
  taskName: string
  status: 'success' | 'failed' | 'skipped'
  output?: string
  error?: string
  duration: number
  timestamp: Date
}

export interface PlaybookExecutionLog {
  playName: string
  startedAt: Date
  completedAt?: Date
  taskResults: TaskResult[]
  status: 'running' | 'completed' | 'failed'
  variables: Record<string, any>
}

export interface Task {
  name: string
  module: TaskModule
  params: Record<string, any>
  vars?: Record<string, any>
  when?: string
  notify?: string[]
}

export interface Play {
  name: string
  tasks: Task[]
  vars?: Record<string, any>
}

export interface Playbook {
  name: string
  plays: Play[]
  vars?: Record<string, any>
}

export class AnsibleEngine {
  private executionLogs: PlaybookExecutionLog[] = []
  private variableStack: Record<string, Record<string, any>> = {}

  /**
   * Parse YAML-like playbook definition
   */
  parsePlaybook(definition: string): Playbook {
    try {
      // Simple YAML parser for our use case
      // In production, use js-yaml library
      const lines = definition.split('\n')
      const playbook: Playbook = {
        name: 'Untitled Playbook',
        plays: [],
      }

      let currentPlay: Partial<Play> | null = null
      let currentTask: Partial<Task> | null = null

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()

        if (!trimmed || trimmed.startsWith('#')) continue

        const indent = line.length - trimmed.length

        // Playbook level
        if (trimmed.startsWith('name:') && indent === 0) {
          playbook.name = this.parseValue(trimmed.replace('name:', '').trim())
        }

        // Play level
        if (trimmed.startsWith('- name:') && indent === 0) {
          if (currentPlay) {
            playbook.plays.push(currentPlay as Play)
          }
          currentPlay = {
            name: this.parseValue(trimmed.replace('- name:', '').trim()),
            tasks: [],
            vars: {},
          }
        }

        // Task level
        if (currentPlay && trimmed.startsWith('- name:') && indent > 0) {
          if (currentTask) {
            (currentPlay as Play).tasks.push(currentTask as Task)
          }
          currentTask = {
            name: this.parseValue(trimmed.replace('- name:', '').trim()),
          }
        }

        // Module definition
        if (currentTask && !trimmed.startsWith('name:')) {
          const match = trimmed.match(/^(\w+):(.*)/)
          if (match) {
            const [, module, value] = match
            if (['file', 'command', 'service', 'config', 'notify', 'debug', 'shell'].includes(module)) {
              currentTask.module = module as TaskModule
              currentTask.params = currentTask.params || {}
              currentTask.params[module] = this.parseValue(value.trim())
            }
          }
        }
      }

      if (currentTask && currentPlay) {
        (currentPlay as Play).tasks.push(currentTask as Task)
      }
      if (currentPlay) {
        playbook.plays.push(currentPlay as Play)
      }

      return playbook
    } catch (error) {
      throw new Error(`Failed to parse playbook: ${error}`)
    }
  }

  /**
   * Execute a playbook
   */
  async executePlaybook(playbook: Playbook): Promise<PlaybookExecutionLog> {
    const log: PlaybookExecutionLog = {
      playName: playbook.name,
      startedAt: new Date(),
      taskResults: [],
      status: 'running',
      variables: { ...playbook.vars },
    }

    try {
      for (const play of playbook.plays) {
        for (const task of play.tasks) {
          const taskLog = await this.executeTask(task, log.variables)
          log.taskResults.push(taskLog)

          if (taskLog.status === 'failed') {
            log.status = 'failed'
            break
          }
        }
        if (log.status === 'failed') break
      }

      log.status = 'completed'
    } catch (error) {
      log.status = 'failed'
      log.taskResults.push({
        taskName: 'playbook_execution',
        status: 'failed',
        error: String(error),
        duration: Date.now() - log.startedAt.getTime(),
        timestamp: new Date(),
      })
    }

    log.completedAt = new Date()
    this.executionLogs.push(log)
    return log
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: Task, variables: Record<string, any>): Promise<TaskResult> {
    const startTime = Date.now()

    try {
      let output = ''

      switch (task.module) {
        case 'file':
          output = this.executeFileTask(task.params)
          break
        case 'command':
          output = this.executeCommandTask(task.params)
          break
        case 'service':
          output = this.executeServiceTask(task.params)
          break
        case 'notify':
          output = this.executeNotifyTask(task.params)
          break
        case 'debug':
          output = this.executeDebugTask(task.params, variables)
          break
        case 'set_fact':
          output = this.executeSetFactTask(task.params, variables)
          break
        case 'shell':
          output = this.executeShellTask(task.params)
          break
        default:
          output = `Module '${task.module}' executed`
      }

      return {
        taskName: task.name,
        status: 'success',
        output,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      }
    } catch (error) {
      return {
        taskName: task.name,
        status: 'failed',
        error: String(error),
        duration: Date.now() - startTime,
        timestamp: new Date(),
      }
    }
  }

  // Module implementations
  private executeFileTask(params: Record<string, any>): string {
    const { src, dest, mode = 'copy' } = params
    return `File ${mode}: ${src} → ${dest}`
  }

  private executeCommandTask(params: Record<string, any>): string {
    const cmd = params.command || Object.values(params)[0]
    return `Executed: ${cmd}`
  }

  private executeServiceTask(params: Record<string, any>): string {
    const { apps, action } = params
    const appList = Array.isArray(apps) ? apps.join(', ') : apps
    return `Service ${action}: [${appList}]`
  }

  private executeNotifyTask(params: Record<string, any>): string {
    const { title, message } = params
    return `Notification: ${title} - ${message}`
  }

  private executeDebugTask(params: Record<string, any>, variables: Record<string, any>): string {
    const msg = params.msg || Object.values(params)[0]
    const interpolated = this.interpolateVars(String(msg), variables)
    return `DEBUG: ${interpolated}`
  }

  private executeSetFactTask(params: Record<string, any>, variables: Record<string, any>): string {
    for (const [key, value] of Object.entries(params)) {
      variables[key] = value
    }
    return `Variables set: ${Object.keys(params).join(', ')}`
  }

  private executeShellTask(params: Record<string, any>): string {
    const cmd = params.shell || Object.values(params)[0]
    return `Shell: ${cmd}`
  }

  /**
   * Interpolate variables in strings
   */
  private interpolateVars(text: string, variables: Record<string, any>): string {
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, varName) => {
      return String(variables[varName] || `{{ ${varName} }}`)
    })
  }

  /**
   * Parse YAML values
   */
  private parseValue(value: string): any {
    value = value.trim()
    if (value === 'true') return true
    if (value === 'false') return false
    if (value === 'null') return null
    if (!isNaN(Number(value))) return Number(value)
    return value.replace(/^["']|["']$/g, '')
  }

  /**
   * Get execution history
   */
  getExecutionLogs(): PlaybookExecutionLog[] {
    return this.executionLogs
  }

  /**
   * Clear execution history
   */
  clearExecutionLogs(): void {
    this.executionLogs = []
  }

  /**
   * Export playbook logs as JSON
   */
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.executionLogs, null, 2)
    }

    // CSV format
    const headers = ['Playbook', 'Task', 'Status', 'Output', 'Duration (ms)', 'Timestamp']
    const rows = this.executionLogs.flatMap(log =>
      log.taskResults.map(result =>
        [
          log.playName,
          result.taskName,
          result.status,
          (result.output || result.error || '').substring(0, 50),
          result.duration,
          result.timestamp.toISOString(),
        ].join(',')
      )
    )

    return [headers.join(','), ...rows].join('\n')
  }
}

export const ansibleEngine = new AnsibleEngine()
