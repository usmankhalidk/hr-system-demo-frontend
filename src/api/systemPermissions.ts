import apiClient from './client';

export interface CompanyGrid {
  // Axios client camelizes response keys from backend:
  // - area_manager -> areaManager
  // - store_manager -> storeManager
  // - store_terminal -> storeTerminal
  turni: { hr: boolean; areaManager: boolean; storeManager: boolean; employee: boolean; storeTerminal: boolean };
  permessi: { hr: boolean; areaManager: boolean; storeManager: boolean; employee: boolean; storeTerminal: boolean };
  presenze: { hr: boolean; areaManager: boolean; storeManager: boolean; employee: boolean; storeTerminal: boolean };
  negozi: { hr: boolean; areaManager: boolean; storeManager: boolean; employee: boolean; storeTerminal: boolean };
  dipendenti: { hr: boolean; areaManager: boolean; storeManager: boolean; employee: boolean; storeTerminal: boolean };
}

export interface CompanyPermissions {
  id: number;
  name: string;
  grid: CompanyGrid;
}

export async function getCompaniesPermissions(): Promise<{ companies: CompanyPermissions[] }> {
  const { data } = await apiClient.get('/permissions/companies');
  return data.data;
}

export interface SystemPermissionUpdate {
  role: 'hr' | 'area_manager' | 'store_manager' | 'employee' | 'store_terminal';
  module: 'turni' | 'permessi' | 'presenze' | 'negozi' | 'dipendenti';
  enabled: boolean;
}

export async function updateCompanyPermissions(
  companyId: number,
  updates: SystemPermissionUpdate[]
): Promise<void> {
  await apiClient.put(`/permissions/companies/${companyId}`, { updates });
}
