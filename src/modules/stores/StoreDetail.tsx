import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  MapPin,
  Users,
  ArrowLeft,
  Hash,
  Pencil,
  PowerOff,
  Power,
  Trash2,
  Camera,
  Clock3,
  CalendarClock,
  UserRound,
  BriefcaseBusiness,
  UploadCloud,
  Settings2,
  Sunrise,
  Sunset,
  TrendingUp,
  ClipboardList,
  PlusCircle,
  XCircle,
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
import { getEmployees } from '../../api/employees';
import { getAvatarUrl, getStoreLogoUrl } from '../../api/client';
import { translateApiError } from '../../utils/apiErrors';
import { Employee, Store, StoreOperatingHour } from '../../types';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';

interface StoreFormData {
  name: string;
  code: string;
  address: string;
  cap: string;
  maxStaff: string;
}

const emptyForm: StoreFormData = {
  name: '',
  code: '',
  address: '',
  cap: '',
  maxStaff: '',
};

function parseStoreIdFromSlug(slug?: string): number | null {
  if (!slug) return null;
  const match = slug.match(/^(\d+)(?:-|$)/);
  if (!match) return null;
  const id = parseInt(match[1], 10);
  return Number.isNaN(id) ? null : id;
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
  const canManageStatus = user?.role === 'admin';

  const [store, setStore] = useState<Store | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [hours, setHours] = useState<StoreOperatingHour[]>(defaultOperatingHours());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [formData, setFormData] = useState<StoreFormData>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  const [logoHover, setLogoHover] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

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
      setEmployees((employeesData.employees ?? []).sort((a, b) => `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`)));
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

  const logoUrl = getStoreLogoUrl(store?.logoFilename);

  const openEdit = () => {
    if (!store) return;
    setFormData({
      name: store.name,
      code: store.code,
      address: store.address ?? '',
      cap: store.cap ?? '',
      maxStaff: store.maxStaff != null ? String(store.maxStaff) : '',
    });
    setFormError(null);
    setEditOpen(true);
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
      setLogoError(translateApiError(err, t, t('stores.logoError', 'Error uploading store photo')));
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
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)' }}>{store.name}</div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--primary)', border: '1px solid rgba(13,33,55,0.2)', background: 'rgba(13,33,55,0.08)', borderRadius: 999, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Building2 size={11} />
                  {store.companyName ?? '—'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--accent)', border: '1px solid rgba(201,151,58,0.34)', background: 'rgba(201,151,58,0.12)', borderRadius: 999, padding: '3px 8px' }}>
                  {store.groupName ?? t('companies.optionStandalone')}
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
            <InfoChip icon={<MapPin size={13} />} label={t('stores.colAddress', 'Address')} value={store.address || '—'} />
            <InfoChip icon={<Building2 size={13} />} label={t('stores.colCap', 'Postal code')} value={store.cap || '—'} />
            <InfoChip icon={<Users size={13} />} label={t('stores.colMaxStaff', 'Max staff')} value={store.maxStaff != null ? String(store.maxStaff) : '0'} />
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
                <div key={employee.id} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-warm)', padding: '11px 12px', display: 'grid', gap: 9 }}>
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
                    <MetaLine icon={<BriefcaseBusiness size={12} />} label={t('roles.label', 'Role')} value={t(`roles.${employee.role}`, employee.role)} />
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
          {canEdit && (
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
        onClose={() => setEditOpen(false)}
        title={t('stores.editStore')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={formSaving}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} loading={formSaving}>{t('common.save')}</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {formError ? <Alert variant="danger" onClose={() => setFormError(null)}>{formError}</Alert> : null}
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
          <Input
            label={t('stores.fieldAddress')}
            value={formData.address}
            onChange={(event) => setFormData((p) => ({ ...p, address: event.target.value }))}
            placeholder={t('stores.placeholderAddress')}
            disabled={formSaving}
          />
          <Input
            label={t('stores.fieldCap')}
            value={formData.cap}
            onChange={(event) => setFormData((p) => ({ ...p, cap: event.target.value }))}
            placeholder={t('stores.placeholderCap')}
            disabled={formSaving}
          />
          <Input
            label={t('stores.fieldMaxStaff')}
            type="number"
            min="0"
            value={formData.maxStaff}
            onChange={(event) => setFormData((p) => ({ ...p, maxStaff: event.target.value }))}
            placeholder={t('stores.placeholderMaxStaff')}
            disabled={formSaving}
          />
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

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px', background: 'var(--surface-warm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {icon}
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function MetaLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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
