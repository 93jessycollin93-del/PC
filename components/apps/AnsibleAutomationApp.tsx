import React, { useState } from 'react'
import { Play, Square, Download, Trash2, Plus, Eye, Code2, ChevronDown } from 'lucide-react'
import { ansibleEngine, Playbook, PlaybookExecutionLog } from '../../src/core/ansibleEngine'

const PLAYBOOK_TEMPLATES = [
  {
    name: 'Daily Maintenance',
    description: 'Backup files, update info, clean cache',
    content: `name: Daily System Maintenance
plays:
  - name: System Maintenance
    tasks:
      - name: Backup important files
        module: file
        src: /home/user/documents
        dest: /backups
        mode: backup
      - name: Update system info
        module: command
        command: df -h
      - name: Clean cache
        module: shell
        shell: rm -rf ~/.cache/*
      - name: Notify completion
        module: notify
        title: System Maintenance Complete
        message: All tasks finished successfully`,
  },
  {
    name: 'App Launch Sequence',
    description: 'Start development apps',
    content: `name: Launch Development Environment
plays:
  - name: Start Apps
    tasks:
      - name: Start TermStudio
        module: service
        apps:
          - TermStudioApp
        action: start
      - name: Start Codex
        module: service
        apps:
          - CodexApp
        action: start
      - name: Notify ready
        module: notify
        title: Development Environment
        message: Apps started successfully`,
  },
  {
    name: 'Data Sync',
    description: 'Sync and backup data',
    content: `name: Data Synchronization
plays:
  - name: Backup Workflow
    vars:
      backup_dir: /backups
      sync_target: cloud
    tasks:
      - name: Set backup directory
        module: set_fact
        backup_path: "{{ backup_dir }}/latest"
      - name: Debug variables
        module: debug
        msg: "Syncing to {{ sync_target }}"
      - name: Sync data
        module: command
        command: rsync -a /data /backups`,
  },
]

