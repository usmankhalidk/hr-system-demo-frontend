import client from './client';

export const STORE_ACTIVITY_TYPES = [
  'window_display',
  'campaign_launch',
  'visual_merchandising',
  'promo_setup',
  'event_activation',
  'seasonal_changeover',
  'pop_up_corner',
  'store_cleaning',
  'deep_cleaning',
  'maintenance_repair',
  'decoration_renovation',
  'layout_change',
  'store_reset',
  'product_restock',
  'inventory_count',
  'price_update',
  'audit_inspection',
  'staff_training',
  'custom_activity',
] as const;

export type StoreActivityType = (typeof STORE_ACTIVITY_TYPES)[number];
export const CUSTOM_ACTIVITY_TYPE: StoreActivityType = 'custom_activity';

export interface WindowDisplayActivity {
  id: number;
  companyId: number;
  storeId: number;
  storeName?: string | null;
  date: string;
  yearMonth: string;
  flaggedBy: number;
  activityType: StoreActivityType;
  activityIcon: string | null;
  customActivityName: string | null;
  durationHours: number | null;
  notes: string | null;
  flaggedByName?: string | null;
  flaggedBySurname?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getWindowDisplay(storeId: number, month: string): Promise<WindowDisplayActivity | null> {
  const res = await client.get('/window-display', {
    params: { storeId, month },
  });
  return (res.data.data ?? null) as WindowDisplayActivity | null;
}

export async function listWindowDisplayActivities(month: string, storeId?: number, companyId?: number): Promise<WindowDisplayActivity[]> {
  const res = await client.get('/window-display', {
    params: {
      month,
      ...(storeId ? { storeId } : {}),
      ...(companyId ? { companyId } : {}),
    },
  });

  const payload = res.data.data;
  if (Array.isArray(payload)) return payload as WindowDisplayActivity[];
  if (payload) return [payload as WindowDisplayActivity];
  return [];
}

export async function createWindowDisplay(payload: {
  storeId: number;
  date: string;
  activityType?: StoreActivityType;
  activityIcon?: string | null;
  customActivityName?: string | null;
  durationHours?: number | null;
  notes?: string | null;
  companyId?: number | null;
}): Promise<WindowDisplayActivity> {
  const res = await client.post('/window-display', {
    storeId: payload.storeId,
    date: payload.date,
    activityType: payload.activityType,
    activityIcon: payload.activityIcon,
    customActivityName: payload.customActivityName,
    durationHours: payload.durationHours,
    notes: payload.notes,
    companyId: payload.companyId,
  });
  return res.data.data as WindowDisplayActivity;
}

export async function updateWindowDisplay(
  id: number,
  payload: {
    date?: string;
    activityType?: StoreActivityType;
    activityIcon?: string | null;
    customActivityName?: string | null;
    durationHours?: number | null;
    notes?: string | null;
    companyId?: number | null;
  },
): Promise<WindowDisplayActivity> {
  const res = await client.put(`/window-display/${id}`, {
    date: payload.date,
    activityType: payload.activityType,
    activityIcon: payload.activityIcon,
    customActivityName: payload.customActivityName,
    durationHours: payload.durationHours,
    notes: payload.notes,
    companyId: payload.companyId,
  });
  return res.data.data as WindowDisplayActivity;
}

export async function deleteWindowDisplay(id: number, companyId?: number): Promise<void> {
  await client.delete(`/window-display/${id}`, {
    params: companyId ? { companyId } : undefined,
  });
}
