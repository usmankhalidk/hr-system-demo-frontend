import { UAParser } from 'ua-parser-js';

export type DeviceFingerprintResult = {
  // Hex-encoded fingerprint (stable for the same device profile).
  fingerprint: string;
  // Raw metadata used to build the fingerprint (stored in DB as JSONB).
  metadata: Record<string, any>;
};

const DEVICE_TOKEN_KEY = 'veylohr_device_token';
const DEVICE_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 5;

function readLocalDeviceToken(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(DEVICE_TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

function writeLocalDeviceToken(token: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEVICE_TOKEN_KEY, token);
    }
  } catch {
    // Some iOS browser contexts can deny storage access; the cookie mirror is the fallback.
  }
}

function readCookieDeviceToken(): string | null {
  if (typeof document === 'undefined') return null;
  const cookie = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${DEVICE_TOKEN_KEY}=`));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(DEVICE_TOKEN_KEY.length + 1));
  } catch {
    return null;
  }
}

function writeCookieDeviceToken(token: string): void {
  if (typeof document === 'undefined') return;
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${DEVICE_TOKEN_KEY}=${encodeURIComponent(token)}; Max-Age=${DEVICE_TOKEN_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

function fnv1aHex(input: string, seed: number): string {
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

async function sha256Hex(input: string): Promise<string> {
  // Prefer WebCrypto when available
  if (typeof window !== 'undefined' && window.crypto?.subtle && typeof TextEncoder !== 'undefined') {
    const enc = new TextEncoder().encode(input);
    const buf = await window.crypto.subtle.digest('SHA-256', enc);
    const arr = Array.from(new Uint8Array(buf));
    return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback: stable non-crypto hash.
  return fnv1aHex(input, 1) + fnv1aHex(input, 7) + fnv1aHex(input, 13) + fnv1aHex(input, 29);
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getDeviceFingerprint(): Promise<DeviceFingerprintResult> {
  const nav = typeof navigator !== 'undefined' ? navigator : ({} as any);

  let token = readLocalDeviceToken() || readCookieDeviceToken();
  if (!token) {
    token = generateUUID();
  }
  writeLocalDeviceToken(token);
  writeCookieDeviceToken(token);

  const fingerprint = await sha256Hex(token);

  let model: string | null = null;
  let platform: string | null = null;
  let platformVersion: string | null = null;

  if (nav.userAgentData && typeof nav.userAgentData.getHighEntropyValues === 'function') {
    try {
      const hints = await nav.userAgentData.getHighEntropyValues(['model', 'platform', 'platformVersion']);
      model = hints.model || null;
      platform = hints.platform || null;
      platformVersion = hints.platformVersion || null;
    } catch (e) {
      console.warn('Failed to retrieve high entropy values:', e);
    }
  }

  const ua = nav.userAgent || '';
  const parser = new UAParser(ua);
  const uaResult = parser.getResult();

  const metadata = {
    userAgent: ua,
    browser: {
      name: uaResult.browser.name || null,
      version: uaResult.browser.version || null,
    },
    os: {
      name: platform || uaResult.os.name || null,
      version: platformVersion || uaResult.os.version || null,
    },
    device: {
      model: model || uaResult.device.model || null,
      vendor: uaResult.device.vendor || null,
      type: uaResult.device.type || null,
    },
    language: nav.language || null,
    platform: nav.platform || platform || null,
    vendor: nav.vendor || null,
    hardwareConcurrency: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    deviceMemory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    maxTouchPoints: typeof nav.maxTouchPoints === 'number' ? nav.maxTouchPoints : null,
    timezone: (() => {
      try {
        return new Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        return null;
      }
    })(),
    screen: typeof window !== 'undefined' && window.screen ? {
      width: window.screen.width || null,
      height: window.screen.height || null,
      colorDepth: window.screen.colorDepth || null,
      pixelRatio: typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : null,
    } : null,
  };

  return { fingerprint, metadata };
}
