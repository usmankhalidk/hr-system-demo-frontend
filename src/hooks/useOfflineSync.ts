import { useEffect, useRef, useCallback } from 'react';
import client from '../api/client';

export interface OfflineEvent {
  event_type: 'checkin' | 'checkout' | 'break_start' | 'break_end';
  user_id: number;
  event_time: string;   // ISO timestamp captured at the moment of scan
  notes?: string;
}

const QUEUE_KEY = 'hr_offline_queue';

function loadQueue(): OfflineEvent[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveQueue(q: OfflineEvent[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

/**
 * Manages an offline attendance event queue.
 *
 * - `enqueue(event)` — persist an event to localStorage when the terminal is offline
 * - `queueLength`    — number of events waiting
 * - `isOnline`       — current browser connectivity
 *
 * Automatically drains the queue via POST /attendance/sync whenever the
 * browser regains connectivity (window 'online' event) or on mount.
 */
export function useOfflineSync() {
  const syncingRef = useRef(false);

  const drainQueue = useCallback(async () => {
    if (syncingRef.current) return;
    const queue = loadQueue();
    if (queue.length === 0) return;

    syncingRef.current = true;
    try {
      await client.post('/attendance/sync', { events: queue });
      saveQueue([]);
    } catch {
      // Leave queue intact — will retry on next reconnect
    } finally {
      syncingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (navigator.onLine) drainQueue();
    const handleOnline = () => drainQueue();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [drainQueue]);

  const enqueue = useCallback((event: OfflineEvent) => {
    const queue = loadQueue();
    queue.push(event);
    saveQueue(queue);
  }, []);

  return {
    enqueue,
    queueLength: loadQueue().length,
    isOnline: navigator.onLine,
  };
}
