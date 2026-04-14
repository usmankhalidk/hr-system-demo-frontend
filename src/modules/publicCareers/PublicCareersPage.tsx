import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Globe2,
  Heart,
  MapPin,
  Search,
  SlidersHorizontal,
  Store as StoreIcon,
  Wallet,
  X,
} from 'lucide-react';
import { getCompanyLogoUrl } from '../../api/client';
import { getPublicJobsCatalog, PublicCompany, PublicJob, PublicStoreOption } from '../../api/publicCareers';
import { LanguageSwitcher } from '../../components/ui/LanguageSwitcher';
import './publicCareers.css';

type UiLanguage = 'it' | 'en';
type SortMode = 'latest' | 'oldest' | 'salary_high' | 'salary_low';

type CareersFilters = {
  search: string;
  companyId: string;
  storeId: string;
  jobType: string;
  remoteType: string;
  language: string;
  status: string;
  salaryMin: string;
  salaryMax: string;
  sort: SortMode;
};

const DEFAULT_FILTERS: CareersFilters = {
  search: '',
  companyId: 'all',
  storeId: 'all',
  jobType: 'all',
  remoteType: 'all',
  language: 'all',
  status: 'all',
  salaryMin: '',
  salaryMax: '',
  sort: 'latest',
};

const JOB_TYPE_LABEL: Record<UiLanguage, Record<string, string>> = {
  en: {
    fulltime: 'Full-time',
    parttime: 'Part-time',
    contract: 'Contract',
    internship: 'Internship',
  },
  it: {
    fulltime: 'Tempo pieno',
    parttime: 'Part-time',
    contract: 'Contratto',
    internship: 'Stage',
  },
};

const REMOTE_TYPE_LABEL: Record<UiLanguage, Record<string, string>> = {
  en: {
    onsite: 'On-site',
    hybrid: 'Hybrid',
    remote: 'Remote',
  },
  it: {
    onsite: 'In sede',
    hybrid: 'Ibrido',
    remote: 'Remoto',
  },
};

