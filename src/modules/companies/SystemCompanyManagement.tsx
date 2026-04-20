import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Users, Store, Plus, Layers } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useAuth } from '../../context/AuthContext';
import {
  createCompany,
  getCompanies,
  updateCompany,
  deactivateCompany,
  activateCompany,
  deleteCompanyPermanent,
  uploadCompanyLogo,
  uploadCompanyBanner,
  deleteCompanyBanner,
  transferCompanyOwnership,
} from '../../api/companies';
import { getCompanyGroups } from '../../api/companyGroups';
import { getEmployees } from '../../api/employees';
import { getCompanyLogoUrl, getCompanyBannerUrl } from '../../api/client';
import { translateApiError } from '../../utils/apiErrors';
import { Company } from '../../types';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import { Select } from '../../components/ui/Select';
import { SelectOption } from '../../components/ui/CustomSelect';
import { Badge } from '../../components/ui/Badge';
import { LocationFieldGroup } from '../../components/location';

type ModalMode = 'create' | 'edit';

const FALLBACK_TIMEZONES = [
  'UTC',
  'Europe/Rome',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf?: (key: string) => string[];
  DisplayNames?: new (
    locales?: string | string[],
    options?: { type: 'region' },
  ) => { of: (code: string) => string | undefined };
};

const intlWithSupportedValues = Intl as IntlWithSupportedValues;

const TIMEZONE_OPTIONS = typeof intlWithSupportedValues.supportedValuesOf === 'function'
  ? intlWithSupportedValues.supportedValuesOf('timeZone')
  : FALLBACK_TIMEZONES;

const TIMEZONE_SET = new Set(TIMEZONE_OPTIONS);

const COUNTRY_TIMEZONE_FALLBACKS: Record<string, string[]> = {
  IT: ['Europe/Rome'],
  GB: ['Europe/London'],
  IE: ['Europe/Dublin'],
  ES: ['Europe/Madrid'],
  FR: ['Europe/Paris'],
  DE: ['Europe/Berlin'],
  NL: ['Europe/Amsterdam'],
  BE: ['Europe/Brussels'],
  PT: ['Europe/Lisbon'],
  US: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'],
  CA: ['America/Toronto', 'America/Vancouver'],
  BR: ['America/Sao_Paulo'],
  AE: ['Asia/Dubai'],
  SA: ['Asia/Riyadh'],
  IN: ['Asia/Kolkata'],
  CN: ['Asia/Shanghai'],
  JP: ['Asia/Tokyo'],
  SG: ['Asia/Singapore'],
  AU: ['Australia/Sydney', 'Australia/Perth'],
  NZ: ['Pacific/Auckland'],
};

function parseTimezones(value: string): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      if (seen.has(item)) return;
      seen.add(item);
      list.push(item);
    });
  return list;
}

