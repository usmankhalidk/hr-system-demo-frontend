import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactCountryFlag from 'react-country-flag';
import {
  Building2,
  MapPin,
  Users,
  ArrowLeft,
  Pencil,
  PowerOff,
  Power,
  Trash2,
  Camera,
  UploadCloud,
  BriefcaseBusiness,
  CalendarClock,
  Clock3,
  Eye,
  UserRound,
  Settings2,
  Sunrise,
  Hash,
  Sunset,
  TrendingUp,
  ClipboardList,
  PlusCircle,
  XCircle,
  Phone,
  Database,
  CheckCircle,
  RefreshCw,
  Search,
  Link as LinkIcon,
  Unlink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  getStore,
  updateStore,
  deactivateStore,
  activateStore,
  deleteStorePermanent,
  uploadStoreLogo,
  getStoreOperatingHours,
  updateStoreOperatingHours,
} from '../../api/stores';
import { getCompanyById } from '../../api/companies';
import { getEmployees } from '../../api/employees';
import { getAvatarUrl, getStoreLogoUrl, getCompanyLogoUrl } from '../../api/client';
import { Company, Employee, Store, StoreOperatingHour, UserRole } from '../../types';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import CustomSelect, { SelectOption } from '../../components/ui/CustomSelect';
import { LocationFieldGroup } from '../../components/location';
import { TimezoneOptionContent } from '../../components/timezone/TimezoneOptionContent';
import { getApiErrorCode, translateApiError } from '../../utils/apiErrors';
import { getCountryDisplayName } from '../../utils/country';
import {
  getBrowserTimeZone,
  getPreferredTimezoneForCountry,
  getTimezoneOptionValues,
} from '../../utils/timezone';
import {
  getExternalOverview,
  listExternalDepositi,
  listExternalMappings,
  upsertExternalMapping,
  deleteExternalMapping,
  ExternalDepositoRow,
  ExternalDbOverview,
  ExternalStoreMapping,
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

function parseStoreIdFromSlug(slug?: string): number | null {
  if (!slug) return null;
  const match = slug.match(/^(\d+)(?:-|$)/);
  if (!match) return null;
  const id = parseInt(match[1], 10);
  return Number.isNaN(id) ? null : id;
}

const ROLE_PRIORITY: Record<UserRole, number> = {
  admin: 0,
  hr: 1,
  area_manager: 2,
  store_manager: 3,
  employee: 4,
  store_terminal: 5,
};

const ROLE_BADGE_VARIANT: Record<UserRole, 'accent' | 'primary' | 'info' | 'success' | 'warning' | 'neutral'> = {
  admin: 'accent',
  hr: 'info',
  area_manager: 'success',
  store_manager: 'warning',
  employee: 'neutral',
  store_terminal: 'neutral',
};

function compareEmployeesByRoleAndName(a: Employee, b: Employee): number {
  const roleDiff = (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99);
  if (roleDiff !== 0) return roleDiff;
  return `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`);
}

function defaultOperatingHours(): StoreOperatingHour[] {
  return Array.from({ length: 7 }, (_, day) => ({
    dayOfWeek: day,
    openTime: '09:00',
    closeTime: '18:00',
    peakStartTime: null,
    peakEndTime: null,
    plannedShiftCount: null,
    plannedStaffCount: null,
    shiftPlanNotes: null,
    isClosed: false,
  }));
}

function normalizeOperatingHours(hours: StoreOperatingHour[]): StoreOperatingHour[] {
  const base = defaultOperatingHours();
  const defaultsByDay = new Map(base.map((item) => [item.dayOfWeek, item]));
  const byDay = new Map<number, StoreOperatingHour>();
  for (const row of hours) {
    const defaults = defaultsByDay.get(row.dayOfWeek);
    const fallbackOpen = defaults?.openTime ?? '09:00';
    const fallbackClose = defaults?.closeTime ?? '18:00';
    byDay.set(row.dayOfWeek, {
      ...row,
      openTime: row.openTime
        ? row.openTime.slice(0, 5)
        : (row.isClosed ? fallbackOpen : null),
      closeTime: row.closeTime
        ? row.closeTime.slice(0, 5)
        : (row.isClosed ? fallbackClose : null),
      peakStartTime: row.peakStartTime ? row.peakStartTime.slice(0, 5) : null,
      peakEndTime: row.peakEndTime ? row.peakEndTime.slice(0, 5) : null,
      plannedShiftCount: row.plannedShiftCount ?? null,
      plannedStaffCount: row.plannedStaffCount ?? null,
      shiftPlanNotes: row.shiftPlanNotes?.trim() ? row.shiftPlanNotes.trim() : null,
    });
  }
  return base.map((day) => byDay.get(day.dayOfWeek) ?? day);
}

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(locale);
}

function formatDateRange(start: string | null | undefined, end: string | null | undefined, locale: string): string {
  const startLabel = formatDate(start, locale);
  const endLabel = formatDate(end, locale);
  if (startLabel === '—' && endLabel === '—') return '—';
  if (startLabel === endLabel) return startLabel;
  if (startLabel === '—') return endLabel;
  if (endLabel === '—') return startLabel;
  return `${startLabel} – ${endLabel}`;
}

function monthsBetween(startDate: string | null | undefined, endDate?: string | null): number | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
  let months = (end.getFullYear() - start.getFullYear()) * 12;
  months += end.getMonth() - start.getMonth();
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(months, 0);
}

