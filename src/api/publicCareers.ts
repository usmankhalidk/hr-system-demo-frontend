import apiClient from './client';
import { JobLanguage, JobType, RemoteType } from './ats';

export interface PublicCompany {
  id: number;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  country: string | null;
  address: string | null;
  groupName?: string | null;
  logoFilename?: string | null;
  bannerFilename?: string | null;
  ownerUserId?: number | null;
  ownerName?: string | null;
  ownerSurname?: string | null;
  ownerAvatarFilename?: string | null;
  openRolesCount?: number;
}

export interface PublicHiringContact {
  id: number;
  name: string;
  surname: string | null;
  role: string;
  avatarFilename: string | null;
  storeId: number | null;
  storeName: string | null;
}

export interface PublicStoreOption {
  id: number;
  companyId: number;
  name: string;
}

export interface PublicJob {
  id: number;
  companyId: number;
  companyName: string;
  companySlug: string;
  storeId: number | null;
  storeName: string | null;
  title: string;
  description: string | null;
  tags: string[];
  language: JobLanguage;
  jobType: JobType;
  department: string | null;
  weeklyHours: number | null;
  contractType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  isRemote: boolean;
  remoteType: RemoteType;
  jobCity: string | null;
  jobState: string | null;
  jobCountry: string | null;
  jobPostalCode: string | null;
  jobAddress: string | null;
  publishedAt: string | null;
  createdAt: string;
  companyGroupName?: string | null;
  companyLogoFilename?: string | null;
  companyBannerFilename?: string | null;
  storeCode?: string | null;
  storeLogoFilename?: string | null;
  storeEmployeeCount?: number | null;
  postedBy?: PublicHiringContact | null;
  location: {
    address: string | null;
    postalCode: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  };
}

export async function getPublicCompany(companySlug: string): Promise<PublicCompany> {
  const { data } = await apiClient.get(`/public/companies/${companySlug}`);
  return data.data.company as PublicCompany;
}

export async function getPublicJobsCatalog(): Promise<{ jobs: PublicJob[]; companies: PublicCompany[]; stores: PublicStoreOption[]; tags: string[] }> {
  const { data } = await apiClient.get('/public/jobs');
  return {
    jobs: (data.data.jobs ?? []) as PublicJob[],
    companies: (data.data.companies ?? []) as PublicCompany[],
    stores: (data.data.stores ?? []) as PublicStoreOption[],
    tags: (data.data.tags ?? []) as string[],
  };
}

export async function getPublicJobDetail(jobId: number): Promise<{ company: PublicCompany; job: PublicJob; hiringTeam: PublicHiringContact[] }> {
  const { data } = await apiClient.get(`/public/jobs/${jobId}`);
  return {
    company: data.data.company as PublicCompany,
    job: data.data.job as PublicJob,
    hiringTeam: (data.data.hiringTeam ?? []) as PublicHiringContact[],
  };
}

export async function applyToPublicJob(params: {
  jobId: number;
  fullName: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  coverLetter?: string;
  resume: File;
  gdprConsent: boolean;
  applicantLocale?: string;
  utmSource?: string;
}): Promise<void> {
  const formData = new FormData();
  formData.append('full_name', params.fullName);
  formData.append('email', params.email);
  if (params.phone) formData.append('phone', params.phone);
  if (params.linkedinUrl) formData.append('linkedin_url', params.linkedinUrl);
  if (params.coverLetter) formData.append('cover_letter', params.coverLetter);
  if (params.applicantLocale) formData.append('applicant_locale', params.applicantLocale);
  formData.append('gdpr_consent', params.gdprConsent ? 'true' : 'false');
  formData.append('resume', params.resume);

  await apiClient.post(`/public/jobs/${params.jobId}/apply`, formData, {
    params: {
      utm_source: params.utmSource ?? 'direct',
    },
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}
