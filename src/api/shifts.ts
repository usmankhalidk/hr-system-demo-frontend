import client from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Shift {
  id: number;
  company_id: number;
  store_id: number;
  user_id: number;
  date: string;          // 'YYYY-MM-DD'
  start_time: string;    // 'HH:MM'
  end_time: string;      // 'HH:MM'
  break_start: string | null;
  break_end: string | null;
  is_split: boolean;
  split_start2: string | null;
  split_end2: string | null;
  status: 'scheduled' | 'confirmed' | 'cancelled';
  notes: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  store_name: string;
  user_name: string;
  user_surname: string;
  shift_hours: number;
}

export interface ShiftTemplate {
  id: number;
  company_id: number;
  store_id: number;
  name: string;
  template_data: Record<string, unknown>;
  created_by: number | null;
  created_at: string;
}

export interface StoreAffluence {
  id: number;
  company_id: number;
  store_id: number;
  iso_week: number | null;
  day_of_week: number;
  time_slot: string;
  level: 'low' | 'medium' | 'high';
  required_staff: number;
}

export interface CreateShiftPayload {
  user_id: number;
  store_id: number;
  date: string;
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
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
  return res.data.data;
}

export async function createShift(payload: CreateShiftPayload): Promise<Shift> {
  const res = await client.post('/shifts', payload);
  return res.data.data;
}

export async function updateShift(id: number, payload: UpdateShiftPayload): Promise<Shift> {
  const res = await client.put(`/shifts/${id}`, payload);
  return res.data.data;
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

export async function deleteTemplate(id: number): Promise<void> {
  await client.delete(`/shifts/templates/${id}`);
}

export async function exportShifts(params: { store_id?: number; week?: string }): Promise<Blob> {
  const res = await client.get('/shifts/export', {
    params,
    responseType: 'blob',
  });
  return res.data as Blob;
}

export async function getAffluence(params: {
  store_id?: number;
  week?: string;
  day_of_week?: number;
}): Promise<{ affluence: StoreAffluence[] }> {
  const res = await client.get('/shifts/affluence', { params });
  return res.data.data;
}
