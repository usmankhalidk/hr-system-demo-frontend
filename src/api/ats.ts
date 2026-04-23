import apiClient from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JobStatus = 'draft' | 'published' | 'closed';
export type JobLanguage = 'it' | 'en' | 'both';
export type JobType = 'fulltime' | 'parttime' | 'contract' | 'internship';
export type RemoteType = 'onsite' | 'hybrid' | 'remote';
export type CandidateStatus = 'received' | 'review' | 'interview' | 'hired' | 'rejected';
export type RiskLevel = 'ok' | 'medium' | 'high';
export type AlertType = 'new_candidates' | 'interview_today' | 'candidates_pending' | 'job_at_risk';

export interface JobPosting {
  id: number;
  companyId: number;
  companySlug: string;
  companyName: string | null;
  companyLogoFilename: string | null;
  storeId: number | null;
  storeName: string | null;
  storeLogoFilename: string | null;
  location: string;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  address: string | null;
  isRemote: boolean;
  remoteType: RemoteType;
  jobCity: string | null;
  jobState: string | null;
  jobCountry: string | null;
  jobPostalCode: string | null;
  jobAddress: string | null;
  department: string | null;
  weeklyHours: number | null;
  contractType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  title: string;
  description: string | null;
  tags: string[];
  language: JobLanguage;
  jobType: JobType;
  status: JobStatus;
  source: string;
  indeedPostId: string | null;
  createdById: number | null;
  createdByName: string | null;
  createdBySurname: string | null;
  createdByRole: string | null;
  createdByAvatarFilename: string | null;
  createdByStoreName: string | null;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: number;
  companyId: number;
  storeId: number | null;
  jobPostingId: number | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  cvPath: string | null;
  tags: string[];
  status: CandidateStatus;
  source: string;
  sourceRef: string | null;
  resumePath: string | null;
  linkedinUrl: string | null;
  coverLetter: string | null;
  gdprConsent: boolean;
  applicantLocale: string | null;
  consentAcceptedAt: string | null;
  appliedAt: string | null;
  unread: boolean;
  lastStageChange: string;
  createdAt: string;
  updatedAt: string;
}

