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
  date: string;          // may be 'YYYY-MM-DD' or full ISO — use .split('T')[0] to normalize
  startTime: string;     // 'HH:MM:SS'
  endTime: string;       // 'HH:MM:SS'
  breakStart: string | null;
  breakEnd: string | null;
  breakType: 'fixed' | 'flexible';
  breakMinutes: number | null;
  isSplit: boolean;
  splitStart2: string | null;
  splitEnd2: string | null;
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

function normalizeShift(shift: Shift): Shift {
  return {
    ...shift,
    date: normalizeDateOnly(shift.date),
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
  start_time: string;
  end_time: string;
  break_type?: 'fixed' | 'flexible';
  break_start?: string | null;
  break_end?: string | null;
  break_minutes?: number | null;
  is_split?: boolean;
  split_start2?: string | null;
  split_end2?: string | null;
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
  const res = await client.get('/shifts', { params });
  return {
    ...res.data.data,
    shifts: (res.data.data.shifts as Shift[]).map(normalizeShift),
  };
}

export async function createShift(payload: CreateShiftPayload): Promise<Shift> {
  const res = await client.post('/shifts', payload);
  return normalizeShift(res.data.data as Shift);
}

export async function updateShift(id: number, payload: UpdateShiftPayload): Promise<Shift> {
  const res = await client.put(`/shifts/${id}`, payload);
  return normalizeShift(res.data.data as Shift);
}

export async function deleteShift(id: number): Promise<void> {
  await client.delete(`/shifts/${id}`);
}

export async function copyWeek(payload: {
  store_id: number;
  source_week: string;
  target_week: string;
}): Promise<{ copied: number; skippedOffDay?: number; shifts: Shift[] }> {
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
