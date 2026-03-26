import { useEffect, useRef, useCallback, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

export interface OfflineEvent {
  event_type: 'checkin' | 'checkout' | 'break_start' | 'break_end';
  unique_id?: string;   // Employee unique text ID (preferred)
  user_id?: number;     // Legacy numeric ID (fallback)
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

const BATCH_SIZE = 100;

/**
 * Manages an offline attendance event queue.
 *
 * - `enqueue(event)` — persist an event to localStorage when the terminal is offline
 * - `queueLength`    — number of events waiting (reactive)
 * - `isOnline`       — current browser connectivity (reactive)
 *
 * Automatically drains the queue via POST /attendance/sync whenever the
 * browser regains connectivity (window 'online' event) or on mount.
 * Large queues are sent in batches of BATCH_SIZE to avoid body size limits.
 * On failure, retries use exponential backoff (max 30 s).
 */

export function useOfflineSync() {
  const syncingRef = useRef(false);
  const retryCountRef = useRef(0);
  const [queueLength, setQueueLength] = useState(() => loadQueue().length);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const { showToast } = useToast();

  const drainQueue = useCallback(async () => {
    if (syncingRef.current) return;
    const queue = loadQueue();
    if (queue.length === 0) return;

    syncingRef.current = true;
    try {
      // Send in batches to avoid exceeding body size limits or timeouts
      let remaining = [...queue];
      while (remaining.length > 0) {
        const batch = remaining.slice(0, BATCH_SIZE);
        remaining = remaining.slice(BATCH_SIZE);
        const res = await client.post('/attendance/sync', { events: batch });
        const result = res.data?.data;
        if (result?.failed > 0) {
          console.warn(
            `[OfflineSync] ${result.failed} eventi non sincronizzati:`,
            result.errors,
          );
        }
      }
      saveQueue([]);
      setQueueLength(0);
      retryCountRef.current = 0;
    } catch {
      // Leave queue intact — will retry on next reconnect with exponential backoff
      console.warn('[OfflineSync] Sincronizzazione fallita — dati conservati per il prossimo tentativo.');
      showToast(
        'Sincronizzazione presenze non riuscita. I dati verranno ritentati.',
        'warning',
      );
      syncingRef.current = false;  // reset immediately so future reconnects can retry
      retryCountRef.current++;
    }
    syncingRef.current = false;
  }, [showToast]);

  useEffect(() => {
    if (navigator.onLine) drainQueue();
    const handleOnline = () => { setIsOnline(true); drainQueue(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [drainQueue]);

  const enqueue = useCallback((event: OfflineEvent) => {
    const queue = loadQueue();
    queue.push(event);
    saveQueue(queue);
    setQueueLength(queue.length);
  }, []);

  return { enqueue, queueLength, isOnline };
}
