/**
 * A lightweight utility to manage an offline attendance queue in IndexedDB.
 */

const DB_NAME = 'hr_offline_db';
const STORE_NAME = 'attendance_events';
const DB_VERSION = 1;

export interface OfflineAttendanceEvent {
  id?: number;          // Managed by IndexedDB (autoIncrement)
  client_uuid: string;  // Unique ID for deduplication
  event_type: 'checkin' | 'checkout' | 'break_start' | 'break_end';
  event_time: string;   // ISO timestamp captured at client side
  qr_token?: string;    // The QR token scanned
  notes?: string;
  user_id?: number;
  unique_id?: string;
  device_fingerprint?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

export async function addOfflineEvent(event: OfflineAttendanceEvent): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(event);

    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineEvents(): Promise<OfflineAttendanceEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineEvents(ids: number[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    ids.forEach(id => store.delete(id));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
