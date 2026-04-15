import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Bookmark,
  Building2,
  CalendarDays,
  Heart,
  Languages,
  MapPin,
  MessageSquare,
  Reply,
  Send,
  Store as StoreIcon,
  User2,
  Users,
} from 'lucide-react';
import {
  applyToPublicJob,
  getPublicJobDetail,
  PublicHiringContact,
  PublicJob,
} from '../../api/publicCareers';
import {
  getAvatarUrl,
  getCompanyBannerUrl,
  getCompanyLogoUrl,
  getStoreLogoUrl,
} from '../../api/client';
import { LanguageSwitcher } from '../../components/ui/LanguageSwitcher';
import { useAuth } from '../../context/AuthContext';
import './publicCareers.css';

type UiLanguage = 'it' | 'en';

const TYPE_LABEL: Record<UiLanguage, Record<string, string>> = {
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

const REMOTE_LABEL: Record<UiLanguage, Record<string, string>> = {
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

const ROLE_LABEL: Record<UiLanguage, Record<string, string>> = {
  en: {
    admin: 'System Admin',
    hr: 'HR Lead',
    area_manager: 'Area Manager',
    store_manager: 'Store Manager',
  },
  it: {
    admin: 'Amministratore',
    hr: 'Responsabile HR',
    area_manager: 'Area Manager',
    store_manager: 'Responsabile Negozio',
  },
};

const COPY: Record<UiLanguage, {
  missingJobId: string;
  invalidJobId: string;
  loadJobError: string;
  loadingPosition: string;
  jobNotFound: string;
  backToCareers: string;
  backToAllPositions: string;
  independentCompany: string;
  generalHiring: string;
  applyNow: string;
  roleOverview: string;
  languageWarning: string;
  noDescription: string;
  communityTitle: string;
  communitySubtitle: string;
  saved: string;
  save: string;
  like: string;
  comments: string;
  interactionsLoginNote: string;
  loginUnlock: string;
  askHiringTeam: string;
  postComment: string;
  reply: string;
  writeReply: string;
  sendReply: string;
  applyTitle: string;
  applySubtitle: string;
  fullNamePlaceholder: string;
  emailPlaceholder: string;
  phonePlaceholder: string;
  linkedinPlaceholder: string;
  coverLetterPlaceholder: string;
  cvLabel: string;
  privacyConsent: string;
  submitting: string;
  submitApplication: string;
  roleFacts: string;
  posted: string;
  contract: string;
  weeklyHours: string;
  salaryRange: string;
  department: string;
  language: string;
  remoteType: string;
  companySnapshot: string;
  company: string;
  group: string;
  openRoles: string;
  profile: string;
  owner: string;
  storeContext: string;
  assignedStore: string;
  storeCodeNotSet: string;
  teamSize: string;
  location: string;
  hiringTeam: string;
  postingOwner: string;
  noHiringContacts: string;
  securityTitle: string;
  submittedAt: string;
  destination: string;
  visibility: string;
  duplicateCheck: string;
  realtimeSync: string;
  visibilityText: string;
  duplicateCheckText: string;
  notSpecified: string;
  general: string;
  recruitingTeam: string;
  recruiting: string;
  attachCvError: string;
  invalidCvFormatError: string;
  cvSizeError: string;
  privacyRequiredError: string;
  coverLetterTooLongError: string;
  submitError: string;
  positionClosedNotice: string;
  saveAction: string;
  likeAction: string;
  commentAction: string;
  replyAction: string;
  loginToActionPrefix: string;
  loginToActionSuffix: string;
}> = {
  en: {
    missingJobId: 'Missing job identifier in URL.',
    invalidJobId: 'Invalid job identifier.',
    loadJobError: 'We could not load this job posting.',
    loadingPosition: 'Loading position...',
    jobNotFound: 'Job not found.',
    backToCareers: 'Back to careers',
    backToAllPositions: 'Back to all positions',
    independentCompany: 'Independent company',
    generalHiring: 'General hiring',
    applyNow: 'Apply now',
    roleOverview: 'Role overview',
    languageWarning: 'This posting is primarily in Italian. Please switch language if needed while applying.',
    noDescription: 'No additional description provided.',
    communityTitle: 'Community activity',
    communitySubtitle: 'Save this role, like updates, and join the thread with your questions.',
    saved: 'Saved',
    save: 'Save',
    like: 'Like',
    comments: 'Comments',
    interactionsLoginNote: 'Interactions are available for signed-in users. You can still apply without logging in.',
    loginUnlock: 'Login to unlock save, likes, and threaded replies',
    askHiringTeam: 'Ask a question to the hiring team',
    postComment: 'Post comment',
    reply: 'Reply',
    writeReply: 'Write a reply',
    sendReply: 'Send reply',
    applyTitle: 'Apply for this role',
    applySubtitle: 'Submit your profile directly to the recruiting team.',
    fullNamePlaceholder: 'Full name',
    emailPlaceholder: 'Email address',
    phonePlaceholder: 'Phone number (optional)',
    linkedinPlaceholder: 'LinkedIn URL (optional)',
    coverLetterPlaceholder: 'Cover letter (optional)',
    cvLabel: 'CV/Resume (PDF, DOC, DOCX, max 5MB) *',
    privacyConsent: 'I consent to processing of my personal data',
    submitting: 'Submitting...',
    submitApplication: 'Submit application',
    roleFacts: 'Role facts',
    posted: 'Posted',
    contract: 'Contract',
    weeklyHours: 'Weekly hours',
    salaryRange: 'Salary range',
    department: 'Department',
    language: 'Language',
    remoteType: 'Remote type',
    companySnapshot: 'Company snapshot',
    company: 'Company',
    group: 'Group',
    openRoles: 'Open roles',
    profile: 'Profile',
    owner: 'Owner',
    storeContext: 'Store context',
    assignedStore: 'Assigned store',
    storeCodeNotSet: 'Store code not set',
    teamSize: 'Team size',
    location: 'Location',
    hiringTeam: 'Hiring team',
    postingOwner: 'posting owner',
    noHiringContacts: 'No specific hiring contacts configured yet.',
    securityTitle: 'Application security',
    submittedAt: 'Submitted at',
    destination: 'Destination',
    visibility: 'Visibility',
    duplicateCheck: 'Duplicate check',
    realtimeSync: 'Real-time ATS sync',
    visibilityText: 'HR and managers only',
    duplicateCheckText: 'Email-based protection',
    notSpecified: '-',
    general: 'General',
    recruitingTeam: 'Recruiting Team',
    recruiting: 'Recruiting',
    attachCvError: 'Please attach your CV before submitting.',
    invalidCvFormatError: 'Supported file formats: PDF, DOC, DOCX.',
    cvSizeError: 'The CV file size must be 5MB or less.',
    privacyRequiredError: 'You must accept the privacy notice to submit your application.',
    coverLetterTooLongError: 'Cover letter must be 1000 characters or less.',
    submitError: 'Unable to submit your application right now.',
    positionClosedNotice: 'This position is currently closed and no longer accepting new applications.',
    saveAction: 'save this role',
    likeAction: 'like this role',
    commentAction: 'comment on this role',
    replyAction: 'reply in discussion',
    loginToActionPrefix: 'Please login to',
    loginToActionSuffix: 'You can still read this role and submit the application form.',
  },
  it: {
    missingJobId: 'ID posizione mancante nell\'URL.',
    invalidJobId: 'ID posizione non valido.',
    loadJobError: 'Impossibile caricare questo annuncio.',
    loadingPosition: 'Caricamento posizione...',
    jobNotFound: 'Posizione non trovata.',
    backToCareers: 'Torna alle careers',
    backToAllPositions: 'Torna a tutte le posizioni',
    independentCompany: 'Azienda indipendente',
    generalHiring: 'Assunzione generale',
    applyNow: 'Candidati ora',
    roleOverview: 'Panoramica ruolo',
    languageWarning: 'Questo annuncio è principalmente in italiano. Cambia lingua se necessario durante la candidatura.',
    noDescription: 'Nessuna descrizione aggiuntiva disponibile.',
    communityTitle: 'Attività community',
    communitySubtitle: 'Salva questo ruolo, metti like agli aggiornamenti e partecipa alla discussione con le tue domande.',
    saved: 'Salvato',
    save: 'Salva',
    like: 'Mi piace',
    comments: 'Commenti',
    interactionsLoginNote: 'Le interazioni sono disponibili per utenti autenticati. Puoi comunque candidarti senza login.',
    loginUnlock: 'Accedi per sbloccare salvataggi, like e risposte in thread',
    askHiringTeam: 'Fai una domanda al team di selezione',
    postComment: 'Pubblica commento',
    reply: 'Rispondi',
    writeReply: 'Scrivi una risposta',
    sendReply: 'Invia risposta',
    applyTitle: 'Candidati a questo ruolo',
    applySubtitle: 'Invia il tuo profilo direttamente al team recruiting.',
    fullNamePlaceholder: 'Nome e cognome',
    emailPlaceholder: 'Indirizzo email',
    phonePlaceholder: 'Numero di telefono (opzionale)',
    linkedinPlaceholder: 'URL LinkedIn (opzionale)',
    coverLetterPlaceholder: 'Lettera di presentazione (opzionale)',
    cvLabel: 'CV (PDF, DOC, DOCX, max 5MB) *',
    privacyConsent: 'Acconsento al trattamento dei miei dati personali',
    submitting: 'Invio in corso...',
    submitApplication: 'Invia candidatura',
    roleFacts: 'Dettagli ruolo',
    posted: 'Pubblicato',
    contract: 'Contratto',
    weeklyHours: 'Ore settimanali',
    salaryRange: 'Range retributivo',
    department: 'Dipartimento',
    language: 'Lingua',
    remoteType: 'Modalità lavoro',
    companySnapshot: 'Profilo azienda',
    company: 'Azienda',
    group: 'Gruppo',
    openRoles: 'Posizioni aperte',
    profile: 'Profilo',
    owner: 'Proprietario',
    storeContext: 'Contesto negozio',
    assignedStore: 'Negozio assegnato',
    storeCodeNotSet: 'Codice negozio non impostato',
    teamSize: 'Dimensione team',
    location: 'Posizione',
    hiringTeam: 'Team di selezione',
    postingOwner: 'responsabile annuncio',
    noHiringContacts: 'Nessun contatto recruiting configurato al momento.',
    securityTitle: 'Sicurezza candidatura',
    submittedAt: 'Inviata il',
    destination: 'Destinazione',
    visibility: 'Visibilità',
    duplicateCheck: 'Controllo duplicati',
    realtimeSync: 'Sincronizzazione ATS in tempo reale',
    visibilityText: 'Solo HR e manager',
    duplicateCheckText: 'Protezione basata su email',
    notSpecified: '-',
    general: 'Generale',
    recruitingTeam: 'Team Recruiting',
    recruiting: 'Recruiting',
    attachCvError: 'Allega il tuo CV prima dell\'invio.',
    invalidCvFormatError: 'Formati supportati: PDF, DOC, DOCX.',
    cvSizeError: 'La dimensione del CV deve essere massimo 5MB.',
    privacyRequiredError: 'Devi accettare l\'informativa privacy per inviare la candidatura.',
    coverLetterTooLongError: 'La lettera di presentazione deve essere massimo 1000 caratteri.',
    submitError: 'Impossibile inviare la candidatura in questo momento.',
    positionClosedNotice: 'Questa posizione e chiusa e non accetta nuove candidature.',
    saveAction: 'salvare questo ruolo',
    likeAction: 'mettere like a questo ruolo',
    commentAction: 'commentare questo ruolo',
    replyAction: 'rispondere nella discussione',
    loginToActionPrefix: 'Effettua il login per',
    loginToActionSuffix: 'Puoi comunque leggere il ruolo e inviare la candidatura.',
  },
};

interface CommentReply {
  id: number;
  author: string;
  message: string;
  createdAt: string;
}

interface CommunityComment {
  id: number;
  author: string;
  role: string;
  message: string;
  createdAt: string;
  replies: CommentReply[];
}

function toInitials(value: string): string {
  return value
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatPersonName(contact: PublicHiringContact): string {
  return `${contact.name} ${contact.surname ?? ''}`.trim();
}

function formatRole(role: string, uiLanguage: UiLanguage): string {
  return ROLE_LABEL[uiLanguage][role] ?? role.replace(/_/g, ' ');
}

function formatLocation(job: PublicJob, remoteLabel: string): string {
  const parts = [job.location.address, job.location.city, job.location.state, job.location.postalCode, job.location.country]
    .filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : remoteLabel;
}

function formatSalary(value: number | null, uiLanguage: UiLanguage): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat(uiLanguage === 'it' ? 'it-IT' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null, uiLanguage: UiLanguage, fallback?: string): string {
  return new Date(value ?? fallback ?? '').toLocaleDateString(uiLanguage === 'it' ? 'it-IT' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function PublicJobDetailPage() {
  const { i18n } = useTranslation();
  const uiLanguage: UiLanguage = i18n.language?.startsWith('it') ? 'it' : 'en';
  const copy = COPY[uiLanguage];

  const { jobId, companySlug } = useParams<{ jobId?: string; companySlug?: string }>();
  const legacyCompanySlug = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('company_slug');
    return slug && slug.trim() !== '' ? slug : undefined;
  }, []);
  const effectiveCompanySlug = companySlug ?? legacyCompanySlug;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<PublicJob | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyMeta, setCompanyMeta] = useState<{
    slug: string;
    groupName: string | null;
    logoFilename: string | null;
    bannerFilename: string | null;
    ownerName: string | null;
    ownerSurname: string | null;
    ownerAvatarFilename: string | null;
    openRolesCount: number;
  } | null>(null);
  const [hiringTeam, setHiringTeam] = useState<PublicHiringContact[]>([]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [resume, setResume] = useState<File | null>(null);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [communityNotice, setCommunityNotice] = useState<string | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [openReplyBox, setOpenReplyBox] = useState<number | null>(null);

  useEffect(() => {
    if (!jobId) {
      setError(copy.missingJobId);
      setLoading(false);
      return;
    }

    const parsedJobId = Number.parseInt(jobId, 10);
    if (Number.isNaN(parsedJobId)) {
      setError(copy.invalidJobId);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getPublicJobDetail(parsedJobId, effectiveCompanySlug)
      .then((data) => {
        setCompanyName(data.company.name);
        setCompanyMeta({
          slug: data.company.slug,
          groupName: data.company.groupName ?? null,
          logoFilename: data.company.logoFilename ?? null,
          bannerFilename: data.company.bannerFilename ?? null,
          ownerName: data.company.ownerName ?? null,
          ownerSurname: data.company.ownerSurname ?? null,
          ownerAvatarFilename: data.company.ownerAvatarFilename ?? null,
          openRolesCount: data.company.openRolesCount ?? 0,
        });
        setJob(data.job);
        setHiringTeam(data.hiringTeam ?? []);
        setLikesCount(14 + (parsedJobId % 9));
      })
      .catch(() => {
        setError(copy.loadJobError);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [jobId, effectiveCompanySlug, copy.invalidJobId, copy.loadJobError, copy.missingJobId]);

  const browserLanguage = useMemo(() => {
    return navigator.language.toLowerCase().startsWith('it') ? 'it' : 'en';
  }, []);

  const utmSource = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('utm_source') ?? undefined;
  }, []);

  const formLanguage = job?.language === 'en' ? 'en' : 'it';
  const languageMismatch = !!job && job.language === 'it' && browserLanguage === 'en';
  const companyLogoUrl = getCompanyLogoUrl(companyMeta?.logoFilename ?? job?.companyLogoFilename);
  const companyBannerUrl = getCompanyBannerUrl(companyMeta?.bannerFilename ?? job?.companyBannerFilename);
  const storeLogoUrl = getStoreLogoUrl(job?.storeLogoFilename);
  const remoteFallback = uiLanguage === 'it' ? 'Remoto / Flessibile' : 'Remote / Flexible';
  const fallbackBackPath = effectiveCompanySlug ? `/careers/${encodeURIComponent(effectiveCompanySlug)}` : '/careers';
  const careersBackPath = companyMeta?.slug
    ? `/careers/${encodeURIComponent(companyMeta.slug)}`
    : fallbackBackPath;
  const isJobClosed = job?.status === 'closed';

  useEffect(() => {
    if (!job) return;

    const lead = job.postedBy ?? hiringTeam[0] ?? null;
    const author = lead ? formatPersonName(lead) : `${companyName} ${copy.recruitingTeam}`;
    const role = lead ? formatRole(lead.role, uiLanguage) : copy.recruiting;

    setComments([
      {
        id: 1,
        author,
        role,
        message: formLanguage === 'it'
          ? 'Grazie per il tuo interesse. Stiamo cercando profili che possano crescere con il team nel breve periodo.'
          : 'Thanks for your interest. We are looking for candidates who can grow quickly with this team.',
        createdAt: new Date().toISOString(),
        replies: [],
      },
    ]);
    setReplyDrafts({});
    setOpenReplyBox(null);
  }, [job?.id, hiringTeam, companyName, formLanguage, copy.recruiting, copy.recruitingTeam, uiLanguage]);

  const ensureAuthenticated = (action: string): boolean => {
    if (user) {
      setCommunityNotice(null);
      return true;
    }

    setCommunityNotice(`${copy.loginToActionPrefix} ${action}. ${copy.loginToActionSuffix}`);
    return false;
  };

  const toggleSaved = () => {
    if (!ensureAuthenticated(copy.saveAction)) return;
    setSaved((prev) => !prev);
  };

  const toggleLiked = () => {
    if (!ensureAuthenticated(copy.likeAction)) return;
    setLiked((prev) => {
      if (prev) setLikesCount((count) => Math.max(0, count - 1));
      else setLikesCount((count) => count + 1);
      return !prev;
    });
  };

  const addComment = () => {
    if (!ensureAuthenticated(copy.commentAction)) return;

    const message = commentDraft.trim();
    if (!message) return;

    const author = `${user?.name ?? 'User'} ${user?.surname ?? ''}`.trim();
    const role = user?.role ? user.role.replace(/_/g, ' ') : 'employee';

    const nextComment: CommunityComment = {
      id: Date.now(),
      author,
      role,
      message,
      createdAt: new Date().toISOString(),
      replies: [],
    };

    setComments((prev) => [nextComment, ...prev]);
    setCommentDraft('');
  };

  const addReply = (commentId: number) => {
    if (!ensureAuthenticated(copy.replyAction)) return;

    const message = (replyDrafts[commentId] ?? '').trim();
    if (!message) return;

    const author = `${user?.name ?? 'User'} ${user?.surname ?? ''}`.trim();

    setComments((prev) => prev.map((comment) => {
      if (comment.id !== commentId) return comment;
      const reply: CommentReply = {
        id: Date.now(),
        author,
        message,
        createdAt: new Date().toISOString(),
      };
      return {
        ...comment,
        replies: [...comment.replies, reply],
      };
    }));

    setReplyDrafts((prev) => ({ ...prev, [commentId]: '' }));
    setOpenReplyBox(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!job) return;

    if (job.status === 'closed') {
      setSubmitMessage(copy.positionClosedNotice);
      return;
    }

    if (!resume) {
      setSubmitMessage(copy.attachCvError);
      return;
    }

    if (!/\.(pdf|doc|docx)$/i.test(resume.name)) {
      setSubmitMessage(copy.invalidCvFormatError);
      return;
    }

    if (resume.size > 5 * 1024 * 1024) {
      setSubmitMessage(copy.cvSizeError);
      return;
    }

    if (!agree) {
      setSubmitMessage(copy.privacyRequiredError);
      return;
    }

    if (coverLetter.trim().length > 1000) {
      setSubmitMessage(copy.coverLetterTooLongError);
      return;
    }

    setSubmitting(true);
    setSubmitMessage(null);

    try {
      await applyToPublicJob({
        jobId: job.id,
        fullName,
        email,
        phone: phone || undefined,
        linkedinUrl: linkedinUrl || undefined,
        coverLetter: coverLetter || undefined,
        resume,
        gdprConsent: true,
        applicantLocale: browserLanguage,
        utmSource,
      });

      setSubmitMessage(browserLanguage === 'it'
        ? 'Grazie per la tua candidatura. Ti contatteremo presto.'
        : 'Thank you for applying. We will be in touch soon.');
      setFullName('');
      setEmail('');
      setPhone('');
      setLinkedinUrl('');
      setCoverLetter('');
      setResume(null);
      setAgree(false);
    } catch (err: any) {
      const message = err?.response?.data?.error || copy.submitError;
      setSubmitMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitSuccess = !!submitMessage && (/thank|grazie/i.test(submitMessage));

  if (loading) {
    return (
      <div className="careers-detail-shell">
        <div className="careers-detail-wrapper">
          <div className="careers-empty" style={{ marginTop: 24 }}>{copy.loadingPosition}</div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="careers-detail-shell">
        <div className="careers-detail-wrapper">
          <div className="careers-empty error" style={{ marginTop: 24 }}>{error ?? copy.jobNotFound}</div>
          <Link className="careers-detail-back" to={fallbackBackPath}>
            <ArrowLeft size={14} />
            {copy.backToCareers}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="careers-detail-shell">
      <div className="careers-detail-wrapper">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <Link className="careers-detail-back" to={careersBackPath}>
            <ArrowLeft size={14} />
            {copy.backToAllPositions}
          </Link>
          <LanguageSwitcher variant="pill" />
        </div>

        <section className="careers-detail-hero">
          {companyBannerUrl ? <img src={companyBannerUrl} alt={companyName} /> : <div className="careers-detail-hero-fallback" />}

          <div className="careers-detail-hero-content">
            <div>
              <div className="careers-detail-company-row">
                <div className="careers-detail-company-logo">
                  {companyLogoUrl ? <img src={companyLogoUrl} alt={companyName} /> : <span>{toInitials(companyName)}</span>}
                </div>
                <div>
                  <strong>{companyName}</strong>
                  <span>{companyMeta?.groupName ?? copy.independentCompany}</span>
                </div>
              </div>

              <h1 className="careers-detail-title">{job.title}</h1>

              <div className="careers-detail-meta">
                <span>{TYPE_LABEL[uiLanguage][job.jobType] ?? job.jobType}</span>
                <span>{REMOTE_LABEL[uiLanguage][job.remoteType] ?? job.remoteType}</span>
                <span>{job.language.toUpperCase()}</span>
                <span>{job.department ?? copy.generalHiring}</span>
              </div>
            </div>

            <div className="careers-detail-hero-actions">
              <div className="careers-detail-location">
                <MapPin size={14} />
                {formatLocation(job, remoteFallback)}
              </div>

              {!isJobClosed ? (
                <a className="careers-detail-primary-btn" href="#apply-form">
                  {copy.applyNow}
                  <Send size={14} />
                </a>
              ) : (
                <span className="careers-detail-primary-btn" style={{ opacity: 0.8, cursor: 'default' }}>
                  {copy.positionClosedNotice}
                </span>
              )}
            </div>
          </div>
        </section>

        <div className="careers-detail-grid">
          <div style={{ display: 'grid', gap: 12 }}>
            <section className="careers-detail-card">
              <h2>{copy.roleOverview}</h2>
              {languageMismatch && (
                <div className="careers-warning">
                  {copy.languageWarning}
                </div>
              )}
              <div className="careers-detail-body">{job.description ?? copy.noDescription}</div>
            </section>

            <section className="careers-detail-card">
              <h3>{copy.communityTitle}</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
                {copy.communitySubtitle}
              </p>

              <div className="careers-community-actions">
                <button type="button" className={saved ? 'active' : ''} onClick={toggleSaved}>
                  <Bookmark size={14} />
                  {saved ? copy.saved : copy.save}
                </button>
                <button type="button" className={liked ? 'active' : ''} onClick={toggleLiked}>
                  <Heart size={14} />
                  {copy.like} ({likesCount})
                </button>
                <button type="button" onClick={() => document.getElementById('discussion-box')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                  <MessageSquare size={14} />
                  {copy.comments} ({comments.length})
                </button>
              </div>

              {communityNotice && <div className="careers-community-note">{communityNotice}</div>}

              {!user && (
                <div className="careers-login-gate">
                  <p>{copy.interactionsLoginNote}</p>
                  <Link to="/login">{copy.loginUnlock}</Link>
                </div>
              )}

              <div id="discussion-box" className="careers-comment-box">
                <textarea
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder={copy.askHiringTeam}
                />
                <button type="button" onClick={addComment} disabled={!commentDraft.trim()}>
                  {copy.postComment}
                  <Send size={14} />
                </button>
              </div>

              <div className="careers-discussion-list">
                {comments.map((comment) => (
                  <article key={comment.id} className="careers-discussion-item">
                    <div className="careers-discussion-head">
                      <div>
                        <strong>{comment.author}</strong>
                        <span>{comment.role}</span>
                      </div>
                      <span>{formatDate(comment.createdAt, uiLanguage)}</span>
                    </div>

                    <p className="careers-discussion-message">{comment.message}</p>

                    {comment.replies.length > 0 && (
                      <div className="careers-reply-list">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="careers-reply-item">
                            <strong>{reply.author}</strong> - {reply.message}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="careers-discussion-actions">
                      <button type="button" onClick={() => setOpenReplyBox((prev) => (prev === comment.id ? null : comment.id))}>
                        <Reply size={13} />
                        {copy.reply}
                      </button>
                    </div>

                    {openReplyBox === comment.id && (
                      <div className="careers-reply-box">
                        <textarea
                          value={replyDrafts[comment.id] ?? ''}
                          onChange={(event) => setReplyDrafts((prev) => ({ ...prev, [comment.id]: event.target.value }))}
                          placeholder={copy.writeReply}
                        />
                        <button
                          type="button"
                          onClick={() => addReply(comment.id)}
                          disabled={!(replyDrafts[comment.id] ?? '').trim()}
                        >
                          {copy.sendReply}
                          <Send size={14} />
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <section id="apply-form" className="careers-detail-card">
              <h3>{copy.applyTitle}</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
                {isJobClosed ? copy.positionClosedNotice : copy.applySubtitle}
              </p>

              <form onSubmit={handleSubmit} className="careers-form-grid">
                <div className="careers-form-row">
                  <input
                    className="careers-form-input"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder={copy.fullNamePlaceholder}
                    required
                  />
                  <input
                    className="careers-form-input"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={copy.emailPlaceholder}
                    required
                  />
                </div>

                <div className="careers-form-row">
                  <input
                    className="careers-form-input"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder={copy.phonePlaceholder}
                  />
                  <input
                    className="careers-form-input"
                    type="url"
                    value={linkedinUrl}
                    onChange={(event) => setLinkedinUrl(event.target.value)}
                    placeholder={copy.linkedinPlaceholder}
                  />
                </div>

                <textarea
                  className="careers-form-textarea"
                  value={coverLetter}
                  onChange={(event) => setCoverLetter(event.target.value)}
                  placeholder={copy.coverLetterPlaceholder}
                  maxLength={1000}
                  rows={5}
                />
                <div className="careers-form-help">{coverLetter.length}/1000</div>

                <div style={{ display: 'grid', gap: 6 }}>
                  <label style={{ fontSize: 12.5, color: '#374151', fontWeight: 700 }}>
                    {copy.cvLabel}
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(event) => setResume(event.target.files?.[0] ?? null)}
                    required
                  />
                </div>

                <label className="careers-checkbox">
                  <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
                  {copy.privacyConsent}
                </label>

                {submitMessage && (
                  <div className={`careers-submit-message ${submitSuccess ? 'success' : ''}`}>
                    {submitMessage}
                  </div>
                )}

                <button type="submit" className="careers-form-submit" disabled={submitting || isJobClosed}>
                  {submitting ? copy.submitting : copy.submitApplication}
                </button>
              </form>
            </section>
          </div>

          <aside style={{ display: 'grid', gap: 12, alignSelf: 'start' }}>
            <section className="careers-detail-card">
              <h3>{copy.roleFacts}</h3>
              <div className="careers-facts-grid">
                <div><strong>{copy.posted}</strong><span>{formatDate(job.publishedAt, uiLanguage, job.createdAt)}</span></div>
                <div><strong>{copy.contract}</strong><span>{job.contractType ?? copy.notSpecified}</span></div>
                <div><strong>{copy.weeklyHours}</strong><span>{job.weeklyHours ?? copy.notSpecified}</span></div>
                <div><strong>{copy.salaryRange}</strong><span>{formatSalary(job.salaryMin, uiLanguage)} - {formatSalary(job.salaryMax, uiLanguage)}</span></div>
                <div><strong>{copy.department}</strong><span>{job.department ?? copy.general}</span></div>
                <div><strong>{copy.language}</strong><span><Languages size={12} style={{ marginRight: 4 }} />{job.language.toUpperCase()}</span></div>
                <div><strong>{copy.remoteType}</strong><span>{REMOTE_LABEL[uiLanguage][job.remoteType] ?? job.remoteType}</span></div>
              </div>
            </section>

            <section className="careers-detail-card">
              <h3>{copy.companySnapshot}</h3>
              <div className="careers-facts-grid">
                <div><strong>{copy.company}</strong><span>{companyName}</span></div>
                <div><strong>{copy.group}</strong><span>{companyMeta?.groupName ?? copy.notSpecified}</span></div>
                <div><strong>{copy.openRoles}</strong><span>{companyMeta?.openRolesCount ?? copy.notSpecified}</span></div>
                <div><strong>{copy.profile}</strong><span>{companyMeta?.slug ?? copy.notSpecified}</span></div>
                <div>
                  <strong>{copy.owner}</strong>
                  <span>{`${companyMeta?.ownerName ?? ''} ${companyMeta?.ownerSurname ?? ''}`.trim() || copy.notSpecified}</span>
                </div>
              </div>
            </section>

            {job.storeId && (
              <section className="careers-detail-card">
                <h3>{copy.storeContext}</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '42px minmax(0, 1fr)', gap: 8, alignItems: 'center' }}>
                    <div className="careers-hiring-avatar" style={{ borderRadius: 10 }}>
                      {storeLogoUrl ? <img src={storeLogoUrl} alt={job.storeName ?? copy.assignedStore} /> : <StoreIcon size={16} />}
                    </div>
                    <div>
                      <strong style={{ display: 'block', color: '#111827' }}>{job.storeName ?? copy.assignedStore}</strong>
                      <span style={{ color: '#6b7280', fontSize: 12 }}>
                        {job.storeCode ? `Code ${job.storeCode}` : copy.storeCodeNotSet}
                      </span>
                    </div>
                  </div>
                  <div className="careers-facts-grid">
                    <div><strong>{copy.teamSize}</strong><span>{job.storeEmployeeCount ?? copy.notSpecified}</span></div>
                    <div><strong>{copy.location}</strong><span>{formatLocation(job, remoteFallback)}</span></div>
                  </div>
                </div>
              </section>
            )}

            <section className="careers-detail-card">
              <h3>{copy.hiringTeam}</h3>

              {job.postedBy && (
                <div className="careers-hiring-list" style={{ marginBottom: 2 }}>
                  <article className="careers-hiring-item">
                    <div className="careers-hiring-avatar">
                      {getAvatarUrl(job.postedBy.avatarFilename)
                        ? <img src={getAvatarUrl(job.postedBy.avatarFilename) ?? ''} alt={formatPersonName(job.postedBy)} />
                        : toInitials(formatPersonName(job.postedBy))}
                    </div>
                    <div>
                      <strong>{formatPersonName(job.postedBy)}</strong>
                      <span>{formatRole(job.postedBy.role, uiLanguage)} - {copy.postingOwner}</span>
                    </div>
                  </article>
                </div>
              )}

              {hiringTeam.length > 0 ? (
                <div className="careers-hiring-list">
                  {hiringTeam.map((contact) => {
                    const avatarUrl = getAvatarUrl(contact.avatarFilename);
                    const name = formatPersonName(contact);
                    return (
                      <article key={contact.id} className="careers-hiring-item">
                        <div className="careers-hiring-avatar">
                          {avatarUrl ? <img src={avatarUrl} alt={name} /> : toInitials(name)}
                        </div>
                        <div>
                          <strong>{name}</strong>
                          <span>{formatRole(contact.role, uiLanguage)}{contact.storeName ? ` - ${contact.storeName}` : ''}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="careers-login-gate">
                  <p>{copy.noHiringContacts}</p>
                </div>
              )}
            </section>

            <section className="careers-detail-card">
              <h3>{copy.securityTitle}</h3>
              <div className="careers-facts-grid">
                <div><strong><CalendarDays size={13} style={{ marginRight: 4 }} />{copy.submittedAt}</strong><span>{copy.realtimeSync}</span></div>
                <div><strong><Building2 size={13} style={{ marginRight: 4 }} />{copy.destination}</strong><span>{companyName}</span></div>
                <div><strong><Users size={13} style={{ marginRight: 4 }} />{copy.visibility}</strong><span>{copy.visibilityText}</span></div>
                <div><strong><User2 size={13} style={{ marginRight: 4 }} />{copy.duplicateCheck}</strong><span>{copy.duplicateCheckText}</span></div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
