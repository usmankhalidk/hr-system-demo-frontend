import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { listAttendanceEvents, AttendanceEvent, EventType, AttendanceListParams } from '../../api/attendance';
import { getEmployees } from '../../api/employees';
import { getStores } from '../../api/stores';
import client, { getAvatarUrl } from '../../api/client';
import { formatLocalDate } from '../../utils/date';
import { DatePicker } from '../../components/ui/DatePicker';
import { TimePicker } from '../../components/ui/TimePicker';
import { WeekPicker } from '../../components/ui/WeekPicker';
import { useBreakpoint } from '../../hooks/useBreakpoint';

// Convert ISO week 'YYYY-WNN' → { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } (Mon–Sun)
function isoWeekToDateRange(isoWeek: string): { from: string; to: string } | null {
  const m = isoWeek.match(/^(\d{4})-W(\d{1,2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (jan4Day - 1) + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${dd}`;
  };
  return { from: fmt(monday), to: fmt(sunday) };
}

const EVENT_META: Record<string, { color: string; bg: string; dot: string; icon: string }> = {
  checkin:     { color: '#16a34a', bg: 'rgba(22,163,74,0.10)',   dot: '#22c55e', icon: '→' },
  checkout:    { color: '#dc2626', bg: 'rgba(220,38,38,0.10)',   dot: '#ef4444', icon: '←' },
  break_start: { color: '#b45309', bg: 'rgba(180,83,9,0.10)',    dot: '#f59e0b', icon: '⏸' },
  break_end:   { color: '#1d4ed8', bg: 'rgba(29,78,216,0.10)',   dot: '#3b82f6', icon: '▶' },
};

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  qr:     { label: 'QR',   color: '#7c3aed' },
  manual: { label: 'MAN',  color: '#0369a1' },
  sync:   { label: 'SYNC', color: '#065f46' },
};

const EVENT_TYPE_LABEL_KEYS: Record<string, string> = {
  checkin:     'attendance.checkin',
  checkout:    'attendance.checkout',
  break_start: 'attendance.breakStart',
  break_end:   'attendance.breakEnd',
};

export default function AttendanceLogsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { isMobile, isTablet } = useBreakpoint();

  const canEdit   = user?.role === 'admin' || user?.role === 'hr';
  const canDelete = user?.role === 'admin';

  const [events, setEvents]       = useState<AttendanceEvent[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // ── Edit modal state ───────────────────────────────────────────────────────
  const [editingEvent, setEditingEvent]         = useState<AttendanceEvent | null>(null);
  const [editType, setEditType]                 = useState('');
  const [editDate, setEditDate]                 = useState('');   // YYYY-MM-DD
  const [editTimeOnly, setEditTimeOnly]         = useState('');   // HH:mm
  const [editNotes, setEditNotes]               = useState('');
  const [editSaving, setEditSaving]             = useState(false);
  const [editError, setEditError]               = useState<string | null>(null);

  // ── Delete confirmation state ──────────────────────────────────────────────
  const [deletingEvent, setDeletingEvent]       = useState<AttendanceEvent | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);

  // ── Create manual entry state ──────────────────────────────────────────────
  const [createOpen, setCreateOpen]         = useState(false);
  const [createUserId, setCreateUserId]     = useState('');
  const [createStoreId, setCreateStoreId]   = useState('');
  const [createType, setCreateType]         = useState('checkin');
  const [createDate, setCreateDate]         = useState('');
  const [createTimeOnly, setCreateTimeOnly] = useState('');
  const [createNotes, setCreateNotes]       = useState('');
  const [createSaving, setCreateSaving]     = useState(false);
  const [createError, setCreateError]       = useState<string | null>(null);
  const [createSuccess, setCreateSuccess]   = useState(false);
  const [empList, setEmpList]               = useState<Array<{
    id: number;
    name: string;
    surname: string;
    role?: string;
    storeId?: number | null;
    storeName?: string;
    avatarFilename?: string | null;
  }>>([]);
  const [storeList, setStoreList]           = useState<Array<{ id: number; name: string; companyName?: string }>>([]);
  const [createEmployeeOpen, setCreateEmployeeOpen] = useState(false);
  const [createEmployeeSearch, setCreateEmployeeSearch] = useState('');
  const createEmployeePickerRef = useRef<HTMLDivElement | null>(null);

  const selectedCreateEmployee = useMemo(
    () => empList.find((emp) => String(emp.id) === createUserId),
    [empList, createUserId],
  );

  const selectedCreateEmployeeAvatarUrl = getAvatarUrl(selectedCreateEmployee?.avatarFilename);
  const selectedCreateEmployeeInitials = `${selectedCreateEmployee?.name?.[0] ?? ''}${selectedCreateEmployee?.surname?.[0] ?? ''}`.toUpperCase() || 'U';
  const selectedCreateEmployeeFullName = selectedCreateEmployee
    ? `${selectedCreateEmployee.name} ${selectedCreateEmployee.surname}`
    : t('attendance.selectEmployee');

  const filteredCreateEmployees = useMemo(() => {
    const q = createEmployeeSearch.trim().toLowerCase();
    if (!q) return empList;
    return empList.filter((emp) => {
      const full = `${emp.name} ${emp.surname}`.toLowerCase();
      const role = t(`roles.${emp.role ?? 'employee'}`, emp.role ?? 'employee').toLowerCase();
      const store = (emp.storeName ?? '').toLowerCase();
      return full.includes(q) || role.includes(q) || store.includes(q);
    });
  }, [createEmployeeSearch, empList, t]);

  function openCreateModal() {
    setCreateOpen(true);
    setCreateUserId('');
    setCreateStoreId('');
    setCreateType('checkin');
    setCreateDate(formatLocalDate(new Date()));
    setCreateTimeOnly('');
    setCreateNotes('');
    setCreateError(null);
    setCreateSuccess(false);
    setCreateEmployeeOpen(false);
    setCreateEmployeeSearch('');
    // Load dropdowns if not yet loaded
    if (empList.length === 0) {
      getEmployees({ limit: 200, status: 'active' }).then((res) =>
        setEmpList(res.employees.map((e) => ({
          id: e.id,
          name: e.name,
          surname: e.surname,
          role: e.role,
          storeId: e.storeId ?? null,
          storeName: e.storeName,
          avatarFilename: e.avatarFilename ?? null,
        })))
      ).catch(() => {});
    }
    if (storeList.length === 0) {
      getStores().then((stores) =>
        setStoreList(stores.map((s) => ({ id: s.id, name: s.name, companyName: s.companyName })))
      ).catch(() => {});
    }
  }

  useEffect(() => {
    if (!createOpen || !createEmployeeOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!createEmployeePickerRef.current?.contains(event.target as Node)) {
        setCreateEmployeeOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [createOpen, createEmployeeOpen]);

  async function handleCreateSave() {
    if (!createUserId || !createStoreId || !createTimeOnly) {
      setCreateError(t('common.required'));
      return;
    }
    setCreateSaving(true);
    setCreateError(null);
    try {
      await client.post('/attendance', {
        user_id:    parseInt(createUserId, 10),
        store_id:   parseInt(createStoreId, 10),
        event_type: createType,
        event_time: new Date(`${createDate}T${createTimeOnly}`).toISOString(),
        notes:      createNotes || undefined,
      });
      setCreateSuccess(true);
      await fetchEvents();
      setTimeout(() => {
        setCreateOpen(false);
        setCreateSuccess(false);
        setCreateEmployeeOpen(false);
        setCreateEmployeeSearch('');
      }, 1200);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setCreateError(axiosErr?.response?.data?.error ?? t('common.error'));
    } finally {
      setCreateSaving(false);
    }
  }

  function openEditModal(ev: AttendanceEvent) {
    setEditingEvent(ev);
    setEditType(ev.eventType);
    const d = new Date(ev.eventTime);
    const pad = (n: number) => String(n).padStart(2, '0');
    setEditDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setEditTimeOnly(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setEditNotes(ev.notes ?? '');
    setEditError(null);
  }

  function closeEditModal() {
    setEditingEvent(null);
    setEditError(null);
  }

  async function handleEditSave() {
    if (!editingEvent) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await client.put(`/attendance/${editingEvent.id}`, {
        event_type: editType,
        event_time: new Date(`${editDate}T${editTimeOnly}`).toISOString(),
        notes: editNotes,
      });
      closeEditModal();
      await fetchEvents();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setEditError(axiosErr?.response?.data?.error ?? t('common.error'));
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingEvent) return;
    setDeleteConfirming(true);
    try {
      await client.delete(`/attendance/${deletingEvent.id}`);
      setDeletingEvent(null);
      await fetchEvents();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr?.response?.data?.error ?? t('common.error'));
      setDeletingEvent(null);
    } finally {
      setDeleteConfirming(false);
    }
  }

  const today       = formatLocalDate(new Date());
  const weekAgoDate = new Date();
  weekAgoDate.setDate(weekAgoDate.getDate() - 7);
  const weekAgo = formatLocalDate(weekAgoDate);

  const [dateFrom, setDateFrom]   = useState(weekAgo);
  const [dateTo, setDateTo]       = useState(today);
  const [eventType, setEventType] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStoreId, setFilterStoreId] = useState<string>('');
  const [filterUserId, setFilterUserId] = useState<string>('');
  const [filterEmployees, setFilterEmployees] = useState<Array<{ id: number; name: string; surname: string; storeId: number | null }>>([]);
  const [filterStores, setFilterStores] = useState<Array<{ id: number; name: string; companyName?: string }>>([]);

  const loadFilterEmployees = useCallback(async (storeId?: number) => {
    try {
      const res = await getEmployees({ limit: 500, status: 'active', ...(storeId ? { storeId } : {}) });
      setFilterEmployees(
        res.employees.map((e) => ({
          id: e.id,
          name: e.name,
          surname: e.surname,
          storeId: e.storeId ?? null,
        })),
      );
    } catch {
      setFilterEmployees([]);
    }
  }, []);

  useEffect(() => {
    getStores()
      .then((stores) => setFilterStores(stores.map((s) => ({ id: s.id, name: s.name, companyName: s.companyName }))))
      .catch(() => setFilterStores([]));
    void loadFilterEmployees();
  }, [loadFilterEmployees]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: AttendanceListParams = { dateFrom, dateTo };
      if (eventType) params.eventType = eventType as EventType;
      if (filterStoreId) params.storeId = parseInt(filterStoreId, 10);
      if (filterUserId) params.userId = parseInt(filterUserId, 10);
      if (filterSearch.trim()) params.search = filterSearch.trim();
      const res = await listAttendanceEvents(params);
      setEvents(res.events);
      setTotal(res.total);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr?.response?.data?.error ?? t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, eventType, filterStoreId, filterUserId, filterSearch, t]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  async function handleExport(format: 'csv' | 'xlsx') {
    try {
      const params = new URLSearchParams();
      if (dateFrom)  params.append('date_from', dateFrom);
      if (dateTo)    params.append('date_to', dateTo);
      if (eventType) params.append('event_type', eventType);
      if (filterStoreId) params.append('store_id', filterStoreId);
      if (filterUserId) params.append('user_id', filterUserId);
      if (filterSearch.trim()) params.append('search', filterSearch.trim());
      params.append('format', format);
      const res = await client.get(`/attendance?${params.toString()}`, { responseType: 'blob' });
      const ext = format === 'xlsx' ? 'xlsx' : 'csv';
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url; a.download = `presenze-${dateFrom}-${dateTo}.${ext}`; a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr?.response?.data?.error ?? t('attendance.exportError'));
    }
  }

  function formatDateTime(iso: string): { date: string; time: string } {
    const d = new Date(iso);
    const locale = i18n.language === 'en' ? 'en-GB' : 'it-IT';
    return {
      date: d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }),
      time: d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    };
  }

  const typeCounts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.eventType] = (acc[e.eventType] ?? 0) + 1;
    return acc;
  }, {});

  const eventTypeOptions: { value: string; labelKey: string }[] = [
    { value: '', labelKey: 'common.all' },
    { value: 'checkin',     labelKey: 'attendance.checkin' },
    { value: 'checkout',    labelKey: 'attendance.checkout' },
    { value: 'break_start', labelKey: 'attendance.breakStart' },
    { value: 'break_end',   labelKey: 'attendance.breakEnd' },
  ];

  const heroPad = isMobile ? '20px 16px 0' : isTablet ? '24px 20px 0' : '28px 32px 0';
  const contentPad = isMobile ? '12px 16px' : isTablet ? '16px 20px' : '20px 32px';
  const filterPad = isMobile ? '10px 16px' : '12px 32px';

  return (
    <div style={{ padding: 0, minHeight: '100%' }}>
      <style>{`
        @keyframes rowIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .att-row { animation: rowIn 0.22s ease both; }
        .att-stat-card:hover {
          background: rgba(201,151,58,0.10) !important;
          transform: translateY(-1px);
        }
        .att-type-btn:hover {
          border-color: var(--accent) !important;
          color: var(--accent) !important;
        }
        .att-card:hover { background: var(--surface-warm) !important; }
      `}</style>

      {/* ── Hero header ───────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--primary)', padding: heroPad }}>

        {/* Title row */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'flex-start',
          justifyContent: 'space-between',
          gap: isMobile ? 14 : 0,
          marginBottom: 24,
        }}>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '2.5px',
              color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 8,
            }}>
              {t('attendance.moduleLabel')}
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: isMobile ? '1.4rem' : '1.75rem',
              fontWeight: 800, color: '#fff', margin: 0, letterSpacing: -0.5, lineHeight: 1.2,
            }}>
              {t('attendance.logTitle')}
            </h1>
            {!loading && (
              <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{total}</span>
                {' '}{t('attendance.title').toLowerCase()} {t('attendance.found')}
                {total > events.length && (
                  <span> · {t('attendance.showing')} {events.length}</span>
                )}
              </div>
            )}
          </div>

          {/* Header right: New Entry + Export buttons */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
            {/* New manual entry — admin/hr only */}
            {canEdit && (
              <button
                onClick={openCreateModal}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: isMobile ? '7px 12px' : '8px 14px',
                  borderRadius: 8,
                  background: 'rgba(13,33,55,0.75)', border: '1px solid rgba(255,255,255,0.18)',
                  color: '#fff', fontWeight: 700,
                  fontSize: isMobile ? 11 : 12,
                  cursor: 'pointer', transition: 'background 0.15s', letterSpacing: 0.3,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(13,33,55,0.95)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(13,33,55,0.75)'; }}
              >
                <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
                {t('attendance.newEntry')}
              </button>
            )}
            {/* Export buttons */}
            {(['csv', 'xlsx'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleExport(fmt)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: isMobile ? '7px 12px' : '8px 14px',
                  borderRadius: 8,
                  background: 'rgba(201,151,58,0.18)', border: '1px solid rgba(201,151,58,0.35)',
                  color: 'var(--accent)', fontWeight: 700,
                  fontSize: isMobile ? 11 : 12,
                  cursor: 'pointer', transition: 'background 0.15s', letterSpacing: 0.3,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(201,151,58,0.28)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(201,151,58,0.18)'; }}
              >
                <span style={{ fontSize: 13 }}>↓</span>
                {fmt === 'csv' ? t('attendance.exportCsv') : t('attendance.exportExcel')}
              </button>
            ))}
          </div>
        </div>

        {/* Stat tiles — 2 cols on mobile, 4 on tablet+ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: isMobile ? 8 : 10,
        }}>
          {(['checkin', 'checkout', 'break_start', 'break_end'] as const).map((type) => {
            const meta   = EVENT_META[type];
            const count  = typeCounts[type] ?? 0;
            const active = eventType === type;
            return (
              <button
                key={type}
                className="att-stat-card"
                onClick={() => setEventType(active ? '' : type)}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: isMobile ? 8 : 12,
                  padding: isMobile ? '10px 12px' : '14px 16px',
                  background: active ? 'rgba(201,151,58,0.12)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${active ? 'rgba(201,151,58,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  borderBottom: `3px solid ${active ? 'var(--accent)' : meta.dot}`,
                  borderRadius: '8px 8px 0 0',
                  cursor: 'pointer', transition: 'all 0.18s',
                  textAlign: 'left', outline: 'none',
                }}
              >
                <div style={{
                  width: isMobile ? 30 : 36, height: isMobile ? 30 : 36,
                  borderRadius: 8,
                  background: `${meta.dot}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isMobile ? 14 : 16, flexShrink: 0,
                  border: `1.5px solid ${meta.dot}44`,
                }}>
                  {meta.icon}
                </div>
                <div>
                  <div style={{
                    fontSize: isMobile ? 17 : 20, fontWeight: 800,
                    color: loading ? 'rgba(255,255,255,0.25)' : (count > 0 ? meta.dot : 'rgba(255,255,255,0.3)'),
                    fontFamily: 'var(--font-display)', lineHeight: 1,
                  }}>
                    {loading ? '—' : count}
                  </div>
                  <div style={{
                    fontSize: isMobile ? 9 : 10,
                    color: 'rgba(255,255,255,0.45)',
                    textTransform: 'uppercase', letterSpacing: 1, marginTop: 2,
                  }}>
                    {t(EVENT_TYPE_LABEL_KEYS[type])}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div style={{
        padding: filterPad,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        gap: isMobile ? 10 : 12,
        flexWrap: isMobile ? undefined : 'wrap',
        position: 'sticky', top: 0, zIndex: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>

        {/* Tab bar + date row: side by side on mobile */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          width: isMobile ? '100%' : undefined,
          flexWrap: isMobile ? 'wrap' : undefined,
        }}>
          {/* Loading indicator (inline on mobile) */}
          {loading && isMobile && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--accent)', display: 'inline-block',
                animation: 'spin 0.8s linear infinite',
              }} />
              {t('common.loading')}
            </div>
          )}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: isMobile ? '100%' : undefined,
          flexWrap: isMobile ? 'wrap' : undefined,
        }}>
          {!isMobile && <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />}
          <input
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder={t('employees.searchPlaceholder', { defaultValue: 'Search by name, surname or ID...' })}
            style={{
              minWidth: isMobile ? 180 : 240,
              width: isMobile ? '100%' : 260,
              height: 34,
              borderRadius: 8,
              border: '1px solid var(--border)',
              padding: '0 10px',
              background: 'var(--background)',
              color: 'var(--text)',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <select
            value={filterStoreId}
            onChange={(e) => {
              const nextStoreId = e.target.value;
              setFilterStoreId(nextStoreId);
              setFilterUserId('');
              void loadFilterEmployees(nextStoreId ? parseInt(nextStoreId, 10) : undefined);
            }}
            style={{
              minWidth: isMobile ? 140 : 180,
              height: 34,
              borderRadius: 8,
              border: '1px solid var(--border)',
              padding: '0 10px',
              background: 'var(--background)',
              color: 'var(--text)',
              fontSize: 12,
              outline: 'none',
            }}
          >
            <option value="">{t('common.all')} {t('common.store').toLowerCase()}</option>
            {filterStores.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.companyName ? `${s.name} (${s.companyName})` : s.name}
              </option>
            ))}
          </select>
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            style={{
              minWidth: isMobile ? 160 : 220,
              height: 34,
              borderRadius: 8,
              border: '1px solid var(--border)',
              padding: '0 10px',
              background: 'var(--background)',
              color: 'var(--text)',
              fontSize: 12,
              outline: 'none',
            }}
          >
            <option value="">{t('common.all')} {t('employees.colName').toLowerCase()}</option>
            {filterEmployees.map((e) => (
              <option key={e.id} value={String(e.id)}>
                {e.name} {e.surname}
              </option>
            ))}
          </select>
        </div>

        {/* Date range — horizontally scrollable row on mobile */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8,
          overflowX: isMobile ? 'auto' : undefined,
          width: isMobile ? '100%' : undefined,
          flexShrink: 0,
          paddingBottom: isMobile ? 2 : 0, // breathing room for scrollbar
        }}>
          {!isMobile && <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />}
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '1.2px', flexShrink: 0,
          }}>
            {t('attendance.dateFrom')}
          </span>
          <div style={{ width: isMobile ? 140 : 152, flexShrink: 0 }}>
            <DatePicker value={dateFrom} onChange={setDateFrom} />
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '1.2px', flexShrink: 0,
          }}>
            {t('attendance.dateTo')}
          </span>
          <div style={{ width: isMobile ? 140 : 152, flexShrink: 0 }}>
            <DatePicker value={dateTo} onChange={setDateTo} />
          </div>
          {!isMobile && <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />}
          {/* Week picker inline with dates */}
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '1.2px', flexShrink: 0,
          }}>
            {t('shifts.week')}
          </span>
          <div style={{ width: isMobile ? 170 : 200, flexShrink: 0 }}>
            <WeekPicker
              value={''}
              onChange={(w) => {
                const range = isoWeekToDateRange(w);
                if (range) { setDateFrom(range.from); setDateTo(range.to); }
              }}
              placeholder={t('shifts.weekPickerHint')}
            />
          </div>
        </div>

        {/* Event type pills */}
        <div style={{
          display: 'flex', gap: 6, alignItems: 'center',
          flexWrap: isMobile ? undefined : 'wrap',
          overflowX: isMobile ? 'auto' : undefined,
          width: isMobile ? '100%' : undefined,
          paddingBottom: isMobile ? 2 : 0,
        }}>
          {!isMobile && <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />}
          {eventTypeOptions.map(({ value, labelKey }) => {
            const meta   = value ? EVENT_META[value] : null;
            const active = eventType === value;
            return (
              <button
                key={value}
                className="att-type-btn"
                onClick={() => setEventType(value)}
                style={{
                  padding: '5px 11px', borderRadius: 20, flexShrink: 0,
                  border: `1.5px solid ${active ? (meta?.dot ?? 'var(--accent)') : 'var(--border)'}`,
                  background: active ? (meta ? meta.bg : 'var(--accent-light)') : 'transparent',
                  color: active ? (meta?.color ?? 'var(--accent)') : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.15s', letterSpacing: 0.3,
                  display: 'flex', alignItems: 'center', gap: 5,
                  outline: 'none', whiteSpace: 'nowrap',
                }}
              >
                {meta && <span style={{ fontSize: 11 }}>{meta.icon}</span>}
                {t(labelKey)}
              </button>
            );
          })}
        </div>

        {/* Loading indicator desktop */}
        {loading && !isMobile && (
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--accent)', display: 'inline-block',
              animation: 'spin 0.8s linear infinite',
            }} />
            {t('common.loading')}
          </div>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div style={{ padding: contentPad }}>

          {error && (
            <div style={{
              background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)',
              borderLeft: '4px solid #dc2626', borderRadius: 8,
              padding: '12px 16px', marginBottom: 16,
              color: '#dc2626', fontSize: 13, fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          {/* ── Mobile: card list ─────────────────────────────────────────── */}
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!loading && events.length === 0 ? (
                <div style={{
                  padding: '48px 24px', textAlign: 'center',
                  background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.2 }}>⏱</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {t('common.noData')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dateFrom} → {dateTo}</div>
                </div>
              ) : (
                events.map((ev, idx) => {
                  const meta     = EVENT_META[ev.eventType] ?? EVENT_META.checkin;
                  const labelKey = EVENT_TYPE_LABEL_KEYS[ev.eventType] ?? 'attendance.checkin';
                  const srcBadge = SOURCE_BADGE[ev.source] ?? { label: ev.source.toUpperCase(), color: '#6b7280' };
                  const dt       = formatDateTime(ev.eventTime);
                  return (
                    <div
                      key={ev.id}
                      className="att-card att-row"
                      style={{
                        background: 'var(--surface)',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        borderLeft: `4px solid ${meta.dot}`,
                        overflow: 'hidden',
                        transition: 'background 0.1s',
                        animationDelay: `${Math.min(idx * 18, 300)}ms`,
                      }}
                    >
                      <div style={{ padding: '11px 14px' }}>
                        {/* Row 1: name + source */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                            {ev.userName} {ev.userSurname}
                          </span>
                          <span style={{
                            padding: '2px 7px', borderRadius: 4,
                            fontSize: 9, fontWeight: 800, letterSpacing: '1px',
                            background: `${srcBadge.color}18`, color: srcBadge.color,
                            border: `1px solid ${srcBadge.color}30`,
                            fontFamily: 'monospace',
                          }}>
                            {srcBadge.label}
                          </span>
                        </div>
                        {/* Row 2: event type badge */}
                        <div style={{ marginBottom: 8 }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 10px', borderRadius: 20,
                            fontSize: 11, fontWeight: 800, letterSpacing: '0.5px',
                            background: meta.bg, color: meta.color,
                            textTransform: 'uppercase', border: `1px solid ${meta.dot}33`,
                          }}>
                            <span>{meta.icon}</span>
                            {t(labelKey)}
                          </span>
                        </div>
                        {/* Row 3: store + date + time */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ opacity: 0.5 }}>📍</span> {ev.storeName}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                            {dt.date}
                          </span>
                          <span style={{
                            fontSize: 12, fontWeight: 700, color: 'var(--text)',
                            fontVariantNumeric: 'tabular-nums',
                            background: 'var(--background)', padding: '2px 8px',
                            borderRadius: 5, border: '1px solid var(--border)',
                          }}>
                            {dt.time}
                          </span>
                        </div>
                        {/* Row 4: action buttons (admin/hr only) */}
                        {canEdit && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                            <button
                              onClick={() => openEditModal(ev)}
                              style={{
                                flex: 1, padding: '6px 0', borderRadius: 6,
                                border: '1px solid rgba(13,33,55,0.25)',
                                background: 'rgba(13,33,55,0.06)',
                                color: 'var(--primary)', fontSize: 12, fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {t('common.edit')}
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => setDeletingEvent(ev)}
                                style={{
                                  flex: 1, padding: '6px 0', borderRadius: 6,
                                  border: '1px solid rgba(220,38,38,0.25)',
                                  background: 'rgba(220,38,38,0.06)',
                                  color: '#dc2626', fontSize: 12, fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                {t('common.delete')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              {/* Footer */}
              {!loading && events.length > 0 && (
                <div style={{ padding: '8px 4px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                  {events.length < total
                    ? <>{t('attendance.showing')} <strong>{events.length}</strong> / <strong>{total}</strong></>
                    : <><strong>{total}</strong> {t('attendance.found')}</>
                  }
                </div>
              )}
            </div>
          ) : (
            /* ── Desktop / tablet: table ────────────────────────────────── */
            <div style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}>
              {!loading && events.length === 0 ? (
                <div style={{ padding: '56px 32px', textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.25 }}>⏱</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {t('common.noData')}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{dateFrom} → {dateTo}</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface)' }}>
                        {[
                          t('employees.colName'),
                          t('common.store'),
                          t('attendance.eventType'),
                          t('common.date'),
                          t('attendance.source'),
                          ...(canEdit ? [t('common.actions')] : []),
                        ].map((h, i) => (
                          <th key={`${h}-${i}`} style={{
                            padding: isTablet ? '9px 12px' : '10px 16px',
                            textAlign: 'left',
                            fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                            textTransform: 'uppercase', letterSpacing: '1.5px',
                            borderBottom: '2px solid var(--border)',
                            ...(i === 0 ? { paddingLeft: 20 } : {}),
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((ev, idx) => {
                        const meta     = EVENT_META[ev.eventType] ?? EVENT_META.checkin;
                        const labelKey = EVENT_TYPE_LABEL_KEYS[ev.eventType] ?? 'attendance.checkin';
                        const srcBadge = SOURCE_BADGE[ev.source] ?? { label: ev.source.toUpperCase(), color: '#6b7280' };
                        const dt       = formatDateTime(ev.eventTime);
                        return (
                          <tr
                            key={ev.id}
                            className="att-row"
                            style={{
                              borderBottom: '1px solid var(--border)',
                              animationDelay: `${Math.min(idx * 18, 300)}ms`,
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-warm)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                          >
                            <td style={{ padding: '11px 16px 11px 0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                                <div style={{
                                  width: 4, alignSelf: 'stretch', borderRadius: '0 2px 2px 0',
                                  background: meta.dot, flexShrink: 0, marginRight: 16,
                                }} />
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
                                  {ev.userName} {ev.userSurname}
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                              {ev.storeName}
                            </td>
                            <td style={{ padding: '11px 16px' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '4px 11px', borderRadius: 20,
                                fontSize: 11, fontWeight: 800, letterSpacing: '0.8px',
                                background: meta.bg, color: meta.color,
                                textTransform: 'uppercase', border: `1px solid ${meta.dot}33`,
                              }}>
                                <span>{meta.icon}</span>
                                {t(labelKey)}
                              </span>
                            </td>
                            <td style={{ padding: '11px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                                  {dt.date}
                                </span>
                                <span style={{
                                  fontSize: 13, fontWeight: 700, color: 'var(--text)',
                                  fontVariantNumeric: 'tabular-nums',
                                  background: 'var(--bg)', padding: '2px 8px',
                                  borderRadius: 6, border: '1px solid var(--border)',
                                }}>
                                  {dt.time}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '11px 16px' }}>
                              <span style={{
                                display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                                fontSize: 10, fontWeight: 800, letterSpacing: '1px',
                                background: `${srcBadge.color}18`, color: srcBadge.color,
                                border: `1px solid ${srcBadge.color}30`,
                                fontFamily: 'monospace',
                              }}>
                                {srcBadge.label}
                              </span>
                            </td>
                            {canEdit && (
                              <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    onClick={() => openEditModal(ev)}
                                    title={t('attendance.editEvent')}
                                    style={{
                                      padding: '4px 10px', borderRadius: 6,
                                      border: '1px solid rgba(13,33,55,0.25)',
                                      background: 'rgba(13,33,55,0.06)',
                                      color: 'var(--primary)', fontSize: 11, fontWeight: 700,
                                      cursor: 'pointer', transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(13,33,55,0.14)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(13,33,55,0.06)'; }}
                                  >
                                    {t('common.edit')}
                                  </button>
                                  {canDelete && (
                                    <button
                                      onClick={() => setDeletingEvent(ev)}
                                      title={t('attendance.deleteEvent')}
                                      style={{
                                        padding: '4px 10px', borderRadius: 6,
                                        border: '1px solid rgba(220,38,38,0.25)',
                                        background: 'rgba(220,38,38,0.06)',
                                        color: '#dc2626', fontSize: 11, fontWeight: 700,
                                        cursor: 'pointer', transition: 'all 0.15s',
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220,38,38,0.14)'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(220,38,38,0.06)'; }}
                                    >
                                      {t('common.delete')}
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table footer */}
              {!loading && events.length > 0 && (
                <div style={{
                  padding: '10px 20px',
                  borderTop: '1px solid var(--border)',
                  background: 'var(--bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {events.length < total
                      ? <>{t('attendance.showing')} <strong>{events.length}</strong> / <strong>{total}</strong></>
                      : <><strong>{total}</strong> {t('attendance.found')}</>
                    }
                  </div>
                  {total > 500 && (
                    <div style={{
                      fontSize: 11, color: '#b45309',
                      background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                      padding: '3px 10px', borderRadius: 4, fontWeight: 600,
                    }}>
                      {t('attendance.maxResults')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      {/* ── Edit Event Modal ──────────────────────────────────────────────── */}
      {editingEvent && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeEditModal(); }}
        >
          <div style={{
            background: 'var(--surface)', borderRadius: 16,
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
            width: '100%', maxWidth: 440,
            border: '1px solid var(--border)',
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  {t('attendance.moduleLabel')}
                </div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  {t('attendance.editEvent')}
                </h2>
              </div>
              <button
                onClick={closeEditModal}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--background)',
                  color: 'var(--text-secondary)', fontSize: 18,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>
              {editError && (
                <div style={{
                  background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)',
                  borderLeft: '4px solid #dc2626', borderRadius: 8,
                  padding: '10px 14px', marginBottom: 16,
                  color: '#dc2626', fontSize: 13, fontWeight: 500,
                }}>
                  {editError}
                </div>
              )}

              {/* Employee info (read-only) */}
              <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--background)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
                  {t('employees.colName')}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                  {editingEvent.userName} {editingEvent.userSurname}
                </div>
                {editingEvent.storeName && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {editingEvent.storeName}
                  </div>
                )}
              </div>

              {/* Event type select */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  {t('attendance.eventType')}
                </label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    border: '1.5px solid var(--border)', background: 'var(--background)',
                    color: 'var(--text)', fontSize: 14, outline: 'none',
                    appearance: 'none',
                  }}
                >
                  <option value="checkin">{t('attendance.checkin')}</option>
                  <option value="checkout">{t('attendance.checkout')}</option>
                  <option value="break_start">{t('attendance.breakStart')}</option>
                  <option value="break_end">{t('attendance.breakEnd')}</option>
                </select>
              </div>

              {/* Event date + time */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <DatePicker
                    label={t('common.date')}
                    value={editDate}
                    onChange={setEditDate}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TimePicker
                    label={t('common.time')}
                    value={editTimeOnly}
                    onChange={setEditTimeOnly}
                  />
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  {t('common.notes')}
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  placeholder="—"
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    border: '1.5px solid var(--border)', background: 'var(--background)',
                    color: 'var(--text)', fontSize: 14, outline: 'none', resize: 'vertical',
                    boxSizing: 'border-box', fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Footer buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={closeEditModal}
                  disabled={editSaving}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8,
                    border: '1.5px solid var(--border)', background: 'var(--background)',
                    color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  style={{
                    flex: 2, padding: '10px 0', borderRadius: 8,
                    border: 'none', background: 'var(--primary)',
                    color: '#fff', fontSize: 14, fontWeight: 700,
                    cursor: editSaving ? 'not-allowed' : 'pointer',
                    opacity: editSaving ? 0.7 : 1,
                  }}
                >
                  {editSaving ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Manual Entry Modal ─────────────────────────────────────── */}
      {createOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !createSaving) {
              setCreateOpen(false);
              setCreateEmployeeOpen(false);
              setCreateEmployeeSearch('');
            }
          }}
        >
          <div style={{
            background: 'var(--surface)', borderRadius: 16,
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
            width: '100%', maxWidth: 480,
            border: '1px solid var(--border)',
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  {t('attendance.moduleLabel')}
                </div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  {t('attendance.createEntry')}
                </h2>
              </div>
              <button
                onClick={() => {
                  setCreateOpen(false);
                  setCreateEmployeeOpen(false);
                  setCreateEmployeeSearch('');
                }}
                disabled={createSaving}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--background)',
                  color: 'var(--text-secondary)', fontSize: 18,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>
              {createSuccess && (
                <div style={{
                  background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)',
                  borderLeft: '4px solid #16a34a', borderRadius: 8,
                  padding: '10px 14px', marginBottom: 16,
                  color: '#16a34a', fontSize: 13, fontWeight: 600,
                }}>
                  {t('attendance.createEntrySuccess')}
                </div>
              )}
              {createError && (
                <div style={{
                  background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)',
                  borderLeft: '4px solid #dc2626', borderRadius: 8,
                  padding: '10px 14px', marginBottom: 16,
                  color: '#dc2626', fontSize: 13, fontWeight: 500,
                }}>
                  {createError}
                </div>
              )}

              {/* Employee select */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  {t('attendance.selectEmployee')} *
                </label>
                <div ref={createEmployeePickerRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setCreateEmployeeOpen((prev) => !prev)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      border: '1.5px solid var(--border)', background: 'var(--background)',
                      color: 'var(--text)', fontSize: 14, outline: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      cursor: 'pointer',
                    }}
                  >
                    {selectedCreateEmployee ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          background: 'rgba(13,33,55,0.14)',
                          color: '#0D2137',
                          fontSize: 10,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {selectedCreateEmployeeAvatarUrl ? (
                            <img src={selectedCreateEmployeeAvatarUrl} alt={selectedCreateEmployeeFullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : selectedCreateEmployeeInitials}
                        </span>
                        <span style={{ minWidth: 0, textAlign: 'left' }}>
                          <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedCreateEmployeeFullName}
                          </span>
                          <span style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t(`roles.${selectedCreateEmployee.role ?? 'employee'}`, selectedCreateEmployee.role ?? 'employee')}
                            {selectedCreateEmployee.storeName ? ` · ${selectedCreateEmployee.storeName}` : ''}
                          </span>
                        </span>
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('attendance.selectEmployee')}</span>
                    )}
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 }}>{createEmployeeOpen ? '▲' : '▼'}</span>
                  </button>

                  {createEmployeeOpen && (
                    <div style={{
                      position: 'absolute',
                      zIndex: 20,
                      top: 'calc(100% + 6px)',
                      left: 0,
                      right: 0,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      boxShadow: '0 16px 30px rgba(0,0,0,0.18)',
                      maxHeight: 260,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}>
                      <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
                        <input
                          value={createEmployeeSearch}
                          onChange={(e) => setCreateEmployeeSearch(e.target.value)}
                          placeholder={t('common.search', 'Cerca...')}
                          style={{
                            width: '100%',
                            padding: '7px 9px',
                            borderRadius: 8,
                            border: '1.5px solid var(--border)',
                            background: 'var(--background)',
                            color: 'var(--text)',
                            fontSize: 12,
                            outline: 'none',
                          }}
                        />
                      </div>
                      <div style={{ overflowY: 'auto', maxHeight: 204 }}>
                        {filteredCreateEmployees.length === 0 ? (
                          <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                            {t('common.noData', 'Nessun dato')}
                          </div>
                        ) : (
                          filteredCreateEmployees.map((emp) => {
                            const fullName = `${emp.name} ${emp.surname}`.trim();
                            const avatarUrl = getAvatarUrl(emp.avatarFilename);
                            const initials = `${emp.name?.[0] ?? ''}${emp.surname?.[0] ?? ''}`.toUpperCase() || 'U';
                            const selected = String(emp.id) === createUserId;
                            return (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() => {
                                  const uid = String(emp.id);
                                  setCreateUserId(uid);
                                  if (emp.storeId) setCreateStoreId(String(emp.storeId));
                                  else setCreateStoreId('');
                                  setCreateEmployeeOpen(false);
                                  setCreateEmployeeSearch('');
                                }}
                                style={{
                                  width: '100%',
                                  border: 'none',
                                  borderBottom: '1px solid var(--border)',
                                  background: selected ? 'var(--surface-warm)' : 'var(--surface)',
                                  padding: '8px 10px',
                                  textAlign: 'left',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  cursor: 'pointer',
                                }}
                              >
                                <span style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  overflow: 'hidden',
                                  background: 'rgba(13,33,55,0.14)',
                                  color: '#0D2137',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}>
                                  {avatarUrl ? (
                                    <img src={avatarUrl} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : initials}
                                </span>
                                <span style={{ minWidth: 0 }}>
                                  <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {fullName}
                                  </span>
                                  <span style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {t(`roles.${emp.role ?? 'employee'}`, emp.role ?? 'employee')}
                                    {emp.storeName ? ` · ${emp.storeName}` : ''}
                                  </span>
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Store select — pre-filled from employee's store, still overridable */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  {t('attendance.selectStore')} *
                </label>
                <select
                  value={createStoreId}
                  onChange={(e) => setCreateStoreId(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    border: `1.5px solid ${createStoreId ? 'var(--accent)' : 'var(--border)'}`,
                    background: createStoreId ? 'var(--accent-light)' : 'var(--background)',
                    color: 'var(--text)', fontSize: 14, outline: 'none', appearance: 'none',
                  }}
                >
                  <option value="">{t('attendance.selectStore')}</option>
                  {storeList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.companyName ? `${s.name} (${s.companyName})` : s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Event type */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  {t('attendance.selectEventType')} *
                </label>
                <select
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    border: '1.5px solid var(--border)', background: 'var(--background)',
                    color: 'var(--text)', fontSize: 14, outline: 'none', appearance: 'none',
                  }}
                >
                  <option value="checkin">{t('attendance.checkin')}</option>
                  <option value="checkout">{t('attendance.checkout')}</option>
                  <option value="break_start">{t('attendance.breakStart')}</option>
                  <option value="break_end">{t('attendance.breakEnd')}</option>
                </select>
              </div>

              {/* Date + Time */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <DatePicker
                    label={`${t('common.date')} *`}
                    value={createDate}
                    onChange={setCreateDate}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TimePicker
                    label={`${t('common.time')} *`}
                    value={createTimeOnly}
                    onChange={setCreateTimeOnly}
                  />
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  {t('common.notes')}
                </label>
                <textarea
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  rows={2}
                  placeholder="—"
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    border: '1.5px solid var(--border)', background: 'var(--background)',
                    color: 'var(--text)', fontSize: 14, outline: 'none', resize: 'vertical',
                    boxSizing: 'border-box', fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Footer buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => {
                    setCreateOpen(false);
                    setCreateEmployeeOpen(false);
                    setCreateEmployeeSearch('');
                  }}
                  disabled={createSaving}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8,
                    border: '1.5px solid var(--border)', background: 'var(--background)',
                    color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleCreateSave}
                  disabled={createSaving || createSuccess}
                  style={{
                    flex: 2, padding: '10px 0', borderRadius: 8,
                    border: 'none', background: 'var(--primary)',
                    color: '#fff', fontSize: 14, fontWeight: 700,
                    cursor: (createSaving || createSuccess) ? 'not-allowed' : 'pointer',
                    opacity: (createSaving || createSuccess) ? 0.7 : 1,
                  }}
                >
                  {createSaving ? t('common.saving') : t('common.create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ────────────────────────────────────── */}
      {deletingEvent && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !deleteConfirming) setDeletingEvent(null); }}
        >
          <div style={{
            background: 'var(--surface)', borderRadius: 16,
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
            width: '100%', maxWidth: 400,
            border: '1px solid var(--border)',
            padding: '28px 24px',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, marginBottom: 16,
            }}>
              ⚠
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              {t('attendance.confirmDelete')}
            </h3>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {t('attendance.confirmDeleteMsg')}
            </p>
            <p style={{ margin: '0 0 24px', fontSize: 12, color: 'var(--text-muted)' }}>
              {deletingEvent.userName} {deletingEvent.userSurname} — {formatDateTime(deletingEvent.eventTime).date} {formatDateTime(deletingEvent.eventTime).time}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setDeletingEvent(null)}
                disabled={deleteConfirming}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8,
                  border: '1.5px solid var(--border)', background: 'var(--background)',
                  color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteConfirming}
                style={{
                  flex: 2, padding: '10px 0', borderRadius: 8,
                  border: 'none', background: '#dc2626',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: deleteConfirming ? 'not-allowed' : 'pointer',
                  opacity: deleteConfirming ? 0.7 : 1,
                }}
              >
                {deleteConfirming ? t('common.loading') : t('attendance.deleteEvent')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
