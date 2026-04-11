import { useEffect, useRef, useCallback, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

export interface OfflineEvent {
  event_type: 'checkin' | 'checkout' | 'break_start' | 'break_end';
  unique_id?: string;
  user_id?: number;
  event_time: string;
  notes?: string;
  /** Internal idempotency key — never sent to the server. */
  _clientId?: string;
}

const QUEUE_KEY = 'hr_offline_queue';
const BATCH_SIZE = 100;
/** Drop events older than 24 h — the backend rejects them anyway. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 30_000;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadQueue(): OfflineEvent[] {
  try {
    const raw: OfflineEvent[] = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    // Backfill _clientId for events stored before this field existed
    let patched = false;
    const queue = raw.map((e) => {
      if (!e._clientId) { patched = true; return { ...e, _clientId: generateId() }; }
      return e;
    });
    if (patched) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return queue;
  } catch {
    return [];
  }
}

function saveQueue(q: OfflineEvent[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

/**
 * Offline attendance-event queue with auto-sync on reconnect.
 * Batches events (BATCH_SIZE), removes synced batches immediately,
 * and retries with exponential backoff (capped at 30 s).
 */
export function useOfflineSync() {
  const syncingRef    = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [queueLength, setQueueLength] = useState(() => loadQueue().length);
  const [isOnline,    setIsOnline]    = useState(() => navigator.onLine);
  const [isSyncing,   setIsSyncing]   = useState(false);
  const { showToast } = useToast();

  const drainQueue = useCallback(async () => {
    if (syncingRef.current) return;

    const fresh = loadQueue().filter((e) => {
      const t = new Date(e.event_time).getTime();
      return !isNaN(t) && Date.now() - t < MAX_AGE_MS;
    });
    saveQueue(fresh);
    setQueueLength(fresh.length);

    if (fresh.length === 0) return;

    syncingRef.current = true;
    setIsSyncing(true);

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    const syncedIds = new Set<string>();
    let   hadError  = false;

    try {
      for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
        const batch = fresh.slice(i, i + BATCH_SIZE);

        const payload = batch.map(({ _clientId: _id, ...ev }) => ev);
        const res = await client.post('/attendance/sync', { events: payload });

        const result = res.data?.data;
        if (result?.failed > 0) {
          console.warn(`[OfflineSync] ${result.failed} eventi non sincronizzati:`, result.errors);
        }

        batch.forEach((e) => { if (e._clientId) syncedIds.add(e._clientId); });
        const afterBatch = loadQueue().filter((e) => !e._clientId || !syncedIds.has(e._clientId));
        saveQueue(afterBatch);
        setQueueLength(afterBatch.length);
      }

      retryCountRef.current = 0;
    } catch {
      hadError = true;
    } finally {
      if (hadError) {
        console.warn('[OfflineSync] Sincronizzazione fallita — dati conservati per il prossimo tentativo.');
        showToast('Sincronizzazione presenze non riuscita. I dati verranno ritentati.', 'warning');

        const delay = Math.min(2 ** retryCountRef.current * 1000, MAX_RETRY_DELAY_MS);
        retryCountRef.current += 1;

        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          if (navigator.onLine) drainQueue();
        }, delay);
      }

      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (navigator.onLine) drainQueue();

    const handleOnline = () => {
      setIsOnline(true);
      retryCountRef.current = 0;
      drainQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [drainQueue]);

  const enqueue = useCallback((event: OfflineEvent) => {
    const queue = loadQueue();
    queue.push({ ...event, _clientId: generateId() });
    saveQueue(queue);
    setQueueLength(queue.length);
  }, []);

  return { enqueue, queueLength, isOnline, isSyncing };
}
