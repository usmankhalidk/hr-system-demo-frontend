import apiClient from './client';

export interface DeviceStatusResponse {
  isDeviceRegistered: boolean;
  deviceResetPending: boolean;
  requiresDeviceRegistration: boolean;
}

export interface RegisterDevicePayload {
  fingerprint: string;
  metadata?: Record<string, unknown>;
}

export async function getDeviceStatus(): Promise<DeviceStatusResponse> {
  const { data } = await apiClient.get('/device/status');
  return data.data as DeviceStatusResponse;
}

export async function registerDevice(payload: RegisterDevicePayload): Promise<DeviceStatusResponse> {
  const { data } = await apiClient.post('/device/register', payload);
  return data.data as DeviceStatusResponse;
}

