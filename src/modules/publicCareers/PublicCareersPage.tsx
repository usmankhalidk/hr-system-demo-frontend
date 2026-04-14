import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BriefcaseBusiness, Building2, Globe2, MapPin, Search, Store as StoreIcon } from 'lucide-react';
import { getCompanyLogoUrl } from '../../api/client';
import { getPublicJobsCatalog, PublicCompany, PublicJob, PublicStoreOption } from '../../api/publicCareers';
import { LanguageSwitcher } from '../../components/ui/LanguageSwitcher';
import './publicCareers.css';

type UiLanguage = 'it' | 'en';

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
  hrLogin: string;
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
}> = {
  en: {
    kicker: 'Public Careers',
    hrLogin: 'HR Login',
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
  },
  it: {
    kicker: 'Careers Pubbliche',
    hrLogin: 'Login HR',
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
  const { i18n } = useTranslation();
  const uiLanguage: UiLanguage = i18n.language?.toLowerCase().startsWith('it') ? 'it' : 'en';
  const copy = COPY[uiLanguage];
  const locale = uiLanguage === 'it' ? 'it-IT' : 'en-US';

  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [companies, setCompanies] = useState<PublicCompany[]>([]);
  const [stores, setStores] = useState<PublicStoreOption[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    setHasError(false);
    getPublicJobsCatalog()
      .then((data) => {
        setJobs(data.jobs);
        setCompanies(data.companies);
        setStores(data.stores);
      })
      .catch(() => {
        setHasError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const companyById = useMemo(() => {
    return new Map(companies.map((company) => [company.id, company]));
  }, [companies]);

  const filteredJobs = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    const list = jobs.filter((job) => {
      if (companyFilter !== 'all' && String(job.companyId) !== companyFilter) return false;
      if (!query) return true;
      const haystack = [job.title, job.description ?? '', job.companyName, job.storeName ?? '', job.tags.join(' ')]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });

    return list.sort((a, b) => {
      const bTime = new Date(b.publishedAt ?? b.createdAt).getTime();
      const aTime = new Date(a.publishedAt ?? a.createdAt).getTime();
      return bTime - aTime;
    });
  }, [jobs, searchFilter, companyFilter]);

  const remoteRoles = useMemo(() => jobs.filter((job) => job.remoteType === 'remote').length, [jobs]);

  return (
    <div className="careers-shell">
      <section className="careers-hero">
        <div className="careers-hero-inner">
          <div className="careers-top-actions">
            <span className="careers-kicker">{copy.kicker}</span>
            <div className="careers-top-actions-right">
              <LanguageSwitcher />
              <Link className="careers-login-link" to="/login">{copy.hrLogin}</Link>
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
          </div>

          <div className="careers-filter-grid">
            <label className="careers-filter-field">
              <span><Search size={14} /> {copy.searchLabel}</span>
              <input value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} placeholder={copy.searchPlaceholder} />
            </label>

            <label className="careers-filter-field">
              <span><Building2 size={14} /> {copy.companyLabel}</span>
              <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)}>
                <option value="all">{copy.allCompanies}</option>
                {companies.map((company) => (
                  <option key={company.id} value={String(company.id)}>{company.name}</option>
                ))}
              </select>
            </label>
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
              const detailUrl = `/careers/jobs/${job.id}${job.companySlug ? `?company_slug=${encodeURIComponent(job.companySlug)}` : ''}`;
              const typeLabel = JOB_TYPE_LABEL[uiLanguage][job.jobType] ?? job.jobType;
              const remoteTypeLabel = REMOTE_TYPE_LABEL[uiLanguage][job.remoteType] ?? job.remoteType;
              const languageLabel = job.language === 'it' ? copy.italian : copy.english;
              const postedDate = job.publishedAt ?? job.createdAt;
              const postedLabel = postedDate
                ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(postedDate))
                : copy.notSpecified;
              const salaryLabel = formatSalary(job, locale, copy.notSpecified, copy.upTo);

              return (
                <article key={job.id} className="careers-job-card">
                  <div className="careers-company-pill">
                    <div className="careers-company-logo">
                      {logoUrl ? <img src={logoUrl} alt={job.companyName} /> : <span>{initials(job.companyName)}</span>}
                    </div>
                    <div>
                      <strong>{job.companyName}</strong>
                      <span>{company?.groupName ?? copy.independentCompany}</span>
                    </div>
                  </div>

                  <h3>{job.title}</h3>

                  <div className="careers-job-meta">
                    <span>{typeLabel}</span>
                    <span>{remoteTypeLabel}</span>
                    <span><MapPin size={12} style={{ marginRight: 4 }} />{city}</span>
                  </div>

                  <div className="careers-job-extra-grid">
                    <div>
                      <strong>{copy.posted}</strong>
                      <span>{postedLabel}</span>
                    </div>
                    <div>
                      <strong>{copy.salary}</strong>
                      <span>{salaryLabel}</span>
                    </div>
                    <div>
                      <strong>{copy.language}</strong>
                      <span>{languageLabel}</span>
                    </div>
                  </div>

                  {job.description && <p>{summarize(job.description)}</p>}

                  <div className="careers-job-footer">
                    <div className="careers-job-tags">
                      {job.tags.slice(0, 3).map((tag) => <span key={`${job.id}-${tag}`}>{tag}</span>)}
                      {job.tags.length === 0 && <span>{job.department ?? copy.generalHiring}</span>}
                    </div>
                    <Link to={detailUrl} className="careers-apply-btn">{copy.viewDetails} <ArrowRight size={15} /></Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
