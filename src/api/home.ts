import apiClient from './client';

export async function getHomeData(): Promise<any> {
  const { data } = await apiClient.get('/home');
  return data.data;
}
