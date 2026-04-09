import apiClient from './client';
import { UserRole } from '../types';

export interface Terminal {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  company_id: number;
  store_id: number;
  companyName: string;
  storeName: string;
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
