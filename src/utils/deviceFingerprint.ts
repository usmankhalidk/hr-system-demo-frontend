import { UAParser } from 'ua-parser-js';

export type DeviceFingerprintResult = {
  // Deterministic fingerprint built from stable device/browser characteristics.
  fingerprint: string;
  // Raw metadata used to build the fingerprint (stored in DB as JSONB).
  metadata: Record<string, any>;
};

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

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

async function computeDeviceProfileHash(metadata: Record<string, any>): Promise<string> {
  const root = normalizeObject(metadata);
  const browser = normalizeObject(root.browser);
  const os = normalizeObject(root.os);
  const device = normalizeObject(root.device);
  const screen = normalizeObject(root.screen);

  const profile = {
    userAgent: normalizeText(root.userAgent),
    browserName: normalizeText(browser.name),
    browserVersion: normalizeText(browser.version),
    osName: normalizeText(os.name),
    osVersion: normalizeText(os.version),
    deviceModel: normalizeText(device.model),
    deviceVendor: normalizeText(device.vendor),
    deviceType: normalizeText(device.type),
    language: normalizeText(root.language),
    timezone: normalizeText(root.timezone),
    platform: normalizeText(root.platform),
    vendor: normalizeText(root.vendor),
    hardwareConcurrency: normalizeNumber(root.hardwareConcurrency),
    deviceMemory: normalizeNumber(root.deviceMemory),
    maxTouchPoints: normalizeNumber(root.maxTouchPoints),
    screenWidth: normalizeNumber(screen.width),
    screenHeight: normalizeNumber(screen.height),
    screenColorDepth: normalizeNumber(screen.colorDepth),
    screenPixelRatio: normalizeNumber(screen.pixelRatio),
  };

  return sha256Hex(JSON.stringify(profile));
}

export async function getDeviceFingerprint(): Promise<DeviceFingerprintResult> {
  const nav = typeof navigator !== 'undefined' ? navigator : ({} as any);

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

  const profileHash = await computeDeviceProfileHash(metadata);
  const stableMetadata = {
    ...metadata,
    stableDevice: {
      source: 'web-profile-v1',
      hash: profileHash,
    },
  };

  return {
    fingerprint: `web-profile-v1:${profileHash}`,
    metadata: stableMetadata,
  };
}