function durationLabel(openTime: string | null, closeTime: string | null): string {
  if (!openTime || !closeTime) return '—';
  const [oh, om] = openTime.split(':').map((part) => parseInt(part, 10));
  const [ch, cm] = closeTime.split(':').map((part) => parseInt(part, 10));
  if ([oh, om, ch, cm].some((part) => Number.isNaN(part))) return '—';
  const startMinutes = (oh * 60) + om;
  const endMinutes = (ch * 60) + cm;
  if (endMinutes <= startMinutes) return '—';
  const total = endMinutes - startMinutes;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function hasPeakWindow(row: StoreOperatingHour): boolean {
  return Boolean(row.peakStartTime && row.peakEndTime);
}

function hasShiftPlan(row: StoreOperatingHour): boolean {
  return (
    row.plannedShiftCount != null ||
    row.plannedStaffCount != null ||
    Boolean(row.shiftPlanNotes && row.shiftPlanNotes.trim().length > 0)
  );
}

function parseNullableInt(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

function isOpenDay(row: StoreOperatingHour): boolean {
  return !row.isClosed && Boolean(row.openTime && row.closeTime);
}

export default function StoreDetail() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { slug } = useParams<{ slug: string }>();

  const storeId = useMemo(() => parseStoreIdFromSlug(slug), [slug]);
  const locale = i18n.language?.startsWith('it') ? 'it-IT' : 'en-GB';

  const canEdit = user?.role === 'admin' || user?.role === 'store_manager';
  const canManageHours = user?.role === 'admin' || user?.role === 'store_manager' || user?.role === 'hr';
  const canManageStatus = user?.role === 'admin';

  const [store, setStore] = useState<Store | null>(null);
  const [companyProfile, setCompanyProfile] = useState<Company | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [hours, setHours] = useState<StoreOperatingHour[]>(defaultOperatingHours());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [formData, setFormData] = useState<StoreFormData>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2>(1);

  // External database integration state (Step 2)
  const [externalDbOverview, setExternalDbOverview] = useState<ExternalDbOverview | null>(null);
  const [externalStores, setExternalStores] = useState<ExternalDepositoRow[]>([]);
  const [externalStoresLoading, setExternalStoresLoading] = useState(false);
  const [externalStoresError, setExternalStoresError] = useState<string | null>(null);
  const [externalSearchQuery, setExternalSearchQuery] = useState('');
  const [externalStoreCode, setExternalStoreCode] = useState('');
  const [externalStoreName, setExternalStoreName] = useState('');

  // Filtered stores for real-time search
  const filteredExternalStores = useMemo(() => {
    if (!externalSearchQuery.trim()) return externalStores;
    const query = externalSearchQuery.toLowerCase().trim();
    return externalStores.filter(store => 
      (store.storeName?.toLowerCase().includes(query)) ||
      (store.companyName?.toLowerCase().includes(query)) ||
      (store.externalStoreCode?.toLowerCase().includes(query))
    );
  }, [externalStores, externalSearchQuery]);
  const [integrationLoading, setIntegrationLoading] = useState(false);
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [currentMapping, setCurrentMapping] = useState<ExternalStoreMapping | null>(null);
  const [refreshingInternalDb, setRefreshingInternalDb] = useState(false);
  const [refreshingExternalDb, setRefreshingExternalDb] = useState(false);

  const [logoHover, setLogoHover] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [hoveredEmployeeId, setHoveredEmployeeId] = useState<number | null>(null);

  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const [hoursExpandedDays, setHoursExpandedDays] = useState<Record<number, boolean>>({});

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateInput, setDeactivateInput] = useState('');
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const [activateOpen, setActivateOpen] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const browserTimezone = useMemo(() => getBrowserTimeZone(), []);

  const timezoneOptions = useMemo<SelectOption[]>(() => {
    return getTimezoneOptionValues([formData.timezone, browserTimezone]).map((timezone) => ({
      value: timezone,
      label: timezone,
      render: <TimezoneOptionContent timezone={timezone} />,
    }));
  }, [browserTimezone, formData.timezone]);
  const activeEmployeeCount = employees.length;
  const maxCapacityLabel = store?.maxStaff != null ? String(store.maxStaff) : '—';

  const dayLabels = useMemo(
    () => [
      t('stores.dayMonday', 'Monday'),
      t('stores.dayTuesday', 'Tuesday'),
      t('stores.dayWednesday', 'Wednesday'),
      t('stores.dayThursday', 'Thursday'),
      t('stores.dayFriday', 'Friday'),
      t('stores.daySaturday', 'Saturday'),
      t('stores.daySunday', 'Sunday'),
    ],
    [t],
  );
  const todayIndex = useMemo(() => ((new Date().getDay() + 6) % 7), []);

  const loadData = useCallback(async () => {
    if (!storeId) {
      setError(t('stores.errorLoad'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [storeData, employeesData, hoursData] = await Promise.all([
        getStore(storeId),
        getEmployees({ storeId, status: 'active', limit: 250 }),
        getStoreOperatingHours(storeId).catch(() => []),
      ]);

      setStore(storeData);
      setEmployees((employeesData.employees ?? []).sort(compareEmployeesByRoleAndName));
      setHours(normalizeOperatingHours(hoursData));
    } catch {
      setError(t('stores.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [storeId, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!store?.companyId) {
      setCompanyProfile(null);
      return;
    }

    let cancelled = false;
    getCompanyById(store.companyId)
      .then((company) => {
        if (!cancelled) setCompanyProfile(company);
      })
      .catch(() => {
        if (!cancelled) setCompanyProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [store?.companyId]);

  const logoUrl = getStoreLogoUrl(store?.logoFilename);
  const storeCountryName = store?.country ? getCountryDisplayName(store.country) : null;
  const storeTimezone = store?.timezone ?? (store?.country ? getPreferredTimezoneForCountry(store.country, browserTimezone) : browserTimezone);

  const companyName = companyProfile?.name ?? store?.companyName ?? null;
  const companyLogoFilename = companyProfile?.logoFilename ?? store?.companyLogoFilename ?? null;
  const companyGroupName = companyProfile?.groupName ?? store?.groupName ?? null;
  const companyCountry = companyProfile?.country ?? store?.country ?? null;
  const companyOwnerName = companyProfile?.ownerName ?? null;
  const companyOwnerSurname = companyProfile?.ownerSurname ?? null;
  const companyOwnerAvatarFilename = companyProfile?.ownerAvatarFilename ?? null;
  const companyStoreCount = companyProfile?.storeCount ?? null;

  const hrContact = useMemo(() => employees.find((employee) => employee.role === 'hr') ?? null, [employees]);
  const managerContact = useMemo(() => employees.find((employee) => employee.role === 'store_manager') ?? null, [employees]);

  const mappedExternalRow = useMemo(() => {
    if (!currentMapping) return null;
    return externalStores.find((row) => row.externalStoreCode === currentMapping.externalStoreCode) ?? null;
  }, [currentMapping, externalStores]);

  const externalCompanyLabel = currentMapping?.externalCompanyName || mappedExternalRow?.companyName || null;
  const integratedByName = useMemo(() => {
    if (!currentMapping) return null;
    const name = `${currentMapping.updatedByName ?? currentMapping.createdByName ?? ''} ${currentMapping.updatedBySurname ?? currentMapping.createdBySurname ?? ''}`.trim();
    return name || null;
  }, [currentMapping]);
  const integratedByAvatar = currentMapping?.updatedByAvatarFilename ?? currentMapping?.createdByAvatarFilename ?? null;

  const externalCompanyCount = useMemo(() => {
    const names = new Set(
      externalStores
        .map((row) => (row.companyName ?? '').trim())
        .filter((name) => name.length > 0),
    );
    return names.size;
  }, [externalStores]);

  const openEdit = async () => {
    if (!store) return;
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
    setFormError(null);
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
    
    // Load existing mapping if any
    try {
      const targetCompanyId = store.companyId;
      const mappings = await listExternalMappings(targetCompanyId);
      const existingMapping = mappings.find(m => m.localStoreId === store.id && m.isActive);
      if (existingMapping) {
        setCurrentMapping(existingMapping);
      }
    } catch (err) {
      // Silently fail - user can still integrate manually
      console.error('Failed to load existing mapping:', err);
    }
    
    setEditOpen(true);
  };

  // Load external database overview and stores for Step 2
  const loadExternalDbData = async () => {
    if (!store) return;
    setExternalStoresLoading(true);
    setExternalStoresError(null);
    try {
      const targetCompanyId = store.companyId;
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

  // Search external stores (now just loads all stores, filtering is done client-side)
  const handleExternalSearch = async () => {
    if (!store) return;
    // Always load all stores for client-side filtering
    setExternalStoresLoading(true);
    setExternalStoresError(null);
    try {
      const targetCompanyId = store.companyId;
      const depositiRows = await listExternalDepositi({
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
    if (!store) return;
    if (!externalStoreCode.trim()) {
      setIntegrationError(t('externalAffluence.externalStoreCodeRequired'));
      return;
    }

    // Validate store name if provided
    if (externalStoreName.trim()) {
      const matchingStore = externalStores.find(s => s.externalStoreCode === externalStoreCode.trim());
      if (matchingStore && matchingStore.storeName && matchingStore.storeName !== externalStoreName.trim()) {
        setIntegrationError(t('externalAffluence.storeNameMismatch', `Store name "${externalStoreName.trim()}" does not match the name "${matchingStore.storeName}" for store code "${externalStoreCode.trim()}".`));
        return;
      }
      if (!matchingStore) {
        setIntegrationError(t('externalAffluence.storeCodeNotFound', `Store code "${externalStoreCode.trim()}" not found in available external stores.`));
        return;
      }
    }

    setIntegrationLoading(true);
    setIntegrationError(null);
    try {
      const targetCompanyId = store.companyId;
      const mapping = await upsertExternalMapping(store.id, {
        externalStoreCode: externalStoreCode.trim(),
        targetCompanyId: targetCompanyId ?? undefined,
      });
      setCurrentMapping(mapping);
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
    if (!store) return;

    setIntegrationLoading(true);
    setIntegrationError(null);
    try {
      const targetCompanyId = store.companyId;
      await deleteExternalMapping(store.id, targetCompanyId ?? undefined);
      setCurrentMapping(null);
      showToast(t('externalAffluence.integrationRemoved'), 'success');
    } catch (err) {
      setIntegrationError(translateApiError(err, t, t('externalAffluence.errorRemoveIntegration')));
    } finally {
      setIntegrationLoading(false);
    }
  };

  // Refresh database connections
  const handleRefreshDatabases = async () => {
    if (!store) return;
    setRefreshingInternalDb(true);
    setRefreshingExternalDb(true);
    try {
      const targetCompanyId = store.companyId;
      const overview = await getExternalOverview(targetCompanyId ?? undefined);
      setExternalDbOverview(overview);
    } catch (err) {
      setExternalStoresError(translateApiError(err, t, t('externalAffluence.errorLoadStores')));
    } finally {
      setRefreshingInternalDb(false);
      setRefreshingExternalDb(false);
    }
  };

  const handleSave = async () => {
    if (!store) return;
    if (!formData.name.trim() || !formData.code.trim()) {
      setFormError(t('errors.VALIDATION_ERROR'));
      return;
    }

    setFormSaving(true);
    setFormError(null);
    try {
      await updateStore(store.id, {
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
      });
      setEditOpen(false);
      showToast(t('stores.updatedSuccess'), 'success');
      await loadData();
    } catch (err: unknown) {
      setFormError(translateApiError(err, t, t('stores.errorSave')));
    } finally {
      setFormSaving(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!store) return;
    setLogoUploading(true);
    setLogoError(null);
    try {
      await uploadStoreLogo(store.id, file);
      showToast(t('stores.logoUpdated', 'Store photo updated'), 'success');
      await loadData();
    } catch (err: unknown) {
      const message = translateApiError(err, t, t('stores.logoError', 'Error uploading store photo'));
      if (getApiErrorCode(err) === 'INVALID_FILE_TYPE') {
        showToast(message ?? t('stores.logoError', 'Error uploading store photo'), 'warning');
      }
      setLogoError(message);
    } finally {
      setLogoUploading(false);
    }
  };

  const handleHoursChange = (dayIndex: number, patch: Partial<StoreOperatingHour>) => {
    setHours((prev) => prev.map((item) => (item.dayOfWeek === dayIndex ? { ...item, ...patch } : item)));
  };

  const handleSaveHours = async () => {
    if (!store) return;
    setHoursSaving(true);
    setHoursError(null);

    for (const item of hours) {
      if (item.isClosed) {
        continue;
      }

      if (!item.openTime || !item.closeTime) {
        setHoursSaving(false);
        setHoursError(t('stores.hoursValidationTimes', 'Open and close time are required for open days.'));
        return;
      }
      if (item.closeTime <= item.openTime) {
        setHoursSaving(false);
        setHoursError(t('stores.hoursValidationOrder', 'Close time must be later than open time.'));
        return;
      }

      const hasAnyPeakTime = Boolean(item.peakStartTime || item.peakEndTime);
      if (hasAnyPeakTime && (!item.peakStartTime || !item.peakEndTime)) {
        setHoursSaving(false);
        setHoursError(t('stores.hoursValidationPeakPair', 'Peak-hours start and end must both be set.'));
        return;
      }

      if (item.peakStartTime && item.peakEndTime) {
        if (item.peakEndTime <= item.peakStartTime) {
          setHoursSaving(false);
          setHoursError(t('stores.hoursValidationPeakOrder', 'Peak-hours end must be later than start.'));
          return;
        }
        if (!item.isClosed && item.openTime && item.closeTime) {
          if (item.peakStartTime < item.openTime || item.peakEndTime > item.closeTime) {
            setHoursSaving(false);
            setHoursError(t('stores.hoursValidationPeakRange', 'Peak hours must be within opening hours.'));
            return;
          }
        }
      }
    }

    try {
      const payload = hours.map((item) => ({
        ...item,
        shiftPlanNotes: item.shiftPlanNotes?.trim() ? item.shiftPlanNotes.trim() : null,
      }));
      const updated = await updateStoreOperatingHours(store.id, payload);
      setHours(normalizeOperatingHours(updated));
      showToast(t('stores.hoursSaved', 'Operating hours saved'), 'success');
      setHoursModalOpen(false);
    } catch (err: unknown) {
      setHoursError(translateApiError(err, t, t('stores.hoursError', 'Unable to save operating hours')));
    } finally {
      setHoursSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!store) return;
    if (deactivateInput.trim() !== store.name) {
      setDeactivateError(t('stores.deactivateNameError', 'Type the exact store name to confirm deactivation.'));
      return;
    }
    setDeactivating(true);
    setDeactivateError(null);
    try {
      await deactivateStore(store.id);
      setDeactivateOpen(false);
      showToast(t('stores.deactivatedSuccess'), 'success');
      await loadData();
    } catch (err: unknown) {
      setDeactivateError(translateApiError(err, t, t('stores.errorDeactivate')));
    } finally {
      setDeactivating(false);
    }
  };

  const handleActivate = async () => {
    if (!store) return;
    setActivating(true);
    setActivateError(null);
    try {
      await activateStore(store.id);
      setActivateOpen(false);
      showToast(t('stores.activatedSuccess'), 'success');
      await loadData();
    } catch (err: unknown) {
      setActivateError(translateApiError(err, t, t('stores.errorActivate')));
    } finally {
      setActivating(false);
    }
  };

  const handleDelete = async () => {
    if (!store) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteStorePermanent(store.id);
      showToast(t('stores.deletedSuccess'), 'success');
      navigate('/negozi');
    } catch (err: unknown) {
      setDeleteError(translateApiError(err, t, t('stores.errorDelete')));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-enter" style={{ width: '100%' }}>
        <div style={{ height: 140, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, opacity: 0.65 }} />
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="page-enter" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="btn btn-secondary" onClick={() => navigate('/negozi')} style={{ width: 'fit-content' }}>
          <ArrowLeft size={14} />
          {t('common.back', 'Back')}
        </button>
        <div style={{ border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 10, padding: '12px 14px', fontSize: 13 }}>
          {error ?? t('stores.errorLoad', 'Unable to load store')}
        </div>
      </div>
    );
  }

  const deactivateMatches = deactivateInput.trim() === store.name;

  return (
    <div className="page-enter" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/negozi')}>
          <ArrowLeft size={14} />
          {t('common.back')}
        </button>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canEdit && (
            <Button variant="secondary" onClick={openEdit}>
              <Pencil size={14} />
              {t('common.edit')}
            </Button>
          )}
          {canManageStatus && store.isActive && (
            <Button variant="danger" onClick={() => { setDeactivateError(null); setDeactivateInput(''); setDeactivateOpen(true); }}>
              <PowerOff size={14} />
              {t('common.deactivate')}
            </Button>
          )}
          {canManageStatus && !store.isActive && (
            <>
              <Button onClick={() => { setActivateError(null); setActivateOpen(true); }}>
                <Power size={14} />
                {t('common.activate')}
              </Button>
              <Button variant="danger" onClick={() => { setDeleteError(null); setDeleteOpen(true); }}>
                <Trash2 size={14} />
                {t('common.delete')}
              </Button>
            </>
          )}
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden' }}>
        <div style={{
          padding: '18px 18px 0',
          minHeight: 116,
          background: 'linear-gradient(135deg, rgba(13,33,55,0.94) 0%, rgba(27,77,62,0.86) 100%)',
        }} />
        <div style={{ padding: '0 18px 18px' }}>
          <button
            type="button"
            onMouseEnter={() => setLogoHover(true)}
            onMouseLeave={() => setLogoHover(false)}
            onClick={() => logoInputRef.current?.click()}
            disabled={logoUploading}
            style={{
              marginTop: -52,
              width: 108,
              height: 108,
              borderRadius: 20,
              border: '4px solid var(--surface)',
              boxShadow: '0 10px 22px rgba(0,0,0,0.18)',
              background: logoUrl ? '#fff' : 'var(--primary)',
              color: '#fff',
              fontSize: 34,
              fontWeight: 800,
              overflow: 'hidden',
              position: 'relative',
              cursor: logoUploading ? 'not-allowed' : 'pointer',
              padding: 0,
            }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              store.name.slice(0, 2).toUpperCase()
            )}
            <span style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(13,33,55,0.6)',
              opacity: logoHover ? 1 : 0,
              transition: 'opacity 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Camera size={18} />
            </span>
          </button>

          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleLogoUpload(file);
              event.target.value = '';
            }}
          />

          {logoError ? <div style={{ marginTop: 10 }}><Alert variant="danger" onClose={() => setLogoError(null)}>{logoError}</Alert></div> : null}

          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)' }}>{store.name}</div>
                {store.country ? (
                  <span
                    title={storeCountryName || store.country}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 22,
                      borderRadius: 999,
                      border: '1px solid rgba(13,33,55,0.12)',
                      background: 'rgba(13,33,55,0.06)',
                      flexShrink: 0,
                    }}
                  >
                    <ReactCountryFlag countryCode={store.country} svg style={{ width: '1em', height: '1em' }} />
                  </span>
                ) : null}
              </div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--primary)', border: '1px solid rgba(13,33,55,0.2)', background: 'rgba(13,33,55,0.08)', borderRadius: 999, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Building2 size={11} />
                  {store.companyName ?? '—'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--accent)', border: '1px solid rgba(201,151,58,0.34)', background: 'rgba(201,151,58,0.12)', borderRadius: 999, padding: '3px 8px' }}>
                  {store.groupName ?? t('companies.optionStandalone')}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', border: '1px solid rgba(13,33,55,0.14)', background: 'rgba(13,33,55,0.06)', borderRadius: 999, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Clock3 size={11} />
                  {storeTimezone}
                </span>
                {store.isActive ? (
                  <span style={{ fontSize: 11, color: '#166534', border: '1px solid rgba(34,197,94,0.34)', background: 'rgba(22,163,74,0.12)', borderRadius: 999, padding: '3px 8px' }}>
                    {t('common.active')}
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: '#991b1b', border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(220,38,38,0.12)', borderRadius: 999, padding: '3px 8px' }}>
                    {t('common.inactive')}
                  </span>
                )}
              </div>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <UploadCloud size={12} />
              {logoUploading ? t('stores.logoUploading', 'Uploading...') : t('stores.logoHint', 'Hover logo to update photo')}
            </span>
          </div>

          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <InfoChip icon={<Hash size={13} />} label={t('stores.colCode', 'Code')} value={store.code} />
            <InfoChip
              icon={<MapPin size={13} />}
              label={t('stores.colAddress', 'Address')}
              value={[
                store.address,
                store.city,
                store.state,
                store.country,
                store.cap,
              ].filter(Boolean).join(', ') || '—'}
            />
            {store.phone ? <InfoChip icon={<Phone size={13} />} label={t('companies.companyPhoneNumbers', 'Phone')} value={store.phone} /> : null}
            {store.maxStaff != null ? <InfoChip icon={<Users size={13} />} label={t('stores.colMaxStaff', 'Max staff')} value={String(store.maxStaff)} /> : null}
          </div>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.12)', fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.92)', textTransform: 'uppercase', letterSpacing: '0.04em', background: 'linear-gradient(135deg, rgba(13,33,55,0.95) 0%, rgba(22,51,82,0.88) 100%)' }}>
          {t('stores.colEmployees')} ({employees.length})
        </div>
        {employees.length === 0 ? (
          <div style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)' }}>{t('common.noData')}</div>
        ) : (
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10 }}>
            {employees.map((employee) => {
              const avatarUrl = getAvatarUrl(employee.avatarFilename);
              const initials = `${employee.name?.[0] ?? ''}${employee.surname?.[0] ?? ''}`.toUpperCase() || 'U';
              const contractMonths = monthsBetween(employee.hireDate, employee.contractEndDate ?? undefined);
              return (
                <div
                  key={employee.id}
                  onMouseEnter={() => setHoveredEmployeeId(employee.id)}
                  onMouseLeave={() => setHoveredEmployeeId((current) => (current === employee.id ? null : current))}
                  style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-warm)', padding: '11px 12px', display: 'grid', gap: 9, position: 'relative', overflow: 'hidden' }}
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/dipendenti/${employee.id}`)}
                    aria-label={t('common.view', 'View')}
                    title={t('common.view', 'View')}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: '1px solid rgba(13,33,55,0.12)',
                      background: 'rgba(255,255,255,0.96)',
                      color: 'var(--text-secondary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                      opacity: hoveredEmployeeId === employee.id ? 1 : 0,
                      transform: hoveredEmployeeId === employee.id ? 'translateY(0)' : 'translateY(-4px)',
                      transition: 'opacity 0.15s ease, transform 0.15s ease',
                    }}
                  >
                    <Eye size={14} />
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', background: '#8B6914', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={`${employee.name} ${employee.surname}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : initials}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {employee.name} {employee.surname}
                      </div>
                      <div style={{ marginTop: 1, fontSize: 11, color: 'var(--text-muted)' }}>
                        {employee.email}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 5 }}>
                    <MetaLine
                      icon={<BriefcaseBusiness size={12} />}
                      label={t('roles.label', 'Role')}
                      value={<Badge variant={ROLE_BADGE_VARIANT[employee.role]} size="sm">{t(`roles.${employee.role}`, employee.role)}</Badge>}
                    />
                    <MetaLine icon={<CalendarClock size={12} />} label={t('employees.hireDate', 'Hire date')} value={formatDate(employee.hireDate, locale)} />
                    <MetaLine
                      icon={<Clock3 size={12} />}
                      label={t('stores.contractDuration', 'Contract duration')}
                      value={contractMonths == null
                        ? '—'
                        : t('stores.contractDurationValue', { defaultValue: `${contractMonths} months`, count: contractMonths })}
                    />
                    <MetaLine icon={<UserRound size={12} />} label={t('employees.colSupervisor', 'Supervisor')} value={employee.supervisorName || '—'} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.12)', fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.92)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(22,51,82,0.92) 0%, rgba(15,118,110,0.82) 100%)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Clock3 size={13} />
            {t('stores.operatingHoursTitle', 'Operating hours')}
          </span>
          {canManageHours && (
            <button
              type="button"
              onClick={() => { setHoursError(null); setHoursExpandedDays({}); setHoursModalOpen(true); }}
              style={{ border: '1px solid rgba(255,255,255,0.34)', borderRadius: 8, background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 9px', display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
            >
              <Settings2 size={13} />
              {t('stores.manageHours', 'Manage')}
            </button>
          )}
        </div>
        <div style={{ padding: 14, overflowX: 'auto' }}>
          <div style={{ minWidth: 860, display: 'grid', gap: 8 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(130px, 1.4fr) repeat(3, minmax(90px, 0.9fr)) minmax(150px, 1.4fr) minmax(180px, 1.8fr) minmax(90px, 0.8fr)',
              gap: 8,
              padding: '0 12px',
              fontSize: 11,
              fontWeight: 800,
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              <span>{t('stores.hoursHeaderDay', 'Day')}</span>
              <span>{t('stores.hoursHeaderOpen', 'Open')}</span>
              <span>{t('stores.hoursHeaderClose', 'Close')}</span>
              <span>{t('stores.hoursHeaderTotal', 'Total')}</span>
              <span>{t('stores.hoursHeaderPeak', 'Peak hours')}</span>
              <span>{t('stores.hoursHeaderPlan', 'Shift plan')}</span>
              <span style={{ textAlign: 'right' }}>{t('stores.hoursHeaderStatus', 'Status')}</span>
            </div>

            {hours.map((row) => {
              const isToday = row.dayOfWeek === todayIndex;
              const isOpen = isOpenDay(row);
              const shiftCountLabel = row.plannedShiftCount != null
                ? t('stores.shiftCountValue', { count: row.plannedShiftCount, defaultValue: `${row.plannedShiftCount} shifts` })
                : null;
              const staffCountLabel = row.plannedStaffCount != null
                ? t('stores.staffCountValue', { count: row.plannedStaffCount, defaultValue: `${row.plannedStaffCount} staff` })
                : null;
              const shiftPlanSummary = [shiftCountLabel, staffCountLabel, row.shiftPlanNotes?.trim() || null]
                .filter(Boolean)
                .join(' · ');

              return (
                <div
                  key={row.dayOfWeek}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    background: isToday ? 'rgba(201,151,58,0.08)' : 'var(--surface-warm)',
                    opacity: isOpen ? 1 : 0.58,
                    display: 'grid',
                    gridTemplateColumns: 'minmax(130px, 1.4fr) repeat(3, minmax(90px, 0.9fr)) minmax(150px, 1.4fr) minmax(180px, 1.8fr) minmax(90px, 0.8fr)',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {dayLabels[row.dayOfWeek]}
                    {isToday ? <Badge variant="warning">{t('stores.today', 'Today')}</Badge> : null}
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{row.openTime ?? '—'}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{row.closeTime ?? '—'}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{durationLabel(row.openTime, row.closeTime)}</div>

                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {hasPeakWindow(row) ? `${row.peakStartTime} - ${row.peakEndTime}` : ''}
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {hasShiftPlan(row) ? shiftPlanSummary : ''}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{
                      borderRadius: 999,
                      padding: '3px 9px',
                      fontSize: 11,
                      fontWeight: 700,
                      border: isOpen
                        ? '1px solid rgba(34,197,94,0.35)'
                        : '1px solid rgba(148,163,184,0.36)',
                      background: isOpen
                        ? 'rgba(22,163,74,0.12)'
                        : 'rgba(100,116,139,0.1)',
                      color: isOpen ? '#166534' : '#475569',
                    }}>
                      {isOpen ? t('stores.dayOpen', 'Open') : t('stores.dayClosed', 'Closed')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Modal
        open={editOpen}
        onClose={() => { setEditOpen(false); setFormStep(1); }}
        title={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formStep === 1 ? t('stores.editStore') : t('stores.storeIntegration')}
            </div>
            {/* Step Indicators - Full width centered */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', maxWidth: '400px', margin: '0 auto' }}>
              {[1, 2].map((s) => (
                <React.Fragment key={s}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 700,
                    background: formStep === s ? 'var(--accent)' : formStep > s ? '#10B981' : 'var(--border)',
                    color: formStep >= s ? '#fff' : 'var(--text-muted)',
                    transition: 'all 0.25s ease',
                    boxShadow: formStep === s ? '0 0 0 4px rgba(13,33,55,0.12)' : 'none',
                    flexShrink: 0,
                  }}>
                    {formStep > s ? '✓' : s}
                  </div>
                  {s < 2 && (
                    <div style={{
                      flex: 1,
                      height: '3px',
                      background: formStep > s ? '#10B981' : 'var(--border)',
                      transition: 'background 0.25s ease',
                      borderRadius: '2px',
                    }} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        }
        footer={
          <>
            {formStep === 2 ? (
              <>
                <Button variant="secondary" onClick={() => setFormStep(1)}>
                  ← {t('common.back')}
                </Button>
                <Button variant="secondary" onClick={() => { setEditOpen(false); setFormStep(1); }}>
                  {t('common.close')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => { setEditOpen(false); setFormStep(1); }} disabled={formSaving}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleSave} loading={formSaving}>
                  {t('common.save')}
                </Button>
                <Button variant="secondary" onClick={async () => { setFormStep(2); await loadExternalDbData(); }}>
                  {t('stores.goToIntegration')} →
                </Button>
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

          {formStep === 2 ? (
            /* ========== STEP 2: External Database Integration ========== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Database Connection Status - Enhanced */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
              }}>
                {/* Internal Database */}
                <div style={{
                  padding: '14px',
                  background: 'var(--surface-50)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Database size={16} color="var(--text-muted)" />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {t('externalAffluence.internalDatabase')}
                      </span>
                    </div>
                    <button
                      onClick={handleRefreshDatabases}
                      disabled={refreshingInternalDb}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: refreshingInternalDb ? 'not-allowed' : 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        opacity: refreshingInternalDb ? 0.5 : 1,
                      }}
                    >
                      <RefreshCw size={14} style={{ animation: refreshingInternalDb ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {externalDbOverview?.connections.internal.ok ? (
                      <CheckCircle size={16} color="#10B981" />
                    ) : (
                      <XCircle size={16} color="#EF4444" />
                    )}
                    <span style={{ fontSize: '14px', fontWeight: 600, color: externalDbOverview?.connections.internal.ok ? '#10B981' : '#EF4444' }}>
                      {externalDbOverview?.connections.internal.ok ? t('common.connected') : t('common.disconnected')}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {externalDbOverview?.databases.internal.databaseName ?? '—'}
                  </div>
                  {externalDbOverview?.counts && (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{externalDbOverview.counts.stores}</span> {t('common.stores', 'Stores')}
                      </div>
                      <div>
                        <span style={{ fontWeight: 600 }}>{externalDbOverview.counts.companies}</span> {t('common.companies', 'Companies')}
                      </div>
                    </div>
                  )}
                </div>

                {/* External Database */}
                <div style={{
                  padding: '14px',
                  background: 'var(--surface-50)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Database size={16} color="var(--text-muted)" />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {t('externalAffluence.externalDatabase')}
                      </span>
                    </div>
                    <button
                      onClick={handleRefreshDatabases}
                      disabled={refreshingExternalDb}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: refreshingExternalDb ? 'not-allowed' : 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        opacity: refreshingExternalDb ? 0.5 : 1,
                      }}
                    >
                      <RefreshCw size={14} style={{ animation: refreshingExternalDb ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {externalDbOverview?.connections.external.ok ? (
                      <CheckCircle size={16} color="#10B981" />
                    ) : (
                      <XCircle size={16} color="#EF4444" />
                    )}
                    <span style={{ fontSize: '14px', fontWeight: 600, color: externalDbOverview?.connections.external.ok ? '#10B981' : '#EF4444' }}>
                      {externalDbOverview?.connections.external.ok ? t('common.connected') : t('common.disconnected')}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {externalDbOverview?.databases.external.databaseName ?? '—'}
                  </div>
                  {externalStores.length > 0 && (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{externalStores.length}</span> {t('common.stores', 'Stores')}
                      </div>
                      <div>
                        <span style={{ fontWeight: 600 }}>{externalCompanyCount}</span> {t('common.companies', 'Companies')}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Company Info - ATS Style */}
              {companyName && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                    🏢 {t('common.company', 'Company')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--background)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    {companyLogoFilename && getCompanyLogoUrl(companyLogoFilename) ? (
                      <img 
                        src={getCompanyLogoUrl(companyLogoFilename) || ''} 
                        alt={companyName}
                        style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: 'var(--primary)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 14,
                      }}>
                        {companyName?.[0]?.toUpperCase() || 'C'}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {companyName}
                        </span>
                        {companyCountry && (
                          <ReactCountryFlag 
                            countryCode={companyCountry} 
                            svg 
                            style={{ width: '0.9em', height: '0.9em', flexShrink: 0 }} 
                          />
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {companyGroupName && (
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
                            {companyGroupName}
                          </span>
                        )}
                        {(companyOwnerName || companyOwnerSurname) && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            {companyOwnerAvatarFilename && getAvatarUrl(companyOwnerAvatarFilename) ? (
                              <img 
                                src={getAvatarUrl(companyOwnerAvatarFilename) || ''} 
                                alt={`${companyOwnerName ?? ''} ${companyOwnerSurname ?? ''}`.trim()}
                                style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }}
                              />
                            ) : (
                              <div style={{
                                width: 14, height: 14, borderRadius: '50%',
                                background: 'var(--primary)', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 7, fontWeight: 700,
                              }}>
                                {(companyOwnerName?.[0] || companyOwnerSurname?.[0] || 'O').toUpperCase()}
                              </div>
                            )}
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                              {companyOwnerName} {companyOwnerSurname}
                            </span>
                          </div>
                        )}
                        {companyStoreCount != null && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            · {companyStoreCount} {t('employees.storesLabel', 'Stores')}
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
                  {store?.logoFilename && getStoreLogoUrl(store.logoFilename) ? (
                    <img 
                      src={getStoreLogoUrl(store.logoFilename) || ''} 
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                      {formData.city && (
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                          📍 {formData.city}{formData.state ? `, ${formData.state}` : ''}{formData.country ? ` · ${formData.country}` : ''}
                        </div>
                      )}
                      {store?.employeeCount != null && store.employeeCount > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                          · 👥 {store.employeeCount} {t('common.employees', 'Employees')}
                        </div>
                      )}
                    </div>
                    {/* HR and Manager Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                      {hrContact && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {hrContact.avatarFilename && getAvatarUrl(hrContact.avatarFilename) ? (
                            <img 
                              src={getAvatarUrl(hrContact.avatarFilename) || ''} 
                              alt={`${hrContact.name} ${hrContact.surname}`}
                              style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{
                              width: 16, height: 16, borderRadius: '50%',
                              background: '#0284C7', color: '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 8, fontWeight: 700,
                            }}>
                              {hrContact.name?.[0]?.toUpperCase() || 'H'}
                            </div>
                          )}
                          <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}>
                            HR: {hrContact.name} {hrContact.surname}
                          </span>
                        </div>
                      )}
                      {managerContact && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {managerContact.avatarFilename && getAvatarUrl(managerContact.avatarFilename) ? (
                            <img 
                              src={getAvatarUrl(managerContact.avatarFilename) || ''} 
                              alt={`${managerContact.name} ${managerContact.surname}`}
                              style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{
                              width: 16, height: 16, borderRadius: '50%',
                              background: '#B45309', color: '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 8, fontWeight: 700,
                            }}>
                              {managerContact.name?.[0]?.toUpperCase() || 'M'}
                            </div>
                          )}
                          <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}>
                            Manager: {managerContact.name} {managerContact.surname}
                          </span>
                        </div>
                      )}
                    </div>
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
                /* Show comprehensive integration details */
                <div style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                  overflow: 'hidden',
                }}>
                  {/* Header */}
                  <div style={{ 
                    background: 'var(--primary)', 
                    padding: '14px 18px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle size={18} color="#fff" />
                      <div>
                        <div style={{ fontSize: '9px', letterSpacing: '2px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '2px' }}>
                          {t('externalAffluence.integration', 'Integration')}
                        </div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '14px', color: '#fff' }}>
                          {t('externalAffluence.integrationActive')}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleRemoveIntegration}
                      loading={integrationLoading}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        background: 'rgba(239,68,68,0.9)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        fontSize: '11px'
                      }}
                    >
                      <Unlink size={12} />
                      {t('common.remove')}
                    </Button>
                  </div>

                  {/* Integration Details Grid */}
                  <div style={{ padding: '18px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
                      {/* External Store Info */}
                      <div style={{ 
                        padding: '14px',
                        background: 'var(--background)',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                      }}>
                        <div style={{ 
                          fontSize: '10px', 
                          fontWeight: 700, 
                          color: 'var(--accent)', 
                          textTransform: 'uppercase', 
                          letterSpacing: '1.5px', 
                          marginBottom: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          🌐 {t('externalAffluence.externalStore', 'External Store')}
                        </div>
                        {externalCompanyLabel && (
                          <div style={{ marginBottom: '10px' }}>
                            <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {t('externalAffluence.externalCompanyName', 'Company')}
                            </span>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                              {externalCompanyLabel}
                            </div>
                          </div>
                        )}
                        <div style={{ marginBottom: '10px' }}>
                          <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {t('externalAffluence.storeCode', 'Store Code')}
                          </span>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', marginTop: '2px', fontFamily: 'monospace' }}>
                            {currentMapping.externalStoreCode}
                          </div>
                        </div>
                        {currentMapping.externalStoreName && (
                          <div>
                            <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {t('externalAffluence.storeName', 'Store Name')}
                            </span>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {currentMapping.externalStoreName}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Internal Store Info */}
                      <div style={{ 
                        padding: '14px',
                        background: 'var(--surface-warm)',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                      }}>
                        <div style={{ 
                          fontSize: '10px', 
                          fontWeight: 700, 
                          color: 'var(--primary)', 
                          textTransform: 'uppercase', 
                          letterSpacing: '1.5px', 
                          marginBottom: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          🏪 {t('externalAffluence.internalStore', 'Internal Store')}
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                          <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {t('externalAffluence.storeCode', 'Store Code')}
                          </span>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', marginTop: '2px', fontFamily: 'monospace' }}>
                            {currentMapping.localStoreCode}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {t('externalAffluence.storeName', 'Store Name')}
                          </span>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {currentMapping.localStoreName}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Integration Metadata */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '12px', 
                      paddingTop: '16px', 
                      borderTop: '1px solid var(--border)',
                      background: 'var(--background)',
                      padding: '16px',
                      borderRadius: '8px',
                      marginTop: '4px'
                    }}>
                      {/* Integrated By */}
                      {integratedByName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ 
                            fontSize: '9px', 
                            fontWeight: 700, 
                            color: 'var(--text-muted)', 
                            textTransform: 'uppercase', 
                            letterSpacing: '1px', 
                            minWidth: '90px' 
                          }}>
                            {t('externalAffluence.integratedBy', 'Integrated By')}:
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {integratedByAvatar && getAvatarUrl(integratedByAvatar) ? (
                              <img 
                                src={getAvatarUrl(integratedByAvatar) || ''} 
                                alt={integratedByName}
                                style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }}
                              />
                            ) : (
                              <div style={{
                                width: 20, height: 20, borderRadius: '50%',
                                background: 'var(--accent)', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 10, fontWeight: 700,
                              }}>
                                {integratedByName?.[0]?.toUpperCase() || 'U'}
                              </div>
                            )}
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {integratedByName}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Data Available */}
                      {mappedExternalRow && mappedExternalRow.availableDays > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ 
                            fontSize: '9px', 
                            fontWeight: 700, 
                            color: 'var(--text-muted)', 
                            textTransform: 'uppercase', 
                            letterSpacing: '1px', 
                            minWidth: '90px' 
                          }}>
                            {t('externalAffluence.dataAvailable', 'Data Available')}:
                          </span>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            background: 'rgba(22,163,74,0.12)',
                            border: '1px solid rgba(34,197,94,0.3)'
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>
                              {mappedExternalRow.availableDays} {t('common.days', 'days')}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Date Range */}
                      {mappedExternalRow && mappedExternalRow.availableFromDate && mappedExternalRow.availableToDate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ 
                            fontSize: '9px', 
                            fontWeight: 700, 
                            color: 'var(--text-muted)', 
                            textTransform: 'uppercase', 
                            letterSpacing: '1px', 
                            minWidth: '90px' 
                          }}>
                            {t('externalAffluence.dataRange', 'Date Range')}:
                          </span>
                          <span style={{ 
                            fontSize: '12px', 
                            color: 'var(--text-secondary)', 
                            fontFamily: 'monospace',
                            background: 'var(--surface)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-light)'
                          }}>
                            {formatDateRange(mappedExternalRow.availableFromDate, mappedExternalRow.availableToDate, locale)}
                          </span>
                        </div>
                      )}
                    </div>
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

              {/* External Stores Table - Hide when integration exists */}
              {!currentMapping && (
                  <div style={{
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)',
                    overflow: 'hidden',
                  }}>
                    {/* Header */}
                    <div style={{ 
                      background: 'var(--primary)', 
                      padding: '12px 16px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between' 
                    }}>
                      <div>
                        <div style={{ fontSize: '9px', letterSpacing: '2px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '2px' }}>
                          {t('externalAffluence.availableStores', 'Available Stores')}
                        </div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '13px', color: '#fff' }}>
                          {t('externalAffluence.availableExternalStores')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {externalStoresLoading && (
                          <div style={{
                            width: 14, height: 14, borderRadius: '50%',
                            border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                            animation: 'spin 0.7s linear infinite',
                          }} />
                        )}
                      </div>
                    </div>

                    {/* Search Bar */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Input
                          value={externalSearchQuery}
                          onChange={(e) => setExternalSearchQuery(e.target.value)}
                          placeholder={t('externalAffluence.searchStores', 'Search by store name, company, or code...')}
                          style={{ flex: 1 }}
                        />
                        <Button onClick={handleExternalSearch} loading={externalStoresLoading} size="sm">
                          <Search size={14} />
                        </Button>
                      </div>
                    </div>

                    {externalStoresError && (
                      <div style={{ padding: '12px 16px' }}>
                        <Alert variant="danger" onClose={() => setExternalStoresError(null)}>
                          {externalStoresError}
                        </Alert>
                      </div>
                    )}

                    {externalStoresLoading ? (
                      <div style={{ padding: '40px', textAlign: 'center' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          {t('common.loading')}...
                        </div>
                      </div>
                    ) : filteredExternalStores.length === 0 ? (
                      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>🏪</div>
                        {externalSearchQuery.trim() ? 
                          t('externalAffluence.noSearchResults', 'No stores found matching your search.') :
                          t('externalAffluence.noExternalStores')
                        }
                      </div>
                    ) : (
                      <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead style={{ position: 'sticky', top: 0, background: 'var(--accent)', zIndex: 1 }}>
                            <tr>
                              <th style={{ 
                                padding: '8px 10px', 
                                textAlign: 'left', 
                                fontSize: '8px', 
                                fontWeight: 700, 
                                color: '#fff', 
                                textTransform: 'uppercase', 
                                letterSpacing: '1.2px',
                                borderRight: '1px solid rgba(255,255,255,0.1)',
                                width: '15%'
                              }}>
                                {t('externalAffluence.storeCode')}
                              </th>
                              <th style={{ 
                                padding: '8px 10px', 
                                textAlign: 'left', 
                                fontSize: '8px', 
                                fontWeight: 700, 
                                color: '#fff', 
                                textTransform: 'uppercase', 
                                letterSpacing: '1.2px',
                                borderRight: '1px solid rgba(255,255,255,0.1)',
                                width: '25%'
                              }}>
                                {t('externalAffluence.storeName')}
                              </th>
                              <th style={{ 
                                padding: '8px 10px', 
                                textAlign: 'left', 
                                fontSize: '8px', 
                                fontWeight: 700, 
                                color: '#fff', 
                                textTransform: 'uppercase', 
                                letterSpacing: '1.2px',
                                borderRight: '1px solid rgba(255,255,255,0.1)',
                                width: '20%'
                              }}>
                                {t('externalAffluence.companyName')}
                              </th>
                              <th style={{ 
                                padding: '8px 10px', 
                                textAlign: 'center', 
                                fontSize: '8px', 
                                fontWeight: 700, 
                                color: '#fff', 
                                textTransform: 'uppercase', 
                                letterSpacing: '1.2px',
                                borderRight: '1px solid rgba(255,255,255,0.1)',
                                width: '15%'
                              }}>
                                {t('externalAffluence.dataAvailable')}
                              </th>
                              <th style={{ 
                                padding: '8px 10px', 
                                textAlign: 'left', 
                                fontSize: '8px', 
                                fontWeight: 700, 
                                color: '#fff', 
                                textTransform: 'uppercase', 
                                letterSpacing: '1.2px',
                                width: '25%'
                              }}>
                                {t('externalAffluence.dataRange')}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredExternalStores.map((externalStore, idx) => (
                              <tr
                                key={idx}
                                style={{
                                  cursor: 'pointer',
                                  background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-warm)',
                                  transition: 'background 0.15s ease',
                                }}
                                onMouseEnter={(e) => { 
                                  e.currentTarget.style.background = 'var(--accent-light)'; 
                                }}
                                onMouseLeave={(e) => { 
                                  e.currentTarget.style.background = idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-warm)'; 
                                }}
                                onClick={() => {
                                  setExternalStoreCode(externalStore.externalStoreCode);
                                  setExternalStoreName(externalStore.storeName ?? '');
                                }}
                              >
                                <td style={{ 
                                  padding: '10px', 
                                  fontSize: '11px', 
                                  fontWeight: 700, 
                                  color: 'var(--primary)', 
                                  borderBottom: '1px solid var(--border-light)',
                                  fontFamily: 'monospace'
                                }}>
                                  {externalStore.externalStoreCode}
                                </td>
                                <td style={{ 
                                  padding: '10px', 
                                  fontSize: '11px', 
                                  color: 'var(--text-primary)', 
                                  borderBottom: '1px solid var(--border-light)',
                                  fontWeight: 500
                                }}>
                                  {externalStore.storeName ?? '—'}
                                </td>
                                <td style={{ 
                                  padding: '10px', 
                                  fontSize: '10px', 
                                  color: 'var(--text-secondary)', 
                                  borderBottom: '1px solid var(--border-light)' 
                                }}>
                                  {externalStore.companyName ?? '—'}
                                </td>
                                <td style={{ 
                                  padding: '10px', 
                                  textAlign: 'center', 
                                  fontSize: '10px', 
                                  borderBottom: '1px solid var(--border-light)' 
                                }}>
                                  {externalStore.availableDays > 0 ? (
                                    <div style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      padding: '2px 6px',
                                      borderRadius: '10px',
                                      background: 'rgba(22,163,74,0.12)',
                                      border: '1px solid rgba(34,197,94,0.3)'
                                    }}>
                                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#22c55e' }} />
                                      <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '9px' }}>
                                        {externalStore.availableDays} {t('common.days')}
                                      </span>
                                    </div>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                                  )}
                                </td>
                                <td style={{ 
                                  padding: '10px', 
                                  fontSize: '9px', 
                                  color: 'var(--text-secondary)', 
                                  borderBottom: '1px solid var(--border-light)',
                                  fontFamily: 'monospace'
                                }}>
                                  {externalStore.availableFromDate && externalStore.availableToDate ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                        {new Date(externalStore.availableFromDate).toLocaleDateString()}
                                      </span>
                                      <span style={{ color: 'var(--text-muted)', fontSize: '8px' }}>
                                        → {new Date(externalStore.availableToDate).toLocaleDateString()}
                                      </span>
                                    </div>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
              )}
            </div>
          ) : (
            /* ========== STEP 1: Store Details ========== */
            <>
              <Input
                label={t('stores.fieldName')}
                value={formData.name}
                onChange={(event) => setFormData((p) => ({ ...p, name: event.target.value }))}
                placeholder={t('stores.placeholderName')}
                disabled={formSaving}
              />
              <Input
                label={t('stores.fieldCode')}
                value={formData.code}
                onChange={(event) => setFormData((p) => ({ ...p, code: event.target.value.toUpperCase() }))}
                placeholder={t('stores.placeholderCode')}
                disabled={formSaving}
              />
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                    {t('stores.fieldMaxStaff')}
                  </label>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {activeEmployeeCount} / {maxCapacityLabel}
                  </span>
                </div>
                <Input
                  type="number"
                  min="0"
                  value={formData.maxStaff}
                  onChange={(event) => setFormData((p) => ({ ...p, maxStaff: event.target.value }))}
                  placeholder={t('stores.placeholderMaxStaff')}
                  disabled={formSaving}
                />
              </div>
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
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        title={t('stores.confirmDeactivate')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeactivateOpen(false)} disabled={deactivating}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={handleDeactivate} loading={deactivating} disabled={!deactivateMatches}>{t('common.deactivate')}</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {deactivateError ? <Alert variant="danger" onClose={() => setDeactivateError(null)}>{deactivateError}</Alert> : null}
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>
            {t('stores.confirmDeactivateMsg', { name: store.name })}
          </p>
          <Input
            label={t('stores.typeNameToDeactivate', 'Type the exact store name to deactivate')}
            value={deactivateInput}
            onChange={(event) => setDeactivateInput(event.target.value)}
            placeholder={store.name}
            disabled={deactivating}
          />
          <div style={{ fontSize: 12, color: deactivateMatches ? '#166534' : 'var(--text-muted)' }}>
            {deactivateMatches
              ? t('stores.deactivateNameMatched', 'Name matches. Deactivation is enabled.')
              : t('stores.deactivateNameMismatch', 'Name must match exactly to deactivate.')}
          </div>
        </div>
      </Modal>

      <Modal
        open={hoursModalOpen}
        onClose={() => { if (!hoursSaving) setHoursModalOpen(false); }}
        title={t('stores.manageHoursTitle', 'Manage operating hours')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setHoursModalOpen(false)} disabled={hoursSaving}>{t('common.cancel')}</Button>
            <Button onClick={handleSaveHours} loading={hoursSaving}>{t('common.save')}</Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          {hoursError ? <Alert variant="danger" onClose={() => setHoursError(null)}>{hoursError}</Alert> : null}
          {hours.map((row) => {
            const isToday = row.dayOfWeek === todayIndex;
            const peakConfigured = hasPeakWindow(row);
            const shiftPlanConfigured = hasShiftPlan(row);
            const extrasExpanded = Boolean(hoursExpandedDays[row.dayOfWeek]);
            const peakDuration = peakConfigured ? durationLabel(row.peakStartTime ?? null, row.peakEndTime ?? null) : null;
            return (
              <div key={row.dayOfWeek} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', background: isToday ? 'rgba(201,151,58,0.08)' : 'var(--surface-warm)', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {dayLabels[row.dayOfWeek]}
                    {isToday ? <Badge variant="warning">{t('stores.today', 'Today')}</Badge> : null}
                  </div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={row.isClosed}
                      onChange={(event) => handleHoursChange(row.dayOfWeek, {
                        isClosed: event.target.checked,
                        openTime: row.openTime ?? '09:00',
                        closeTime: row.closeTime ?? '18:00',
                      })}
                    />
                    {t('stores.dayClosed', 'Closed')}
                  </label>
                </div>

                <div style={{ display: 'grid', gap: 10, opacity: row.isClosed ? 0.62 : 1 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, alignItems: 'end' }}>
                    <label style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Sunrise size={12} />{t('stores.opensAt', 'Opens')}</span>
                      <input
                        type="time"
                        value={row.openTime ?? '09:00'}
                        disabled={row.isClosed}
                        onChange={(event) => handleHoursChange(row.dayOfWeek, { openTime: event.target.value })}
                        style={timeInputStyle}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Sunset size={12} />{t('stores.closesAt', 'Closes')}</span>
                      <input
                        type="time"
                        value={row.closeTime ?? '18:00'}
                        disabled={row.isClosed}
                        onChange={(event) => handleHoursChange(row.dayOfWeek, { closeTime: event.target.value })}
                        style={timeInputStyle}
                      />
                    </label>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, paddingBottom: 6 }}>
                      {t('stores.openDuration', 'Duration')}: {durationLabel(row.openTime, row.closeTime)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <button
                      type="button"
                      onClick={() => setHoursExpandedDays((prev) => ({
                        ...prev,
                        [row.dayOfWeek]: !Boolean(prev[row.dayOfWeek]),
                      }))}
                      style={inlineGhostBtnStyle}
                    >
                      <Settings2 size={12} />
                      {extrasExpanded
                        ? t('stores.hideAdvancedHours', 'Hide peak hours and shift plan')
                        : t('stores.showAdvancedHours', 'Add peak hours and shift plan')}
                    </button>
                  </div>

                  {extrasExpanded ? (
                    <>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--surface)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                            <TrendingUp size={13} />
                            {t('stores.peakHours', 'Peak hours')}
                          </div>
                          {peakConfigured ? (
                            <button
                              type="button"
                              disabled={row.isClosed}
                              onClick={() => handleHoursChange(row.dayOfWeek, { peakStartTime: null, peakEndTime: null })}
                              style={{ ...inlineGhostBtnStyle, color: '#9a3412' }}
                            >
                              <XCircle size={12} />
                              {t('common.remove', 'Remove')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={row.isClosed}
                              onClick={() => handleHoursChange(row.dayOfWeek, {
                                peakStartTime: row.openTime ?? '12:00',
                                peakEndTime: row.closeTime ?? '14:00',
                              })}
                              style={inlineGhostBtnStyle}
                            >
                              <PlusCircle size={12} />
                              {t('stores.addPeakHours', 'Add peak window')}
                            </button>
                          )}
                        </div>
                        {peakConfigured ? (
                          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, alignItems: 'end' }}>
                            <label style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                              <span>{t('stores.peakStart', 'Peak start')}</span>
                              <input
                                type="time"
                                value={row.peakStartTime ?? '12:00'}
                                disabled={row.isClosed}
                                onChange={(event) => handleHoursChange(row.dayOfWeek, { peakStartTime: event.target.value })}
                                style={timeInputStyle}
                              />
                            </label>
                            <label style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                              <span>{t('stores.peakEnd', 'Peak end')}</span>
                              <input
                                type="time"
                                value={row.peakEndTime ?? '14:00'}
                                disabled={row.isClosed}
                                onChange={(event) => handleHoursChange(row.dayOfWeek, { peakEndTime: event.target.value })}
                                style={timeInputStyle}
                              />
                            </label>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, paddingBottom: 6 }}>
                              {t('stores.peakDuration', 'Peak duration')}: {peakDuration ?? '—'}
                            </div>
                          </div>
                        ) : (
                          <div style={{ marginTop: 7, fontSize: 12, color: 'var(--text-muted)' }}>
                            {t('stores.peakHoursUnset', 'Not set')}
                          </div>
                        )}
                      </div>

                      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--surface)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                            <ClipboardList size={13} />
                            {t('stores.shiftPlan', 'Shift plan')}
                          </div>
                          {shiftPlanConfigured && (
                            <button
                              type="button"
                              disabled={row.isClosed}
                              onClick={() => handleHoursChange(row.dayOfWeek, {
                                plannedShiftCount: null,
                                plannedStaffCount: null,
                                shiftPlanNotes: null,
                              })}
                              style={{ ...inlineGhostBtnStyle, color: '#9a3412' }}
                            >
                              <XCircle size={12} />
                              {t('stores.clearShiftPlan', 'Clear plan')}
                            </button>
                          )}
                        </div>
                        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                          <label style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                            <span>{t('stores.shiftCount', 'Planned shifts')}</span>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={row.plannedShiftCount ?? ''}
                              disabled={row.isClosed}
                              onChange={(event) => handleHoursChange(row.dayOfWeek, { plannedShiftCount: parseNullableInt(event.target.value) })}
                              style={timeInputStyle}
                              placeholder="0"
                            />
                          </label>
                          <label style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                            <span>{t('stores.staffCount', 'Planned staff')}</span>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={row.plannedStaffCount ?? ''}
                              disabled={row.isClosed}
                              onChange={(event) => handleHoursChange(row.dayOfWeek, { plannedStaffCount: parseNullableInt(event.target.value) })}
                              style={timeInputStyle}
                              placeholder="0"
                            />
                          </label>
                        </div>
                        <label style={{ marginTop: 8, display: 'grid', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                          <span>{t('stores.shiftPlanNotes', 'Shift plan notes')}</span>
                          <textarea
                            value={row.shiftPlanNotes ?? ''}
                            maxLength={500}
                            disabled={row.isClosed}
                            onChange={(event) => handleHoursChange(row.dayOfWeek, { shiftPlanNotes: event.target.value })}
                            placeholder={t('stores.shiftPlanNotesPlaceholder', 'Optional context for planners and managers')}
                            style={{ ...timeInputStyle, minHeight: 52, resize: 'vertical', padding: '7px 8px' }}
                          />
                        </label>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      <Modal
        open={activateOpen}
        onClose={() => setActivateOpen(false)}
        title={t('stores.confirmActivate')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setActivateOpen(false)} disabled={activating}>{t('common.cancel')}</Button>
            <Button onClick={handleActivate} loading={activating}>{t('common.activate')}</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activateError ? <Alert variant="danger" onClose={() => setActivateError(null)}>{activateError}</Alert> : null}
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>
            {t('stores.confirmActivateMsg', { name: store.name })}
          </p>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('stores.confirmDeleteTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>{t('stores.confirmDeleteBtn')}</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {deleteError ? <Alert variant="danger" onClose={() => setDeleteError(null)}>{deleteError}</Alert> : null}
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>
            {t('stores.confirmDeleteMsg', { name: store.name })}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--warning)', fontWeight: 500 }}>
            {t('stores.confirmDeleteWarning')}
          </p>
        </div>
      </Modal>
    </div>
  );
}

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
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
      <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{valueNode}</div>
    </div>
  );
}

function MetaLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
        {icon}
        {label}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 700, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function HoursMetric({
  icon,
  label,
  value,
  secondary,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 9px', background: 'var(--surface)' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
        {icon}
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>
        {value}
      </div>
      {secondary ? (
        <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-muted)' }}>
          {secondary}
        </div>
      ) : null}
    </div>
  );
}

const timeInputStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '5px 7px',
  fontSize: 12,
  background: 'var(--surface)',
  color: 'var(--text-primary)',
};

const inlineGhostBtnStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 7,
  background: 'var(--surface-warm)',
  color: 'var(--text-secondary)',
  fontSize: 11,
  fontWeight: 700,
  padding: '4px 8px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  cursor: 'pointer',
};
