import axios from 'axios';

// In production (Vercel), set VITE_API_URL to your Railway backend URL.
// Must include protocol: https://xxxx.up.railway.app (NOT just xxxx.up.railway.app)
// In development, Vite's proxy forwards /api → localhost:3001.
let apiBase = import.meta.env.VITE_API_URL || '';
// Defensive: auto-add https:// if the value was set without a protocol
if (apiBase && !apiBase.startsWith('http://') && !apiBase.startsWith('https://')) {
  apiBase = `https://${apiBase}`;
}
const BASE_URL = apiBase ? `${apiBase}/api` : '/api';

/** Absolute API base URL — usable in feed URLs shared with external services. */
export function getApiBaseUrl(): string {
  return apiBase ? `${apiBase}/api` : `${window.location.origin}/api`;
}

// ── Key transformers ──────────────────────────────────────────────────────────

function toCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function toSnake(s: string): string {
  return s.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function camelizeKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(camelizeKeys);
  }
  if (obj !== null && typeof obj === 'object' && !(obj instanceof File) && !(obj instanceof Blob)) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [toCamel(k), camelizeKeys(v)])
    );
  }
  return obj;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function snakeKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(snakeKeys);
  }
  if (
    obj !== null && typeof obj === 'object' &&
    !(obj instanceof File) &&
    !(obj instanceof Blob) &&
    !(obj instanceof FormData)
  ) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [toSnake(k), snakeKeys(v)])
    );
  }
  return obj;
}

// ── Axios instance ────────────────────────────────────────────────────────────

const client = axios.create({ baseURL: BASE_URL });

// Request: convert camelCase body + params → snake_case + Add language headers
client.interceptors.request.use((config) => {
  // Add language headers
  const lang = localStorage.getItem('hr_lang') || 'it';
  config.headers['x-lang'] = lang;
  config.headers['Accept-Language'] = lang === 'it' ? 'it-IT,it;q=0.9' : 'en-US,en;q=0.9';

  if (config.data !== undefined && config.data !== null) {
    config.data = snakeKeys(config.data);
  }
  if (config.params !== undefined && config.params !== null) {
    config.params = snakeKeys(config.params);
  }
  return config;
});

// Response: convert snake_case keys → camelCase
client.interceptors.response.use(
  (res) => {
    if (res.data !== undefined && res.data !== null) {
      res.data = camelizeKeys(res.data);
    }
    return res;
  },
  (err) => Promise.reject(err)
);

const TOKEN_KEY = 'hr_token';

/**
 * Returns an authenticated URL for a user avatar file.
 * Uses a ?token= query param so that <img> tags (which can't set headers) work.
 * Works in dev (relative URL via Vite proxy) and production (absolute Railway URL).
 */
export function getAvatarUrl(filename: string | null | undefined): string | null {
  if (!filename) return null;
  const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
  const base = apiBase; // '' in dev (uses Vite proxy), full URL in prod
  return `${base}/uploads/avatars/${filename}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

export function getCompanyLogoUrl(filename: string | null | undefined): string | null {
  if (!filename) return null;
  const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
  const base = apiBase;
  return `${base}/uploads/company-logos/${filename}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

export function getCompanyBannerUrl(filename: string | null | undefined): string | null {
  if (!filename) return null;
  const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
  const base = apiBase;
  return `${base}/uploads/company-banners/${filename}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

export function getStoreLogoUrl(filename: string | null | undefined): string | null {
  if (!filename) return null;
  const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
  const base = apiBase;
  return `${base}/uploads/store-logos/${filename}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

export function getPublicAvatarUrl(filename: string | null | undefined): string | null {
  if (!filename) return null;
  const base = apiBase;
  return `${base}/uploads/public-avatars/${filename}`;
}

export function getPublicStoreLogoUrl(filename: string | null | undefined): string | null {
  if (!filename) return null;
  const base = apiBase;
  return `${base}/uploads/public-store-logos/${filename}`;
}

export function getResumeUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
  const base = apiBase;
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${base}/${cleanPath}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

export default client;
