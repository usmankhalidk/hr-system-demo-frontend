import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ReactCountryFlag from 'react-country-flag';
import { useAuth } from '../../context/AuthContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useToast } from '../../context/ToastContext';
import { getStores, createStore, updateStore, deactivateStore, activateStore, deleteStorePermanent } from '../../api/stores';
import { getCompanies } from '../../api/companies';
import { getCompanyLogoUrl, getAvatarUrl, getStoreLogoUrl } from '../../api/client';
import { translateApiError } from '../../utils/apiErrors';
import { Company, Store } from '../../types';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import { Select } from '../../components/ui/Select';
import CustomSelect, { SelectOption } from '../../components/ui/CustomSelect';
import { LocationFieldGroup } from '../../components/location';
import { TimezoneOptionContent } from '../../components/timezone/TimezoneOptionContent';
import { Eye, EyeOff, RefreshCw, Link as LinkIcon, Unlink, Database, CheckCircle, XCircle, Search } from 'lucide-react';
import {
  getBrowserTimeZone,
  getPreferredTimezoneForCountry,
  getTimezoneOptionValues,
} from '../../utils/timezone';
import { getCountryDisplayName } from '../../utils/country';
import {
  getExternalOverview,
  listExternalDepositi,
  listExternalMappings,
  upsertExternalMapping,
  deleteExternalMapping,
  ExternalDepositoRow,
  ExternalDbOverview,
} from '../../api/externalAffluence';

interface StoreFormData {
  name: string;
  code: string;
  address: string;
  cap: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  timezone: string;
  maxStaff: string;
}

const emptyForm: StoreFormData = {
  name: '',
  code: '',
  address: '',
  cap: '',
  city: '',
  state: '',
  country: '',
  phone: '',
  timezone: '',
  maxStaff: '',
};

interface FormErrors {
  name?: string;
  code?: string;
  companyId?: string;
}

// Words to skip when deriving a store code from the name
const SKIP_WORDS = new Set([
  'negozio', 'store', 'shop', 'il', 'la', 'lo', 'le', 'gli', 'i',
  'di', 'del', 'della', 'dei', 'delle', 'degli', 'the', 'a', 'an',
]);

