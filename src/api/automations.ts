import api from './client';

export const automationsApi = {
  getAutomations: async () => {
    const response = await api.get('/automations');
    return response.data;
  },
  
  updateAutomation: async (id: string, isEnabled: boolean) => {
    const response = await api.put(`/automations/${id}`, { isEnabled });
    return response.data;
  }
};
