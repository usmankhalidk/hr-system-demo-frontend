import { getApiErrorCode } from '../../utils/apiErrors';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactCountryFlag from 'react-country-flag';
import {
  ArrowLeft,
  Building2,
  Layers,
  Store as StoreIcon,
  Users,
  Pencil,
  Power,
  PowerOff,
  Trash2,
  Camera,
  UploadCloud,
  MapPin,
  Image as ImageIcon,
  Hash,
  CalendarClock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  activateCompany,
  deactivateCompany,
  deleteCompanyPermanent,
  deleteCompanyLogo,
  getCompanyById,
  transferCompanyOwnership,
  updateCompany,
  uploadCompanyBanner,
  uploadCompanyLogo,
  deleteCompanyBanner,
} from '../../api/companies';
import { getCompanyGroups } from '../../api/companyGroups';
import { getStores } from '../../api/stores';
import { getEmployees } from '../../api/employees';
import { getAvatarUrl, getCompanyBannerUrl, getCompanyLogoUrl, getStoreLogoUrl } from '../../api/client';
import { Company, Employee, Store } from '../../types';
import { translateApiError } from '../../utils/apiErrors';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import CustomSelect, { SelectOption } from '../../components/ui/CustomSelect';
import { Select } from '../../components/ui/Select';
import { LocationFieldGroup } from '../../components/location';
import { getCountryDisplayName } from '../../utils/country';
import { getCompanies } from '../../api/companies';

function parseCompanyIdFromSlug(slug?: string): number | null {
  if (!slug) return null;
  const match = slug.match(/^(\d+)(?:-|$)/);
  if (!match) return null;
  const id = parseInt(match[1], 10);
  return Number.isNaN(id) ? null : id;
}

function toStoreSlug(store: Store): string {
  const base = store.name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${store.id}-${base || 'store'}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (name.slice(0, 2) || 'CO').toUpperCase();
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
  currency: string;
};

const EMPTY_PROFILE_FORM: CompanyProfileForm = {
  registrationNumber: '',
  companyEmail: '',
  companyPhoneNumbers: '',
  officesLocations: '',
  country: '',
  city: '',
  state: '',
  address: '',
  currency: '',
};

function profileFromCompany(company: Company | null): CompanyProfileForm {
  if (!company) return { ...EMPTY_PROFILE_FORM };
  return {
    registrationNumber: company.registrationNumber ?? '',
    companyEmail: company.companyEmail ?? '',
    companyPhoneNumbers: company.companyPhoneNumbers ?? '',
    officesLocations: company.officesLocations ?? '',
    country: company.country ?? '',
    city: company.city ?? '',
    state: company.state ?? '',
    address: company.address ?? '',
    currency: company.currency ?? '',
  };
}

