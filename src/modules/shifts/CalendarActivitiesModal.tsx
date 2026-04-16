import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Store } from '../../types';
import { StoreActivityType, WindowDisplayActivity } from '../../api/windowDisplay';
import { getEmployees } from '../../api/employees';
import { getAvatarUrl, getCompanyLogoUrl, getStoreLogoUrl } from '../../api/client';
import { DatePicker } from '../../components/ui/DatePicker';
import CustomSelect, { SelectOption } from '../../components/ui/CustomSelect';
import { Input } from '../../components/ui/Input';
import {
  ACTIVITY_ICON_OPTIONS,
  getActivityDefaultIcon,
  getActivityIcon,
  getActivityTypeLabel,
  isCustomActivityType,
  STORE_ACTIVITY_DEFINITIONS,
  STORE_ACTIVITY_GROUPS,
} from './storeActivityCatalog';

interface CalendarActivitiesModalProps {
  open: boolean;
  onClose: () => void;
  viewMode: 'day' | 'week' | 'month';
  currentDate: Date;
  initialDate?: string | null;
  stores: Store[];
  canManage: boolean;
  activities: WindowDisplayActivity[];
  saving?: boolean;
  onSave: (payload: {
    id?: number;
    storeId: number;
    date: string;
    activityType: StoreActivityType;
    activityIcon: string | null;
    customActivityName: string | null;
    durationHours: number | null;
    notes: string | null;
    companyId?: number | null;
  }) => Promise<void>;
  onDelete: (id: number, companyId?: number | null) => Promise<void>;
}

type StoreOption = {
  id: number;
  name: string;
  companyId: number | null;
  companyName: string;
  logoFilename: string | null;
  companyLogoFilename: string | null;
  employeeCount: number | null;
};

type StoreMeta = {
  hrName: string | null;
  hrAvatarFilename: string | null;
  areaManagerName: string | null;
  areaManagerAvatarFilename: string | null;
  employeeCount: number;
};

function formatIsoMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function firstDayOfMonth(month: string): string {
  return `${month}-01`;
}

