import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CalendarDays, CheckCircle2, Coffee, RefreshCw, AlertCircle } from 'lucide-react';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { Table, Card } from '../../components/ui';
import type { Column } from '../../components/ui';
import client from '../../api/client';

interface AssignedStore {
  id: number;
  name: string;
  code: string;
  employeeCount: number;
}

interface PendingShiftHomeRow {
  id: number;
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  userName: string;
  userSurname: string;
  storeName?: string | null;
}

interface PendingLeaveHomeRow {
  id: number;
  userId: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  userName: string;
  userSurname: string;
}

export interface AreaManagerHomeData {
  assignedStores: AssignedStore[];
  pendingShiftPreview?: PendingShiftHomeRow[];
  pendingShiftCount?: number;
  pendingLeavePreview?: PendingLeaveHomeRow[];
  pendingLeaveCount?: number;
  nextShift?: any | null;
  stats?: {
    totalStores: number;
    activeEmployees: number;
    presentEmployees: number;
    weeklyHours: number;
  };
}

interface AreaManagerHomeProps {
  data: AreaManagerHomeData;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatShiftDate(dateStr: string, locale: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}
function isToday(dateStr: string): boolean {
  const now = new Date();
  return dateStr === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function isTomorrow(dateStr: string): boolean {
  const t = new Date(); t.setDate(t.getDate() + 1);
  return dateStr === `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}
function fmt(t: string): string { return t ? t.slice(0, 5) : ''; }

const SHIFT_STATUS_META: Record<string, { bg: string; color: string; labelKey: string }> = {
  confirmed: { bg: 'rgba(21,128,61,0.10)', color: '#15803d', labelKey: 'shifts.status.confirmed' },
  scheduled: { bg: 'rgba(13,33,55,0.08)', color: '#1e4a7a', labelKey: 'shifts.status.scheduled' },
  cancelled: { bg: 'rgba(220,38,38,0.08)', color: '#dc2626', labelKey: 'shifts.status.cancelled' },
};

// ── Icons ──────────────────────────────────────────────────────────────────────
const IconStore = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 7l1-4h18l1 4"/>
    <path d="M2 7h20v13a2 2 0 01-2 2H4a2 2 0 01-2-2V7z"/>
    <path d="M10 21V12h4v9"/>
  </svg>
);
const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
);
const IconActivity = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
  </svg>
);
const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

// ── Stat card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent: string;
  description?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, accent, description }) => (
  <div className="card-lift" style={{
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    borderTop: `3px solid ${accent}`,
    padding: '22px 24px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex', flexDirection: 'column', gap: '14px',
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: `${accent}14`, border: `1px solid ${accent}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent, flexShrink: 0,
      }}>{icon}</div>
      <span style={{
        fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: '2px',
      }}>{label}</span>
    </div>
    <div>
      <div className="stat-num" style={{
        fontSize: '38px', fontWeight: 700, fontFamily: 'var(--font-display)',
        color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.03em',
      }}>{value}</div>
      {description && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{description}</div>
      )}
    </div>
  </div>
);

const BAR_COLORS = ['#C9973A', '#0D2137', '#0284C7', '#15803D', '#7C3AED', '#B45309'];

const makeChartTooltip = (employeesLabel: string) =>
  ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', padding: '8px 12px',
        boxShadow: 'var(--shadow)', fontSize: '12px', fontFamily: 'var(--font-body)',
      }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{payload[0].payload.name}</span>
        <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{payload[0].value} {employeesLabel}</span>
      </div>
    );
  };

