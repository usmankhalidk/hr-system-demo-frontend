import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Sparkles,
  Store as StoreIcon,
  Trash2,
  User2,
  Users,
  Wallet,
  ChevronDown,
  MessageSquare,
  Bell,
  Clipboard,
  Check,
} from 'lucide-react';
import ReactCountryFlag from 'react-country-flag';
import { COUNTRY_NAME_TO_CODE } from '../../utils/countryList';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { translateApiError } from '../../utils/apiErrors';
import indeedLogo from '../../assets/indeed-logo.png';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import CustomSelect, { SelectOption } from '../../components/ui/CustomSelect';
import Select from '../../components/ui/Select';
import { DatePicker } from '../../components/ui/DatePicker';
import { TimePicker } from '../../components/ui/TimePicker';
import { CitySelect, CountrySelect, StateSelect, LocationFieldGroup } from '../../components/location';
import { getApiBaseUrl, getAvatarUrl, getCompanyLogoUrl, getStoreLogoUrl, getResumeUrl } from '../../api/client';
import { getStores } from '../../api/stores';
import { getCompanies } from '../../api/companies';
import { getEmployees, createEmployee } from '../../api/employees';
import { listInterviewers } from '../../api/ats';
import { getNotificationSettings, type NotificationSetting } from '../../api/documents';
import { getEmailConfig } from '../../api/email';
import { Company, Employee, Store } from '../../types';
import {
  getJobs, createJob, updateJob, deleteJob, publishJob, getJobCompliance,
  getCandidates, getCandidate, createCandidate, updateCandidateStage, updateCandidateTags, deleteCandidate,
  getInterviews, createInterview, updateInterview, deleteInterview,
  getInterviewFeedbackComments, addInterviewFeedbackComment, deleteInterviewFeedbackComment,
  getInterviewNotifications, sendInterviewEmail,
  getAlerts, getRisks, getAllInterviewFeedbackComments,
  previewJobTranslation,
  JobPosting, Candidate, Interview, HRAlert, JobRisk, AllInterviewFeedbackComment,
  InterviewFeedbackComment, InterviewNotificationLog,
  CandidateStatus, JobStatus, JobLanguage, JobType, RemoteType,
} from '../../api/ats';
import { parseCandidateProfile, serializeCandidateProfile, buildCandidateProfile, type CandidateApplicationProfile } from './candidateProfile';
import DocumentPreviewModal from './DocumentPreviewModal';
import InterviewsPanel from './InterviewsPanel';
import CalendarPanel from './CalendarPanel';


// ─── Helpers ──────────────────────────────────────────────────────────────────

// Country flag helper
const getCountryFlag = (countryCode: string | null | undefined): string => {
  if (!countryCode) return '';
  const code = countryCode.toUpperCase();
  const flags: Record<string, string> = {
    'IT': '🇮🇹', 'US': '🇺🇸', 'GB': '🇬🇧', 'FR': '🇫🇷', 'DE': '🇩🇪',
    'ES': '🇪🇸', 'PT': '🇵🇹', 'NL': '🇳🇱', 'BE': '🇧🇪', 'CH': '🇨🇭',
    'AT': '🇦🇹', 'PL': '🇵🇱', 'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰',
  };
  return flags[code] || '🌍';
};

const STAGES: CandidateStatus[] = ['received', 'review', 'phone_interview', 'interview', 'hired', 'rejected'];

const NEXT_STAGE: Partial<Record<CandidateStatus, CandidateStatus>> = {
  received: 'review',
  review: 'phone_interview',
  phone_interview: 'interview',
  interview: 'hired',
};

const STAGE_COLOR: Record<CandidateStatus, string> = {
  received: '#0284C7',
  review: '#7C3AED',
  phone_interview: '#EA580C', // Orange
  interview: '#C9973A',
  hired: '#15803D',
  rejected: '#DC2626',
};

const STAGE_BG: Record<CandidateStatus, string> = {
  received: 'rgba(2,132,199,0.08)',
  review: 'rgba(124,58,237,0.08)',
  phone_interview: 'rgba(234,88,12,0.08)',
  interview: 'rgba(201,151,58,0.10)',
  hired: 'rgba(21,128,61,0.08)',
  rejected: 'rgba(220,38,38,0.07)',
};

interface HiringEmployeeDraft {
  name: string;
  surname: string;
  personalEmail: string;
  phone: string;
  role: string;
  companyId: number;
  storeId: number | null;
  companyName: string;
  companyGroupName: string;
  companyLogoFilename: string | null;
  storeName: string;
  storeLogoFilename: string | null;
  storeEmployeeCount: number | null;
  jobTitle: string;
  uniqueId: string;
  password: string;
  hireDate: string;
  contractType: string;
  maritalStatus: string;
  workingType: string;
  weeklyHours: string;
  dateOfBirth: string;
  nationality: string;
  gender: string;
  country: string;
  state: string;
  city: string;
  currentEmployer: string;
  currentRole: string;
  availability: string;
  applicationDate: string;
  applicationSource: string;
  applicationChannel: string;
}

const ROLE_BADGE_VARIANT: Record<string, 'accent' | 'info' | 'warning' | 'neutral'> = {
  hr: 'accent',
  area_manager: 'info',
  store_manager: 'warning',
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

function generateEmployeeUniqueId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'EMP-';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#';
  let result = '';
  for (let index = 0; index < 12; index += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

function normalizeCountryCode(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return COUNTRY_NAME_TO_CODE[raw.toLowerCase()] ?? '';
}

function countryNameFromCode(value: string | null | undefined): string {
  const code = normalizeCountryCode(value);
  if (!code) return '-';
  try {
    const lang = localStorage.getItem('hr_lang') || 'it';
    const formatter = new Intl.DisplayNames([lang], { type: 'region' });
    return formatter.of(code) ?? code;
  } catch {
    return code;
  }
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
function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
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

const SYSTEM_CANDIDATE_TAGS = new Set(['public-careers', 'external', 'indeed']);
const SYSTEM_CANDIDATE_TAG_PREFIXES = ['locale:'];

function isSystemCandidateTag(tag: string): boolean {
  const normalized = tag.trim().toLowerCase();
  if (!normalized) return false;
  if (SYSTEM_CANDIDATE_TAGS.has(normalized)) return true;
  return SYSTEM_CANDIDATE_TAG_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function splitCandidateTags(tags: string[]): { systemTags: string[]; userTags: string[] } {
  const systemTags: string[] = [];
  const userTags: string[] = [];
  tags.forEach((tag) => {
    if (isSystemCandidateTag(tag)) {
      systemTags.push(tag);
    } else {
      userTags.push(tag);
    }
  });
  return { systemTags, userTags };
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

const ReferenceIdBadge: React.FC<{ referenceId: string }> = ({ referenceId }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(referenceId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = referenceId;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      } catch (err) {
        console.error('Failed to copy Reference ID', err);
      }
    });
  };

  return (
    <span
      style={{
        fontFamily: 'monospace',
        fontSize: '11.5px',
        fontWeight: 600,
        background: '#F1F5F9',
        color: '#475569',
        borderRadius: '6px',
        padding: '2px 8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        border: '1px solid #E2E8F0',
      }}
    >
      {referenceId}
      <button
        type="button"
        onClick={handleCopy}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: copied ? '#16A34A' : '#64748B',
          transition: 'color 0.15s',
        }}
        title="Copy Reference ID"
      >
        {copied ? (
          <Check size={12} strokeWidth={2.5} />
        ) : (
          <Clipboard size={12} strokeWidth={2} />
        )}
      </button>
    </span>
  );
};

interface CheckResult {
  id: string;
  field: string;
  name: string;
  rule: string;
  ok: boolean;
  warn: boolean;
  fix: string;
}

interface IndeedComplianceModalProps {
  referenceId: string;
  onClose: () => void;
}

const IndeedComplianceModal: React.FC<IndeedComplianceModalProps> = ({ referenceId: initialRefId, onClose }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [refId, setRefId] = useState(initialRefId);
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<CheckResult[]>([]);

  const runCheck = async (targetRefId: string) => {
    if (!targetRefId.trim()) {
      showToast('Please enter a valid Reference ID', 'error');
      return;
    }
    setLoading(true);
    setError(null);
    setJob(null);
    setChecks([]);
    try {
      const data = await getJobCompliance(targetRefId.trim());
      if (!data) {
        setError('Position not found. Check the ID and try again.');
        setLoading(false);
        return;
      }
      setJob(data);
      
      // Perform checks
      const results: CheckResult[] = [
        {
          id: 'C01',
          field: 'title',
          name: 'Job Title Quality',
          rule: 'Title is present, not empty, and does not contain salary, location, or promotional details.',
          ok: (() => {
            const title = data.title || '';
            const hasSalary = /(\d+|stipendio|salary|euro|€|usd|\$|all'ora|al mese|yearly|hourly|monthly|\b\d+k\b)/i.test(title);
            const hasLocation = /\b(in|a|at|da|near|presso)\b\s+[A-Z]/i.test(title) || /\b(Milano|Roma|Napoli|Torino|Palermo|Bari|Bologna|Firenze|Genova|Venezia|London|New York|Paris|Berlin|Madrid)\b/i.test(title);
            return title.trim().length > 0 && !hasSalary && !hasLocation;
          })(),
          warn: false,
          fix: 'Remove any salary details, currency symbols, location prepositions, or city names from the job title. Move these to the salary and location override fields.',
        },
        {
          id: 'C02',
          field: 'date',
          name: 'Publication Date',
          rule: 'ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)',
          ok: (() => {
            const dateStr = data.publishedAt || data.createdAt || '';
            return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(dateStr);
          })(),
          warn: false,
          fix: 'Ensure the position has a valid publication date or creation timestamp stored in ISO 8601 standard.',
        },
        {
          id: 'C03',
          field: 'referencenumber',
          name: 'Reference Number',
          rule: 'Present and matches prefix format VY-[XX]-[NNNN]',
          ok: !!data.referenceId && /^VY-[A-Z]{2}-\d{4}$/.test(data.referenceId),
          warn: false,
          fix: 'The position is missing a valid Reference ID. Create a new position to generate it automatically.',
        },
        {
          id: 'C04',
          field: 'requisitionid',
          name: 'Requisition ID',
          rule: 'Present and not empty (REQ-[position-id])',
          ok: false,
          warn: false,
          fix: `requisitionid is missing. Add REQ-${data.id} to the position data. This field is required by Indeed — it was missing from both team lead docs.`,
        },
        {
          id: 'C05',
          field: 'url',
          name: 'Apply URL Tracker',
          rule: 'Apply URL is present and contains ?source=Indeed',
          ok: false,
          warn: false,
          fix: 'URL does not contain ?source=Indeed. Update the URL construction in ats.controller.ts at jobFeedHandler to append ?source=Indeed.',
        },
        {
          id: 'C06',
          field: 'email',
          name: 'Contact Email',
          rule: 'Valid company or recruiter contact email address',
          ok: (() => {
            const email = data.companyEmail || '';
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
          })(),
          warn: false,
          fix: 'Company email is missing or invalid. Set a valid contact email in the company profile settings.',
        },
        {
          id: 'C07',
          field: 'city',
          name: 'Job City Location',
          rule: 'City field is present and not empty',
          ok: !!data.city && data.city.trim().length > 0,
          warn: false,
          fix: "Specify a city location override for this position or ensure the company profile has a default city configuration.",
        },
        {
          id: 'C08',
          field: 'state',
          name: 'Job State/Province',
          rule: 'Province code or state name, must not be a pure number',
          ok: (() => {
            const state = data.state || '';
            return state.trim().length > 0 && !/^\d+$/.test(state);
          })(),
          warn: false,
          fix: "State contains a numeric value. Replace with the province abbreviation (e.g. 'MI' for Milano, 'SA' for Salerno) or full region name.",
        },
        {
          id: 'C09',
          field: 'country',
          name: 'Job Country',
          rule: 'Country code (e.g. \'IT\', \'US\') is present',
          ok: !!data.country && data.country.trim().length > 0,
          warn: false,
          fix: "Country code is missing. Specify a valid 2-letter country code (e.g. 'IT') in the location override or company profile.",
        },
        {
          id: 'C10',
          field: 'remotetype',
          name: 'Remote Type Guideline',
          rule: 'If job is remote, value must be exactly: \'Fully remote\', \'Hybrid remote\', or \'COVID-19\'',
          ok: (() => {
            const isRemote = data.remoteType === 'remote' || data.remoteType === 'hybrid' || data.isRemote;
            return isRemote ? ['Fully remote', 'Hybrid remote', 'COVID-19'].includes(data.remoteType) : true;
          })(),
          warn: false,
          fix: "Remote type must be mapped to 'Fully remote' or 'Hybrid remote'. Update the XML feed mapping to match Indeed guidelines.",
        },
        {
          id: 'C11',
          field: 'description',
          name: 'Job Description Length',
          rule: 'Description must contain at least 150 characters of content',
          ok: (() => {
            const desc = data.description || '';
            return desc.trim().length >= 150;
          })(),
          warn: false,
          fix: 'Job description must be present and contain at least 150 characters of high-quality content.',
        },
        {
          id: 'C12',
          field: 'sourcename',
          name: 'ATS Source Name',
          rule: 'Developer identifier source name must be present',
          ok: !!data.source && data.source.trim().length > 0,
          warn: false,
          fix: "Source name is missing. Specify the source name parameter (e.g. 'VeyloHR') in the feed.",
        },
      ];
      setChecks(results);
    } catch (err) {
      setError('An error occurred while running the compliance check.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialRefId) {
      runCheck(initialRefId);
    }
  }, [initialRefId]);

  const passedCount = checks.filter(c => c.ok).length;
  const totalCount = checks.length;
  const allPassed = passedCount === totalCount;
  const progressPercent = totalCount > 0 ? (passedCount / totalCount) * 100 : 0;

  let progressColor = '#DC2626'; // Red
  if (passedCount >= 10) progressColor = '#15803D'; // Green
  else if (passedCount >= 6) progressColor = '#D97706'; // Amber

  return (
    <ModalBackdrop onClose={onClose} width={800}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontSize: 17, fontWeight: 700 }}>
              Indeed Compliance Check
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Check this position against Indeed's official XML feed requirements
            </p>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 22, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ padding: '20px 22px', display: 'grid', gap: 16 }}>
        {/* Input Row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240, display: 'grid', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Position Reference ID
            </label>
            <input
              type="text"
              value={refId}
              onChange={(e) => setRefId(e.target.value)}
              placeholder="e.g. VY-FU-0001"
              style={{
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '9px 12px',
                fontSize: 13,
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>
          <Button variant="primary" onClick={() => runCheck(refId)} disabled={loading} style={{ height: 38 }}>
            {loading ? 'Running...' : 'Run Check'}
          </Button>
        </div>

        {error && (
          <div style={{ padding: 14, borderRadius: 8, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Results */}
        {!loading && job && checks.length > 0 && (
          <div style={{ display: 'grid', gap: 16 }}>
            {/* Summary Bar */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, background: 'rgba(13,33,55,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {passedCount} of {totalCount} checks passed
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: progressColor }}>
                  {Math.round(progressPercent)}%
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ height: '100%', width: `${progressPercent}%`, background: progressColor, transition: 'width 0.3s ease' }} />
              </div>

              {allPassed ? (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', fontSize: 13, fontWeight: 600 }}>
                  ✅ This position meets all Indeed XML feed requirements
                </div>
              ) : (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: 13, fontWeight: 600 }}>
                  ❌ {totalCount - passedCount} issues found — resolve before submitting to Indeed
                </div>
              )}
            </div>

            {/* Checks List */}
            <div style={{ display: 'grid', gap: 10 }}>
              {checks.map((check) => (
                <details
                  key={check.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    background: '#fff',
                    overflow: 'hidden',
                  }}
                >
                  <summary
                    style={{
                      listStyle: 'none',
                      cursor: 'pointer',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ fontSize: 14, minWidth: 24, display: 'inline-flex', justifyContent: 'center' }}>
                      {check.ok ? '✅' : '❌'}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)', flex: 1 }}>
                      {check.name}
                      <span style={{ marginLeft: 8, fontSize: 11, fontFamily: 'monospace', background: '#F1F5F9', color: '#64748B', padding: '1px 5px', borderRadius: 4 }}>
                        {check.id}
                      </span>
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {check.ok ? 'Pass' : 'Action Required'}
                    </span>
                  </summary>

                  <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', background: 'rgba(248,250,252,0.5)', display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      <strong>Rule:</strong> {check.rule}
                    </div>
                    {!check.ok && (
                      <div
                        style={{
                          marginTop: 4,
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: '#FFFBEB',
                          border: '1px solid #FDE68A',
                          color: '#92400E',
                          fontSize: 12.5,
                          lineHeight: 1.5,
                        }}
                      >
                        <strong>How to fix:</strong> {check.fix}
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModalBackdrop>
  );
};

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

// ─── Rich text editor ──────────────────────────────────────────────────────────

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  hasError?: boolean;
}

