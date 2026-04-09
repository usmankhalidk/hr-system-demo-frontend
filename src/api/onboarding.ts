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
  category: 'hr_docs' | 'it_setup' | 'training' | 'meeting' | 'other';
  dueDays: number | null;
  linkUrl: string | null;
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingTask {
  id: number;
  employeeId: number;
  templateId: number;
  templateName: string;
  templateDescription: string | null;
  templateCategory: 'hr_docs' | 'it_setup' | 'training' | 'meeting' | 'other';
  templateLinkUrl: string | null;
  templatePriority: 'high' | 'medium' | 'low';
  completed: boolean;
  completedAt: string | null;
  completionNote: string | null;
  dueDate: string | null;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingProgress {
  total: number;
  completed: number;
  percentage: number;
  tasks: OnboardingTask[];
}

export interface EmployeeOnboardingOverview {
  employeeId: number;
  name: string;
  surname: string;
  email: string;
  storeName: string | null;
  avatarFilename: string | null;
  total: number;
  completed: number;
  percentage: number;
  hasTasksAssigned: boolean;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function getTemplates(includeInactive = false): Promise<OnboardingTemplate[]> {
  const { data } = await apiClient.get('/onboarding/templates', {
    params: includeInactive ? { include_inactive: true } : undefined,
  });
  return data.data.templates as OnboardingTemplate[];
}

export async function createTemplate(payload: {
  name: string;
  description?: string;
  sortOrder?: number;
  category?: OnboardingTemplate['category'];
  dueDays?: number | null;
  linkUrl?: string | null;
  priority?: OnboardingTemplate['priority'];
}): Promise<OnboardingTemplate> {
  const { data } = await apiClient.post('/onboarding/templates', {
    name: payload.name,
    description: payload.description ?? null,
    sort_order: payload.sortOrder ?? 0,
    category: payload.category ?? 'other',
    due_days: payload.dueDays ?? null,
    link_url: payload.linkUrl ?? null,
    priority: payload.priority ?? 'medium',
  });
  return data.data.template as OnboardingTemplate;
}

export async function updateTemplate(
  id: number,
  payload: {
    name?: string;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
    category?: OnboardingTemplate['category'];
    dueDays?: number | null;
    linkUrl?: string | null;
    priority?: OnboardingTemplate['priority'];
  },
): Promise<OnboardingTemplate> {
  const body: Record<string, unknown> = {};
  if (payload.name !== undefined)        body.name = payload.name;
  if (payload.description !== undefined) body.description = payload.description;
  if (payload.sortOrder !== undefined)   body.sort_order = payload.sortOrder;
  if (payload.isActive !== undefined)    body.is_active = payload.isActive;
  if (payload.category !== undefined)    body.category = payload.category;
  if (payload.dueDays !== undefined)     body.due_days = payload.dueDays;
  if (payload.linkUrl !== undefined)     body.link_url = payload.linkUrl;
  if (payload.priority !== undefined)    body.priority = payload.priority;
  const { data } = await apiClient.patch(`/onboarding/templates/${id}`, body);
  return data.data.template as OnboardingTemplate;
}

export async function deleteTemplate(id: number): Promise<{ deleted: boolean; deactivated: boolean }> {
  const { data } = await apiClient.delete(`/onboarding/templates/${id}`);
  return data.data as { deleted: boolean; deactivated: boolean };
}

// ---------------------------------------------------------------------------
// Employee Tasks
// ---------------------------------------------------------------------------

export async function getEmployeeTasks(employeeId: number): Promise<OnboardingProgress> {
  const { data } = await apiClient.get(`/onboarding/employees/${employeeId}/tasks`);
  return data.data.progress as OnboardingProgress;
}

export async function assignTasks(
  employeeId: number,
  templateIds?: number[],
): Promise<{ assigned: number }> {
  const { data } = await apiClient.post(
    `/onboarding/employees/${employeeId}/tasks/assign`,
    templateIds ? { template_ids: templateIds } : {},
  );
  return data.data as { assigned: number };
}

export async function completeTask(taskId: number, note?: string): Promise<OnboardingTask> {
  const { data } = await apiClient.patch(
    `/onboarding/tasks/${taskId}/complete`,
    note ? { note } : {},
  );
  return data.data.task as OnboardingTask;
}

// ---------------------------------------------------------------------------
// Overview (admin)
// ---------------------------------------------------------------------------

export async function getOnboardingOverview(): Promise<EmployeeOnboardingOverview[]> {
  const { data } = await apiClient.get('/onboarding/overview');
  return data.data.overview as EmployeeOnboardingOverview[];
}

export interface OnboardingStats {
  totalEmployees: number;
  notStarted: number;
  inProgress: number;
  complete: number;
  avgPercentage: number;
}

export async function getOnboardingStats(): Promise<OnboardingStats> {
  const { data } = await apiClient.get('/onboarding/stats');
  return data.data.stats as OnboardingStats;
}

export async function uncompleteTask(taskId: number): Promise<OnboardingTask> {
  const { data } = await apiClient.patch(`/onboarding/tasks/${taskId}/uncomplete`);
  return data.data.task as OnboardingTask;
}

export async function bulkAssignAll(): Promise<{ employees: number; tasks: number }> {
  const { data } = await apiClient.post('/onboarding/bulk-assign');
  return data.data as { employees: number; tasks: number };
}

export async function sendReminder(employeeId: number): Promise<{ sent: boolean }> {
  const { data } = await apiClient.post(`/onboarding/employees/${employeeId}/remind`);
  return data.data as { sent: boolean };
}
