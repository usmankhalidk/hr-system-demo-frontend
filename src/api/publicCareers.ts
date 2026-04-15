import apiClient from './client';
import { JobLanguage, JobType, RemoteType } from './ats';

export type PublicJobStatus = 'draft' | 'published' | 'closed';

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
  status: PublicJobStatus;
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
  applicantsCount: number;
  postedBy?: PublicHiringContact | null;
  location: {
    address: string | null;
    postalCode: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  };
}

function buildCatalogFromJobs(jobs: PublicJob[], company?: PublicCompany): { companies: PublicCompany[]; stores: PublicStoreOption[]; tags: string[] } {
  const companyMap = new Map<number, PublicCompany>();
  const storesMap = new Map<number, PublicStoreOption>();
  const tagsSet = new Set<string>();

  if (company) {
    companyMap.set(company.id, company);
  }

  for (const job of jobs) {
    if (!companyMap.has(job.companyId)) {
      companyMap.set(job.companyId, {
        id: job.companyId,
        name: job.companyName,
        slug: job.companySlug,
        city: job.location.city,
        state: job.location.state,
        country: job.location.country,
        address: job.location.address,
        logoFilename: job.companyLogoFilename ?? null,
        bannerFilename: job.companyBannerFilename ?? null,
        openRolesCount: 0,
      });
    }

    if (job.storeId && job.storeName && !storesMap.has(job.storeId)) {
      storesMap.set(job.storeId, {
        id: job.storeId,
        companyId: job.companyId,
        name: job.storeName,
      });
    }

    for (const tag of job.tags) {
      const normalized = tag.trim();
      if (normalized) tagsSet.add(normalized);
    }
  }

  return {
    companies: Array.from(companyMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    stores: Array.from(storesMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    tags: Array.from(tagsSet.values()).sort((a, b) => a.localeCompare(b)),
  };
}

export async function getPublicCompany(companySlug: string): Promise<PublicCompany> {
  const { data } = await apiClient.get(`/public/companies/${companySlug}`);
  return data.data.company as PublicCompany;
}

export async function getPublicJobsCatalog(companySlug?: string): Promise<{ jobs: PublicJob[]; companies: PublicCompany[]; stores: PublicStoreOption[]; tags: string[] }> {
  if (companySlug && companySlug.trim() !== '') {
    const { data } = await apiClient.get(`/public/${encodeURIComponent(companySlug)}/jobs`);
    const jobs = (data.data.jobs ?? []) as PublicJob[];
    const company = (data.data.company ?? undefined) as PublicCompany | undefined;
    const derived = buildCatalogFromJobs(jobs, company);
    return {
      jobs,
      companies: derived.companies,
      stores: derived.stores,
      tags: derived.tags,
    };
  }

  const { data } = await apiClient.get('/public/jobs');
  const jobs = (data.data.jobs ?? []) as PublicJob[];
  const derived = buildCatalogFromJobs(jobs);
  return {
    jobs,
    companies: derived.companies,
    stores: derived.stores,
    tags: derived.tags,
  };
}

export async function getPublicJobDetail(jobId: number, companySlug?: string): Promise<{ company: PublicCompany; job: PublicJob; hiringTeam: PublicHiringContact[] }> {
  const endpoint = companySlug && companySlug.trim() !== ''
    ? `/public/${encodeURIComponent(companySlug)}/jobs/${jobId}`
    : `/public/jobs/${jobId}`;

  const { data } = await apiClient.get(endpoint);
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