export interface Interview {
  id: number;
  candidateId: number;
  interviewerId: number | null;
  scheduledAt: string;
  location: string | null;
  notes: string | null;
  feedback: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HRAlert {
  type: AlertType;
  title: string;
  message: string;
  count: number;
  jobPostingId?: number;
  jobTitle?: string;
}

export interface JobRisk {
  jobPostingId: number;
  jobTitle: string;
  flags: { lowCandidates: boolean; noInterviews: boolean; noHires: boolean };
  riskLevel: RiskLevel;
}

// ---------------------------------------------------------------------------
// Job Postings
// ---------------------------------------------------------------------------

export async function getJobs(params?: { status?: string; companyId?: number }): Promise<JobPosting[]> {
  const { data } = await apiClient.get('/ats/jobs', { params });
  return (data.data.jobs ?? []) as JobPosting[];
}

export async function createJob(payload: {
  title: string;
  description?: string;
  tags?: string[];
  companyId?: number;
  status?: JobStatus;
  storeId?: number;
  language?: JobLanguage;
  jobType?: JobType;
  isRemote?: boolean;
  remoteType?: RemoteType;
  jobCity?: string;
  jobState?: string;
  jobCountry?: string;
  jobPostalCode?: string;
  jobAddress?: string;
  department?: string;
  weeklyHours?: number;
  contractType?: string;
  salaryMin?: number;
  salaryMax?: number;
}): Promise<JobPosting> {
  const { data } = await apiClient.post('/ats/jobs', payload);
  return data.data.job as JobPosting;
}

export async function updateJob(
  id: number,
  payload: Partial<{
    title: string;
    description: string;
    status: JobStatus;
    tags: string[];
    companyId: number;
    storeId: number | null;
    language: JobLanguage;
    jobType: JobType;
    isRemote: boolean;
    remoteType: RemoteType;
    jobCity: string | null;
    jobState: string | null;
    jobCountry: string | null;
    jobPostalCode: string | null;
    jobAddress: string | null;
    department: string | null;
    weeklyHours: number | null;
    contractType: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
  }>,
): Promise<JobPosting> {
  const { data } = await apiClient.patch(`/ats/jobs/${id}`, payload);
  return data.data.job as JobPosting;
}

export async function deleteJob(id: number, options?: { companyId?: number }): Promise<void> {
  await apiClient.delete(`/ats/jobs/${id}`, {
    params: options?.companyId ? { companyId: options.companyId } : undefined,
  });
}

export async function publishJob(id: number, options?: { companyId?: number }): Promise<JobPosting> {
  const { data } = await apiClient.post(`/ats/jobs/${id}/publish`, null, {
    params: options?.companyId ? { companyId: options.companyId } : undefined,
  });
  return data.data.job as JobPosting;
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

export async function getCandidates(params?: {
  status?: string;
  jobId?: number;
  companyId?: number;
}): Promise<Candidate[]> {
  const { data } = await apiClient.get('/ats/candidates', {
    params: {
      status: params?.status,
      job_id: params?.jobId,
      company_id: params?.companyId,
    },
  });
  return (data.data.candidates ?? []) as Candidate[];
}

export async function createCandidate(payload: {
  fullName: string;
  email?: string;
  phone?: string;
  jobPostingId?: number;
  storeId?: number;
  tags?: string[];
  cvPath?: string;
  resumePath?: string;
  resumeFile?: File | null;
  linkedinUrl?: string;
  coverLetter?: string;
  source?: string;
  sourceRef?: string;
  gdprConsent?: boolean;
  applicantLocale?: string;
  consentAcceptedAt?: string;
  appliedAt?: string;
}): Promise<Candidate> {
  if (payload.resumeFile) {
    const formData = new FormData();
    formData.append('full_name', payload.fullName);
    if (payload.email) formData.append('email', payload.email);
    if (payload.phone) formData.append('phone', payload.phone);
    if (payload.jobPostingId != null) formData.append('job_posting_id', String(payload.jobPostingId));
    if (payload.storeId != null) formData.append('store_id', String(payload.storeId));
    if (payload.tags?.length) formData.append('tags', JSON.stringify(payload.tags));
    if (payload.linkedinUrl) formData.append('linkedin_url', payload.linkedinUrl);
    if (payload.coverLetter) formData.append('cover_letter', payload.coverLetter);
    if (payload.source) formData.append('source', payload.source);
    if (payload.sourceRef) formData.append('source_ref', payload.sourceRef);
    if (payload.applicantLocale) formData.append('applicant_locale', payload.applicantLocale);
    if (payload.consentAcceptedAt) formData.append('consent_accepted_at', payload.consentAcceptedAt);
    if (payload.appliedAt) formData.append('applied_at', payload.appliedAt);
    formData.append('gdpr_consent', payload.gdprConsent ? 'true' : 'false');
    formData.append('resume', payload.resumeFile);
    const { data } = await apiClient.post('/ats/candidates', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data.candidate as Candidate;
  }

  const { data } = await apiClient.post('/ats/candidates', {
    full_name: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    job_posting_id: payload.jobPostingId,
    store_id: payload.storeId,
    tags: payload.tags,
    cv_path: payload.cvPath,
    resume_path: payload.resumePath,
    linkedin_url: payload.linkedinUrl,
    cover_letter: payload.coverLetter,
    source: payload.source,
    source_ref: payload.sourceRef,
    gdpr_consent: payload.gdprConsent,
    applicant_locale: payload.applicantLocale,
    consent_accepted_at: payload.consentAcceptedAt,
    applied_at: payload.appliedAt,
  });
  return data.data.candidate as Candidate;
}

export async function updateCandidateStage(
  id: number,
  status: CandidateStatus,
): Promise<Candidate> {
  const { data } = await apiClient.patch(`/ats/candidates/${id}`, { status });
  return data.data.candidate as Candidate;
}

export async function deleteCandidate(id: number): Promise<void> {
  await apiClient.delete(`/ats/candidates/${id}`);
}

// ---------------------------------------------------------------------------
// Interviews
// ---------------------------------------------------------------------------

export async function getInterviews(candidateId: number): Promise<Interview[]> {
  const { data } = await apiClient.get(`/ats/candidates/${candidateId}/interviews`);
  return (data.data.interviews ?? []) as Interview[];
}

export async function createInterview(
  candidateId: number,
  payload: { scheduledAt: string; location?: string; notes?: string },
): Promise<Interview> {
  const { data } = await apiClient.post(`/ats/candidates/${candidateId}/interviews`, payload);
  return data.data.interview as Interview;
}

export async function updateInterview(
  id: number,
  payload: { feedback?: string; notes?: string; scheduledAt?: string },
): Promise<Interview> {
  const { data } = await apiClient.patch(`/ats/interviews/${id}`, payload);
  return data.data.interview as Interview;
}

export async function deleteInterview(id: number): Promise<void> {
  await apiClient.delete(`/ats/interviews/${id}`);
}

// ---------------------------------------------------------------------------
// Alerts + Risks
// ---------------------------------------------------------------------------

export async function getAlerts(): Promise<HRAlert[]> {
  const { data } = await apiClient.get('/ats/alerts');
  return (data.data.alerts ?? []) as HRAlert[];
}

export async function getRisks(): Promise<JobRisk[]> {
  const { data } = await apiClient.get('/ats/risks');
  return (data.data.risks ?? []) as JobRisk[];
}

// ---------------------------------------------------------------------------
// Translation preview
// ---------------------------------------------------------------------------

export async function previewJobTranslation(payload: {
  text: string;
  sourceLanguage?: JobLanguage;
}): Promise<{ translatedText: string; targetLanguage: 'en'; provider: string }> {
  const { data } = await apiClient.post('/ats/translate-preview', payload);
  return data.data as { translatedText: string; targetLanguage: 'en'; provider: string };
}