function generateStoreCode(name: string, existingCodes: string[]): string {
  const words = name.trim().split(/\s+/);
  const meaningful = words.find((w) => {
    const clean = w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return clean.length >= 2 && !SKIP_WORDS.has(clean);
  });
  if (!meaningful) return '';

  const prefix = meaningful
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 3)
    .toUpperCase();

  if (prefix.length < 2) return '';

  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const nums = existingCodes
    .map((c) => { const m = c.match(pattern); return m ? parseInt(m[1], 10) : NaN; })
    .filter((n) => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${String(next).padStart(2, '0')}`;
}

const COMPANY_AVATAR_PALETTE = ['#0D2137', '#163352', '#8B6914', '#1B4D3E', '#2C5282', '#5B2333'];

function getCompanyAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COMPANY_AVATAR_PALETTE[Math.abs(hash) % COMPANY_AVATAR_PALETTE.length];
}

function getCompanyInitials(name?: string): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function getStoreInitials(name?: string): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
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

export function StoreList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { isMobile } = useBreakpoint();
  const isAdmin = user?.role === 'admin';
  const isAdminOrHr = user?.role === 'admin' || user?.role === 'hr';
  const isSuperAdmin = user?.isSuperAdmin === true;

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [formCompanyId, setFormCompanyId] = useState<number | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState<StoreFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);
  const [terminalPassword, setTerminalPassword] = useState('');
  const [terminalPasswordVisible, setTerminalPasswordVisible] = useState(false);
  const [terminalPasswordError, setTerminalPasswordError] = useState<string | null>(null);
  // true while the code field shows an auto-suggested value (new form only)
  const codeIsAuto = useRef(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deactivatingStore, setDeactivatingStore] = useState<Store | null>(null);
  const [deactivateInput, setDeactivateInput] = useState('');
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const [activateOpen, setActivateOpen] = useState(false);
  const [activatingStore, setActivatingStore] = useState<Store | null>(null);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingStore, setDeletingStore] = useState<Store | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);

  // External database integration state (Step 2)
  const [externalDbOverview, setExternalDbOverview] = useState<ExternalDbOverview | null>(null);
  const [externalStores, setExternalStores] = useState<ExternalDepositoRow[]>([]);
  const [externalStoresLoading, setExternalStoresLoading] = useState(false);
  const [externalStoresError, setExternalStoresError] = useState<string | null>(null);
  const [externalSearchQuery, setExternalSearchQuery] = useState('');
  const [externalStoreCode, setExternalStoreCode] = useState('');
  const [externalStoreName, setExternalStoreName] = useState('');
  const [integrationLoading, setIntegrationLoading] = useState(false);
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [currentMapping, setCurrentMapping] = useState<{ externalStoreCode: string; externalStoreName: string | null } | null>(null);
  const [createdStoreId, setCreatedStoreId] = useState<number | null>(null);

  const browserTimezone = useMemo(() => getBrowserTimeZone(), []);

  const timezoneOptions = useMemo<SelectOption[]>(() => {
    return getTimezoneOptionValues([formData.timezone, browserTimezone]).map((timezone) => ({
      value: timezone,
      label: timezone,
      render: <TimezoneOptionContent timezone={timezone} />,
    }));
  }, [browserTimezone, formData.timezone]);

  const loadStores = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStores();
      setStores(data);
    } catch {
      setError(t('stores.errorLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
  }, []);

  // Load companies for any admin/HR so grouped users can pick a target company
  useEffect(() => {
    if (!isAdminOrHr) return;
    setCompaniesLoading(true);
    getCompanies()
      .then(setCompanies)
      .catch(() => setCompanies([]))
      .finally(() => setCompaniesLoading(false));
  }, [isAdminOrHr]);

  const openNewForm = () => {
    setEditingStore(null);
    setFormData({ ...emptyForm, timezone: browserTimezone });
    setFormErrors({});
    setFormError(null);
    // Super-admin has no default company; require explicit selection.
    // Grouped admin/hr default to their own company.
    setFormCompanyId(isSuperAdmin ? null : (user?.companyId ?? null));
    codeIsAuto.current = true;
    setFormStep(1);
    setTerminalPassword('');
    setTerminalPasswordVisible(false);
    setTerminalPasswordError(null);
    // Reset external integration state
    setExternalDbOverview(null);
    setExternalStores([]);
    setExternalStoresError(null);
    setExternalSearchQuery('');
    setExternalStoreCode('');
    setExternalStoreName('');
    setIntegrationError(null);
    setCurrentMapping(null);
    setCreatedStoreId(null);
    setFormOpen(true);
  };

  const openEditForm = async (store: Store) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      code: store.code,
      address: store.address ?? '',
      cap: store.cap ?? '',
      city: store.city ?? '',
      state: store.state ?? '',
      country: store.country ?? '',
      phone: store.phone ?? '',
      timezone: store.timezone ?? getPreferredTimezoneForCountry(store.country, browserTimezone),
      maxStaff: store.maxStaff != null ? String(store.maxStaff) : '',
    });
    setFormErrors({});
    setFormError(null);
    codeIsAuto.current = false;
    setFormStep(1);
    // Reset external integration state
    setExternalDbOverview(null);
    setExternalStores([]);
    setExternalStoresError(null);
    setExternalSearchQuery('');
    setExternalStoreCode('');
    setExternalStoreName('');
    setIntegrationError(null);
    setCurrentMapping(null);
    setCreatedStoreId(store.id);
    
    // Load existing mapping if any
    try {
      const targetCompanyId = store.companyId;
      const mappings = await listExternalMappings(targetCompanyId);
      const existingMapping = mappings.find(m => m.localStoreId === store.id && m.isActive);
      if (existingMapping) {
        setCurrentMapping({
          externalStoreCode: existingMapping.externalStoreCode,
          externalStoreName: existingMapping.externalStoreName,
        });
      }
    } catch (err) {
      // Silently fail - user can still integrate manually
      console.error('Failed to load existing mapping:', err);
    }
    
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormStep(1);
    setEditingStore(null);
    setFormData(emptyForm);
    setFormErrors({});
    setFormError(null);
    setTerminalPasswordError(null);
    codeIsAuto.current = false;
    setFormCompanyId(null);
    // Reset external integration state
    setExternalDbOverview(null);
    setExternalStores([]);
    setExternalStoresError(null);
    setExternalSearchQuery('');
    setExternalStoreCode('');
    setExternalStoreName('');
    setIntegrationError(null);
    setCurrentMapping(null);
    setCreatedStoreId(null);
  };

  // Show company selector when multiple companies are available (grouped admin/HR + super admin)
  const showCompanyPicker = companies.length > 1;
  const selectedCompany = companies.find((c) => c.id === formCompanyId) ?? null;

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!formData.name.trim()) errors.name = t('stores.validationName');
    if (!formData.code.trim()) errors.code = t('stores.validationCode');
    if (showCompanyPicker && !editingStore && !formCompanyId) errors.companyId = t('stores.validationCompany');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let newPassword = '';
    for (let i = 0; i < 12; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTerminalPassword(newPassword);
    setTerminalPasswordError(null);
  };

  const getTerminalEmail = () => {
    const storeName = formData.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    let companyName = '';
    if (formCompanyId) {
      companyName = companies.find((c) => c.id === formCompanyId)?.name || 'company';
    } else {
      companyName = companies[0]?.name || 'company';
    }
    companyName = companyName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${storeName || 'store'}@${companyName}.com`;
  };

  const validateTerminal = (): boolean => {
    if (!terminalPassword || terminalPassword.length < 8) {
      setTerminalPasswordError('Password must be at least 8 characters');
      return false;
    }
    setTerminalPasswordError(null);
    return true;
  };

  const handleNext = () => {
    if (!validateForm()) return;
    if (!terminalPassword) {
      // Auto-generate and reveal the password so user can note it down
      generatePassword();
      setTerminalPasswordVisible(true);
    }
    setFormStep(2);
  };

  const handleNextToIntegration = () => {
    setFormStep(3);
    loadExternalDbData();
  };

  const handleSkipClick = () => {
    setSkipConfirmOpen(true);
  };

  const handleConfirmSkip = () => {
    setSkipConfirmOpen(false);
    handleSave(true);
  };

  // Load external database overview and stores for Step 2
  const loadExternalDbData = async () => {
    setExternalStoresLoading(true);
    setExternalStoresError(null);
    try {
      const targetCompanyId = formCompanyId ?? user?.companyId;
      const [overview, depositiRows] = await Promise.all([
        getExternalOverview(targetCompanyId ?? undefined),
        listExternalDepositi({ targetCompanyId: targetCompanyId ?? undefined, limit: 300 }),
      ]);
      setExternalDbOverview(overview);
      setExternalStores(depositiRows);
    } catch (err) {
      setExternalStoresError(translateApiError(err, t, t('externalAffluence.errorLoadStores')));
    } finally {
      setExternalStoresLoading(false);
    }
  };

  // Search external stores
  const handleExternalSearch = async () => {
    if (!externalSearchQuery.trim()) {
      loadExternalDbData();
      return;
    }
    setExternalStoresLoading(true);
    setExternalStoresError(null);
    try {
      const targetCompanyId = formCompanyId ?? user?.companyId;
      const depositiRows = await listExternalDepositi({
        search: externalSearchQuery.trim(),
        targetCompanyId: targetCompanyId ?? undefined,
        limit: 300,
      });
      setExternalStores(depositiRows);
    } catch (err) {
      setExternalStoresError(translateApiError(err, t, t('externalAffluence.errorLoadStores')));
    } finally {
      setExternalStoresLoading(false);
    }
  };

  // Integrate store with external database
  const handleIntegrateStore = async () => {
    if (!externalStoreCode.trim()) {
      setIntegrationError(t('externalAffluence.externalStoreCodeRequired'));
      return;
    }

    const storeId = createdStoreId ?? editingStore?.id;
    if (!storeId) {
      setIntegrationError(t('externalAffluence.storeNotFound'));
      return;
    }

    setIntegrationLoading(true);
    setIntegrationError(null);
    try {
      const targetCompanyId = formCompanyId ?? user?.companyId;
      await upsertExternalMapping(storeId, {
        externalStoreCode: externalStoreCode.trim(),
        targetCompanyId: targetCompanyId ?? undefined,
      });
      setCurrentMapping({
        externalStoreCode: externalStoreCode.trim(),
        externalStoreName: externalStoreName.trim() || null,
      });
      setExternalStoreCode('');
      setExternalStoreName('');
      showToast(t('externalAffluence.integrationSuccess'), 'success');
    } catch (err) {
      setIntegrationError(translateApiError(err, t, t('externalAffluence.errorIntegration')));
    } finally {
      setIntegrationLoading(false);
    }
  };

  // Remove integration
  const handleRemoveIntegration = async () => {
    const storeId = createdStoreId ?? editingStore?.id;
    if (!storeId) return;

    setIntegrationLoading(true);
    setIntegrationError(null);
    try {
      const targetCompanyId = formCompanyId ?? user?.companyId;
      await deleteExternalMapping(storeId, targetCompanyId ?? undefined);
      setCurrentMapping(null);
      showToast(t('externalAffluence.integrationRemoved'), 'success');
    } catch (err) {
      setIntegrationError(translateApiError(err, t, t('externalAffluence.errorRemoveIntegration')));
    } finally {
      setIntegrationLoading(false);
    }
  };

  const handleSave = async (skipTerminal: boolean = false) => {
    if (editingStore) {
      if (!validateForm()) return;
    } else if (!skipTerminal) {
      if (!validateTerminal()) return;
    }
    setFormSaving(true);
    setFormError(null);
    try {
      const payload: Partial<Store> = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        address: formData.address.trim() || null,
        cap: formData.cap.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
        country: formData.country.trim() || null,
        phone: formData.phone.trim() || null,
        timezone: (formData.timezone || getPreferredTimezoneForCountry(formData.country, browserTimezone)).trim(),
        maxStaff: formData.maxStaff ? parseInt(formData.maxStaff, 10) : 0,
      };

      // Cross-company store creation: send the target company
      if (showCompanyPicker && !editingStore && formCompanyId != null) {
        payload.companyId = formCompanyId;
      }
      if (editingStore) {
        await updateStore(editingStore.id, payload);
        showToast(t('stores.updatedSuccess'), 'success');
        closeForm();
        await loadStores();
      } else {
        const terminalPayload = skipTerminal
          ? undefined
          : { email: getTerminalEmail(), password: terminalPassword };

        if (!skipTerminal && !terminalPassword) {
          setFormError('Terminal password is required');
          setFormSaving(false);
          return;
        }

        const createdStore = await createStore({
          ...payload,
          terminal: terminalPayload
        });
        showToast(t('stores.createdSuccess'), 'success');
        
        // Store the created store ID and move to step 3 for integration
        setCreatedStoreId(createdStore.id);
        setFormStep(3);
        await loadExternalDbData();
      }
    } catch (err: unknown) {
      setFormError(translateApiError(err, t, t('stores.errorSave')));
    } finally {
      setFormSaving(false);
    }
  };

  const openDelete = (store: Store) => {
    setDeletingStore(store);
    setDeleteError(null);
    setDeleteOpen(true);
  };

  const closeDelete = () => {
    setDeleteOpen(false);
    setDeletingStore(null);
    setDeleteError(null);
  };

  const handleDeletePermanent = async () => {
    if (!deletingStore) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteStorePermanent(deletingStore.id);
      showToast(t('stores.deletedSuccess'), 'success');
      closeDelete();
      await loadStores();
    } catch (err: unknown) {
      setDeleteError(translateApiError(err, t, t('stores.errorDelete')));
    } finally {
      setDeleting(false);
    }
  };

  const openActivate = (store: Store) => {
    setActivatingStore(store);
    setActivateError(null);
    setActivateOpen(true);
  };

  const closeActivate = () => {
    setActivateOpen(false);
    setActivatingStore(null);
    setActivateError(null);
  };

  const handleActivate = async () => {
    if (!activatingStore) return;
    setActivating(true);
    setActivateError(null);
    try {
      await activateStore(activatingStore.id);
      showToast(t('stores.activatedSuccess'), 'success');
      closeActivate();
      await loadStores();
    } catch (err: unknown) {
      setActivateError(translateApiError(err, t, t('stores.errorActivate')));
    } finally {
      setActivating(false);
    }
  };

  const openConfirm = (store: Store) => {
    setDeactivatingStore(store);
    setDeactivateInput('');
    setDeactivateError(null);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setDeactivatingStore(null);
    setDeactivateInput('');
    setDeactivateError(null);
  };

  const handleDeactivate = async () => {
    if (!deactivatingStore) return;
    if (deactivateInput.trim() !== deactivatingStore.name) {
      setDeactivateError(t('stores.deactivateNameError', 'Type the exact store name to confirm deactivation.'));
      return;
    }
    setDeactivating(true);
    setDeactivateError(null);
    try {
      await deactivateStore(deactivatingStore.id);
      showToast(t('stores.deactivatedSuccess'), 'success');
      closeConfirm();
      await loadStores();
    } catch (err: unknown) {
      setDeactivateError(translateApiError(err, t, t('stores.errorDeactivate')));
    } finally {
      setDeactivating(false);
    }
  };

  const columns: Column<Store>[] = [
    ...(isSuperAdmin || stores.some((s) => !!s.companyName) ? [{
      key: 'companyName' as keyof Store,
      label: t('stores.colCompany'),
      render: (row: Store) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            overflow: 'hidden',
            background: row.companyName ? getCompanyAvatarColor(row.companyName) : 'var(--border)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {row.companyLogoFilename ? (
              <img
                src={getCompanyLogoUrl(row.companyLogoFilename) ?? ''}
                alt={row.companyName ?? 'Company'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              getCompanyInitials(row.companyName)
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '13px',
                color: row.companyName ? 'var(--text-secondary)' : 'var(--text-disabled)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 600,
              }}
              title={row.companyName ?? undefined}
            >
              {row.companyName ?? '—'}
            </div>
            {row.groupName ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.groupName}>
                {row.groupName}
              </div>
            ) : null}
          </div>
        </div>
      ),
    }] : []),
    {
      key: 'name',
      label: t('stores.colName'),
      render: (row) => {
        const logoUrl = getCompanyLogoUrl(row.companyLogoFilename);
        const countryLabel = getCountryDisplayName(row.country);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              overflow: 'hidden',
              border: '1px solid var(--border)',
              background: logoUrl ? '#fff' : 'rgba(13,33,55,0.08)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {logoUrl ? (
                <img src={logoUrl} alt={row.companyName ?? row.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)' }}>{getStoreInitials(row.name)}</span>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.name}>
                {truncateText(row.name, 16)}
              </div>
              {(row.country || countryLabel) ? (
                <div style={{ marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  {row.country ? <ReactCountryFlag countryCode={row.country} svg style={{ width: '0.95em', height: '0.95em' }} /> : null}
                  <span>{truncateText(countryLabel ?? row.country ?? '—', 24)}</span>
                </div>
              ) : null}
            </div>
          </div>
        );
      },
    },
    { key: 'code', label: t('stores.colCode') },
    { key: 'address', label: t('stores.colAddress'), render: (row) => truncateText(row.address ?? '—', 24) },
    { key: 'cap', label: t('stores.colCap'), render: (row) => row.cap ?? '—' },
    { key: 'maxStaff', label: t('stores.colMaxStaff'), render: (row) => String(row.maxStaff) },
    { key: 'employeeCount', label: t('stores.colEmployees'), render: (row) => String(row.employeeCount ?? 0) },
    {
      key: 'isActive',
      label: t('stores.colStatus'),
      render: (row) =>
        row.isActive ? (
          <Badge variant="success">{t('common.active')}</Badge>
        ) : (
          <Badge variant="danger">{t('common.inactive')}</Badge>
        ),
    },
    {
      key: 'actions',
      label: t('stores.colActions'),
      render: (row) => {
        return (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => navigate(`/negozi/${toStoreSlug(row)}`)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600, color: 'var(--accent)',
                fontFamily: 'var(--font-body)', padding: '5px 10px',
                borderRadius: 'var(--radius-sm)', display: 'inline-flex',
                alignItems: 'center', gap: '3px', whiteSpace: 'nowrap',
              }}
            >
              {t('common.open')} →
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="page-enter" style={{ width: '100%' }}>
      <div style={{
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            margin: '0 0 3px',
            letterSpacing: '-0.02em',
          }}>
            {t('stores.title')}
          </h1>
          {!loading && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              {stores.length > 0
                ? t('common.showingResults', { from: 1, to: stores.length, total: stores.length })
                : t('common.noData')}
            </p>
          )}
        </div>
        {isAdminOrHr && (
          <Button onClick={openNewForm}>{t('stores.newStore')}</Button>
        )}
      </div>

      {error && (
        <div style={{ marginBottom: '16px' }}>
          <Alert variant="danger" title={t('common.error')} onClose={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      <Table<Store>
        columns={columns}
        data={stores}
        loading={loading}
        emptyText={t('stores.noStores')}
      />

      {/* Create / Edit Modal */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {editingStore
                ? (formStep === 1 ? t('stores.editStore') : t('stores.storeIntegration'))
                : (formStep === 1 ? t('stores.newStore') : formStep === 2 ? 'Store Terminal' : t('stores.storeIntegration'))
              }
            </div>
            {/* Step Indicators - Show in both create and edit mode */}
            {editingStore ? (
              /* Edit mode: 2 steps */
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {[1, 2].map((s) => (
                  <React.Fragment key={s}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: formStep === s ? 'var(--accent)' : formStep > s ? '#10B981' : 'var(--border)',
                      color: formStep >= s ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.25s ease',
                      boxShadow: formStep === s ? '0 0 0 3px rgba(13,33,55,0.12)' : 'none',
                    }}>
                      {formStep > s ? '✓' : s}
                    </div>
                    {s < 2 && (
                      <div style={{
                        flex: 1,
                        height: '2px',
                        background: formStep > s ? '#10B981' : 'var(--border)',
                        transition: 'background 0.25s ease',
                      }} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              /* Create mode: 3 steps */
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {[1, 2, 3].map((s) => (
                  <React.Fragment key={s}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: formStep === s ? 'var(--accent)' : formStep > s ? '#10B981' : 'var(--border)',
                      color: formStep >= s ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.25s ease',
                      boxShadow: formStep === s ? '0 0 0 3px rgba(13,33,55,0.12)' : 'none',
                    }}>
                      {formStep > s ? '✓' : s}
                    </div>
                    {s < 3 && (
                      <div style={{
                        flex: 1,
                        height: '2px',
                        background: formStep > s ? '#10B981' : 'var(--border)',
                        transition: 'background 0.25s ease',
                      }} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        }
        footer={
          <>
            {editingStore && formStep === 2 ? (
              <>
                <Button variant="secondary" onClick={() => setFormStep(1)}>
                  ← {t('common.back')}
                </Button>
                <Button variant="secondary" onClick={async () => { closeForm(); await loadStores(); }}>
                  {t('common.close')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={closeForm} disabled={formSaving || integrationLoading}>
                  {formStep === 3 ? t('common.close') : t('common.cancel')}
                </Button>
                {editingStore ? (
                  formStep === 1 ? (
                    <>
                      <Button onClick={() => handleSave()} loading={formSaving}>
                        {t('common.save')}
                      </Button>
                      <Button variant="secondary" onClick={async () => { setFormStep(2); await loadExternalDbData(); }}>
                        {t('stores.goToIntegration')} →
                      </Button>
                    </>
                  ) : null
                ) : formStep === 1 ? (
                  <Button onClick={() => handleNext()}>
                    {t('common.next')}
                  </Button>
                ) : formStep === 2 ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="secondary" onClick={() => handleSkipClick()} disabled={formSaving}>
                      {t('stores.skipTerminal')}
                    </Button>
                    <Button onClick={() => handleSave()} loading={formSaving}>
                      {t('common.save')}
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" onClick={async () => { closeForm(); await loadStores(); }}>
                    {t('stores.skipIntegration')}
                  </Button>
                )}
              </>
            )}
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && (
            <Alert variant="danger" onClose={() => setFormError(null)}>
              {formError}
            </Alert>
          )}

          {(formStep === 3 || (editingStore && formStep === 2)) ? (
            /* ========== STEP 2/3: External Database Integration ========== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Database Connection Status */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                padding: '16px',
                background: 'var(--surface-50)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={16} color="var(--text-muted)" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {t('externalAffluence.internalDatabase')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {externalDbOverview?.connections.internal.ok ? (
                      <CheckCircle size={14} color="#10B981" />
                    ) : (
                      <XCircle size={14} color="#EF4444" />
                    )}
                    <span style={{ fontSize: '13px', fontWeight: 600, color: externalDbOverview?.connections.internal.ok ? '#10B981' : '#EF4444' }}>
                      {externalDbOverview?.connections.internal.ok ? t('common.connected') : t('common.disconnected')}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {externalDbOverview?.databases.internal.databaseName ?? '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={16} color="var(--text-muted)" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {t('externalAffluence.externalDatabase')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {externalDbOverview?.connections.external.ok ? (
                      <CheckCircle size={14} color="#10B981" />
                    ) : (
                      <XCircle size={14} color="#EF4444" />
                    )}
                    <span style={{ fontSize: '13px', fontWeight: 600, color: externalDbOverview?.connections.external.ok ? '#10B981' : '#EF4444' }}>
                      {externalDbOverview?.connections.external.ok ? t('common.connected') : t('common.disconnected')}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {externalDbOverview?.databases.external.databaseName ?? '—'}
                  </span>
                </div>
              </div>

              {/* Company Info - ATS Style */}
              {selectedCompany && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                    🏢 {t('common.company', 'Company')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--background)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    {selectedCompany.logoFilename && getCompanyLogoUrl(selectedCompany.logoFilename) ? (
                      <img 
                        src={getCompanyLogoUrl(selectedCompany.logoFilename) || ''} 
                        alt={selectedCompany.name}
                        style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: 'var(--primary)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 14,
                      }}>
                        {selectedCompany.name?.[0]?.toUpperCase() || 'C'}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedCompany.name}
                        </span>
                        {selectedCompany.country && (
                          <ReactCountryFlag 
                            countryCode={selectedCompany.country} 
                            svg 
                            style={{ width: '0.9em', height: '0.9em', flexShrink: 0 }} 
                          />
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {selectedCompany.groupName && (
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
                            {selectedCompany.groupName}
                          </span>
                        )}
                        {(selectedCompany.ownerName || selectedCompany.ownerSurname) && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            {selectedCompany.ownerAvatarFilename && getAvatarUrl(selectedCompany.ownerAvatarFilename) ? (
                              <img 
                                src={getAvatarUrl(selectedCompany.ownerAvatarFilename) || ''} 
                                alt={`${selectedCompany.ownerName} ${selectedCompany.ownerSurname}`}
                                style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }}
                              />
                            ) : (
                              <div style={{
                                width: 14, height: 14, borderRadius: '50%',
                                background: 'var(--primary)', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 7, fontWeight: 700,
                              }}>
                                {selectedCompany.ownerName?.[0]?.toUpperCase() || 'O'}
                              </div>
                            )}
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                              {selectedCompany.ownerName} {selectedCompany.ownerSurname}
                            </span>
                          </div>
                        )}
                        {selectedCompany.storeCount != null && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            · {selectedCompany.storeCount} {t('employees.storesLabel', 'Stores')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Store Info - ATS Style */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                  🏪 {t('stores.colName', 'Store')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--background)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  {(editingStore?.logoFilename || createdStoreId) && getStoreLogoUrl(editingStore?.logoFilename) ? (
                    <img 
                      src={getStoreLogoUrl(editingStore?.logoFilename) || ''} 
                      alt={formData.name}
                      style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: 'var(--accent)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 14,
                    }}>
                      {formData.name?.[0]?.toUpperCase() || 'S'}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formData.name}
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        background: 'var(--surface-50)',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}>
                        {formData.code}
                      </span>
                      {formData.country && (
                        <ReactCountryFlag 
                          countryCode={formData.country} 
                          svg 
                          style={{ width: '0.9em', height: '0.9em' }} 
                        />
                      )}
                    </div>
                    {formData.city && (
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                        {formData.city}{formData.state ? `, ${formData.state}` : ''}{formData.country ? ` · ${formData.country}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Integration Section */}
              {integrationError && (
                <Alert variant="danger" onClose={() => setIntegrationError(null)}>
                  {integrationError}
                </Alert>
              )}

              {currentMapping ? (
                /* Show current integration */
                <div style={{
                  padding: '16px',
                  background: '#F0FDF4',
                  borderRadius: '8px',
                  border: '1px solid #86EFAC',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle size={18} color="#10B981" />
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#10B981' }}>
                        {t('externalAffluence.integrationActive')}
                      </span>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleRemoveIntegration}
                      loading={integrationLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Unlink size={14} />
                      {t('common.remove')}
                    </Button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {t('externalAffluence.externalStoreCode')}
                      </span>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#047857', marginTop: '2px' }}>
                        {currentMapping.externalStoreCode}
                      </div>
                    </div>
                    {currentMapping.externalStoreName && (
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t('externalAffluence.externalStoreName')}
                        </span>
                        <div style={{ fontSize: '13px', color: '#047857', marginTop: '2px' }}>
                          {currentMapping.externalStoreName}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Show integration form */
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <Input
                      label={t('externalAffluence.externalStoreCode') + ' *'}
                      value={externalStoreCode}
                      onChange={(e) => setExternalStoreCode(e.target.value.trim())}
                      placeholder={t('externalAffluence.placeholderStoreCode')}
                    />
                    <Input
                      label={t('externalAffluence.externalStoreName')}
                      value={externalStoreName}
                      onChange={(e) => setExternalStoreName(e.target.value)}
                      placeholder={t('externalAffluence.placeholderStoreName')}
                    />
                  </div>
                  <Button
                    onClick={handleIntegrateStore}
                    loading={integrationLoading}
                    disabled={!externalStoreCode.trim()}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                  >
                    <LinkIcon size={16} />
                    {t('externalAffluence.integrateStore')}
                  </Button>
                </>
              )}

              {/* External Stores Table */}
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                  {t('externalAffluence.availableExternalStores')}
                </div>
                
                {/* Search Bar */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <Input
                    value={externalSearchQuery}
                    onChange={(e) => setExternalSearchQuery(e.target.value)}
                    placeholder={t('externalAffluence.searchStores')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleExternalSearch();
                    }}
                  />
                  <Button onClick={handleExternalSearch} loading={externalStoresLoading}>
                    <Search size={16} />
                  </Button>
                </div>

                {externalStoresError && (
                  <Alert variant="danger" onClose={() => setExternalStoresError(null)}>
                    {externalStoresError}
                  </Alert>
                )}

                {externalStoresLoading ? (
                  <div style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {t('common.loading')}...
                    </div>
                  </div>
                ) : externalStores.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    {t('externalAffluence.noExternalStores')}
                  </div>
                ) : (
                  <div style={{
                    maxHeight: '300px',
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-50)', zIndex: 1 }}>
                        <tr>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {t('externalAffluence.storeCode')}
                          </th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {t('externalAffluence.storeName')}
                          </th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {t('externalAffluence.companyName')}
                          </th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {t('externalAffluence.dataAvailable')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {externalStores.map((store, idx) => (
                          <tr
                            key={idx}
                            style={{
                              cursor: 'pointer',
                              background: '#fff',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-50)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                            onClick={() => {
                              setExternalStoreCode(store.externalStoreCode);
                              setExternalStoreName(store.storeName ?? '');
                            }}
                          >
                            <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)' }}>
                              {store.externalStoreCode}
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)' }}>
                              {store.storeName ?? '—'}
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                              {store.companyName ?? '—'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', borderBottom: '1px solid var(--border-light)' }}>
                              {store.availableDays > 0 ? (
                                <span style={{ color: '#10B981', fontWeight: 600 }}>
                                  {store.availableDays} {t('common.days')}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : formStep === 2 && !editingStore ? (
            /* ========== STEP 2: Terminal Setup (Create Mode Only) ========== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {t('stores.terminalDescription', "It's the terminal that employees use to scan QR codes from their mobile devices.")}
              </div>
              
              <Input
                label="Terminal Email"
                value={getTerminalEmail()}
                readOnly
                onChange={() => {}} // noop to avoid react warnings
                style={{ backgroundColor: 'var(--surface-50)' }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Temporary password *
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Input
                      type={terminalPasswordVisible ? 'text' : 'password'}
                      value={terminalPassword}
                      onChange={(e) => {
                        setTerminalPassword(e.target.value);
                        if (terminalPasswordError) setTerminalPasswordError(null);
                      }}
                      placeholder="Enter password..."
                      style={{
                        paddingRight: '40px',
                        borderColor: terminalPasswordError ? '#DC2626' : undefined,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setTerminalPasswordVisible(!terminalPasswordVisible)}
                      style={{
                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                        padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      {terminalPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Button variant="secondary" onClick={() => { generatePassword(); setTerminalPasswordVisible(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={14} /> Generate
                  </Button>
                </div>
                {terminalPasswordError ? (
                  <p style={{ margin: 0, fontSize: '12px', color: '#DC2626', fontWeight: 600 }}>
                    {terminalPasswordError}
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                    {t('users.passwordHint', 'At least 8 characters. Save it — it will not be shown again.')}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* ========== STEP 1: Store Details ========== */
            <>
          {showCompanyPicker && !editingStore && (
            <div>
              <Select
                label={t('stores.fieldCompany')}
                value={formCompanyId ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  setFormCompanyId(raw ? parseInt(raw, 10) : null);
                }}
                disabled={formSaving || companiesLoading}
              >
                <option value="">{t('stores.placeholderCompany')}</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {formErrors.companyId && (
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#DC2626', fontWeight: 600 }}>
                  {formErrors.companyId}
                </p>
              )}
            </div>
          )}
          <Input
            label={t('stores.fieldName')}
            value={formData.name}
            onChange={(e) => {
              const name = e.target.value;
              setFormData((prev) => {
                if (codeIsAuto.current) {
                  const existingCodes = stores
                    .filter((s) => !editingStore || s.id !== editingStore.id)
                    .map((s) => s.code);
                  const suggested = generateStoreCode(name, existingCodes);
                  return { ...prev, name, code: suggested };
                }
                return { ...prev, name };
              });
            }}
            error={formErrors.name}
            placeholder={t('stores.placeholderName')}
          />
          <div>
            <Input
              label={t('stores.fieldCode')}
              value={formData.code}
              onChange={(e) => {
                codeIsAuto.current = false;
                setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }));
              }}
              error={formErrors.code}
              placeholder={t('stores.placeholderCode')}
            />
            {codeIsAuto.current && formData.code && (
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                {t('stores.codeAutoHint')}
              </p>
            )}
          </div>
          <LocationFieldGroup
            value={{
              country: formData.country,
              state: formData.state,
              city: formData.city,
              address: formData.address,
              postalCode: formData.cap,
              phone: formData.phone,
            }}
            onChange={(location) => {
              setFormData((prev) => {
                const nextTimezone = prev.country !== location.country
                  ? getPreferredTimezoneForCountry(location.country, prev.timezone || browserTimezone)
                  : prev.timezone;

                return {
                  ...prev,
                  country: location.country,
                  state: location.state,
                  city: location.city,
                  address: location.address,
                  cap: location.postalCode,
                  phone: location.phone,
                  timezone: nextTimezone,
                };
              });
            }}
            includeAddress
            includePostalCode
            includePhone
            disabled={formSaving}
            labels={{
              country: t('companies.country', 'Country'),
              state: t('companies.state', 'State'),
              city: t('companies.city', 'City'),
              address: t('stores.fieldAddress'),
              postalCode: t('stores.fieldCap'),
              phone: t('companies.companyPhoneNumbers', 'Phone'),
            }}
          />
          <div style={{ display: 'grid', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
              {t('stores.fieldTimezone', 'Timezone')}
            </label>
            <CustomSelect
              value={formData.timezone || browserTimezone}
              onChange={(value) => {
                if (!value) return;
                setFormData((prev) => ({ ...prev, timezone: value }));
              }}
              options={timezoneOptions}
              placeholder={t('stores.placeholderTimezone', 'Select timezone')}
              searchPlaceholder={t('settings.timezoneSearchPlaceholder', 'Search timezone...')}
              noOptionsMessage={t('settings.timezoneNoResults', 'No timezone found')}
              disabled={formSaving}
              isClearable={false}
            />
          </div>
          <Input
            label={t('stores.fieldMaxStaff')}
            type="number"
            min="0"
            value={formData.maxStaff}
            onChange={(e) => setFormData((prev) => ({ ...prev, maxStaff: e.target.value }))}
            placeholder={t('stores.placeholderMaxStaff')}
          />
            </>
          )}
        </div>
      </Modal>

      {/* Confirm Deactivate Modal */}
      <Modal
        open={confirmOpen}
        onClose={closeConfirm}
        title={t('stores.confirmDeactivate')}
        footer={
          <>
            <Button variant="secondary" onClick={closeConfirm} disabled={deactivating}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDeactivate} loading={deactivating} disabled={deactivateInput.trim() !== (deactivatingStore?.name ?? '')}>
              {t('common.deactivate')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {deactivateError && (
            <Alert variant="danger" onClose={() => setDeactivateError(null)}>
              {deactivateError}
            </Alert>
          )}
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>
            {t('stores.confirmDeactivateMsg', { name: deactivatingStore?.name ?? '' })}
          </p>
          <Input
            label={t('stores.typeNameToDeactivate', 'Type the exact store name to deactivate')}
            value={deactivateInput}
            onChange={(event) => setDeactivateInput(event.target.value)}
            placeholder={deactivatingStore?.name ?? ''}
            disabled={deactivating}
          />
          <div style={{ fontSize: 12, color: deactivateInput.trim() === (deactivatingStore?.name ?? '') ? '#166534' : 'var(--text-muted)' }}>
            {deactivateInput.trim() === (deactivatingStore?.name ?? '')
              ? t('stores.deactivateNameMatched', 'Name matches. Deactivation is enabled.')
              : t('stores.deactivateNameMismatch', 'Name must match exactly to deactivate.')}
          </div>
        </div>
      </Modal>

      {/* Activate Modal */}
      <Modal
        open={activateOpen}
        onClose={closeActivate}
        title={t('stores.confirmActivate')}
        footer={
          <>
            <Button variant="secondary" onClick={closeActivate} disabled={activating}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleActivate} loading={activating}>
              {t('common.activate')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {activateError && (
            <Alert variant="danger" onClose={() => setActivateError(null)}>
              {activateError}
            </Alert>
          )}
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>
            {t('stores.confirmActivateMsg', { name: activatingStore?.name ?? '' })}
          </p>
        </div>
      </Modal>

      {/* Permanent Delete Modal */}
      <Modal
        open={deleteOpen}
        onClose={closeDelete}
        title={t('stores.confirmDeleteTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={closeDelete} disabled={deleting}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDeletePermanent} loading={deleting}>
              {t('stores.confirmDeleteBtn')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {deleteError && (
            <Alert variant="danger" onClose={() => setDeleteError(null)}>
              {deleteError}
            </Alert>
          )}
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>
            {t('stores.confirmDeleteMsg', { name: deletingStore?.name ?? '' })}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--warning)', fontWeight: 500 }}>
            {t('stores.confirmDeleteWarning')}
          </p>
        </div>
      </Modal>

      {/* Skip Terminal Confirmation Modal */}
      <Modal
        open={skipConfirmOpen}
        onClose={() => setSkipConfirmOpen(false)}
        title={t('stores.skipTerminalConfirmTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSkipConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleConfirmSkip}>
              {t('common.confirm')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>
            {t('stores.skipTerminalConfirmMsg')}
          </p>
        </div>
      </Modal>
    </div>
  );
}

export default StoreList;
