import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarDays, CheckCircle2, Coffee, RefreshCw, AlertCircle } from 'lucide-react';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui';
import client from '../../api/client';

interface StoreInfo {
  id: number;
  name: string;
  code: string;
  maxStaff: number | null;
}

interface TodayAnomaly {
  anomalyType: string;
  severity: 'low' | 'medium' | 'high';
  userName: string;
  userSurname: string;
  userAvatarFilename: string | null;
  detailsKey: string;
  detailsParams: Record<string, string | number>;
}

interface NextShift {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  storeName: string;
}

export interface StoreManagerHomeData {
  store: StoreInfo;
  employeeCount: number;
  todayAnomalies?: TodayAnomaly[];
  todayAttendance?: Record<string, number>;
  upcomingWeekShiftsPlanned?: boolean;
  upcomingWeekNumber?: number;
  nextShift?: NextShift | null;
  stats?: {
    activeEmployees: number;
    presentEmployees: number;
    ongoingOnboarding: number;
    pendingLeaveRequests: number;
  };
}

interface StoreManagerHomeProps {
  data: StoreManagerHomeData;
}

// ── Icons ──────────────────────────────────────────────────────────────────────
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
const IconTrendingUp = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
    <polyline points="17 6 23 6 23 12"></polyline>
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

// ── Circular capacity ring ─────────────────────────────────────────────────────
function CapacityRing({ current, max, capacityLabel }: { current: number; max: number | null; capacityLabel: string }) {
  const pct = max && max > 0 ? Math.min(current / max, 1) : 0;
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const dash = pct * circumference;

  const color = pct >= 1 ? '#DC2626' : pct >= 0.8 ? '#B45309' : '#15803D';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <div style={{ position: 'relative', width: 140, height: 140 }}>
        <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
          {/* Progress */}
          <circle
            cx="70" cy="70" r={r} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.34,1.56,0.64,1), stroke 0.3s' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: '26px', fontWeight: 700, fontFamily: 'var(--font-display)',
            color: color, lineHeight: 1, letterSpacing: '-0.03em',
          }}>{current}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>/ {max ?? '—'}</span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '3px 10px', borderRadius: '999px',
          background: `${color}12`, border: `1px solid ${color}25`,
          fontSize: '12px', fontWeight: 600, color,
        }}>
          {Math.round(pct * 100)}% {capacityLabel}
        </div>
      </div>
    </div>
  );
}