const AVATAR_PALETTE = ['#0D2137', '#163352', '#8B6914', '#1B4D3E', '#2C5282', '#5B2333'];
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function toCompanySlug(company: Company): string {
  const base = company.name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${company.id}-${base || 'company'}`;
}

type CompanyProfileForm = {
  registrationNumber: string;
  companyEmail: string;
  companyPhoneNumbers: string;
  officesLocations: string;
  country: string;
  city: string;
  state: string;
  address: string;
  timezones: string;
  currency: string;
};

const EMPTY_COMPANY_PROFILE_FORM: CompanyProfileForm = {
  registrationNumber: '',
  companyEmail: '',
  companyPhoneNumbers: '',
  officesLocations: '',
  country: '',
  city: '',
  state: '',
  address: '',
  timezones: '',
  currency: '',
};

function profileFromCompany(company: Company | null): CompanyProfileForm {
  if (!company) return { ...EMPTY_COMPANY_PROFILE_FORM };
  return {
    registrationNumber: company.registrationNumber ?? '',
    companyEmail: company.companyEmail ?? '',
    companyPhoneNumbers: company.companyPhoneNumbers ?? '',
    officesLocations: company.officesLocations ?? '',
    country: company.country ?? '',
    city: company.city ?? '',
    state: company.state ?? '',
    address: company.address ?? '',
    timezones: company.timezones ?? '',
    currency: company.currency ?? '',
  };
}

function normalizeProfileValue(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function payloadFromProfileForm(profile: CompanyProfileForm) {
  return {
    registrationNumber: normalizeProfileValue(profile.registrationNumber),
    companyEmail: normalizeProfileValue(profile.companyEmail),
    companyPhoneNumbers: normalizeProfileValue(profile.companyPhoneNumbers),
    officesLocations: normalizeProfileValue(profile.officesLocations),
    country: normalizeProfileValue(profile.country),
    city: normalizeProfileValue(profile.city),
    state: normalizeProfileValue(profile.state),
    address: normalizeProfileValue(profile.address),
    timezones: normalizeProfileValue(profile.timezones),
    currency: normalizeProfileValue(profile.currency),
  };
}

function StatBox({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
  return (
    <div style={{
      flex: 1,
      background: 'var(--surface-warm)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius)',
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <div style={{
        width: 34,
        height: 34,
        borderRadius: 'var(--radius-sm)',
        background: 'rgba(201,151,58,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: 'var(--accent)',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

export default function SystemCompanyManagement() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { isMobile } = useBreakpoint();
  const { user } = useAuth();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyGroups, setCompanyGroups] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  type ConfirmMode = 'deactivate' | 'activate' | 'delete';
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>('deactivate');
  const [confirmCompany, setConfirmCompany] = useState<Company | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);

  const [formName, setFormName] = useState('');
  const [formNameError, setFormNameError] = useState<string | undefined>();
  const [formGroupId, setFormGroupId] = useState<number | null>(null);
  const [formOwnerUserId, setFormOwnerUserId] = useState<number | null>(null);
  const [formProfile, setFormProfile] = useState<CompanyProfileForm>({ ...EMPTY_COMPANY_PROFILE_FORM });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [ownerCandidates, setOwnerCandidates] = useState<Array<{ id: number; name: string; surname: string }>>([]);
  const [ownerCandidatesLoading, setOwnerCandidatesLoading] = useState(false);
  const [timezoneDraft, setTimezoneDraft] = useState<string | null>(null);

  const timezoneValues = useMemo(
    () => parseTimezones(formProfile.timezones),
    [formProfile.timezones],
  );

  const detectedTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || '', []);

  const timezoneSelectOptions = useMemo<SelectOption[]>(() => {
    const selected = new Set(timezoneValues);
    return TIMEZONE_OPTIONS
      .filter((timezone) => !selected.has(timezone))
      .map((timezone) => ({
        value: timezone,
        label: timezone,
        render: (
          <div style={{ display: 'grid', gap: 1 }}>
            <span style={{ fontWeight: 700 }}>{timezone}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{timezone.split('/')[0]}</span>
          </div>
        ),
      }));
  }, [timezoneValues]);

  const countryTimezoneSuggestions = useMemo(() => {
    const code = formProfile.country.trim().toUpperCase();
    if (!code) return [] as string[];
    return (COUNTRY_TIMEZONE_FALLBACKS[code] ?? [])
      .filter((timezone) => TIMEZONE_SET.has(timezone))
      .filter((timezone) => !timezoneValues.includes(timezone));
  }, [formProfile.country, timezoneValues]);

  const locale = i18n.language?.startsWith('it') ? 'it-IT' : 'en-GB';

  const countryLabel = useMemo(() => {
    const code = formProfile.country.trim().toUpperCase();
    if (!code) return '';
    const DisplayNamesCtor = intlWithSupportedValues.DisplayNames;
    if (typeof DisplayNamesCtor !== 'function') return code;
    try {
      return new DisplayNamesCtor([locale], { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  }, [formProfile.country, locale]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCompanies();
      setCompanies(data);
    } catch {
      setError(t('companies.errorLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void (async () => {
      try {
        const groups = await getCompanyGroups();
        setCompanyGroups(groups);
      } catch {
        setCompanyGroups([]);
      }
    })();
  }, []);

  const openCreate = () => {
    setModalMode('create');
    setEditingCompanyId(null);
    setFormName('');
    setFormNameError(undefined);
    setFormGroupId(null);
    setFormOwnerUserId(null);
    setFormProfile({ ...EMPTY_COMPANY_PROFILE_FORM });
    setFormError(null);
    setLogoError(null);
    setBannerError(null);
    setOwnerCandidates([]);
    setTimezoneDraft(null);
    setModalOpen(true);
  };

  const openEdit = (company: Company) => {
    setModalMode('edit');
    setEditingCompanyId(company.id);
    setFormName(company.name);
    setFormNameError(undefined);
    setFormGroupId(company.groupId ?? null);
    setFormOwnerUserId(company.ownerUserId ?? null);
    setFormProfile(profileFromCompany(company));
    setFormError(null);
    setLogoError(null);
    setBannerError(null);
    setTimezoneDraft(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormSaving(false);
    setFormError(null);
    setFormNameError(undefined);
    setLogoUploading(false);
    setLogoError(null);
    setFormProfile({ ...EMPTY_COMPANY_PROFILE_FORM });
    setBannerUploading(false);
    setBannerError(null);
    setOwnerCandidates([]);
    setOwnerCandidatesLoading(false);
    setTimezoneDraft(null);
  };

  const setTimezoneValues = (items: string[]) => {
    const normalized = items
      .map((item) => item.trim())
      .filter(Boolean)
      .join(', ');
    setFormProfile((prev) => ({ ...prev, timezones: normalized }));
  };

  const addTimezone = (raw: string | null | undefined) => {
    const timezone = (raw ?? '').trim();
    if (!timezone) return;
    if (!TIMEZONE_SET.has(timezone)) {
      showToast(t('companies.invalidTimezone', 'Invalid timezone. Use IANA timezone values like Europe/Rome.'), 'error');
      return;
    }
    if (timezoneValues.includes(timezone)) {
      setTimezoneDraft(null);
      return;
    }
    setTimezoneValues([...timezoneValues, timezone]);
    setTimezoneDraft(null);
  };

  const removeTimezone = (timezone: string) => {
    setTimezoneValues(timezoneValues.filter((item) => item !== timezone));
  };

  useEffect(() => {
    if (!modalOpen || modalMode !== 'edit' || editingCompanyId == null) {
      return;
    }
    let mounted = true;
    setOwnerCandidatesLoading(true);
    getEmployees({ role: 'admin', status: 'active', limit: 200, targetCompanyId: editingCompanyId })
      .then((res) => {
        if (!mounted) return;
        setOwnerCandidates(
          res.employees.map((emp) => ({ id: emp.id, name: emp.name, surname: emp.surname }))
            .sort((a, b) => `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`)),
        );
      })
      .catch(() => {
        if (!mounted) return;
        setOwnerCandidates([]);
      })
      .finally(() => {
        if (!mounted) return;
        setOwnerCandidatesLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [modalOpen, modalMode, editingCompanyId]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || editingCompanyId === null) return;

    setLogoUploading(true);
    setLogoError(null);
    try {
      await uploadCompanyLogo(editingCompanyId, file);
      showToast(t('companies.logoUpdated'), 'success');
      await load();
    } catch (err: unknown) {
      setLogoError(translateApiError(err, t, t('companies.logoError')) ?? t('companies.logoError'));
    } finally {
      setLogoUploading(false);
      e.target.value = '';
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || editingCompanyId === null) return;

    setBannerUploading(true);
    setBannerError(null);
    try {
      await uploadCompanyBanner(editingCompanyId, file);
      showToast(t('companies.bannerUpdated', 'Banner aziendale aggiornato'), 'success');
      await load();
    } catch (err: unknown) {
      setBannerError(translateApiError(err, t, t('companies.bannerError', 'Errore durante aggiornamento banner')) ?? t('companies.bannerError', 'Errore durante aggiornamento banner'));
    } finally {
      setBannerUploading(false);
      e.target.value = '';
    }
  };

  const handleBannerDelete = async () => {
    if (editingCompanyId === null) return;
    setBannerUploading(true);
    setBannerError(null);
    try {
      await deleteCompanyBanner(editingCompanyId);
      showToast(t('companies.bannerRemoved', 'Banner aziendale rimosso'), 'success');
      await load();
    } catch (err: unknown) {
      setBannerError(translateApiError(err, t, t('companies.bannerDeleteError', 'Errore durante rimozione banner')) ?? t('companies.bannerDeleteError', 'Errore durante rimozione banner'));
    } finally {
      setBannerUploading(false);
    }
  };

  const openConfirm = (mode: ConfirmMode, company: Company) => {
    setConfirmMode(mode);
    setConfirmCompany(company);
    setConfirmError(null);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmCompany(null);
    setConfirmBusy(false);
    setConfirmError(null);
  };

  const handleConfirm = async () => {
    if (!confirmCompany) return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      if (confirmMode === 'deactivate') {
        await deactivateCompany(confirmCompany.id);
        showToast(t('companies.deactivatedSuccess'), 'success');
      } else if (confirmMode === 'activate') {
        await activateCompany(confirmCompany.id);
        showToast(t('companies.activatedSuccess'), 'success');
      } else {
        await deleteCompanyPermanent(confirmCompany.id);
        showToast(t('companies.deletedSuccess'), 'success');
      }
      closeConfirm();
      await load();
    } catch (err: unknown) {
      const msgKey = confirmMode === 'deactivate'
        ? 'companies.errorDeactivate'
        : confirmMode === 'activate' ? 'companies.errorActivate' : 'companies.errorDelete';
      setConfirmError(translateApiError(err, t, t(msgKey)) ?? t(msgKey));
    } finally {
      setConfirmBusy(false);
    }
  };

  const submit = async () => {
    if (!formName.trim()) { setFormNameError(t('companies.validationName')); return; }
    setFormSaving(true);
    setFormError(null);
    try {
      if (modalMode === 'create') {
        await createCompany({
          name: formName.trim(),
          groupId: formGroupId,
          ...payloadFromProfileForm(formProfile),
        });
        showToast(t('companies.createdSuccess'), 'success');
      } else {
        if (editingCompanyId === null) throw new Error('Missing company id');
        await updateCompany(editingCompanyId, {
          name: formName.trim(),
          groupId: formGroupId,
          ...payloadFromProfileForm(formProfile),
        });
        const current = companies.find((company) => company.id === editingCompanyId);
        if (formOwnerUserId != null && formOwnerUserId !== (current?.ownerUserId ?? null)) {
          await transferCompanyOwnership(editingCompanyId, formOwnerUserId);
        }
        showToast(t('companies.updatedSuccess'), 'success');
      }
      closeModal();
      await load();
    } catch (err: unknown) {
      setFormError(translateApiError(err, t, t('companies.errorSave')));
    } finally {
      setFormSaving(false);
    }
  };

  const activeCount = companies.filter((c) => c.isActive).length;
  const totalStores = companies.reduce((s, c) => s + c.storeCount, 0);
  const totalEmployees = companies.reduce((s, c) => s + c.employeeCount, 0);
  const editingCompany = editingCompanyId !== null ? companies.find((c) => c.id === editingCompanyId) ?? null : null;

  if (loading) {
    return (
      <div className="page-enter" style={{ width: '100%' }}>
        {[1, 2].map((i) => (
          <div key={i} style={{ height: 160, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', opacity: 0.5, marginBottom: 14 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-enter" style={{ width: '100%' }}>
        <Alert variant="danger" title={t('common.error')} onClose={() => setError(null)}>{error}</Alert>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 20 : 24, margin: 0, color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {t('nav.companies')}
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            {t('companies.systemSubtitle')}
          </p>
        </div>
        {user?.isSuperAdmin && (
          <Button variant="primary" onClick={openCreate}>
            <Plus size={15} style={{ marginRight: 6 }} />
            {t('companies.new')}
          </Button>
        )}
      </div>

      {/* ── Summary strip ── */}
      {companies.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
          gap: 12,
        }}>
          {[
            { label: t('companies.statEmployees').replace('Attivi', '').replace('Active', ''), icon: <Building2 size={16} />, value: activeCount, sublabel: i18n.language?.startsWith('it') ? 'Aziende attive' : 'Active companies' },
            { label: '', icon: <Store size={16} />, value: totalStores, sublabel: t('companies.statStores') },
            { label: '', icon: <Users size={16} />, value: totalEmployees, sublabel: t('companies.statEmployees') },
          ].map((s, i) => (
            <div key={i} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 16px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius)',
                background: 'var(--accent-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
                flexShrink: 0,
              }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.03em' }}>
                  {s.value}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 3 }}>{s.sublabel}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Company cards ── */}
      {companies.length === 0 ? (
        <Alert variant="info" title={t('common.noData')}>{t('companies.errorLoad')}</Alert>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
          {companies.map((c) => {
            const avatarColor = getAvatarColor(c.name);
            const initials = getInitials(c.name);
            const groupName = companyGroups.find((g) => g.id === c.groupId)?.name;
            const createdDate = new Date(c.createdAt).toLocaleDateString(locale, { year: 'numeric', month: 'long' });
            const logoUrl = getCompanyLogoUrl(c.logoFilename);
            const bannerUrl = getCompanyBannerUrl(c.bannerFilename);
            const ownerLabel = c.ownerName ? `${c.ownerName} ${c.ownerSurname ?? ''}`.trim() : null;

            return (
              <div
                key={c.id}
                className="card-lift"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-sm)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: `3px solid ${c.isActive ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {bannerUrl && (
                  <div
                    style={{
                      height: 72,
                      backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.18) 100%), url(${bannerUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                )}

                {/* Card header */}
                <div style={{ padding: '18px 20px 14px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {/* Avatar */}
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 'var(--radius)',
                    background: logoUrl ? 'transparent' : avatarColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 16,
                    flexShrink: 0,
                    letterSpacing: '0.02em',
                    overflow: 'hidden',
                  }}>
                    {logoUrl ? (
                      <img src={logoUrl} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : initials}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                      {c.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                      {groupName && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--accent)',
                          background: 'var(--accent-light)',
                          padding: '2px 8px',
                          borderRadius: 4,
                          letterSpacing: '0.01em',
                        }}>
                          <Layers size={10} />
                          {groupName}
                        </span>
                      )}
                      {c.isActive ? (
                        <Badge variant="success">{t('common.active')}</Badge>
                      ) : (
                        <Badge variant="danger">{t('common.inactive')}</Badge>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>{createdDate}</span>
                    </div>
                    {ownerLabel && (
                      <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Users size={10} />
                        {ownerLabel}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => navigate(`/aziende/${toCompanySlug(c)}`)}
                      title={t('common.open')}
                      style={{
                        height: 32,
                        padding: '0 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        color: 'var(--text-secondary)',
                        fontSize: 11,
                        fontWeight: 700,
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-warm)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
                    >
                      {t('common.open')} <ArrowRight size={12} />
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'var(--border-light)', margin: '0 20px' }} />

                {/* Stats */}
                <div style={{ padding: '14px 20px 18px', display: 'flex', gap: 10 }}>
                  <StatBox value={c.storeCount} label={t('companies.statStores')} icon={<Store size={16} />} />
                  <StatBox value={c.employeeCount} label={t('companies.statEmployees')} icon={<Users size={16} />} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={modalMode === 'create' ? t('companies.createCompany') : t('companies.editCompany')}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={formSaving}>{t('common.cancel')}</Button>
            <Button onClick={submit} loading={formSaving}>
              {modalMode === 'create' ? t('common.create') : t('common.save')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {formError && <Alert variant="danger" onClose={() => setFormError(null)}>{formError}</Alert>}
          <Input
            label={t('companies.fieldName')}
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            error={formNameError}
            placeholder={t('companies.placeholderName')}
            disabled={formSaving}
          />
          <Select
            label={t('companies.fieldGroup')}
            value={formGroupId ?? ''}
            onChange={(e) => { const raw = e.target.value; setFormGroupId(raw === '' ? null : parseInt(raw, 10)); }}
            disabled={formSaving}
          >
            <option value="">{t('companies.optionStandalone')}</option>
            {companyGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Input
              label={t('companies.registrationNumber', 'Registration Number')}
              value={formProfile.registrationNumber}
              onChange={(e) => setFormProfile((prev) => ({ ...prev, registrationNumber: e.target.value }))}
              disabled={formSaving}
            />
            <Input
              label={t('companies.companyEmail', 'Company Email')}
              value={formProfile.companyEmail}
              onChange={(e) => setFormProfile((prev) => ({ ...prev, companyEmail: e.target.value }))}
              disabled={formSaving}
            />
            <Input
              label={t('companies.officesLocations', 'Offices Locations')}
              value={formProfile.officesLocations}
              onChange={(e) => setFormProfile((prev) => ({ ...prev, officesLocations: e.target.value }))}
              disabled={formSaving}
            />
            <Input
              label={t('companies.currency', 'Currency')}
              value={formProfile.currency}
              onChange={(e) => setFormProfile((prev) => ({ ...prev, currency: e.target.value }))}
              disabled={formSaving}
            />
          </div>

          <LocationFieldGroup
            value={{
              country: formProfile.country,
              state: formProfile.state,
              city: formProfile.city,
              address: formProfile.address,
              postalCode: '',
              phone: formProfile.companyPhoneNumbers,
            }}
            onChange={(location) => {
              setFormProfile((prev) => ({
                ...prev,
                country: location.country,
                state: location.state,
                city: location.city,
                address: location.address,
                companyPhoneNumbers: location.phone,
              }));
            }}
            includeAddress
            includePostalCode={false}
            includePhone
            disabled={formSaving}
            labels={{
              country: t('companies.country', 'Country'),
              state: t('companies.state', 'State'),
              city: t('companies.city', 'City'),
              address: t('companies.address', 'Address'),
              phone: t('companies.companyPhoneNumbers', 'Company Phone Numbers'),
            }}
          />

          {modalMode === 'edit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Select
                label={t('companies.ownerField', 'Proprietario azienda')}
                value={formOwnerUserId ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  setFormOwnerUserId(raw === '' ? null : parseInt(raw, 10));
                }}
                disabled={formSaving || ownerCandidatesLoading}
              >
                <option value="">{t('companies.ownerUnchanged', 'Nessuna modifica')}</option>
                {ownerCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidate.name} {candidate.surname}</option>
                ))}
              </Select>
              {ownerCandidatesLoading && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {t('companies.ownerLoading', 'Caricamento amministratori in corso...')}
                </span>
              )}
            </div>
          )}

          {modalMode === 'edit' && editingCompany && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('companies.logoField')}
                </span>

                {logoError && <Alert variant="danger" onClose={() => setLogoError(null)}>{logoError}</Alert>}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    background: editingCompany.logoFilename ? 'transparent' : getAvatarColor(editingCompany.name),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 13,
                    flexShrink: 0,
                  }}>
                    {editingCompany.logoFilename ? (
                      <img src={getCompanyLogoUrl(editingCompany.logoFilename) ?? ''} alt={editingCompany.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : getInitials(editingCompany.name)}
                  </div>

                  <input
                    id="company-logo-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleLogoUpload}
                    disabled={logoUploading || formSaving}
                  />
                  <label
                    htmlFor="company-logo-upload"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-warm)',
                      cursor: logoUploading || formSaving ? 'not-allowed' : 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      opacity: logoUploading || formSaving ? 0.7 : 1,
                    }}
                  >
                    {logoUploading ? t('companies.logoUploading') : t('companies.uploadLogo')}
                  </label>
                </div>

                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('companies.logoHint')}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('companies.bannerField', 'Banner aziendale')}
                </span>

                {bannerError && <Alert variant="danger" onClose={() => setBannerError(null)}>{bannerError}</Alert>}

                {editingCompany.bannerFilename ? (
                  <img
                    src={getCompanyBannerUrl(editingCompany.bannerFilename) ?? ''}
                    alt={editingCompany.name}
                    style={{ width: '100%', maxHeight: 130, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                  />
                ) : (
                  <div style={{ padding: '10px 12px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-muted)' }}>
                    {t('companies.bannerEmpty', 'Nessun banner impostato')}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    id="company-banner-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleBannerUpload}
                    disabled={bannerUploading || formSaving}
                  />
                  <label
                    htmlFor="company-banner-upload"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-warm)',
                      cursor: bannerUploading || formSaving ? 'not-allowed' : 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      opacity: bannerUploading || formSaving ? 0.7 : 1,
                    }}
                  >
                    {bannerUploading ? t('companies.bannerUploading', 'Caricamento banner...') : t('companies.uploadBanner', 'Carica banner')}
                  </label>

                  {editingCompany.bannerFilename && (
                    <Button variant="danger" onClick={handleBannerDelete} disabled={bannerUploading || formSaving}>
                      {t('companies.removeBanner', 'Rimuovi banner')}
                    </Button>
                  )}
                </div>

                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {t('companies.bannerHint', 'Consigliato formato panoramico; massimo 4MB')}
                </span>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ── Confirm Modal ── */}
      <Modal
        open={confirmOpen}
        onClose={closeConfirm}
        title={
          confirmMode === 'deactivate' ? t('companies.confirmDeactivateTitle')
            : confirmMode === 'activate' ? t('companies.confirmActivateTitle')
              : t('companies.confirmDeleteTitle')
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeConfirm} disabled={confirmBusy}>{t('common.cancel')}</Button>
            {confirmMode === 'activate' ? (
              <Button onClick={handleConfirm} loading={confirmBusy}>{t('common.activate')}</Button>
            ) : confirmMode === 'deactivate' ? (
              <Button variant="danger" onClick={handleConfirm} loading={confirmBusy}>{t('common.deactivate')}</Button>
            ) : (
              <Button variant="danger" onClick={handleConfirm} loading={confirmBusy}>{t('common.delete')}</Button>
            )}
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {confirmError && <Alert variant="danger" onClose={() => setConfirmError(null)}>{confirmError}</Alert>}
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>
            {confirmMode === 'deactivate' ? t('companies.confirmDeactivateMsg', { name: confirmCompany?.name ?? '' })
              : confirmMode === 'activate' ? t('companies.confirmActivateMsg', { name: confirmCompany?.name ?? '' })
                : t('companies.confirmDeleteMsg', { name: confirmCompany?.name ?? '' })}
          </p>
        </div>
      </Modal>
    </div>
  );
}