function normalizeProfileValue(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function profilePayload(profile: CompanyProfileForm) {
  return {
    registrationNumber: normalizeProfileValue(profile.registrationNumber),
    companyEmail: normalizeProfileValue(profile.companyEmail),
    companyPhoneNumbers: normalizeProfileValue(profile.companyPhoneNumbers),
    officesLocations: normalizeProfileValue(profile.officesLocations),
    country: normalizeProfileValue(profile.country),
    city: normalizeProfileValue(profile.city),
    state: normalizeProfileValue(profile.state),
    address: normalizeProfileValue(profile.address),
    currency: normalizeProfileValue(profile.currency),
  };
}

export default function CompanyDetail() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { slug } = useParams<{ slug: string }>();
  const companyId = useMemo(() => parseCompanyIdFromSlug(slug), [slug]);
  const locale = i18n.language?.startsWith('it') ? 'it-IT' : 'en-GB';
  const canManageStatus = user?.isSuperAdmin === true;

  const [company, setCompany] = useState<Company | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companyGroups, setCompanyGroups] = useState<Array<{ id: number; name: string }>>([]);
  const [ownerCandidates, setOwnerCandidates] = useState<Array<{ id: number; name: string; surname: string; avatarFilename?: string | null; companyCount: number }>>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [ownerCandidatesLoading, setOwnerCandidatesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGroupId, setEditGroupId] = useState<number | null>(null);
  const [editOwnerUserId, setEditOwnerUserId] = useState<string>('');
  const [editProfile, setEditProfile] = useState<CompanyProfileForm>({ ...EMPTY_PROFILE_FORM });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [mediaOpen, setMediaOpen] = useState(false);
  const [logoHover, setLogoHover] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [statusConfirmMode, setStatusConfirmMode] = useState<'deactivate' | 'activate'>('deactivate');
  const [statusConfirmInput, setStatusConfirmInput] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canEdit = user?.role === 'admin' || (company?.ownerUserId != null && user?.id === company.ownerUserId);

  const storeManagersByStoreId = useMemo(() => {
    const map = new Map<number, Employee>();
    for (const employee of employees) {
      if (employee.role !== 'store_manager' || employee.storeId == null) continue;
      if (!map.has(employee.storeId)) map.set(employee.storeId, employee);
    }
    return map;
  }, [employees]);

  const employeesByStoreId = useMemo(() => {
    const map = new Map<number, Employee[]>();
    for (const employee of employees) {
      if (employee.storeId == null) continue;
      if (!map.has(employee.storeId)) map.set(employee.storeId, []);
      map.get(employee.storeId)!.push(employee);
    }
    return map;
  }, [employees]);

  const ownerOptions = useMemo(() => {
    const candidates = ownerCandidates.map((candidate) => ({
      ...candidate,
      companyCount: allCompanies.filter((item) => item.ownerUserId === candidate.id).length,
    }));

    if (company?.ownerUserId != null && !candidates.some((candidate) => candidate.id === company.ownerUserId)) {
      candidates.unshift({
        id: company.ownerUserId,
        name: company.ownerName ?? t('companies.currentOwner', 'Current owner'),
        surname: company.ownerSurname ?? '',
        avatarFilename: company.ownerAvatarFilename ?? null,
        companyCount: allCompanies.filter((item) => item.ownerUserId === company.ownerUserId).length,
      });
    }

    return candidates;
  }, [allCompanies, company, ownerCandidates, t]);

  const ownerSelectOptions = useMemo<SelectOption[]>(() => {
    return ownerOptions.map((owner) => {
      const fullName = `${owner.name} ${owner.surname ?? ''}`.trim();
      const avatarUrl = getAvatarUrl(owner.avatarFilename);
      return {
        value: String(owner.id),
        label: fullName,
        render: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: avatarUrl ? 'transparent' : 'var(--primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
              {avatarUrl ? <img src={avatarUrl} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(fullName)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fullName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {owner.companyCount} {t('companies.ownedCompanies', { defaultValue: 'companies owned', count: owner.companyCount })}
              </div>
            </div>
          </div>
        ),
      };
    });
  }, [ownerOptions, t]);

  const loadData = useCallback(async () => {
    if (!companyId) {
      setError(t('companies.errorLoad'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [companyData, storeData, employeeData, groupData, ownerData, companyList] = await Promise.all([
        getCompanyById(companyId),
        getStores({ targetCompanyId: companyId }),
        getEmployees({ targetCompanyId: companyId, status: 'active', limit: 300 }),
        getCompanyGroups().catch(() => []),
        getEmployees({ targetCompanyId: companyId, status: 'active', role: 'admin', limit: 200 }).catch(() => ({ employees: [] as Employee[] })),
        getCompanies().catch(() => []),
      ]);

      setCompany(companyData);
      setStores((storeData ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)));
      setEmployees((employeeData.employees ?? []).slice().sort((a, b) => `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`)));
      setCompanyGroups((groupData ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)));
      setOwnerCandidates(
        (ownerData.employees ?? [])
          .map((emp) => ({ id: emp.id, name: emp.name, surname: emp.surname, avatarFilename: emp.avatarFilename ?? null, companyCount: 0 }))
          .sort((a, b) => `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`)),
      );
      setAllCompanies((companyList ?? []).slice());
    } catch {
      setError(t('companies.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openEditModal() {
    if (!company) return;

    setEditName(company.name);
    setEditGroupId(company.groupId ?? null);
    setEditOwnerUserId(company.ownerUserId != null ? String(company.ownerUserId) : '');
    setEditProfile(profileFromCompany(company));
    setEditError(null);
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!company) return;
    if (!editName.trim()) {
      setEditError(t('companies.validationName'));
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      const selectedOwnerId = editOwnerUserId ? parseInt(editOwnerUserId, 10) : null;

      await updateCompany(company.id, {
        name: editName.trim(),
        groupId: editGroupId,
        ...profilePayload(editProfile),
      });
      if (selectedOwnerId && selectedOwnerId !== (company.ownerUserId ?? null)) {
        await transferCompanyOwnership(company.id, selectedOwnerId);
      }
      showToast(t('companies.updatedSuccess'), 'success');
      setEditOpen(false);
      await loadData();
    } catch (err: unknown) {
      setEditError(translateApiError(err, t, t('companies.errorSave')));
    } finally {
      setEditSaving(false);
    }
  }

  async function handleLogoFile(file: File) {
    if (!company) return;
    setLogoUploading(true);
    setMediaError(null);
    try {
      await uploadCompanyLogo(company.id, file);
      showToast(t('companies.logoUpdated'), 'success');
      await loadData();
    } catch (err: unknown) {
      const message = translateApiError(err, t, t('companies.logoError'));
      if (getApiErrorCode(err) === 'INVALID_FILE_TYPE') {
        showToast(message ?? t('companies.logoError'), 'warning');
      }
      setMediaError(message);
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleBannerFile(file: File) {
    if (!company) return;
    setBannerUploading(true);
    setMediaError(null);
    try {
      await uploadCompanyBanner(company.id, file);
      showToast(t('companies.bannerUpdated', 'Company banner updated'), 'success');
      await loadData();
    } catch (err: unknown) {
      const message = translateApiError(err, t, t('companies.bannerError', 'Error updating company banner'));
      if (getApiErrorCode(err) === 'INVALID_FILE_TYPE') {
        showToast(message ?? t('companies.bannerError', 'Error updating company banner'), 'warning');
      }
      setMediaError(message);
    } finally {
      setBannerUploading(false);
    }
  }

  async function handleDeleteBanner() {
    if (!company) return;
    setBannerUploading(true);
    setMediaError(null);
    try {
      await deleteCompanyBanner(company.id);
      showToast(t('companies.bannerRemoved', 'Company banner removed'), 'success');
      await loadData();
    } catch (err: unknown) {
      setMediaError(translateApiError(err, t, t('companies.bannerDeleteError', 'Error removing company banner')));
    } finally {
      setBannerUploading(false);
    }
  }

  async function handleDeleteLogo() {
    if (!company) return;
    setLogoUploading(true);
    setMediaError(null);
    try {
      await deleteCompanyLogo(company.id);
      showToast(t('companies.logoRemoved', 'Company logo removed'), 'success');
      await loadData();
    } catch (err: unknown) {
      setMediaError(translateApiError(err, t, t('companies.logoDeleteError', 'Error removing company logo')));
    } finally {
      setLogoUploading(false);
    }
  }

  function openStatusConfirm(mode: 'deactivate' | 'activate') {
    setStatusConfirmMode(mode);
    setStatusConfirmInput('');
    setStatusError(null);
    setStatusConfirmOpen(true);
  }

  async function handleStatusConfirm() {
    if (!company) return;

    if (statusConfirmMode === 'deactivate' && statusConfirmInput.trim() !== company.name) {
      setStatusError(t('companies.deactivateNameError', 'Type the exact company name to confirm deactivation.'));
      return;
    }

    setStatusBusy(true);
    setStatusError(null);
    try {
      if (statusConfirmMode === 'deactivate') {
        await deactivateCompany(company.id);
        showToast(t('companies.deactivatedSuccess'), 'success');
      } else {
        await activateCompany(company.id);
        showToast(t('companies.activatedSuccess'), 'success');
      }
      setStatusConfirmOpen(false);
      await loadData();
    } catch (err: unknown) {
      const fallback = statusConfirmMode === 'deactivate' ? t('companies.errorDeactivate') : t('companies.errorActivate');
      setStatusError(translateApiError(err, t, fallback));
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleDeleteCompany() {
    if (!company) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteCompanyPermanent(company.id);
      showToast(t('companies.deletedSuccess'), 'success');
      navigate('/aziende');
    } catch (err: unknown) {
      setDeleteError(translateApiError(err, t, t('companies.errorDelete')));
    } finally {
      setDeleteBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="page-enter" style={{ width: '100%' }}>
        <div style={{ height: 180, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', opacity: 0.65 }} />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="page-enter" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="btn btn-secondary" onClick={() => navigate('/aziende')} style={{ width: 'fit-content' }}>
          <ArrowLeft size={14} />
          {t('common.back')}
        </button>
        <div style={{ border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 10, padding: '12px 14px', fontSize: 13 }}>
          {error ?? t('companies.errorLoad')}
        </div>
      </div>
    );
  }

  const bannerUrl = getCompanyBannerUrl(company.bannerFilename);
  const logoUrl = getCompanyLogoUrl(company.logoFilename);
  const ownerAvatarUrl = getAvatarUrl(company.ownerAvatarFilename);
  const ownerLabel = company.ownerName
    ? `${company.ownerName} ${company.ownerSurname ?? ''}`.trim()
    : t('companies.ownerMissing', 'No owner assigned');
  const activeStores = stores.filter((s) => s.isActive).length;
  const deleteMatches = deleteInput.trim() === company.name;
  const deactivateMatches = statusConfirmInput.trim() === company.name;

  const companyLocation = [company.address, company.city, company.state, company.country]
    .filter((part) => Boolean(part && String(part).trim().length > 0))
    .join(', ');
  const companyCountryName = getCountryDisplayName(company.country);
  const activeEmployees = employees.filter((employee) => employee.role !== 'store_terminal');

  const companyInsights: Array<{ label: string; value: string | null | undefined }> = [
    { label: t('companies.registrationNumber', 'Registration number'), value: company.registrationNumber },
    { label: t('companies.companyEmail', 'Company email'), value: company.companyEmail },
    { label: t('companies.companyPhoneNumbers', 'Company phone numbers'), value: company.companyPhoneNumbers },
    { label: t('companies.officesLocations', 'Offices locations'), value: company.officesLocations },
    { label: t('companies.location', 'Location'), value: companyLocation || null },
    { label: t('companies.currency', 'Currency'), value: company.currency },
  ];
  const heroTitleOffset = 'clamp(136px, 32vw, 160px)';
  const bannerActionLabel = company.bannerFilename
    ? t('companies.reuploadBanner', 'Re-upload banner')
    : t('companies.uploadBanner', 'Upload banner');
  const logoActionLabel = company.logoFilename
    ? t('companies.reuploadLogo', 'Re-upload logo')
    : t('companies.uploadLogo');

  return (
    <div className="page-enter" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/aziende')}>
          <ArrowLeft size={14} />
          {t('common.back')}
        </button>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canEdit && (
            <Button variant="secondary" onClick={openEditModal}>
              <Pencil size={14} />
              {t('common.edit')}
            </Button>
          )}
          {canManageStatus && company.isActive && (
            <Button variant="danger" onClick={() => openStatusConfirm('deactivate')}>
              <PowerOff size={14} />
              {t('common.deactivate')}
            </Button>
          )}
          {canManageStatus && !company.isActive && (
            <>
              <Button onClick={() => openStatusConfirm('activate')}>
                <Power size={14} />
                {t('common.activate')}
              </Button>
              <Button variant="danger" onClick={() => { setDeleteError(null); setDeleteInput(''); setDeleteOpen(true); }}>
                <Trash2 size={14} />
                {t('common.delete')}
              </Button>
            </>
          )}
        </div>
      </div>

      <div
        style={{
          borderRadius: 14,
          border: '1px solid var(--border)',
          overflow: 'hidden',
          background: 'var(--surface)',
        }}
      >
        <div
          style={{
            minHeight: 230,
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'flex-end',
            background: bannerUrl
              ? `linear-gradient(180deg, rgba(13,33,55,0.35) 0%, rgba(13,33,55,0.82) 100%), url(${bannerUrl}) center/cover no-repeat`
              : 'linear-gradient(135deg, rgba(13,33,55,0.92) 0%, rgba(22,51,82,0.9) 45%, rgba(15,118,110,0.74) 100%)',
          }}
        >
          <div style={{ minWidth: 0, paddingLeft: heroTitleOffset }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 1.00, fontWeight: 800, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {company.name}
              {company.country ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.82)' }}>
                  <ReactCountryFlag countryCode={company.country} svg style={{ width: '0.95em', height: '0.95em' }} />
                  {companyCountryName}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 20px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginTop: -42 }}>
            <button
              type="button"
              onClick={() => setMediaOpen(true)}
              onMouseEnter={() => setLogoHover(true)}
              onMouseLeave={() => setLogoHover(false)}
              style={{
                width: 112,
                height: 112,
                borderRadius: 20,
                overflow: 'hidden',
                background: logoUrl ? '#fff' : 'var(--primary)',
                border: '5px solid var(--surface)',
                boxShadow: '0 12px 24px rgba(15,23,42,0.2)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
              }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt={company.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                initials(company.name)
              )}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(13,33,55,0.62)',
                  opacity: logoHover ? 1 : 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  transition: 'opacity 0.16s ease',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                }}
              >
                <Camera size={16} />
                {t('companies.manageMediaCta', 'Manage media')}
              </div>
            </button>

            <div style={{ flex: 1, minWidth: 220, paddingBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {company.groupName ? (
                  <span style={{ fontSize: 11, color: 'var(--accent)', border: '1px solid rgba(201,151,58,0.34)', background: 'rgba(201,151,58,0.12)', borderRadius: 999, padding: '3px 8px' }}>
                    {company.groupName}
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 999, padding: '3px 8px' }}>
                    {t('companies.optionStandalone')}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 11,
                    borderRadius: 999,
                    padding: '3px 8px',
                    color: company.isActive ? '#166534' : '#991b1b',
                    border: company.isActive ? '1px solid rgba(34,197,94,0.36)' : '1px solid rgba(248,113,113,0.44)',
                    background: company.isActive ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)',
                  }}
                >
                  {company.isActive ? t('common.active') : t('common.inactive')}
                </span>
              </div>
              <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                {ownerAvatarUrl ? (
                  <span style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', display: 'inline-flex', border: '1px solid var(--border)' }}>
                    <img src={ownerAvatarUrl} alt={ownerLabel} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </span>
                ) : null}
                {ownerLabel}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          <InfoChip icon={<StoreIcon size={13} />} label={t('companies.statStores')} value={String(company.storeCount)} />
          <InfoChip
            icon={<Users size={13} />}
            label={t('companies.statEmployees')}
            value={String(activeEmployees.length)}
            endSlot={<EmployeeAvatarStack employees={activeEmployees} />}
          />
          <InfoChip icon={<Building2 size={13} />} label={t('companies.ownerField')} value={ownerLabel} avatarUrl={ownerAvatarUrl} />
          <InfoChip icon={<CalendarClock size={13} />} label={t('companies.labelCreated')} value={new Date(company.createdAt).toLocaleDateString(locale)} />
          <InfoChip icon={<Layers size={13} />} label={t('companies.fieldGroup')} value={company.groupName ?? t('companies.optionStandalone')} />
          {company.country ? (
            <InfoChip
              icon={<MapPin size={13} />}
              label={t('companies.country', 'Country')}
              value={(
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <ReactCountryFlag countryCode={company.country} svg style={{ width: '1em', height: '1em' }} />
                  {companyCountryName || company.country}
                </span>
              )}
            />
          ) : null}
          {company.currency ? <InfoChip icon={<ImageIcon size={13} />} label={t('companies.currency', 'Currency')} value={company.currency} /> : null}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.12)', fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.92)', textTransform: 'uppercase', letterSpacing: '0.04em', background: 'linear-gradient(135deg, rgba(13,33,55,0.94) 0%, rgba(16,40,66,0.88) 100%)' }}>
            {t('companies.detailStoresTitle', 'Stores')} ({stores.length})
          </div>
          {stores.length === 0 ? (
            <div style={{ padding: 14, fontSize: 13, color: 'var(--text-muted)' }}>{t('common.noData')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {stores.slice(0, 8).map((store) => {
                const manager = storeManagersByStoreId.get(store.id);
                const storeEmployees = employeesByStoreId.get(store.id) ?? [];
                return (
                  <div key={store.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'rgba(13,33,55,0.08)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        {getStoreLogoUrl(store.logoFilename) ? (
                          <img src={getStoreLogoUrl(store.logoFilename)!} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#8B6914' }}>
                            {initials(store.name)}
                          </span>
                        )}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, maxWidth: '100%' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {store.name}
                          </div>
                          {store.country ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                              <ReactCountryFlag countryCode={store.country} svg style={{ width: '0.9em', height: '0.9em' }} />
                              {getCountryDisplayName(store.country)}
                            </span>
                          ) : null}
                        </div>
                        <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{store.code}</span>
                          {manager ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}>
                              <ManagerAvatar employee={manager} />
                              {`${manager.name} ${manager.surname ?? ''}`.trim()}
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('stores.noManager')}</span>
                          )}
                          {storeEmployees.length > 0 ? <EmployeeAvatarStack employees={storeEmployees} /> : null}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, borderRadius: 999, padding: '2px 7px', color: store.isActive ? '#166534' : '#991b1b', border: store.isActive ? '1px solid rgba(34,197,94,0.36)' : '1px solid rgba(248,113,113,0.44)', background: store.isActive ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)' }}>
                        {store.isActive ? t('common.active') : t('common.inactive')}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => navigate(`/negozi/${toStoreSlug(store)}`)}
                        style={{ padding: '4px 8px', fontSize: 11 }}
                      >
                        {t('common.view', 'View')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.12)', fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.92)', textTransform: 'uppercase', letterSpacing: '0.04em', background: 'linear-gradient(135deg, rgba(13,33,55,0.94) 0%, rgba(16,40,66,0.88) 100%)' }}>
            {t('companies.profileDetails', 'Company details')}
          </div>
          <div style={{ padding: 14, display: 'grid', gap: 10 }}>
            <InsightRow label={t('companies.companyId', 'Company ID')} value={`#${company.id}`} />
            {companyInsights
              .filter((item) => Boolean(item.value))
              .map((item) => (
                <InsightRow key={item.label} label={item.label} value={item.value as string} />
              ))}
            <InsightRow label={t('companies.activeStores', 'Active stores')} value={`${activeStores}/${stores.length}`} />
          </div>
        </div>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={t('companies.editCompany', 'Edit Company')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={editSaving}>{t('common.cancel')}</Button>
            <Button onClick={() => void handleSaveEdit()} loading={editSaving}>{t('common.save')}</Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 12 }}>
          {editError ? <Alert variant="danger" onClose={() => setEditError(null)}>{editError}</Alert> : null}

          <Input
            label={t('companies.fieldName', 'Company name *')}
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            disabled={editSaving}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            <Select
              label={t('companies.fieldGroup', 'Business group')}
              value={editGroupId != null ? String(editGroupId) : ''}
              onChange={(event) => {
                const value = event.target.value;
                setEditGroupId(value ? parseInt(value, 10) : null);
              }}
              disabled={editSaving}
            >
              <option value="">{t('companies.optionStandalone', 'Standalone')}</option>
              {companyGroups.map((group) => (
                <option key={group.id} value={String(group.id)}>{group.name}</option>
              ))}
            </Select>

            <CustomSelect
              value={editOwnerUserId || null}
              onChange={(value) => setEditOwnerUserId(value ?? '')}
              options={ownerSelectOptions}
              placeholder={t('companies.currentOwner', 'Current owner')}
              disabled={editSaving || ownerCandidatesLoading}
              searchable
              isClearable
              searchPlaceholder={t('companies.ownerSearchPlaceholder', 'Search admin...')}
              noOptionsMessage={t('companies.ownerNoResults', 'No admin users found')}
            />
          </div>

          <Input
            label={t('companies.registrationNumber', 'Registration number')}
            value={editProfile.registrationNumber}
            onChange={(event) => setEditProfile((prev) => ({ ...prev, registrationNumber: event.target.value }))}
            disabled={editSaving}
          />

          <Input
            label={t('companies.companyEmail', 'Company email')}
            type="email"
            value={editProfile.companyEmail}
            onChange={(event) => setEditProfile((prev) => ({ ...prev, companyEmail: event.target.value }))}
            disabled={editSaving}
          />

          <Input
            label={t('companies.officesLocations', 'Offices locations')}
            value={editProfile.officesLocations}
            onChange={(event) => setEditProfile((prev) => ({ ...prev, officesLocations: event.target.value }))}
            disabled={editSaving}
          />

          <Input
            label={t('companies.currency', 'Currency')}
            value={editProfile.currency}
            onChange={(event) => setEditProfile((prev) => ({ ...prev, currency: event.target.value }))}
            disabled={editSaving}
          />

          <LocationFieldGroup
            value={{
              country: editProfile.country,
              state: editProfile.state,
              city: editProfile.city,
              address: editProfile.address,
              postalCode: '',
              phone: editProfile.companyPhoneNumbers,
            }}
            onChange={(location) => {
              setEditProfile((prev) => ({
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
            disabled={editSaving}
            labels={{
              country: t('companies.country', 'Country'),
              state: t('companies.state', 'State'),
              city: t('companies.city', 'City'),
              address: t('companies.address', 'Address'),
              phone: t('companies.companyPhoneNumbers', 'Company phone numbers'),
            }}
          />
        </div>
      </Modal>

      <Modal
        open={mediaOpen}
        onClose={() => { if (!logoUploading && !bannerUploading) setMediaOpen(false); }}
        title={t('companies.mediaModalTitle', 'Company Media')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mediaError ? <Alert variant="danger" onClose={() => setMediaError(null)}>{mediaError}</Alert> : null}

          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleLogoFile(file);
              event.target.value = '';
            }}
          />
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleBannerFile(file);
              event.target.value = '';
            }}
          />

          <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
            <div style={{ height: 126, background: bannerUrl ? `linear-gradient(180deg, rgba(13,33,55,0.32) 0%, rgba(13,33,55,0.8) 100%), url(${bannerUrl}) center/cover no-repeat` : 'linear-gradient(135deg, rgba(13,33,55,0.9) 0%, rgba(15,118,110,0.7) 100%)' }} />
            <div style={{ padding: '0 14px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: -42 }}>
                <div style={{ width: 84, height: 84, borderRadius: 16, overflow: 'hidden', background: logoUrl ? '#fff' : 'var(--primary)', border: '4px solid var(--surface)', color: '#fff', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {logoUrl ? <img src={logoUrl} alt={company.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(company.name)}
                </div>
                <div style={{ minWidth: 0, paddingBottom: 8 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {company.name}
                  </div>
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>#{company.id}</span>
                    {company.groupName ? (
                      <span style={{ fontSize: 10, color: 'var(--accent)', border: '1px solid rgba(201,151,58,0.34)', background: 'rgba(201,151,58,0.12)', borderRadius: 999, padding: '2px 7px' }}>
                        {company.groupName}
                      </span>
                    ) : null}
                    <span style={{ fontSize: 10, borderRadius: 999, padding: '2px 7px', color: company.isActive ? '#166534' : '#991b1b', border: company.isActive ? '1px solid rgba(34,197,94,0.36)' : '1px solid rgba(248,113,113,0.44)', background: company.isActive ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)' }}>
                      {company.isActive ? t('common.active') : t('common.inactive')}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                {t('companies.mediaPreviewHint', 'Preview updates after each upload')}
              </div>
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-warm)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('companies.bannerField', 'Company banner')}
            </div>
            <div style={{ padding: 12, display: 'grid', gap: 10 }}>
              <div style={{ height: 108, borderRadius: 10, border: '1px solid var(--border)', background: bannerUrl ? `url(${bannerUrl}) center/cover no-repeat` : 'linear-gradient(135deg, rgba(13,33,55,0.86) 0%, rgba(15,118,110,0.7) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                {bannerUrl ? '' : t('companies.bannerEmpty', 'No banner set')}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={bannerUploading || logoUploading}
                  onClick={() => bannerInputRef.current?.click()}
                  style={{ ...mediaActionBtnStyle, flex: 1, minWidth: 140 }}
                >
                  <UploadCloud size={14} />
                  {bannerUploading ? t('companies.bannerUploading', 'Uploading banner...') : bannerActionLabel}
                </button>
                {company.bannerFilename && (
                  <>
                    <button
                      type="button"
                      disabled={bannerUploading || logoUploading}
                      onClick={() => bannerInputRef.current?.click()}
                      style={{ ...mediaActionBtnStyle, flex: 1, minWidth: 120 }}
                    >
                      <Pencil size={14} />
                      {t('companies.editBanner', 'Edit banner')}
                    </button>
                    <button
                      type="button"
                      disabled={bannerUploading || logoUploading}
                      onClick={() => void handleDeleteBanner()}
                      style={{ ...mediaActionBtnStyle, borderColor: 'rgba(185,28,28,0.22)', color: '#991b1b', background: 'rgba(220,38,38,0.08)', minWidth: 130 }}
                    >
                      <Trash2 size={14} />
                      {t('companies.removeBanner', 'Remove banner')}
                    </button>
                  </>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('companies.bannerHint', 'Wide format recommended. Max 4MB.')}</div>
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-warm)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('companies.logoField')}
            </div>
            <div style={{ padding: 12, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 72, height: 72, borderRadius: 14, overflow: 'hidden', background: logoUrl ? '#fff' : 'var(--primary)', border: '1px solid var(--border)', color: '#fff', fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {logoUrl ? <img src={logoUrl} alt={company.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(company.name)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{company.name}</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-muted)' }}>{t('companies.logoHint')}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={logoUploading || bannerUploading}
                  onClick={() => logoInputRef.current?.click()}
                  style={{ ...mediaActionBtnStyle, flex: 1, minWidth: 140 }}
                >
                  <UploadCloud size={14} />
                  {logoUploading ? t('companies.logoUploading') : logoActionLabel}
                </button>
                {company.logoFilename && (
                  <>
                    <button
                      type="button"
                      disabled={logoUploading || bannerUploading}
                      onClick={() => logoInputRef.current?.click()}
                      style={{ ...mediaActionBtnStyle, flex: 1, minWidth: 120 }}
                    >
                      <Pencil size={14} />
                      {t('companies.editLogo', 'Edit logo')}
                    </button>
                    <button
                      type="button"
                      disabled={logoUploading || bannerUploading}
                      onClick={() => void handleDeleteLogo()}
                      style={{ ...mediaActionBtnStyle, borderColor: 'rgba(185,28,28,0.22)', color: '#991b1b', background: 'rgba(220,38,38,0.08)', minWidth: 130 }}
                    >
                      <Trash2 size={14} />
                      {t('companies.removeLogo', 'Remove logo')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={statusConfirmOpen}
        onClose={() => setStatusConfirmOpen(false)}
        title={statusConfirmMode === 'deactivate' ? t('companies.confirmDeactivateTitle') : t('companies.confirmActivateTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusConfirmOpen(false)} disabled={statusBusy}>{t('common.cancel')}</Button>
            {statusConfirmMode === 'deactivate' ? (
              <Button variant="danger" onClick={() => void handleStatusConfirm()} loading={statusBusy} disabled={!deactivateMatches}>{t('common.deactivate')}</Button>
            ) : (
              <Button onClick={() => void handleStatusConfirm()} loading={statusBusy}>{t('common.activate')}</Button>
            )}
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {statusError ? <Alert variant="danger" onClose={() => setStatusError(null)}>{statusError}</Alert> : null}
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>
            {statusConfirmMode === 'deactivate'
              ? t('companies.confirmDeactivateMsg', { name: company.name })
              : t('companies.confirmActivateMsg', { name: company.name })}
          </p>
          {statusConfirmMode === 'deactivate' && (
            <>
              <Input
                label={t('companies.typeNameToDeactivate', 'Type the exact company name to deactivate')}
                value={statusConfirmInput}
                onChange={(event) => setStatusConfirmInput(event.target.value)}
                placeholder={company.name}
                disabled={statusBusy}
              />
              <div style={{ fontSize: 12, color: deactivateMatches ? '#166534' : 'var(--text-muted)' }}>
                {deactivateMatches
                  ? t('companies.deactivateNameMatched', 'Name matches. Deactivation is enabled.')
                  : t('companies.deactivateNameMismatch', 'Name must match exactly to deactivate.')}
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('companies.confirmDeleteTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => void handleDeleteCompany()} loading={deleteBusy} disabled={!deleteMatches}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {deleteError ? <Alert variant="danger" onClose={() => setDeleteError(null)}>{deleteError}</Alert> : null}
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>
            {t('companies.confirmDeleteMsg', { name: company.name })}
          </p>
          <Input
            label={t('companies.typeNameToDelete', 'Type the company name to confirm deletion')}
            value={deleteInput}
            onChange={(event) => setDeleteInput(event.target.value)}
            placeholder={company.name}
            disabled={deleteBusy}
          />
          <div style={{ fontSize: 12, color: deleteMatches ? '#166534' : 'var(--text-muted)' }}>
            {deleteMatches
              ? t('companies.deleteNameMatched', 'Name matches. Delete action is enabled.')
              : t('companies.deleteNameMismatch', 'Name must match exactly to continue.')}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ManagerAvatar({ employee }: { employee: Employee }) {
  const avatarUrl = getAvatarUrl(employee.avatarFilename);
  const initialsLabel = `${employee.name?.[0] ?? ''}${employee.surname?.[0] ?? ''}`.toUpperCase() || 'SM';
  return (
    <span style={{ width: 18, height: 18, borderRadius: '50%', overflow: 'hidden', background: '#8B6914', color: '#fff', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={`${employee.name} ${employee.surname}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : initialsLabel}
    </span>
  );
}

function InfoChip({ icon, label, value, avatarUrl, endSlot }: { icon: React.ReactNode; label: string; value: React.ReactNode; avatarUrl?: string | null; endSlot?: React.ReactNode }) {
  const valueNode = typeof value === 'string' ? (
    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
  ) : (
    value
  );

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px', background: 'var(--surface-warm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {icon}
        {label}
      </div>
      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          {avatarUrl ? (
            <span style={{ width: 18, height: 18, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
              <img src={avatarUrl} alt={typeof value === 'string' ? value : label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </span>
          ) : null}
          <span style={{ minWidth: 0 }}>{valueNode}</span>
        </div>
        {endSlot ? <div style={{ flexShrink: 0 }}>{endSlot}</div> : null}
      </div>
    </div>
  );
}

function EmployeeAvatarStack({ employees }: { employees: Employee[] }) {
  if (employees.length === 0) {
    return null;
  }

  const visible = employees.slice(0, 6);
  const remaining = Math.max(employees.length - visible.length, 0);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {visible.map((employee, index) => {
        const avatarUrl = getAvatarUrl(employee.avatarFilename);
        const initialsLabel = `${employee.name?.[0] ?? ''}${employee.surname?.[0] ?? ''}`.toUpperCase() || 'U';
        return (
          <span
            key={employee.id}
            title={`${employee.name} ${employee.surname}`}
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              border: '1.5px solid var(--surface)',
              overflow: 'hidden',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#8B6914',
              color: '#fff',
              fontSize: 9,
              fontWeight: 700,
              marginLeft: index === 0 ? 0 : -6,
              boxShadow: '0 0 0 1px rgba(13,33,55,0.08)',
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={`${employee.name} ${employee.surname}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : initialsLabel}
          </span>
        );
      })}
      {remaining > 0 ? (
        <span
          title={`${employees.length}`}
          style={{
            width: 24,
            height: 20,
            borderRadius: '50%',
            border: '1.5px solid var(--surface)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(13,33,55,0.85)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 800,
            marginLeft: -6,
          }}
        >
          7+
        </span>
      ) : null}
    </span>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

const mediaActionBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 10,
  background: 'var(--surface-warm)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
  padding: '9px 12px',
};
