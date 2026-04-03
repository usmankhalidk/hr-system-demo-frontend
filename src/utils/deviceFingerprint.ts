export type DeviceFingerprintResult = {
  // Hex-encoded fingerprint (stable for the same device profile).
  fingerprint: string;
  // Raw metadata used to build the fingerprint (stored in DB as JSONB).
  metadata: Record<string, unknown>;
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

  // Fallback: stable non-crypto hash (enough for device binding demo).
  // Produces 4x32-bit = 32 hex chars (>= backend min length).
  return fnv1aHex(input, 1) + fnv1aHex(input, 7) + fnv1aHex(input, 13) + fnv1aHex(input, 29);
}

export async function getDeviceFingerprint(): Promise<DeviceFingerprintResult> {
  const nav = typeof navigator !== 'undefined' ? navigator : ({} as Navigator);
  const scr = typeof window !== 'undefined' ? window.screen : undefined;

  const metadata: Record<string, unknown> = {
    userAgent: nav.userAgent ?? null,
    platform: (nav as any).platform ?? null,
    language: nav.language ?? null,
    languages: (nav as any).languages ?? null,
    timezone: (() => {
      try {
        return new Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        return null;
      }
    })(),
    screen: scr
      ? {
          width: scr.width ?? null,
          height: scr.height ?? null,
          colorDepth: scr.colorDepth ?? null,
          availWidth: scr.availWidth ?? null,
          availHeight: scr.availHeight ?? null,
        }
      : null,
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio ?? null : null,
    hardwareConcurrency: (nav as any).hardwareConcurrency ?? null,
  };

  // Build a deterministic string with fixed key order.
  const canonical = JSON.stringify(metadata);
  const fingerprint = await sha256Hex(canonical);

  return { fingerprint, metadata };
}