export const AnsibleAutomationApp: React.FC = () => {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [executionLogs, setExecutionLogs] = useState<PlaybookExecutionLog[]>([])
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null)
  const [editorMode, setEditorMode] = useState<'templates' | 'editor' | 'logs'>('templates')
  const [playbookYaml, setPlaybookYaml] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)

  const handleLoadTemplate = (template: typeof PLAYBOOK_TEMPLATES[0]) => {
    try {
      const parsed = ansibleEngine.parsePlaybook(template.content)
      setSelectedPlaybook(parsed)
      setPlaybookYaml(template.content)
      setEditorMode('editor')
    } catch (error) {
      alert(`Failed to load template: ${error}`)
    }
  }

  const handleExecutePlaybook = async () => {
    if (!selectedPlaybook) return

    setIsExecuting(true)
    try {
      const log = await ansibleEngine.executePlaybook(selectedPlaybook)
      setExecutionLogs([log, ...executionLogs])
      setEditorMode('logs')
    } catch (error) {
      alert(`Execution failed: ${error}`)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleParseAndExecute = async () => {
    try {
      const parsed = ansibleEngine.parsePlaybook(playbookYaml)
      setSelectedPlaybook(parsed)
      setIsExecuting(true)
      const log = await ansibleEngine.executePlaybook(parsed)
      setExecutionLogs([log, ...executionLogs])
      setEditorMode('logs')
    } catch (error) {
      alert(`Failed to parse playbook: ${error}`)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleExportLogs = (format: 'json' | 'csv') => {
    const content = ansibleEngine.exportLogs(format)
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `playbook-logs.${format}`
    a.click()
  }

  const handleClearLogs = () => {
    if (confirm('Clear all execution logs?')) {
      ansibleEngine.clearExecutionLogs()
      setExecutionLogs([])
    }
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-zinc-800/50 border-b border-zinc-700 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-indigo-400 font-mono">⚙️ Ansible Automation</h1>
          <div className="flex gap-2">
            {['templates', 'editor', 'logs'].map((mode) => (
              <button
                key={mode}
                onClick={() => setEditorMode(mode as any)}
                className={`px-3 py-1.5 rounded text-xs font-mono uppercase ${
                  editorMode === mode
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                {mode === 'templates' && '📋'}
                {mode === 'editor' && '✏️'}
                {mode === 'logs' && '📊'}
                {' ' + mode}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-zinc-400 font-mono">YAML-based task orchestration engine</p>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        {/* Templates View */}
        {editorMode === 'templates' && (
          <div className="p-6 space-y-4">
            <div className="grid gap-4">
              {PLAYBOOK_TEMPLATES.map((template, idx) => (
                <div
                  key={idx}
                  className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 hover:border-indigo-500/50 transition-colors cursor-pointer"
                  onClick={() => handleLoadTemplate(template)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-mono font-bold text-indigo-300">{template.name}</h3>
                      <p className="text-sm text-zinc-400 mt-1">{template.description}</p>
                    </div>
                    <Play size={20} className="text-indigo-400 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Editor View */}
        {editorMode === 'editor' && (
          <div className="p-6 flex flex-col gap-4 h-full">
            <div>
              <label className="text-xs font-mono text-zinc-400 uppercase block mb-2">
                Playbook YAML
              </label>
              <textarea
                value={playbookYaml}
                onChange={(e) => setPlaybookYaml(e.target.value)}
                className="w-full flex-1 bg-zinc-900 border border-zinc-700 rounded font-mono text-sm text-zinc-100 p-4 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                placeholder="name: My Playbook&#10;plays:&#10;  - name: Example Play&#10;    tasks:&#10;      - name: Run task&#10;        module: command&#10;        command: echo 'hello'"
              />
            </div>

            {selectedPlaybook && (
              <div className="bg-zinc-900/50 border border-zinc-700 rounded p-3">
                <p className="text-xs text-zinc-400 font-mono">
                  <strong className="text-indigo-300">Playbook:</strong> {selectedPlaybook.name}
                </p>
                <p className="text-xs text-zinc-400 font-mono mt-1">
                  <strong className="text-indigo-300">Tasks:</strong> {selectedPlaybook.plays.reduce((sum, p) => sum + p.tasks.length, 0)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Logs View */}
        {editorMode === 'logs' && (
          <div className="p-6 space-y-4 overflow-auto">
            {executionLogs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-zinc-400 text-sm">No playbook executions yet</p>
              </div>
            ) : (
              executionLogs.map((log, idx) => (
                <div key={idx} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-mono font-bold text-indigo-300">{log.playName}</h3>
                      <p className="text-xs text-zinc-400 mt-1">
                        {new Date(log.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <div
                      className={`px-3 py-1.5 rounded text-xs font-mono font-bold ${
                        log.status === 'completed'
                          ? 'bg-green-900/30 text-green-200 border border-green-500/50'
                          : 'bg-red-900/30 text-red-200 border border-red-500/50'
                      }`}
                    >
                      {log.status.toUpperCase()}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {log.taskResults.map((result, tIdx) => (
                      <div
                        key={tIdx}
                        className="text-xs font-mono border-l-2 border-zinc-600 pl-3 py-1"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              result.status === 'success'
                                ? 'text-green-400'
                                : 'text-red-400'
                            }
                          >
                            {result.status === 'success' ? '✓' : '✗'}
                          </span>
                          <span className="text-zinc-300">{result.taskName}</span>
                          <span className="text-zinc-500 ml-auto">{result.duration}ms</span>
                        </div>
                        {result.output && (
                          <div className="text-zinc-400 mt-1">{result.output}</div>
                        )}
                        {result.error && (
                          <div className="text-red-400 mt-1">{result.error}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer / Actions */}
      <div className="bg-zinc-800/50 border-t border-zinc-700 px-6 py-4 flex items-center justify-between">
        <div className="flex gap-2">
          {editorMode === 'editor' && (
            <>
              <button
                onClick={handleParseAndExecute}
                disabled={isExecuting || !playbookYaml}
                className="flex items-center gap-2 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-700 disabled:opacity-50 text-white font-mono text-sm transition-colors"
              >
                {isExecuting ? <Square size={16} /> : <Play size={16} />}
                {isExecuting ? 'Executing...' : 'Execute'}
              </button>
              <button
                onClick={() => setEditorMode('templates')}
                className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-white font-mono text-sm transition-colors"
              >
                Back
              </button>
            </>
          )}
          {editorMode === 'logs' && executionLogs.length > 0 && (
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-2 px-4 py-2 rounded bg-red-900/30 hover:bg-red-900/50 text-red-200 font-mono text-sm transition-colors border border-red-500/30"
            >
              <Trash2 size={16} />
              Clear Logs
            </button>
          )}
        </div>

        {editorMode === 'logs' && executionLogs.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => handleExportLogs('json')}
              className="flex items-center gap-2 px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-white font-mono text-sm transition-colors"
            >
              <Download size={16} />
              JSON
            </button>
            <button
              onClick={() => handleExportLogs('csv')}
              className="flex items-center gap-2 px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-white font-mono text-sm transition-colors"
            >
              <Download size={16} />
              CSV
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
