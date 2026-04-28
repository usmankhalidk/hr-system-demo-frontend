import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Clock3,
  Edit,
  Eye,
  FileText,
  Globe2,
  Heart,
  Languages,
  MapPin,
  Phone,
  Plus,
  Sparkles,
  Store as StoreIcon,
  Trash2,
  User2,
  Users,
  Wallet,
} from 'lucide-react';
import ReactCountryFlag from 'react-country-flag';
import { Country } from 'country-state-city';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { translateApiError } from '../../utils/apiErrors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import CustomSelect, { SelectOption } from '../../components/ui/CustomSelect';
import { CitySelect, CountrySelect, StateSelect } from '../../components/location';
import { getApiBaseUrl, getAvatarUrl, getCompanyLogoUrl, getStoreLogoUrl } from '../../api/client';
import { getStores } from '../../api/stores';
import { getCompanies } from '../../api/companies';
import { getEmployees } from '../../api/employees';
import { Company, Employee, Store } from '../../types';
import {
  getJobs, createJob, updateJob, deleteJob, publishJob,
  getCandidates, createCandidate, updateCandidateStage, deleteCandidate,
  getInterviews, createInterview, updateInterview,
  getAlerts, getRisks,
  previewJobTranslation,
  JobPosting, Candidate, Interview, HRAlert, JobRisk,
  CandidateStatus, JobStatus, JobLanguage, JobType, RemoteType,
} from '../../api/ats';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAGES: CandidateStatus[] = ['received', 'review', 'interview', 'hired', 'rejected'];

const NEXT_STAGE: Partial<Record<CandidateStatus, CandidateStatus>> = {
  received: 'review',
  review: 'interview',
  interview: 'hired',
};

const STAGE_COLOR: Record<CandidateStatus, string> = {
  received: '#0284C7',
  review: '#7C3AED',
  interview: '#C9973A',
  hired: '#15803D',
  rejected: '#DC2626',
};

const STAGE_BG: Record<CandidateStatus, string> = {
  received: 'rgba(2,132,199,0.08)',
  review: 'rgba(124,58,237,0.08)',
  interview: 'rgba(201,151,58,0.10)',
  hired: 'rgba(21,128,61,0.08)',
  rejected: 'rgba(220,38,38,0.07)',
};

const STATUS_COLOR: Record<JobStatus, string> = {
  draft: '#6B7280',
  published: '#15803D',
  closed: '#DC2626',
};

const JOB_TYPE_LABEL: Record<JobType, string> = {
  fulltime: 'fulltime',
  parttime: 'parttime',
  contract: 'contract',
  internship: 'internship',
};

const COUNTRY_ROWS = Country.getAllCountries();

function normalizeCountryCode(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const byName = COUNTRY_ROWS.find((country) => country.name.toLowerCase() === raw.toLowerCase());
  return byName?.isoCode ?? '';
}

function countryNameFromCode(value: string | null | undefined): string {
  const code = normalizeCountryCode(value);
  if (!code) return '-';
  const found = COUNTRY_ROWS.find((country) => country.isoCode === code);
  return found?.name ?? code;
}

type ComplianceCheck = {
  key: string;
  label: string;
  ok: boolean;
};