function lastDayOfMonth(month: string): string {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const end = new Date(year, monthIndex + 1, 0);
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, '0');
  const d = String(end.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeNumberInput(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function humanName(name: string | null | undefined, surname: string | null | undefined): string | null {
  const value = `${name ?? ''} ${surname ?? ''}`.trim();
  return value || null;
}

function initialsFromName(fullName: string | null): string {
  if (!fullName) return '?';
  const parts = fullName.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

export default function CalendarActivitiesModal({
  open,
  onClose,
  viewMode,
  currentDate,
  initialDate,
  stores,
  canManage,
  activities,
  saving = false,
  onSave,
  onDelete,
}: CalendarActivitiesModalProps) {
  const { t, i18n } = useTranslation();
  const [selectedMonth, setSelectedMonth] = useState(formatIsoMonth(currentDate));
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formType, setFormType] = useState<StoreActivityType>('window_display');
  const [formIcon, setFormIcon] = useState('');
  const [formCustomActivityName, setFormCustomActivityName] = useState('');
  const [formDurationHours, setFormDurationHours] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryEmployees, setDirectoryEmployees] = useState<Array<{
    id: number;
    companyId: number;
    storeId: number | null;
    supervisorId: number | null;
    role: string;
    status: string;
    name: string;
    surname: string;
    avatarFilename: string | null;
  }>>([]);

  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';

  useEffect(() => {
    if (!open) return;
    const month = initialDate?.slice(0, 7) ?? formatIsoMonth(currentDate);
    setSelectedMonth(month);
    setSelectedCompanyId(null);
    setLocalError(null);
  }, [open, initialDate, currentDate]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const loadDirectory = async () => {
      setDirectoryLoading(true);
      try {
        const resp = await getEmployees({ limit: 500, status: 'active' });
        if (!cancelled) {
          setDirectoryEmployees(resp.employees.map((employee) => ({
            id: employee.id,
            companyId: employee.companyId,
            storeId: employee.storeId,
            supervisorId: employee.supervisorId,
            role: employee.role,
            status: employee.status,
            name: employee.name,
            surname: employee.surname,
            avatarFilename: employee.avatarFilename ?? null,
          })));
        }
      } catch {
        if (!cancelled) {
          setDirectoryEmployees([]);
        }
      } finally {
        if (!cancelled) {
          setDirectoryLoading(false);
        }
      }
    };

    void loadDirectory();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const allStores = useMemo<StoreOption[]>(() => {
    const map = new Map<number, StoreOption>();

    for (const store of stores) {
      map.set(store.id, {
        id: store.id,
        name: store.name,
        companyId: store.companyId,
        companyName: store.companyName ?? `${t('companies.single', 'Company')} #${store.companyId}`,
        logoFilename: store.logoFilename ?? null,
        companyLogoFilename: store.companyLogoFilename ?? null,
        employeeCount: store.employeeCount ?? null,
      });
    }

    for (const activity of activities) {
      if (!map.has(activity.storeId)) {
        map.set(activity.storeId, {
          id: activity.storeId,
          name: activity.storeName ?? `${t('stores.single', 'Store')} #${activity.storeId}`,
          companyId: activity.companyId,
          companyName: `${t('companies.single', 'Company')} #${activity.companyId}`,
          logoFilename: null,
          companyLogoFilename: null,
          employeeCount: null,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [stores, activities, t]);

  const companyOptions = useMemo(() => {
    const companies = new Map<number, string>();
    for (const store of allStores) {
      if (store.companyId == null) continue;
      companies.set(store.companyId, store.companyName);
    }
    return Array.from(companies.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allStores]);

  const monthActivities = useMemo(() => (
    activities.filter((item) => {
      if (item.yearMonth !== selectedMonth) return false;
      if (selectedCompanyId == null) return true;
      return item.companyId === selectedCompanyId;
    })
  ), [activities, selectedMonth, selectedCompanyId]);

  const monthActivitiesByStore = useMemo(() => {
    const map = new Map<number, WindowDisplayActivity>();
    for (const item of monthActivities) {
      map.set(item.storeId, item);
    }
    return map;
  }, [monthActivities]);

  const availableStores = useMemo(() => (
    allStores.filter((store) => (selectedCompanyId == null ? true : store.companyId === selectedCompanyId))
  ), [allStores, selectedCompanyId]);

  useEffect(() => {
    if (!open) return;
    if (!availableStores.length) {
      setSelectedStoreId(null);
      return;
    }

    if (selectedStoreId && availableStores.some((item) => item.id === selectedStoreId)) {
      return;
    }

    setSelectedStoreId(availableStores[0].id);
  }, [open, availableStores, selectedStoreId]);

  const selectedStore = useMemo(
    () => availableStores.find((store) => store.id === selectedStoreId) ?? null,
    [availableStores, selectedStoreId],
  );

  const selectedActivity = selectedStoreId ? monthActivitiesByStore.get(selectedStoreId) ?? null : null;

  useEffect(() => {
    if (!open || !selectedStoreId) return;

    if (selectedActivity) {
      setFormDate(selectedActivity.date);
      setFormType(selectedActivity.activityType);
      setFormIcon(selectedActivity.activityIcon ?? '');
      setFormCustomActivityName(selectedActivity.customActivityName ?? '');
      setFormDurationHours(selectedActivity.durationHours != null ? String(selectedActivity.durationHours) : '');
      setFormNotes(selectedActivity.notes ?? '');
      return;
    }

    setFormDate(firstDayOfMonth(selectedMonth));
    setFormType('window_display');
    setFormIcon('');
    setFormCustomActivityName('');
    setFormDurationHours('');
    setFormNotes('');
  }, [open, selectedStoreId, selectedMonth, selectedActivity]);

  const storeMetaById = useMemo(() => {
    const employees = directoryEmployees.filter((employee) => employee.status === 'active');
    const employeeById = new Map<number, (typeof employees)[number]>();
    for (const employee of employees) {
      employeeById.set(employee.id, employee);
    }

    const meta = new Map<number, StoreMeta>();

    for (const store of allStores) {
      const companyEmployees = employees.filter((employee) => employee.companyId === store.companyId);
      const companyHr = companyEmployees.find((employee) => employee.role === 'hr') ?? null;
      const companyAreaManager = companyEmployees.find((employee) => employee.role === 'area_manager') ?? null;

      const storeManagers = companyEmployees.filter((employee) => employee.role === 'store_manager' && employee.storeId === store.id);
      const areaManagerFromStoreManager = storeManagers
        .map((manager) => manager.supervisorId)
        .filter((id): id is number => Boolean(id))
        .map((id) => employeeById.get(id) ?? null)
        .find((employee) => employee?.role === 'area_manager') ?? null;

      const employeeCount = store.employeeCount ?? employees.filter((employee) => employee.storeId === store.id).length;

      meta.set(store.id, {
        hrName: companyHr ? humanName(companyHr.name, companyHr.surname) : null,
        hrAvatarFilename: companyHr?.avatarFilename ?? null,
        areaManagerName: areaManagerFromStoreManager
          ? humanName(areaManagerFromStoreManager.name, areaManagerFromStoreManager.surname)
          : companyAreaManager
            ? humanName(companyAreaManager.name, companyAreaManager.surname)
            : null,
        areaManagerAvatarFilename: areaManagerFromStoreManager?.avatarFilename
          ?? companyAreaManager?.avatarFilename
          ?? null,
        employeeCount,
      });
    }

    return meta;
  }, [directoryEmployees, allStores]);

  const isBusy = busy || saving;
  const monthMinDate = firstDayOfMonth(selectedMonth);
  const monthMaxDate = lastDayOfMonth(selectedMonth);
  const monthLabel = new Date(`${selectedMonth}-02T12:00:00`).toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  const activityTypeOptions = useMemo<SelectOption[]>(() => {
    const rows: SelectOption[] = [];
    for (const group of STORE_ACTIVITY_GROUPS) {
      const groupLabel = t(group.labelKey, group.labelFallback);
      for (const type of group.types) {
        const definition = STORE_ACTIVITY_DEFINITIONS[type];
        const activityLabel = t(definition.labelKey, definition.labelFallback);
        rows.push({
          value: type,
          label: `${groupLabel} ${activityLabel} ${definition.defaultIcon}`,
          render: (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{definition.defaultIcon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {activityLabel}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.2, whiteSpace: 'nowrap', flexShrink: 0 }}>
                • {groupLabel}
              </span>
            </span>
          ),
        });
      }
    }
    return rows;
  }, [t]);

  const activityIconOptions = useMemo<SelectOption[]>(() => (
    ACTIVITY_ICON_OPTIONS.map((option) => {
      const label = option.label.trim();
      const firstSpace = label.indexOf(' ');
      const iconPart = firstSpace > 0 ? label.slice(0, firstSpace) : label;
      const textPart = firstSpace > 0 ? label.slice(firstSpace + 1) : label;
      return {
        value: option.value,
        label,
        render: (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{iconPart}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{textPart}</span>
          </span>
        ),
      };
    })
  ), []);

  async function handleSave(): Promise<void> {
    if (!selectedStoreId) {
      setLocalError(t('shifts.windowDisplayStoreRequired', 'Select a store first.'));
      return;
    }

    if (!formDate) {
      setLocalError(t('shifts.windowDisplayDateRequired', 'Select a date first.'));
      return;
    }

    if (formDate < monthMinDate || formDate > monthMaxDate) {
      setLocalError(t('shifts.windowDisplayDateOutOfMonth', 'Date must stay in the selected month.'));
      return;
    }

    const normalizedCustomActivityName = formCustomActivityName.trim();
    if (isCustomActivityType(formType) && !normalizedCustomActivityName) {
      setLocalError(t('shifts.customActivityRequired', 'Add a custom activity label.'));
      return;
    }

    const durationHours = normalizeNumberInput(formDurationHours);
    if (formDurationHours.trim().length > 0 && durationHours == null) {
      setLocalError(t('shifts.windowDisplayDurationInvalid', 'Duration must be a positive number.'));
      return;
    }

    setLocalError(null);
    setBusy(true);
    try {
      const companyId = selectedStore?.companyId ?? selectedActivity?.companyId ?? selectedCompanyId ?? null;
      await onSave({
        id: selectedActivity?.id,
        storeId: selectedStoreId,
        date: formDate,
        activityType: formType,
        activityIcon: formIcon.trim() || null,
        customActivityName: isCustomActivityType(formType) ? normalizedCustomActivityName : null,
        durationHours,
        notes: formNotes.trim() || null,
        companyId,
      });
    } catch {
      setLocalError(t('errors.DEFAULT', 'An unexpected error occurred.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!selectedActivity) return;
    setLocalError(null);
    setBusy(true);
    try {
      await onDelete(selectedActivity.id, selectedActivity.companyId);
      setFormDate(firstDayOfMonth(selectedMonth));
      setFormType('window_display');
      setFormIcon('');
      setFormCustomActivityName('');
      setFormDurationHours('');
      setFormNotes('');
    } catch {
      setLocalError(t('errors.DEFAULT', 'An unexpected error occurred.'));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        background: 'rgba(13,33,55,0.52)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(1140px, 100%)',
          maxHeight: '92vh',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: '0 28px 66px rgba(0,0,0,0.24)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          background: 'var(--primary)',
          color: '#fff',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1.2, opacity: 0.68, textTransform: 'uppercase' }}>
              {viewMode === 'month'
                ? t('shifts.monthView', 'Month')
                : viewMode === 'week'
                  ? t('shifts.weekView', 'Week')
                  : t('shifts.dayView', 'Day')}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', marginTop: 2 }}>
              {t('shifts.storeActivityMapping', 'Store activity mapping')} - {monthLabel}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={selectedCompanyId ?? ''}
              onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : null)}
              style={{
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                fontSize: 12,
                padding: '6px 8px',
                fontWeight: 700,
                minWidth: 190,
              }}
            >
              <option value="" style={{ color: '#111827' }}>{t('shifts.allCompanies', 'All companies')}</option>
              {companyOptions.map((company) => (
                <option key={company.id} value={company.id} style={{ color: '#111827' }}>
                  {company.name}
                </option>
              ))}
            </select>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                fontSize: 12,
                padding: '6px 8px',
                fontWeight: 700,
              }}
            />
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: '#fff',
                borderRadius: 8,
                padding: '6px 10px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              {t('common.close', 'Close')}
            </button>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '360px minmax(0, 1fr)',
          gap: 0,
          minHeight: 470,
          height: 'calc(92vh - 74px)',
          maxHeight: 'calc(92vh - 74px)',
          overflow: 'hidden',
        }}>
          <div style={{
            borderRight: '1px solid var(--border)',
            background: 'var(--background)',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 12,
            minHeight: 0,
          }}>
            <div style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              marginBottom: 8,
            }}>
              {t('stores.title', 'Stores')} {directoryLoading ? `(${t('common.loading', 'Loading...')})` : ''}
            </div>

            {!availableStores.length ? (
              <div style={{
                borderRadius: 8,
                border: '1px dashed var(--border)',
                padding: 12,
                fontSize: 12,
                color: 'var(--text-muted)',
              }}>
                {t('shifts.noStoresAvailable', 'No stores available for this view.')}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {availableStores.map((store) => {
                  const activity = monthActivitiesByStore.get(store.id) ?? null;
                  const selected = selectedStoreId === store.id;
                  const meta = storeMetaById.get(store.id);
                  const storeLogo = getStoreLogoUrl(store.logoFilename);
                  const companyLogo = getCompanyLogoUrl(store.companyLogoFilename);
                  const avatar = storeLogo ?? companyLogo;
                  const hrAvatar = getAvatarUrl(meta?.hrAvatarFilename ?? null);
                  const areaManagerAvatar = getAvatarUrl(meta?.areaManagerAvatarFilename ?? null);
                  const hrInitials = initialsFromName(meta?.hrName ?? null);
                  const areaManagerInitials = initialsFromName(meta?.areaManagerName ?? null);
                  const activityIcon = activity ? getActivityIcon(activity.activityType, activity.activityIcon) : null;

                  return (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => setSelectedStoreId(store.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        borderRadius: 10,
                        border: selected ? '1px solid var(--primary)' : '1px solid var(--border)',
                        background: selected ? 'rgba(30,74,122,0.08)' : 'var(--surface)',
                        padding: 10,
                        cursor: 'pointer',
                        display: 'grid',
                        gap: 7,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          overflow: 'hidden',
                          border: '1px solid var(--border)',
                          background: 'rgba(13,33,55,0.14)',
                          color: '#0D2137',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: 10,
                          fontWeight: 800,
                        }}>
                          {avatar ? (
                            <img src={avatar} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : store.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ display: 'block', fontWeight: 800, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {store.name}
                          </span>
                          <span style={{ display: 'block', marginTop: 1, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {store.companyName}
                          </span>
                        </span>
                        <span style={{
                          borderRadius: 999,
                          border: '1px solid rgba(148,163,184,0.34)',
                          background: 'rgba(248,250,252,0.9)',
                          color: '#334155',
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 8px',
                          lineHeight: 1.2,
                        }}>
                          {(meta?.employeeCount ?? store.employeeCount ?? 0)} {t('shifts.monthlyEmployees', 'Employees')}
                        </span>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: 6,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <span style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            border: '1px solid var(--border)',
                            background: 'linear-gradient(135deg,var(--primary),var(--accent))',
                            color: '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 9,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}>
                            {hrAvatar ? (
                              <img src={hrAvatar} alt={meta?.hrName ?? t('roles.hr', 'HR')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : hrInitials}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>{t('roles.hr', 'HR')}</div>
                            <div style={{ marginTop: 1, fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {meta?.hrName ?? t('common.notAvailable', 'N/A')}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <span style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            border: '1px solid var(--border)',
                            background: 'linear-gradient(135deg,var(--primary),var(--accent))',
                            color: '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 9,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}>
                            {areaManagerAvatar ? (
                              <img src={areaManagerAvatar} alt={meta?.areaManagerName ?? t('roles.area_manager', 'Area manager')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : areaManagerInitials}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>{t('roles.area_manager', 'Area manager')}</div>
                            <div style={{ marginTop: 1, fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {meta?.areaManagerName ?? t('common.notAvailable', 'N/A')}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        {activity ? (
                          <span style={{
                            borderRadius: 999,
                            border: '1px solid rgba(217,119,6,0.34)',
                            borderLeft: '3px solid #d97706',
                            background: 'rgba(254,243,199,0.85)',
                            color: '#92400e',
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 8px',
                            lineHeight: 1.2,
                          }}>
                            {activityIcon} {getActivityTypeLabel(t, activity.activityType, activity.customActivityName)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>
                            {t('shifts.noActivitySet', 'No activity set')}
                          </span>
                        )}
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>
                          {activity?.date ?? selectedMonth}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ padding: 14, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!selectedStoreId ? (
              <div style={{
                borderRadius: 10,
                border: '1px dashed var(--border)',
                padding: 14,
                color: 'var(--text-muted)',
                fontSize: 12,
              }}>
                {t('shifts.selectStoreToManageActivity', 'Select a store to view activity details.')}
              </div>
            ) : (
              <>
                <div style={{
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  padding: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{selectedStore?.name}</div>
                    <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{selectedStore?.companyName}</div>
                  </div>
                  <div style={{
                    borderRadius: 999,
                    border: selectedActivity ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(148,163,184,0.25)',
                    background: selectedActivity ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.1)',
                    color: selectedActivity ? '#166534' : '#475569',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '4px 10px',
                    lineHeight: 1.2,
                  }}>
                    {selectedActivity
                      ? t('shifts.activityConfigured', 'Activity configured')
                      : t('shifts.activityNotConfigured', 'No activity configured')}
                  </div>
                </div>

                {localError && (
                  <div style={{
                    borderRadius: 8,
                    border: '1px solid var(--danger-border)',
                    background: 'var(--danger-bg)',
                    color: 'var(--danger)',
                    fontSize: 12,
                    padding: '8px 10px',
                    fontWeight: 700,
                  }}>
                    {localError}
                  </div>
                )}

                <div style={{
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  padding: 14,
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
                      {t('shifts.activityTypeField', 'Activity type')}
                    </label>
                    <CustomSelect
                      value={formType}
                      onChange={(value) => {
                        const nextType = (value as StoreActivityType | null) ?? 'window_display';
                        setFormType(nextType);
                        if (!isCustomActivityType(nextType)) {
                          setFormCustomActivityName('');
                        }
                      }}
                      options={activityTypeOptions}
                      placeholder={t('shifts.activityTypeField', 'Activity type')}
                      disabled={!canManage || isBusy}
                      searchable
                      isClearable={false}
                      searchPlaceholder={t('common.search', 'Search...')}
                      noOptionsMessage={t('common.noData', 'No options found')}
                      menuMaxHeight={228}
                    />
                  </div>

                  <div style={{ display: 'grid', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
                      {t('shifts.activityIcon', 'Icon')}
                    </label>
                    <CustomSelect
                      value={formIcon || null}
                      onChange={(value) => setFormIcon(value ?? '')}
                      options={activityIconOptions}
                      placeholder={t('shifts.activityIconAuto', { icon: getActivityDefaultIcon(formType), defaultValue: `Auto (${getActivityDefaultIcon(formType)})` })}
                      disabled={!canManage || isBusy}
                      searchable
                      isClearable
                      searchPlaceholder={t('common.search', 'Search...')}
                      noOptionsMessage={t('common.noData', 'No options found')}
                      menuMaxHeight={228}
                    />
                  </div>

                  {isCustomActivityType(formType) && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <Input
                        label={t('shifts.customActivityLabel', 'Custom activity label')}
                        value={formCustomActivityName}
                        disabled={!canManage || isBusy}
                        onChange={(e) => setFormCustomActivityName(e.target.value)}
                        placeholder={t('shifts.customActivityPlaceholder', 'Example: VIP private fitting night')}
                        maxLength={120}
                      />
                    </div>
                  )}

                  <DatePicker
                    label={t('common.date', 'Date')}
                    value={formDate}
                    onChange={setFormDate}
                    disabled={!canManage || isBusy}
                  />

                  <Input
                    label={t('shifts.activityDurationHours', 'Duration (hours)')}
                    type="number"
                    min={0.25}
                    step={0.25}
                    value={formDurationHours}
                    disabled={!canManage || isBusy}
                    onChange={(e) => setFormDurationHours(e.target.value)}
                    placeholder={t('shifts.activityDurationPlaceholder', 'Optional')}
                  />

                  <Input
                    label={t('shifts.activityMonth', 'Month')}
                    value={selectedMonth}
                    readOnly
                    style={{ background: 'var(--background)' }}
                  />

                  <div style={{ display: 'grid', gap: 4, gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
                      {t('common.notes', 'Notes')}
                    </label>
                    <textarea
                      value={formNotes}
                      disabled={!canManage || isBusy}
                      onChange={(e) => setFormNotes(e.target.value)}
                      rows={4}
                      className="field-input"
                      style={{ resize: 'vertical', minHeight: 92 }}
                      placeholder={t('shifts.activityNotesPlaceholder', 'Optional notes for this activity')}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {canManage
                      ? t('shifts.activityMappingHint', 'One activity can be stored for each store per month.')
                      : t('shifts.activityReadOnlyHint', 'Read-only mode: you can view activities but cannot edit.')}
                    <span style={{ display: 'block', marginTop: 2 }}>
                      {t('shifts.activityMonthLimitHint', 'Allowed date range')}: {monthMinDate} - {monthMaxDate}
                    </span>
                  </div>

                  {canManage && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {selectedActivity && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={isBusy}
                          onClick={handleDelete}
                        >
                          {isBusy ? t('common.loading', 'Loading...') : t('common.remove', 'Remove')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={isBusy || !selectedStoreId}
                        onClick={handleSave}
                      >
                        {isBusy ? t('common.loading', 'Loading...') : t('common.save', 'Save')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