const COPY: Record<UiLanguage, {
  kicker: string;
  title: string;
  subtitle: string;
  openRoles: string;
  activeCompanies: string;
  stores: string;
  fullyRemoteRoles: string;
  findYourMatch: string;
  searchHint: string;
  searchLabel: string;
  searchPlaceholder: string;
  companyLabel: string;
  allCompanies: string;
  loadingOpenPositions: string;
  loadError: string;
  noPositions: string;
  independentCompany: string;
  generalHiring: string;
  flexible: string;
  posted: string;
  salary: string;
  language: string;
  notSpecified: string;
  upTo: string;
  italian: string;
  english: string;
  viewDetails: string;
  filters: string;
  filtersHint: string;
  applyFilters: string;
  resetFilters: string;
  clearAllFilters: string;
  sortLabel: string;
  latestJobs: string;
  oldestJobs: string;
  salaryHigh: string;
  salaryLow: string;
  storeLabel: string;
  allStores: string;
  statusLabel: string;
  allStatuses: string;
  statusPublished: string;
  statusClosed: string;
  salaryMinLabel: string;
  salaryMaxLabel: string;
  candidatesApplied: string;
  postedAgo: string;
  actions: string;
  activeFilters: string;
  jobType: string;
  remoteType: string;
  appliedShort: string;
}> = {
  en: {
    kicker: 'Public Careers',
    title: 'Shape Teams That Build Better Workplaces',
    subtitle: 'Browse open opportunities across all active companies. Public career pages stay open without login.',
    openRoles: 'Open roles',
    activeCompanies: 'Active companies',
    stores: 'Stores',
    fullyRemoteRoles: 'Fully remote roles',
    findYourMatch: 'Find Your Match',
    searchHint: 'Search by role title, company, and keyword.',
    searchLabel: 'Search',
    searchPlaceholder: 'Role, keyword, department',
    companyLabel: 'Company',
    allCompanies: 'All companies',
    loadingOpenPositions: 'Loading open positions...',
    loadError: 'Unable to load careers at the moment. Please try again in a few minutes.',
    noPositions: 'No positions match this filter right now.',
    independentCompany: 'Independent company',
    generalHiring: 'General hiring',
    flexible: 'Flexible',
    posted: 'Posted',
    salary: 'Salary',
    language: 'Language',
    notSpecified: '-',
    upTo: 'Up to',
    italian: 'Italian',
    english: 'English',
    viewDetails: 'View details',
    filters: 'Filters',
    filtersHint: 'Use advanced filters to find the right role faster.',
    applyFilters: 'Apply filters',
    resetFilters: 'Reset',
    clearAllFilters: 'Clear all',
    sortLabel: 'Sort by',
    latestJobs: 'Latest jobs',
    oldestJobs: 'Oldest jobs',
    salaryHigh: 'Salary high to low',
    salaryLow: 'Salary low to high',
    storeLabel: 'Store',
    allStores: 'All stores',
    statusLabel: 'Status',
    allStatuses: 'All statuses',
    statusPublished: 'Published',
    statusClosed: 'Closed',
    salaryMinLabel: 'Salary min',
    salaryMaxLabel: 'Salary max',
    candidatesApplied: 'candidates applied',
    postedAgo: 'ago',
    actions: 'Actions',
    activeFilters: 'active filters',
    jobType: 'Job type',
    remoteType: 'Remote type',
    appliedShort: 'applied',
  },
  it: {
    kicker: 'Careers Pubbliche',
    title: 'Costruisci Team Che Migliorano il Lavoro',
    subtitle: 'Esplora le opportunita aperte tra tutte le aziende attive. Le pagine careers pubbliche restano accessibili senza login.',
    openRoles: 'Posizioni aperte',
    activeCompanies: 'Aziende attive',
    stores: 'Negozi',
    fullyRemoteRoles: 'Ruoli completamente remoti',
    findYourMatch: 'Trova Il Ruolo Giusto',
    searchHint: 'Cerca per titolo ruolo, azienda e parola chiave.',
    searchLabel: 'Cerca',
    searchPlaceholder: 'Ruolo, parola chiave, dipartimento',
    companyLabel: 'Azienda',
    allCompanies: 'Tutte le aziende',
    loadingOpenPositions: 'Caricamento posizioni aperte...',
    loadError: 'Impossibile caricare le careers al momento. Riprova tra pochi minuti.',
    noPositions: 'Nessuna posizione corrisponde ai filtri attuali.',
    independentCompany: 'Azienda indipendente',
    generalHiring: 'Assunzione generale',
    flexible: 'Flessibile',
    posted: 'Pubblicato',
    salary: 'Retribuzione',
    language: 'Lingua',
    notSpecified: '-',
    upTo: 'Fino a',
    italian: 'Italiano',
    english: 'Inglese',
    viewDetails: 'Vedi dettagli',
    filters: 'Filtri',
    filtersHint: 'Usa i filtri avanzati per trovare rapidamente il ruolo giusto.',
    applyFilters: 'Applica filtri',
    resetFilters: 'Reset',
    clearAllFilters: 'Rimuovi tutti',
    sortLabel: 'Ordina per',
    latestJobs: 'Annunci piu recenti',
    oldestJobs: 'Annunci meno recenti',
    salaryHigh: 'Stipendio dal piu alto',
    salaryLow: 'Stipendio dal piu basso',
    storeLabel: 'Negozio',
    allStores: 'Tutti i negozi',
    statusLabel: 'Stato',
    allStatuses: 'Tutti gli stati',
    statusPublished: 'Pubblicata',
    statusClosed: 'Chiusa',
    salaryMinLabel: 'Stipendio minimo',
    salaryMaxLabel: 'Stipendio massimo',
    candidatesApplied: 'candidati hanno applicato',
    postedAgo: 'fa',
    actions: 'Azioni',
    activeFilters: 'filtri attivi',
    jobType: 'Tipo contratto',
    remoteType: 'Modalita lavoro',
    appliedShort: 'candidature',
  },
};