const RTE_TOOLBAR_BTN: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  border: '1px solid rgba(148,163,184,0.3)',
  background: 'transparent',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 700,
  color: '#334155',
  padding: 0,
  transition: 'background 0.13s, border-color 0.13s',
  flexShrink: 0,
};

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, minHeight = 160, hasError }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);

  // Sync external value → DOM (only on initial mount or when externally reset)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    // Only set if content actually differs to avoid cursor jump
    if (el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  const execCmd = (command: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    syncContent();
  };

  const syncContent = () => {
    const el = editorRef.current;
    if (!el) return;
    isInternalUpdate.current = true;
    onChange(el.innerHTML);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');

    if (html) {
      // Sanitise pasted HTML: keep only allowed tags, strip scripts/iframes
      const tmp = document.createElement('div');
      tmp.innerHTML = html;

      // Remove disallowed elements
      ['script', 'iframe', 'style', 'head', 'meta', 'link', 'object', 'embed'].forEach((tag) => {
        tmp.querySelectorAll(tag).forEach((el) => el.remove());
      });

      // Strip all attributes except href on <a>
      tmp.querySelectorAll('*').forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const allowedAttrs = tag === 'a' ? ['href'] : [];
        Array.from(el.attributes).forEach((attr) => {
          if (!allowedAttrs.includes(attr.name)) {
            el.removeAttribute(attr.name);
          }
        });
      });

      // Map headings / divs / spans to clean block elements
      tmp.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((el) => {
        const p = document.createElement('p');
        p.innerHTML = el.innerHTML;
        el.replaceWith(p);
      });

      document.execCommand('insertHTML', false, tmp.innerHTML);
    } else if (plain) {
      // Convert plain text newlines to <br>
      const safeHtml = plain
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .split('\n')
        .join('<br>');
      document.execCommand('insertHTML', false, safeHtml);
    }

    syncContent();
  };

  const isEmpty = !value || value === '<br>' || value === '<p><br></p>' || value.replace(/<[^>]*>/g, '').trim() === '';

  return (
    <div
      style={{
        border: `1px solid ${hasError ? '#B91C1C' : 'var(--border)'}`,
        borderRadius: 10,
        background: '#fff',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '5px 8px',
          borderBottom: '1px solid var(--border)',
          background: '#f8fafc',
          flexWrap: 'wrap',
        }}
      >
        <button type="button" title="Bold (Ctrl+B)" style={{ ...RTE_TOOLBAR_BTN, fontWeight: 900 }} onMouseDown={(e) => { e.preventDefault(); execCmd('bold'); }}>B</button>
        <button type="button" title="Italic (Ctrl+I)" style={{ ...RTE_TOOLBAR_BTN, fontStyle: 'italic' }} onMouseDown={(e) => { e.preventDefault(); execCmd('italic'); }}>I</button>
        <button type="button" title="Underline (Ctrl+U)" style={{ ...RTE_TOOLBAR_BTN, textDecoration: 'underline' }} onMouseDown={(e) => { e.preventDefault(); execCmd('underline'); }}>U</button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 3px', flexShrink: 0 }} />
        <button
          type="button"
          title="Bullet list"
          style={RTE_TOOLBAR_BTN}
          onMouseDown={(e) => { e.preventDefault(); execCmd('insertUnorderedList'); }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="1.5" cy="3.5" r="1.5" fill="#334155" />
            <rect x="4" y="2.75" width="9" height="1.5" rx="0.75" fill="#334155" />
            <circle cx="1.5" cy="7" r="1.5" fill="#334155" />
            <rect x="4" y="6.25" width="9" height="1.5" rx="0.75" fill="#334155" />
            <circle cx="1.5" cy="10.5" r="1.5" fill="#334155" />
            <rect x="4" y="9.75" width="9" height="1.5" rx="0.75" fill="#334155" />
          </svg>
        </button>
        <button
          type="button"
          title="Numbered list"
          style={RTE_TOOLBAR_BTN}
          onMouseDown={(e) => { e.preventDefault(); execCmd('insertOrderedList'); }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="5" fontSize="5" fontWeight="700" fill="#334155">1.</text>
            <rect x="4" y="2.75" width="9" height="1.5" rx="0.75" fill="#334155" />
            <text x="0" y="9.5" fontSize="5" fontWeight="700" fill="#334155">2.</text>
            <rect x="4" y="6.25" width="9" height="1.5" rx="0.75" fill="#334155" />
            <text x="0" y="13.5" fontSize="5" fontWeight="700" fill="#334155">3.</text>
            <rect x="4" y="9.75" width="9" height="1.5" rx="0.75" fill="#334155" />
          </svg>
        </button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 3px', flexShrink: 0 }} />
        <button
          type="button"
          title="Clear formatting"
          style={{ ...RTE_TOOLBAR_BTN, fontSize: 10 }}
          onMouseDown={(e) => { e.preventDefault(); execCmd('removeFormat'); }}
        >
          Tx
        </button>
      </div>

      {/* Editable area */}
      <div style={{ position: 'relative' }}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={syncContent}
          onPaste={handlePaste}
          style={{
            minHeight,
            padding: '10px 12px',
            fontSize: 13.5,
            lineHeight: 1.6,
            color: '#111827',
            outline: 'none',
            fontFamily: 'inherit',
            wordBreak: 'break-word',
          }}
        />
        {isEmpty && placeholder && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 12,
              color: '#9ca3af',
              fontSize: 13.5,
              lineHeight: 1.6,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
};

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

const parseRichTextToHtml = (text: string): string => {
  if (!text) return '';

  // If the text already contains HTML tags (from RichTextEditor), return as-is
  if (/<[a-zA-Z][^>]*>/.test(text)) {
    return text;
  }

  // Legacy: parse Markdown-style plain text into HTML
  // 1. Escape HTML first to prevent any broken tags or XSS
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // 2. Inline elements (Bold, Underline, Italic)
  // Bold: **text** or __text__
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Underline: ___text___ or __text__
  escaped = escaped.replace(/__(.*?)__/g, '<u>$1</u>');

  // Italic: *text* or _text_
  escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
  escaped = escaped.replace(/_([^_]+)_/g, '<em>$1</em>');

  // 3. Process line-by-line for blocks (headers, lists, and line breaks)
  const lines = escaped.split('\n');
  const result: string[] = [];
  let inUl = false;
  let inOl = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (line.startsWith('### ')) {
      if (inUl) { result.push('</ul>'); inUl = false; }
      if (inOl) { result.push('</ol>'); inOl = false; }
      result.push(`<h3 style="margin: 12px 0 6px; font-size: 15px; font-weight: 700; color: #0f172a;">${line.slice(4)}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      if (inUl) { result.push('</ul>'); inUl = false; }
      if (inOl) { result.push('</ol>'); inOl = false; }
      result.push(`<h2 style="margin: 14px 0 8px; font-size: 17px; font-weight: 700; color: #0f172a;">${line.slice(3)}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      if (inUl) { result.push('</ul>'); inUl = false; }
      if (inOl) { result.push('</ol>'); inOl = false; }
      result.push(`<h1 style="margin: 16px 0 10px; font-size: 19px; font-weight: 800; color: #0f172a;">${line.slice(2)}</h1>`);
      continue;
    }

    // Bullet list: check for -, *, •, + followed by space
    const bulletMatch = line.match(/^([\-*•+])\s+(.*)$/);
    if (bulletMatch) {
      if (inOl) { result.push('</ol>'); inOl = false; }
      if (!inUl) {
        result.push('<ul style="margin: 6px 0 6px 20px; padding: 0; list-style-type: disc;">');
        inUl = true;
      }
      result.push(`<li style="margin-bottom: 4px; line-height: 1.6; color: inherit;">${bulletMatch[2]}</li>`);
      continue;
    }

    // Numbered list: check for digits followed by dot/parenthesis
    const numberMatch = line.match(/^(\d+)[.\)]\s+(.*)$/);
    if (numberMatch) {
      if (inUl) { result.push('</ul>'); inUl = false; }
      if (!inOl) {
        result.push('<ol style="margin: 6px 0 6px 20px; padding: 0; list-style-type: decimal;">');
        inOl = true;
      }
      result.push(`<li style="margin-bottom: 4px; line-height: 1.6; color: inherit;">${numberMatch[2]}</li>`);
      continue;
    }

    // Close open lists if we hit a standard paragraph
    if (inUl) { result.push('</ul>'); inUl = false; }
    if (inOl) { result.push('</ol>'); inOl = false; }

    if (line === '') {
      result.push('<div style="height: 10px;"></div>');
    } else {
      result.push(`<div style="margin-bottom: 6px; line-height: 1.6; min-height: 1.2em;">${rawLine}</div>`);
    }
  }

  if (inUl) result.push('</ul>');
  if (inOl) result.push('</ol>');

  return result.join('\n');
};

const JobModal: React.FC<JobModalProps> = ({ job, stores, companies, defaultCompanyId, onSave, onClose, saving }) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { isMobile, isTablet } = useBreakpoint();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState(job?.title ?? '');
  const [description, setDescription] = useState(job?.description ?? '');
  const [tags, setTags] = useState<string[]>(job?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const activeLang: JobLanguage = i18n.language?.startsWith('it') ? 'it' : 'en';
  const language = activeLang;
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
    const descriptionText = description.replace(/<[^>]*>/g, '').trim();
    if (!descriptionText) nextErrors.description = t('common.required', 'Required');
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
      description: description,
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
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span>{job ? t('ats.editJob') : t('ats.newJob')}</span>
                    {job && (
                      job.referenceId ? (
                        <ReferenceIdBadge referenceId={job.referenceId} />
                      ) : (
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          background: '#F1F5F9',
                          color: '#64748B',
                          borderRadius: '6px',
                          padding: '2px 6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: '1px solid #E2E8F0',
                        }}>
                          —
                        </span>
                      )
                    )}
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
                      <RichTextEditor
                        value={description}
                        onChange={setDescription}
                        placeholder={t('ats.jobDescriptionPlaceholder')}
                        hasError={Boolean(errors.description)}
                        minHeight={160}
                      />
                    </div>
                    {errors.description && <div style={{ marginTop: 4, color: '#B91C1C', fontSize: 12 }}>{errors.description}</div>}

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
                        onChange={() => {}}
                        options={languageSelectOptions}
                        isClearable={false}
                        searchable={false}
                        disabled={true}
                      />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                        {t('ats.languageLockedHint', 'Locked to current translation language')}
                      </span>
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
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: '#fff', padding: 16, maxWidth: 680, margin: '0 auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10, marginBottom: 12 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 12, border: '1px solid rgba(201,151,58,0.22)', background: '#fffdf6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
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

                  <h4 style={{ margin: '0 0 8px 0', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontSize: 22 }}>{title || '-'}</h4>
                  {(() => {
                    const isLongDescription = description.trim().split('\n').length > 5 || description.trim().length > 250;
                    return (
                      <div style={{ margin: '0 0 12px 0' }}>
                        <div
                          className="rte-preview"
                          style={isExpanded ? {
                            color: '#4b5563',
                            fontSize: '13.5px',
                            lineHeight: '1.55',
                          } : {
                            color: '#4b5563',
                            fontSize: '13.5px',
                            lineHeight: '1.55',
                            display: '-webkit-box',
                            WebkitLineClamp: 6,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                          dangerouslySetInnerHTML={{ __html: parseRichTextToHtml(description.trim() || '-') }}
                        />
                        {isLongDescription && (
                          <button
                            type="button"
                            onClick={() => setIsExpanded(!isExpanded)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#9A6808',
                              fontWeight: 700,
                              fontSize: '12.5px',
                              cursor: 'pointer',
                              padding: '4px 0 0',
                              display: 'block',
                              outline: 'none'
                            }}
                          >
                            {isExpanded ? t('common.showLess', 'Show Less') : t('common.showMore', 'Show More')}
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
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

                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(3, 1fr)', border: '1px dashed rgba(148,163,184,0.38)', borderRadius: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.74)', marginBottom: 12 }}>
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

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {tags.length > 0 ? tags.map((tag) => (
                      <span key={`preview-${tag}`} style={{ fontSize: 11, borderRadius: 999, padding: '3px 9px', background: '#E9F8EE', color: '#1D6B3A', border: '1px solid #BFE8CC', fontWeight: 600 }}>
                        {tag}
                      </span>
                    )) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('ats.noTags', 'No tags')}</span>}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(13,33,55,0.2)', background: '#fff', color: '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}
                      >
                        <Heart size={15} />
                      </button>
                      <button
                        type="button"
                        style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(13,33,55,0.2)', background: '#fff', color: '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}
                      >
                        <Bookmark size={15} />
                      </button>
                    </div>

                    <button
                      type="button"
                      style={{ border: 'none', background: 'transparent', color: '#9A6808', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0, cursor: 'default' }}
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
                    disabled={!title.trim() || !description.replace(/<[^>]*>/g, '').trim() || !jobType || !remoteType || !companyId}
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
  employees: Employee[];
  canEdit: boolean;
  canTag: boolean;
  canFeedback: boolean;
  interviewInviteEnabled: boolean | null;
  smtpConfigured: boolean | null;
  onClose: () => void;
  onAdvance: (status: CandidateStatus) => Promise<void>;
  onReject: (reason?: string) => Promise<void>;
  onDelete: () => Promise<void>;
  saving: boolean;
  companies?: Company[];
}

const CandidateModal: React.FC<CandidateModalProps> = ({
  candidate, jobs, employees, canEdit, canTag, canFeedback, interviewInviteEnabled, smtpConfigured,
  onClose, onAdvance, onReject, onDelete, saving,
  companies = [],
}) => {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { isMobile } = useBreakpoint();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [editingInterviewId, setEditingInterviewId] = useState<number | null>(null);
  const [intDate, setIntDate] = useState('');
  const [intTime, setIntTime] = useState('09:00');
  const [intLocation, setIntLocation] = useState('');
  const [intType, setIntType] = useState<'phone' | 'in_person'>(candidate.status === 'phone_interview' ? 'phone' : 'in_person');
  const [intDescription, setIntDescription] = useState('');
  const [intDuration, setIntDuration] = useState<number | ''>('');
  const [intInterviewerId, setIntInterviewerId] = useState<string | null>(null);
  const [intSendIcs, setIntSendIcs] = useState(true);
  const [savingInt, setSavingInt] = useState(false);
  const [interviewerUsers, setInterviewerUsers] = useState<Employee[]>([]);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<number, string>>({});
  const [interviewFeedback, setInterviewFeedback] = useState<Record<number, InterviewFeedbackComment[]>>({});
  const [savingFeedbackId, setSavingFeedbackId] = useState<number | null>(null);
  const [deletingFeedbackId, setDeletingFeedbackId] = useState<number | null>(null);
  const [interviewNotifications, setInterviewNotifications] = useState<Record<number, InterviewNotificationLog[]>>({});
  const [resumeFileSizeLabel, setResumeFileSizeLabel] = useState<string | null>(null);
  const [hoveredFeedbackId, setHoveredFeedbackId] = useState<number | null>(null);
  const [coverLetterOpen, setCoverLetterOpen] = useState(false);
  const [hasScrolledToTab, setHasScrolledToTab] = useState(false);
  const [notificationModalFeedbackId, setNotificationModalFeedbackId] = useState<number | null>(null);
  const [notificationModalLogs, setNotificationModalLogs] = useState<InterviewNotificationLog[]>([]);
  const [hasScrolledToFeedback, setHasScrolledToFeedback] = useState(false);

  // Auto-scroll to section based on URL parameter
  useEffect(() => {
    if (!hasScrolledToTab) {
      const tab = searchParams.get('tab');
      if (tab === 'resume' || tab === 'comments') {
        setTimeout(() => {
          const el = document.getElementById(tab === 'resume' ? 'resume-section' : 'comments-section');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setHasScrolledToTab(true);
          }
        }, 500); // Small delay to ensure content is rendered
      }
    }
  }, [searchParams, hasScrolledToTab]);

  // Auto-scroll to specific feedback comment when deep-linked
  const [scrolledFeedbackId, setScrolledFeedbackId] = useState<string | null>(null);
  useEffect(() => {
    const feedbackId = searchParams.get('feedbackId');
    if (feedbackId && feedbackId !== scrolledFeedbackId && Object.keys(interviewFeedback).length > 0) {
      const feedbackExists = Object.values(interviewFeedback).some(comments =>
        comments.some(c => String(c.id) === String(feedbackId))
      );

      if (feedbackExists) {
        const timer = setTimeout(() => {
          const el = document.getElementById(`feedback-comment-${feedbackId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setScrolledFeedbackId(feedbackId);
          }
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [searchParams, interviewFeedback, scrolledFeedbackId]);

  // Load notification logs for interviews
  const loadInterviewNotifications = useCallback(async (interviewIds: number[]) => {
    const promises = interviewIds.map(async (id) => {
      try {
        const logs = await getInterviewNotifications(id);
        return { id, logs };
      } catch {
        return { id, logs: [] };
      }
    });

    const results = await Promise.allSettled(promises);
    const newNotifications: Record<number, InterviewNotificationLog[]> = {};

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        newNotifications[result.value.id] = result.value.logs;
      }
    });

    setInterviewNotifications(prev => ({ ...prev, ...newNotifications }));
  }, []);

  // Load notification logs when interviews change
  useEffect(() => {
    if (interviews.length > 0) {
      loadInterviewNotifications(interviews.map(iv => iv.id));
    }
  }, [interviews, loadInterviewNotifications]);

  // Send/Resend notification or email
  const handleRetryNotification = async (
    interviewId: number,
    logId?: number,
    channel?: 'email' | 'in_app',
    recipientType?: 'interviewer' | 'candidate',
  ) => {
    try {
      const result = await sendInterviewEmail(interviewId, logId, channel, recipientType);
      // Reload notification logs for this interview
      await loadInterviewNotifications([interviewId]);

      // Show success message with recipient info
      const channelLabel = channel === 'email' ? t('ats.email', 'Email') : t('ats.notification', 'Notification');
      const actionLabel = logId ? t('common.resent', 'resent') : t('common.sent', 'sent');
      const recipientInfo = result.recipientName
        ? ` to ${result.recipientName}${result.recipientEmail ? ` (${result.recipientEmail})` : ''}`
        : '';

      showToast(`${channelLabel} ${actionLabel}${recipientInfo}`, 'success');
    } catch (err) {
      const channelLabel = channel === 'email' ? t('ats.email', 'Email') : t('ats.notification', 'Notification');
      showToast(`${t('common.error', 'Error')} sending ${channelLabel.toLowerCase()}`, 'error');
    }
  };
  const [deletingInterviewId, setDeletingInterviewId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; filename: string } | null>(null);

  // Tags editing
  const [editingTags, setEditingTags] = useState(false);
  const [tagsDraft, setTagsDraft] = useState<string[]>(() => splitCandidateTags(candidate.tags).userTags);
  const [tagInput, setTagInput] = useState('');
  const [savingTags, setSavingTags] = useState(false);
  const { systemTags } = useMemo(() => splitCandidateTags(candidate.tags), [candidate.tags]);

  // Rejection reason
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [savingRejection, setSavingRejection] = useState(false);

  const appliedJob = candidate.jobPostingId
    ? jobs.find((j) => j.id === candidate.jobPostingId) ?? null
    : null;
  const jobTitle = appliedJob?.title;
  const appliedTimeSource = candidate.appliedAt ?? candidate.createdAt;
  const appliedAgoLabel = fmtRelativeTime(appliedTimeSource);
  const appliedAtLabel = fmtDateTime(appliedTimeSource);
  const appliedDateOnly = new Date(appliedTimeSource).toLocaleDateString(i18n.language === 'it' ? 'it-IT' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const appliedJobLocation = appliedJob
    ? [appliedJob.jobCity ?? appliedJob.city, appliedJob.jobState ?? appliedJob.state, appliedJob.jobCountry ?? appliedJob.country]
      .filter(Boolean)
      .join(', ')
    || t(`ats.remoteType_${appliedJob.remoteType}`, appliedJob.remoteType)
    : null;
  const stageColor = STAGE_COLOR[candidate.status];
  const stageBg = STAGE_BG[candidate.status];
  const next = NEXT_STAGE[candidate.status];

  // Parse candidate profile to get available start date
  const candidateProfile = parseCandidateProfile(candidate.sourceRef);
  const availableStartDate = candidateProfile.availableStartDate
    ? new Date(candidateProfile.availableStartDate).toLocaleDateString(i18n.language === 'it' ? 'it-IT' : 'en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    : null;

  const interviewerOptions = useMemo<SelectOption[]>(() => {
    return interviewerUsers
      .filter((emp) => ['hr', 'area_manager', 'store_manager'].includes(emp.role))
      .map((emp) => {
        const fullName = `${emp.name} ${emp.surname}`.trim();
        const avatarUrl = getAvatarUrl(emp.avatarFilename);
        const roleLabel = t(`roles.${emp.role}`, emp.role);
        
        // Generate beautiful initials and avatar bg for company label
        const companyInitials = emp.companyName ? initials(emp.companyName) : 'CO';
        const companyAvatarBg = emp.companyName 
          ? ['#0D2137', '#163352', '#8B6914', '#1B4D3E', '#2C5282', '#5B2333'][Math.abs(emp.companyName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 6]
          : 'var(--border)';

        return {
          value: String(emp.id),
          label: `${fullName} ${roleLabel}`.trim(),
          render: (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr auto',
              gap: 16,
              width: '100%',
              padding: '4px 0',
              alignItems: 'center',
            }}>
              {/* Column 1: User Avatar + Name + Sub-detail (email) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: avatarUrl ? 'transparent' : 'var(--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : initials(fullName)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {fullName}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {emp.email}
                  </div>
                </div>
              </div>

              {/* Column 2: Company initials Avatar + Company Name + Store Name (in italics underneath) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {emp.companyName ? (
                  <>
                    {(() => {
                      const comp = companies?.find((c) => String(c.id) === String(emp.companyId) || c.name === emp.companyName);
                      // Use companyLogoFilename directly from backend, fallback to the one in companies list
                      const logoFile = (emp as any).companyLogoFilename || comp?.logoFilename;
                      const companyLogoUrl = logoFile ? getCompanyLogoUrl(logoFile) : null;
                      return companyLogoUrl ? (
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: 4,
                          overflow: 'hidden',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          background: 'var(--surface-warm)',
                        }}>
                          <img src={companyLogoUrl} alt={emp.companyName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: 4,
                          background: companyAvatarBg,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          fontWeight: 800,
                          flexShrink: 0,
                        }}>
                          {companyInitials}
                        </div>
                      );
                    })()}
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {emp.companyName}
                      </div>
                      {((emp as any).storeName) ? (
                        <div style={{
                          fontSize: 10,
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {(emp as any).storeName}
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--text-disabled)', fontStyle: 'italic' }}>
                    {t('ats.noCompanyAssigned', 'No company assigned')}
                  </span>
                )}
              </div>

              {/* Column 3: User Role Badge */}
              <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                <Badge size="sm" variant={ROLE_BADGE_VARIANT[emp.role] ?? 'neutral'}>
                  {roleLabel}
                </Badge>
              </div>
            </div>
          ),
        };
      });
  }, [interviewerUsers, t]);

  const resumePath = candidate.resumePath || candidate.cvPath;
  const defaultInterviewType = candidate.status === 'phone_interview' ? 'phone' : 'in_person';

  // Extract only the relative path from cvs/ or public-cv/ onwards
  const displayResumePath = resumePath
    ? resumePath.includes('cvs/')
      ? resumePath.substring(resumePath.indexOf('cvs/'))
      : resumePath.includes('public-cv/')
        ? resumePath.substring(resumePath.indexOf('public-cv/'))
        : resumePath
    : null;

  // Country flag helper
  const getCountryFlag = (countryCode: string | null | undefined): string => {
    if (!countryCode) return '';
    const code = countryCode.toUpperCase();
    const flags: Record<string, string> = {
      'IT': '🇮🇹', 'US': '🇺🇸', 'GB': '🇬🇧', 'FR': '🇫🇷', 'DE': '🇩🇪',
      'ES': '🇪🇸', 'PT': '🇵🇹', 'NL': '🇳🇱', 'BE': '🇧🇪', 'CH': '🇨🇭',
      'AT': '🇦🇹', 'PL': '🇵🇱', 'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰',
    };
    return flags[code] || '🌍';
  };

  // Format date based on language
  const formatDate = (date: string | null | undefined, format: 'long' | 'short' = 'long'): string => {
    if (!date) return '';
    const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';
    return new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: format === 'long' ? 'long' : 'short',
      day: 'numeric',
    });
  };
  useEffect(() => {
    let cancelled = false;
    setResumeFileSizeLabel(null);

    const url = getResumeUrl(resumePath);
    if (!url) return () => { cancelled = true; };

    void fetch(url, { method: 'HEAD' })
      .then((response) => {
        if (cancelled || !response.ok) return;
        const sizeHeader = response.headers.get('content-length');
        const sizeValue = sizeHeader ? Number(sizeHeader) : Number.NaN;
        if (!Number.isFinite(sizeValue) || sizeValue <= 0) return;
        setResumeFileSizeLabel(formatFileSize(sizeValue));
      })
      .catch(() => {
        if (!cancelled) setResumeFileSizeLabel(null);
      });

    return () => {
      cancelled = true;
    };
  }, [resumePath]);

  useEffect(() => {
    let active = true;
    getInterviews(candidate.id)
      .then(async (items) => {
        if (!active) return;
        setInterviews(items);
        setFeedbackDrafts(Object.fromEntries(items.map((iv) => [iv.id, ''])));

        const results = await Promise.allSettled(
          items.map((iv) => getInterviewFeedbackComments(iv.id))
        );
        if (!active) return;
        const feedbackMap: Record<number, InterviewFeedbackComment[]> = {};
        results.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            feedbackMap[items[idx].id] = result.value;
          }
        });
        setInterviewFeedback(feedbackMap);
      })
      .catch(() => { });

    return () => {
      active = false;
    };
  }, [candidate.id]);

  useEffect(() => {
    let active = true;
    const localEligible = employees.filter((emp) => (
      ['hr', 'area_manager', 'store_manager'].includes(emp.role)
      && emp.companyId === candidate.companyId
      && emp.status === 'active'
    ));

    // Attempt to load interviewers from the ATS endpoint which returns
    // users across grouped companies (when allowed). Fallback to local employees if empty.
    listInterviewers(candidate.companyId)
      .then((res: any) => {
        if (!active) return;
        const fromApi = (res?.interviewers ?? []) as Employee[];
        if (fromApi.length > 0) {
          setInterviewerUsers(fromApi);
        } else if (localEligible.length > 0) {
          setInterviewerUsers(localEligible);
        } else {
          setInterviewerUsers([]);
        }
      })
      .catch(() => {
        if (!active) return;
        if (localEligible.length > 0) setInterviewerUsers(localEligible);
        else setInterviewerUsers([]);
      });

    return () => { active = false; };
  }, [candidate.companyId, employees]);

  useEffect(() => {
    setTagsDraft(splitCandidateTags(candidate.tags).userTags);
  }, [candidate.id, candidate.tags]);

  const handleAddInterviewFeedback = async (interviewId: number) => {
    const value = (feedbackDrafts[interviewId] ?? '').trim();
    if (!value) {
      showToast(t('ats.feedbackRequired'), 'error');
      return;
    }

    setSavingFeedbackId(interviewId);
    try {
      const comment = await addInterviewFeedbackComment(interviewId, value);
      setInterviewFeedback((prev) => ({
        ...prev,
        [interviewId]: [...(prev[interviewId] ?? []), comment],
      }));
      setFeedbackDrafts((prev) => ({ ...prev, [interviewId]: '' }));
      showToast(t('ats.feedbackSaved'), 'success');
    } catch {
      showToast(t('ats.feedbackError'), 'error');
    } finally {
      setSavingFeedbackId(null);
    }
  };

  const handleDeleteInterviewFeedback = async (interviewId: number, commentId: number, authorId: number | null) => {
    if (!canEdit && authorId !== user?.id) return;
    setDeletingFeedbackId(commentId);
    try {
      await deleteInterviewFeedbackComment(commentId);
      setInterviewFeedback((prev) => ({
        ...prev,
        [interviewId]: (prev[interviewId] ?? []).filter((c) => c.id !== commentId),
      }));
      showToast(t('ats.feedbackDeleted', 'Feedback deleted'), 'success');
    } catch {
      showToast(t('ats.feedbackDeleteError', 'Unable to delete feedback'), 'error');
    } finally {
      setDeletingFeedbackId(null);
    }
  };

  const handleDeleteInterview = async (interviewId: number) => {
    setDeletingInterviewId(interviewId);
    try {
      await deleteInterview(interviewId);
      setInterviews((prev) => prev.filter((iv) => iv.id !== interviewId));
      showToast(t('ats.interviewDeleted', 'Interview deleted'), 'success');
    } catch {
      showToast(t('ats.interviewDeleteError', 'Failed to delete interview'), 'error');
    } finally {
      setDeletingInterviewId(null);
    }
  };

  // Tags handlers
  const handleAddTag = () => {
    const normalized = tagInput.trim();
    if (!normalized) return;
    if (tagsDraft.some((tag) => tag.toLowerCase() === normalized.toLowerCase())) {
      showToast(t('ats.tagAlreadyExists', 'Tag already exists'), 'warning');
      return;
    }
    setTagsDraft((prev) => [...prev, normalized]);
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setTagsDraft((prev) => prev.filter((t) => t !== tag));
  };

  const handleSaveTags = async () => {
    setSavingTags(true);
    try {
      const nextTags = [...systemTags, ...tagsDraft].filter((tag, idx, arr) => (
        arr.findIndex((item) => item.toLowerCase() === tag.toLowerCase()) === idx
      ));
      await updateCandidateTags(candidate.id, nextTags);
      candidate.tags = nextTags; // Update local state
      setTagsDraft(splitCandidateTags(nextTags).userTags);
      setEditingTags(false);
      showToast(t('ats.tagsSaved', 'Tags updated'), 'success');
    } catch {
      showToast(t('ats.tagsError', 'Failed to update tags'), 'error');
    } finally {
      setSavingTags(false);
    }
  };

  const handleCancelTagsEdit = () => {
    setTagsDraft(splitCandidateTags(candidate.tags).userTags);
    setTagInput('');
    setEditingTags(false);
  };

  // Rejection handler
  const handleRejectWithReason = async () => {
    if (!rejectionReason.trim()) {
      showToast(t('ats.rejectionReasonRequired', 'Please provide a rejection reason'), 'error');
      return;
    }
    setSavingRejection(true);
    try {
      await onReject(rejectionReason.trim());
      setShowRejectionModal(false);
      setRejectionReason('');
      showToast(t('ats.candidateRejected', 'Candidate rejected'), 'success');
    } catch {
      showToast(t('ats.rejectionError', 'Failed to reject candidate'), 'error');
    } finally {
      setSavingRejection(false);
    }
  };

  const handleCreateInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intDate) return;
    setSavingInt(true);
    try {
      // Ensure time has a value, default to 09:00 if empty
      const timeValue = intTime || '09:00';
      const scheduledAt = new Date(`${intDate}T${timeValue}:00`).toISOString();

      const parsedInterviewerId = intInterviewerId ? Number(intInterviewerId) : undefined;

      if (editingInterviewId) {
        // Update existing interview
        const updated = await updateInterview(editingInterviewId, {
          scheduledAt,
          interviewType: intType,
          location: intLocation || undefined,
          description: intDescription || undefined,
          durationMinutes: typeof intDuration === 'number' ? intDuration : undefined,
          interviewerId: parsedInterviewerId,
        });
        setInterviews((prev) => prev.map((iv) => (iv.id === editingInterviewId ? updated : iv)));
        showToast(t('ats.interviewUpdated', 'Interview updated'), 'success');
      } else {
        // Create new interview
        const iv = await createInterview(candidate.id, {
          scheduledAt,
          interviewType: intType,
          location: intLocation || undefined,
          description: intDescription || undefined,
          durationMinutes: typeof intDuration === 'number' ? intDuration : undefined,
          interviewerId: parsedInterviewerId,
          sendIcs: intSendIcs,
        });
        setInterviews((prev) => [...prev, iv]);
        showToast(t('ats.interviewCreated'), 'success');

        // Load notification logs for the new interview
        try {
          const logs = await getInterviewNotifications(iv.id);
          setInterviewNotifications(prev => ({ ...prev, [iv.id]: logs }));
        } catch {
          // Ignore notification log loading errors
        }
      }

      setShowInterviewForm(false);
      setEditingInterviewId(null);
      setIntDate(''); setIntTime('09:00'); setIntLocation('');
      setIntType(defaultInterviewType); setIntDescription(''); setIntDuration(''); setIntInterviewerId(null); setIntSendIcs(true);
    } catch (err) {
      showToast(t('ats.interviewError'), 'error');
    } finally {
      setSavingInt(false);
    }
  };

  const prepareNewInterviewForm = () => {
    setEditingInterviewId(null);
    setIntDate('');
    setIntTime('09:00');
    setIntLocation('');
    setIntType(defaultInterviewType);
    setIntDescription('');
    setIntDuration('');
    setIntInterviewerId(null);
    setIntSendIcs(true);
    setShowInterviewForm(true);
  };

  const resetInterviewForm = () => {
    setShowInterviewForm(false);
    setEditingInterviewId(null);
    setIntDate('');
    setIntTime('09:00');
    setIntLocation('');
    setIntType(defaultInterviewType);
    setIntDescription('');
    setIntDuration('');
    setIntInterviewerId(null);
    setIntSendIcs(true);
  };

  const renderInterviewStatusChip = (
    interviewId: number,
    label: string,
    log: InterviewNotificationLog | null,
  ) => {
    const statusMap: Record<InterviewNotificationLog['status'], { label: string; color: string; bg: string }> = {
      pending: { label: 'pending', color: '#6b7280', bg: 'rgba(107,114,128,0.10)' },
      sending: { label: 'sending', color: '#b45309', bg: 'rgba(180,83,9,0.10)' },
      done: { label: 'sent', color: '#15803d', bg: 'rgba(21,128,61,0.10)' },
      error: { label: 'error', color: '#dc2626', bg: 'rgba(220,38,38,0.10)' },
    };

    const current = log ? statusMap[log.status] : { label: 'not sent', color: '#6b7280', bg: 'rgba(107,114,128,0.08)' };

    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 999, background: current.bg, color: current.color, fontSize: 10.5, fontWeight: 700 }}>
        {label}: {current.label}
        <button
          type="button"
          onClick={() => { if (log) void handleRetryNotification(interviewId, log.id); }}
          disabled={!log}
          title={t('common.resend', 'Resend')}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            marginLeft: 2,
            cursor: log ? 'pointer' : 'not-allowed',
            color: current.color,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RotateCcw size={10} />
        </button>
      </span>
    );
  };

  return (
    <>
      <ModalBackdrop onClose={onClose} width={680}>
        {/* Gradient header */}
        <div style={{
          backgroundColor: 'var(--surface)',
          backgroundImage: `linear-gradient(135deg, ${stageColor}18 0%, ${stageColor}08 100%)`,
          borderBottom: `3px solid ${stageColor}`,
          padding: isMobile ? '16px 16px' : '16px 24px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxSizing: 'border-box',
          maxWidth: '100%',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 18, lineHeight: 1,
            width: 28, height: 28, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingRight: 36 }}>
            {/* Avatar */}
            <div style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              background: stageColor, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18,
              boxShadow: `0 4px 16px ${stageColor}40`,
            }}>
              {initials(candidate.fullName)}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {candidate.fullName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  background: stageColor, color: '#fff',
                  borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700,
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
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                  · {appliedAgoLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: isMobile ? '16px 14px' : '20px 22px', display: 'flex', flexDirection: 'column', gap: 16, boxSizing: 'border-box', maxWidth: '100%', overflowX: 'hidden' }}>

          {/* Candidate Information */}
          <div style={{
            background: 'var(--background)', borderRadius: 12, padding: '14px 16px',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                👤 {t('ats.candidateInfo', 'Candidate Information')}
              </div>
              <span style={{
                background: 'var(--accent-light, rgba(201,151,58,0.10))',
                color: 'var(--accent)', border: '1px solid rgba(201,151,58,0.2)',
                borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                textTransform: 'capitalize',
              }}>
                {candidate.source}
              </span>
            </div>

            {/* Full Name with Avatar */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                {t('common.fullName', 'Full Name')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: stageColor, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10,
                  boxShadow: `0 2px 8px ${stageColor}30`,
                }}>
                  {initials(candidate.fullName)}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
                  {candidate.fullName}
                </div>
              </div>
            </div>

            {/* Contact Grid with Icons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
              {candidate.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📧</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                      Email
                    </div>
                    <a href={`mailto:${candidate.email}`} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-all', display: 'block' }}>
                      {candidate.email}
                    </a>
                  </div>
                </div>
              )}
              {candidate.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📞</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                      {t('ats.phone', 'Phone')}
                    </div>
                    <a href={`tel:${candidate.phone}`} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 500, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-all', display: 'block' }}>
                      {candidate.phone}
                    </a>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>📅</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                    {t('ats.appliedDate', 'Applied Date')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                    {appliedDateOnly}
                  </div>
                </div>
              </div>
              {availableStartDate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📅</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                      {t('ats.availableStartDate', 'Available Start Date')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {availableStartDate}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {candidate.coverLetter && (
              <div style={{ marginBottom: 12, border: '1px solid var(--border)', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
                <div
                  onClick={() => setCoverLetterOpen(!coverLetterOpen)}
                  style={{ cursor: 'pointer', listStyle: 'none', padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span>✉️ {t('ats.coverLetter', 'Cover Letter')}</span>
                  <ChevronDown size={16} style={{ transform: coverLetterOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', color: 'var(--text-muted)' }} />
                </div>
                {coverLetterOpen && (
                  <div style={{ padding: '0 14px 14px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', borderTop: '1px solid var(--border)' }}>
                    {candidate.coverLetter}
                  </div>
                )}
              </div>
            )}

            {/* Resume/CV - Smaller Icon */}
            {displayResumePath && (
              <div id="resume-section" style={{ marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                  <span>📄 {t('ats.resume', 'Resume / CV')}</span>
                  {resumeFileSizeLabel && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>
                      {resumeFileSizeLabel}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  {/* Smaller Document Icon */}
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.2)',
                  }}>
                    {displayResumePath.endsWith('.pdf') ? '📕' : displayResumePath.endsWith('.docx') || displayResumePath.endsWith('.doc') ? '📘' : '📄'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 1 }}>
                      {displayResumePath.split('/').pop()}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {displayResumePath}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const url = getResumeUrl(resumePath);
                      if (url) {
                        setPreviewDoc({ url, filename: displayResumePath.split('/').pop() || 'resume.pdf' });
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--background)',
                      color: 'var(--text-primary)',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {t('common.view', 'View')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Job Post Details - Enhanced */}
          {appliedJob && (
            <>
              <div style={{
                border: '1px solid var(--border)',
                borderRadius: 12,
                background: '#fff',
                padding: '14px 16px',
              }}>
                {/* Header Row with Title and Target Role Tag */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    💼 {t('ats.jobPostDetails', 'Job Post Details')}
                  </div>
                  {appliedJob.targetRole && (
                    <span style={{
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#fff',
                      borderRadius: 99,
                      padding: '3px 10px',
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
                    }}>
                      {appliedJob.targetRole.replace('_', ' ')}
                    </span>
                  )}
                </div>

                {/* Title Row with Status Tag */}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3, flex: 1, minWidth: 0 }}>
                    {appliedJob.title}
                  </h3>
                  <span style={{
                    borderRadius: 999,
                    border: '1px solid rgba(13,33,55,0.18)',
                    background: STATUS_COLOR[appliedJob.status] + '15',
                    color: STATUS_COLOR[appliedJob.status],
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '3px 8px',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}>
                    {t(`ats.status_${appliedJob.status}`, appliedJob.status)}
                  </span>
                </div>

                {/* Description Row */}
                {appliedJob.description && (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, margin: '0 0 10px 0', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {appliedJob.description.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}
                  </p>
                )}

                {/* First Row: Location and Work Arrangement */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
                  {/* Location with Flag */}
                  {(appliedJob.jobCountry || appliedJob.country) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--background)', borderRadius: 6 }}>
                      <span style={{ fontSize: 14 }}>📍</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t('common.location', 'Location')}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {(appliedJob.jobCountry || appliedJob.country) && (
                            <ReactCountryFlag
                              countryCode={appliedJob.jobCountry || appliedJob.country || ''}
                              svg
                              style={{ width: '0.95em', height: '0.95em' }}
                            />
                          )}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {[appliedJob.jobCity || appliedJob.city, appliedJob.jobState || appliedJob.state].filter(Boolean).join(', ') || (appliedJob.jobCountry || appliedJob.country)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Remote Type */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--background)', borderRadius: 6 }}>
                    <Globe2 size={14} color="var(--text-muted)" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {t('ats.workArrangement', 'Work Arrangement')}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {t(`ats.remoteType_${appliedJob.remoteType}`, appliedJob.remoteType)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Second Row: Department, Hours, Job Type */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 8 }}>
                  {appliedJob.department && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--background)', borderRadius: 6 }}>
                      <span style={{ fontSize: 14 }}>🏢</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t('ats.department', 'Department')}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {appliedJob.department}
                        </div>
                      </div>
                    </div>
                  )}

                  {appliedJob.weeklyHours && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--background)', borderRadius: 6 }}>
                      <Clock3 size={14} color="var(--text-muted)" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t('ats.weeklyHours', 'Weekly Hours')}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)' }}>
                          {appliedJob.weeklyHours}h/week
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Job Type */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--background)', borderRadius: 6 }}>
                    <BriefcaseBusiness size={14} color="var(--text-muted)" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {t('ats.jobType', 'Job Type')}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {t(`ats.jobType_${JOB_TYPE_LABEL[appliedJob.jobType]}`, appliedJob.jobType)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Salary Range */}
                {(appliedJob.salaryMin || appliedJob.salaryMax) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)', borderRadius: 6, border: '1px solid #BBF7D0' }}>
                    <span style={{ fontSize: 16 }}>💰</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>
                        {t('ats.salaryRange', 'Salary Range')}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#15803D' }}>
                        {appliedJob.salaryMin && appliedJob.salaryMax
                          ? `€${appliedJob.salaryMin.toLocaleString()} - €${appliedJob.salaryMax.toLocaleString()}`
                          : appliedJob.salaryMin
                            ? `€${appliedJob.salaryMin.toLocaleString()}+`
                            : `€${appliedJob.salaryMax?.toLocaleString()}`}
                        {appliedJob.salaryPeriod && (
                          <span style={{ fontSize: 10, fontWeight: 500, color: '#16A34A', marginLeft: 4 }}>
                            / {appliedJob.salaryPeriod}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Job Tags */}
                {appliedJob.tags && appliedJob.tags.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      {t('ats.jobTags', 'Job Tags')}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {appliedJob.tags.map((tag) => (
                        <span key={tag} style={{
                          background: 'rgba(59,130,246,0.08)',
                          color: '#2563EB',
                          border: '1px solid rgba(59,130,246,0.2)',
                          borderRadius: 99,
                          padding: '3px 10px',
                          fontSize: 11,
                          fontWeight: 500,
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Job Post Creator Section - Enhanced */}
              <div style={{
                border: '1px solid var(--border)',
                borderRadius: 12,
                background: '#fff',
                padding: '16px 18px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                  👨‍💼 {t('ats.jobPostCreator', 'Job Post Creator')}
                </div>

                {/* Creator Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                  {appliedJob.createdByAvatarFilename && getAvatarUrl(appliedJob.createdByAvatarFilename) ? (
                    <img
                      src={getAvatarUrl(appliedJob.createdByAvatarFilename) || ''}
                      alt={appliedJob.createdByName || 'User'}
                      style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
                    />
                  ) : (
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 16, border: '2px solid var(--border)',
                    }}>
                      {appliedJob.createdByName ? appliedJob.createdByName[0].toUpperCase() : '?'}
                    </div>
                  )}

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {appliedJob.createdByName} {appliedJob.createdBySurname}
                      {appliedJob.createdByRole && (
                        <span style={{
                          marginLeft: 8,
                          fontSize: 11,
                          fontWeight: 500,
                          color: 'var(--text-muted)',
                          textTransform: 'capitalize'
                        }}>
                          · {appliedJob.createdByRole.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      <strong>{t('ats.created', 'Created')}:</strong> {formatDate(appliedJob.createdAt)}
                      {appliedJob.publishedAt && (
                        <span style={{ marginLeft: 8 }}>
                          · <strong>{t('ats.published', 'Published')}:</strong> {formatDate(appliedJob.publishedAt, 'short')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Company Info */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                    {t('common.company', 'Company')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px', background: 'var(--background)', borderRadius: 8 }}>
                    {appliedJob.companyLogoFilename && getCompanyLogoUrl(appliedJob.companyLogoFilename) ? (
                      <img
                        src={getCompanyLogoUrl(appliedJob.companyLogoFilename) || ''}
                        alt={appliedJob.companyName || 'Company'}
                        style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: 'var(--primary)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 14,
                      }}>
                        {appliedJob.companyName ? appliedJob.companyName[0].toUpperCase() : 'C'}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {appliedJob.companyName || 'N/A'}
                        </span>
                        {appliedJob.companyCountry && (
                          <ReactCountryFlag
                            countryCode={appliedJob.companyCountry}
                            svg
                            style={{ width: '0.9em', height: '0.9em', flexShrink: 0 }}
                          />
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {appliedJob.companyGroupName && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: 10,
                            fontWeight: 600,
                            color: 'var(--accent)',
                            background: 'var(--accent-light)',
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}>
                            {appliedJob.companyGroupName}
                          </span>
                        )}
                        {(appliedJob.companyOwnerName || appliedJob.companyOwnerSurname) && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            {appliedJob.companyOwnerAvatarFilename && getAvatarUrl(appliedJob.companyOwnerAvatarFilename) ? (
                              <img
                                src={getAvatarUrl(appliedJob.companyOwnerAvatarFilename) || ''}
                                alt={`${appliedJob.companyOwnerName} ${appliedJob.companyOwnerSurname}`}
                                style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }}
                              />
                            ) : (
                              <div style={{
                                width: 14, height: 14, borderRadius: '50%',
                                background: 'var(--primary)', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 7, fontWeight: 700,
                              }}>
                                {appliedJob.companyOwnerName ? appliedJob.companyOwnerName[0].toUpperCase() : 'O'}
                              </div>
                            )}
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                              {appliedJob.companyOwnerName} {appliedJob.companyOwnerSurname}
                            </span>
                          </div>
                        )}
                        {appliedJob.companyStoreCount != null && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            · {appliedJob.companyStoreCount} {t('employees.storesLabel', 'Stores')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Store Info */}
                {appliedJob.storeName && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                      {t('common.store', 'Store')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px', background: 'var(--background)', borderRadius: 8 }}>
                      {appliedJob.storeLogoFilename && getStoreLogoUrl(appliedJob.storeLogoFilename) ? (
                        <img
                          src={getStoreLogoUrl(appliedJob.storeLogoFilename) || ''}
                          alt={appliedJob.storeName}
                          style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: 'var(--accent)', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 14,
                        }}>
                          {appliedJob.storeName[0].toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {appliedJob.storeName}
                          </span>
                          {appliedJob.storeCountry && (
                            <ReactCountryFlag
                              countryCode={appliedJob.storeCountry}
                              svg
                              style={{ width: '0.9em', height: '0.9em', flexShrink: 0 }}
                            />
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {(appliedJob.storeHrName || appliedJob.storeHrSurname) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>HR:</span>
                              {appliedJob.storeHrAvatarFilename && getAvatarUrl(appliedJob.storeHrAvatarFilename) ? (
                                <img
                                  src={getAvatarUrl(appliedJob.storeHrAvatarFilename) || ''}
                                  alt={`${appliedJob.storeHrName} ${appliedJob.storeHrSurname}`}
                                  style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }}
                                />
                              ) : (
                                <div style={{
                                  width: 16, height: 16, borderRadius: '50%',
                                  background: 'var(--primary)', color: '#fff',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 8, fontWeight: 700,
                                }}>
                                  {appliedJob.storeHrName ? appliedJob.storeHrName[0].toUpperCase() : 'H'}
                                </div>
                              )}
                              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                                {appliedJob.storeHrName} {appliedJob.storeHrSurname}
                              </span>
                            </div>
                          )}
                          {(appliedJob.storeAreaManagerName || appliedJob.storeAreaManagerSurname) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Area Manager:</span>
                              {appliedJob.storeAreaManagerAvatarFilename && getAvatarUrl(appliedJob.storeAreaManagerAvatarFilename) ? (
                                <img
                                  src={getAvatarUrl(appliedJob.storeAreaManagerAvatarFilename) || ''}
                                  alt={`${appliedJob.storeAreaManagerName} ${appliedJob.storeAreaManagerSurname}`}
                                  style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }}
                                />
                              ) : (
                                <div style={{
                                  width: 16, height: 16, borderRadius: '50%',
                                  background: '#059669', color: '#fff',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 8, fontWeight: 700,
                                }}>
                                  {appliedJob.storeAreaManagerName ? appliedJob.storeAreaManagerName[0].toUpperCase() : 'A'}
                                </div>
                              )}
                              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                                {appliedJob.storeAreaManagerName} {appliedJob.storeAreaManagerSurname}
                              </span>
                            </div>
                          )}
                          {(appliedJob.storeManagerName || appliedJob.storeManagerSurname) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{t('common.manager', 'Manager')}:</span>
                              {appliedJob.storeManagerAvatarFilename && getAvatarUrl(appliedJob.storeManagerAvatarFilename) ? (
                                <img
                                  src={getAvatarUrl(appliedJob.storeManagerAvatarFilename) || ''}
                                  alt={`${appliedJob.storeManagerName} ${appliedJob.storeManagerSurname}`}
                                  style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }}
                                />
                              ) : (
                                <div style={{
                                  width: 16, height: 16, borderRadius: '50%',
                                  background: 'var(--accent)', color: '#fff',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 8, fontWeight: 700,
                                }}>
                                  {appliedJob.storeManagerName ? appliedJob.storeManagerName[0].toUpperCase() : 'M'}
                                </div>
                              )}
                              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                                {appliedJob.storeManagerName} {appliedJob.storeManagerSurname}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Candidate Tags */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                🏷️ {t('ats.candidateTags', 'Candidate Tags')}
              </div>
              {canTag && !editingTags && (
                <button
                  type="button"
                  onClick={() => setEditingTags(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '2px 6px',
                  }}
                >
                  ✏️ {t('common.edit', 'Edit')}
                </button>
              )}
            </div>

            {editingTags ? (
              <div style={{ background: 'var(--background)', borderRadius: 10, padding: '12px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {tagsDraft.map((tag) => (
                    <span key={tag} style={{
                      background: 'var(--accent-light, rgba(201,151,58,0.10))',
                      color: 'var(--accent)', border: '1px solid rgba(201,151,58,0.2)',
                      borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 500,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: 14,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder={t('ats.addTagPlaceholder', 'Type and press Enter')}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      fontSize: 12,
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      background: 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleCancelTagsEdit}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                    }}
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTags}
                    disabled={savingTags}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      background: 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius)',
                      cursor: savingTags ? 'not-allowed' : 'pointer',
                      opacity: savingTags ? 0.6 : 1,
                    }}
                  >
                    {savingTags ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {tagsDraft.length === 0 ? (
                  <div style={{
                    background: 'var(--background)', borderRadius: 10, padding: '8px 12px',
                    fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic',
                  }}>
                    {t('ats.noTags', 'No tags')}
                  </div>
                ) : (
                  tagsDraft.map((tag) => (
                    <span key={tag} style={{
                      background: 'var(--accent-light, rgba(201,151,58,0.10))',
                      color: 'var(--accent)', border: '1px solid rgba(201,151,58,0.2)',
                      borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 500,
                    }}>
                      {tag}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Stage pipeline visual */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Pipeline
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {(() => {
                const allStages: CandidateStatus[] = ['received', 'review', 'phone_interview', 'interview', 'hired'];

                // For rejected candidates, show only stages up to their last stage before rejection
                let stagesToShow: CandidateStatus[] = allStages;

                if (candidate.status === 'rejected') {
                  // Determine which stage they were rejected from based on lastStageChange or interviews
                  // Default to 'received' if we can't determine
                  let lastStageBeforeRejection: CandidateStatus = 'received';

                  // Check if there are interviews to determine the stage
                  if (interviews.length > 0) {
                    // If they had interviews, they at least reached interview stage
                    lastStageBeforeRejection = 'interview';
                  } else if (candidate.lastStageChange) {
                    // Try to infer from lastStageChange timestamp
                    // This is a simple heuristic - in a real system you'd track stage history
                    const daysSinceLastChange = Math.floor((Date.now() - new Date(candidate.lastStageChange).getTime()) / (1000 * 60 * 60 * 24));
                    if (daysSinceLastChange > 7) {
                      lastStageBeforeRejection = 'review';
                    }
                  }

                  // Show stages up to and including the last stage before rejection
                  const lastStageIndex = allStages.indexOf(lastStageBeforeRejection);
                  stagesToShow = allStages.slice(0, lastStageIndex + 1);
                }

                return stagesToShow.map((s, idx, stages) => {
                  const stageIdx = [...stages, 'rejected'].indexOf(candidate.status);
                  const isDone = candidate.status !== 'rejected' && stageIdx >= idx;
                  const isCurrent = candidate.status !== 'rejected' && stageIdx === idx;
                  const sc = STAGE_COLOR[s];
                  return (
                    <React.Fragment key={s}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: isDone ? sc : candidate.status === 'rejected' ? sc : 'var(--border)',
                          border: isCurrent ? `3px solid ${sc}` : 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.2s',
                          boxShadow: isCurrent ? `0 0 0 3px ${sc}22` : 'none',
                        }}>
                          {(isDone || candidate.status === 'rejected') && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                        </div>
                        <div style={{ fontSize: 10, color: (isDone || candidate.status === 'rejected') ? sc : 'var(--text-muted)', fontWeight: isCurrent ? 700 : 400, marginTop: 4, textAlign: 'center' }}>
                          {t(`ats.stage_${s}`)}
                        </div>
                      </div>
                      {idx < stages.length - 1 && (
                        <div style={{
                          height: 2, flex: 1, marginBottom: 18,
                          background: candidate.status !== 'rejected' && stageIdx > idx ? sc : candidate.status === 'rejected' ? sc : 'var(--border)',
                          transition: 'background 0.3s',
                        }} />
                      )}
                    </React.Fragment>
                  );
                });
              })()}

              {/* Show rejected stage at the end for rejected candidates */}
              {candidate.status === 'rejected' && (
                <>
                  <div style={{
                    height: 2, flex: 1, marginBottom: 18,
                    background: '#DC2626',
                    transition: 'background 0.3s',
                  }} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: '#DC2626',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}>
                      <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✕</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#DC2626', fontWeight: 700, marginTop: 4, textAlign: 'center' }}>
                      {t('ats.stage_rejected')}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {candidate.status === 'rejected' && candidate.rejectionReason && (
            <div style={{
              border: '1px solid #FCA5A5',
              background: '#FEF2F2',
              borderRadius: 10,
              padding: '10px 12px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                {t('ats.rejectionReason', 'Rejection reason')}
              </div>
              <div style={{ fontSize: 12, color: '#7F1D1D', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {candidate.rejectionReason}
              </div>
            </div>
          )}

          {/* Interviews section */}
          {(candidate.status === 'interview' || candidate.status === 'phone_interview' || interviews.length > 0) && (
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
                  <Button variant="secondary" size="sm" onClick={prepareNewInterviewForm}>
                    + {t('ats.addInterview')}
                  </Button>
                )}
              </div>

              {/* Create interview form - displayed at top when active */}
              {canEdit && showInterviewForm && (
                <form onSubmit={handleCreateInterview} style={{
                  background: 'var(--background)', borderRadius: 12, padding: '16px',
                  display: 'flex', flexDirection: 'column', gap: 12,
                  border: '1px solid var(--border)',
                  marginBottom: 12,
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                    <DatePicker
                      label={`${t('ats.interviewDate')} *`}
                      value={intDate}
                      onChange={setIntDate}
                    />
                    <TimePicker
                      label={t('ats.interviewTime')}
                      value={intTime}
                      onChange={setIntTime}
                    />
                  </div>

                  {/* Interview Type and Duration */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 160px', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                        {t('ats.interviewType')}
                      </label>
                      <select
                        value={intType}
                        onChange={(e) => setIntType(e.target.value as 'phone' | 'in_person')}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '7px 10px',
                          fontSize: 13,
                          borderRadius: 'var(--radius)',
                          border: '1px solid var(--border)',
                          outline: 'none',
                          background: 'var(--background)'
                        }}
                      >
                        <option value="phone">📞 {t('ats.phoneInterview')}</option>
                        <option value="in_person">🤝 {t('ats.inPersonInterview')}</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                        {t('ats.duration')} (min)
                      </label>
                      <input
                        type="number"
                        value={intDuration}
                        onChange={(e) => setIntDuration(e.target.value ? Number(e.target.value) : '')}
                        placeholder="60"
                        min="1"
                        max="480"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '7px 10px',
                          fontSize: 13,
                          borderRadius: 'var(--radius)',
                          border: '1px solid var(--border)',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                      {t('ats.interviewer')}
                    </label>
                    <CustomSelect
                      value={intInterviewerId}
                      onChange={setIntInterviewerId}
                      options={interviewerOptions}
                      placeholder={t('ats.selectInterviewer')}
                      searchable
                      isClearable
                      highlightSelected
                      controlMinHeight={36}
                      noOptionsMessage={t('ats.noInterviewerResults', 'No interviewers found')}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                      {t('ats.interviewLocation')}
                    </label>
                    <input className="field-input" value={intLocation} onChange={(e) => setIntLocation(e.target.value)}
                      placeholder={t('ats.interviewLocationPlaceholder')}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', outline: 'none', display: 'block' }} />
                  </div>
                  {/* Description */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                      {t('ats.interviewDescription')}
                    </label>
                    <textarea
                      value={intDescription}
                      onChange={(e) => setIntDescription(e.target.value)}
                      rows={2}
                      placeholder={t('ats.interviewDescriptionPlaceholder')}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        resize: 'none',
                        fontFamily: 'inherit',
                        padding: '7px 10px',
                        fontSize: 13,
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                        outline: 'none',
                        display: 'block'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      id="ats-send-ics"
                      type="checkbox"
                      checked={intSendIcs}
                      onChange={(e) => setIntSendIcs(e.target.checked)}
                      style={{ width: 14, height: 14 }}
                    />
                    <label htmlFor="ats-send-ics" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {t('ats.calendarSync', 'Add to calendar (ICS)')}
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Button variant="secondary" size="sm" type="button" onClick={() => {
                      resetInterviewForm();
                    }}>
                      {t('common.cancel')}
                    </Button>
                    <Button variant="primary" size="sm" type="submit" loading={savingInt}>
                      {editingInterviewId ? t('common.update', 'Update') : t('ats.scheduleInterview')}
                    </Button>
                  </div>
                </form>
              )}

              {interviews.length === 0 && !showInterviewForm && (
                <div style={{
                  background: 'var(--background)', borderRadius: 10, padding: '12px 16px',
                  fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic',
                }}>
                  {t('ats.noInterviews')}
                </div>
              )}

              {interviews.map((iv) => {
                const interviewDate = new Date(iv.scheduledAt);
                const now = new Date();
                const isPast = interviewDate < now;
                const statusLabel = isPast ? t('ats.interviewPast', 'Past') : t('ats.interviewUpcoming', 'Upcoming');
                const statusColor = isPast ? '#6b7280' : '#059669';
                const statusBg = isPast ? 'rgba(107, 114, 128, 0.1)' : 'rgba(5, 150, 105, 0.1)';
                const interviewer = iv.interviewerId ? interviewerUsers.find((emp) => emp.id === iv.interviewerId) ?? null : null;
                const interviewerName = interviewer ? `${interviewer.name} ${interviewer.surname}`.trim() : t('ats.interviewer', 'Interviewer');
                const interviewerAvatar = interviewer ? getAvatarUrl(interviewer.avatarFilename) : null;
                const interviewerRole = interviewer ? t(`roles.${interviewer.role}`, interviewer.role) : null;
                const emailLog = interviewNotifications[iv.id]?.find((log) => log.recipientType === 'interviewer' && log.channel === 'email') ?? null;
                const notificationLog = interviewNotifications[iv.id]?.find((log) => log.recipientType === 'interviewer' && log.channel !== 'email') ?? null;
                const candidateEmailLog = interviewNotifications[iv.id]?.find((log) => log.recipientType === 'candidate' && log.channel === 'email') ?? null;

                return (
                  <div key={iv.id} style={{
                    background: 'var(--background)', borderRadius: 10, padding: '12px 16px',
                    marginBottom: 8, borderLeft: `3px solid ${STAGE_COLOR.interview}`,
                    position: 'relative',
                  }}>
                    {/* Top Row: Date/Time/Status and Edit/Delete buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                          🕐 {fmtDateTime(iv.scheduledAt)}
                        </div>
                        <span style={{
                          background: statusBg,
                          color: statusColor,
                          borderRadius: 99,
                          padding: '2px 8px',
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                        }}>
                          {statusLabel}
                        </span>
                      </div>
                      {canEdit && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            onClick={() => {
                              // Populate form with existing interview data
                              const ivDate = new Date(iv.scheduledAt);
                              setIntDate(ivDate.toISOString().split('T')[0]);
                              setIntTime(ivDate.toTimeString().slice(0, 5));
                              setIntLocation(iv.location || '');
                              setIntType(iv.interviewType || 'in_person');
                              setIntDescription(iv.description || iv.notes || '');
                              setIntDuration(iv.durationMinutes || '');
                              setIntInterviewerId(iv.interviewerId ? String(iv.interviewerId) : null);
                              setIntSendIcs(false);
                              setEditingInterviewId(iv.id);
                              setShowInterviewForm(true);
                            }}
                            style={{
                              background: 'rgba(13,33,55,0.08)',
                              border: '1px solid rgba(13,33,55,0.2)',
                              borderRadius: 6,
                              width: 24,
                              height: 24,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                            title={t('common.edit', 'Edit')}
                          >
                            <Pencil size={12} color="var(--primary)" />
                          </button>
                          <button
                            onClick={() => handleDeleteInterview(iv.id)}
                            disabled={deletingInterviewId === iv.id}
                            style={{
                              background: 'rgba(220,38,38,0.08)',
                              border: '1px solid rgba(185,28,28,0.24)',
                              borderRadius: 6,
                              width: 24,
                              height: 24,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: deletingInterviewId === iv.id ? 'not-allowed' : 'pointer',
                              opacity: deletingInterviewId === iv.id ? 0.5 : 1,
                              transition: 'all 0.15s',
                            }}
                            title={t('common.delete', 'Delete')}
                          >
                            <Trash2 size={12} color="#991b1b" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Second Row: Location, Type, Duration tags */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {iv.location && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface)', padding: '2px 7px', borderRadius: 999 }}>
                          📍 {iv.location}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface)', padding: '2px 7px', borderRadius: 999 }}>
                        {iv.interviewType === 'phone' ? '📞 Phone' : '🤝 In-person'}
                      </span>
                      {iv.durationMinutes && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface)', padding: '2px 7px', borderRadius: 999 }}>
                          ⏱ {iv.durationMinutes}min
                        </span>
                      )}
                    </div>

                    {/* Full Width Interviewer Row and Notification Status */}
                    <div style={{ display: 'grid', gap: 8 }}>
                      {interviewer && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                            <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', background: interviewerAvatar ? 'transparent' : 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                              {interviewerAvatar ? (
                                <img src={interviewerAvatar} alt={interviewerName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : initials(interviewerName)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{interviewerName}</div>
                              {interviewerRole && (
                                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{interviewerRole}</div>
                              )}
                            </div>
                          </div>

                          {/* Candidate, Email and Notification status columns side-by-side */}
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                            {/* Candidate Email Status */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: '120px', opacity: smtpConfigured === false ? 0.5 : 1, position: 'relative' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                                <User2 size={11} /> {t('ats.candidateEmail', 'Candidate')}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                                <span
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 6,
                                    background: smtpConfigured === false
                                      ? 'rgba(107,114,128,0.08)'
                                      : !candidateEmailLog
                                        ? 'rgba(107,114,128,0.08)'
                                        : candidateEmailLog.status === 'done'
                                          ? 'rgba(21,128,61,0.1)'
                                          : candidateEmailLog.status === 'error'
                                            ? 'rgba(220,38,38,0.1)'
                                            : candidateEmailLog.status === 'sending'
                                              ? 'rgba(59,130,246,0.1)'
                                              : 'rgba(107,114,128,0.1)',
                                    color: smtpConfigured === false
                                      ? '#9ca3af'
                                      : !candidateEmailLog
                                        ? '#6b7280'
                                        : candidateEmailLog.status === 'done'
                                          ? '#15803d'
                                          : candidateEmailLog.status === 'error'
                                            ? '#dc2626'
                                            : candidateEmailLog.status === 'sending'
                                              ? '#2563eb'
                                              : '#6b7280',
                                    fontWeight: 600,
                                    cursor: smtpConfigured === false ? 'help' : 'default',
                                    position: 'relative',
                                  }}
                                  title={smtpConfigured === false ? 'Email functionality is disabled. Please configure SMTP settings in Company Settings → Email Configuration to enable email notifications.' : candidateEmailLog?.errorMessage || ''}
                                  onMouseEnter={(e) => {
                                    if (smtpConfigured === false) {
                                      const tooltip = document.createElement('div');
                                      tooltip.id = 'smtp-tooltip-candidate';
                                      tooltip.style.cssText = `
                                              position: absolute;
                                              bottom: calc(100% + 8px);
                                              left: 50%;
                                              transform: translateX(-50%);
                                              background: #1f2937;
                                              color: white;
                                              padding: 8px 12px;
                                              border-radius: 6px;
                                              font-size: 11px;
                                              white-space: nowrap;
                                              z-index: 1000;
                                              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                                              pointer-events: none;
                                            `;
                                      tooltip.textContent = 'SMTP not configured for this company';
                                      e.currentTarget.appendChild(tooltip);
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    const tooltip = e.currentTarget.querySelector('#smtp-tooltip-candidate');
                                    if (tooltip) tooltip.remove();
                                  }}
                                >
                                  {smtpConfigured === false
                                    ? '⊗ Disabled'
                                    : !candidateEmailLog
                                      ? '• Not sent'
                                      : candidateEmailLog.status === 'done'
                                        ? '✓ Sent'
                                        : candidateEmailLog.status === 'error'
                                          ? '✗ Error'
                                          : candidateEmailLog.status === 'sending'
                                            ? '⟳ Sending...'
                                            : '⏳ Pending'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => void handleRetryNotification(iv.id, candidateEmailLog?.id, 'email', 'candidate')}
                                  disabled={smtpConfigured === false}
                                  title={smtpConfigured === false ? 'Email is disabled. Configure SMTP in Settings to enable.' : candidateEmailLog ? t('common.resend', 'Resend') : t('common.send', 'Send')}
                                  style={{
                                    background: 'none', border: 'none', padding: '2px 4px', cursor: smtpConfigured === false ? 'not-allowed' : 'pointer',
                                    color: smtpConfigured === false
                                      ? '#9ca3af'
                                      : !candidateEmailLog
                                        ? '#6b7280'
                                        : candidateEmailLog.status === 'done'
                                          ? '#15803d'
                                          : candidateEmailLog.status === 'error'
                                            ? '#dc2626'
                                            : '#6b7280',
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: smtpConfigured === false ? 0.4 : 0.7, fontSize: 10,
                                  }}
                                >
                                  <RotateCcw size={10} />
                                </button>
                              </div>
                            </div>

                            {/* Interviewer Email Status - Hidden for store managers */}
                            {user?.role !== 'store_manager' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: '120px', opacity: smtpConfigured === false ? 0.5 : 1, position: 'relative' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                                  📧 {t('ats.interviewerEmail', 'Interviewer')}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                                  <span
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 6,
                                      background: smtpConfigured === false
                                        ? 'rgba(107,114,128,0.08)'
                                        : !emailLog
                                          ? 'rgba(107,114,128,0.08)'
                                          : emailLog.status === 'done'
                                            ? 'rgba(21,128,61,0.1)'
                                            : emailLog.status === 'error'
                                              ? 'rgba(220,38,38,0.1)'
                                              : emailLog.status === 'sending'
                                                ? 'rgba(59,130,246,0.1)'
                                                : 'rgba(107,114,128,0.1)',
                                      color: smtpConfigured === false
                                        ? '#9ca3af'
                                        : !emailLog
                                          ? '#6b7280'
                                          : emailLog.status === 'done'
                                            ? '#15803d'
                                            : emailLog.status === 'error'
                                              ? '#dc2626'
                                              : emailLog.status === 'sending'
                                                ? '#2563eb'
                                                : '#6b7280',
                                      fontWeight: 600,
                                      cursor: smtpConfigured === false ? 'help' : 'default',
                                      position: 'relative',
                                    }}
                                    title={smtpConfigured === false ? 'Email functionality is disabled. Please configure SMTP settings in Company Settings → Email Configuration to enable email notifications.' : emailLog?.errorMessage || ''}
                                    onMouseEnter={(e) => {
                                      if (smtpConfigured === false) {
                                        const tooltip = document.createElement('div');
                                        tooltip.id = 'smtp-tooltip';
                                        tooltip.style.cssText = `
                                              position: absolute;
                                              bottom: calc(100% + 8px);
                                              left: 50%;
                                              transform: translateX(-50%);
                                              background: #1f2937;
                                              color: white;
                                              padding: 8px 12px;
                                              border-radius: 6px;
                                              font-size: 11px;
                                              white-space: nowrap;
                                              z-index: 1000;
                                              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                                              pointer-events: none;
                                            `;
                                        tooltip.textContent = 'SMTP not configured for this company';
                                        e.currentTarget.appendChild(tooltip);
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      const tooltip = e.currentTarget.querySelector('#smtp-tooltip');
                                      if (tooltip) tooltip.remove();
                                    }}
                                  >
                                    {smtpConfigured === false
                                      ? '⊗ Disabled'
                                      : !emailLog
                                        ? '• Not sent'
                                        : emailLog.status === 'done'
                                          ? '✓ Sent'
                                          : emailLog.status === 'error'
                                            ? '✗ Error'
                                            : emailLog.status === 'sending'
                                              ? '⟳ Sending...'
                                              : '⏳ Pending'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => void handleRetryNotification(iv.id, emailLog?.id, 'email', 'interviewer')}
                                    disabled={smtpConfigured === false}
                                    title={smtpConfigured === false ? 'Email is disabled. Configure SMTP in Settings to enable.' : emailLog ? t('common.resend', 'Resend') : t('common.send', 'Send')}
                                    style={{
                                      background: 'none', border: 'none', padding: '2px 4px', cursor: smtpConfigured === false ? 'not-allowed' : 'pointer',
                                      color: smtpConfigured === false
                                        ? '#9ca3af'
                                        : !emailLog
                                          ? '#6b7280'
                                          : emailLog.status === 'done'
                                            ? '#15803d'
                                            : emailLog.status === 'error'
                                              ? '#dc2626'
                                              : '#6b7280',
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: smtpConfigured === false ? 0.4 : 0.7, fontSize: 10,
                                    }}
                                  >
                                    <RotateCcw size={10} />
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Notification Status - Hidden for store managers */}
                            {user?.role !== 'store_manager' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: '120px', opacity: interviewInviteEnabled === false ? 0.5 : 1, position: 'relative' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                                  🔔 {t('ats.notification', 'Notification')}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                                  <span
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 6,
                                      background: interviewInviteEnabled === false
                                        ? 'rgba(107,114,128,0.08)'
                                        : !notificationLog
                                          ? 'rgba(107,114,128,0.08)'
                                          : notificationLog.status === 'done'
                                            ? 'rgba(21,128,61,0.1)'
                                            : notificationLog.status === 'error'
                                              ? 'rgba(220,38,38,0.1)'
                                              : 'rgba(107,114,128,0.1)',
                                      color: interviewInviteEnabled === false
                                        ? '#9ca3af'
                                        : !notificationLog
                                          ? '#6b7280'
                                          : notificationLog.status === 'done'
                                            ? '#15803d'
                                            : notificationLog.status === 'error'
                                              ? '#dc2626'
                                              : '#6b7280',
                                      fontWeight: 600,
                                      cursor: interviewInviteEnabled === false ? 'help' : 'default',
                                    }}
                                    title={interviewInviteEnabled === false ? 'Notification functionality is disabled. Please enable "Interview Invite" notification in Company Settings → Notifications to send in-app notifications.' : notificationLog?.errorMessage || ''}
                                  >
                                    {interviewInviteEnabled === false
                                      ? '⊗ Disabled'
                                      : !notificationLog
                                        ? '• Not sent'
                                        : notificationLog.status === 'done'
                                          ? '✓ Sent'
                                          : notificationLog.status === 'error'
                                            ? '✗ Error'
                                            : notificationLog.status === 'sending'
                                              ? '⟳ Sending'
                                              : '⏳ Pending'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => void handleRetryNotification(iv.id, notificationLog?.id, 'in_app', 'interviewer')}
                                    disabled={interviewInviteEnabled === false}
                                    title={interviewInviteEnabled === false ? 'Notifications are disabled. Enable in Settings to send.' : notificationLog ? t('common.resend', 'Resend') : t('common.send', 'Send')}
                                    style={{
                                      background: 'none', border: 'none', padding: '2px 4px', cursor: interviewInviteEnabled === false ? 'not-allowed' : 'pointer',
                                      color: interviewInviteEnabled === false
                                        ? '#9ca3af'
                                        : !notificationLog
                                          ? '#6b7280'
                                          : notificationLog.status === 'done'
                                            ? '#15803d'
                                            : notificationLog.status === 'error'
                                              ? '#dc2626'
                                              : '#6b7280',
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: interviewInviteEnabled === false ? 0.4 : 0.7, fontSize: 10,
                                    }}
                                  >
                                    <RotateCcw size={10} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {iv.description && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          {iv.description}
                        </div>
                      )}
                    </div>

                    {/* Feedback Comments List */}
                    <div id="comments-section"></div>
                    {interviewFeedback[iv.id] && interviewFeedback[iv.id].length > 0 && (
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          💬 {t('ats.feedback', 'Feedback')} ({interviewFeedback[iv.id].length})
                        </div>
                        {interviewFeedback[iv.id].map((comment) => {
                          const authorName = [comment.authorName, comment.authorSurname].filter(Boolean).join(' ').trim() || t('common.notSet', 'Not set');
                          const authorAvatar = getAvatarUrl(comment.authorAvatarFilename ?? null);
                          const canDelete = canEdit || comment.authorId === user?.id;

                          const deepLinkedFeedbackId = Number(searchParams.get('feedbackId') || '0');
                          const isHighlighted = comment.id === deepLinkedFeedbackId;

                          return (
                            <div
                              key={comment.id}
                              id={`feedback-comment-${comment.id}`}
                              style={{
                                background: isHighlighted ? 'rgba(201, 151, 58, 0.12)' : 'var(--background)',
                                borderRadius: 8,
                                padding: '8px 10px',
                                border: isHighlighted ? '1px solid var(--primary)' : '1px solid var(--border)',
                                boxShadow: isHighlighted ? '0 0 12px rgba(201, 151, 58, 0.25)' : 'none',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                                transition: 'all 0.3s ease',
                              }}
                              onMouseEnter={() => setHoveredFeedbackId(comment.id)}
                              onMouseLeave={() => setHoveredFeedbackId(null)}
                            >
                              {/* Header row */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                  <div style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    background: authorAvatar ? 'transparent' : 'var(--primary)',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 9,
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}>
                                    {authorAvatar ? (
                                      <img src={authorAvatar} alt={authorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : initials(authorName)}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {authorName}
                                    </span>
                                    <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>
                                      • {fmtDateTime(comment.createdAt)}
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Actions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                  {/* Notifications button */}
                                  {interviewNotifications[iv.id]?.some((log) => {
                                    try {
                                      const payload = JSON.parse(log.recipientEmail || '{}');
                                      return payload.feedbackId === comment.id;
                                    } catch {
                                      return false;
                                    }
                                  }) && (
                                    <button
                                      onClick={() => {
                                        setNotificationModalFeedbackId(comment.id);
                                        setNotificationModalLogs(
                                          interviewNotifications[iv.id]?.filter(log => {
                                            try {
                                              const payload = JSON.parse(log.recipientEmail || '{}');
                                              return payload.feedbackId === comment.id;
                                            } catch {
                                              return false;
                                            }
                                          }) || []
                                        );
                                      }}
                                      style={{
                                        background: hoveredFeedbackId === comment.id ? 'rgba(2, 132, 199, 0.08)' : 'transparent',
                                        border: 'none',
                                        borderRadius: 6,
                                        width: 24,
                                        height: 24,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        opacity: hoveredFeedbackId === comment.id ? 1 : 0,
                                        transition: 'opacity 0.15s ease, background 0.15s ease',
                                      }}
                                      title={t('ats.feedbackNotifications', 'View Notifications')}
                                    >
                                      <Bell size={12} color="var(--primary)" />
                                    </button>
                                  )}

                                  {/* Message / Chat button */}
                                  <button
                                    onClick={() => {
                                      const subjectVal = `Feedback: ${candidate.fullName}`;
                                      navigate(`/hr-chat?recipientId=${comment.authorId}&recipientName=${encodeURIComponent(authorName)}&subject=${encodeURIComponent(subjectVal)}`);
                                      onClose();
                                    }}
                                    style={{
                                      background: hoveredFeedbackId === comment.id ? 'rgba(201, 151, 58, 0.08)' : 'transparent',
                                      border: 'none',
                                      borderRadius: 6,
                                      width: 24,
                                      height: 24,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      opacity: hoveredFeedbackId === comment.id ? 1 : 0,
                                      transition: 'opacity 0.15s ease, background 0.15s ease',
                                    }}
                                    title={t('ats.messageAuthor', 'Message Author')}
                                  >
                                    <MessageSquare size={12} color="var(--accent)" />
                                  </button>

                                  {/* Delete button */}
                                  {canDelete && (
                                    <button
                                      onClick={() => handleDeleteInterviewFeedback(iv.id, comment.id, comment.authorId)}
                                      disabled={deletingFeedbackId === comment.id}
                                      style={{
                                        background: hoveredFeedbackId === comment.id ? 'rgba(220,38,38,0.08)' : 'transparent',
                                        border: 'none',
                                        borderRadius: 6,
                                        width: 24,
                                        height: 24,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: deletingFeedbackId === comment.id ? 'not-allowed' : 'pointer',
                                        opacity: hoveredFeedbackId === comment.id ? 1 : 0,
                                        transition: 'opacity 0.15s ease, background 0.15s ease',
                                      }}
                                      title={t('common.delete', 'Delete')}
                                    >
                                      <Trash2 size={12} color="#991b1b" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Body row indented */}
                              <div style={{ paddingLeft: 30, fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                {comment.body}
                              </div>
                            </div>
                          );
                        })}
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
                          onClick={() => handleAddInterviewFeedback(iv.id)}
                          loading={savingFeedbackId === iv.id}
                        >
                          {t('common.save')}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
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
                onClick={() => setShowRejectionModal(true)}
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

      {showRejectionModal && (
        <ModalBackdrop onClose={() => setShowRejectionModal(false)} width={420}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
          }}>
            <h3 style={{
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 16,
              color: 'var(--text)',
            }}>
              {t('ats.rejectCandidate', 'Reject Candidate')}
            </h3>
            <p style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginBottom: 16,
            }}>
              {t('ats.rejectionReasonPrompt', 'Please provide a reason for rejecting this candidate:')}
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t('ats.rejectionReasonPlaceholder', 'e.g., Not enough experience, Skills mismatch, etc.')}
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                fontSize: 13,
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'vertical',
                marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowRejectionModal(false);
                  setRejectionReason('');
                }}
                disabled={savingRejection}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={handleRejectWithReason}
                loading={savingRejection}
                disabled={!rejectionReason.trim()}
              >
                {t('ats.confirmReject', 'Confirm Rejection')}
              </Button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {previewDoc && (
        <DocumentPreviewModal
          url={previewDoc.url}
          filename={previewDoc.filename}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {notificationModalFeedbackId !== null && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(13,33,55,0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => { setNotificationModalFeedbackId(null); setNotificationModalLogs([]); }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 400,
              padding: 24,
              boxShadow: '0 24px 72px rgba(0,0,0,0.22)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('ats.notificationsSent', 'Notifications Sent')}
            </h3>
            {notificationModalLogs.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.noData', 'No data')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '60vh', overflowY: 'auto' }}>
                {notificationModalLogs.map((log) => {
                  let name = '';
                  let role = log.recipientType;
                  let company = '';
                  let storeName = '';
                  let avatarUrl: string | null = null;
                  try {
                    const data = JSON.parse(log.recipientEmail || '{}');
                    name = data.name || '';
                    role = data.role || role;
                    company = data.companyName || '';
                    storeName = data.storeName || '';
                    avatarUrl = data.avatarFilename ? getAvatarUrl(data.avatarFilename) : null;
                  } catch {}
                  return (
                    <div key={log.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--background)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          background: avatarUrl ? 'transparent' : 'var(--primary)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}>
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || 'Unknown'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {company}
                            {storeName && <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>{storeName}</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, marginLeft: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          {new Date(log.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => { setNotificationModalFeedbackId(null); setNotificationModalLogs([]); }}>
                {t('common.close', 'Close')}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

// ─── Jobs Panel ────────────────────────────────────────────────────────────────

const stripHtml = (html: string) => {
  if (!html) return '';
  let text = html.replace(/<!--[\s\S]*?-->/g, ''); // strip HTML comments
  text = text.replace(/<[^>]*>/g, ''); // strip HTML tags
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
  return text.trim();
};

const JobsPanel: React.FC<{ canEdit: boolean; companyId?: number }> = ({ canEdit, companyId }) => {
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
  const [showLinksModal, setShowLinksModal] = useState(false);
  const [copiedGeneral, setCopiedGeneral] = useState(false);
  const [copiedCompany, setCopiedCompany] = useState(false);
  const [complianceRefId, setComplianceRefId] = useState<string | null>(null);
  const [expandedJobIds, setExpandedJobIds] = useState<Set<number>>(new Set());

  const toggleDescription = useCallback((jobId: number) => {
    setExpandedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }, []);

  const fallbackCopy = useCallback((text: string, onSuccess: () => void) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        onSuccess();
      } else {
        showToast(t('common.copyError', 'Failed to copy link'), 'error');
      }
    } catch {
      showToast(t('common.copyError', 'Failed to copy link'), 'error');
    }
  }, [showToast, t]);

  const copyToClipboard = useCallback((text: string, onSuccess: () => void) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(onSuccess)
          .catch(() => fallbackCopy(text, onSuccess));
      } else {
        fallbackCopy(text, onSuccess);
      }
    } catch {
      fallbackCopy(text, onSuccess);
    }
  }, [fallbackCopy]);

  const defaultCompanyId = useMemo(() => {
    if (companyId) return companyId;
    if (targetCompanyId) return targetCompanyId;
    if (user?.companyId) return user.companyId;
    return companies[0]?.id ?? null;
  }, [companyId, targetCompanyId, user?.companyId, companies]);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: string; companyId?: number } = {};
      if (filterStatus) params.status = filterStatus;
      
      if (companyId) {
        params.companyId = companyId;
      } else if (!user?.isSuperAdmin && defaultCompanyId) {
        params.companyId = defaultCompanyId;
      }

      setJobs(await getJobs(Object.keys(params).length > 0 ? params : undefined));
    } catch {
      showToast(t('ats.errorLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, user?.isSuperAdmin, companyId, defaultCompanyId, showToast, t]);

  useEffect(() => { fetch(); }, [fetch]);

  // Socket listeners for real-time job updates
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;

    const handleJobCreated = (job: JobPosting) => {
      setJobs((prev) => {
        if (prev.some((j) => j.id === job.id)) return prev;
        return [job, ...prev];
      });
    };

    const handleJobUpdated = (job: JobPosting) => {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
    };

    const handleJobDeleted = (jobId: number) => {
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    };

    socket.on('ATS_JOB_CREATED', handleJobCreated);
    socket.on('ATS_JOB_UPDATED', handleJobUpdated);
    socket.on('ATS_JOB_DELETED', handleJobDeleted);

    return () => {
      socket.off('ATS_JOB_CREATED', handleJobCreated);
      socket.off('ATS_JOB_UPDATED', handleJobUpdated);
      socket.off('ATS_JOB_DELETED', handleJobDeleted);
    };
  }, [socket]);

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

  const groupedJobs = useMemo(() => {
    const groups: { [key: number]: JobPosting[] } = {};
    jobs.forEach((job) => {
      if (!groups[job.companyId]) {
        groups[job.companyId] = [];
      }
      groups[job.companyId].push(job);
    });

    const result = Object.keys(groups).map((companyIdStr) => {
      const id = Number(companyIdStr);
      const comp = companyMap.get(id);
      const name = comp?.name || `Company #${id}`;

      // Sort: Published -> Draft -> Closed
      const sortedJobs = [...groups[id]].sort((a, b) => {
        const statusOrder = { published: 1, draft: 2, closed: 3 };
        const orderA = statusOrder[a.status as keyof typeof statusOrder] || 99;
        const orderB = statusOrder[b.status as keyof typeof statusOrder] || 99;
        if (orderA !== orderB) return orderA - orderB;

        const dateA = new Date(a.publishedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.publishedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      return {
        companyId: id,
        companyName: name,
        company: comp,
        jobs: sortedJobs,
      };
    });

    result.sort((a, b) => a.companyName.localeCompare(b.companyName));
    return result;
  }, [jobs, companyMap]);

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
                onClick={() => setShowLinksModal(true)}
                fullWidth={isMobile}
              >
                {t('ats.openCareersPage', 'Open careers page')}
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
        <div style={{ display: 'grid', gap: 28 }}>
          {groupedJobs.map((group) => (
            <div key={group.companyId} style={{ display: 'grid', gap: 12 }}>
              {/* Group Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '4px 8px',
                borderBottom: '1px solid var(--border)',
                paddingBottom: 8
              }}>
                <Building2 size={16} color="var(--text-secondary)" />
                <h4 style={{
                  margin: 0,
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)'
                }}>
                  {group.companyName}
                </h4>
                <span style={{
                  background: 'rgba(13,33,55,0.03)',
                  color: 'var(--text-muted)',
                  borderRadius: 99,
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '1px 6px',
                  border: '1px solid var(--border)'
                }}>
                  {group.jobs.length} {group.jobs.length === 1 ? t('ats.position', 'position') : t('ats.positions', 'positions')}
                </span>
              </div>

              {/* Group Jobs */}
              <div style={{ display: 'grid', gap: 10 }}>
                {group.jobs.map((job) => {
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
                      {/* Header Row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{job.title}</span>
                          {job.referenceId && <ReferenceIdBadge referenceId={job.referenceId} />}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {/* Copy Reference ID button on hover */}
                          {isHovered && job.referenceId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(job.referenceId || '', () => {
                                  showToast('Reference ID copied to clipboard', 'success');
                                });
                              }}
                              style={{
                                background: 'rgba(13,33,55,0.05)',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px 6px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 600,
                                gap: 4,
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(13,33,55,0.1)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(13,33,55,0.05)')}
                              title="Copy Reference ID"
                            >
                              <Clipboard size={12} />
                              <span style={{ fontSize: 10.5 }}>Copy ID</span>
                            </button>
                          )}
                          <span style={{
                            background: `${sc}08`,
                            color: sc,
                            border: `1px solid ${sc}33`,
                            borderRadius: 99,
                            padding: '2px 10px',
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}>
                            {t(`ats.status_${job.status}`)}
                          </span>
                        </div>
                      </div>

                      {/* Description Row with Show More */}
                      {job.description && (() => {
                        const text = stripHtml(job.description);
                        const isLong = text.length > 240;
                        const isExpanded = expandedJobIds.has(job.id);
                        const displayText = isLong && !isExpanded ? `${text.slice(0, 240)}...` : text;
                        return (
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            <span>{displayText}</span>
                            {isLong && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleDescription(job.id);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--primary)',
                                  cursor: 'pointer',
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  padding: '0 4px',
                                  textDecoration: 'underline',
                                }}
                              >
                                {isExpanded ? t('common.showLess', 'Show less') : t('common.showMore', 'Show more')}
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* Inline Job Metadata Row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {/* Store */}
                        {store && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <StoreIcon size={14} color="var(--text-muted)" />
                            <strong>{store.name}</strong>
                          </span>
                        )}
                        {/* Location */}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={14} color="var(--text-muted)" />
                          {locationSummary}
                        </span>
                        {/* Remote type / Work arrangement */}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Globe2 size={14} color="var(--text-muted)" />
                          {job.remoteType === 'remote' ? t('ats.remoteType_remote', 'Remote') : t(`ats.remoteType_${job.remoteType}`, job.remoteType)}
                        </span>
                        {/* Salary */}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Wallet size={14} color="var(--text-muted)" />
                          {salarySummary} {job.weeklyHours ? `(${job.weeklyHours}h)` : ''}
                        </span>
                        {/* Job Type */}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <BriefcaseBusiness size={14} color="var(--text-muted)" />
                          {t(`ats.jobType_${JOB_TYPE_LABEL[job.jobType]}`)}
                        </span>
                        {/* Department */}
                        {job.department && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Building2 size={14} color="var(--text-muted)" />
                            {job.department}
                          </span>
                        )}
                      </div>

                      {/* Footer Row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid rgba(13,33,55,0.05)', paddingTop: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          {/* Language flag */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {languageFlags.map((code) => (
                              <ReactCountryFlag
                                key={`${job.id}-${code}`}
                                countryCode={code}
                                svg
                                style={{ width: '1.3em', height: '1.3em', verticalAlign: 'middle' }}
                                title={job.language.toUpperCase()}
                              />
                            ))}
                          </div>

                          {/* Tags */}
                          {job.tags && job.tags.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                              <span>Tags:</span>
                              {job.tags.map((tag) => (
                                <span key={`${job.id}-${tag}`} style={{
                                  background: 'rgba(201,151,58,0.06)', 
                                  color: 'var(--accent)',
                                  border: '1px solid rgba(201,151,58,0.15)',
                                  borderRadius: 6, 
                                  padding: '1px 6px', 
                                  fontSize: 11, 
                                  fontWeight: 500,
                                }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
                          {/* Date */}
                          {job.publishedAt && (() => {
                            const dateObj = new Date(job.publishedAt);
                            const dateStr = dateObj.toLocaleDateString(locale === 'it-IT' ? 'it-IT' : 'en-GB');
                            const hourStr = String(dateObj.getHours()).padStart(2, '0');
                            const minStr = String(dateObj.getMinutes()).padStart(2, '0');
                            return (
                              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                                {t('ats.publishedLabel', 'Published')}: {dateStr} {hourStr}:{minStr}
                              </span>
                            );
                          })()}

                          {/* Actions */}
                          {canEdit && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {job.status === 'draft' && (
                                <Button variant="accent" size="sm" onClick={() => handlePublish(job)} style={{ marginRight: 4 }}>
                                  {t('ats.publishPosition', 'Publish position')}
                                </Button>
                              )}
                              <button
                                onClick={() => setComplianceRefId(job.referenceId || String(job.id))}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '6px',
                                  borderRadius: '50%',
                                  color: 'var(--text-muted)',
                                  transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(2,132,199,0.08)';
                                  e.currentTarget.style.color = 'var(--primary)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'none';
                                  e.currentTarget.style.color = 'var(--text-muted)';
                                }}
                                title="Indeed Compliance Check"
                              >
                                <BadgeCheck size={16} />
                              </button>
                              <button
                                onClick={() => { setEditJob(job); setShowModal(true); }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '6px',
                                  borderRadius: '50%',
                                  color: 'var(--text-muted)',
                                  transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(13,33,55,0.05)';
                                  e.currentTarget.style.color = 'var(--text-primary)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'none';
                                  e.currentTarget.style.color = 'var(--text-muted)';
                                }}
                                title={t('common.edit')}
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(job)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '6px',
                                  borderRadius: '50%',
                                  color: 'var(--text-muted)',
                                  transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
                                  e.currentTarget.style.color = 'var(--danger)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'none';
                                  e.currentTarget.style.color = 'var(--text-muted)';
                                }}
                                title={t('common.delete')}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
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

      {showLinksModal && (
        <ModalBackdrop onClose={() => setShowLinksModal(false)} width={680}>
          {/* Modal Header */}
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontSize: 17, fontWeight: 700 }}>
                {t('ats.careersPageLinksTitle', 'Careers Page Links')}
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                {t('ats.careersPageLinksSubtitle', 'Share these links with candidates or embed them on your website')}
              </p>
            </div>
            <button
              onClick={() => setShowLinksModal(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 22, lineHeight: 1 }}
            >
              ×
            </button>
          </div>

          {/* Modal Body */}
          <div style={{ padding: '20px 22px', display: 'grid', gap: 16 }}>
            {/* Two Cards Row */}
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: 16
            }}>
              {/* Card 1: General Portal */}
              <div style={{
                flex: 1,
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 16,
                background: 'var(--surface)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 12
              }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'rgba(2,132,199,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)'
                    }}>
                      <Globe2 size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {t('ats.generalCareersPortal', 'General Careers Portal')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {t('ats.allCompanies', 'All Companies')}
                      </div>
                    </div>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {t('ats.generalPortalDesc', 'Displays all active job openings across every company on this platform.')}
                  </p>
                </div>

                <div style={{ display: 'grid', gap: 8, marginTop: 'auto' }}>
                  <input
                    type="text"
                    readOnly
                    value={`${(import.meta.env.VITE_FRONTEND_URL || window.location.origin).replace(/\/+$/, '')}/careers`}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: 'var(--background)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '8px 10px',
                      fontSize: 11.5,
                      fontFamily: 'monospace',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      style={{ flex: 1, height: 32 }}
                      onClick={() => {
                        const url = `${(import.meta.env.VITE_FRONTEND_URL || window.location.origin).replace(/\/+$/, '')}/careers`;
                        copyToClipboard(url, () => {
                          setCopiedGeneral(true);
                          setTimeout(() => setCopiedGeneral(false), 2000);
                        });
                      }}
                    >
                      {copiedGeneral ? '✓ ' + t('common.copied', 'Copied') : t('common.copyLink', 'Copy Link')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      style={{ flexShrink: 0, height: 32 }}
                      onClick={() => window.open(`${(import.meta.env.VITE_FRONTEND_URL || window.location.origin).replace(/\/+$/, '')}/careers`, '_blank')}
                    >
                      {t('common.open', 'Open →')}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Card 2: Company Page */}
              <div style={{
                flex: 1,
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 16,
                background: 'var(--surface)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 12
              }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'rgba(201,151,58,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent)'
                    }}>
                      <Building2 size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                        {companies.find(c => c.id === (companyId || defaultCompanyId))?.name ?? t('common.company', 'Company')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {t('ats.companySpecific', 'Company-Specific')}
                      </div>
                    </div>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {t('ats.companyPortalDesc', 'Displays only the job openings for this specific company. Use this link on your website.')}
                  </p>
                </div>

                <div style={{ display: 'grid', gap: 8, marginTop: 'auto' }}>
                  <input
                    type="text"
                    readOnly
                    value={`${(import.meta.env.VITE_FRONTEND_URL || window.location.origin).replace(/\/+$/, '')}/careers/${companies.find(c => c.id === (companyId || defaultCompanyId))?.slug || ''}`}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: 'var(--background)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '8px 10px',
                      fontSize: 11.5,
                      fontFamily: 'monospace',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      style={{ flex: 1, height: 32 }}
                      onClick={() => {
                        const slug = companies.find(c => c.id === (companyId || defaultCompanyId))?.slug || '';
                        const url = `${(import.meta.env.VITE_FRONTEND_URL || window.location.origin).replace(/\/+$/, '')}/careers/${slug}`;
                        copyToClipboard(url, () => {
                          setCopiedCompany(true);
                          setTimeout(() => setCopiedCompany(false), 2000);
                        });
                      }}
                    >
                      {copiedCompany ? '✓ ' + t('common.copied', 'Copied') : t('common.copyLink', 'Copy Link')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      style={{ flexShrink: 0, height: 32 }}
                      onClick={() => {
                        const slug = companies.find(c => c.id === (companyId || defaultCompanyId))?.slug || '';
                        window.open(`${(import.meta.env.VITE_FRONTEND_URL || window.location.origin).replace(/\/+$/, '')}/careers/${slug}`, '_blank');
                      }}
                    >
                      {t('common.open', 'Open →')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Banner */}
            <div style={{
              background: 'rgba(2,132,199,0.06)',
              border: '1px solid rgba(2,132,199,0.15)',
              borderRadius: 10,
              padding: '12px 14px',
              display: 'flex',
              gap: 10,
              alignItems: 'start'
            }}>
              <div style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }}>
                <Globe2 size={16} />
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#0369A1', lineHeight: 1.5 }}>
                {t('ats.linksBannerText', 'These links are always live and show your latest published positions. Share the company link on your website, in email signatures, or on LinkedIn.')}
              </p>
            </div>
          </div>

          {/* Modal Footer */}
          <div style={{ padding: '14px 22px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setShowLinksModal(false)}>
              {t('common.close', 'Close')}
            </Button>
          </div>
        </ModalBackdrop>
      )}

      {complianceRefId !== null && (
        <IndeedComplianceModal
          referenceId={complianceRefId}
          onClose={() => setComplianceRefId(null)}
        />
      )}
    </div>
  );
};

// ─── Indeed Panel ──────────────────────────────────────────────────────────────

const IndeedPanel: React.FC<{ canEdit: boolean; companyId?: number }> = ({ canEdit, companyId }) => {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { user, targetCompanyId } = useAuth();
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedCopied, setFeedCopied] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);

  const defaultCompanyId = useMemo(() => {
    if (companyId) return companyId;
    if (targetCompanyId) return targetCompanyId;
    if (user?.companyId) return user.companyId;
    return companies[0]?.id ?? null;
  }, [companyId, targetCompanyId, user?.companyId, companies]);

  const feedCompanyId = useMemo(() => {
    if (companyId) return companyId;
    if (targetCompanyId) return targetCompanyId;
    if (user?.companyId) return user.companyId;
    return companies.length === 1 ? companies[0].id : null;
  }, [companyId, targetCompanyId, user?.companyId, companies]);

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

  const handleOpenFeed = () => {
    if (!feedUrl) return;
    window.open(feedUrl, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    
    const params: { companyId?: number } = {};
    if (companyId) {
      params.companyId = companyId;
    } else if (!user?.isSuperAdmin && defaultCompanyId) {
      params.companyId = defaultCompanyId;
    }

    Promise.all([
      getJobs(Object.keys(params).length > 0 ? params : undefined).catch(() => [] as JobPosting[]),
      getCompanies().catch(() => [] as Company[]),
    ]).then(([jobsData, companiesData]) => {
      if (!mounted) return;
      setJobs(jobsData);
      setCompanies(companiesData);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [companyId, defaultCompanyId, user?.isSuperAdmin]);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Section 1: XML Feed Card */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '24px 28px',
        display: 'grid',
        gap: 16,
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            XML Feed
          </h3>
          <span style={{
            background: 'rgba(16,185,129,0.12)',
            color: '#10B981',
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            border: '1px solid rgba(16,185,129,0.22)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            Feed URL
          </span>
        </div>
        
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Your XML feed contains all published positions. This URL is used to sync your job listings directly with Indeed.
        </p>

        {feedUrl ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              readOnly
              value={feedUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              style={{
                flex: 1,
                minWidth: 200,
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '9px 12px',
                fontSize: 12.5,
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" size="sm" onClick={handleCopyFeed} style={{ whiteSpace: 'nowrap' }}>
                {feedCopied ? '✓ ' + t('common.copied', 'Copied') : t('common.copy', 'Copy URL')}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleOpenFeed} style={{ whiteSpace: 'nowrap' }}>
                Open Feed
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Select a company to view the XML feed URL.
          </div>
        )}

        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Indeed crawls this URL every 6 hours.
        </p>
      </div>

      {/* Section 2: Compliance Check Card */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '24px 28px',
        display: 'grid',
        gap: 16,
        boxShadow: 'var(--shadow-sm)'
      }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
          Position Compliance Check
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Verify that a position meets all Indeed XML feed requirements before submission.
        </p>
        <div>
          <Button variant="primary" size="sm" onClick={() => setShowComplianceModal(true)}>
            {t('ats.complianceCheck', 'Run Compliance Check')}
          </Button>
        </div>
      </div>

      {/* Section 3: Placeholder card (muted style) */}
      <div style={{
        background: 'rgba(248,250,252,0.5)',
        border: '1px dashed var(--border)',
        borderRadius: 16,
        padding: '24px 28px',
        display: 'grid',
        gap: 8,
        boxShadow: 'none'
      }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-muted)' }}>
          More Indeed Tools
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Additional Indeed integration tools — coming soon.
        </p>
      </div>

      {showComplianceModal && (
        <ModalBackdrop onClose={() => setShowComplianceModal(false)} width={980}>
            {(() => {
              const publishedJobs = jobs.filter((j) => j.status === 'published');
              const publishedCount = publishedJobs.length;
              return (
                <>
                  <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{t('ats.complianceCheckTitle')}</h3>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                        {publishedCount} {t('ats.complianceJobsCount', 'published job postings')} - each row shows compliance percentage and detailed checks.
                      </p>
                    </div>
                    <button onClick={() => setShowComplianceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 22, lineHeight: 1 }}>×</button>
                  </div>

                  <div style={{ padding: '16px 22px', display: 'grid', gap: 10 }}>
                    {publishedCount === 0 ? (
                      <div style={{
                        borderRadius: 10,
                        padding: '16px 20px',
                        border: '1px solid rgba(2,132,199,0.18)',
                        background: 'rgba(2,132,199,0.04)',
                        color: '#0369A1',
                        fontSize: 13,
                        lineHeight: 1.5
                      }}>
                        {i18n.language?.startsWith('it') ? (
                          <div>
                            <strong>Nessun annuncio pubblicato trovato.</strong>
                            <p style={{ margin: '4px 0 0' }}>La verifica di conformità si applica solo agli annunci pubblicati. Assicurati di pubblicare un annuncio o di selezionare un'altra azienda dal menu a discesa in alto a destra.</p>
                          </div>
                        ) : (
                          <div>
                            <strong>No published jobs found.</strong>
                            <p style={{ margin: '4px 0 0' }}>The compliance check only runs on published job postings. Make sure you publish a position or select a different company from the dropdown in the top-right corner.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      publishedJobs.map((job) => {
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
                      })
                    )}

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
                      {i18n.language?.startsWith('it') ? (
                        <div>
                          Nota: Indeed ha deprecato il crawling XML gratuito da marzo 2026. Questa verifica controlla completezza e conformita del feed.
                        </div>
                      ) : (
                        <div>
                          Note: Indeed deprecated free XML crawling in March 2026. This checker validates feed readiness and field quality.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
        </ModalBackdrop>
      )}
    </div>
  );
};

// ─── Kanban Panel ─────────────────────────────────────────────────────────────

const KanbanPanel: React.FC<{ 
  canEdit: boolean; 
  canFeedback: boolean; 
  canTag: boolean; 
  companyId?: number;
  preSelectedCandidateId?: number | null;
  companies?: Company[];
}> = ({ canEdit, canFeedback, canTag, companyId, preSelectedCandidateId, companies = [] }) => {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { isMobile } = useBreakpoint();
  const { user, targetCompanyId, allowedCompanyIds } = useAuth();
  const { socket } = useSocket();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterJob, setFilterJob] = useState<string>('');

  const [searchParams, setSearchParams] = useSearchParams();

  const openCandidateModal = (c: Candidate) => {
    setSelected(c);
    setSearchParams((prev) => {
      prev.set('candidateId', String(c.id));
      return prev;
    }, { replace: true });
  };

  const closeCandidateModal = () => {
    setSelected(null);
    setSearchParams((prev) => {
      prev.delete('candidateId');
      prev.delete('interviewId');
      prev.delete('feedbackId');
      return prev;
    }, { replace: true });
  };
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [addJobId, setAddJobId] = useState<string>('');
  const [addFirstName, setAddFirstName] = useState('');
  const [addLastName, setAddLastName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addLinkedinUrl, setAddLinkedinUrl] = useState('');
  const [addCompanyEmail, setAddCompanyEmail] = useState('');
  const [addAvailableStartDate, setAddAvailableStartDate] = useState('');
  const [addPostalCode, setAddPostalCode] = useState('');
  const [addAddress, setAddAddress] = useState('');
  const [addProfile, setAddProfile] = useState<CandidateApplicationProfile>(() => buildCandidateProfile({
    availability: '',
    gender: '',
    nationality: '',
    country: '',
    state: '',
    city: '',
    address: '',
    postalCode: '',
    dateOfBirth: '',
    currentEmployer: '',
    currentRole: '',
    hasCurrentEmployer: '',
    maritalStatus: '',
    uniqueId: generateEmployeeUniqueId(),
    password: generateTempPassword(),
    hireDate: new Date().toISOString().slice(0, 10),
    contractType: '',
    applicationDate: new Date().toISOString().slice(0, 10),
    availableStartDate: '',
    applicationSource: 'ats',
    applicationChannel: 'internal',
    startDate: '',
  }));
  const [addCvFile, setAddCvFile] = useState<File | null>(null);
  const [addCoverLetter, setAddCoverLetter] = useState('');
  const [addGdprConsent, setAddGdprConsent] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addModalJobs, setAddModalJobs] = useState<JobPosting[]>([]);
  const [addModalJobsLoading, setAddModalJobsLoading] = useState(false);
  const [showCvPreview, setShowCvPreview] = useState(false);
  const [cvPreviewUrl, setCvPreviewUrl] = useState<string | null>(null);
  const [interviewInviteEnabled, setInterviewInviteEnabled] = useState<boolean | null>(null);
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null);

  // Employee creation on hire
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeeData, setEmployeeData] = useState<HiringEmployeeDraft | null>(null);
  const [creatingEmployee, setCreatingEmployee] = useState(false);

  const hasMultiCompanyScope = (allowedCompanyIds?.length ?? 0) > 1;
  const effectiveCompanyId = companyId ?? (hasMultiCompanyScope
    ? undefined
    : (targetCompanyId ?? (user?.isSuperAdmin ? undefined : user?.companyId ?? undefined)));
  const scopedCompanyId = user?.isSuperAdmin ? companyId : effectiveCompanyId;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [cands, js, emps] = await Promise.all([
        getCandidates(filterJob ? { jobId: parseInt(filterJob, 10), companyId: effectiveCompanyId } : { companyId: effectiveCompanyId }),
        getJobs(scopedCompanyId ? { companyId: scopedCompanyId } : undefined),
        effectiveCompanyId ? getEmployees({ targetCompanyId: effectiveCompanyId, status: 'active', includeStoreTerminals: false, limit: 500 }) : (companyId ? getEmployees({ targetCompanyId: companyId, status: 'active', includeStoreTerminals: false, limit: 500 }) : Promise.resolve({ employees: [] })),
      ]);
      setCandidates(cands); setJobs(js); setEmployees(emps.employees || []);

      // Load notification settings and SMTP config
      if (effectiveCompanyId) {
        const [notifResult, emailResult] = await Promise.allSettled([
          getNotificationSettings(effectiveCompanyId),
          getEmailConfig(effectiveCompanyId),
        ]);

        if (notifResult.status === 'fulfilled') {
          const interviewInviteSetting = notifResult.value.find((s: NotificationSetting) => s.eventKey === 'ats.interview_invite');
          // Missing row means default-enabled behavior in backend.
          setInterviewInviteEnabled(interviewInviteSetting?.enabled ?? true);
        } else {
          setInterviewInviteEnabled(null);
        }

        if (emailResult.status === 'fulfilled') {
          setSmtpConfigured(Boolean(emailResult.value?.config?.smtpHost));
        } else {
          setSmtpConfigured(null);
        }
      } else {
        setInterviewInviteEnabled(null);
        setSmtpConfigured(null);
      }
    } catch { showToast(t('ats.errorLoad'), 'error'); }
    finally { setLoading(false); }
  }, [filterJob, effectiveCompanyId, scopedCompanyId, showToast, t]);

  useEffect(() => { fetch(); }, [fetch]);

  // Handle deep linking for candidate selection
  useEffect(() => {
    if (preSelectedCandidateId) {
      if (!selected || selected.id !== preSelectedCandidateId) {
        const match = candidates.find(c => c.id === preSelectedCandidateId);
        if (match) {
          setSelected(match);
        } else {
          let active = true;
          getCandidate(preSelectedCandidateId)
            .then((c: Candidate) => {
              if (active && c) {
                setSelected(c);
              }
            })
            .catch((err: any) => {
              console.error('Failed to fetch deep-linked candidate:', err);
            });
          return () => {
            active = false;
          };
        }
      }
    } else {
      if (selected) {
        setSelected(null);
      }
    }
  }, [preSelectedCandidateId, candidates, selected]);

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

  const buildHiringDraft = (candidate: Candidate): HiringEmployeeDraft => {
    const job = candidate.jobPostingId ? jobs.find((item) => item.id === candidate.jobPostingId) : null;
    const profile = parseCandidateProfile(candidate.sourceRef);
    const nameParts = candidate.fullName.trim().split(/\s+/);
    const hireDate = profile.hireDate || candidate.appliedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10);
    const workingType = job?.jobType === 'parttime' ? 'part_time' : 'full_time';
    const contractType = profile.contractType || job?.contractType || '';

    return {
      name: nameParts[0] || '',
      surname: nameParts.slice(1).join(' ') || '',
      personalEmail: candidate.email || '',
      phone: candidate.phone || '',
      role: job?.targetRole || 'employee',
      companyId: candidate.companyId,
      storeId: candidate.storeId,
      companyName: job?.companyName || '',
      companyGroupName: job?.companyGroupName || '',
      companyLogoFilename: job?.companyLogoFilename ?? null,
      storeName: job?.storeName || '',
      storeLogoFilename: job?.storeLogoFilename ?? null,
      storeEmployeeCount: job?.storeEmployeeCount ?? null,
      jobTitle: job?.title || '',
      uniqueId: profile.uniqueId || generateEmployeeUniqueId(),
      password: profile.password || generateTempPassword(),
      hireDate,
      contractType,
      maritalStatus: profile.maritalStatus || '',
      workingType,
      weeklyHours: job?.weeklyHours != null ? String(job.weeklyHours) : '',
      dateOfBirth: profile.dateOfBirth,
      nationality: profile.nationality,
      gender: profile.gender,
      country: profile.country,
      state: profile.state,
      city: profile.city,
      currentEmployer: profile.currentEmployer,
      currentRole: profile.currentRole,
      availability: profile.availability,
      applicationDate: profile.applicationDate || candidate.appliedAt?.slice(0, 10) || '',
      applicationSource: profile.applicationSource || candidate.source,
      applicationChannel: profile.applicationChannel || candidate.source,
    };
  };

  const handleAdvance = async (status: CandidateStatus) => {
    if (!canEdit) return;
    if (!selected) return;

    // If moving to hired, prepare employee creation
    if (status === 'hired') {
      // Prepare employee data
      setEmployeeData(buildHiringDraft(selected));
      setEmployeeEmail('');
      setShowEmployeeModal(true);
      return; // Don't update stage yet, wait for employee creation
    }

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

  const handleCreateEmployeeFromCandidate = async () => {
    if (!employeeEmail.trim()) {
      showToast(t('ats.companyEmailRequired', 'Company email is required'), 'error');
      return;
    }
    if (!employeeData || !selected) return;

    setCreatingEmployee(true);
    try {
      // Create employee
      await createEmployee({
        name: employeeData.name,
        surname: employeeData.surname,
        email: employeeEmail.trim(),
        uniqueId: employeeData.uniqueId || undefined,
        password: employeeData.password || undefined,
        hireDate: employeeData.hireDate || undefined,
        contractType: employeeData.contractType || undefined,
        maritalStatus: employeeData.maritalStatus || undefined,
        workingType: (employeeData.workingType === 'full_time' || employeeData.workingType === 'part_time') ? employeeData.workingType : undefined,
        personalEmail: employeeData.personalEmail,
        phone: employeeData.phone || undefined,
        role: employeeData.role as 'admin' | 'hr' | 'area_manager' | 'store_manager' | 'employee' | 'store_terminal',
        companyId: employeeData.companyId,
        storeId: employeeData.storeId || undefined,
        weeklyHours: employeeData.weeklyHours ? Number(employeeData.weeklyHours) : undefined,
        dateOfBirth: employeeData.dateOfBirth || undefined,
        nationality: employeeData.nationality || undefined,
        gender: employeeData.gender || undefined,
        country: employeeData.country || undefined,
        state: employeeData.state || undefined,
        city: employeeData.city || undefined,
        status: 'active',
      });

      // Update candidate to hired
      const updated = await updateCandidateStage(selected.id, 'hired');
      setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setSelected(updated);

      // Close modal and reset
      setShowEmployeeModal(false);
      setEmployeeData(null);
      setEmployeeEmail('');

      showToast(t('ats.employeeCreatedAndHired', 'Employee created and candidate marked as hired'), 'success');
    } catch (err) {
      showToast(translateApiError(err, t, t('ats.errorCreatingEmployee', 'Failed to create employee')) ?? t('ats.errorCreatingEmployee', 'Failed to create employee'), 'error');
    } finally {
      setCreatingEmployee(false);
    }
  };

  const handleReject = async (reason?: string) => {
    if (!canEdit) return;
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await updateCandidateStage(selected.id, 'rejected', reason);
      setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      closeCandidateModal();
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
      closeCandidateModal();
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

    if (!addGdprConsent) {
      showToast(t('publicCareers.privacyRequiredError', 'You must accept the privacy notice to submit your application.'), 'error');
      return;
    }

    const normalizedName = [addFirstName.trim(), addLastName.trim()]
      .filter(Boolean)
      .join(' ')
      || addEmail.trim()
      || t('ats.defaultCandidateName', 'Candidate');

    setAddSaving(true);
    try {
      const applicationDate = addProfile.applicationDate || new Date().toISOString().slice(0, 10);
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
        sourceRef: serializeCandidateProfile({
          ...addProfile,
          availability: addProfile.availability,
          applicationDate,
          availableStartDate: addAvailableStartDate.trim() || '',
          postalCode: addPostalCode.trim() || '',
          address: addAddress.trim() || '',
          applicationSource: 'ats',
          applicationChannel: 'internal',
        }),
        appliedAt: new Date().toISOString(),
      });
      setCandidates((prev) => {
        if (effectiveCompanyId && c.companyId !== effectiveCompanyId) {
          return prev;
        }
        // Check if candidate already exists to prevent duplicates
        const exists = prev.some(existing => existing.id === c.id);
        if (exists) {
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
    phone_interview: t('ats.stage_phone_interview'),
    interview: t('ats.stage_interview'),
    hired: t('ats.stage_hired'),
    rejected: t('ats.stage_rejected'),
  };

  const STAGE_ICON: Record<CandidateStatus, string> = {
    received: '📥',
    review: '🔍',
    phone_interview: '📞',
    interview: '🤝',
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
    setAddCompanyEmail('');
    setAddAvailableStartDate('');
    setAddPostalCode('');
    setAddAddress('');
    setAddProfile(buildCandidateProfile({
      availability: '',
      gender: '',
      nationality: '',
      country: '',
      state: '',
      city: '',
      address: '',
      postalCode: '',
      dateOfBirth: '',
      currentEmployer: '',
      currentRole: '',
      hasCurrentEmployer: '',
      maritalStatus: '',
      uniqueId: generateEmployeeUniqueId(),
      password: generateTempPassword(),
      hireDate: new Date().toISOString().slice(0, 10),
      contractType: '',
      applicationDate: new Date().toISOString().slice(0, 10),
      availableStartDate: '',
      applicationSource: 'ats',
      applicationChannel: 'internal',
      startDate: '',
    }));
    setAddCvFile(null);
    setAddCoverLetter('');
    setAddGdprConsent(false);
    setShowCvPreview(false);
    if (cvPreviewUrl) {
      URL.revokeObjectURL(cvPreviewUrl);
      setCvPreviewUrl(null);
    }
  }, [cvPreviewUrl]);

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
    const companyCountryCode = normalizeCountryCode(jobOption.companyCountry ?? '');
    const storeCountryCode = normalizeCountryCode(jobOption.jobCountry ?? jobOption.country ?? '');
    const toneColor = tone === 'published' ? '#166534' : tone === 'draft' ? '#92400E' : '#991B1B';
    const chipBackground = tone === 'published' ? 'rgba(22,163,74,0.08)' : tone === 'draft' ? 'rgba(245,158,11,0.10)' : 'rgba(239,68,68,0.08)';
    const chipBorder = tone === 'published' ? '1px solid rgba(22,163,74,0.22)' : tone === 'draft' ? '1px solid rgba(245,158,11,0.28)' : '1px solid rgba(239,68,68,0.24)';
    const salaryLabel = formatEuroRange(jobOption.salaryMin, jobOption.salaryMax, i18n.language || 'it-IT', t('common.notSet', 'Not set'));
    const postedAtSource = jobOption.publishedAt ?? jobOption.createdAt;

    return (
      <>
        <strong style={{ fontSize: 13.5, color: toneColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word', display: 'block' }}>
          {jobOption.title}
        </strong>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: toneColor, background: chipBackground, border: chipBorder, borderRadius: 999, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {companyLabel}
            {companyCountryCode && <ReactCountryFlag countryCode={companyCountryCode} svg style={{ width: '0.9em', height: '0.9em', marginLeft: 2 }} />}
          </span>
          {jobOption.companyGroupName && (
            <span style={{ fontSize: 11, color: '#64748B', background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 999, padding: '2px 7px' }}>
              {jobOption.companyGroupName}
            </span>
          )}
          {jobOption.storeName && (
            <span style={{ fontSize: 11, color: toneColor, background: chipBackground, border: chipBorder, borderRadius: 999, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {jobOption.storeName}
              {storeCountryCode && <ReactCountryFlag countryCode={storeCountryCode} svg style={{ width: '0.9em', height: '0.9em', marginLeft: 2 }} />}
            </span>
          )}
          {jobOption.storeName && jobOption.storeEmployeeCount !== null && jobOption.storeEmployeeCount !== undefined && (
            <span style={{ fontSize: 11, color: toneColor, background: chipBackground, border: chipBorder, borderRadius: 999, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Users size={11} /> {jobOption.storeEmployeeCount} {t('ats.employees', 'employees')}
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
        <div style={{ position: 'relative', width: isMobile ? '100%' : 260 }}>
          <CustomSelect
            value={filterJob}
            onChange={(val) => setFilterJob(val || '')}
            options={[
              { value: '', label: t('ats.allJobs') },
              ...jobs.map((j) => ({ value: String(j.id), label: j.title }))
            ]}
            placeholder={t('ats.allJobs')}
            searchable
            isClearable={false}
            highlightSelected={false}
          />
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
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
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
                  padding: '8px 12px 8px',
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
                        onClick={() => openCandidateModal(c)}
                        style={{
                          background: 'var(--surface)',
                          border: `1px solid ${c.unread ? sc : 'var(--border)'}`,
                          borderRadius: 10, padding: '10px 10px',
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
                              display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                              <span>{c.fullName}</span>
                              {(() => {
                                const profile = parseCandidateProfile(c.sourceRef);
                                if (!profile.country) return null;

                                // Try to get country code - either directly or from country name
                                let countryCode = profile.country.toUpperCase();
                                if (countryCode.length > 2) {
                                  // It's a country name, convert to code
                                  countryCode = COUNTRY_NAME_TO_CODE[profile.country] || '';
                                }

                                if (!countryCode || countryCode.length !== 2) return null;

                                return (
                                  <ReactCountryFlag
                                    countryCode={countryCode}
                                    svg
                                    style={{
                                      width: '14px',
                                      height: '14px',
                                      borderRadius: '4px',
                                    }}
                                    title={profile.country}
                                  />
                                );
                              })()}
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
                            📧 {c.email}
                          </div>
                        )}

                        {/* Tags - Only show user tags, not system tags */}
                        {(() => {
                          const { userTags } = splitCandidateTags(c.tags || []);
                          if (userTags.length === 0) return null;

                          return (
                            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {userTags.slice(0, 4).map((tag) => (
                                <span
                                  key={tag}
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 600,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    background: 'rgba(59,130,246,0.12)',
                                    color: '#2563EB',
                                    border: '1px solid rgba(59,130,246,0.25)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '100%',
                                  }}
                                  title={tag}
                                >
                                  {tag}
                                </span>
                              ))}
                              {userTags.length > 3 && (
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 600,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    background: 'rgba(59,130,246,0.08)',
                                    color: '#2563EB',
                                    border: '1px solid rgba(59,130,246,0.2)',
                                  }}
                                >
                                  +{userTags.length - 3}
                                </span>
                              )}
                            </div>
                          );
                        })()}
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
          <div style={{ padding: isMobile ? '16px 14px' : '20px 28px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box', maxWidth: '100%' }}>
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
            padding: isMobile ? '12px 14px' : '14px 28px 12px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-warm)',
            display: 'flex',
            alignItems: 'center',
            boxSizing: 'border-box',
            maxWidth: '100%',
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

          <div style={{ padding: isMobile ? '16px 14px' : '20px 28px', display: 'flex', flexDirection: 'column', gap: 14, boxSizing: 'border-box', maxWidth: '100%', overflowX: 'hidden' }}>
            {addStep === 1 ? (
              <>
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: isMobile ? 10 : 12, background: '#fff', display: 'grid', gap: 10, boxSizing: 'border-box', maxWidth: '100%', overflowX: 'hidden' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BriefcaseBusiness size={16} style={{ color: '#9A6808' }} />
                    <span style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#9A6808',
                    }}>
                      {addSelectedJob?.title ?? t('ats.position', 'Position')}
                    </span>
                  </div>
                  {addSelectedJob?.storeName && (
                    <span style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <StoreIcon size={14} />
                      {addSelectedJob.storeName}
                    </span>
                  )}
                </div>

                {/* Section 1: Basic Information */}
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: isMobile ? '14px 12px' : '16px 16px 12px', background: '#fff', display: 'grid', gap: 12, boxSizing: 'border-box', maxWidth: '100%', overflowX: 'hidden' }}>
                  <div style={{ paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {t('ats.basicInformation', 'Basic Information')}
                    </h4>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                      {t('ats.basicInformationHint', 'Required candidate contact details')}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
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
                    <Input
                      label={t('publicCareers.linkedinLabel', 'LinkedIn URL')}
                      type="url"
                      value={addLinkedinUrl}
                      onChange={(e) => setAddLinkedinUrl(e.target.value)}
                      placeholder={t('ats.addCandidateLinkedinPh', 'https://linkedin.com/in/...')}
                    />
                  </div>
                </div>

                {/* Section 2: Personal Details */}
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: isMobile ? '14px 12px' : '16px 16px 12px', background: '#fff', display: 'grid', gap: 12, boxSizing: 'border-box', maxWidth: '100%', overflowX: 'hidden' }}>
                  <div style={{ paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {t('ats.personalDetails', 'Personal Details')}
                    </h4>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                      {t('ats.personalDetailsHint', 'Optional demographic and location information')}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <DatePicker
                      label={t('employees.dateOfBirthField', 'Date of birth')}
                      value={addProfile.dateOfBirth}
                      onChange={(value) => setAddProfile((prev) => ({ ...prev, dateOfBirth: value }))}
                      initialViewYear={new Date().getFullYear() - 30}
                      placement="bottom"
                    />
                    <Select
                      label={t('employees.genderField', 'Gender')}
                      value={addProfile.gender}
                      onChange={(e) => setAddProfile((prev) => ({ ...prev, gender: e.target.value }))}
                    >
                      <option value="">{t('ats.selectOption', 'Select option')}</option>
                      <option value="M">{t('employees.genderMale', 'Male')}</option>
                      <option value="F">{t('employees.genderFemale', 'Female')}</option>
                      <option value="other">{t('employees.genderOther', 'Other')}</option>
                    </Select>
                    <Select
                      label={t('employees.maritalStatusField', 'Marital status')}
                      value={addProfile.maritalStatus}
                      onChange={(e) => setAddProfile((prev) => ({ ...prev, maritalStatus: e.target.value }))}
                    >
                      <option value="">{t('ats.selectOption', 'Select option')}</option>
                      <option value="single">{t('employees.maritalStatusSingle', 'Single')}</option>
                      <option value="married">{t('employees.maritalStatusMarried', 'Married')}</option>
                      <option value="divorced">{t('employees.maritalStatusDivorced', 'Divorced')}</option>
                      <option value="partnered">{t('employees.maritalStatusPartnered', 'Partnered')}</option>
                    </Select>
                    <Input
                      label={t('employees.nationalityField', 'Nationality')}
                      value={addProfile.nationality}
                      onChange={(e) => setAddProfile((prev) => ({ ...prev, nationality: e.target.value }))}
                      placeholder={t('ats.nationalityPlaceholder', 'Italian')}
                    />
                    <Input
                      label={t('employees.addressField', 'Address')}
                      value={addAddress}
                      onChange={(e) => setAddAddress(e.target.value)}
                      placeholder={t('employees.addressPlaceholder', 'Street address')}
                    />
                    <Input
                      label={t('employees.postalCodeField', 'Postal code')}
                      value={addPostalCode}
                      onChange={(e) => setAddPostalCode(e.target.value)}
                      placeholder={t('employees.postalCodePlaceholder', '00100')}
                    />
                  </div>

                  <LocationFieldGroup
                    value={{
                      country: addProfile.country,
                      state: addProfile.state,
                      city: addProfile.city,
                    }}
                    onChange={(location) => setAddProfile((prev) => ({
                      ...prev,
                      country: location.country,
                      state: location.state,
                      city: location.city,
                    }))}
                    includeAddress={false}
                    includePostalCode={false}
                    includePhone={false}
                    labels={{
                      country: t('companies.country', 'Country'),
                      state: t('companies.state', 'State'),
                      city: t('companies.city', 'City'),
                    }}
                  />
                </div>

                {/* Section 3: Employment Details */}
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: isMobile ? '14px 12px' : '16px 16px 12px', background: '#fff', display: 'grid', gap: 12, boxSizing: 'border-box', maxWidth: '100%', overflowX: 'hidden' }}>
                  <div style={{ paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {t('ats.employmentDetails', 'Employment Details')}
                    </h4>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                      {t('ats.employmentDetailsHint', 'Work-related information and dates')}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <Input
                      label={t('employees.companyEmailField', 'Company email')}
                      type="email"
                      value={addCompanyEmail}
                      onChange={(e) => setAddCompanyEmail(e.target.value)}
                      placeholder={t('employees.companyEmailPlaceholder', 'mario.rossi@company.com')}
                    />
                    <DatePicker
                      label={t('ats.candidateApplicationDate', 'Candidate application date')}
                      value={addProfile.applicationDate}
                      onChange={(value) => setAddProfile((prev) => ({ ...prev, applicationDate: value }))}
                      placement="bottom"
                    />
                    <DatePicker
                      label={t('ats.availableStartDate', 'Available start date')}
                      value={addAvailableStartDate}
                      onChange={(value) => setAddAvailableStartDate(value)}
                      placement="bottom"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <Input
                      label={t('employees.jobTypeField', 'Job type')}
                      value={
                        addSelectedJob?.jobType === 'fulltime' ? t('employees.workingTypeFull', 'Full time') :
                          addSelectedJob?.jobType === 'parttime' ? t('employees.workingTypePart', 'Part time') :
                            addSelectedJob?.jobType === 'contract' ? t('employees.contractTypeContract', 'Contract') :
                              addSelectedJob?.jobType === 'internship' ? t('employees.contractInternship', 'Internship') : ''
                      }
                      disabled
                      style={{ background: 'var(--surface-warm)', cursor: 'not-allowed' }}
                      placeholder={t('common.notSet', 'Not set')}
                    />
                    <Input
                      label={t('employees.weeklyHoursField', 'Working hours (availability)')}
                      value={addSelectedJob?.weeklyHours ? `${addSelectedJob.weeklyHours}` : ''}
                      disabled
                      style={{ background: 'var(--surface-warm)', cursor: 'not-allowed' }}
                      placeholder={t('common.notSet', 'Not set')}
                    />
                  </div>
                </div>

                {/* Documents Section */}
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: isMobile ? '14px 12px' : '16px 16px 12px', background: '#fff', display: 'grid', gap: 12, boxSizing: 'border-box', maxWidth: '100%', overflowX: 'hidden' }}>
                  <div style={{ paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {t('ats.documents', 'Documents')}
                    </h4>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                      {t('ats.documentsHint', 'CV and cover letter')}
                    </p>
                  </div>

                  <div
                    style={{
                      border: '1px dashed rgba(201,151,58,0.45)',
                      borderRadius: 12,
                      padding: 14,
                      background: 'rgba(201,151,58,0.06)',
                      display: 'grid',
                      gap: 8,
                      boxSizing: 'border-box',
                      maxWidth: '100%',
                      overflowX: 'hidden',
                    }}
                  >
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {t('ats.candidateCvUpload', 'CV / Resume')}
                    </label>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                      {t('ats.candidateCvUploadHint', 'PDF, DOC or DOCX — max 5 MB. Optional for internal entries; attach when available.')}
                    </p>

                    {!addCvFile ? (
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setAddCvFile(file);
                          if (file) {
                            if (cvPreviewUrl) {
                              URL.revokeObjectURL(cvPreviewUrl);
                            }
                            const url = URL.createObjectURL(file);
                            setCvPreviewUrl(url);
                          }
                        }}
                        style={{ fontSize: 13, maxWidth: '100%' }}
                      />
                    ) : (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: '#fff',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        boxSizing: 'border-box',
                        maxWidth: '100%',
                      }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {addCvFile.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {(addCvFile.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
                          <button
                            type="button"
                            onClick={() => setShowCvPreview(true)}
                            style={{
                              padding: '6px 10px',
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              borderRadius: 6,
                              cursor: 'pointer',
                              fontSize: 11,
                              fontWeight: 600,
                              color: 'var(--text-secondary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Eye size={13} /> {t('common.view', 'View')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAddCvFile(null);
                              if (cvPreviewUrl) {
                                URL.revokeObjectURL(cvPreviewUrl);
                                setCvPreviewUrl(null);
                              }
                            }}
                            style={{
                              padding: '6px 10px',
                              background: 'rgba(220,38,38,0.08)',
                              border: '1px solid rgba(220,38,38,0.2)',
                              borderRadius: 6,
                              cursor: 'pointer',
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#DC2626',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Trash2 size={13} /> {t('common.delete', 'Delete')}
                          </button>
                        </div>
                      </div>
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
                      style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', padding: '10px 12px', fontSize: 13.5, borderRadius: 10, border: '1px solid var(--border)', outline: 'none', display: 'block', background: '#fff', maxWidth: '100%' }}
                    />
                    <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>{addCoverLetter.length}/1000</div>
                  </div>

                  <label style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={addGdprConsent}
                      onChange={(e) => setAddGdprConsent(e.target.checked)}
                      required
                      style={{ marginTop: 2 }}
                    />
                    <span>{t('publicCareers.privacyConsent', 'Privacy consent collected')}</span>
                  </label>
                </div>
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

      {/* CV Preview Modal */}
      {showCvPreview && cvPreviewUrl && addCvFile && (
        <DocumentPreviewModal
          url={cvPreviewUrl}
          filename={addCvFile.name}
          onClose={() => setShowCvPreview(false)}
        />
      )}

      {selected && (
        <CandidateModal
          candidate={selected}
          jobs={jobs}
          employees={employees}
          canEdit={canEdit}
          canTag={canTag}
          canFeedback={canFeedback}
          interviewInviteEnabled={interviewInviteEnabled}
          smtpConfigured={smtpConfigured}
          onClose={closeCandidateModal}
          onAdvance={handleAdvance}
          onReject={handleReject}
          onDelete={handleDelete}
          saving={saving}
          companies={companies}
        />
      )}

      {showEmployeeModal && employeeData && (
        <ModalBackdrop onClose={() => !creatingEmployee && setShowEmployeeModal(false)} width={1040}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            padding: 0,
            width: '100%',
            maxWidth: 1120,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '18px 22px 16px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, rgba(201,151,58,0.10), rgba(255,255,255,0.96))' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                    {t('ats.createEmployee', 'Create Employee')}
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '6px 0 0', maxWidth: 760 }}>
                    {t('ats.createEmployeePrompt', 'Review the candidate profile, confirm the employee setup fields, and complete the company email before hiring.')}
                  </p>
                </div>
                <div style={{ display: 'grid', gap: 6, justifyItems: 'end', fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>{employeeData.jobTitle || t('ats.candidateProfile', 'Candidate')}</span>
                  <span>{employeeData.hireDate ? `${t('employees.hireDateField', 'Hire date')}: ${employeeData.hireDate}` : ''}</span>
                  <span>{employeeData.uniqueId ? `${t('employees.uniqueIdField', 'Unique ID')}: ${employeeData.uniqueId}` : ''}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 14 }}>
                <div style={{ border: '1px solid rgba(201,151,58,0.22)', borderRadius: 14, background: '#fff', padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(201,151,58,0.18)', background: 'rgba(201,151,58,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {employeeData.companyLogoFilename ? (
                      <img src={getCompanyLogoUrl(employeeData.companyLogoFilename) ?? ''} alt={employeeData.companyName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontWeight: 800, color: '#8A5A07', fontSize: 12 }}>{(employeeData.companyName || 'CO').slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{t('common.company', 'Company')}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{employeeData.companyName || t('common.notProvided', 'Not provided')}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{employeeData.companyGroupName || t('companies.group', 'No group')}</div>
                  </div>
                </div>

                <div style={{ border: '1px solid rgba(13,33,55,0.12)', borderRadius: 14, background: '#fff', padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(13,33,55,0.12)', background: 'rgba(13,33,55,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {employeeData.storeLogoFilename ? (
                      <img src={getStoreLogoUrl(employeeData.storeLogoFilename) ?? ''} alt={employeeData.storeName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontWeight: 800, color: '#0D2137', fontSize: 12 }}>{(employeeData.storeName || 'ST').slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{t('common.store', 'Store')}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{employeeData.storeName || t('common.notProvided', 'Not provided')}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {employeeData.storeEmployeeCount != null ? `${employeeData.storeEmployeeCount} ${t('employees.totalEmployees', 'employees')}` : t('common.notProvided', 'Not provided')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '18px 22px 22px', display: 'grid', gap: 16, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>

              {/* Section 1: Basic Information */}
              <div style={{ border: '1px solid rgba(201,151,58,0.22)', borderRadius: 14, background: '#fff', padding: '16px 16px 12px', display: 'grid', gap: 12 }}>
                <div style={{ paddingBottom: 8, borderBottom: '1px solid rgba(201,151,58,0.18)' }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#8A5A07' }}>
                    {t('ats.basicInformation', 'Basic Information')}
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    {t('ats.basicInformationHint', 'Required candidate contact details')}
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  <Input
                    label={t('common.firstName', 'First name')}
                    value={employeeData.name}
                    onChange={(e) => setEmployeeData((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                    disabled={creatingEmployee}
                  />
                  <Input
                    label={t('common.lastName', 'Last name')}
                    value={employeeData.surname}
                    onChange={(e) => setEmployeeData((prev) => (prev ? { ...prev, surname: e.target.value } : prev))}
                    disabled={creatingEmployee}
                  />
                  <Input
                    type="email"
                    label={t('common.companyEmail', 'Company Email')}
                    value={employeeEmail}
                    onChange={(e) => setEmployeeEmail(e.target.value)}
                    placeholder={t('ats.companyEmailPlaceholder', 'e.g., john.doe@company.com')}
                    disabled={creatingEmployee}
                    autoFocus
                  />
                  <Input
                    label={t('common.personalEmail', 'Personal Email')}
                    type="email"
                    value={employeeData.personalEmail}
                    onChange={(e) => setEmployeeData((prev) => (prev ? { ...prev, personalEmail: e.target.value } : prev))}
                    disabled={creatingEmployee}
                  />
                  <Input
                    label={t('ats.phone', 'Phone')}
                    value={employeeData.phone}
                    onChange={(e) => setEmployeeData((prev) => (prev ? { ...prev, phone: e.target.value } : prev))}
                    disabled={creatingEmployee}
                  />
                </div>
              </div>

              {/* Section 2: Employee Details */}
              <div style={{ border: '1px solid rgba(13,33,55,0.15)', borderRadius: 14, background: '#fff', padding: '16px 16px 12px', display: 'grid', gap: 12 }}>
                <div style={{ paddingBottom: 8, borderBottom: '1px solid rgba(13,33,55,0.12)' }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0D2137' }}>
                    {t('ats.employeeDetails', 'Employee Details')}
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    {t('ats.personalDetailsHint', 'Optional demographic and location information')}
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  <DatePicker
                    label={t('employees.dateOfBirthField', 'Date of birth')}
                    value={employeeData.dateOfBirth}
                    onChange={(value) => setEmployeeData((prev) => (prev ? { ...prev, dateOfBirth: value } : prev))}
                    placement="bottom"
                  />
                  <Select
                    label={t('employees.genderField', 'Gender')}
                    value={employeeData.gender}
                    onChange={(e) => setEmployeeData((prev) => (prev ? { ...prev, gender: e.target.value } : prev))}
                    disabled={creatingEmployee}
                  >
                    <option value="">{t('common.notProvided', 'Not provided')}</option>
                    <option value="M">{t('employees.genderMale', 'Male')}</option>
                    <option value="F">{t('employees.genderFemale', 'Female')}</option>
                    <option value="other">{t('employees.genderOther', 'Other')}</option>
                  </Select>
                  <Input
                    label={t('employees.maritalStatusField', 'Marital status')}
                    value={employeeData.maritalStatus}
                    onChange={(e) => setEmployeeData((prev) => (prev ? { ...prev, maritalStatus: e.target.value } : prev))}
                    disabled={creatingEmployee}
                  />
                  <Input
                    label={t('employees.nationalityField', 'Nationality')}
                    value={employeeData.nationality}
                    onChange={(e) => setEmployeeData((prev) => (prev ? { ...prev, nationality: e.target.value } : prev))}
                    disabled={creatingEmployee}
                  />
                  <Select
                    label={t('common.role', 'Role')}
                    value={employeeData.role}
                    onChange={(e) => setEmployeeData((prev) => (prev ? { ...prev, role: e.target.value } : prev))}
                    disabled={creatingEmployee}
                  >
                    <option value="employee">{t('roles.employee', 'Employee')}</option>
                    <option value="store_manager">{t('roles.store_manager', 'Store manager')}</option>
                    <option value="area_manager">{t('roles.area_manager', 'Area manager')}</option>
                    <option value="hr">{t('roles.hr', 'HR')}</option>
                    <option value="admin">{t('roles.admin', 'Admin')}</option>
                  </Select>
                </div>
                <LocationFieldGroup
                  value={{ country: employeeData.country, state: employeeData.state, city: employeeData.city }}
                  onChange={(location) => setEmployeeData((prev) => (prev ? {
                    ...prev,
                    country: location.country,
                    state: location.state,
                    city: location.city,
                  } : prev))}
                  includeAddress={false}
                  includePostalCode={false}
                  includePhone={false}
                  labels={{
                    country: t('companies.country', 'Country'),
                    state: t('companies.state', 'State'),
                    city: t('companies.city', 'City'),
                  }}
                />
              </div>

              {/* Section 3: Job Position Details */}
              <div style={{ border: '1px solid rgba(59,130,246,0.18)', borderRadius: 14, background: 'rgba(59,130,246,0.04)', padding: '16px 16px 12px', display: 'grid', gap: 12 }}>
                <div style={{ paddingBottom: 8, borderBottom: '1px solid rgba(59,130,246,0.15)' }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e40af' }}>
                    {t('ats.employmentDetails', 'Job Position Details')}
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    {t('ats.employmentDetailsHint', 'Work-related information and dates')}
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  <Select
                    label={t('employees.workingTypeField', 'Working type')}
                    value={employeeData.workingType}
                    onChange={(e) => setEmployeeData((prev) => (prev ? { ...prev, workingType: e.target.value } : prev))}
                    disabled={creatingEmployee}
                  >
                    <option value="full_time">{t('employees.fullTime', 'Full time')}</option>
                    <option value="part_time">{t('employees.partTime', 'Part time')}</option>
                  </Select>
                  <Select
                    label={t('employees.contractTypeField', 'Contract type')}
                    value={employeeData.contractType}
                    onChange={(e) => setEmployeeData((prev) => (prev ? { ...prev, contractType: e.target.value } : prev))}
                    disabled={creatingEmployee}
                  >
                    <option value="">{t('common.notProvided', 'Not provided')}</option>
                    <option value="fixed_term">{t('employees.contractFixedTerm', 'Fixed term')}</option>
                    <option value="open_ended">{t('employees.contractOpenEnded', 'Open ended')}</option>
                    <option value="internship">{t('employees.contractInternship', 'Internship')}</option>
                    <option value="consulting">{t('employees.contractConsulting', 'Consulting')}</option>
                  </Select>
                  <DatePicker
                    label={t('employees.hireDateField', 'Hire date')}
                    value={employeeData.hireDate}
                    onChange={(value) => setEmployeeData((prev) => (prev ? { ...prev, hireDate: value } : prev))}
                    placement="bottom"
                  />
                  <Input
                    label={`${t('employees.weeklyHoursField', 'Weekly hours')} (${t('ats.availabilityLabel', 'Availability')})`}
                    value={employeeData.weeklyHours || employeeData.availability || ''}
                    disabled={true}
                    style={{ background: 'rgba(0,0,0,0.02)', cursor: 'not-allowed' }}
                  />
                  <div>
                    <Input
                      label={t('employees.uniqueIdField', 'Unique ID')}
                      value={employeeData.uniqueId}
                      onChange={(e) => setEmployeeData((prev) => (prev ? { ...prev, uniqueId: e.target.value } : prev))}
                      disabled={creatingEmployee}
                    />
                    <button
                      type="button"
                      onClick={() => setEmployeeData((prev) => (prev ? { ...prev, uniqueId: generateEmployeeUniqueId() } : prev))}
                      disabled={creatingEmployee}
                      style={{
                        marginTop: '5px', background: 'none', border: 'none',
                        cursor: creatingEmployee ? 'not-allowed' : 'pointer', fontSize: '11px', color: 'var(--accent)',
                        fontFamily: 'var(--font-body)', fontWeight: 500,
                        padding: '2px 0', display: 'flex', alignItems: 'center', gap: '4px',
                        opacity: creatingEmployee ? 0.5 : 1,
                      }}
                    >
                      <RotateCcw size={12} /> {t('employees.regenerateId', 'Regenerate ID')}
                    </button>
                  </div>
                  <Input
                    label={t('employees.tempPasswordLabel', 'Temporary password')}
                    type="text"
                    value={employeeData.password}
                    onChange={(e) => setEmployeeData((prev) => (prev ? { ...prev, password: e.target.value } : prev))}
                    disabled={creatingEmployee}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setEmployeeData((prev) => (prev ? { ...prev, uniqueId: generateEmployeeUniqueId(), password: generateTempPassword() } : prev))}
                    disabled={creatingEmployee}
                    style={{ width: '100%', maxWidth: 280 }}
                  >
                    {t('employees.regeneratePassword', 'Regenerate access credentials')}
                  </Button>
                </div>
              </div>

              {/* Application Info Section (Read-only) */}
              <div style={{ border: '1px solid rgba(201,151,58,0.18)', borderRadius: 14, padding: 14, background: 'rgba(201,151,58,0.04)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#8A5A07', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  {t('ats.applicationInfo', 'Application info')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <div><strong style={{ color: 'var(--text)' }}>{t('ats.currentEmployerLabel', 'Current employer')}:</strong> {employeeData.currentEmployer || t('common.notProvided', 'Not provided')}</div>
                  <div><strong style={{ color: 'var(--text)' }}>{t('ats.currentRoleLabel', 'Current role')}:</strong> {employeeData.currentRole || t('common.notProvided', 'Not provided')}</div>
                  <div><strong style={{ color: 'var(--text)' }}>{t('ats.availabilityLabel', 'Working hours')}:</strong> {employeeData.availability || employeeData.weeklyHours || t('common.notProvided', 'Not provided')}</div>
                  <div><strong style={{ color: 'var(--text)' }}>{t('ats.applicationDateLabel', 'Application date')}:</strong> {employeeData.applicationDate || t('common.notProvided', 'Not provided')}</div>
                  <div><strong style={{ color: 'var(--text)' }}>{t('ats.applicationSourceLabel', 'Source / channel')}:</strong> {[employeeData.applicationSource, employeeData.applicationChannel].filter(Boolean).join(' / ') || t('common.notProvided', 'Not provided')}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowEmployeeModal(false);
                    setEmployeeData(null);
                    setEmployeeEmail('');
                  }}
                  disabled={creatingEmployee}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCreateEmployeeFromCandidate}
                  loading={creatingEmployee}
                  disabled={!employeeEmail.trim()}
                >
                  {t('ats.createAndHire', 'Create Employee & Hire')}
                </Button>
              </div>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </div>
  );
};

// ─── Alerts Panel ─────────────────────────────────────────────────────────────

const AlertsPanel: React.FC<{ canViewRisks: boolean; companyId?: number }> = ({ canViewRisks, companyId }) => {
  const { t } = useTranslation();
  const { isMobile } = useBreakpoint();
  const [alerts, setAlerts] = useState<HRAlert[]>([]);
  const [risks, setRisks] = useState<JobRisk[]>([]);
  const [feedbacks, setFeedbacks] = useState<AllInterviewFeedbackComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.allSettled([
      getAlerts({ companyId }),
      canViewRisks ? getRisks({ companyId }) : Promise.resolve([] as JobRisk[]),
      getAllInterviewFeedbackComments({ companyId }),
    ])
      .then(([alertsResult, risksResult, feedbacksResult]) => {
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

        if (feedbacksResult.status === 'fulfilled') {
          setFeedbacks(feedbacksResult.value as AllInterviewFeedbackComment[]);
        } else {
          setFeedbacks([]);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [canViewRisks, companyId]);

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
                  borderRadius: 14, padding: isMobile ? '12px 14px' : '14px 20px',
                  display: 'flex', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 16, flexWrap: 'wrap',
                  flexDirection: isMobile ? 'column' : 'row',
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: rc, flexShrink: 0,
                    boxShadow: `0 0 0 4px ${rc}20`,
                    display: isMobile ? 'none' : 'block'
                  }} />
                  <div style={{ flex: 1, minWidth: isMobile ? '100%' : 160 }}>
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
                    alignSelf: isMobile ? 'flex-start' : 'center'
                  }}>
                    {t(`ats.risk_${risk.riskLevel}`)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feedback Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            💬 {t('ats.feedbackSection', 'Feedback')}
          </h3>
          {feedbacks.length > 0 && (
            <span style={{
              background: '#0284C7', color: '#fff', borderRadius: 99,
              fontSize: 11, fontWeight: 700, padding: '1px 8px',
            }}>
              {feedbacks.length}
            </span>
          )}
        </div>

        {feedbacks.length === 0 ? (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '36px 28px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <div style={{ fontWeight: 700, fontSize: 15, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: 4 }}>
              {t('ats.noFeedback', 'No candidate feedback recorded yet')}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {feedbacks.map((fb) => {
              const d = new Date(fb.createdAt);
              const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
              const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={fb.id} style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                }}>
                  {/* Author and Date/Time Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'rgba(2, 132, 199, 0.1)',
                        color: '#0284C7',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 14, textTransform: 'uppercase'
                      }}>
                        {fb.authorName ? fb.authorName.charAt(0) : 'U'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                          {fb.authorName} {fb.authorSurname}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                          {fb.authorRole ? fb.authorRole.replace('_', ' ') : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {time}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {date}
                      </div>
                    </div>
                  </div>

                  {/* Feedback Body */}
                  <div style={{
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    lineHeight: 1.5,
                    background: 'var(--background)',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {fb.body}
                  </div>

                  {/* Candidate metadata badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                    <span>👤</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {fb.candidateName}
                    </span>
                    {fb.positionTitle && (
                      <>
                        <span style={{ color: 'var(--border)' }}>|</span>
                        <span style={{ fontStyle: 'italic' }}>{fb.positionTitle}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};


// ─── Main ATSPage ─────────────────────────────────────────────────────────────

export default function ATSPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { isMobile } = useBreakpoint();

  const isStoreManager = user?.role === 'store_manager';
  const canEdit = !!user && ['admin', 'hr'].includes(user.role);
  const canViewRisks = !!user && ['admin', 'hr'].includes(user.role);
  const canFeedback = !!user && ['admin', 'hr', 'area_manager', 'store_manager'].includes(user.role);
  const canTag = !!user && ['admin', 'hr', 'area_manager', 'store_manager'].includes(user.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTabState] = useState<'jobs' | 'indeed' | 'candidates' | 'interviews' | 'alerts' | 'calendar'>(
    (searchParams.get('view') as 'jobs' | 'indeed' | 'candidates' | 'interviews' | 'alerts' | 'calendar') || 'candidates'
  );
  
  const setTab = (newTab: 'jobs' | 'indeed' | 'candidates' | 'interviews' | 'alerts' | 'calendar') => {
    setTabState(newTab);
    setSearchParams((prev) => {
      prev.set('view', newTab);
      return prev;
    }, { replace: true });
  };

  useEffect(() => {
    if (!searchParams.get('view')) {
      setSearchParams((prev) => {
        prev.set('view', tab);
        return prev;
      }, { replace: true });
    }
  }, []);

  const urlView = searchParams.get('view') as 'jobs' | 'indeed' | 'candidates' | 'interviews' | 'alerts' | 'calendar' | null;
  useEffect(() => {
    if (urlView && urlView !== tab) {
      setTabState(urlView);
    }
  }, [urlView, tab]);

  const [stores, setStores] = useState<Store[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>(undefined);
  
  const deepLinkCandidateId = searchParams.get('candidateId') ? Number(searchParams.get('candidateId')) : null;

  const isSuperAdmin = !!user?.isSuperAdmin;
  const isAdmin = user?.role === 'admin';
  const canFilterCompany = isSuperAdmin || isAdmin;

  // Fetch all companies for the filter if authorized
  useEffect(() => {
    if (canFilterCompany) {
      getCompanies()
        .then(data => setAllCompanies(data))
        .catch(err => console.error('Failed to fetch companies for filter:', err));
    }
  }, [canFilterCompany]);

  // Fetch data for calendar when calendar tab is active
  useEffect(() => {
    if (tab === 'calendar') {
      Promise.all([
        getStores().catch(() => []),
        getCompanies().catch(() => []),
        getEmployees({ status: 'active', includeStoreTerminals: false, limit: 500 }).then(res => res.employees).catch(() => []),
        getJobs({ companyId: selectedCompanyId }).catch(() => []),
      ]).then(([storesData, companiesData, employeesData, jobsData]) => {
        setStores(storesData);
        setCompanies(companiesData);
        setEmployees(employeesData);
        setJobs(jobsData);
      });
    }
  }, [tab, selectedCompanyId]);

  const tabs = isStoreManager
    ? [
      { key: 'candidates', label: t('ats.tabCandidates'), icon: '👥' },
      { key: 'interviews', label: t('ats.tabInterviews', 'Interviews'), icon: '📋' },
      { key: 'calendar', label: t('ats.tabCalendar', 'Calendar'), icon: '📅' },
    ]
    : [
      ...(canEdit ? [{ key: 'jobs', label: t('ats.tabJobs'), icon: '💼' }] : []),
      { key: 'candidates', label: t('ats.tabCandidates'), icon: '👥' },
      { key: 'interviews', label: t('ats.tabInterviews', 'Interviews'), icon: '📋' },
      { key: 'calendar', label: t('ats.tabCalendar', 'Calendar'), icon: '📅' },
      { key: 'alerts', label: t('ats.tabAlerts'), icon: '🔔' },
      ...(canEdit ? [{ key: 'indeed', label: t('ats.tabIndeed', 'Indeed'), icon: '📡' }] : []),
    ];

  // Keep store managers on their allowed tabs only
  useEffect(() => {
    if (isStoreManager && !['candidates', 'interviews', 'calendar'].includes(tab)) {
      setTab('candidates');
    }
  }, [isStoreManager, tab]);

  // Handle deep link tab switching
  useEffect(() => {
    if (deepLinkCandidateId && tab !== 'candidates') {
      setTab('candidates');
    }
  }, [deepLinkCandidateId, tab]);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? '0 0 20px' : '0 0 28px' }} className="page-enter">

      {/* Hero header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #163352 100%)',
        borderRadius: 16, padding: isMobile ? '18px 20px' : '28px 32px', marginBottom: isMobile ? 18 : 28,
        display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16,
        flexDirection: isMobile ? 'column' : 'row',
        boxShadow: '0 8px 32px rgba(13,33,55,0.14)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, marginBottom: 6 }}>
            <div style={{
              width: isMobile ? 36 : 42, height: isMobile ? 36 : 42, borderRadius: 10,
              background: 'rgba(201,151,58,0.18)',
              border: '1px solid rgba(201,151,58,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? 18 : 20,
            }}>
              🎯
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: isMobile ? 21 : 26, fontWeight: 800,
              color: '#fff', margin: 0, letterSpacing: '-0.02em',
            }}>
              {t('nav.ats')}
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: isMobile ? 12.5 : 14, color: 'rgba(255,255,255,0.65)', maxWidth: 480 }}>
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
              borderRadius: 8, padding: isMobile ? '4px 10px' : '6px 12px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: isMobile ? 10 : 11, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                {t(`ats.stage_${stage}`)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Row Container: Pill tab switcher on left, Company Filter on right */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: isMobile ? 18 : 28,
        width: '100%'
      }}>
        {/* Pill tab switcher */}
        <div 
          className="no-scrollbar"
          style={{
            display: 'flex', gap: 4,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 4, width: isMobile ? '100%' : 'fit-content',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {tabs.map((tb) => {
            const isActive = tab === tb.key;
            return (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key as typeof tab)}
                style={{
                  padding: isMobile ? '8px 12px' : '8px 20px',
                  background: isActive ? 'var(--primary)' : 'transparent',
                  border: 'none', borderRadius: 9,
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: isMobile ? 12.5 : 14, cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  display: 'flex', alignItems: 'center', gap: 7,
                  fontFamily: 'var(--font-body)',
                  boxShadow: isActive ? '0 2px 8px rgba(13,33,55,0.18)' : 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: isMobile ? 13 : 15 }}>{tb.icon}</span>
                {tb.label}
              </button>
            );
          })}
        </div>

        {/* Company Filter Dropdown (Super Admin / Admin Only) */}
        {canFilterCompany && (
          <div style={{ 
            width: isMobile ? '100%' : 260
          }}>
            <CustomSelect
              value={selectedCompanyId ? String(selectedCompanyId) : 'all'}
              onChange={(val) => setSelectedCompanyId(val === 'all' ? undefined : Number(val))}
              options={[
                { value: 'all', label: t('common.allCompanies', 'All Companies') },
                ...allCompanies.map(c => ({
                  value: String(c.id),
                  label: c.name
                }))
              ]}
              placeholder={t('common.filterByCompany', 'Filter by Company')}
            />
          </div>
        )}
      </div>

      {tab === 'jobs' && canEdit && <JobsPanel canEdit={canEdit} companyId={selectedCompanyId} />}
      {tab === 'indeed' && canEdit && <IndeedPanel canEdit={canEdit} companyId={selectedCompanyId} />}
      {tab === 'candidates' && <KanbanPanel canEdit={canEdit} canFeedback={canFeedback} canTag={canTag} companyId={selectedCompanyId} preSelectedCandidateId={deepLinkCandidateId} companies={companies} />}
      {tab === 'interviews' && <InterviewsPanel companyId={selectedCompanyId} />}
      {tab === 'calendar' && <CalendarPanel positions={jobs} employees={employees} companyId={selectedCompanyId} companies={companies} />}
      {tab === 'alerts' && <AlertsPanel canViewRisks={canViewRisks} companyId={selectedCompanyId} />}
    </div>
  );
}
