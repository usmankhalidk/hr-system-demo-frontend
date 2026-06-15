import apiClient from './client';

export interface CompanySearchResult {
  id: number;
  name: string;
  slug: string;
  logoFilename?: string;
}

export interface EmployeeSearchResult {
  id: number;
  name: string;
  surname: string;
  email: string;
  uniqueId: string;
  role: string;
  companyId: number;
  companyName: string;
}

export interface CandidateSearchResult {
  id: number;
  fullName: string;
  email?: string;
  phone?: string;
  status: string;
  companyId: number;
  companyName: string;
  jobTitle?: string;
}

export interface JobSearchResult {
  id: number;
  title: string;
  status: string;
  companyId: number;
  companyName: string;
}

export interface StoreSearchResult {
  id: number;
  name: string;
  code: string;
  address?: string;
  companyId: number;
  companyName: string;
  isActive: boolean;
}

export interface OnboardingSearchResult {
  id: number;
  name?: string; // templates
  description?: string; // templates
  category?: string; // templates
  taskType?: string; // templates
  priority?: string; // templates
  companyId: number;
  companyName: string;
  onboarding_type: 'template' | 'task';
  employee_id?: number; // tasks
  employee_name?: string; // tasks
  employee_surname?: string; // tasks
  employee_email?: string; // tasks
  employee_role?: string; // tasks
  total_tasks?: number; // tasks
  completed_tasks?: number; // tasks
}

export interface MessageSearchResult {
  id: number;
  subject: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  companyId: number;
  companyName: string;
  sender_id: number;
  sender_name: string;
  sender_surname: string;
  sender_role: string;
  recipient_id: number;
  recipient_name: string;
  recipient_surname: string;
  recipient_role: string;
}

export interface DocumentSearchResult {
  id: number;
  file_name: string;
  mime_type?: string;
  uploaded_at: string;
  requires_signature: boolean;
  signed_at?: string;
  category_name?: string;
  employee_name: string;
  employee_surname: string;
  employee_role: string;
  companyId: number;
  companyName: string;
}

export interface GlobalSearchResults {
  companies: CompanySearchResult[];
  employees: EmployeeSearchResult[];
  candidates: CandidateSearchResult[];
  jobs: JobSearchResult[];
  stores: StoreSearchResult[];
  onboarding: OnboardingSearchResult[];
  messages: MessageSearchResult[];
  documents: DocumentSearchResult[];
}

export async function searchGlobal(q: string, module: string = 'all', roleFilter?: string): Promise<GlobalSearchResults> {
  const { data } = await apiClient.get('/search', { params: { q, module, roleFilter } });
  return data.data;
}
