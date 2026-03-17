import apiClient from './client';
import { Company } from '../types';

export async function getCompanies(): Promise<Company[]> {
  const { data } = await apiClient.get('/companies');
  return data.data;
}

export async function updateCompany(id: number, payload: { name: string }): Promise<Company> {
  const { data } = await apiClient.put(`/companies/${id}`, payload);
  return data.data;
}