export const AreaManagerHome: React.FC<AreaManagerHomeProps> = ({ data }) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isMobile, isTablet } = useBreakpoint();
  const { permissions, user } = useAuth();
  
  const {
    assignedStores = [],
    pendingShiftPreview = [],
    pendingShiftCount = 0,
    pendingLeavePreview = [],
    pendingLeaveCount = 0,
    stats,
    nextShift,
  } = data;

  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';
  const showAttendance = user?.isSuperAdmin || permissions['presenze'] === true;
  const showShifts = user?.isSuperAdmin || permissions['turni'] === true;

  // ── Daily attendance state for self ────────────────────────────────────
  const [dailyState, setDailyState] = useState<any>(null);
  const [stateLoading, setStateLoading] = useState(true);
  const [showRegWarning, setShowRegWarning] = useState(true);

  useEffect(() => {
    let active = true;
    const loadState = async () => {
      try {
        setStateLoading(true);
        const res = await client.get('/attendance/daily-state');
        if (active) setDailyState(res.data?.data ?? res.data);
      } catch (err) {
        console.error('Error loading daily state for AM:', err);
      } finally {
        if (active) setStateLoading(false);
      }
    };
    void loadState();
    return () => { active = false; };
  }, []);

  const shiftMeta = nextShift ? (SHIFT_STATUS_META[nextShift.status] ?? SHIFT_STATUS_META.scheduled) : null;
  const shiftIsToday = nextShift ? isToday(nextShift.date) : false;
  const shiftIsTomorrow = nextShift ? isTomorrow(nextShift.date) : false;

  const ChartTooltip = React.useMemo(() => makeChartTooltip(t('home.areaManager.employeesLabel')), [t]);

  const barData = assignedStores.map((s) => ({ name: s.name, value: s.employeeCount, id: s.id }));
  const totalEmployees = assignedStores.reduce((sum, s) => sum + s.employeeCount, 0);

  const storeColumns: Column<AssignedStore>[] = [
    {
      key: 'name', label: t('home.areaManager.colStore'),
      render: (row) => (
        <span
          style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}
          onClick={() => navigate(`/dipendenti?store_id=${row.id}`)}
        >
          {row.name}
        </span>
      ),
    },
    { key: 'code', label: t('home.areaManager.colCode'), render: (row) => <span style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>{row.code}</span> },
    {
      key: 'employeeCount', label: t('home.areaManager.colEmployees'),
      align: 'right',
      render: (row) => (
        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: '14px' }}>
          {row.employeeCount}
        </span>
      ),
    },
  ];

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header banner */}
      <div className="banner-inner" style={{
        background: 'linear-gradient(135deg, #15803D 0%, #166534 100%)',
        borderRadius: 'var(--radius-lg)', padding: '22px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        boxShadow: '0 4px 20px rgba(21,128,61,0.20)',
      }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            {t('home.areaManager.title')}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.60)', fontSize: '13px', margin: 0 }}>
            {t('home.areaManager.storesCount', { count: assignedStores.length })}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="stat-num" style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'var(--font-display)', color: '#FFFFFF', lineHeight: 1, letterSpacing: '-0.03em' }}>
            {totalEmployees}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginTop: '2px', fontWeight: 500 }}>
            {t('home.areaManager.totalEmployees')}
          </div>
        </div>
      </div>

      {/* ═══ MY SHIFT & ATTENDANCE SECTION ═══ */}
      {showShifts && (
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px 12px', borderBottom: '1px solid var(--border-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', letterSpacing: '-0.01em' }}>
            {t('home.employee.nextShift')}
          </h3>
          <button
            onClick={() => navigate('/turni')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: 'var(--accent)', fontWeight: 600,
              padding: '4px 8px', borderRadius: 6,
              fontFamily: 'var(--font-body)',
            }}
          >
            {t('common.viewAll', 'Vedi tutti →')}
          </button>
        </div>

        {nextShift ? (
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                background: shiftIsToday ? 'var(--accent)' : 'var(--primary)',
                color: '#fff', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                  {new Date(nextShift.date + 'T12:00:00').getDate()}
                </span>
                <span style={{ fontSize: 9, opacity: 0.8, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  {new Date(nextShift.date + 'T12:00:00').toLocaleDateString(locale, { month: 'short' })}
                </span>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                  {shiftIsToday
                    ? t('common.today', 'Oggi')
                    : shiftIsTomorrow
                      ? t('common.tomorrow', 'Domani')
                      : formatShiftDate(nextShift.date, locale)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {nextShift.storeName}
                </div>
              </div>
              {shiftMeta && (
                <div style={{
                  marginLeft: 'auto',
                  padding: '4px 10px', borderRadius: 20,
                  background: shiftMeta.bg, color: shiftMeta.color,
                  fontSize: 11, fontWeight: 700,
                }}>
                  {t(shiftMeta.labelKey)}
                </div>
              )}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 16px', borderRadius: 10,
              background: 'var(--surface-warm)', border: '1px solid var(--border-light)',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                {fmt(nextShift.startTime)} – {fmt(nextShift.endTime)}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ marginBottom: 10, opacity: 0.25, display: 'flex', justifyContent: 'center' }}><CalendarDays size={28} /></div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {t('home.employee.noNextShift', 'Nessun turno programmato')}
            </div>
          </div>
        )}
      </div>
      )}

      {/* ═══ MY ATTENDANCE STATUS ═══ */}
      {showAttendance && (
        <Card
          title={t('nav.presenze', 'Rilevazione Presenze')}
          actions={
            <button
              onClick={() => navigate('/presenze/checkin')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '11px', color: 'var(--accent)', fontWeight: 600,
                padding: '4px 8px', borderRadius: 6, fontFamily: 'var(--font-body)',
              }}
            >
              {t('common.viewAll', 'Vedi tutti →')}
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Status Display */}
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '16px 20px', borderRadius: 'var(--radius-lg)',
              background: 'var(--surface-warm)', border: '1px solid var(--border-light)',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)', width: '100%'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: stateLoading
                    ? 'rgba(100, 116, 139, 0.1)'
                    : dailyState?.state?.checkedOut
                    ? 'rgba(22, 163, 74, 0.1)'
                    : dailyState?.state?.breakStarted && !dailyState?.state?.breakEnded
                    ? 'rgba(217, 119, 6, 0.1)'
                    : dailyState?.state?.checkedIn
                    ? 'rgba(37, 99, 235, 0.1)'
                    : !dailyState?.hasShift
                    ? 'rgba(37, 99, 235, 0.1)'
                    : 'rgba(100, 116, 139, 0.1)',
                  color: stateLoading
                    ? 'var(--text-muted)'
                    : dailyState?.state?.checkedOut
                    ? '#16a34a'
                    : dailyState?.state?.breakStarted && !dailyState?.state?.breakEnded
                    ? '#d97706'
                    : dailyState?.state?.checkedIn
                    ? '#2563eb'
                    : !dailyState?.hasShift
                    ? '#2563eb'
                    : 'var(--text-muted)',
                  flexShrink: 0
                }}>
                  {stateLoading ? <RefreshCw className="animate-spin" size={20} />
                    : dailyState?.state?.checkedOut ? <CheckCircle2 size={20} />
                    : dailyState?.state?.breakStarted && !dailyState?.state?.breakEnded ? <Coffee size={20} />
                    : dailyState?.state?.checkedIn ? <CheckCircle2 size={20} />
                    : !dailyState?.hasShift ? <CalendarDays size={20} />
                    : <AlertCircle size={20} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t('attendance.status')}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {stateLoading
                      ? t('attendance.stateLoading')
                      : dailyState?.state?.checkedOut
                      ? t('attendance.finishedService')
                      : dailyState?.state?.breakStarted && !dailyState?.state?.breakEnded
                      ? t('attendance.onBreak')
                      : dailyState?.state?.checkedIn
                      ? t('attendance.inService')
                      : !dailyState?.hasShift
                      ? t('attendance.notAssigned')
                      : t('attendance.notCheckedIn')}
                  </div>
                  {!stateLoading && dailyState && (
                    <div style={{ fontSize: '12.5px', marginTop: '2px', fontWeight: 600 }}>
                      {!dailyState.hasShift ? (
                        <span style={{ color: '#2563eb' }}>{t('attendance.noShiftToday')}</span>
                      ) : dailyState.hasLeave ? (
                        <span style={{ color: '#d97706' }}>{t('attendance.leaveToday')}</span>
                      ) : (
                        <span style={{ color: '#16a34a' }}>{t('attendance.hasShiftToday')}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Device Registration Warning */}
            {user?.requiresDeviceRegistration && showRegWarning && (
              <div style={{
                position: 'relative', padding: '16px', borderRadius: 'var(--radius-lg)',
                background: 'rgba(239, 68, 68, 0.08)', border: '1.5px solid rgba(239, 68, 68, 0.25)',
                display: 'flex', gap: '14px', alignItems: 'flex-start', marginTop: '4px',
              }}>
                <button onClick={() => setShowRegWarning(false)} style={{
                  position: 'absolute', top: '8px', right: '8px', background: 'none',
                  border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1, padding: '4px'
                }}>×</button>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                    <line x1="12" y1="18" x2="12.01" y2="18"/>
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, paddingRight: '20px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {t('deviceRegistration.notRegisteredTitle', 'Dispositivo Non Registrato')}
                    </h4>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {t('deviceRegistration.notRegisteredDesc', 'Questo dispositivo non è registrato. Non potrai timbrare le tue presenze finché non lo registri.')}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/device/register')}
                    className="btn btn-primary"
                    style={{ alignSelf: 'flex-start', height: '32px', padding: '0 14px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', cursor: 'pointer' }}
                  >
                    {t('deviceRegistration.button', 'Registra Dispositivo')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Metric Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: '24px',
        width: '100%',
      }}>
        <StatCard
          label={t('home.areaManager.activeStores')}
          value={stats?.totalStores ?? 0}
          icon={<IconStore />}
          accent="#15803D"
          description={t('home.areaManager.activeStoresDesc')}
        />
        <StatCard
          label={t('home.areaManager.activeEmployees')}
          value={stats?.activeEmployees ?? 0}
          icon={<IconUsers />}
          accent="#0284C7"
          description={t('home.areaManager.activeEmployeesDesc')}
        />
        <StatCard
          label={t('home.areaManager.presentEmployees')}
          value={`${stats?.presentEmployees ?? 0} / ${stats?.activeEmployees ?? 0}`}
          icon={<IconActivity />}
          accent="#C9973A"
          description={t('home.areaManager.presentEmployeesDesc')}
        />
        <StatCard
          label={t('home.areaManager.weeklyHours')}
          value={stats?.weeklyHours ?? 0}
          icon={<IconClock />}
          accent="#7C3AED"
          description={t('home.areaManager.weeklyHoursDesc')}
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
        gap: '24px',
      }}>
        {/* Stores list */}
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '24px',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
            {t('home.areaManager.storesList')}
          </h3>
          <Table<AssignedStore> flush columns={storeColumns} data={assignedStores} emptyText={t('home.areaManager.noStores')} />
        </div>

        {/* Analytics chart */}
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '24px',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
            {t('home.areaManager.staffDistribution')}
          </h3>
          <div style={{ height: 300 }}>
            {assignedStores.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--border)', opacity: 0.4 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                    {barData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                {t('home.areaManager.noStores')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pending Reviews Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
        gap: '24px',
      }}>
        {/* Pending Shifts */}
        {(user?.isSuperAdmin || permissions.turni) && (
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '24px',
            border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
            gridColumn: (user?.isSuperAdmin || permissions.permessi) ? 'span 1' : 'span 2',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                {t('home.areaManager.pendingShifts')}
              </h3>
              {pendingShiftCount > 0 && (
                <span style={{
                  background: 'rgba(201,151,58,0.12)', color: '#C9973A', padding: '3px 10px',
                  borderRadius: '20px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em',
                }}>
                  {pendingShiftCount} {t('home.areaManager.toReview')}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingShiftPreview.slice(0, 3).map((s) => (
                <div key={s.id} style={{
                  padding: '12px 14px', background: 'var(--background)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)' }}>{s.userName} {s.userSurname}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.date} • {s.startTime}-{s.endTime}</div>
                    {s.storeName && <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 500, marginTop: '2px' }}>{s.storeName}</div>}
                  </div>
                  <button
                    onClick={() => navigate('/turni')}
                    style={{
                      background: 'none', border: '1px solid var(--accent)', color: 'var(--accent)',
                      padding: '5px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {t('common.view')}
                  </button>
                </div>
              ))}
              {pendingShiftPreview.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {t('home.areaManager.noPendingShifts')}
                </div>
              )}
              <button
                onClick={() => navigate('/turni')}
                style={{
                  width: '100%', marginTop: '4px', padding: '10px', background: 'none',
                  border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)',
                  color: 'var(--text-muted)', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer',
                }}
              >
                {t('home.areaManager.viewAllShifts')}
              </button>
            </div>
          </div>
        )}

        {/* Pending Leaves */}
        {(user?.isSuperAdmin || permissions.permessi) && (
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '24px',
            border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
            gridColumn: (user?.isSuperAdmin || permissions.turni) ? 'span 1' : 'span 2',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                {t('home.areaManager.pendingLeaves')}
              </h3>
              {pendingLeaveCount > 0 && (
                <span style={{
                  background: 'rgba(2,132,199,0.12)', color: '#0284C7', padding: '3px 10px',
                  borderRadius: '20px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em',
                }}>
                  {pendingLeaveCount} {t('home.areaManager.toReview')}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingLeavePreview.slice(0, 3).map((l) => (
                <div key={l.id} style={{
                  padding: '12px 14px', background: 'var(--background)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)' }}>{l.userName} {l.userSurname}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{l.leaveType} • {l.startDate} al {l.endDate}</div>
                  </div>
                  <button
                    onClick={() => navigate('/permessi')}
                    style={{
                      background: 'none', border: '1px solid var(--accent)', color: 'var(--accent)',
                      padding: '5px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {t('common.view')}
                  </button>
                </div>
              ))}
              {pendingLeavePreview.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {t('home.areaManager.noPendingLeaves')}
                </div>
              )}
              <button
                onClick={() => navigate('/permessi')}
                style={{
                  width: '100%', marginTop: '4px', padding: '10px', background: 'none',
                  border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)',
                  color: 'var(--text-muted)', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer',
                }}
              >
                {t('home.areaManager.viewAllLeaves')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
