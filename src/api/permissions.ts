import apiClient from './client';
import { PermissionGrid } from '../types';

export async function getPermissions(): Promise<PermissionGrid> {
  const { data } = await apiClient.get('/permissions');
  return data.data;
}

export interface PermissionUpdate { role: string; module: string; enabled: boolean; }

export async function updatePermissions(updates: PermissionUpdate[]): Promise<void> {
  await apiClient.put('/permissions', { updates });
}