function summarize(text: string | null, max = 170): string {
  if (!text) return '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trim()}...`;
}

function initials(value: string): string {
  return value
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTimeAgo(isoDate: string | null | undefined, uiLanguage: UiLanguage, agoLabel: string): string {
  if (!isoDate) return '-';

  const now = Date.now();
  const target = new Date(isoDate).getTime();
  if (!Number.isFinite(target)) return '-';

  const diffMs = Math.max(0, now - target);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;

  if (diffMs < hour) {
    const value = Math.max(1, Math.floor(diffMs / minute));
    return `${value}m ${agoLabel}`;
  }
  if (diffMs < day) {
    const value = Math.max(1, Math.floor(diffMs / hour));
    return `${value}h ${agoLabel}`;
  }
  if (diffMs < week) {
    const value = Math.max(1, Math.floor(diffMs / day));
    return `${value}d ${agoLabel}`;
  }
  if (diffMs < month) {
    const value = Math.max(1, Math.floor(diffMs / week));
    return `${value}w ${agoLabel}`;
  }
  const value = Math.max(1, Math.floor(diffMs / month));
  return `${value}${uiLanguage === 'it' ? ' mesi' : 'mo'} ${agoLabel}`;
}

function formatLanguageWithFlag(language: string, italianLabel: string, englishLabel: string): string {
  if (language === 'it') return `🇮🇹 ${italianLabel}`;
  if (language === 'en') return `🇬🇧 ${englishLabel}`;
  return `🇮🇹 🇬🇧 ${italianLabel} + ${englishLabel}`;
}

function formatSalary(job: PublicJob, locale: string, notSpecified: string, upTo: string): string {
  if (job.salaryMin == null && job.salaryMax == null) return notSpecified;

  const formatMoney = (value: number) => (
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value)
  );

  if (job.salaryMin != null && job.salaryMax != null) {
    return `${formatMoney(job.salaryMin)} - ${formatMoney(job.salaryMax)}`;
  }
  if (job.salaryMin != null) return `${formatMoney(job.salaryMin)}+`;
  return `${upTo} ${formatMoney(job.salaryMax as number)}`;
}

