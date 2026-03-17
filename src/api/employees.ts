import apiClient from './client';
import { Employee, PaginatedResponse } from '../types';

export interface EmployeeListParams {
  search?: string;
  store_id?: number;
  department?: string;
  status?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export async function getEmployees(params?: EmployeeListParams): Promise<PaginatedResponse<Employee>> {
  const { data } = await apiClient.get('/employees', { params });
  return data.data;
}

export async function getEmployee(id: number): Promise<Employee> {
  const { data } = await apiClient.get(`/employees/${id}`);
  return data.data;
}

export async function createEmployee(payload: Partial<Employee> & { email: string; name: string; surname: string; role: string; password?: string }): Promise<Employee> {
  const { data } = await apiClient.post('/employees', payload);
  return data.data;
}

export async function updateEmployee(id: number, payload: Partial<Employee>): Promise<Employee> {
  const { data } = await apiClient.put(`/employees/${id}`, payload);
  return data.data;
}

export async function deactivateEmployee(id: number): Promise<Employee> {
  const { data } = await apiClient.delete(`/employees/${id}`);
  return data.data;
}

export async function activateEmployee(id: number): Promise<Employee> {
  const { data } = await apiClient.patch(`/employees/${id}/activate`);
  return data.data;
}
