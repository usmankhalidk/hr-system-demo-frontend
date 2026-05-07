import apiClient from './client';

export interface ReportConfigData {
  reportId: string;
  day: number;
  time: string;
  recipients: string[];
  sections: string[];
  status: string;
  runCount?: number;
  lastGenerated?: string | null;
}

export interface ReportHistoryItem {
  id: number;
  reportId: string;
  generatedAt: string;
  sizeBytes: number;
  sections: string[];
  targetDate: string;
}

export async function getReportConfigurations(companyId?: number): Promise<ReportConfigData[]> {
  const params = companyId ? { company_id: companyId } : undefined;
  const { data } = await apiClient.get('/reports/configurations', { params });
  return data.data;
}

export async function saveReportConfiguration(
  reportId: string,
  config: { day?: number; time?: string; recipients?: string[]; sections?: string[]; status?: string },
  companyId?: number
): Promise<ReportConfigData> {
  const params = companyId ? { company_id: companyId } : undefined;
  const { data } = await apiClient.put(`/reports/configurations/${reportId}`, { ...config, company_id: companyId }, { params });
  return data.data;
}

export async function downloadLastReport(reportId: string, companyId?: number): Promise<Blob> {
  const params = companyId ? { company_id: companyId } : undefined;
  const { data } = await apiClient.get(`/reports/configurations/${reportId}/download-last`, {
    params,
    responseType: 'blob',
  });
  return data;
}

export async function getReportHistory(companyId?: number): Promise<ReportHistoryItem[]> {
  const params = companyId ? { company_id: companyId } : undefined;
  const { data } = await apiClient.get('/reports/history', { params });
  return data.data;
}

export async function downloadArchivedReport(id: number, companyId?: number): Promise<Blob> {
  const params = companyId ? { company_id: companyId } : undefined;
  const { data } = await apiClient.get(`/reports/history/${id}/download`, {
    params,
    responseType: 'blob',
  });
  return data;
}