// ── Metric row ─────────────────────────────────────────────────────────────────
const MetricRow: React.FC<{ label: string; value: string | number; accent?: string }> = ({ label, value, accent }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '11px 0', borderBottom: '1px solid var(--border-light)',
  }}>
    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
    <span style={{ fontSize: '14px', fontWeight: 700, color: accent ?? 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{value}</span>
  </div>
);

// Keys must match camelCase-converted response object keys from the API interceptor.
function getEventMeta(t: (key: string) => string): Record<string, { label: string; color: string; bg: string; icon: string }> {
  return {
    checkin:    { label: t('attendance.checkin'),    color: '#15803d', bg: 'rgba(21,128,61,0.10)',  icon: '→' },
    checkout:   { label: t('attendance.checkout'),   color: '#0369a1', bg: 'rgba(3,105,161,0.10)',  icon: '←' },
    breakStart: { label: t('attendance.breakStart'), color: '#b45309', bg: 'rgba(180,83,9,0.10)',   icon: '⏸' },
    breakEnd:   { label: t('attendance.breakEnd'),   color: '#7c3aed', bg: 'rgba(124,58,237,0.10)', icon: '▶' },
  };
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

export const StoreManagerHome: React.FC<StoreManagerHomeProps> = ({ data }) => {
  const { store, employeeCount, todayAnomalies = [], todayAttendance = {}, stats, nextShift } = data;
  const { t, i18n } = useTranslation();
  const { isMobile, isTablet } = useBreakpoint();
  const { permissions, user } = useAuth();
  const navigate = useNavigate();
  const EVENT_META = getEventMeta(t);
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';
  const showAttendance = user?.isSuperAdmin || permissions['presenze'] === true;
  const showAnomalies = user?.isSuperAdmin || permissions['anomalie'] === true;
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
        console.error('Error loading daily state for manager:', err);
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

  const available = store.maxStaff ? Math.max(0, store.maxStaff - employeeCount) : null;
  const currentDay = new Date().getDay();
  const isWarningDay = currentDay === 0 || currentDay === 5 || currentDay === 6; // Sunday, Friday, Saturday
  const showUnplannedWarning = isWarningDay && data.upcomingWeekShiftsPlanned === false;

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header banner */}
      <div className="banner-inner" style={{
        background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
        borderRadius: 'var(--radius-lg)', padding: '22px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        boxShadow: '0 4px 20px rgba(124,58,237,0.20)',
      }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            {t('home.storeManager.title')}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.60)', fontSize: '13px', margin: 0 }}>
            {store.name} · {store.code}
          </p>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '6px 14px', background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.20)', borderRadius: '999px',
          fontSize: '12px', fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FFFFFF', display: 'inline-block' }}/>
          {t('common.systemActive')}
        </div>
      </div>

      {showUnplannedWarning && (
        <div style={{
          background: 'rgba(220, 38, 38, 0.08)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: '14px',
          color: 'var(--danger)',
        }}>
          <div style={{
            background: 'var(--danger)', color: '#fff', borderRadius: '50%',
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <AlertTriangle size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>
              {t('home.storeManager.unplannedTitle', 'Weekly Schedule Not Planned')}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--danger)', opacity: 0.9 }}>
              {t('home.storeManager.unplannedMessage', { week: data.upcomingWeekNumber, defaultValue: `You have not planned the shifts for week ${data.upcomingWeekNumber}.` })}
            </div>
          </div>
        </div>
      )}

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
          label={t('home.storeManager.activeEmployees')}
          value={stats?.activeEmployees ?? employeeCount}
          icon={<IconUsers />}
          accent="#0284C7"
          description={t('home.storeManager.activeEmployeesDesc')}
        />
        <StatCard
          label={t('home.storeManager.presentEmployees')}
          value={`${stats?.presentEmployees ?? 0} / ${stats?.activeEmployees ?? employeeCount}`}
          icon={<IconActivity />}
          accent="#C9973A"
          description={t('home.storeManager.presentEmployeesDesc')}
        />
        <StatCard
          label={t('home.storeManager.ongoingOnboarding')}
          value={stats?.ongoingOnboarding ?? 0}
          icon={<CheckCircle2 size={20} />}
          accent="#15803D"
          description={t('home.storeManager.ongoingOnboardingDesc')}
        />
        <StatCard
          label={t('home.storeManager.pendingLeaveRequests')}
          value={stats?.pendingLeaveRequests ?? 0}
          icon={<CalendarDays size={20} />}
          accent="#7C3AED"
          description={t('home.storeManager.pendingLeaveRequestsDesc')}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', alignItems: 'stretch' }}>

        {/* Capacity ring card */}
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', letterSpacing: '-0.01em' }}>
              {t('home.storeManager.capacityTitle')}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{t('home.storeManager.capacityDesc')}</p>
          </div>
          <div style={{ padding: '28px 20px', display: 'flex', justifyContent: isMobile ? 'center' : 'flex-start' }}>
            <CapacityRing current={employeeCount} max={store.maxStaff} capacityLabel={t('home.storeManager.capacityBadge')} />
          </div>
        </div>

        {/* Store metrics */}
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', letterSpacing: '-0.01em' }}>
              {t('home.storeManager.storeInfo')}
            </h3>
          </div>
          <div style={{ padding: '4px 20px 12px' }}>
            <MetricRow label={t('home.storeManager.storeName')} value={store.name} />
            <MetricRow label={t('home.storeManager.storeCode')} value={store.code} />
            <MetricRow label={t('home.storeManager.maxCapacity')} value={store.maxStaff ?? '—'} />
            <MetricRow label={t('home.storeManager.activeEmployees')} value={employeeCount} accent="#15803D" />
            <MetricRow label={t('home.storeManager.availableSlots')} value={available ?? '—'} accent={available === null ? undefined : available > 0 ? '#0284C7' : '#DC2626'} />
          </div>
        </div>
      </div>

      {(showAnomalies || showAttendance) && (
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (showAnomalies && showAttendance ? '1fr 1fr' : '1fr'), gap: '16px' }}>

        {/* Today's anomalies */}
        {showAnomalies && (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
        }}>
          <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', letterSpacing: '-0.01em' }}>
                {t('home.storeManager.todayAnomalies')}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                {new Date().toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            {todayAnomalies.length > 0 && (
              <span style={{
                padding: '3px 10px', borderRadius: 20,
                background: 'rgba(220,38,38,0.08)', color: 'var(--danger)',
                fontSize: 12, fontWeight: 700,
              }}>
                {todayAnomalies.length}
              </span>
            )}
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {todayAnomalies.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <div style={{ marginBottom: 8, opacity: 0.3, display: 'flex', justifyContent: 'center' }}><AlertTriangle size={24} /></div>
                {t('attendance.no_anomalies', 'No anomalies detected')}
              </div>
            ) : (
              todayAnomalies.map((anomaly, idx) => {
                const severityColor = anomaly.severity === 'high' ? 'var(--danger)' : anomaly.severity === 'medium' ? 'var(--warning)' : 'var(--info)';
                return (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px',
                    borderBottom: idx < todayAnomalies.length - 1 ? '1px solid var(--border-light)' : 'none',
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: severityColor, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700,
                    }}>
                      {anomaly.userSurname.charAt(0)}{anomaly.userName.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {anomaly.userSurname} {anomaly.userName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        {t(`attendance.anomaly_${anomaly.anomalyType}`)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: severityColor, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        {t(`attendance.severity_${anomaly.severity}`)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        )}

        {/* Today's attendance summary */}
        {showAttendance && (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
        }}>
          <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', letterSpacing: '-0.01em' }}>
              {t('home.storeManager.todayAttendance')}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              {t('home.storeManager.attendanceDesc', 'Riepilogo eventi di oggi')}
            </p>
          </div>
          <div style={{ padding: '16px 20px' }}>
            {Object.entries(EVENT_META).map(([key, meta]) => {
              const count = todayAttendance[key] ?? 0;
              return (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: key !== 'breakEnd' ? '1px solid var(--border-light)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: count > 0 ? meta.bg : 'var(--surface-warm)',
                      color: count > 0 ? meta.color : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700,
                    }}>
                      {meta.icon}
                    </div>
                    <span style={{ fontSize: 13, color: count > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: count > 0 ? 600 : 400 }}>
                      {meta.label}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)',
                    color: count > 0 ? meta.color : 'var(--text-disabled)',
                    lineHeight: 1,
                  }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        )}
      </div>
      )}
    </div>
  );
};

export default StoreManagerHome;
