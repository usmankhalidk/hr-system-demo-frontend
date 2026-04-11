import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mock the axios client ─────────────────────────────────────────────────────
const mockPost = vi.fn();

vi.mock('../api/client', () => ({
  default: {
    post: (...args: any[]) => mockPost(...args),
    interceptors: {
      request:  { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  },
}));

import { useOfflineSync } from '../hooks/useOfflineSync';
import { ToastProvider } from '../context/ToastContext';

const QUEUE_KEY = 'hr_offline_queue';

// ─────────────────────────────────────────────────────────────────────────────

describe('useOfflineSync', () => {
  beforeEach(() => {
    localStorage.clear();
    mockPost.mockReset();
    vi.useFakeTimers();
    // Default: online
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  // ── Enqueue ─────────────────────────────────────────────────────────────────

  it('enqueue() persists an event to localStorage with a _clientId', () => {
    const { result } = renderHook(() => useOfflineSync(), { wrapper: ToastProvider });

    act(() => {
      result.current.enqueue({
        event_type: 'checkin',
        unique_id:  'EMP001',
        event_time: '2024-01-01T09:00:00.000Z',
      });
    });

    const stored = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ event_type: 'checkin', unique_id: 'EMP001' });
    expect(typeof stored[0]._clientId).toBe('string');
    expect(stored[0]._clientId.length).toBeGreaterThan(0);
  });

  it('queueLength updates reactively after enqueue()', () => {
    const { result } = renderHook(() => useOfflineSync(), { wrapper: ToastProvider });

    expect(result.current.queueLength).toBe(0);

    act(() => {
      result.current.enqueue({ event_type: 'checkin',  unique_id: 'EMP001', event_time: new Date().toISOString() });
    });
    expect(result.current.queueLength).toBe(1);

    act(() => {
      result.current.enqueue({ event_type: 'checkout', unique_id: 'EMP001', event_time: new Date().toISOString() });
    });
    expect(result.current.queueLength).toBe(2);
  });

  // ── Online / offline detection ───────────────────────────────────────────────

  it('isOnline reflects navigator.onLine initial state (true)', () => {
    const { result } = renderHook(() => useOfflineSync(), { wrapper: ToastProvider });
    expect(result.current.isOnline).toBe(true);
  });

  it('isOnline is false when navigator.onLine starts as false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    const { result } = renderHook(() => useOfflineSync(), { wrapper: ToastProvider });
    expect(result.current.isOnline).toBe(false);
  });

  // ── Sync behaviour ───────────────────────────────────────────────────────────

  it('does NOT send _clientId to the server', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    mockPost.mockResolvedValueOnce({ data: { data: { synced: 1, failed: 0, errors: [] } } });

    const { result } = renderHook(() => useOfflineSync(), { wrapper: ToastProvider });

    act(() => {
      result.current.enqueue({ event_type: 'checkin', unique_id: 'EMP001', event_time: new Date().toISOString() });
    });

    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [, payload] = mockPost.mock.calls[0];
    expect(payload.events[0]).not.toHaveProperty('_clientId');
  });

  it('calls POST /attendance/sync and clears queue when window "online" event fires', async () => {
    // Start offline so drainQueue isn't called on mount
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    mockPost.mockResolvedValueOnce({ data: { data: { synced: 1, failed: 0, errors: [] } } });

    const { result } = renderHook(() => useOfflineSync(), { wrapper: ToastProvider });

    act(() => {
      result.current.enqueue({ event_type: 'checkin', unique_id: 'EMP001', event_time: new Date().toISOString() });
    });
    expect(result.current.queueLength).toBe(1);

    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/attendance/sync',
      expect.objectContaining({ events: expect.any(Array) }),
    );
    expect(result.current.queueLength).toBe(0);
    expect(JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')).toHaveLength(0);
  });

  it('preserves queue if sync POST fails', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    mockPost.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useOfflineSync(), { wrapper: ToastProvider });

    act(() => {
      result.current.enqueue({ event_type: 'checkin', unique_id: 'EMP999', event_time: new Date().toISOString() });
    });
    expect(result.current.queueLength).toBe(1);

    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
      await Promise.resolve();
    });

    // Queue must still be intact
    const stored = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    expect(stored).toHaveLength(1);
  });

  it('isSyncing is true during sync and false after', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });

    let resolvePost!: (v: unknown) => void;
    mockPost.mockReturnValueOnce(new Promise((res) => { resolvePost = res; }));

    const { result } = renderHook(() => useOfflineSync(), { wrapper: ToastProvider });

    act(() => {
      result.current.enqueue({ event_type: 'checkin', unique_id: 'EMP001', event_time: new Date().toISOString() });
    });

    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });

    // Kick off the sync (don't await yet)
    act(() => { window.dispatchEvent(new Event('online')); });

    // Wait one microtask so the async function starts
    await act(async () => { await Promise.resolve(); });

    expect(result.current.isSyncing).toBe(true);

    // Now resolve the post
    await act(async () => {
      resolvePost({ data: { data: { synced: 1, failed: 0, errors: [] } } });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.isSyncing).toBe(false);
  });

  it('uses exponential backoff for retries', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    mockPost
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce({ data: { data: { synced: 1, failed: 0, errors: [] } } });

    const { result } = renderHook(() => useOfflineSync(), { wrapper: ToastProvider });
    act(() => {
      result.current.enqueue({ event_type: 'checkin', unique_id: 'EMP001', event_time: new Date().toISOString() });
    });

    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });

    // First attempt — fails → schedules retry after 1 s
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve(); await Promise.resolve();
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(result.current.queueLength).toBe(1); // still queued

    // Advance 1 s → second attempt fires (fails → schedules retry after 2 s)
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve(); await Promise.resolve();
    });
    expect(mockPost).toHaveBeenCalledTimes(2);

    // Advance 2 s → third attempt fires (succeeds)
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve(); await Promise.resolve();
    });
    expect(mockPost).toHaveBeenCalledTimes(3);
    expect(result.current.queueLength).toBe(0);
  });

  it('prunes events older than 24 h before syncing', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });

    // Seed localStorage with a stale event (25 h ago)
    const staleTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(QUEUE_KEY, JSON.stringify([
      { event_type: 'checkin', unique_id: 'EMP001', event_time: staleTime, _clientId: 'stale-1' },
    ]));

    mockPost.mockResolvedValue({ data: { data: { synced: 0, failed: 0, errors: [] } } });

    renderHook(() => useOfflineSync(), { wrapper: ToastProvider });

    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve(); await Promise.resolve();
    });

    // Stale event should have been pruned — nothing sent to server
    expect(mockPost).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')).toHaveLength(0);
  });
});
