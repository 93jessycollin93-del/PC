/**
 * Session Recorder — captures and replays bus events + state snapshots for incident timeline
 */

import { bus } from './bus';
import { appStorage } from './appStorage';

export interface RecordedEvent {
  timestamp: string;
  channel: string;
  data: any;
  metadata?: {
    focusedApp?: string;
    windowCount?: number;
  };
}

export interface Incident {
  id: string;
  name: string;
  createdAt: string;
  startedAt: string;
  endedAt?: string;
  events: RecordedEvent[];
  tags?: string[];
  description?: string;
}

class SessionRecorder {
  private enabled = false;
  private currentIncident: Incident | null = null;
  private incidents: Map<string, Incident> = new Map();
  private maxEventsPerIncident = 500;
  private eventListeners: Map<string, any> = new Map();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const storage = appStorage('session-recorder');
      const savedIncidents = storage.get<Record<string, Incident>>('incidents', {});
      this.incidents = new Map(Object.entries(savedIncidents));
    } catch (e) {
      console.warn('[SESSION_RECORDER] Could not load incidents:', e);
    }
  }

  private save(): void {
    try {
      const storage = appStorage('session-recorder');
      storage.set('incidents', Object.fromEntries(this.incidents));
    } catch (e) {
      console.warn('[SESSION_RECORDER] Could not save incidents:', e);
    }
  }

  /**
   * Start recording a new incident
   */
  startIncident(name: string, description?: string): Incident {
    const incident: Incident = {
      id: `incident-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      events: [],
      description,
      tags: [],
    };

    this.currentIncident = incident;
    this.incidents.set(incident.id, incident);
    this.enabled = true;

    // Subscribe to all bus channels
    const channels = [
      'launch-app', 'refresh-desktop', 'global-back-request', 'cloud-sync-status',
      'jackie-notification', 'automation-run', 'scheduler-run', 'integrity-violation',
    ] as const;

    channels.forEach(channel => {
      const unsubscribe = bus.on(channel as any, (data: any) => {
        this.recordEvent(channel, data);
      });
      this.eventListeners.set(channel, unsubscribe);
    });

    this.save();
    return incident;
  }

  /**
   * Stop recording current incident
   */
  endIncident(): Incident | null {
    if (!this.currentIncident) return null;

    this.currentIncident.endedAt = new Date().toISOString();
    this.enabled = false;

    // Unsubscribe from all channels
    this.eventListeners.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (e) {
        // ignore
      }
    });
    this.eventListeners.clear();

    this.save();
    const incident = this.currentIncident;
    this.currentIncident = null;
    return incident;
  }

  /**
   * Record a single event
   */
  private recordEvent(channel: string, data: any): void {
    if (!this.enabled || !this.currentIncident) return;

    // Trim events if exceeding limit
    if (this.currentIncident.events.length >= this.maxEventsPerIncident) {
      this.currentIncident.events.shift();
    }

    const event: RecordedEvent = {
      timestamp: new Date().toISOString(),
      channel,
      data,
    };

    this.currentIncident.events.push(event);
  }

  /**
   * Add tag to current incident
   */
  addTag(tag: string): void {
    if (this.currentIncident) {
      if (!this.currentIncident.tags) this.currentIncident.tags = [];
      if (!this.currentIncident.tags.includes(tag)) {
        this.currentIncident.tags.push(tag);
      }
      this.save();
    }
  }

  /**
   * Get all incidents
   */
  getIncidents(): Incident[] {
    return Array.from(this.incidents.values());
  }

  /**
   * Get incident by ID
   */
  getIncident(id: string): Incident | undefined {
    return this.incidents.get(id);
  }

  /**
   * Delete incident
   */
  deleteIncident(id: string): void {
    this.incidents.delete(id);
    this.save();
  }

  /**
   * Export incident as JSON
   */
  exportIncident(id: string): string | null {
    const incident = this.incidents.get(id);
    if (!incident) return null;
    return JSON.stringify(incident, null, 2);
  }

  /**
   * Get current incident
   */
  getCurrentIncident(): Incident | null {
    return this.currentIncident;
  }
}

export const sessionRecorder = new SessionRecorder();