function getIndeedComplianceChecks(job: JobPosting): ComplianceCheck[] {
  const frontendBase = (import.meta.env.VITE_FRONTEND_URL || window.location.origin).replace(/\/+$/, '');
  const applyUrl = `${frontendBase}/careers/jobs/${job.id}`;
  const description = job.description ?? '';

  return [
    {
      key: 'title',
      label: 'Title present and under 100 chars',
      ok: job.title.trim().length > 0 && job.title.trim().length <= 100,
    },
    {
      key: 'description',
      label: 'Description present and over 150 chars',
      ok: description.trim().length > 150,
    },
    {
      key: 'entities',
      label: 'Description has no escaped HTML entities',
      ok: !/&lt;|&gt;|&amp;/i.test(description),
    },
    {
      key: 'location',
      label: 'Location fields present or role is remote',
      ok: job.isRemote || (!!job.city && !!job.state && !!job.country && !!job.postalCode),
    },
    {
      key: 'type',
      label: 'Job type is mapped',
      ok: ['fulltime', 'parttime', 'contract', 'internship'].includes(job.jobType),
    },
    {
      key: 'reference',
      label: 'Reference number format JOB-{id}',
      ok: /^JOB-\d+$/.test(`JOB-${job.id}`),
    },
    {
      key: 'status',
      label: 'Job status is published',
      ok: job.status === 'published',
    },
    {
      key: 'language',
      label: 'Language field is set',
      ok: Boolean(job.language),
    },
    {
      key: 'url',
      label: 'Apply URL points to frontend',
      ok: !/railway\.app/i.test(applyUrl) && /https?:\/\//i.test(applyUrl),
    },
    {
      key: 'privacy',
      label: 'Description excludes salary/personal-data requests',
      ok: !/codice fiscale|partita iva|carta d['’]identità|salary|stipendio/i.test(description),
    },
  ];
}

function complianceScore(job: JobPosting): { passed: number; total: number; percentage: number; checks: ComplianceCheck[] } {
  const checks = getIndeedComplianceChecks(job);
  const passed = checks.filter((check) => check.ok).length;
  const total = checks.length;
  const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
  return { passed, total, percentage, checks };
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtRelativeTime(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '-';

  const diffMs = parsed.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  let value: number;
  let unit: Intl.RelativeTimeFormatUnit;

  if (absMs < minute) {
    value = Math.round(diffMs / 1000);
    unit = 'second';
  } else if (absMs < hour) {
    value = Math.round(diffMs / minute);
    unit = 'minute';
  } else if (absMs < day) {
    value = Math.round(diffMs / hour);
    unit = 'hour';
  } else if (absMs < week) {
    value = Math.round(diffMs / day);
    unit = 'day';
  } else if (absMs < month) {
    value = Math.round(diffMs / week);
    unit = 'week';
  } else if (absMs < year) {
    value = Math.round(diffMs / month);
    unit = 'month';
  } else {
    value = Math.round(diffMs / year);
    unit = 'year';
  }

  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(value, unit);
}

function languageFlagCodes(language: JobLanguage): string[] {
  if (language === 'en') return ['GB'];
  if (language === 'both') return ['IT', 'GB'];
  return ['IT'];
}

function formatEuroRange(min: number | null, max: number | null, locale: string, fallback: string): string {
  if (min === null && max === null) return fallback;
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
  const from = min === null ? '...' : formatter.format(min);
  const to = max === null ? '...' : formatter.format(max);
  return `${from} - ${to}`;
}

// ─── Shared modal backdrop ─────────────────────────────────────────────────────

const ModalBackdrop: React.FC<{ onClose: () => void; width?: number; closeOnBackdropClick?: boolean; children: React.ReactNode }> = ({
  onClose, width = 520, closeOnBackdropClick = true, children,
}) =>
  createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(13,33,55,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={closeOnBackdropClick ? onClose : undefined}
    >
      <div
        style={{
          background: 'var(--surface)', borderRadius: 16,
          width: '100%', maxWidth: width, maxHeight: '92vh', overflowY: 'auto',
          boxShadow: '0 24px 72px rgba(0,0,0,0.22)',
          animation: 'popIn 0.22s cubic-bezier(0.16,1,0.3,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );

// ─── Job form modal ────────────────────────────────────────────────────────────

interface JobModalProps {
  job?: JobPosting | null;
  stores: Store[];
  companies: Company[];
  defaultCompanyId: number | null;
  onSave: (payload: {
    title: string;
    description: string;
    tags: string[];
    language: JobLanguage;
    jobType: JobType;
    remoteType: RemoteType;
    locationOverride: {
      city: string;
      state: string;
      country: string;
      postalCode: string;
      address: string;
    };
    companyId: number;
    storeId: number | null;
    department: string;
    weeklyHours: number | null;
    contractType: string;
    status: JobStatus;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryPeriod: string | null;
    targetRole: string | null;
  }) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

type JobModalErrors = {
  title?: string;
  description?: string;
  city?: string;
  country?: string;
  weeklyHours?: string;
  salary?: string;
  companyId?: string;
  jobType?: string;
  remoteType?: string;
};

type TeamContact = {
  id: number;
  name: string;
  role: 'admin' | 'hr' | 'area_manager';
  avatarFilename?: string | null;
};

const JobModal: React.FC<JobModalProps> = ({ job, stores, companies, defaultCompanyId, onSave, onClose, saving }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isMobile, isTablet } = useBreakpoint();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState(job?.title ?? '');
  const [description, setDescription] = useState(job?.description ?? '');
  const [tags, setTags] = useState<string[]>(job?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [language, setLanguage] = useState<JobLanguage>(job?.language ?? 'it');
  const [jobType, setJobType] = useState<JobType | ''>(job?.jobType ?? '');
  const [status, setStatus] = useState<JobStatus>(job?.status ?? 'draft');
  const [companyId, setCompanyId] = useState<string>(() => {
    if (job?.companyId) return String(job.companyId);
    return '';
  });
  const [storeId, setStoreId] = useState<string>(job?.storeId ? String(job.storeId) : '');
  const [remoteType, setRemoteType] = useState<RemoteType | ''>(job?.remoteType ?? (job?.isRemote ? 'remote' : ''));
  const [locationOverride, setLocationOverride] = useState(() => ({
    country: normalizeCountryCode(job?.jobCountry ?? ''),
    state: job?.jobState ?? '',
    city: job?.jobCity ?? '',
    postalCode: job?.jobPostalCode ?? '',
    address: job?.jobAddress ?? '',
  }));
  const [department, setDepartment] = useState(job?.department ?? '');
  const [weeklyHoursInput, setWeeklyHoursInput] = useState(job?.weeklyHours !== null && job?.weeklyHours !== undefined ? String(job.weeklyHours) : '');
  const [salaryMinInput, setSalaryMinInput] = useState(job?.salaryMin !== null && job?.salaryMin !== undefined ? String(job.salaryMin) : '');
  const [salaryMaxInput, setSalaryMaxInput] = useState(job?.salaryMax !== null && job?.salaryMax !== undefined ? String(job.salaryMax) : '');
  const [salaryPeriod, setSalaryPeriod] = useState(job?.salaryPeriod ?? '');
  const [contractType, setContractType] = useState(job?.contractType ?? '');
  const [targetRole, setTargetRole] = useState(job?.targetRole ?? '');
  const [errors, setErrors] = useState<JobModalErrors>({});
  const [companyEmployees, setCompanyEmployees] = useState<Employee[]>([]);

  const companyOptions = useMemo(() => {
    const opts = companies.map((company) => ({
      id: company.id,
      name: company.name,
      groupName: company.groupName ?? null,
      ownerLabel: [company.ownerName, company.ownerSurname].filter(Boolean).join(' ') || null,
      ownerAvatarFilename: company.ownerAvatarFilename ?? null,
      storeCount: typeof company.storeCount === 'number' ? company.storeCount : null,
      createdAt: company.createdAt,
    }));

    if (opts.length === 0 && defaultCompanyId) {
      opts.push({
        id: defaultCompanyId,
        name: `Company #${defaultCompanyId}`,
        groupName: null,
        ownerLabel: null,
        ownerAvatarFilename: null,
        storeCount: null,
        createdAt: '',
      });
    }

    return opts;
  }, [companies, defaultCompanyId]);

  const storesForSelectedCompany = useMemo(() => {
    if (!companyId) return [] as Store[];
    const selectedCompanyId = Number.parseInt(companyId, 10);
    if (Number.isNaN(selectedCompanyId)) return [] as Store[];
    return stores.filter((store) => store.companyId === selectedCompanyId);
  }, [stores, companyId]);

  useEffect(() => {
    if (!storeId) return;
    const exists = storesForSelectedCompany.some((store) => String(store.id) === storeId);
    if (!exists) {
      setStoreId('');
    }
  }, [storeId, storesForSelectedCompany]);

  useEffect(() => {
    const selectedCompanyId = Number.parseInt(companyId, 10);
    if (Number.isNaN(selectedCompanyId)) {
      setCompanyEmployees([]);
      return;
    }
    let mounted = true;
    getEmployees({ targetCompanyId: selectedCompanyId, status: 'active', includeStoreTerminals: false, limit: 500 })
      .then((res) => {
        if (!mounted) return;
        setCompanyEmployees(res.employees ?? []);
      })
      .catch(() => {
        if (!mounted) return;
        setCompanyEmployees([]);
      });
    return () => {
      mounted = false;
    };
  }, [companyId]);

  const addTag = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    if (tags.some((tag) => tag.toLowerCase() === normalized.toLowerCase())) return;
    setTags((prev) => [...prev, normalized]);
    setTagInput('');
  };

  const removeTag = (value: string) => {
    setTags((prev) => prev.filter((tag) => tag !== value));
  };

  const parseOptionalInt = (value: string): number | null => {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number.parseInt(normalized, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const validateStep1 = (): boolean => {
    const nextErrors: JobModalErrors = {};

    if (!title.trim()) nextErrors.title = t('common.required', 'Required');
    if (!description.trim()) nextErrors.description = t('common.required', 'Required');
    if (!jobType) nextErrors.jobType = t('common.required', 'Required');
    if (!remoteType) nextErrors.remoteType = t('common.required', 'Required');

    const weeklyRaw = weeklyHoursInput.trim();
    if (weeklyRaw) {
      const weekly = Number.parseInt(weeklyRaw, 10);
      if (Number.isNaN(weekly) || weekly < 0 || weekly > 168) {
        nextErrors.weeklyHours = t('ats.weeklyHoursRangeError', 'Weekly hours must be between 0 and 168');
      }
    }

    const salaryMinRaw = salaryMinInput.trim();
    const salaryMaxRaw = salaryMaxInput.trim();
    const salaryMin = salaryMinRaw ? Number.parseInt(salaryMinRaw, 10) : null;
    const salaryMax = salaryMaxRaw ? Number.parseInt(salaryMaxRaw, 10) : null;
    const invalidSalaryMin = salaryMinRaw !== '' && (Number.isNaN(salaryMin as number) || (salaryMin as number) < 0);
    const invalidSalaryMax = salaryMaxRaw !== '' && (Number.isNaN(salaryMax as number) || (salaryMax as number) < 0);

    if (invalidSalaryMin || invalidSalaryMax) {
      nextErrors.salary = t('ats.salaryInvalid', 'Salary values must be valid positive numbers');
    } else if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
      nextErrors.salary = t('ats.salaryRangeError', 'Salary min must be less than or equal to salary max');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const nextErrors: JobModalErrors = {};

    if (!companyId) {
      nextErrors.companyId = t('common.required', 'Required');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const moveNext = () => {
    if (step === 1) {
      if (validateStep1()) setStep(2);
      return;
    }
    if (step === 2) {
      if (validateStep2()) setStep(3);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!validateStep2()) {
      setStep(2);
      return;
    }

    const parsedCompanyId = Number.parseInt(companyId, 10);
    if (Number.isNaN(parsedCompanyId)) return;
    if (!jobType || !remoteType) return;

    await onSave({
      title: title.trim(),
      description: description.trim(),
      tags,
      language,
      jobType: jobType as JobType,
      remoteType: remoteType as RemoteType,
      locationOverride,
      companyId: parsedCompanyId,
      storeId: storeId ? Number.parseInt(storeId, 10) : null,
      department: department.trim(),
      weeklyHours: parseOptionalInt(weeklyHoursInput),
      contractType: contractType.trim(),
      status,
      salaryMin: parseOptionalInt(salaryMinInput),
      salaryMax: parseOptionalInt(salaryMaxInput),
      salaryPeriod: salaryPeriod || null,
      targetRole: targetRole || null,
    });
  };

  const selectedCompanyName = useMemo(() => {
    if (!companyId) return '-';
    const selected = companyOptions.find((company) => String(company.id) === companyId);
    return selected?.name ?? '-';
  }, [companyId, companyOptions]);

  const selectedCompanyMeta = useMemo(() => {
    if (!companyId) return null;
    return companyOptions.find((company) => String(company.id) === companyId) ?? null;
  }, [companyId, companyOptions]);

  const selectedStoreMeta = useMemo(() => {
    if (!storeId) return null;
    return storesForSelectedCompany.find((store) => String(store.id) === storeId) ?? null;
  }, [storeId, storesForSelectedCompany]);

  const selectedCompanyLogoUrl = useMemo(() => {
    if (!companyId) return null;
    const selected = companies.find((item) => String(item.id) === companyId);
    return getCompanyLogoUrl(selected?.logoFilename);
  }, [companies, companyId]);

  const companyInitials = useMemo(() => {
    const raw = selectedCompanyName === '-' ? '' : selectedCompanyName;
    const initials = raw
      .split(' ')
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
    return initials || 'CO';
  }, [selectedCompanyName]);

  const companyFoundedLabel = useMemo(() => {
    const raw = selectedCompanyMeta?.createdAt;
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }, [selectedCompanyMeta?.createdAt]);

  const roleCounts = useMemo(() => {
    const counts = { hr: 0, area_manager: 0, store_manager: 0, employee: 0 };
    for (const person of companyEmployees) {
      if (person.role === 'hr') counts.hr += 1;
      else if (person.role === 'area_manager') counts.area_manager += 1;
      else if (person.role === 'store_manager') counts.store_manager += 1;
      else if (person.role === 'employee') counts.employee += 1;
    }
    return counts;
  }, [companyEmployees]);

  const teamContacts = useMemo<TeamContact[]>(() => {
    const selectedStoreId = Number.parseInt(storeId, 10);
    const effectiveStoreId = Number.isNaN(selectedStoreId) ? null : selectedStoreId;
    const contacts: TeamContact[] = [];
    if (selectedCompanyMeta?.ownerLabel) {
      contacts.push({
        id: -1,
        name: selectedCompanyMeta.ownerLabel,
        role: 'admin',
        avatarFilename: selectedCompanyMeta.ownerAvatarFilename ?? null,
      });
    }
    for (const person of companyEmployees) {
      if (person.role !== 'hr' && person.role !== 'area_manager') continue;
      if (effectiveStoreId !== null && person.storeId !== null && person.storeId !== effectiveStoreId) continue;
      const fullName = [person.name, person.surname].filter(Boolean).join(' ').trim() || person.email;
      contacts.push({
        id: person.id,
        name: fullName,
        role: person.role,
        avatarFilename: person.avatarFilename ?? null,
      });
    }
    const seen = new Set<string>();
    return contacts.filter((contact) => {
      const key = `${contact.role}-${contact.name.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [companyEmployees, selectedCompanyMeta, storeId]);

  const formCompletion = useMemo(() => {
    const checks: boolean[] = [
      Boolean(title.trim()),
      Boolean(description.trim()),
      Boolean(companyId),
      Boolean(jobType),
      Boolean(remoteType),
      Boolean(department.trim()),
      Boolean(contractType.trim()),
      Boolean(weeklyHoursInput.trim()),
      Boolean(salaryMinInput.trim() || salaryMaxInput.trim()),
      tags.length > 0,
    ];

    if (remoteType && remoteType !== 'remote') {
      checks.push(Boolean(locationOverride.country));
      checks.push(Boolean(locationOverride.city));
    }

    if (companyId && storesForSelectedCompany.length > 0) {
      checks.push(Boolean(storeId));
    }

    const done = checks.filter(Boolean).length;
    const total = checks.length;
    return Math.round((done / total) * 100);
  }, [
    title,
    description,
    companyId,
    jobType,
    remoteType,
    department,
    contractType,
    weeklyHoursInput,
    salaryMinInput,
    salaryMaxInput,
    tags,
    locationOverride.country,
    locationOverride.city,
    storesForSelectedCompany.length,
    storeId,
  ]);

  const companySelectOptions = useMemo<SelectOption[]>(() => {
    return companyOptions.map((company) => {
      const logoUrl = getCompanyLogoUrl(companies.find((item) => item.id === company.id)?.logoFilename);
      const countryCode = normalizeCountryCode(companies.find((item) => item.id === company.id)?.country ?? '');

      const detailItems = [
        company.groupName
          ? {
            key: `group-${company.id}`,
            icon: <Building2 size={12} color="#64748B" />,
            text: company.groupName,
          }
          : null,
        company.ownerLabel
          ? {
            key: `owner-${company.id}`,
            icon: <User2 size={12} color="#64748B" />,
            text: `${t('ats.ownerLabel', 'Owner')}: ${company.ownerLabel}`,
          }
          : null,
        typeof company.storeCount === 'number'
          ? {
            key: `stores-${company.id}`,
            icon: <StoreIcon size={12} color="#64748B" />,
            text: t('ats.storeCountLabel', '{{count}} stores', { count: company.storeCount }),
          }
          : null,
      ].filter(Boolean) as Array<{ key: string; icon: React.ReactNode; text: string }>;

      return {
        value: String(company.id),
        label: company.name,
        render: (
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(13,33,55,0.14)', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {logoUrl ? <img src={logoUrl} alt={company.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Building2 size={16} color="#64748B" />}
              </div>
              <div style={{ display: 'grid', gap: 4, minWidth: 0, flex: 1 }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {company.name}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {detailItems.length > 0 ? detailItems.map((detail) => (
                    <span key={detail.key} style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                      {detail.icon}
                      {detail.text}
                    </span>
                  )) : (
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                      <Building2 size={12} color="#64748B" />
                      {t('ats.standaloneCompany', 'Standalone company')}
                    </span>
                  )}
                  {countryCode ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                      <ReactCountryFlag countryCode={countryCode} svg style={{ width: '1em', height: '1em' }} />
                      {countryCode}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ),
      };
    });
  }, [companyOptions, companies, t]);

  const storeSelectOptions = useMemo<SelectOption[]>(() => {
    return storesForSelectedCompany.map((store) => {
      const location = [store.city, store.state, store.country].filter(Boolean).join(', ');
      const countryCode = normalizeCountryCode(store.country ?? '');
      const storeLogo = getStoreLogoUrl(store.logoFilename ?? null);

      const detailItems = [
        store.code
          ? { key: `code-${store.id}`, icon: <FileText size={12} color="#64748B" />, text: `${t('ats.codeLabel', 'Code')} ${store.code}` }
          : null,
        location
          ? { key: `location-${store.id}`, icon: <MapPin size={12} color="#64748B" />, text: location }
          : null,
        typeof store.employeeCount === 'number'
          ? { key: `staff-${store.id}`, icon: <User2 size={12} color="#64748B" />, text: t('ats.staffCountLabel', '{{count}} staff', { count: store.employeeCount }) }
          : null,
      ].filter(Boolean) as Array<{ key: string; icon: React.ReactNode; text: string }>;

      return {
        value: String(store.id),
        label: store.name,
        render: (
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(13,33,55,0.14)', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {storeLogo ? <img src={storeLogo} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <StoreIcon size={14} color="#64748B" />}
              </div>
              <div style={{ display: 'grid', gap: 4, minWidth: 0, flex: 1 }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {store.name}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {detailItems.length > 0 ? detailItems.map((detail) => (
                    <span key={detail.key} style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                      {detail.icon}
                      {detail.text}
                    </span>
                  )) : (
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {t('common.store', 'Store')}
                    </span>
                  )}
                  {countryCode ? <ReactCountryFlag countryCode={countryCode} svg style={{ width: '0.95em', height: '0.95em' }} /> : null}
                </div>
              </div>
            </div>
          </div>
        ),
      };
    });
  }, [storesForSelectedCompany, t]);

  const jobTypeSelectOptions = useMemo<SelectOption[]>(() => {
    return [
      {
        value: 'fulltime',
        label: t('ats.jobType_fulltime'),
        render: (
          <div style={{ display: 'grid', gap: 1, textAlign: 'left' }}>
            <span style={{ fontWeight: 700 }}>{t('ats.jobType_fulltime')}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('ats.fulltimeHint', 'Standard weekly schedule')}</span>
          </div>
        ),
      },
      {
        value: 'parttime',
        label: t('ats.jobType_parttime'),
        render: (
          <div style={{ display: 'grid', gap: 1, textAlign: 'left' }}>
            <span style={{ fontWeight: 700 }}>{t('ats.jobType_parttime')}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('ats.parttimeHint', 'Flexible reduced hours')}</span>
          </div>
        ),
      },
      {
        value: 'contract',
        label: t('ats.jobType_contract'),
        render: (
          <div style={{ display: 'grid', gap: 1, textAlign: 'left' }}>
            <span style={{ fontWeight: 700 }}>{t('ats.jobType_contract')}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('ats.contractHint', 'Fixed term or project scope')}</span>
          </div>
        ),
      },
      {
        value: 'internship',
        label: t('ats.jobType_internship'),
        render: (
          <div style={{ display: 'grid', gap: 1, textAlign: 'left' }}>
            <span style={{ fontWeight: 700 }}>{t('ats.jobType_internship')}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('ats.internshipHint', 'Training and mentorship track')}</span>
          </div>
        ),
      },
    ];
  }, [t]);

  const remoteTypeSelectOptions = useMemo<SelectOption[]>(() => {
    return [
      {
        value: 'onsite',
        label: t('ats.remoteType_onsite', 'On-site'),
        render: (
          <div style={{ display: 'grid', gap: 1, textAlign: 'left' }}>
            <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Building2 size={13} />{t('ats.remoteType_onsite', 'On-site')}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('ats.remoteTypeOnsiteHint', 'Presence required in store or office')}</span>
          </div>
        ),
      },
      {
        value: 'hybrid',
        label: t('ats.remoteType_hybrid', 'Hybrid'),
        render: (
          <div style={{ display: 'grid', gap: 1, textAlign: 'left' }}>
            <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><MapPin size={13} />{t('ats.remoteType_hybrid', 'Hybrid')}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('ats.remoteTypeHybridHint', 'Split schedule between remote and on-site')}</span>
          </div>
        ),
      },
      {
        value: 'remote',
        label: t('ats.remoteType_remote', 'Remote'),
        render: (
          <div style={{ display: 'grid', gap: 1, textAlign: 'left' }}>
            <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Globe2 size={13} />{t('ats.remoteType_remote', 'Remote')}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('ats.remoteTypeRemoteHint', 'Fully remote collaboration')}</span>
          </div>
        ),
      },
    ];
  }, [t]);

  const languageSelectOptions = useMemo<SelectOption[]>(() => {
    return [
      {
        value: 'it',
        label: 'Italiano',
        render: (
          <div style={{ display: 'grid', gap: 1, textAlign: 'left' }}>
            <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Languages size={13} />Italiano</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Italian-first audience</span>
          </div>
        ),
      },
      {
        value: 'en',
        label: 'English',
        render: (
          <div style={{ display: 'grid', gap: 1, textAlign: 'left' }}>
            <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Languages size={13} />English</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>International candidates</span>
          </div>
        ),
      },
      {
        value: 'both',
        label: 'Bilingual',
        render: (
          <div style={{ display: 'grid', gap: 1, textAlign: 'left' }}>
            <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Languages size={13} />Bilingual</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Italian and English versions</span>
          </div>
        ),
      },
    ];
  }, []);

  const statusSelectOptions = useMemo<SelectOption[]>(() => {
    return [
      {
        value: 'draft',
        label: t('ats.status_draft'),
        render: (
          <div style={{ display: 'grid', gap: 1, textAlign: 'left' }}>
            <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><FileText size={13} />{t('ats.status_draft')}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('ats.statusDraftHint', 'Visible only to your internal team')}</span>
          </div>
        ),
      },
      {
        value: 'published',
        label: t('ats.status_published'),
        render: (
          <div style={{ display: 'grid', gap: 1, textAlign: 'left' }}>
            <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><BadgeCheck size={13} />{t('ats.status_published')}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('ats.statusPublishedHint', 'Visible on careers pages immediately')}</span>
          </div>
        ),
      },
      {
        value: 'closed',
        label: t('ats.status_closed'),
        render: (
          <div style={{ display: 'grid', gap: 1, textAlign: 'left' }}>
            <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Eye size={13} />{t('ats.status_closed')}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('ats.statusClosedHint', 'No longer accepting candidates')}</span>
          </div>
        ),
      },
    ];
  }, [t]);

  const stepCards: Array<{ id: 1 | 2 | 3; title: string; subtitle: string }> = [
    { id: 1, title: t('ats.stepDetailsTitle', 'Job details'), subtitle: t('ats.stepDetailsSubtitle', 'Role profile and location') },
    { id: 2, title: t('ats.stepSettingsTitle', 'Platform settings'), subtitle: t('ats.stepSettingsSubtitle', 'Company, store and visibility') },
    { id: 3, title: t('ats.stepReviewTitle', 'Review'), subtitle: t('ats.stepReviewSubtitle', 'Final check before save') },
  ];

  const isCompact = isMobile || isTablet;
  const departmentLabel = t('common.department', 'Department');
  const storeLabel = t('common.store', 'Store');
  const statusLabel = t('common.status', 'Status');
  const currentUserFullName = user ? `${user.name} ${user.surname ?? ''}`.trim() : t('common.user', 'User');
  const currentUserInitials = user ? `${user.name?.[0] ?? ''}${user.surname?.[0] ?? ''}`.toUpperCase() : 'U';
  const currentUserAvatarUrl = user?.avatarFilename ? getAvatarUrl(user.avatarFilename) : null;
  const currentUserRoleLabel = user ? t(`roles.${user.role}`, user.role) : t('common.user', 'User');
  const superAdminLabel = t('roles.super_admin', 'Super admin');
  const currentUserRoleDisplay = currentUserRoleLabel.replace(/_/g, ' ').toUpperCase();
  const hasTeamMembers = teamContacts.length > 0;
  const jobTypeDisplay = jobType ? t(`ats.jobType_${JOB_TYPE_LABEL[jobType]}`, jobType) : t('common.notSet', 'Not set');
  const remoteTypeDisplay = remoteType ? t(`ats.remoteType_${remoteType}`, remoteType) : t('common.notSet', 'Not set');
  const roleTags = tags.filter((tag) => tag.trim().length > 0);
  const selectedStoreLocation = [selectedStoreMeta?.city, selectedStoreMeta?.state, selectedStoreMeta?.country].filter(Boolean).join(', ');
  const selectedStoreAddress = [selectedStoreMeta?.address, selectedStoreMeta?.cap].filter(Boolean).join(' - ');
  const hiringVisibilityTone = status === 'published'
    ? {
      border: '1px solid rgba(34,197,94,0.35)',
      background: 'rgba(21,128,61,0.22)',
      titleColor: '#ECFDF5',
      bodyColor: '#D1FAE5',
      badgeBg: 'rgba(74,222,128,0.22)',
      badgeBorder: '1px solid rgba(134,239,172,0.45)',
      badgeColor: '#DCFCE7',
    }
    : status === 'closed'
      ? {
        border: '1px solid rgba(248,113,113,0.34)',
        background: 'rgba(153,27,27,0.24)',
        titleColor: '#FEF2F2',
        bodyColor: '#FECACA',
        badgeBg: 'rgba(252,165,165,0.2)',
        badgeBorder: '1px solid rgba(252,165,165,0.4)',
        badgeColor: '#FEE2E2',
      }
      : {
        border: '1px solid rgba(147,197,253,0.36)',
        background: 'rgba(30,64,175,0.22)',
        titleColor: '#EFF6FF',
        bodyColor: '#DBEAFE',
        badgeBg: 'rgba(191,219,254,0.22)',
        badgeBorder: '1px solid rgba(191,219,254,0.42)',
        badgeColor: '#E0F2FE',
      };
  const hiringVisibilityCopy = status === 'published'
    ? t('ats.hiringVisibilityPublished', 'Visible in careers pages and XML feed. Candidates can apply immediately.')
    : status === 'closed'
      ? t('ats.hiringVisibilityClosed', 'Posting is archived for hiring. It is hidden from careers listings and not accepting new applicants.')
      : t('ats.hiringVisibilityDraft', 'Internal draft only. Publish this position to expose it to careers and the feed.');

  return (
    <ModalBackdrop onClose={onClose} closeOnBackdropClick={Boolean(job)} width={1140}>

      {/* Body */}
      <form onSubmit={handleSubmit} style={{ padding: 0, display: 'grid', gap: 0 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isCompact ? '1fr' : 'minmax(310px, 1fr) minmax(0, 1.85fr)',
          gap: 0,
          alignItems: 'stretch',
        }}>
          <aside style={{
            border: 'none',
            borderRight: isCompact ? 'none' : '1px solid rgba(255,255,255,0.16)',
            padding: '18px 14px',
            background: 'linear-gradient(180deg, #172A3D 0%, #1B334A 52%, #172B3F 100%)',
            display: 'grid',
            gap: 14,
            position: 'static',
            height: '100%',
            alignContent: 'start',
            gridColumn: isCompact ? 'auto' : '1 / 2',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.09)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderRadius: 12,
              padding: '9px 10px',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.18)',
            }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'linear-gradient(140deg, #4E8ABF, #2D5278)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 12,
                overflow: 'hidden',
                flexShrink: 0,
              }}>
                {currentUserAvatarUrl
                  ? <img src={currentUserAvatarUrl} alt={currentUserFullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : currentUserInitials}
              </div>
              <div style={{ display: 'grid', minWidth: 0, gap: 2 }}>
                <span style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUserFullName}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {currentUserRoleDisplay}
                  </span>
                  {user?.isSuperAdmin && (
                    <span style={{
                      fontSize: 9.5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fontWeight: 800,
                      color: '#FFE9A7',
                      border: '1px solid rgba(255,233,167,0.62)',
                      background: 'rgba(201,151,58,0.24)',
                      borderRadius: 999,
                      padding: '1px 6px',
                      lineHeight: 1.4,
                    }}>
                      {superAdminLabel}
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div style={{
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.1)',
              padding: '13px 12px',
              display: 'grid',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 60,
                  height: 60,
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.26)',
                  background: 'rgba(255,255,255,0.18)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                  fontWeight: 800,
                  fontSize: 18,
                  color: '#FFFFFF',
                }}>
                  {selectedCompanyLogoUrl
                    ? <img src={selectedCompanyLogoUrl} alt={selectedCompanyName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : companyInitials}
                </div>
                <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                  <strong style={{ color: '#FFFFFF', fontSize: 18, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedCompanyName}
                  </strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.78)', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Building2 size={12} color="#C9D7E5" />
                      {selectedCompanyMeta?.groupName ?? t('ats.standaloneCompany', 'Standalone company')}
                    </span>
                    {companyFoundedLabel ? (
                      <span style={{ color: 'rgba(255,255,255,0.74)', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CalendarDays size={12} color="#C9D7E5" />
                        {companyFoundedLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 10, display: 'grid', gap: 7 }}>
                <span style={{ color: '#CBD5E1', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  {t('ats.teamContactsLabel', 'Team contacts')}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {teamContacts.map((contact) => (
                    <span key={`${contact.role}-${contact.id}-${contact.name}`} style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.24)', background: 'rgba(255,255,255,0.12)', color: '#F8FAFC', fontSize: 11.5, padding: '5px 8px', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.22)', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                        {contact.avatarFilename
                          ? <img src={getAvatarUrl(contact.avatarFilename) ?? ''} alt={contact.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : initials(contact.name)}
                      </span>
                      <span style={{ display: 'grid', lineHeight: 1.2 }}>
                        <span style={{ fontWeight: 700 }}>{contact.name}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)' }}>{t(`roles.${contact.role}`)}</span>
                      </span>
                    </span>
                  ))}
                  {!hasTeamMembers ? (
                    <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11.5 }}>
                      {t('ats.teamContactsMissing', 'Owner / HR / Area manager information is not linked yet.')}
                    </span>
                  ) : null}
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 10, display: 'grid', gap: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 7, fontSize: 12, color: '#E2E8F0' }}>
                  <span>{t('ats.completionLabel', 'Completion')}</span>
                  <strong style={{ color: '#F8D98B' }}>{formCompletion}%</strong>
                </div>
                <div style={{ height: 7, borderRadius: 999, background: 'rgba(148,163,184,0.4)', overflow: 'hidden' }}>
                  <div style={{ width: `${formCompletion}%`, height: '100%', background: 'linear-gradient(90deg, #EAC26E, #C9973A)' }} />
                </div>

                <div style={{ display: 'grid', gap: 5, marginTop: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#F8FAFC' }}>
                    <StoreIcon size={12} color="#CBD5E1" />
                    <span>{selectedStoreMeta?.name ?? '-'}</span>
                  </div>
                  {selectedStoreMeta?.code ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#E2E8F0' }}>
                      <FileText size={12} color="#CBD5E1" />
                      <span>{t('ats.codeLabel', 'Code')} {selectedStoreMeta.code}</span>
                    </div>
                  ) : null}
                  {selectedStoreLocation ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#E2E8F0' }}>
                      <MapPin size={12} color="#CBD5E1" />
                      <span>{selectedStoreLocation}</span>
                    </div>
                  ) : null}
                  {selectedStoreAddress ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#E2E8F0' }}>
                      <Building2 size={12} color="#CBD5E1" />
                      <span>{selectedStoreAddress}</span>
                    </div>
                  ) : null}
                  {selectedStoreMeta?.phone ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#E2E8F0' }}>
                      <Phone size={12} color="#CBD5E1" />
                      <span>{selectedStoreMeta.phone}</span>
                    </div>
                  ) : null}
                  {typeof selectedStoreMeta?.employeeCount === 'number' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#E2E8F0' }}>
                      <Users size={12} color="#CBD5E1" />
                      <span>{t('ats.staffCountLabel', '{{count}} staff', { count: selectedStoreMeta.employeeCount })}</span>
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#F8FAFC' }}>
                    <BriefcaseBusiness size={12} color="#CBD5E1" />
                    <span>{contractType.trim() || t('common.notSet', 'Not set')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#F8FAFC' }}>
                    <Building2 size={12} color="#CBD5E1" />
                    <span>{department.trim() || t('common.notSet', 'Not set')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#F8FAFC' }}>
                    <Languages size={12} color="#CBD5E1" />
                    <span>{language.toUpperCase()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#F8FAFC' }}>
                    <BadgeCheck size={12} color="#CBD5E1" />
                    <span>{t(`ats.status_${status}`, status)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#F8FAFC' }}><BriefcaseBusiness size={12} color="#CBD5E1" />{jobTypeDisplay}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#F8FAFC' }}><Globe2 size={12} color="#CBD5E1" />{remoteTypeDisplay}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#F8FAFC' }}><Clock3 size={12} color="#CBD5E1" />{weeklyHoursInput.trim() || '-'} {t('ats.hoursPerWeek', 'hrs/week')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#F8FAFC' }}>
                    <Wallet size={12} color="#CBD5E1" />
                    {salaryMinInput.trim() || '-'} - {salaryMaxInput.trim() || '-'}
                    {salaryPeriod ? ` (${t(`ats.salaryPeriod${salaryPeriod.charAt(0).toUpperCase()}${salaryPeriod.slice(1)}`, salaryPeriod)})` : ''}
                  </div>
                  {remoteType && remoteType !== 'remote' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#F8FAFC' }}>
                      <MapPin size={12} color="#CBD5E1" />
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {locationOverride.country ? <ReactCountryFlag countryCode={locationOverride.country} svg style={{ width: '0.95em', height: '0.95em' }} /> : null}
                        {locationOverride.city || '-'}, {countryNameFromCode(locationOverride.country)}
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 4, display: 'grid', gap: 7 }}>
                  <span style={{ color: '#CBD5E1', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                    {t('ats.jobTags', 'Tags')}
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {roleTags.length > 0 ? roleTags.map((tag) => (
                      <span key={`sidebar-tag-${tag}`} style={{ borderRadius: 999, border: '1px solid rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.14)', color: '#F8FAFC', fontSize: 11, fontWeight: 600, padding: '3px 8px' }}>
                        {tag}
                      </span>
                    )) : (
                      <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11.5 }}>
                        {t('ats.noTags', 'No tags')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ borderRadius: 12, border: hiringVisibilityTone.border, background: hiringVisibilityTone.background, padding: 11, color: hiringVisibilityTone.bodyColor, fontSize: 12.5, lineHeight: 1.5, display: 'grid', gap: 6 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: hiringVisibilityTone.titleColor }}>
                <User2 size={13} /> {t('ats.hiringVisibilityTitle', 'Hiring visibility')}
                <span style={{ borderRadius: 999, padding: '1px 7px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: hiringVisibilityTone.badgeBg, border: hiringVisibilityTone.badgeBorder, color: hiringVisibilityTone.badgeColor }}>
                  {t(`ats.status_${status}`, status)}
                </span>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span>{hiringVisibilityCopy}</span>
              </div>
            </div>
          </aside>

          <div style={{
            display: 'grid',
            gap: 12,
            gridColumn: isCompact ? 'auto' : '2 / 3',
            background: 'linear-gradient(180deg, #FDFDFE 0%, #F8FAFC 100%)',
            padding: '18px 20px 16px',
          }}>
            <div style={{
              display: 'grid',
              gap: 12,
              paddingBottom: 12,
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {job ? t('ats.editJob') : t('ats.newJob')}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    {t('ats.stepFlow', 'Complete each section and review the live summary before saving.')}
                  </p>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 22, lineHeight: 1, padding: '2px 6px', borderRadius: 6 }}>×</button>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: isCompact ? 10 : 0,
                flexWrap: isCompact ? 'wrap' : 'nowrap',
              }}>
                {stepCards.map((item, index) => {
                  const isDone = step > item.id;
                  const isCurrent = step === item.id;

                  return (
                    <React.Fragment key={item.id}>
                      <div style={{
                        minWidth: isCompact ? 'calc(50% - 8px)' : 0,
                        flex: isCompact ? '1 1 calc(50% - 8px)' : 1,
                        display: 'grid',
                        justifyItems: 'center',
                        gap: 7,
                      }}>
                        <div style={{ display: 'grid', gap: 4, justifyItems: 'center', textAlign: 'center' }}>
                          <span style={{
                            width: 30,
                            height: 30,
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: 11,
                            color: isDone || isCurrent ? '#ffffff' : '#64748b',
                            border: isDone || isCurrent ? '1px solid rgba(201,151,58,0.86)' : '1px solid rgba(148,163,184,0.4)',
                            background: isDone || isCurrent ? '#C9973A' : '#ffffff',
                            boxShadow: isCurrent ? '0 0 0 3px rgba(201,151,58,0.18)' : 'none',
                            transition: 'all 0.2s ease',
                          }}>
                            {isDone ? '✓' : item.id}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isCurrent ? '#9A6808' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.title}
                          </span>
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', maxWidth: 180 }}>{item.subtitle}</span>
                        </div>
                      </div>

                      {index < stepCards.length - 1 && !isCompact && (
                        <div style={{
                          flex: 1,
                          margin: '15px 10px 0',
                          height: 2,
                          borderRadius: 999,
                          background: step > item.id ? '#C9973A' : 'rgba(148,163,184,0.38)',
                          transition: 'background 0.2s ease',
                        }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {step === 1 && (
                <>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: '#fff', padding: 14, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#1f2937', fontWeight: 700, fontSize: 13 }}>
                      <FileText size={14} /> {t('ats.coreRoleDetails', 'Core role details')}
                    </div>

                    <Input
                      label={`${t('ats.jobTitle')} *`}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      placeholder={t('ats.jobTitlePlaceholder')}
                      autoFocus
                    />
                    {errors.title && <div style={{ marginTop: -8, color: '#B91C1C', fontSize: 12 }}>{errors.title}</div>}

                    <div>
                      <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                        {t('ats.jobDescription')} *
                      </label>
                      <textarea
                        className="field-input"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={6}
                        placeholder={t('ats.jobDescriptionPlaceholder')}
                        style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', padding: '10px 12px', fontSize: 13.5, borderRadius: 10, border: '1px solid var(--border)', outline: 'none', display: 'block', background: '#fff' }}
                      />
                    </div>
                    {errors.description && <div style={{ marginTop: -8, color: '#B91C1C', fontSize: 12 }}>{errors.description}</div>}

                    <div>
                      <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                        {t('ats.jobTags')}
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'center' }}>
                        <input
                          className="field-input"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          placeholder={t('ats.jobTagsInputPlaceholder', 'Type a tag and press Enter')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addTag(tagInput);
                            }
                          }}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '8px 12px',
                            fontSize: 13.5,
                            borderRadius: 'var(--radius)',
                            border: '1px solid var(--border)',
                            outline: 'none',
                            display: 'block',
                            background: '#fff',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => addTag(tagInput)}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            border: '1px solid rgba(201,151,58,0.42)',
                            background: 'rgba(201,151,58,0.14)',
                            color: '#8a6318',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                          aria-label={t('common.add', 'Add')}
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 10px',
                              borderRadius: 999,
                              fontSize: 12,
                              background: '#E9F8EE',
                              color: '#1D6B3A',
                              border: '1px solid #BFE8CC',
                              fontWeight: 700,
                            }}
                          >
                            <span>{tag}</span>
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              style={{ border: 'none', background: 'transparent', color: '#1D6B3A', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                              aria-label={`Remove ${tag}`}
                            >
                              <Trash2 size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: '#fff', padding: 14, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#1f2937', fontWeight: 700, fontSize: 13 }}>
                      <BriefcaseBusiness size={14} /> {t('ats.contractAndSchedule', 'Contract and schedule')}
                    </div>
                    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
                      <div>
                        <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                          {t('ats.jobType')}
                        </label>
                        <CustomSelect
                          value={jobType || null}
                          onChange={(value) => setJobType((value as JobType | null) ?? '')}
                          options={jobTypeSelectOptions}
                          isClearable
                          searchable={false}
                          placeholder={t('ats.selectJobType', 'Select job type')}
                          disabled={saving}
                          error={errors.jobType}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                          {t('ats.remoteMode', 'Work arrangement')}
                        </label>
                        <CustomSelect
                          value={remoteType || null}
                          onChange={(value) => setRemoteType((value as RemoteType | null) ?? '')}
                          options={remoteTypeSelectOptions}
                          isClearable
                          searchable={false}
                          placeholder={t('ats.selectRemoteMode', 'Select work arrangement')}
                          disabled={saving}
                          error={errors.remoteType}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr 1fr' }}>
                      <Input
                        label={t('ats.weeklyHours')}
                        type="number"
                        value={weeklyHoursInput}
                        onChange={(e) => setWeeklyHoursInput(e.target.value)}
                        placeholder={t('ats.weeklyHoursPlaceholder', '40')}
                      />
                      <Input
                        label={t('ats.salaryMin', 'Salary min')}
                        type="number"
                        value={salaryMinInput}
                        onChange={(e) => setSalaryMinInput(e.target.value)}
                        placeholder={t('ats.salaryMinPlaceholder', '1200')}
                      />
                      <Input
                        label={t('ats.salaryMax', 'Salary max')}
                        type="number"
                        value={salaryMaxInput}
                        onChange={(e) => setSalaryMaxInput(e.target.value)}
                        placeholder={t('ats.salaryMaxPlaceholder', '1800')}
                      />
                      <div>
                        <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                          {t('ats.salaryPeriod', 'Salary period')}
                        </label>
                        <CustomSelect
                          value={salaryPeriod || null}
                          onChange={(value) => setSalaryPeriod((value as string | null) ?? '')}
                          options={[
                            { value: 'hourly', label: t('ats.salaryPeriodHourly', 'Per hour') },
                            { value: 'daily', label: t('ats.salaryPeriodDaily', 'Per day') },
                            { value: 'weekly', label: t('ats.salaryPeriodWeekly', 'Per week') },
                            { value: 'monthly', label: t('ats.salaryPeriodMonthly', 'Per month') },
                            { value: 'yearly', label: t('ats.salaryPeriodYearly', 'Per year') },
                          ]}
                          searchable={false}
                          isClearable
                          placeholder={t('ats.salaryPeriod', 'Salary period')}
                          disabled={saving}
                        />
                      </div>
                    </div>
                    {(errors.weeklyHours || errors.salary) && (
                      <div style={{ marginTop: -6, color: '#B91C1C', fontSize: 12 }}>
                        {errors.weeklyHours ?? errors.salary}
                      </div>
                    )}

                    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
                      <Input
                        label={t('ats.contractType')}
                        value={contractType}
                        onChange={(e) => setContractType(e.target.value)}
                        placeholder={t('ats.contractTypePlaceholder')}
                      />
                      <Input
                        label={departmentLabel}
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder={t('ats.departmentPlaceholder')}
                      />
                    </div>
                  </div>

                  {remoteType && remoteType !== 'remote' && (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: '#fff', padding: 14, display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#1f2937', fontWeight: 700, fontSize: 13 }}>
                        <MapPin size={14} /> {t('ats.jobLocation', 'Job location')}
                      </div>

                      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr' }}>
                        <CountrySelect
                          value={locationOverride.country || null}
                          onChange={(next) => setLocationOverride((prev) => ({ ...prev, country: next ?? '', state: '', city: '' }))}
                          label={t('ats.jobCountryOverrideLabel', 'Country')}
                          placeholder={t('ats.jobCountryOverrideLabel', 'Country')}
                          disabled={saving}
                        />

                        <StateSelect
                          countryCode={locationOverride.country || null}
                          value={locationOverride.state || null}
                          onChange={(next) => setLocationOverride((prev) => ({ ...prev, state: next ?? '', city: '' }))}
                          label={t('ats.jobStateOverrideLabel', 'State')}
                          placeholder={t('ats.jobStateOverrideLabel', 'State')}
                          disabled={saving}
                        />

                        <div>
                          <CitySelect
                            countryCode={locationOverride.country || null}
                            stateCode={locationOverride.state || null}
                            value={locationOverride.city || null}
                            onChange={(next) => setLocationOverride((prev) => ({ ...prev, city: next ?? '' }))}
                            label={t('ats.jobCityOverrideLabel', 'City')}
                            placeholder={t('ats.jobCityOverrideLabel', 'City')}
                            disabled={saving}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr' }}>
                        <Input
                          label={t('ats.jobPostalCodeOverrideLabel', 'Postal code')}
                          value={locationOverride.postalCode}
                          onChange={(e) => setLocationOverride((prev) => ({ ...prev, postalCode: e.target.value }))}
                          placeholder={t('ats.jobPostalCodeOverrideLabel', 'Postal code')}
                        />
                        <Input
                          label={t('ats.jobAddressOverrideLabel', 'Address')}
                          value={locationOverride.address}
                          onChange={(e) => setLocationOverride((prev) => ({ ...prev, address: e.target.value }))}
                          placeholder={t('ats.jobAddressOverrideLabel', 'Address')}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {step === 2 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: '#fff', padding: 14, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#1f2937', fontWeight: 700, fontSize: 13 }}>
                    <Sparkles size={14} /> {t('ats.platformSettings', 'Platform settings')}
                  </div>

                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                      {t('nav.companies')} *
                    </label>
                    <CustomSelect
                      value={companyId || null}
                      onChange={(value) => setCompanyId(value ?? '')}
                      options={companySelectOptions}
                      placeholder={t('common.select', 'Select')}
                      error={errors.companyId}
                      isClearable
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                      {storeLabel}
                    </label>
                    <CustomSelect
                      value={storeId || null}
                      onChange={(value) => setStoreId(value ?? '')}
                      options={storeSelectOptions}
                      placeholder={t('ats.selectStore')}
                      disabled={saving || !companyId}
                      isClearable
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                      {t('ats.targetRole', 'Target role')}
                    </label>
                    <CustomSelect
                      value={targetRole || null}
                      onChange={(value) => setTargetRole((value as string | null) ?? '')}
                      options={[
                        { value: 'hr', label: `${t('roles.hr')} (${roleCounts.hr})` },
                        { value: 'area_manager', label: `${t('roles.area_manager')} (${roleCounts.area_manager})` },
                        { value: 'store_manager', label: `${t('roles.store_manager')} (${roleCounts.store_manager})` },
                        { value: 'employee', label: `${t('roles.employee')} (${roleCounts.employee})` },
                      ]}
                      searchable={false}
                      isClearable
                      placeholder={t('ats.targetRole', 'Target role')}
                      disabled={saving || !companyId}
                    />
                  </div>

                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
                    <div>
                      <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                        {t('ats.jobPostingLanguage')}
                      </label>
                      <CustomSelect
                        value={language}
                        onChange={(value) => value && setLanguage(value as JobLanguage)}
                        options={languageSelectOptions}
                        isClearable={false}
                        searchable={false}
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                        {statusLabel}
                      </label>
                      <CustomSelect
                        value={status}
                        onChange={(value) => value && setStatus(value as JobStatus)}
                        options={statusSelectOptions}
                        isClearable={false}
                        searchable={false}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  <div style={{ border: '1px solid rgba(13,33,55,0.1)', borderRadius: 10, padding: 10, background: '#F8FBFF', color: '#334155', fontSize: 12.5, lineHeight: 1.55 }}>
                    <strong>{t('ats.jobLanguageHint')}</strong>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: '#fff', padding: 16, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 12, border: '1px solid rgba(201,151,58,0.22)', background: '#fffdf6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {selectedCompanyLogoUrl
                          ? <img src={selectedCompanyLogoUrl} alt={selectedCompanyName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <Building2 size={14} color="#8a6318" />}
                      </div>
                      <div style={{ display: 'grid', gap: 2 }}>
                        <strong style={{ color: '#111827', fontSize: 13 }}>{selectedCompanyName}</strong>
                        <span style={{ fontSize: 11.5, color: '#64748b' }}>{selectedCompanyMeta?.groupName ?? t('ats.standaloneCompany', 'Standalone company')}</span>
                      </div>
                    </div>
                    <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
                      <span style={{ borderRadius: 999, border: '1px solid rgba(13,33,55,0.15)', background: '#fff', color: '#334155', fontSize: 11, fontWeight: 700, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock3 size={12} /> {t('common.justNow', 'Just now')}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#9A6808' }}>
                        0 {t('ats.appliedLabel', 'applied')}
                      </span>
                    </div>
                  </div>

                  <h4 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontSize: 22 }}>{title || '-'}</h4>
                  <p style={{ margin: 0, color: '#4b5563', fontSize: 13.5, lineHeight: 1.55 }}>{description.trim() || '-'}</p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ borderRadius: 999, background: 'rgba(15,23,42,0.06)', border: '1px solid rgba(15,23,42,0.09)', color: '#334155', fontSize: 11, fontWeight: 700, padding: '3px 8px' }}>
                      {jobTypeDisplay}
                    </span>
                    <span style={{ borderRadius: 999, background: 'rgba(15,23,42,0.06)', border: '1px solid rgba(15,23,42,0.09)', color: '#334155', fontSize: 11, fontWeight: 700, padding: '3px 8px' }}>
                      {remoteTypeDisplay}
                    </span>
                    <span style={{ borderRadius: 999, background: status === 'closed' ? 'rgba(239,68,68,0.1)' : 'rgba(22,163,74,0.12)', border: status === 'closed' ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(22,163,74,0.22)', color: status === 'closed' ? '#991b1b' : '#166534', fontSize: 11, fontWeight: 700, padding: '3px 8px' }}>
                      {t(`ats.status_${status}`)}
                    </span>
                    <span style={{ borderRadius: 999, background: 'rgba(15,23,42,0.06)', border: '1px solid rgba(15,23,42,0.09)', color: '#334155', fontSize: 11, fontWeight: 700, padding: '3px 8px' }}>
                      {language === 'it' ? '🇮🇹 IT' : language === 'en' ? '🇬🇧 EN' : '🇮🇹 🇬🇧 IT + EN'}
                    </span>
                    <span style={{ borderRadius: 999, background: 'rgba(15,23,42,0.06)', border: '1px solid rgba(15,23,42,0.09)', color: '#334155', fontSize: 11, fontWeight: 700, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={12} />
                      {remoteType === 'remote'
                        ? t('ats.remoteType_remote', 'Remote')
                        : remoteType
                          ? `${locationOverride.city || '-'}, ${countryNameFromCode(locationOverride.country)}`
                          : t('common.notSet', 'Not set')}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', border: '1px dashed rgba(148,163,184,0.38)', borderRadius: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.74)' }}>
                    <div style={{ display: 'grid', gap: 2 }}>
                      <strong style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('ats.salaryRange', 'Salary range')}</strong>
                      <span style={{ color: '#0f172a', fontSize: 12, fontWeight: 600 }}>€{salaryMinInput.trim() || '-'} - €{salaryMaxInput.trim() || '-'}</span>
                    </div>
                    <div style={{ display: 'grid', gap: 2 }}>
                      <strong style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('ats.weeklyHours')}</strong>
                      <span style={{ color: '#0f172a', fontSize: 12, fontWeight: 600 }}>{weeklyHoursInput.trim() || '-'}</span>
                    </div>
                    <div style={{ display: 'grid', gap: 2 }}>
                      <strong style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{storeLabel}</strong>
                      <span style={{ color: '#0f172a', fontSize: 12, fontWeight: 600 }}>{selectedStoreMeta?.name ?? '-'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {tags.length > 0 ? tags.map((tag) => (
                      <span key={`preview-${tag}`} style={{ fontSize: 11, borderRadius: 999, padding: '3px 9px', background: '#E9F8EE', color: '#1D6B3A', border: '1px solid #BFE8CC', fontWeight: 600 }}>
                        {tag}
                      </span>
                    )) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('ats.noTags', 'No tags')}</span>}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(13,33,55,0.2)', background: '#fff', color: '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Heart size={15} />
                      </button>
                      <button
                        type="button"
                        style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(13,33,55,0.2)', background: '#fff', color: '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Bookmark size={15} />
                      </button>
                    </div>

                    <button
                      type="button"
                      style={{ border: 'none', background: 'transparent', color: '#9A6808', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0 }}
                    >
                      {t('publicCareers.viewDetails', 'View details')} <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4, minHeight: 44 }}>
              {step === 1 && (
                <>
                  <Button variant="secondary" type="button" onClick={onClose}>{t('common.cancel')}</Button>
                  <Button variant="primary" type="button" onClick={moveNext}>
                    {t('common.next', 'Next')} →
                  </Button>
                </>
              )}

              {step === 2 && (
                <>
                  <Button variant="secondary" type="button" onClick={onClose}>{t('common.cancel')}</Button>
                  <Button variant="secondary" type="button" onClick={() => setStep(1)}>
                    ← {t('common.back', 'Back')}
                  </Button>
                  <Button variant="secondary" type="button" onClick={moveNext}>
                    {t('ats.previewStep', 'Preview')} →
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    loading={saving}
                    disabled={!title.trim() || !description.trim() || !jobType || !remoteType || !companyId}
                  >
                    {job ? t('ats.savePosition', 'Save position') : t('ats.createPosition', 'Create position')}
                  </Button>
                </>
              )}

              {step === 3 && (
                <>
                  <Button variant="secondary" type="button" onClick={() => setStep(2)}>
                    {t('common.edit', 'Edit')}
                  </Button>
                  <Button variant="primary" type="button" onClick={onClose}>
                    {t('common.close', 'Close')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </form>
    </ModalBackdrop>
  );
};

// ─── Candidate detail panel ────────────────────────────────────────────────────

interface CandidateModalProps {
  candidate: Candidate;
  jobs: JobPosting[];
  canEdit: boolean;
  canFeedback: boolean;
  onClose: () => void;
  onAdvance: (status: CandidateStatus) => Promise<void>;
  onReject: () => Promise<void>;
  onDelete: () => Promise<void>;
  saving: boolean;
}

const CandidateModal: React.FC<CandidateModalProps> = ({
  candidate, jobs, canEdit, canFeedback, onClose, onAdvance, onReject, onDelete, saving,
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [intDate, setIntDate] = useState('');
  const [intTime, setIntTime] = useState('09:00');
  const [intLocation, setIntLocation] = useState('');
  const [intNotes, setIntNotes] = useState('');
  const [savingInt, setSavingInt] = useState(false);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<number, string>>({});
  const [savingFeedbackId, setSavingFeedbackId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const appliedJob = candidate.jobPostingId
    ? jobs.find((j) => j.id === candidate.jobPostingId) ?? null
    : null;
  const jobTitle = appliedJob?.title;
  const appliedTimeSource = candidate.appliedAt ?? candidate.createdAt;
  const appliedAgoLabel = fmtRelativeTime(appliedTimeSource);
  const appliedAtLabel = fmtDateTime(appliedTimeSource);
  const appliedJobLocation = appliedJob
    ? [appliedJob.jobCity ?? appliedJob.city, appliedJob.jobState ?? appliedJob.state, appliedJob.jobCountry ?? appliedJob.country]
      .filter(Boolean)
      .join(', ')
    || t(`ats.remoteType_${appliedJob.remoteType}`, appliedJob.remoteType)
    : null;
  const stageColor = STAGE_COLOR[candidate.status];
  const stageBg = STAGE_BG[candidate.status];
  const next = NEXT_STAGE[candidate.status];

  useEffect(() => {
    getInterviews(candidate.id)
      .then((items) => {
        setInterviews(items);
        setFeedbackDrafts(Object.fromEntries(items.map((iv) => [iv.id, iv.feedback ?? ''])));
      })
      .catch(() => { });
  }, [candidate.id]);

  const handleSaveFeedback = async (interviewId: number) => {
    const value = (feedbackDrafts[interviewId] ?? '').trim();
    if (!value) {
      showToast(t('ats.feedbackRequired'), 'error');
      return;
    }

    setSavingFeedbackId(interviewId);
    try {
      const updated = await updateInterview(interviewId, { feedback: value });
      setInterviews((prev) => prev.map((iv) => (iv.id === interviewId ? updated : iv)));
      showToast(t('ats.feedbackSaved'), 'success');
    } catch {
      showToast(t('ats.feedbackError'), 'error');
    } finally {
      setSavingFeedbackId(null);
    }
  };

  const handleCreateInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intDate) return;
    setSavingInt(true);
    try {
      const scheduledAt = new Date(`${intDate}T${intTime}:00`).toISOString();
      const iv = await createInterview(candidate.id, {
        scheduledAt,
        location: intLocation || undefined,
        notes: intNotes || undefined,
      });
      setInterviews((prev) => [...prev, iv]);
      setShowInterviewForm(false);
      setIntDate(''); setIntTime('09:00'); setIntLocation(''); setIntNotes('');
      showToast(t('ats.interviewCreated'), 'success');
    } catch {
      showToast(t('ats.interviewError'), 'error');
    } finally {
      setSavingInt(false);
    }
  };

  return (
    <>
      <ModalBackdrop onClose={onClose} width={580}>
        {/* Gradient header */}
        <div style={{
          background: `linear-gradient(135deg, ${stageColor}18 0%, ${stageColor}08 100%)`,
          borderBottom: `3px solid ${stageColor}`,
          padding: '24px 28px 20px',
          position: 'relative',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 18, lineHeight: 1,
            width: 28, height: 28, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Avatar */}
            <div style={{
              width: 54, height: 54, borderRadius: '50%', flexShrink: 0,
              background: stageColor, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18,
              boxShadow: `0 4px 16px ${stageColor}40`,
            }}>
              {initials(candidate.fullName)}
            </div>

            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--text-primary)', marginBottom: 4 }}>
                {candidate.fullName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  background: stageColor, color: '#fff',
                  borderRadius: 99, padding: '2px 12px', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                }}>
                  {t(`ats.stage_${candidate.status}`)}
                </span>
                {jobTitle && (
                  <span style={{
                    background: 'var(--surface)', color: 'var(--text-secondary)',
                    border: '1px solid var(--border)', borderRadius: 99,
                    padding: '2px 10px', fontSize: 11,
                  }}>
                    📌 {jobTitle}
                  </span>
                )}
                {candidate.unread && (
                  <span style={{
                    background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE',
                    borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 700,
                  }}>
                    NEW
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Contact grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12,
            background: 'var(--background)', borderRadius: 12, padding: '14px 16px',
          }}>
            {[
              { label: 'Email', value: candidate.email, href: candidate.email ? `mailto:${candidate.email}` : undefined },
              { label: t('ats.phone'), value: candidate.phone, href: candidate.phone ? `tel:${candidate.phone}` : undefined },
              { label: t('ats.source'), value: candidate.source },
              { label: t('ats.appliedAt', 'Applied'), value: `${appliedAgoLabel} · ${appliedAtLabel}` },
            ].filter((i) => i.value).map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
                  {item.label}
                </div>
                {item.href ? (
                  <a href={item.href} style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}>
                    {item.value}
                  </a>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, textTransform: 'capitalize' }}>{item.value}</div>
                )}
              </div>
            ))}
          </div>

          {/* Applied job snapshot */}
          {appliedJob && (
            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 12,
              background: '#fff',
              padding: '12px 14px',
              display: 'grid',
              gap: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                    {t('ats.appliedPosition', 'Applied position')}
                  </span>
                  <strong style={{ fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {appliedJob.title}
                  </strong>
                </div>
                <span style={{
                  borderRadius: 999,
                  border: '1px solid rgba(13,33,55,0.18)',
                  background: 'var(--background)',
                  color: STATUS_COLOR[appliedJob.status],
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  textTransform: 'uppercase',
                }}>
                  {t(`ats.status_${appliedJob.status}`, appliedJob.status)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {appliedJobLocation && (
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <MapPin size={12} />
                    {appliedJobLocation}
                  </span>
                )}
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <BriefcaseBusiness size={12} />
                  {t(`ats.jobType_${JOB_TYPE_LABEL[appliedJob.jobType]}`, appliedJob.jobType)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Globe2 size={12} />
                  {t(`ats.remoteType_${appliedJob.remoteType}`, appliedJob.remoteType)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Clock3 size={12} />
                  {appliedAgoLabel}
                </span>
              </div>
            </div>
          )}

          {/* Tags */}
          {candidate.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {candidate.tags.map((tag) => (
                <span key={tag} style={{
                  background: 'var(--accent-light, rgba(201,151,58,0.10))',
                  color: 'var(--accent)', border: '1px solid rgba(201,151,58,0.2)',
                  borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 500,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Stage pipeline visual */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Pipeline
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {(['received', 'review', 'interview', 'hired'] as CandidateStatus[]).map((s, idx) => {
                const stageIdx = ['received', 'review', 'interview', 'hired', 'rejected'].indexOf(candidate.status);
                const thisIdx = idx;
                const isDone = candidate.status !== 'rejected' && stageIdx >= thisIdx;
                const isCurrent = candidate.status !== 'rejected' && stageIdx === thisIdx;
                const sc = STAGE_COLOR[s];
                return (
                  <React.Fragment key={s}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: isDone ? sc : 'var(--border)',
                        border: isCurrent ? `3px solid ${sc}` : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                        boxShadow: isCurrent ? `0 0 0 3px ${sc}22` : 'none',
                      }}>
                        {isDone && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                      </div>
                      <div style={{ fontSize: 10, color: isDone ? sc : 'var(--text-muted)', fontWeight: isCurrent ? 700 : 400, marginTop: 4, textAlign: 'center' }}>
                        {t(`ats.stage_${s}`)}
                      </div>
                    </div>
                    {idx < 3 && (
                      <div style={{
                        height: 2, flex: 1, marginBottom: 18,
                        background: candidate.status !== 'rejected' && stageIdx > idx ? sc : 'var(--border)',
                        transition: 'background 0.3s',
                      }} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            {candidate.status === 'rejected' && (
              <div style={{
                marginTop: 8, padding: '6px 12px', background: '#FEF2F2',
                border: '1px solid #FCA5A5', borderRadius: 8,
                fontSize: 12, color: '#DC2626', fontWeight: 600, textAlign: 'center',
              }}>
                ✕ {t('ats.stage_rejected')}
              </div>
            )}
          </div>

          {/* Interviews section */}
          {(candidate.status === 'interview' || interviews.length > 0) && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  🗓 {t('ats.interviews')}
                  {interviews.length > 0 && (
                    <span style={{ background: 'var(--primary)', color: 'var(--accent)', borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>
                      {interviews.length}
                    </span>
                  )}
                </div>
                {canEdit && !showInterviewForm && (
                  <Button variant="secondary" size="sm" onClick={() => setShowInterviewForm(true)}>
                    + {t('ats.addInterview')}
                  </Button>
                )}
              </div>

              {interviews.length === 0 && !showInterviewForm && (
                <div style={{
                  background: 'var(--background)', borderRadius: 10, padding: '12px 16px',
                  fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic',
                }}>
                  {t('ats.noInterviews')}
                </div>
              )}

              {interviews.map((iv) => (
                <div key={iv.id} style={{
                  background: 'var(--background)', borderRadius: 10, padding: '12px 16px',
                  marginBottom: 8, borderLeft: `3px solid ${STAGE_COLOR.interview}`,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>
                    🕐 {fmtDateTime(iv.scheduledAt)}
                  </div>
                  {iv.location && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>📍 {iv.location}</div>
                  )}
                  {iv.notes && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{iv.notes}</div>
                  )}
                  {iv.feedback && (
                    <div style={{
                      fontSize: 12, color: 'var(--text-secondary)', marginTop: 6,
                      fontStyle: 'italic', padding: '6px 10px',
                      background: 'var(--surface)', borderRadius: 6, borderLeft: '2px solid var(--accent)',
                    }}>
                      "{iv.feedback}"
                    </div>
                  )}
                  {canFeedback && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <textarea
                        value={feedbackDrafts[iv.id] ?? ''}
                        onChange={(e) => setFeedbackDrafts((prev) => ({ ...prev, [iv.id]: e.target.value }))}
                        rows={2}
                        placeholder={t('ats.feedbackPlaceholder')}
                        style={{
                          flex: 1,
                          fontFamily: 'inherit',
                          fontSize: 12,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          padding: '7px 9px',
                          resize: 'vertical',
                          background: 'var(--surface)',
                        }}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSaveFeedback(iv.id)}
                        loading={savingFeedbackId === iv.id}
                      >
                        {t('common.save')}
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {canEdit && showInterviewForm && (
                <form onSubmit={handleCreateInterview} style={{
                  background: 'var(--background)', borderRadius: 12, padding: '16px',
                  display: 'flex', flexDirection: 'column', gap: 12,
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                        {t('ats.interviewDate')} *
                      </label>
                      <input type="date" className="field-input" value={intDate} onChange={(e) => setIntDate(e.target.value)} required
                        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', outline: 'none', display: 'block' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                        {t('ats.interviewTime')}
                      </label>
                      <input type="time" className="field-input" value={intTime} onChange={(e) => setIntTime(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', outline: 'none', display: 'block' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                      {t('ats.interviewLocation')}
                    </label>
                    <input className="field-input" value={intLocation} onChange={(e) => setIntLocation(e.target.value)}
                      placeholder={t('ats.interviewLocationPlaceholder')}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', outline: 'none', display: 'block' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                      {t('common.notes')}
                    </label>
                    <textarea className="field-input" value={intNotes} onChange={(e) => setIntNotes(e.target.value)} rows={2}
                      style={{ width: '100%', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit', padding: '7px 10px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', outline: 'none', display: 'block' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Button variant="secondary" size="sm" type="button" onClick={() => setShowInterviewForm(false)}>
                      {t('common.cancel')}
                    </Button>
                    <Button variant="primary" size="sm" type="submit" loading={savingInt}>
                      {t('ats.scheduleInterview')}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Action footer */}
          {canEdit && candidate.status !== 'hired' && candidate.status !== 'rejected' && (
            <div style={{
              display: 'flex', gap: 8, flexWrap: 'wrap',
              paddingTop: 16, borderTop: '1px solid var(--border)',
            }}>
              {next && (
                <Button variant="primary" onClick={() => onAdvance(next)} loading={saving} style={{ flex: 1, minWidth: 140 }}>
                  {t(`ats.advanceTo_${next}`)}
                </Button>
              )}
              <Button
                variant="danger"
                onClick={onReject}
                loading={saving}
                style={{ flex: 1, minWidth: 100 }}
              >
                {t('ats.reject')}
              </Button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving}
                style={{
                  background: 'var(--background)', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', borderRadius: 'var(--radius)',
                  cursor: 'pointer', padding: '8px 12px', fontSize: 16, lineHeight: 1,
                  flexShrink: 0,
                }}
                title={t('common.delete')}
              >
                🗑
              </button>
            </div>
          )}
        </div>
      </ModalBackdrop>

      {showDeleteConfirm && (
        <ModalBackdrop onClose={() => setShowDeleteConfirm(false)} width={430} closeOnBackdropClick={!saving}>
          <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('common.delete', 'Delete')} {t('ats.candidate', 'candidate')}
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {t('ats.confirmDeleteCandidate', { name: candidate.fullName })}
            </p>
          </div>
          <div style={{ padding: '14px 22px 18px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setShowDeleteConfirm(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              type="button"
              loading={saving}
              onClick={async () => {
                await onDelete();
                setShowDeleteConfirm(false);
              }}
            >
              {t('common.delete', 'Delete')}
            </Button>
          </div>
        </ModalBackdrop>
      )}
    </>
  );
};

// ─── Jobs Panel ────────────────────────────────────────────────────────────────

const JobsPanel: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { isMobile } = useBreakpoint();
  const { user, targetCompanyId, allowedCompanyIds } = useAuth();
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editJob, setEditJob] = useState<JobPosting | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [feedCopied, setFeedCopied] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);

  const defaultCompanyId = useMemo(() => {
    if (targetCompanyId) return targetCompanyId;
    if (user?.companyId) return user.companyId;
    return companies[0]?.id ?? null;
  }, [targetCompanyId, user?.companyId, companies]);

  const feedCompanyId = useMemo(() => {
    if (targetCompanyId) return targetCompanyId;
    if (user?.companyId) return user.companyId;
    return companies.length === 1 ? companies[0].id : null;
  }, [targetCompanyId, user?.companyId, companies]);

  const feedUrl = feedCompanyId
    ? `${getApiBaseUrl()}/ats/feed/${feedCompanyId}/jobs.xml`
    : null;

  const handleCopyFeed = () => {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl).then(() => {
      setFeedCopied(true);
      showToast(t('ats.feedCopied'), 'success');
      setTimeout(() => setFeedCopied(false), 2500);
    });
  };

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: string; companyId?: number } = {};
      if (filterStatus) params.status = filterStatus;
      if (!user?.isSuperAdmin && defaultCompanyId) {
        params.companyId = defaultCompanyId;
      }
      setJobs(await getJobs(Object.keys(params).length > 0 ? params : undefined));
    } catch {
      showToast(t('ats.errorLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, user?.isSuperAdmin, defaultCompanyId, showToast, t]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (!canEdit) return;
    Promise.all([
      getStores().catch(() => [] as Store[]),
      getCompanies().catch(() => [] as Company[]),
    ])
      .then(([storeItems, companyItems]) => {
        setStores(storeItems);
        setCompanies(companyItems);
      })
      .catch(() => {
        setStores([]);
        setCompanies([]);
      });
  }, [canEdit]);

  const handleSave = async (payload: {
    title: string;
    description: string;
    tags: string[];
    language: JobLanguage;
    jobType: JobType;
    remoteType: RemoteType;
    locationOverride: {
      city: string;
      state: string;
      country: string;
      postalCode: string;
      address: string;
    };
    companyId: number;
    storeId: number | null;
    department: string;
    weeklyHours: number | null;
    contractType: string;
    status: JobStatus;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryPeriod: string | null;
    targetRole: string | null;
  }) => {
    setSaving(true);
    try {
      if (editJob) {
        const updated = await updateJob(editJob.id, {
          title: payload.title,
          description: payload.description,
          tags: payload.tags,
          status: payload.status,
          companyId: payload.companyId,
          language: payload.language,
          jobType: payload.jobType,
          storeId: payload.storeId,
          isRemote: payload.remoteType === 'remote',
          remoteType: payload.remoteType,
          jobCity: payload.remoteType === 'remote' ? null : (payload.locationOverride.city || null),
          jobState: payload.remoteType === 'remote' ? null : (payload.locationOverride.state || null),
          jobCountry: payload.remoteType === 'remote' ? null : (payload.locationOverride.country || null),
          jobPostalCode: payload.remoteType === 'remote' ? null : (payload.locationOverride.postalCode || null),
          jobAddress: payload.remoteType === 'remote' ? null : (payload.locationOverride.address || null),
          department: payload.department || null,
          weeklyHours: payload.weeklyHours,
          contractType: payload.contractType || null,
          salaryMin: payload.salaryMin,
          salaryMax: payload.salaryMax,
          salaryPeriod: payload.salaryPeriod,
          targetRole: payload.targetRole,
        });
        setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
        showToast(t('ats.jobUpdated'), 'success');
      } else {
        const created = await createJob({
          title: payload.title,
          description: payload.description,
          tags: payload.tags,
          companyId: payload.companyId,
          status: payload.status,
          language: payload.language,
          jobType: payload.jobType,
          storeId: payload.storeId ?? undefined,
          isRemote: payload.remoteType === 'remote',
          remoteType: payload.remoteType,
          jobCity: payload.remoteType === 'remote' ? undefined : (payload.locationOverride.city || undefined),
          jobState: payload.remoteType === 'remote' ? undefined : (payload.locationOverride.state || undefined),
          jobCountry: payload.remoteType === 'remote' ? undefined : (payload.locationOverride.country || undefined),
          jobPostalCode: payload.remoteType === 'remote' ? undefined : (payload.locationOverride.postalCode || undefined),
          jobAddress: payload.remoteType === 'remote' ? undefined : (payload.locationOverride.address || undefined),
          department: payload.department || undefined,
          weeklyHours: payload.weeklyHours ?? undefined,
          contractType: payload.contractType || undefined,
          salaryMin: payload.salaryMin ?? undefined,
          salaryMax: payload.salaryMax ?? undefined,
          salaryPeriod: payload.salaryPeriod ?? undefined,
          targetRole: payload.targetRole ?? undefined,
        });
        setJobs((prev) => [created, ...prev]);
        showToast(t('ats.jobCreated'), 'success');
      }
      await fetch();
      setShowModal(false); setEditJob(null);
    } catch (err) {
      showToast(translateApiError(err, t, t('ats.errorSave')) ?? t('ats.errorSave'), 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (job: JobPosting) => {
    if (!confirm(t('ats.confirmDeleteJob', { title: job.title }))) return;
    try {
      await deleteJob(job.id, { companyId: job.companyId });
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      await fetch();
      showToast(t('ats.jobDeleted'), 'success');
    } catch { showToast(t('ats.errorDelete'), 'error'); }
  };

  const handlePublish = async (job: JobPosting) => {
    try {
      const updated = await publishJob(job.id, { companyId: job.companyId });
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      await fetch();
      showToast(t('ats.jobPublished'), 'success');
    } catch { showToast(t('ats.errorPublish'), 'error'); }
  };

  // Status counts
  const counts = { all: jobs.length, draft: jobs.filter((j) => j.status === 'draft').length, published: jobs.filter((j) => j.status === 'published').length, closed: jobs.filter((j) => j.status === 'closed').length };
  const careersPreviewUrl = `${window.location.origin}/careers`;
  const locale = i18n.language?.startsWith('it') ? 'it-IT' : 'en-GB';
  const companyMap = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const storeMap = useMemo(() => new Map(stores.map((store) => [store.id, store])), [stores]);

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 20,
        alignItems: isMobile ? 'stretch' : 'center',
        flexWrap: 'wrap',
        flexDirection: isMobile ? 'column' : 'row'
      }}>
        {/* Status filter pills */}
        <div style={{
          display: 'flex',
          gap: isMobile ? 4 : 6,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 4,
          width: isMobile ? '100%' : 'fit-content',
          justifyContent: isMobile ? 'space-between' : 'flex-start'
        }}>
          {[
            { value: '', label: t('common.all'), count: counts.all },
            { value: 'draft', label: t('ats.status_draft'), count: counts.draft },
            { value: 'published', label: t('ats.status_published'), count: counts.published },
            { value: 'closed', label: t('ats.status_closed'), count: counts.closed },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              style={{
                padding: isMobile ? '5px 8px' : '5px 12px',
                border: 'none', borderRadius: 7,
                background: filterStatus === opt.value ? 'var(--primary)' : 'transparent',
                color: filterStatus === opt.value ? '#fff' : 'var(--text-secondary)',
                fontWeight: filterStatus === opt.value ? 600 : 400,
                fontSize: isMobile ? 12 : 13,
                cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: 'var(--font-body)',
                flex: isMobile ? 1 : 'none',
                justifyContent: 'center'
              }}
            >
              {opt.label}
              {opt.count > 0 && (
                <span style={{
                  background: filterStatus === opt.value ? 'rgba(255,255,255,0.2)' : 'var(--background)',
                  color: filterStatus === opt.value ? '#fff' : 'var(--text-muted)',
                  borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '0 5px',
                  minWidth: 16, textAlign: 'center',
                }}>
                  {opt.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {canEdit && (
          <div style={{
            marginLeft: isMobile ? '0' : 'auto',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            width: isMobile ? '100%' : 'auto',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center'
          }}>
            <div style={{
              display: 'flex',
              gap: 8,
              width: isMobile ? '100%' : 'auto'
            }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (!careersPreviewUrl) return;
                  window.open(careersPreviewUrl, '_blank', 'noopener,noreferrer');
                }}
                disabled={!careersPreviewUrl}
                fullWidth={isMobile}
              >
                {t('ats.openCareersPage', 'Open careers page')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowComplianceModal(true)}
                fullWidth={isMobile}
              >
                {t('ats.complianceCheck')}
              </Button>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => { setEditJob(null); setShowModal(true); }}
              fullWidth={isMobile}
            >
              <span style={{ fontSize: 16 }}>+</span> {t('ats.newJob')}
            </Button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 14, padding: '8px 10px', borderRadius: 9, background: 'rgba(2,132,199,0.08)', border: '1px solid rgba(2,132,199,0.18)', color: '#0F4C81', fontSize: 12.5 }}>
        Careers preview lists <strong>draft</strong> and <strong>published</strong> jobs. XML feed still exports only <strong>published</strong> jobs for active companies.
      </div>

      {/* Feed URL banner */}
      {canEdit && feedUrl && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(13,33,55,0.04) 0%, rgba(201,151,58,0.06) 100%)',
          border: '1px solid var(--border)',
          borderLeft: '3px solid var(--accent)',
          borderRadius: 12,
          padding: '14px 18px',
          marginBottom: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              📡 {t('ats.feedTitle')}
            </span>
            <span style={{
              background: 'rgba(201,151,58,0.15)', color: '#92600a',
              borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '2px 7px',
              border: '1px solid rgba(201,151,58,0.25)',
            }}>
              {t('ats.indeedApiPending')}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {t('ats.indeedApiPendingHint')}
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{
              flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 7, padding: '6px 10px', fontSize: 11.5,
              color: 'var(--text-primary)', fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {feedUrl}
            </code>
            <Button variant="secondary" size="sm" onClick={handleCopyFeed} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              {feedCopied ? '✓ ' + t('common.copied', 'Copied') : t('common.copy', 'Copy URL')}
            </Button>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {t('ats.feedHint')}
          </p>
        </div>
      )}

      {/* Job list */}
      {loading ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 22px', display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 16, width: '35%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 12, width: '60%', marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="skeleton" style={{ height: 20, width: 50, borderRadius: 99 }} />
                  <div className="skeleton" style={{ height: 20, width: 60, borderRadius: 99 }} />
                </div>
              </div>
              <div className="skeleton" style={{ height: 28, width: 80, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '56px 24px',
          background: 'var(--surface)', borderRadius: 16,
          border: '1px dashed var(--border)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>💼</div>
          <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: 6 }}>
            {t('ats.noJobs')}
          </div>
          {canEdit && (
            <div style={{ marginTop: 16 }}>
              <Button variant="primary" onClick={() => setShowModal(true)}>
                + {t('ats.newJob')}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {jobs.map((job) => {
            const sc = STATUS_COLOR[job.status];
            const isHovered = hoveredId === job.id;
            const company = companyMap.get(job.companyId);
            const store = job.storeId ? storeMap.get(job.storeId) : null;
            const companyLogo = getCompanyLogoUrl(company?.logoFilename ?? null);
            const companyOwnerAvatar = getAvatarUrl(company?.ownerAvatarFilename ?? null);
            const storeLogo = getStoreLogoUrl(store?.logoFilename ?? null);
            const languageFlags = languageFlagCodes(job.language);
            const locationSummary = [job.city, job.state, job.country].filter(Boolean).join(', ') || t('ats.remoteType_remote', 'Remote');
            const salarySummary = formatEuroRange(job.salaryMin, job.salaryMax, locale, t('common.noData'));
            return (
              <div
                key={job.id}
                onMouseEnter={() => setHoveredId(job.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderLeft: `4px solid ${sc}`,
                  borderRadius: 14, padding: '16px 20px',
                  display: 'grid', gap: 12,
                  transition: 'box-shadow 0.18s, transform 0.18s',
                  boxShadow: isHovered ? 'var(--shadow)' : 'none',
                  transform: isHovered ? 'translateY(-1px)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{job.title}</span>
                  <span style={{
                    background: `${sc}14`, color: sc, borderRadius: 99,
                    padding: '2px 10px', fontSize: 11, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {t(`ats.status_${job.status}`)}
                  </span>
                </div>

                {job.description && (
                  <div style={{
                    fontSize: 12.5, color: 'var(--text-muted)',
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {job.description}
                  </div>
                )}

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 9,
                }}>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px', background: 'rgba(13,33,55,0.03)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 700 }}>
                      {t('nav.companies')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(13,33,55,0.14)', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {companyLogo ? <img src={companyLogo} alt={company?.name ?? `Company ${job.companyId}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Building2 size={14} color="#64748B" />}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {company?.name ?? `Company #${job.companyId}`}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {company?.groupName ?? '-'}
                        </div>
                      </div>
                      {companyOwnerAvatar ? <img src={companyOwnerAvatar} alt="Owner" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} /> : null}
                    </div>
                  </div>

                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px', background: 'rgba(13,33,55,0.03)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 700 }}>
                      {t('common.store', 'Store')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(13,33,55,0.14)', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {storeLogo ? <img src={storeLogo} alt={store?.name ?? 'Store'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <StoreIcon size={14} color="#64748B" />}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {store?.name ?? (job.storeId ? `Store #${job.storeId}` : '-')}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {store?.code ? `Code ${store.code}` : '-'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px', background: 'rgba(13,33,55,0.03)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 700 }}>
                      {t('ats.location', 'Location')}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin size={13} color="#64748B" />
                      {locationSummary}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                      {job.remoteType === 'remote' ? t('ats.remoteType_remote', 'Remote') : t(`ats.remoteType_${job.remoteType}`, job.remoteType)}
                    </div>
                  </div>

                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px', background: 'rgba(13,33,55,0.03)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 700 }}>
                      {t('ats.salaryRange', 'Salary range')}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Wallet size={13} color="#64748B" />
                      {salarySummary}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                      {job.weeklyHours ? `${job.weeklyHours}h` : t('common.noData')}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{
                      background: 'rgba(13,33,55,0.08)',
                      color: 'var(--text-secondary)',
                      border: '1px solid rgba(13,33,55,0.14)',
                      borderRadius: 99,
                      padding: '2px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}>
                      {languageFlags.map((code) => (
                        <span key={`${job.id}-${code}`} style={{ marginRight: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <ReactCountryFlag countryCode={code} svg style={{ width: '0.95em', height: '0.95em' }} />
                        </span>
                      ))}
                      {job.language}
                    </span>
                    <span style={{
                      background: 'rgba(2,132,199,0.10)',
                      color: '#0369A1',
                      border: '1px solid rgba(2,132,199,0.22)',
                      borderRadius: 99,
                      padding: '2px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                    }}>
                      {t(`ats.jobType_${JOB_TYPE_LABEL[job.jobType]}`)}
                    </span>
                    {job.tags.map((tag) => (
                      <span key={`${job.id}-${tag}`} style={{
                        background: 'rgba(201,151,58,0.10)', color: 'var(--accent)',
                        border: '1px solid rgba(201,151,58,0.2)',
                        borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 500,
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                    {job.publishedAt && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        📅 {fmtDate(job.publishedAt)}
                      </span>
                    )}
                    {canEdit && (
                      <>
                        {job.status === 'draft' && (
                          <Button variant="accent" size="sm" onClick={() => handlePublish(job)}>
                            {t('ats.publish')}
                          </Button>
                        )}
                        <button
                          onClick={() => { setEditJob(job); setShowModal(true); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                          title={t('common.edit')}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(job)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px' }}
                          title={t('common.delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <JobModal
          job={editJob}
          stores={stores}
          companies={companies}
          defaultCompanyId={defaultCompanyId}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditJob(null); }}
          saving={saving}
        />
      )}

      {showComplianceModal && (
        <ModalBackdrop onClose={() => setShowComplianceModal(false)} width={980}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{t('ats.complianceCheckTitle')}</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                {jobs.length} job postings - each row shows compliance percentage and detailed checks.
              </p>
            </div>
            <button onClick={() => setShowComplianceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 22, lineHeight: 1 }}>×</button>
          </div>

          <div style={{ padding: '16px 22px', display: 'grid', gap: 10 }}>
            {jobs.length === 0 && (
              <div style={{ borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-muted)' }}>
                {t('ats.complianceNoPublishedJobs')}
              </div>
            )}

            {jobs.map((job) => {
              const score = complianceScore(job);
              const barColor = score.percentage >= 80 ? '#15803D' : score.percentage >= 55 ? '#C9973A' : '#DC2626';

              return (
                <details key={job.id} style={{ border: '1px solid var(--border)', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
                  <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '10px 12px', display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{job.title}</strong>
                      <span style={{ fontSize: 11, borderRadius: 99, padding: '2px 8px', background: 'rgba(13,33,55,0.08)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                        {job.status}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: barColor }}>
                        {score.percentage}% ({score.passed}/{score.total})
                      </span>
                    </div>

                    <div style={{ height: 8, borderRadius: 999, background: '#E2E8F0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${score.percentage}%`, background: barColor }} />
                    </div>
                  </summary>

                  <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px', display: 'grid', gap: 7 }}>
                    {score.checks.map((check) => (
                      <div key={`${job.id}-${check.key}`} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{ fontWeight: 800, color: check.ok ? '#166534' : '#B91C1C', minWidth: 16 }}>
                          {check.ok ? '✓' : '✗'}
                        </span>
                        <span style={{ color: 'var(--text-primary)', fontSize: 12.5 }}>{check.label}</span>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}

            <div style={{
              marginTop: 4,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(201,151,58,0.35)',
              background: 'rgba(201,151,58,0.08)',
              color: '#5F4308',
              fontSize: 12.5,
              lineHeight: 1.5,
            }}>
              <div>
                Note: Indeed deprecated free XML crawling in March 2026. This checker validates feed readiness and field quality.
              </div>
              <div>
                Nota: Indeed ha deprecato il crawling XML gratuito da marzo 2026. Questa verifica controlla completezza e conformita del feed.
              </div>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </div>
  );
};

// ─── Kanban Panel ─────────────────────────────────────────────────────────────

const KanbanPanel: React.FC<{ canEdit: boolean; canFeedback: boolean }> = ({ canEdit, canFeedback }) => {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { isMobile } = useBreakpoint();
  const { user, targetCompanyId, allowedCompanyIds } = useAuth();
  const { socket } = useSocket();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterJob, setFilterJob] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [addJobId, setAddJobId] = useState<string>('');
  const [addFirstName, setAddFirstName] = useState('');
  const [addLastName, setAddLastName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addLinkedinUrl, setAddLinkedinUrl] = useState('');
  const [addCvFile, setAddCvFile] = useState<File | null>(null);
  const [addCoverLetter, setAddCoverLetter] = useState('');
  const [addGdprConsent, setAddGdprConsent] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addModalJobs, setAddModalJobs] = useState<JobPosting[]>([]);
  const [addModalJobsLoading, setAddModalJobsLoading] = useState(false);

  const hasMultiCompanyScope = (allowedCompanyIds?.length ?? 0) > 1;
  const effectiveCompanyId = hasMultiCompanyScope
    ? undefined
    : (targetCompanyId ?? (user?.isSuperAdmin ? undefined : user?.companyId ?? undefined));
  const scopedCompanyId = user?.isSuperAdmin ? undefined : effectiveCompanyId;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [cands, js] = await Promise.all([
        getCandidates(filterJob ? { jobId: parseInt(filterJob, 10), companyId: effectiveCompanyId } : { companyId: effectiveCompanyId }),
        getJobs(scopedCompanyId ? { companyId: scopedCompanyId } : undefined),
      ]);
      setCandidates(cands); setJobs(js);
    } catch { showToast(t('ats.errorLoad'), 'error'); }
    finally { setLoading(false); }
  }, [filterJob, effectiveCompanyId, scopedCompanyId, showToast, t]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (!socket) return;

    const handleRealtimeCandidate = (payload: { candidate?: Candidate }) => {
      const incoming = payload?.candidate;
      if (!incoming || typeof incoming.id !== 'number') return;

      if (effectiveCompanyId && incoming.companyId !== effectiveCompanyId) {
        return;
      }

      if (user?.role === 'store_manager' && incoming.storeId !== user.storeId) {
        return;
      }

      if (filterJob) {
        const selectedJobId = Number.parseInt(filterJob, 10);
        if (!Number.isNaN(selectedJobId) && incoming.jobPostingId !== selectedJobId) {
          return;
        }
      }

      setCandidates((prev) => {
        if (prev.some((c) => c.id === incoming.id)) return prev;
        return [incoming, ...prev];
      });
    };

    socket.on('ATS_CANDIDATE_CREATED', handleRealtimeCandidate);
    return () => {
      socket.off('ATS_CANDIDATE_CREATED', handleRealtimeCandidate);
    };
  }, [socket, filterJob, user?.role, user?.storeId, effectiveCompanyId]);

  const byStage = (stage: CandidateStatus) =>
    candidates.filter((c) => c.status === stage).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const handleAdvance = async (status: CandidateStatus) => {
    if (!canEdit) return;
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await updateCandidateStage(selected.id, status);
      setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setSelected(updated);
      showToast(t('ats.stageUpdated'), 'success');
    } catch (err) {
      showToast(translateApiError(err, t, t('ats.errorStage')) ?? t('ats.errorStage'), 'error');
    } finally { setSaving(false); }
  };

  const handleReject = async () => {
    if (!canEdit) return;
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await updateCandidateStage(selected.id, 'rejected');
      setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setSelected(null);
      showToast(t('ats.candidateRejected'), 'success');
    } catch { showToast(t('ats.errorStage'), 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!canEdit) return;
    if (!selected) return;
    setSaving(true);
    try {
      await deleteCandidate(selected.id);
      setCandidates((prev) => prev.filter((c) => c.id !== selected.id));
      setSelected(null);
      showToast(t('ats.candidateDeleted'), 'success');
    } catch (err) {
      showToast(translateApiError(err, t, t('ats.errorDelete')) ?? t('ats.errorDelete'), 'error');
    }
    finally { setSaving(false); }
  };

  const handleAddCandidate = async () => {
    if (addSaving) return;

    if (addStep !== 2) {
      setAddStep(2);
      return;
    }

    if (!addJobId) {
      showToast(t('ats.noPosition', 'No position selected'), 'error');
      return;
    }

    const parsedAddJobId = Number.parseInt(addJobId, 10);
    if (Number.isNaN(parsedAddJobId)) {
      showToast(t('ats.noPosition', 'No position selected'), 'error');
      return;
    }

    const normalizedName = [addFirstName.trim(), addLastName.trim()]
      .filter(Boolean)
      .join(' ')
      || addEmail.trim()
      || t('ats.defaultCandidateName', 'Candidate');

    setAddSaving(true);
    try {
      const c = await createCandidate({
        fullName: normalizedName,
        email: addEmail.trim() || undefined,
        phone: addPhone.trim() || undefined,
        jobPostingId: parsedAddJobId,
        storeId: addSelectedJob?.storeId ?? undefined,
        linkedinUrl: addLinkedinUrl.trim() || undefined,
        coverLetter: addCoverLetter.trim() || undefined,
        gdprConsent: addGdprConsent,
        resumeFile: addCvFile,
        source: 'internal_manual',
        appliedAt: new Date().toISOString(),
      });
      setCandidates((prev) => {
        if (effectiveCompanyId && c.companyId !== effectiveCompanyId) {
          return prev;
        }
        return [c, ...prev];
      });
      closeAddCandidateModal();
      showToast(t('ats.candidateAdded'), 'success');
    } catch (err) {
      showToast(translateApiError(err, t, t('ats.errorSave')) ?? t('ats.errorSave'), 'error');
    }
    finally { setAddSaving(false); }
  };

  const STAGE_LABELS: Record<CandidateStatus, string> = {
    received: t('ats.stage_received'),
    review: t('ats.stage_review'),
    interview: t('ats.stage_interview'),
    hired: t('ats.stage_hired'),
    rejected: t('ats.stage_rejected'),
  };

  const STAGE_ICON: Record<CandidateStatus, string> = {
    received: '📥',
    review: '🔍',
    interview: '🎤',
    hired: '✅',
    rejected: '✕',
  };

  const addSelectionJobs = addModalJobs.length > 0 ? addModalJobs : jobs;
  const publishedJobs = addSelectionJobs.filter((j) => String(j.status).toLowerCase() === 'published');
  const draftJobs = addSelectionJobs.filter((j) => String(j.status).toLowerCase() === 'draft');
  const closedJobs = addSelectionJobs.filter((j) => String(j.status).toLowerCase() === 'closed');
  const addSelectedJob = addSelectionJobs.find((job) => String(job.id) === addJobId) ?? null;

  const resetAddCandidateForm = useCallback(() => {
    setAddStep(1);
    setAddJobId('');
    setAddFirstName('');
    setAddLastName('');
    setAddEmail('');
    setAddPhone('');
    setAddLinkedinUrl('');
    setAddCvFile(null);
    setAddCoverLetter('');
    setAddGdprConsent(false);
  }, []);

  const loadAddModalJobs = useCallback(async () => {
    setAddModalJobsLoading(true);
    try {
      const [publishedResult, draftResult, closedResult, allResult] = await Promise.allSettled([
        getJobs(scopedCompanyId ? { status: 'published', companyId: scopedCompanyId } : { status: 'published' }),
        getJobs(scopedCompanyId ? { status: 'draft', companyId: scopedCompanyId } : { status: 'draft' }),
        getJobs(scopedCompanyId ? { status: 'closed', companyId: scopedCompanyId } : { status: 'closed' }),
        getJobs(scopedCompanyId ? { companyId: scopedCompanyId } : undefined),
      ]);

      const published = publishedResult.status === 'fulfilled' ? publishedResult.value : [];
      const draft = draftResult.status === 'fulfilled' ? draftResult.value : [];
      const closed = closedResult.status === 'fulfilled' ? closedResult.value : [];
      const allJobs = allResult.status === 'fulfilled' ? allResult.value : [];

      const publishedIds = new Set(published.map((item) => item.id));
      const draftIds = new Set(draft.map((item) => item.id));
      const mergedFromStatus = [
        ...published,
        ...draft.filter((item) => !publishedIds.has(item.id)),
        ...closed.filter((item) => !publishedIds.has(item.id) && !draftIds.has(item.id)),
      ];
      const merged = mergedFromStatus.length > 0
        ? mergedFromStatus
        : allJobs.filter((item) => {
          const normalizedStatus = String(item.status).toLowerCase();
          return normalizedStatus === 'published' || normalizedStatus === 'draft' || normalizedStatus === 'closed';
        });

      setAddModalJobs(merged);
    } finally {
      setAddModalJobsLoading(false);
    }
  }, [scopedCompanyId]);

  const renderAddModalJobDetails = useCallback((jobOption: JobPosting, tone: 'published' | 'draft' | 'closed') => {
    const postedByName = [jobOption.createdByName, jobOption.createdBySurname].filter(Boolean).join(' ').trim()
      || (jobOption.createdById ? `User #${jobOption.createdById}` : t('common.notSet', 'Not set'));
    const creatorAvatarUrl = getAvatarUrl(jobOption.createdByAvatarFilename ?? null);
    const locationLabel = [jobOption.jobCity ?? jobOption.city, jobOption.jobState ?? jobOption.state, jobOption.jobCountry ?? jobOption.country]
      .filter(Boolean)
      .join(', ')
      || t(`ats.remoteType_${jobOption.remoteType}`, jobOption.remoteType);
    const companyLabel = jobOption.companyName || `Company #${jobOption.companyId}`;
    const toneColor = tone === 'published' ? '#166534' : tone === 'draft' ? '#92400E' : '#991B1B';
    const chipBackground = tone === 'published' ? 'rgba(22,163,74,0.08)' : tone === 'draft' ? 'rgba(245,158,11,0.10)' : 'rgba(239,68,68,0.08)';
    const chipBorder = tone === 'published' ? '1px solid rgba(22,163,74,0.22)' : tone === 'draft' ? '1px solid rgba(245,158,11,0.28)' : '1px solid rgba(239,68,68,0.24)';
    const salaryLabel = formatEuroRange(jobOption.salaryMin, jobOption.salaryMax, i18n.language || 'it-IT', t('common.notSet', 'Not set'));
    const postedAtSource = jobOption.publishedAt ?? jobOption.createdAt;

    return (
      <>
        <strong style={{ fontSize: 13.5, color: toneColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {jobOption.title}
        </strong>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: toneColor, background: chipBackground, border: chipBorder, borderRadius: 999, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Building2 size={11} /> {companyLabel}
          </span>
          {jobOption.storeName && (
            <span style={{ fontSize: 11, color: toneColor, background: chipBackground, border: chipBorder, borderRadius: 999, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <StoreIcon size={11} /> {jobOption.storeName}
            </span>
          )}
          <span style={{ fontSize: 11, color: toneColor, background: chipBackground, border: chipBorder, borderRadius: 999, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Languages size={11} /> {jobOption.language.toUpperCase()}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: toneColor, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <BriefcaseBusiness size={11} /> {t(`ats.jobType_${JOB_TYPE_LABEL[jobOption.jobType]}`, jobOption.jobType)}
          </span>
          <span style={{ fontSize: 11, color: toneColor, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Globe2 size={11} /> {t(`ats.remoteType_${jobOption.remoteType}`, jobOption.remoteType)}
          </span>
          {jobOption.department && (
            <span style={{ fontSize: 11, color: toneColor, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <FileText size={11} /> {jobOption.department}
            </span>
          )}
          {jobOption.contractType && (
            <span style={{ fontSize: 11, color: toneColor, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <BadgeCheck size={11} /> {jobOption.contractType}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: toneColor, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={11} /> {locationLabel}
          </span>
          <span style={{ fontSize: 11, color: toneColor, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Wallet size={11} /> {salaryLabel}
          </span>
          <span style={{ fontSize: 11, color: toneColor, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock3 size={11} /> {jobOption.weeklyHours ?? '-'} {t('ats.hoursPerWeek', 'hrs/week')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, minWidth: 0 }}>
          <span style={{ width: 18, height: 18, borderRadius: '50%', border: chipBorder, background: '#fff', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 9, fontWeight: 700, color: toneColor }}>
            {creatorAvatarUrl ? <img src={creatorAvatarUrl} alt={postedByName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(postedByName)}
          </span>
          <span style={{ fontSize: 11, color: toneColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {postedByName}
          </span>
          <span style={{ color: toneColor, opacity: 0.45 }}>•</span>
          <span style={{ fontSize: 11, color: toneColor, whiteSpace: 'nowrap' }}>{fmtRelativeTime(postedAtSource)}</span>
        </div>
      </>
    );
  }, [i18n.language, t]);

  useEffect(() => {
    if (!showAddModal) return;
    void loadAddModalJobs();
  }, [showAddModal, loadAddModalJobs]);

  const openAddCandidateModal = () => {
    resetAddCandidateForm();
    setShowAddModal(true);
  };

  const closeAddCandidateModal = () => {
    setShowAddModal(false);
    setAddModalJobs([]);
    resetAddCandidateForm();
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 20,
        alignItems: isMobile ? 'stretch' : 'center',
        flexWrap: 'wrap',
        flexDirection: isMobile ? 'column' : 'row'
      }}>
        <div style={{ position: 'relative', width: isMobile ? '100%' : 'auto' }}>
          <select
            className="field-select"
            value={filterJob}
            onChange={(e) => setFilterJob(e.target.value)}
            style={{
              width: isMobile ? '100%' : 'auto',
              minWidth: isMobile ? '0' : 200,
              padding: '8px 32px 8px 12px', fontSize: 13,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, color: 'var(--text-primary)', cursor: 'pointer',
              appearance: 'none',
            }}
          >
            <option value="">{t('ats.allJobs')}</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)', fontSize: 11 }}>▼</span>
        </div>

        {/* Pipeline summary */}
        {!loading && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STAGES.filter((s) => byStage(s).length > 0).map((s) => (
              <span key={s} style={{
                fontSize: 11, fontWeight: 600,
                background: STAGE_BG[s], color: STAGE_COLOR[s],
                border: `1px solid ${STAGE_COLOR[s]}30`,
                borderRadius: 99, padding: '3px 9px',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {STAGE_ICON[s]} {byStage(s).length}
              </span>
            ))}
          </div>
        )}

        {canEdit && (
          <Button
            variant="primary"
            size="sm"
            style={{ marginLeft: isMobile ? '0' : 'auto' }}
            onClick={openAddCandidateModal}
            fullWidth={isMobile}
          >
            <span style={{ fontSize: 16 }}>+</span> {t('ats.addCandidate')}
          </Button>
        )}
      </div>

      {/* Board */}
      {loading ? (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
          {STAGES.map((s) => (
            <div key={s} style={{ minWidth: 240, flexShrink: 0, background: 'var(--background)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ height: 4, background: STAGE_COLOR[s] }} />
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton" style={{ height: 12, width: '55%' }} />
              </div>
              <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2].map((i) => (
                  <div key={i} style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div className="skeleton" style={{ height: 11, width: '65%', marginBottom: 6 }} />
                        <div className="skeleton" style={{ height: 10, width: '40%' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
          {STAGES.map((stage) => {
            const sc = STAGE_COLOR[stage];
            const sb = STAGE_BG[stage];
            const cols = byStage(stage);
            return (
              <div
                key={stage}
                style={{
                  minWidth: 252, width: 252, flexShrink: 0,
                  background: 'var(--background)',
                  borderRadius: 14, overflow: 'hidden',
                  border: '1px solid var(--border)',
                }}
              >
                {/* Column top bar */}
                <div style={{ height: 4, background: sc }} />

                {/* Column header */}
                <div style={{
                  padding: '10px 14px 10px',
                  borderBottom: `1px solid var(--border)`,
                  background: sb,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 15 }}>{STAGE_ICON[stage]}</span>
                  <span style={{ fontWeight: 700, fontSize: 12.5, color: sc, flex: 1, fontFamily: 'var(--font-display)' }}>
                    {STAGE_LABELS[stage]}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12,
                    background: sc, color: '#fff', borderRadius: 99, padding: '1px 8px',
                    minWidth: 20, textAlign: 'center',
                  }}>
                    {cols.length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 80 }}>
                  {cols.length === 0 && (
                    <div style={{
                      textAlign: 'center', padding: '20px 8px',
                      color: 'var(--text-muted)', fontSize: 12,
                      border: '1px dashed var(--border)', borderRadius: 10,
                    }}>
                      —
                    </div>
                  )}
                  {cols.map((c) => {
                    const jobName = jobs.find((j) => j.id === c.jobPostingId)?.title;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelected(c)}
                        style={{
                          background: 'var(--surface)',
                          border: `1px solid ${c.unread ? sc : 'var(--border)'}`,
                          borderRadius: 10, padding: '10px 12px',
                          textAlign: 'left', cursor: 'pointer', width: '100%',
                          boxShadow: c.unread
                            ? `0 0 0 2px ${sc}22, 0 2px 8px rgba(0,0,0,0.07)`
                            : '0 1px 3px rgba(0,0,0,0.05)',
                          transition: 'box-shadow 0.15s, transform 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,0.10)`;
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = c.unread ? `0 0 0 2px ${sc}22, 0 2px 8px rgba(0,0,0,0.07)` : '0 1px 3px rgba(0,0,0,0.05)';
                          e.currentTarget.style.transform = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: jobName || c.email ? 6 : 0 }}>
                          {/* Avatar */}
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: sc, color: '#fff',
                            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: `0 2px 6px ${sc}30`,
                          }}>
                            {initials(c.fullName)}
                          </div>

                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{
                              fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {c.fullName}
                            </div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }} title={fmtDateTime(c.appliedAt ?? c.createdAt)}>
                              {fmtRelativeTime(c.appliedAt ?? c.createdAt)}
                            </div>
                          </div>

                          {c.unread && (
                            <div style={{
                              width: 7, height: 7, borderRadius: '50%',
                              background: sc, flexShrink: 0,
                              boxShadow: `0 0 0 2px ${sc}30`,
                            }} />
                          )}
                        </div>

                        {/* Position tag */}
                        {jobName && (
                          <div style={{
                            fontSize: 10.5, color: 'var(--text-muted)',
                            background: 'var(--background)', borderRadius: 5,
                            padding: '2px 7px', marginTop: 2, display: 'inline-block',
                            border: '1px solid var(--border)',
                            maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            📌 {jobName}
                          </div>
                        )}

                        {/* Email */}
                        {c.email && (
                          <div style={{
                            fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            ✉ {c.email}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Candidate Modal */}
      {showAddModal && (
        <ModalBackdrop onClose={closeAddCandidateModal} width={760}>
          <div style={{ padding: '20px 28px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                {t('ats.addCandidate')}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                {addStep === 1
                  ? t('ats.selectPositionStepHint', 'Step 1 of 2: choose the job post first.')
                  : t('ats.optionalCandidateStepHint', 'Step 2 of 2: add candidate details (all optional).')}
              </p>
            </div>
            <button onClick={closeAddCandidateModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 22, padding: '2px 6px' }}>×</button>
          </div>

          <div style={{
            padding: '14px 28px 12px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-warm)',
            display: 'flex',
            alignItems: 'center',
          }}>
            {[1, 2].map((currentStep, index) => (
              <React.Fragment key={currentStep}>
                <div style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    border: addStep >= currentStep ? '1px solid rgba(201,151,58,0.9)' : '1px solid rgba(148,163,184,0.4)',
                    color: addStep >= currentStep ? '#ffffff' : '#64748b',
                    background: addStep >= currentStep ? '#C9973A' : '#fff',
                  }}>
                    {addStep > currentStep ? '✓' : currentStep}
                  </div>
                  <span style={{
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: addStep === currentStep ? '#9A6808' : 'var(--text-muted)',
                    fontWeight: addStep === currentStep ? 700 : 500,
                    whiteSpace: 'nowrap',
                  }}>
                    {currentStep === 1 ? t('ats.position', 'Position') : t('ats.candidateProfile', 'Candidate profile')}
                  </span>
                </div>
                {index === 0 && (
                  <div style={{
                    flex: 1,
                    height: 2,
                    borderRadius: 999,
                    margin: '0 12px 18px',
                    background: addStep > 1 ? '#C9973A' : 'rgba(148,163,184,0.36)',
                  }} />
                )}
              </React.Fragment>
            ))}
          </div>

          <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {addStep === 1 ? (
              <>
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: '#fff', display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {t('ats.selectPositionStepBody', 'Select the role for this candidate. You can add profile details in the next step.')}
                  </div>

                  {addModalJobsLoading ? (
                    <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: '14px 12px', color: 'var(--text-muted)', fontSize: 12.5 }}>
                      {t('common.loading', 'Loading...')}
                    </div>
                  ) : publishedJobs.length === 0 && draftJobs.length === 0 && closedJobs.length === 0 ? (
                    <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: '14px 12px', color: 'var(--text-muted)', fontSize: 12.5 }}>
                      {t('ats.noPosition')}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12, maxHeight: 340, overflowY: 'auto', paddingRight: 2 }}>
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <BadgeCheck size={13} /> {t('ats.status_published', 'Published')}
                        </div>

                        {publishedJobs.length === 0 ? (
                          <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: '10px 11px', color: 'var(--text-muted)', fontSize: 12.5 }}>
                            {t('ats.noPublishedPositions', 'No published positions available.')}
                          </div>
                        ) : publishedJobs.map((jobOption) => {
                          const isSelected = String(jobOption.id) === addJobId;

                          return (
                            <button
                              key={jobOption.id}
                              type="button"
                              onClick={() => setAddJobId(String(jobOption.id))}
                              style={{
                                border: isSelected ? '1px solid rgba(201,151,58,0.62)' : '1px solid var(--border)',
                                borderRadius: 10,
                                padding: '10px 11px',
                                background: isSelected ? 'rgba(201,151,58,0.12)' : '#fff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                                textAlign: 'left',
                              }}
                            >
                              <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                                {renderAddModalJobDetails(jobOption, 'published')}
                              </div>
                              <span style={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                border: isSelected ? '1px solid rgba(201,151,58,0.9)' : '1px solid rgba(148,163,184,0.4)',
                                background: isSelected ? '#C9973A' : '#fff',
                                color: '#fff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 11,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}>
                                {isSelected ? '✓' : ''}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <FileText size={13} /> {t('ats.status_draft', 'Draft')}
                        </div>

                        {draftJobs.length === 0 ? (
                          <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: '10px 11px', color: 'var(--text-muted)', fontSize: 12.5 }}>
                            {t('ats.noDraftPositions', 'No draft positions available.')}
                          </div>
                        ) : draftJobs.map((jobOption) => {
                          const isSelected = String(jobOption.id) === addJobId;

                          return (
                            <button
                              key={`draft-${jobOption.id}`}
                              type="button"
                              onClick={() => setAddJobId(String(jobOption.id))}
                              style={{
                                border: isSelected ? '1px solid rgba(201,151,58,0.62)' : '1px solid rgba(245,158,11,0.28)',
                                borderRadius: 10,
                                padding: '10px 11px',
                                background: isSelected ? 'rgba(201,151,58,0.12)' : 'rgba(245,158,11,0.06)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                                textAlign: 'left',
                              }}
                            >
                              <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                                {renderAddModalJobDetails(jobOption, 'draft')}
                              </div>
                              <span style={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                border: isSelected ? '1px solid rgba(201,151,58,0.9)' : '1px solid rgba(148,163,184,0.4)',
                                background: isSelected ? '#C9973A' : '#fff',
                                color: '#fff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 11,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}>
                                {isSelected ? '✓' : ''}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <Eye size={13} /> {t('ats.status_closed', 'Closed')}
                        </div>

                        {closedJobs.length === 0 ? (
                          <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: '10px 11px', color: 'var(--text-muted)', fontSize: 12.5 }}>
                            {t('ats.noClosedPositions', 'No closed positions available.')}
                          </div>
                        ) : closedJobs.map((jobOption) => {
                          return (
                            <div
                              key={`closed-${jobOption.id}`}
                              style={{
                                border: '1px solid rgba(239,68,68,0.24)',
                                borderRadius: 10,
                                padding: '10px 11px',
                                background: 'rgba(239,68,68,0.06)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                              }}
                            >
                              <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                                {renderAddModalJobDetails(jobOption, 'closed')}
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#991B1B' }}>
                                {t('ats.closedSelectionDisabled', 'Closed')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div style={{ border: '1px solid rgba(201,151,58,0.35)', borderRadius: 10, padding: '9px 11px', background: 'rgba(201,151,58,0.09)', color: '#5F4308', fontSize: 12.5 }}>
                  <strong>{t('ats.position', 'Position')}:</strong> {addSelectedJob?.title ?? '-'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
                  <Input
                    label={t('employees.firstName', 'First name')}
                    value={addFirstName}
                    onChange={(e) => setAddFirstName(e.target.value)}
                    placeholder={t('ats.addCandidateFirstNamePh', 'Mario')}
                    autoFocus
                  />
                  <Input
                    label={t('employees.lastName', 'Last name')}
                    value={addLastName}
                    onChange={(e) => setAddLastName(e.target.value)}
                    placeholder={t('ats.addCandidateLastNamePh', 'Rossi')}
                  />
                  <Input
                    label={t('login.email', 'Email')}
                    type="email"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder={t('ats.addCandidateEmailPh', 'mario@email.com')}
                  />
                  <Input
                    label={t('ats.phone')}
                    type="tel"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder={t('ats.addCandidatePhonePh', '+39 345...')}
                  />
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Input
                      label={t('publicCareers.linkedinLabel', 'LinkedIn URL')}
                      type="url"
                      value={addLinkedinUrl}
                      onChange={(e) => setAddLinkedinUrl(e.target.value)}
                      placeholder={t('ats.addCandidateLinkedinPh', 'https://linkedin.com/in/...')}
                    />
                  </div>
                </div>

                <div
                  style={{
                    border: '1px dashed rgba(201,151,58,0.45)',
                    borderRadius: 12,
                    padding: 14,
                    background: 'rgba(201,151,58,0.06)',
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {t('ats.candidateCvUpload', 'CV / Resume')}
                  </label>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    {t('ats.candidateCvUploadHint', 'PDF, DOC or DOCX — max 5 MB. Optional for internal entries; attach when available.')}
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf"
                    onChange={(e) => setAddCvFile(e.target.files?.[0] ?? null)}
                    style={{ fontSize: 13 }}
                  />
                  {addCvFile && (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {addCvFile.name}
                    </span>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                    {t('publicCareers.coverLetterLabel', 'Cover letter')}
                  </label>
                  <textarea
                    className="field-input"
                    value={addCoverLetter}
                    onChange={(e) => setAddCoverLetter(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder={t('publicCareers.coverLetterPlaceholder', 'Tell us a bit about this candidate profile')}
                    style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', padding: '10px 12px', fontSize: 13.5, borderRadius: 10, border: '1px solid var(--border)', outline: 'none', display: 'block', background: '#fff' }}
                  />
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>{addCoverLetter.length}/1000</div>
                </div>

                <label style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={addGdprConsent}
                    onChange={(e) => setAddGdprConsent(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>{t('publicCareers.privacyConsent', 'Privacy consent collected')}</span>
                </label>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 }}>
              <Button variant="secondary" type="button" onClick={closeAddCandidateModal}>
                {t('common.cancel')}
              </Button>

              {addStep === 2 && (
                <Button variant="secondary" type="button" onClick={() => setAddStep(1)}>
                  ← {t('common.back', 'Back')}
                </Button>
              )}

              {addStep === 1 ? (
                <Button variant="primary" type="button" onClick={() => setAddStep(2)} disabled={!addJobId}>
                  {t('common.next', 'Next')} →
                </Button>
              ) : (
                <Button
                  variant="primary"
                  type="button"
                  loading={addSaving}
                  disabled={!addJobId}
                  onClick={() => { void handleAddCandidate(); }}
                >
                  {t('ats.addCandidate')}
                </Button>
              )}
            </div>
          </div>
        </ModalBackdrop>
      )}

      {selected && (
        <CandidateModal
          candidate={selected}
          jobs={jobs}
          canEdit={canEdit}
          canFeedback={canFeedback}
          onClose={() => setSelected(null)}
          onAdvance={handleAdvance}
          onReject={handleReject}
          onDelete={handleDelete}
          saving={saving}
        />
      )}
    </div>
  );
};

// ─── Alerts Panel ─────────────────────────────────────────────────────────────

const AlertsPanel: React.FC<{ canViewRisks: boolean }> = ({ canViewRisks }) => {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<HRAlert[]>([]);
  const [risks, setRisks] = useState<JobRisk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.allSettled([
      getAlerts(),
      canViewRisks ? getRisks() : Promise.resolve([] as JobRisk[]),
    ])
      .then(([alertsResult, risksResult]) => {
        if (!isMounted) return;

        if (alertsResult.status === 'fulfilled') {
          setAlerts(alertsResult.value);
        } else {
          setAlerts([]);
        }

        if (risksResult.status === 'fulfilled') {
          setRisks(risksResult.value as JobRisk[]);
        } else {
          setRisks([]);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [canViewRisks]);

  const ALERT_ICON: Record<string, string> = {
    new_candidates: '👤',
    interview_today: '🗓',
    candidates_pending: '⏳',
    job_at_risk: '⚠️',
  };

  const ALERT_COLOR: Record<string, string> = {
    new_candidates: '#0284C7',
    interview_today: '#7C3AED',
    candidates_pending: '#C9973A',
    job_at_risk: '#DC2626',
  };

  const RISK_COLORS: Record<string, string> = {
    ok: '#15803D', medium: '#C9973A', high: '#DC2626',
  };

  const RISK_BG: Record<string, string> = {
    ok: 'rgba(21,128,61,0.08)', medium: 'rgba(201,151,58,0.10)', high: 'rgba(220,38,38,0.07)',
  };

  if (loading) return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ background: 'var(--surface)', borderRadius: 14, padding: '18px 20px', border: '1px solid var(--border)', display: 'flex', gap: 14 }}>
          <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 14, width: '55%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 12, width: '80%' }} />
          </div>
        </div>
      ))}
    </div>
  );

  const atRiskJobs = risks.filter((r) => r.riskLevel !== 'ok');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* HR Alerts */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            🔔 {t('ats.hrAlerts')}
          </h3>
          {alerts.length > 0 && (
            <span style={{
              background: '#DC2626', color: '#fff', borderRadius: 99,
              fontSize: 11, fontWeight: 700, padding: '1px 8px',
            }}>
              {alerts.length}
            </span>
          )}
        </div>

        {alerts.length === 0 ? (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '36px 28px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 15, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: 4 }}>
              {t('ats.noAlerts')}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {alerts.map((alert, i) => {
              const ac = ALERT_COLOR[alert.type] ?? '#6B7280';
              return (
                <div key={i} style={{
                  background: 'var(--surface)',
                  border: `1px solid ${ac}25`,
                  borderLeft: `4px solid ${ac}`,
                  borderRadius: 14, padding: '16px 20px',
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                  transition: 'box-shadow 0.15s',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: `${ac}14`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20,
                  }}>
                    {ALERT_ICON[alert.type] ?? '🔔'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {alert.title}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {alert.message}
                    </div>
                    {alert.count > 1 && (
                      <div style={{
                        marginTop: 8, display: 'inline-flex', alignItems: 'center',
                        background: `${ac}14`, color: ac,
                        borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700,
                      }}>
                        {alert.count} items
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* At-risk positions */}
      {canViewRisks && atRiskJobs.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              ⚠️ {t('ats.jobRisks')}
            </h3>
            <span style={{
              background: '#DC262614', color: '#DC2626', border: '1px solid #DC262625',
              borderRadius: 99, fontSize: 11, fontWeight: 700, padding: '1px 8px',
            }}>
              {atRiskJobs.length}
            </span>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {atRiskJobs.map((risk) => {
              const rc = RISK_COLORS[risk.riskLevel];
              const rb = RISK_BG[risk.riskLevel];
              const flags = [
                risk.flags.lowCandidates && t('ats.flag_lowCandidates'),
                risk.flags.noInterviews && t('ats.flag_noInterviews'),
                risk.flags.noHires && t('ats.flag_noHires'),
              ].filter(Boolean) as string[];
              return (
                <div key={risk.jobPostingId} style={{
                  background: 'var(--surface)', border: `1px solid ${rc}25`,
                  borderRadius: 14, padding: '14px 20px',
                  display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: rc, flexShrink: 0,
                    boxShadow: `0 0 0 4px ${rc}20`,
                  }} />
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {risk.jobTitle}
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {flags.map((flag) => (
                        <span key={flag} style={{
                          background: `${rc}12`, color: rc,
                          border: `1px solid ${rc}25`,
                          borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 500,
                        }}>
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span style={{
                    background: rb, color: rc,
                    border: `1px solid ${rc}25`,
                    borderRadius: 99, padding: '4px 14px', fontSize: 12, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    flexShrink: 0,
                  }}>
                    {t(`ats.risk_${risk.riskLevel}`)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main ATSPage ─────────────────────────────────────────────────────────────

export default function ATSPage() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const canEdit = !!user && ['admin', 'hr'].includes(user.role);
  const canViewRisks = !!user && ['admin', 'hr'].includes(user.role);
  const canFeedback = !!user && ['admin', 'hr', 'area_manager', 'store_manager'].includes(user.role);
  const [tab, setTab] = useState<'jobs' | 'candidates' | 'alerts'>('candidates');

  const tabs = [
    ...(canEdit ? [{ key: 'jobs', label: t('ats.tabJobs'), icon: '💼' }] : []),
    { key: 'candidates', label: t('ats.tabCandidates'), icon: '👥' },
    { key: 'alerts', label: t('ats.tabAlerts'), icon: '🔔' },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }} className="page-enter">

      {/* Hero header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #163352 100%)',
        borderRadius: 16, padding: '28px 32px', marginBottom: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16,
        boxShadow: '0 8px 32px rgba(13,33,55,0.14)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'rgba(201,151,58,0.18)',
              border: '1px solid rgba(201,151,58,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>
              🎯
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800,
              color: '#fff', margin: 0, letterSpacing: '-0.02em',
            }}>
              {t('nav.ats')}
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.65)', maxWidth: 480 }}>
            {t('ats.subtitle')}
          </p>
        </div>

        {/* Stage pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(Object.entries({
            received: STAGE_COLOR.received,
            review: STAGE_COLOR.review,
            interview: STAGE_COLOR.interview,
            hired: STAGE_COLOR.hired,
          }) as [CandidateStatus, string][]).map(([stage, color]) => (
            <div key={stage} style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${color}50`,
              borderRadius: 8, padding: '6px 12px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                {t(`ats.stage_${stage}`)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pill tab switcher */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 28,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 4, width: 'fit-content',
      }}>
        {tabs.map((tb) => {
          const isActive = tab === tb.key;
          return (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key as typeof tab)}
              style={{
                padding: '8px 20px',
                background: isActive ? 'var(--primary)' : 'transparent',
                border: 'none', borderRadius: 9,
                color: isActive ? '#fff' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400,
                fontSize: 14, cursor: 'pointer',
                transition: 'all 0.18s ease',
                display: 'flex', alignItems: 'center', gap: 7,
                fontFamily: 'var(--font-body)',
                boxShadow: isActive ? '0 2px 8px rgba(13,33,55,0.18)' : 'none',
              }}
            >
              <span style={{ fontSize: 15 }}>{tb.icon}</span>
              {tb.label}
            </button>
          );
        })}
      </div>

      {tab === 'jobs' && canEdit && <JobsPanel canEdit={canEdit} />}
      {tab === 'candidates' && <KanbanPanel canEdit={canEdit} canFeedback={canFeedback} />}
      {tab === 'alerts' && <AlertsPanel canViewRisks={canViewRisks} />}
    </div>
  );
}
