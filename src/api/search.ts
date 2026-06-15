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

export interface GlobalSearchResults {
  companies: CompanySearchResult[];
  employees: EmployeeSearchResult[];
  candidates: CandidateSearchResult[];
  jobs: JobSearchResult[];
}

export async function searchGlobal(q: string, module: string = 'all'): Promise<GlobalSearchResults> {
  const { data } = await apiClient.get('/search', { params: { q, module } });
  return data.data;
}
