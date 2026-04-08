import apiClient from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingTemplate {
  id: number;
  companyId: number;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingTask {
  id: number;
  employeeId: number;
  templateId: number;
  templateName: string;
  templateDescription: string | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingProgress {
  total: number;
  completed: number;
  percentage: number;
  tasks: OnboardingTask[];
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function getTemplates(includeInactive = false): Promise<OnboardingTemplate[]> {
  const { data } = await apiClient.get('/onboarding/templates', {
    params: includeInactive ? { include_inactive: 'true' } : undefined,
  });
  return (data.data.templates ?? []) as OnboardingTemplate[];
}

export async function createTemplate(payload: {
  name: string;
  description?: string;
  sortOrder?: number;
}): Promise<OnboardingTemplate> {
  const { data } = await apiClient.post('/onboarding/templates', payload);
  return data.data.template as OnboardingTemplate;
}

export async function updateTemplate(
  id: number,
  payload: { name?: string; description?: string; sortOrder?: number; isActive?: boolean },
): Promise<OnboardingTemplate> {
  const { data } = await apiClient.patch(`/onboarding/templates/${id}`, payload);
  return data.data.template as OnboardingTemplate;
}

export async function getEmployeeTasks(employeeId: number): Promise<OnboardingProgress> {
  const { data } = await apiClient.get(`/onboarding/employees/${employeeId}/tasks`);
  return data.data.progress as OnboardingProgress;
}

export async function assignTasks(employeeId: number): Promise<{ assigned: number }> {
  const { data } = await apiClient.post(`/onboarding/employees/${employeeId}/tasks/assign`);
  return data.data as { assigned: number };
}

export async function completeTask(taskId: number): Promise<OnboardingTask> {
  const { data } = await apiClient.patch(`/onboarding/tasks/${taskId}/complete`);
  return data.data.task as OnboardingTask;
}
