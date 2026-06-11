import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Cake, PartyPopper, CalendarDays, Palmtree, Thermometer, CheckCircle2, Coffee, AlertCircle, RefreshCw } from 'lucide-react';
import { Card } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import client from '../../api/client';

interface EmployeeProfile {
  id: number;
  name: string;
  surname: string;
  role: string;
  department: string | null;
  storeName: string | null;
}

interface NextShift {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  storeName: string;
}

interface LeaveBalance {
  leaveType: 'vacation' | 'sick';
  totalDays: number;
  usedDays: number;
  remaining: number;
}

export interface EmployeeHomeData {
  profile: EmployeeProfile;
  nextShift?: NextShift | null;
  leaveBalance?: LeaveBalance[];
  isBirthday?: boolean;
  showLeaveBalance?: boolean;
  showShifts?: boolean;
}

interface EmployeeHomeProps {
  data: EmployeeHomeData;
}

// ── Next shift status colors ───────────────────────────────────────────────
const STATUS_META: Record<string, { bg: string; color: string; labelKey: string }> = {
  confirmed:  { bg: 'rgba(21,128,61,0.10)',  color: '#15803d', labelKey: 'shifts.status.confirmed' },
  scheduled:  { bg: 'rgba(13,33,55,0.08)',   color: '#1e4a7a', labelKey: 'shifts.status.scheduled' },
  cancelled:  { bg: 'rgba(220,38,38,0.08)',  color: '#dc2626', labelKey: 'shifts.status.cancelled' },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function formatShiftDate(dateStr: string, locale: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

function isToday(dateStr: string): boolean {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return dateStr === `${y}-${m}-${d}`;
}

function isTomorrow(dateStr: string): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const y = tomorrow.getFullYear();
  const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const d = String(tomorrow.getDate()).padStart(2, '0');
  return dateStr === `${y}-${m}-${d}`;
}

function fmt(t: string): string {
  return t ? t.slice(0, 5) : '';
}

// ── Leave balance progress bar ─────────────────────────────────────────────
function BalanceBar({ balance, locale }: { balance: LeaveBalance; locale: string }) {
  const { t } = useTranslation();
  const pct = balance.totalDays > 0 ? Math.min(1, balance.usedDays / balance.totalDays) : 0;
  const isVacation = balance.leaveType === 'vacation';
  const color = isVacation ? '#2563eb' : '#ea580c';
  const bgColor = isVacation ? 'rgba(37,99,235,0.10)' : 'rgba(234,88,12,0.10)';
  const trackColor = isVacation ? 'rgba(37,99,235,0.15)' : 'rgba(234,88,12,0.15)';

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
            background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isVacation ? <Palmtree size={14} strokeWidth={2} /> : <Thermometer size={14} strokeWidth={2} />}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {t(`leave.type_${balance.leaveType}`)}
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-display)', color, lineHeight: 1 }}>
            {balance.remaining}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 3 }}>
            / {balance.totalDays} {t('leave.days_label', 'gg')}
          </span>
        </div>
      </div>
      {/* Progress bar */}
      <div style={{ height: 6, borderRadius: 99, background: trackColor, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          width: `${pct * 100}%`,
          background: color,
          transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {t('leave.balance_used_of', { used: balance.usedDays, total: balance.totalDays })}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color, opacity: 0.85 }}>
          {balance.remaining} {t('leave.balance_remaining', 'rimanenti')}
        </span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export const EmployeeHome: React.FC<EmployeeHomeProps> = ({ data }) => {
  // Defensive check: if data is null, render a loading state.
  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
        <div className="animate-spin" style={{ width: 30, height: 30, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
      </div>
    );
  }

  const { permissions, user } = useAuth();
  const { profile, nextShift, leaveBalance = [], isBirthday = false, showLeaveBalance, showShifts } = data;
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';

  const [dailyState, setDailyState] = useState<any>(null);
  const [stateLoading, setStateLoading] = useState(true);
  const [showRegWarning, setShowRegWarning] = useState(true);

  useEffect(() => {
    let active = true;
    const loadState = async () => {
      try {
        setStateLoading(true);
        const res = await client.get('/attendance/daily-state');
        if (active) {
          setDailyState(res.data?.data ?? res.data);
        }
      } catch (err) {
        console.error('Error loading daily state in dashboard:', err);
      } finally {
        if (active) setStateLoading(false);
      }
    };
    if (profile) {
      void loadState();
    }
    return () => { active = false; };
  }, [profile]);

  const tRole = (role: string) => (t as (k: string) => string)(`roles.${role}`);

  const shiftMeta = nextShift ? (STATUS_META[nextShift.status] ?? STATUS_META.scheduled) : null;
  const shiftIsToday = nextShift ? isToday(nextShift.date) : false;
  const shiftIsTomorrow = nextShift ? isTomorrow(nextShift.date) : false;
  // Further safety for profile
  if (!profile) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        {t('home.employee.loadingProfile', 'Caricamento profilo...')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Birthday banner */}
      {isBirthday && profile && (
        <div style={{
          background: 'linear-gradient(135deg, var(--accent) 0%, #B8831E 100%)',
          borderRadius: 'var(--radius-lg)', padding: '18px 24px',
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: '0 4px 20px rgba(201,151,58,0.35)',
          animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        }}>
          <div style={{ flexShrink: 0, color: 'rgba(255,255,255,0.9)' }}><Cake size={32} strokeWidth={1.5} /></div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: '#fff', letterSpacing: '-0.01em' }}>
              {t('home.employee.birthdayTitle', { name: profile.name, defaultValue: `Buon compleanno, ${profile.name}!` })}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              {t('home.employee.birthdaySubtitle', 'Ti auguriamo una splendida giornata!')}
              <PartyPopper size={14} strokeWidth={2} />
            </div>
          </div>
        </div>
      )}



      {/* Profile card */}
      {profile && (
        <Card title={t('home.employee.profileCard')}>
          <div>
            {[
              [t('home.employee.firstName'), profile.name],
              [t('home.employee.lastName'), profile.surname],
            ].map(([label, value], i, arr) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', padding: '10px 0',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                borderTop: i === 0 ? '1px solid var(--border)' : 'none',
                fontSize: 14,
              }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Next shift */}
      {showShifts !== false && permissions.turni === true && (
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px 12px', borderBottom: '1px solid var(--border-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', letterSpacing: '-0.01em' }}>
              {t('home.employee.nextShift')}
            </h3>
          </div>
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
            {/* Date badge */}
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
            {/* Time block */}
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

      {/* Attendance & Tracking Card */}
      <Card 
        title={t('nav.presenze', 'Rilevazione Presenze')}
        actions={
          <button
            onClick={() => navigate('/presenze/checkin')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '11px',
              color: 'var(--accent)',
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: 6,
              fontFamily: 'var(--font-body)',
            }}
          >
            {t('common.viewAll', 'Vedi tutti →')}
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Status Display */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '16px 20px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--surface-warm)',
            border: '1px solid var(--border-light)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
            width: '100%'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: stateLoading 
                  ? 'rgba(100, 116, 139, 0.1)' 
                  : dailyState?.state?.checkedOut 
                  ? 'rgba(22, 163, 74, 0.1)' 
                  : dailyState?.state?.breakStarted && !dailyState?.state?.breakEnded
                  ? 'rgba(217, 119, 6, 0.1)'
                  : dailyState?.state?.checkedIn
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
                  : 'var(--text-muted)',
                flexShrink: 0
              }}>
                {stateLoading ? <RefreshCw className="animate-spin" size={20} />
                  : dailyState?.state?.checkedOut ? <CheckCircle2 size={20} />
                  : dailyState?.state?.breakStarted && !dailyState?.state?.breakEnded ? <Coffee size={20} />
                  : dailyState?.state?.checkedIn ? <CheckCircle2 size={20} />
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
                    : t('attendance.notCheckedIn')}
                </div>
                
                {/* Shift/Permit Summary (Under Heading) */}
                {!stateLoading && dailyState && (
                  <div style={{ fontSize: '12.5px', marginTop: '2px', fontWeight: 600 }}>
                    {!dailyState.hasShift ? (
                      <span style={{ color: '#dc2626' }}>{t('attendance.noShiftToday')}</span>
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

          {/* Device Registration Warning Banner */}
          {user?.requiresDeviceRegistration && showRegWarning && (
            <div style={{
              position: 'relative',
              padding: '16px',
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1.5px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              gap: '14px',
              alignItems: 'flex-start',
              marginTop: '4px',
              animation: 'fadeIn 0.2s ease'
            }}>
              {/* Dismiss button (top-right) */}
              <button
                onClick={() => setShowRegWarning(false)}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '18px',
                  lineHeight: 1,
                  padding: '4px'
                }}
              >
                ×
              </button>

              {/* Icon */}
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                  <line x1="12" y1="18" x2="12.01" y2="18"/>
                </svg>
              </div>

              {/* Text & Button */}
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
                  style={{
                    alignSelf: 'flex-start',
                    height: '32px',
                    padding: '0 14px',
                    fontSize: '12px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  {t('deviceRegistration.button', 'Registra Dispositivo')}
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Leave balance */}
      {showLeaveBalance !== false && (
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px 12px', borderBottom: '1px solid var(--border-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
            {t('home.employee.leaveBalance')}
          </h3>
          <button
            onClick={() => navigate('/permessi')}
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
        <div style={{ padding: '20px 20px 4px' }}>
          {leaveBalance.length > 0 ? (
            leaveBalance.map((b) => (
              <BalanceBar key={b.leaveType} balance={b} locale={locale} />
            ))
          ) : (
            <div style={{ paddingBottom: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {t('leave.no_balance', 'Nessun saldo disponibile')}
            </div>
          )}
        </div>
      </div>
      )}

    </div>
  );
};

export default EmployeeHome;
