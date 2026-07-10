/**
 * Activity Center — unified view of sync, notifications, and events
 *
 * Features:
 * - Sync queue visibility (pending, completed, failed)
 * - Notification timeline
 * - Event history
 * - Retry and recovery controls
 */

import { appStorage } from './appStorage';
import { bus } from './bus';

export type ActivityType = 'sync' | 'notification' | 'error' | 'event' | 'automation' | 'scheduler';
export type ActivityStatus = 'pending' | 'completed' | 'failed' | 'info' | 'success' | 'warning';

export interface Activity {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  title: string;
  message?: string;
  timestamp: number;
  source?: string;
  data?: Record<string, any>;
  retryable?: boolean;
  retryCount?: number;
}

class ActivityCenter {
  private activities: Activity[] = [];
  private maxHistory: number = 500;

  constructor() {
    this.loadActivities();

    // Subscribe to all events and log them
    bus.on('jackie-notification', (detail: any) => {
      this.logActivity({
        type: 'notification',
        status: detail.level || 'info',
        title: detail.title,
        message: detail.message,
        source: detail.source,
      });
    });

    bus.on('automation-run', (detail: any) => {
      this.logActivity({
        type: 'automation',
        status: detail.ok ? 'completed' : 'failed',
        title: `Automation: ${detail.name}`,
        message: detail.detail,
        source: 'automation',
        retryable: !detail.ok,
      });
    });

    bus.on('scheduler-run', (detail: any) => {
      this.logActivity({
        type: 'scheduler',
        status: detail.ok ? 'completed' : 'failed',
        title: `Scheduled job: ${detail.name}`,
        message: detail.detail,
        source: 'scheduler',
      });
    });

    bus.on('app-error', (detail: any) => {
      this.logActivity({
        type: 'error',
        status: 'failed',
        title: `App Error: ${detail.appId}`,
        message: detail.error,
        source: 'app-error',
        retryable: true,
      });
    });
  }

  /**
   * Log an activity
   */
  public logActivity(
    partial: Omit<Activity, 'id' | 'timestamp'> & { timestamp?: number }
  ): void {
    const activity: Activity = {
      ...partial,
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: partial.timestamp || Date.now(),
      retryCount: partial.retryCount || 0,
    };

    this.activities.unshift(activity); // Newest first

    // Trim to max history
    if (this.activities.length > this.maxHistory) {
      this.activities = this.activities.slice(0, this.maxHistory);
    }

    this.saveActivities();
  }

  /**
   * Get all activities
   */
  public getActivities(filter?: { type?: ActivityType; status?: ActivityStatus }): Activity[] {
    if (!filter) return this.activities;

    return this.activities.filter(a => {
      if (filter.type && a.type !== filter.type) return false;
      if (filter.status && a.status !== filter.status) return false;
      return true;
    });
  }

  /**
   * Get activities by time range (last N minutes)
   */
  public getRecentActivities(minutesBack: number = 60): Activity[] {
    const cutoff = Date.now() - minutesBack * 60000;
    return this.activities.filter(a => a.timestamp > cutoff);
  }

  /**
   * Get sync queue status
   */
  public getSyncStatus(): {
    pending: Activity[];
    completed: Activity[];
    failed: Activity[];
    totalPending: number;
  } {
    const syncActivities = this.activities.filter(a => a.type === 'sync');
    return {
      pending: syncActivities.filter(a => a.status === 'pending'),
      completed: syncActivities.filter(a => a.status === 'completed'),
      failed: syncActivities.filter(a => a.status === 'failed'),
      totalPending: syncActivities.filter(a => a.status === 'pending').length,
    };
  }

  /**
   * Get activity statistics
   */
  public getStats(): {
    total: number;
    byType: Record<ActivityType, number>;
    byStatus: Record<ActivityStatus, number>;
  } {
    const byType: Record<ActivityType, number> = {
      sync: 0,
      notification: 0,
      error: 0,
      event: 0,
      automation: 0,
      scheduler: 0,
    };

    const byStatus: Record<ActivityStatus, number> = {
      pending: 0,
      completed: 0,
      failed: 0,
      info: 0,
      success: 0,
      warning: 0,
    };

    this.activities.forEach(a => {
      byType[a.type]++;
      byStatus[a.status]++;
    });

    return {
      total: this.activities.length,
      byType,
      byStatus,
    };
  }

  /**
   * Retry a failed activity
   */
  public retryActivity(id: string): void {
    const activity = this.activities.find(a => a.id === id);
    if (!activity || !activity.retryable) return;

    activity.retryCount = (activity.retryCount || 0) + 1;
    activity.status = 'pending';

    // Emit retry event that original handler can respond to
    bus.emit('activity-retry', { activityId: id, retryCount: activity.retryCount });

    this.saveActivities();
  }

  /**
   * Clear activities of a specific type or all
   */
  public clearActivities(type?: ActivityType): void {
    if (type) {
      this.activities = this.activities.filter(a => a.type !== type);
    } else {
      this.activities = [];
    }
    this.saveActivities();
  }

  /**
   * Clear old activities (older than N days)
   */
  public clearOldActivities(daysOld: number = 7): void {
    const cutoff = Date.now() - daysOld * 24 * 60 * 60000;
    this.activities = this.activities.filter(a => a.timestamp > cutoff);
    this.saveActivities();
  }

  /**
   * Export activities as JSON
   */
  public export(): string {
    return JSON.stringify(this.activities, null, 2);
  }

  /**
   * Private methods
   */
  private loadActivities(): void {
    const storage = appStorage('activity-center');
    const saved = storage.get<Activity[]>('activities', []);
    this.activities = saved;
  }

  private saveActivities(): void {
    const storage = appStorage('activity-center');
    storage.set('activities', this.activities);
  }
}

export const activityCenter = new ActivityCenter();
