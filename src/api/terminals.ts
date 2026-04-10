import apiClient from './client';
import { UserRole } from '../types';

export interface Terminal {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  companyId: number;
  storeId: number;
  companyName: string;
  storeName: string;
  plainPassword?: string;
}

export interface ListTerminalsResponse {
  success: boolean;
  data: {
    data: Terminal[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export interface TerminalFilters {
  search?: string;
  status?: string;
  company_id?: string;
  store_id?: string;
  page?: number;
  limit?: number;
}

export const getTerminals = async (filters: TerminalFilters = {}): Promise<ListTerminalsResponse> => {
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.status) params.append('status', filters.status);
  if (filters.company_id) params.append('company_id', filters.company_id);
  if (filters.store_id) params.append('store_id', filters.store_id);
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());

  const response = await apiClient.get<ListTerminalsResponse>(`terminals?${params.toString()}`);
  return response.data;
};

export interface StoreTerminalStatus {
  id: number;
  name: string;
  code: string;
  address: string;
  cap: string;
  maxStaff: number;
  companyId: number;
  companyName: string;
  hasTerminal: boolean;
}

export const getStoresWithTerminalStatus = async (): Promise<StoreTerminalStatus[]> => {
  const response = await apiClient.get<{ success: boolean; data: StoreTerminalStatus[] }>('terminals/stores-status');
  return response.data.data;
};

export interface CreateTerminalPayload {
  storeId: number;
  email: string;
  password: string;
}

export const createTerminal = async (payload: CreateTerminalPayload): Promise<{ success: boolean; data: any }> => {
  const response = await apiClient.post('terminals', payload);
  return response.data;
};

export const updateTerminal = async (id: number, payload: { password?: string }): Promise<{ success: boolean; data: any }> => {
  const response = await apiClient.patch(`terminals/${id}`, payload);
  return response.data;
};

export const deleteTerminal = async (id: number): Promise<{ success: boolean; data: any }> => {
  const response = await apiClient.delete(`terminals/${id}`);
  return response.data;
};
