/**
 * Clipboard Bridge — universal clipboard and inter-app data transfer
 *
 * Features:
 * - Shared system clipboard with app-awareness
 * - Data type tagging (text, code, json, file)
 * - Copy/paste with source/destination tracking
 * - Drag-drop protocol support
 * - Clipboard history with search
 */

import { appStorage } from './appStorage';
import { bus } from './bus';

export type DataType = 'text' | 'code' | 'json' | 'file' | 'html' | 'image' | 'unknown';

export interface ClipboardEntry {
  id: string;
  data: string;
  dataType: DataType;
  sourceApp?: string;
  timestamp: number;
  title?: string;
  metadata?: Record<string, any>;
}

export interface ClipboardStats {
  total: number;
  byType: Record<DataType, number>;
}

class ClipboardBridge {
  private history: ClipboardEntry[] = [];
  private maxHistory: number = 100;
  private currentData: ClipboardEntry | null = null;
  private listeners: Set<(entry: ClipboardEntry) => void> = new Set();

  constructor() {
    this.loadHistory();

    // Listen to system clipboard changes
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      setInterval(() => this.syncSystemClipboard(), 2000);
    }
  }

  /**
   * Copy data to clipboard
   */
  public copy(
    data: string,
    dataType: DataType = 'text',
    sourceApp?: string,
    metadata?: Record<string, any>
  ): ClipboardEntry {
    const entry: ClipboardEntry = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data,
      dataType,
      sourceApp,
      timestamp: Date.now(),
      metadata,
    };

    this.currentData = entry;
    this.history.unshift(entry);

    // Trim history
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory);
    }

    this.saveHistory();

    // Try to sync to system clipboard
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(data).catch(e => {
        console.warn('[clipboardBridge] Failed to sync to system clipboard:', e);
      });
    }

    // Notify listeners
    this.notifyListeners(entry);

    bus.emit('clipboard-copied', {
      dataType,
      sourceApp,
      length: data.length,
    });

    return entry;
  }

  /**
   * Paste data from clipboard
   */
  public paste(destinationApp?: string): ClipboardEntry | null {
    if (!this.currentData) return null;

    bus.emit('clipboard-pasted', {
      dataType: this.currentData.dataType,
      destinationApp,
      sourceApp: this.currentData.sourceApp,
    });

    return this.currentData;
  }

  /**
   * Get current clipboard data
   */
  public getCurrentData(): ClipboardEntry | null {
    return this.currentData;
  }

  /**
   * Get clipboard history
   */
  public getHistory(filter?: { dataType?: DataType; sourceApp?: string }): ClipboardEntry[] {
    if (!filter) return this.history;

    return this.history.filter(e => {
      if (filter.dataType && e.dataType !== filter.dataType) return false;
      if (filter.sourceApp && e.sourceApp !== filter.sourceApp) return false;
      return true;
    });
  }

  /**
   * Search clipboard history
   */
  public search(query: string): ClipboardEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.history.filter(
      e => e.data.toLowerCase().includes(lowerQuery) || e.title?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get clipboard statistics
   */
  public getStats(): ClipboardStats {
    const byType: Record<DataType, number> = {
      text: 0,
      code: 0,
      json: 0,
      file: 0,
      html: 0,
      image: 0,
      unknown: 0,
    };

    this.history.forEach(e => {
      byType[e.dataType]++;
    });

    return {
      total: this.history.length,
      byType,
    };
  }

  /**
   * Clear clipboard history (optionally by type)
   */
  public clearHistory(dataType?: DataType): void {
    if (dataType) {
      this.history = this.history.filter(e => e.dataType !== dataType);
    } else {
      this.history = [];
    }
    this.currentData = null;
    this.saveHistory();
  }

  /**
   * Detect data type from content
   */
  public detectDataType(data: string): DataType {
    if (data.startsWith('{') || data.startsWith('[')) {
      try {
        JSON.parse(data);
        return 'json';
      } catch {
        // Not valid JSON
      }
    }

    if (data.startsWith('<') && data.endsWith('>')) {
      return 'html';
    }

    // Simple heuristic: if it looks like code (indented, has brackets, etc.)
    if (/(^|\n)\s{2,}|\{|\}|\(|\)|\[|\]|=>|function|class|const|let|var/.test(data)) {
      return 'code';
    }

    return 'text';
  }

  /**
   * Drag-drop support: prepare data for transfer
   */
  public prepareDragData(
    data: string,
    dataType?: DataType,
    sourceApp?: string
  ): Record<string, string> {
    const type = dataType || this.detectDataType(data);

    return {
      'text/plain': data,
      'application/x-clipboard': JSON.stringify({
        data,
        dataType: type,
        sourceApp,
        timestamp: Date.now(),
      }),
    };
  }

  /**
   * Handle drop data
   */
  public handleDropData(dataTransfer: DataTransfer, destinationApp?: string): ClipboardEntry | null {
    if (dataTransfer.types.includes('application/x-clipboard')) {
      const custom = dataTransfer.getData('application/x-clipboard');
      try {
        const parsed = JSON.parse(custom);
        return this.copy(parsed.data, parsed.dataType || 'text', destinationApp, {
          fromDragDrop: true,
          originalSource: parsed.sourceApp,
        });
      } catch (e) {
        console.warn('[clipboardBridge] Failed to parse drop data:', e);
      }
    }

    // Fall back to plain text
    const text = dataTransfer.getData('text/plain');
    if (text) {
      return this.copy(text, 'text', destinationApp, { fromDragDrop: true });
    }

    return null;
  }

  /**
   * Subscribe to clipboard changes
   */
  public subscribe(listener: (entry: ClipboardEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Export clipboard history as JSON
   */
  public export(): string {
    return JSON.stringify(this.history, null, 2);
  }

  /**
   * Private methods
   */
  private loadHistory(): void {
    const storage = appStorage('clipboard-bridge');
    const saved = storage.get<ClipboardEntry[]>('history', []);
    this.history = saved;
    if (saved.length > 0) {
      this.currentData = saved[0];
    }
  }

  private saveHistory(): void {
    const storage = appStorage('clipboard-bridge');
    storage.set('history', this.history);
  }

  private notifyListeners(entry: ClipboardEntry): void {
    this.listeners.forEach(listener => {
      try {
        listener(entry);
      } catch (e) {
        console.error('[clipboardBridge] Listener error:', e);
      }
    });
  }

  private async syncSystemClipboard(): Promise<void> {
    if (!navigator.clipboard || !navigator.clipboard.readText) return;

    try {
      const text = await navigator.clipboard.readText();
      // Simple sync: if text is different and wasn't just copied by us, add to history
      if (text && (!this.currentData || text !== this.currentData.data)) {
        // Detect if this came from system (not our app)
        // For now, only sync if explicitly triggered by user
      }
    } catch (e) {
      // Permission denied or clipboard empty - normal
    }
  }
}

export const clipboardBridge = new ClipboardBridge();
