import client from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Shift {
  id: number;
  companyId: number;
  storeId: number;
  userId: number;
  assignmentId?: number | null;
  timezone?: string | null;
  date: string;          // may be 'YYYY-MM-DD' or full ISO — use .split('T')[0] to normalize
  startTime: string;     // 'HH:MM:SS'
  endTime: string;       // 'HH:MM:SS'
  startAtUtc?: string | null;
  endAtUtc?: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  breakStartAtUtc?: string | null;
  breakEndAtUtc?: string | null;
  breakType: 'fixed' | 'flexible';
  breakMinutes: number | null;
  isSplit: boolean;
  splitStart2: string | null;
  splitEnd2: string | null;
  splitStart2AtUtc?: string | null;
  splitEnd2AtUtc?: string | null;
  isOffDay: boolean;
  status: 'scheduled' | 'confirmed' | 'cancelled';
  notes: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  storeName: string;
  userName: string;
  userSurname: string;
  userAvatarFilename?: string | null;
  shiftHours: string | number | null;
}

function normalizeDateOnly(value: string): string {
  if (!value) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.split('T')[0];
  }
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function formatUtcToLocalParts(isoValue: string, timeZone: string): { date: string; time: string } | null {
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(parsed);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;
  const second = parts.find((part) => part.type === 'second')?.value;

  if (!year || !month || !day || !hour || !minute || !second) return null;

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}:${second}`,
  };
}

function convertShiftUtcToLocal(shift: Shift): Shift {
  if (!shift.startAtUtc || !shift.endAtUtc) {
    return shift;
  }

  const tz = getBrowserTimeZone();
  const startLocal = formatUtcToLocalParts(shift.startAtUtc, tz);
  const endLocal = formatUtcToLocalParts(shift.endAtUtc, tz);
  if (!startLocal || !endLocal) {
    return shift;
  }

  const breakStartLocal = shift.breakStartAtUtc
    ? formatUtcToLocalParts(shift.breakStartAtUtc, tz)?.time ?? shift.breakStart
    : shift.breakStart;
  const breakEndLocal = shift.breakEndAtUtc
    ? formatUtcToLocalParts(shift.breakEndAtUtc, tz)?.time ?? shift.breakEnd
    : shift.breakEnd;
  const splitStart2Local = shift.splitStart2AtUtc
    ? formatUtcToLocalParts(shift.splitStart2AtUtc, tz)?.time ?? shift.splitStart2
    : shift.splitStart2;
  const splitEnd2Local = shift.splitEnd2AtUtc
    ? formatUtcToLocalParts(shift.splitEnd2AtUtc, tz)?.time ?? shift.splitEnd2
    : shift.splitEnd2;

  return {
    ...shift,
    date: startLocal.date,
    startTime: startLocal.time,
    endTime: endLocal.time,
    breakStart: breakStartLocal,
    breakEnd: breakEndLocal,
    splitStart2: splitStart2Local,
    splitEnd2: splitEnd2Local,
  };
}

function normalizeShift(shift: Shift): Shift {
  const localized = convertShiftUtcToLocal(shift);
  return {
    ...shift,
    ...localized,
    date: normalizeDateOnly(localized.date),
  };
}

export interface ShiftTemplate {
  id: number;
  companyId: number;
  storeId: number;
  storeName?: string;
  companyName?: string;
  name: string;
  templateData: Record<string, unknown>;
  createdBy: number | null;
  createdAt: string;
}

export interface StoreAffluence {
  id: number;
  companyId: number;
  storeId: number;
  isoWeek: number | null;
  dayOfWeek: number;
  timeSlot: string;
  level: 'low' | 'medium' | 'high';
  requiredStaff: number;
  scheduledStaff?: number;
}

export interface CreateShiftPayload {
  user_id: number;
  store_id: number;
  date: string;
  timezone?: string;
  start_time: string;
  end_time: string;
  break_type?: 'fixed' | 'flexible';
  break_start?: string | null;
  break_end?: string | null;
  break_minutes?: number | null;
  is_split?: boolean;
  split_start2?: string | null;
  split_end2?: string | null;
  is_off_day?: boolean;
  notes?: string | null;
  status?: 'scheduled' | 'confirmed' | 'cancelled';
}

export type UpdateShiftPayload = Partial<CreateShiftPayload>;

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function listShifts(params: {
  week?: string;
  month?: string;
  store_id?: number;
  user_id?: number;
}): Promise<{ shifts: Shift[] }> {
  const res = await client.get('/shifts', {
    params: {
      ...params,
      timezone: getBrowserTimeZone(),
    },
  });
  return {
    ...res.data.data,
    shifts: (res.data.data.shifts as Shift[]).map(normalizeShift),
  };
}

export async function createShift(payload: CreateShiftPayload): Promise<Shift> {
  const res = await client.post('/shifts', {
    ...payload,
    timezone: payload.timezone ?? getBrowserTimeZone(),
  });
  return normalizeShift(res.data.data as Shift);
}

export async function updateShift(id: number, payload: UpdateShiftPayload): Promise<Shift> {
  const res = await client.put(`/shifts/${id}`, {
    ...payload,
    timezone: payload.timezone ?? getBrowserTimeZone(),
  });
  return normalizeShift(res.data.data as Shift);
}

export async function deleteShift(id: number): Promise<void> {
  await client.delete(`/shifts/${id}`);
}

export async function copyWeek(payload: {
  store_id: number;
  source_week: string;
  target_week: string;
}): Promise<{ copied: number; shifts: Shift[] }> {
  const res = await client.post('/shifts/copy-week', payload);
  return {
    ...res.data.data,
    shifts: (res.data.data.shifts as Shift[]).map(normalizeShift),
  };
}

/** Confirm all scheduled shifts for an employee in the given ISO week (admin / hr / area_manager). */
export async function approveWeekForEmployee(payload: {
  user_id: number;
  week: string;
  store_id?: number | null;
}): Promise<{ updated: number }> {
  const res = await client.post('/shifts/approve-week', payload);
  return res.data.data;
}

export async function listTemplates(store_id?: number): Promise<{ templates: ShiftTemplate[] }> {
  const res = await client.get('/shifts/templates', { params: store_id ? { store_id } : {} });
  return res.data.data;
}

export async function createTemplate(payload: {
  store_id: number;
  name: string;
  template_data: Record<string, unknown>;
}): Promise<ShiftTemplate> {
  const res = await client.post('/shifts/templates', payload);
  return res.data.data;
}

export async function updateTemplate(id: number, payload: {
  store_id: number;
  name: string;
  template_data: Record<string, unknown>;
}): Promise<ShiftTemplate> {
  const res = await client.put(`/shifts/templates/${id}`, payload);
  return res.data.data;
}

export async function deleteTemplate(id: number): Promise<void> {
  await client.delete(`/shifts/templates/${id}`);
}

export async function exportShifts(params: { store_id?: number; week?: string; format?: 'csv' | 'xlsx' }): Promise<Blob> {
  const res = await client.get('/shifts/export', {
    params,
    responseType: 'blob',
  });
  return res.data as Blob;
}

export async function downloadImportTemplate(): Promise<Blob> {
  const res = await client.get('/shifts/import-template', { responseType: 'blob' });
  return res.data as Blob;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
  total: number;
}

export async function importShifts(file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('timezone', getBrowserTimeZone());
  const res = await client.post('/shifts/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data as ImportResult;
}

export async function getAffluence(params: {
  store_id?: number;
  week?: string;
  day_of_week?: number;
  raw?: 1;
}): Promise<{ affluence: StoreAffluence[] }> {
  const res = await client.get('/shifts/affluence', { params });
  return res.data.data;
}

export async function createAffluence(data: {
  store_id: number;
  day_of_week: number;
  time_slot: string;
  level: 'low' | 'medium' | 'high';
  required_staff: number;
  iso_week?: number | null;
}): Promise<{ affluence: StoreAffluence }> {
  const res = await client.post('/shifts/affluence', data);
  return res.data.data;
}

export async function updateAffluence(
  id: number,
  data: { level: 'low' | 'medium' | 'high'; required_staff: number },
): Promise<{ affluence: StoreAffluence }> {
  const res = await client.put(`/shifts/affluence/${id}`, data);
  return res.data.data;
}

export async function deleteAffluence(id: number): Promise<void> {
  await client.delete(`/shifts/affluence/${id}`);
}
