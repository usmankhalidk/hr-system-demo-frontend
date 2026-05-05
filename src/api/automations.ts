import api from './client';

export const automationsApi = {
  getAutomations: async (companyId?: number) => {
    const response = await api.get('/automations', { params: { companyId } });
    return response.data.data;
  },
  
  updateAutomation: async (id: string, isEnabled: boolean, companyId?: number) => {
    const response = await api.put(`/automations/${id}`, { isEnabled, companyId });
    return response.data.data;
  }
};
