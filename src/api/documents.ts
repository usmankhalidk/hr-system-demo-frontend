import apiClient from './client';

export interface DocumentCategory {
  id: number;
  companyId: number;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface EmployeeDocument {
  id: number;
  companyId: number;
  employeeId: number;
  categoryId: number | null;
  fileName: string;
  mimeType: string | null;
  requiresSignature: boolean;
  signedAt: string | null;
  signedByUserId: number | null;
  expiresAt: string | null;
  isVisibleToRoles: string[];
  deletedAt: string | null;
  uploadedByUserId: number;
  createdAt: string;
  updatedAt: string;
  categoryName?: string | null;
}

export interface BulkUploadResult {
  uploadId: number;
  totalFiles: number;
  matchedFiles: number;
  unmatchedFiles: number;
  unmatchedFileNames: string[];
}

export async function getMyDocuments(): Promise<EmployeeDocument[]> {
  const { data } = await apiClient.get('/documents/my');
  return data.data as EmployeeDocument[];
}

export async function getCategories(includeInactive = false): Promise<DocumentCategory[]> {
  const { data } = await apiClient.get('/documents/categories', {
    params: includeInactive ? { includeInactive: true } : undefined,
  });
  return data.data as DocumentCategory[];
}

export async function createCategory(name: string, companyId: number): Promise<DocumentCategory> {
  const { data } = await apiClient.post('/documents/categories', { name, company_id: companyId });
  return data.data as DocumentCategory;
}

export async function updateCategory(id: number, payload: { name?: string; isActive?: boolean; companyId: number; currentCompanyId: number }): Promise<DocumentCategory> {
  const { data } = await apiClient.patch(`/documents/categories/${id}`, {
    name: payload.name,
    is_active: payload.isActive,
    company_id: payload.companyId,
    current_company_id: payload.currentCompanyId,
  });
  return data.data as DocumentCategory;
}

export async function getEmployeeDocuments(employeeId: number): Promise<EmployeeDocument[]> {
  const { data } = await apiClient.get(`/documents/employee/${employeeId}`);
  return data.data as EmployeeDocument[];
}

export async function uploadDocument(
  employeeId: number,
  file: File,
  options?: {
    categoryId?: number | null;
    requiresSignature?: boolean;
    expiresAt?: string | null;
    visibleToRoles?: string[];
  },
): Promise<{ id: number; fileName: string }> {
  const formData = new FormData();
  formData.append('file', file);
  if (options?.categoryId != null) formData.append('category_id', String(options.categoryId));
  if (options?.requiresSignature) formData.append('requires_signature', 'true');
  if (options?.expiresAt) formData.append('expires_at', options.expiresAt);
  if (options?.visibleToRoles) formData.append('visible_to_roles', JSON.stringify(options.visibleToRoles));

  const { data } = await apiClient.post(`/documents/employee/${employeeId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data as { id: number; fileName: string };
}

export async function downloadDocument(id: number, fileName: string): Promise<void> {
  const response = await apiClient.get(`/documents/${id}/download`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function deleteDocument(id: number): Promise<void> {
  await apiClient.delete(`/documents/${id}`);
}

export async function updateDocumentVisibility(id: number, roles: string[]): Promise<void> {
  await apiClient.patch(`/documents/${id}/visibility`, { roles });
}

export async function signDocument(id: number, lang?: string): Promise<EmployeeDocument> {
  const { data } = await apiClient.post(`/documents/${id}/sign`, {}, {
    headers: lang ? { 'x-lang': lang } : undefined
  });
  return data.data as EmployeeDocument;
}

export async function bulkUploadDocuments(file: File): Promise<BulkUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post('/documents/bulk-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data as BulkUploadResult;
}

export interface AutomationSetting {
  jobKey: string;
  enabled: boolean;
}

export async function getAutomationSettings(): Promise<AutomationSetting[]> {
  const { data } = await apiClient.get('/notifications/automation-settings');
  return data.data.settings as AutomationSetting[];
}

export async function updateAutomationSetting(jobKey: string, enabled: boolean): Promise<void> {
  await apiClient.patch(`/notifications/automation-settings/${jobKey}`, { enabled });
}

export interface NotificationSetting {
  id: number;
  companyId: number;
  eventKey: string;
  enabled: boolean;
  roles: string[];
}

export async function getNotificationSettings(): Promise<NotificationSetting[]> {
  const { data } = await apiClient.get('/notifications/settings');
  return data.data.settings as NotificationSetting[];
}

export async function updateNotificationSetting(eventKey: string, enabled: boolean, roles?: string[]): Promise<NotificationSetting> {
  const { data } = await apiClient.patch(`/notifications/settings/${eventKey}`, { enabled, roles });
  return data.data.setting as NotificationSetting;
}

// --- Step 1 & 2 Unified Upload ---

export async function uploadDocumentUnified(
  file: File,
  options?: {
    categoryId?: number | null;
    requiresSignature?: boolean;
    expiresAt?: string | null;
    visibleToRoles?: string[];
  }
): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  if (options?.categoryId != null) formData.append('category_id', String(options.categoryId));
  if (options?.requiresSignature) formData.append('requires_signature', 'true');
  if (options?.expiresAt) formData.append('expires_at', options.expiresAt);
  if (options?.visibleToRoles) formData.append('visible_to_roles', JSON.stringify(options.visibleToRoles));

  const { data } = await apiClient.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}


export async function updateDocumentGeneric(id: number, payload: { title: string; employee_id: number | null }): Promise<void> {
  await apiClient.put(`/documents/${id}`, payload);
}

export async function getDocumentsGeneric(): Promise<any[]> {
  const { data } = await apiClient.get('/documents');
  return data.data;
}

export async function downloadDocumentGeneric(id: number, filename: string): Promise<void> {
  const response = await apiClient.get(`/documents/${id}/download`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
}
