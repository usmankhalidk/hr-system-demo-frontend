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

export async function getEmailConfig(): Promise<EmailConfigResponse> {
  const res = await apiClient.get('/email/config');
  return res.data.data;
}

export async function saveEmailConfig(config: SmtpConfig): Promise<void> {
  await apiClient.put('/email/config', config);
}