export default function PublicCareersPage() {
  const { companySlug } = useParams<{ companySlug?: string }>();
  const { i18n } = useTranslation();
  const uiLanguage: UiLanguage = i18n.language?.toLowerCase().startsWith('it') ? 'it' : 'en';
  const copy = COPY[uiLanguage];
  const locale = uiLanguage === 'it' ? 'it-IT' : 'en-US';

  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [companies, setCompanies] = useState<PublicCompany[]>([]);
  const [stores, setStores] = useState<PublicStoreOption[]>([]);
  const [filters, setFilters] = useState<CareersFilters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<CareersFilters>(DEFAULT_FILTERS);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [savedJobs, setSavedJobs] = useState<Record<number, boolean>>({});
  const [likedJobs, setLikedJobs] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
  }, [companySlug]);

  useEffect(() => {
    setLoading(true);
    setHasError(false);
    getPublicJobsCatalog(companySlug)
      .then((data) => {
        const publicJobs = (data.jobs ?? []).filter((job) => job.status !== 'draft');
        setJobs(publicJobs);

        const companyIds = new Set(publicJobs.map((job) => job.companyId));
        const storeIds = new Set(publicJobs.filter((job) => job.storeId !== null).map((job) => job.storeId as number));

        setCompanies((data.companies ?? []).filter((company) => companyIds.has(company.id)));
        setStores((data.stores ?? []).filter((store) => storeIds.has(store.id)));
      })
      .catch(() => {
        setHasError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [companySlug]);

  const companyById = useMemo(() => {
    return new Map(companies.map((company) => [company.id, company]));
  }, [companies]);

  const filteredJobs = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const salaryMin = filters.salaryMin.trim() === '' ? null : Number.parseInt(filters.salaryMin, 10);
    const salaryMax = filters.salaryMax.trim() === '' ? null : Number.parseInt(filters.salaryMax, 10);

    const list = jobs.filter((job) => {
      if (filters.companyId !== 'all' && String(job.companyId) !== filters.companyId) return false;
      if (filters.storeId !== 'all' && String(job.storeId ?? '') !== filters.storeId) return false;
      if (filters.jobType !== 'all' && job.jobType !== filters.jobType) return false;
      if (filters.remoteType !== 'all' && job.remoteType !== filters.remoteType) return false;
      if (filters.language !== 'all' && job.language !== filters.language) return false;
      if (filters.status !== 'all' && job.status !== filters.status) return false;

      if (salaryMin !== null && Number.isFinite(salaryMin)) {
        const compare = job.salaryMin ?? job.salaryMax;
        if (compare === null || compare < salaryMin) return false;
      }

      if (salaryMax !== null && Number.isFinite(salaryMax)) {
        const compare = job.salaryMax ?? job.salaryMin;
        if (compare === null || compare > salaryMax) return false;
      }

      if (!query) return true;
      const haystack = [job.title, job.description ?? '', job.companyName, job.storeName ?? '', job.tags.join(' ')]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });

    return list.sort((a, b) => {
      if (filters.sort === 'salary_high') {
        const aSalary = a.salaryMax ?? a.salaryMin ?? -1;
        const bSalary = b.salaryMax ?? b.salaryMin ?? -1;
        return bSalary - aSalary;
      }

      if (filters.sort === 'salary_low') {
        const aSalary = a.salaryMin ?? a.salaryMax ?? Number.MAX_SAFE_INTEGER;
        const bSalary = b.salaryMin ?? b.salaryMax ?? Number.MAX_SAFE_INTEGER;
        return aSalary - bSalary;
      }

      const bTime = new Date(b.publishedAt ?? b.createdAt).getTime();
      const aTime = new Date(a.publishedAt ?? a.createdAt).getTime();
      if (filters.sort === 'oldest') return aTime - bTime;
      return bTime - aTime;
    });
  }, [jobs, filters]);

  const remoteRoles = useMemo(() => jobs.filter((job) => job.remoteType === 'remote').length, [jobs]);

  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).reduce((count, [key, value]) => {
      const defaultValue = DEFAULT_FILTERS[key as keyof CareersFilters];
      return value !== defaultValue ? count + 1 : count;
    }, 0);
  }, [filters]);

  const resetDraftFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
  };

  const applyDraftFilters = () => {
    setFilters(draftFilters);
    setShowFilterModal(false);
  };

  const toggleLike = (jobId: number) => {
    setLikedJobs((prev) => ({ ...prev, [jobId]: !prev[jobId] }));
  };

  const toggleSave = (jobId: number) => {
    setSavedJobs((prev) => ({ ...prev, [jobId]: !prev[jobId] }));
  };

  return (
    <div className="careers-shell">
      <section className="careers-hero">
        <div className="careers-hero-inner">
          <div className="careers-top-actions">
            <span className="careers-kicker">{copy.kicker}</span>
            <div className="careers-top-actions-right">
              <LanguageSwitcher />
            </div>
          </div>

          <h1 className="careers-title">{copy.title}</h1>
          <p className="careers-subtitle">{copy.subtitle}</p>

          <div className="careers-stat-grid">
            <article className="careers-stat-card"><BriefcaseBusiness size={18} /><div><strong>{jobs.length}</strong><span>{copy.openRoles}</span></div></article>
            <article className="careers-stat-card"><Building2 size={18} /><div><strong>{companies.length}</strong><span>{copy.activeCompanies}</span></div></article>
            <article className="careers-stat-card"><StoreIcon size={18} /><div><strong>{stores.length}</strong><span>{copy.stores}</span></div></article>
            <article className="careers-stat-card"><Globe2 size={18} /><div><strong>{remoteRoles}</strong><span>{copy.fullyRemoteRoles}</span></div></article>
          </div>
        </div>
      </section>

      <section className="careers-content">
        <div className="careers-filter-panel">
          <div className="careers-filter-header">
            <div>
              <h2>{copy.findYourMatch}</h2>
              <p>{copy.searchHint}</p>
            </div>
            <div className="careers-filter-actions">
              {activeFiltersCount > 0 && (
                <button className="careers-reset-btn" type="button" onClick={() => setFilters(DEFAULT_FILTERS)}>
                  {copy.clearAllFilters}
                </button>
              )}
            </div>
          </div>

          <div className="careers-search-toolbar">
            <label className="careers-search-inline">
              <Search size={15} />
              <input
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                placeholder={copy.searchPlaceholder}
              />
            </label>
            <button className="careers-filter-open-btn" type="button" onClick={() => { setDraftFilters(filters); setShowFilterModal(true); }}>
              <SlidersHorizontal size={15} /> {copy.filters}
              {activeFiltersCount > 0 && <span>{activeFiltersCount}</span>}
            </button>
          </div>

          <div className="careers-filter-active-row">
            <span><SlidersHorizontal size={12} /> {copy.findYourMatch}</span>
            <strong>{activeFiltersCount > 0 ? `${activeFiltersCount} ${copy.activeFilters}` : copy.latestJobs}</strong>
          </div>
        </div>

        {loading && <div className="careers-empty">{copy.loadingOpenPositions}</div>}
        {!loading && hasError && <div className="careers-empty error">{copy.loadError}</div>}

        {!loading && !hasError && filteredJobs.length === 0 && (
          <div className="careers-empty">{copy.noPositions}</div>
        )}

        {!loading && !hasError && filteredJobs.length > 0 && (
          <div className="careers-jobs-grid">
            {filteredJobs.map((job) => {
              const company = companyById.get(job.companyId);
              const logoUrl = getCompanyLogoUrl(company?.logoFilename ?? job.companyLogoFilename);
              const city = job.location.city ?? job.storeName ?? copy.flexible;
              const detailUrl = job.companySlug
                ? `/careers/${encodeURIComponent(job.companySlug)}/jobs/${job.id}`
                : `/careers/jobs/${job.id}`;
              const typeLabel = JOB_TYPE_LABEL[uiLanguage][job.jobType] ?? job.jobType;
              const remoteTypeLabel = REMOTE_TYPE_LABEL[uiLanguage][job.remoteType] ?? job.remoteType;
              const languageLabel = formatLanguageWithFlag(job.language, copy.italian, copy.english);
              const postedDate = job.publishedAt ?? job.createdAt;
              const postedLabel = formatTimeAgo(postedDate, uiLanguage, copy.postedAgo);
              const salaryLabel = formatSalary(job, locale, copy.notSpecified, copy.upTo);
              const isLiked = Boolean(likedJobs[job.id]);
              const isSaved = Boolean(savedJobs[job.id]);
              const statusLabel = job.status === 'closed' ? copy.statusClosed : copy.statusPublished;

              return (
                <article key={job.id} className="careers-job-card">
                  <div className="careers-job-head-row">
                    <div className="careers-company-pill">
                      <div className="careers-company-logo">
                        {logoUrl ? <img src={logoUrl} alt={job.companyName} /> : <span>{initials(job.companyName)}</span>}
                      </div>
                      <div>
                        <strong>{job.companyName}</strong>
                        <span>{company?.groupName ?? copy.independentCompany}</span>
                      </div>
                    </div>
                    <div className="careers-job-head-right">
                      <div className="careers-job-time-badge">
                        <CalendarClock size={12} />
                        {postedLabel}
                      </div>
                      <div className="careers-job-applied-badge">{job.applicantsCount ?? 0} {copy.appliedShort}</div>
                    </div>
                  </div>

                  <h3>{job.title}</h3>
                  <p className="careers-job-description">{summarize(job.description)}</p>

                  <div className="careers-job-meta">
                    <span>{typeLabel}</span>
                    <span>{remoteTypeLabel}</span>
                    <span><MapPin size={12} style={{ marginRight: 4 }} />{city}</span>
                    <span className={job.status === 'closed' ? 'careers-status-chip closed' : 'careers-status-chip'}>{statusLabel}</span>
                  </div>

                  <div className="careers-job-extra-grid">
                    <div>
                      <strong>{copy.posted}</strong>
                      <span>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(postedDate ?? job.createdAt))}</span>
                    </div>
                    <div>
                      <strong><Wallet size={12} /> {copy.salary}</strong>
                      <span>{salaryLabel}</span>
                    </div>
                    <div>
                      <strong>{copy.language}</strong>
                      <span>{languageLabel}</span>
                    </div>
                  </div>

                  <div className="careers-job-footer">
                    <div className="careers-job-tags">
                      {job.tags.slice(0, 3).map((tag) => <span key={`${job.id}-${tag}`}>{tag}</span>)}
                      {job.tags.length === 0 && <span>{job.department ?? copy.generalHiring}</span>}
                    </div>
                    <div className="careers-job-actions">
                      <button
                        type="button"
                        className={`careers-icon-btn like ${isLiked ? 'active' : ''}`}
                        onClick={() => toggleLike(job.id)}
                        aria-label="Like job"
                      >
                        <Heart size={15} />
                      </button>
                      <button
                        type="button"
                        className={`careers-icon-btn save ${isSaved ? 'active' : ''}`}
                        onClick={() => toggleSave(job.id)}
                        aria-label="Save job"
                      >
                        <Bookmark size={15} />
                      </button>
                      <Link to={detailUrl} className="careers-view-details-link">{copy.viewDetails} <ArrowRight size={15} /></Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {showFilterModal && (
        <div className="careers-filter-modal-backdrop" onClick={() => setShowFilterModal(false)}>
          <div className="careers-filter-modal" onClick={(event) => event.stopPropagation()}>
            <div className="careers-filter-modal-header">
              <div>
                <h3>{copy.filters}</h3>
                <p>{copy.searchHint}</p>
              </div>
              <button type="button" onClick={() => setShowFilterModal(false)} aria-label="Close filters">
                <X size={18} />
              </button>
            </div>

            <div className="careers-filter-modal-grid">
              <label className="careers-filter-field">
                <span>{copy.searchLabel}</span>
                <input
                  value={draftFilters.search}
                  onChange={(event) => setDraftFilters((prev) => ({ ...prev, search: event.target.value }))}
                  placeholder={copy.searchPlaceholder}
                />
              </label>

              <label className="careers-filter-field">
                <span>{copy.sortLabel}</span>
                <select
                  value={draftFilters.sort}
                  onChange={(event) => setDraftFilters((prev) => ({ ...prev, sort: event.target.value as SortMode }))}
                >
                  <option value="latest">{copy.latestJobs}</option>
                  <option value="oldest">{copy.oldestJobs}</option>
                  <option value="salary_high">{copy.salaryHigh}</option>
                  <option value="salary_low">{copy.salaryLow}</option>
                </select>
              </label>

              <label className="careers-filter-field">
                <span>{copy.companyLabel}</span>
                <select
                  value={draftFilters.companyId}
                  onChange={(event) => setDraftFilters((prev) => ({ ...prev, companyId: event.target.value }))}
                >
                  <option value="all">{copy.allCompanies}</option>
                  {companies.map((company) => (
                    <option key={company.id} value={String(company.id)}>{company.name}</option>
                  ))}
                </select>
              </label>

              <label className="careers-filter-field">
                <span>{copy.storeLabel}</span>
                <select
                  value={draftFilters.storeId}
                  onChange={(event) => setDraftFilters((prev) => ({ ...prev, storeId: event.target.value }))}
                >
                  <option value="all">{copy.allStores}</option>
                  {stores
                    .filter((store) => draftFilters.companyId === 'all' || String(store.companyId) === draftFilters.companyId)
                    .map((store) => (
                      <option key={store.id} value={String(store.id)}>{store.name}</option>
                    ))}
                </select>
              </label>

              <label className="careers-filter-field">
                <span>{copy.statusLabel}</span>
                <select
                  value={draftFilters.status}
                  onChange={(event) => setDraftFilters((prev) => ({ ...prev, status: event.target.value }))}
                >
                  <option value="all">{copy.allStatuses}</option>
                  <option value="published">{copy.statusPublished}</option>
                  <option value="closed">{copy.statusClosed}</option>
                </select>
              </label>

              <label className="careers-filter-field">
                <span>{copy.jobType}</span>
                <select
                  value={draftFilters.jobType}
                  onChange={(event) => setDraftFilters((prev) => ({ ...prev, jobType: event.target.value }))}
                >
                  <option value="all">{copy.allStatuses}</option>
                  <option value="fulltime">{JOB_TYPE_LABEL[uiLanguage].fulltime}</option>
                  <option value="parttime">{JOB_TYPE_LABEL[uiLanguage].parttime}</option>
                  <option value="contract">{JOB_TYPE_LABEL[uiLanguage].contract}</option>
                  <option value="internship">{JOB_TYPE_LABEL[uiLanguage].internship}</option>
                </select>
              </label>

              <label className="careers-filter-field">
                <span>{copy.remoteType}</span>
                <select
                  value={draftFilters.remoteType}
                  onChange={(event) => setDraftFilters((prev) => ({ ...prev, remoteType: event.target.value }))}
                >
                  <option value="all">{copy.allStatuses}</option>
                  <option value="onsite">{REMOTE_TYPE_LABEL[uiLanguage].onsite}</option>
                  <option value="hybrid">{REMOTE_TYPE_LABEL[uiLanguage].hybrid}</option>
                  <option value="remote">{REMOTE_TYPE_LABEL[uiLanguage].remote}</option>
                </select>
              </label>

              <label className="careers-filter-field">
                <span>{copy.language}</span>
                <select
                  value={draftFilters.language}
                  onChange={(event) => setDraftFilters((prev) => ({ ...prev, language: event.target.value }))}
                >
                  <option value="all">{copy.allStatuses}</option>
                  <option value="it">{copy.italian}</option>
                  <option value="en">{copy.english}</option>
                  <option value="both">IT + EN</option>
                </select>
              </label>

              <label className="careers-filter-field">
                <span>{copy.salaryMinLabel}</span>
                <input
                  type="number"
                  value={draftFilters.salaryMin}
                  onChange={(event) => setDraftFilters((prev) => ({ ...prev, salaryMin: event.target.value }))}
                  placeholder="1200"
                />
              </label>

              <label className="careers-filter-field">
                <span>{copy.salaryMaxLabel}</span>
                <input
                  type="number"
                  value={draftFilters.salaryMax}
                  onChange={(event) => setDraftFilters((prev) => ({ ...prev, salaryMax: event.target.value }))}
                  placeholder="2800"
                />
              </label>
            </div>

            <div className="careers-filter-modal-footer">
              <button type="button" className="careers-reset-btn" onClick={resetDraftFilters}>{copy.resetFilters}</button>
              <button type="button" className="careers-apply-btn" onClick={applyDraftFilters}>
                <BadgeCheck size={14} /> {copy.applyFilters}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
