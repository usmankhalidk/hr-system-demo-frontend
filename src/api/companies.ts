import apiClient from './client';
import { Company } from '../types';

export async function getCompanies(): Promise<Company[]> {
  const { data } = await apiClient.get('/companies');
  return data.data;
}

export async function updateCompany(id: number, payload: { name: string; groupId?: number | null }): Promise<Company> {
  const { data } = await apiClient.put(`/companies/${id}`, payload);
  return data.data;
}

export async function createCompany(payload: { name: string; groupId?: number | null }): Promise<Company> {
  const { data } = await apiClient.post('/companies', payload);
  return data.data;
}

export async function deactivateCompany(id: number): Promise<Company> {
  const { data } = await apiClient.patch(`/companies/${id}/deactivate`);
  return data.data;
}

export async function activateCompany(id: number): Promise<Company> {
  const { data } = await apiClient.patch(`/companies/${id}/activate`);
  return data.data;
}

export async function deleteCompanyPermanent(id: number): Promise<{ id: number }> {
  const { data } = await apiClient.delete(`/companies/${id}`);
  return data.data;
}
