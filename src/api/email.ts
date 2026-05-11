import apiClient from './client';

export interface SmtpConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
}

export interface EmailConfigResponse {
  superAdmin: boolean;
  company?: {
    id: number;
    name: string;
  };
  config?: SmtpConfig;
}

export async function getEmailConfig(companyId?: number): Promise<EmailConfigResponse> {
  const params: Record<string, any> = {};
  if (companyId) params.company_id = companyId;
  const res = await apiClient.get('/email/config', { params });
  return res.data.data;
}

export async function saveEmailConfig(config: SmtpConfig, companyId?: number): Promise<void> {
  const payload = companyId ? { ...config, companyId } : config;
  await apiClient.put('/email/config', payload);
}

export async function verifyEmailConfig(companyId?: number): Promise<boolean> {
  const payload = companyId ? { companyId } : {};
  const res = await apiClient.post('/email/verify', payload);
  return res.data.data.success;
}

