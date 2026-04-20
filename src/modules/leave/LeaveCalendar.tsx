import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Palmtree, Thermometer } from 'lucide-react';
import { getLeaveRequests, LeaveRequest } from '../../api/leave';
import { getAvatarUrl } from '../../api/client';


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Monday-based day-of-week (0=Mon … 6=Sun) */
function dayOfWeekMon(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function initials(name?: string, surname?: string): string {
  const n = (name ?? '').trim();
  const s = (surname ?? '').trim();
  if (!n && !s) return 'U';
  if (!s) return n.slice(0, 1).toUpperCase();
  return `${n.slice(0, 1)}${s.slice(0, 1)}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// Status colour mapping
// ---------------------------------------------------------------------------

interface StatusStyle {
  bg: string;
  border: string;
  text: string;
  label: string;
}

function statusStyle(status: string, t: (k: string) => string): StatusStyle {
  if (status === 'approved' || status.endsWith('approved')) {
    return { bg: 'rgba(22,163,74,0.10)', border: 'rgba(22,163,74,0.30)', text: '#16a34a', label: t('leave.status_approved') };
  }
  if (status === 'pending' || status === 'store manager approved' || status === 'area manager approved' || status === 'HR approved') {
    return { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.35)', text: '#b45309', label: t('leave.status_pending') };
  }
  if (status === 'rejected' || status.endsWith('rejected')) {
    return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.25)', text: '#dc2626', label: t('leave.status_rejected') };
  }
  if (status === 'cancelled') {
    return { bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.25)', text: '#6b7280', label: t('leave.status_cancelled') };
  }
  return { bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.25)', text: '#6b7280', label: status };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 3;

export default function LeaveCalendar() {
  const { t, i18n } = useTranslation();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const firstDay = formatDate(new Date(year, month, 1));
      const lastDay = formatDate(new Date(year, month, daysInMonth(year, month)));
      const res = await getLeaveRequests({ dateFrom: firstDay, dateTo: lastDay });
      // Exclude rejected & cancelled for calendar view
      setRequests(res.requests.filter((r) =>
        r.status !== 'rejected' &&
        !r.status.endsWith('rejected') &&
        r.status !== 'cancelled'
      ));
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build day → requests map
  const dayMap = new Map<string, LeaveRequest[]>();
  for (const req of requests) {
    const start = new Date(req.startDate + 'T00:00:00');
    const end = new Date(req.endDate + 'T00:00:00');
    const d = new Date(start);
    while (d <= end) {
      if (d.getMonth() === month && d.getFullYear() === year) {
        const key = formatDate(d);
        const arr = dayMap.get(key) ?? [];
        arr.push(req);
        dayMap.set(key, arr);
      }
      d.setDate(d.getDate() + 1);
    }
  }

  // Calendar grid
  const totalDays = daysInMonth(year, month);
  const firstDow = dayOfWeekMon(new Date(year, month, 1));
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDow).fill(null);

  for (let day = 1; day <= totalDays; day++) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const DAY_LABELS = [
    t('shifts.dayMon', 'Mon'),
    t('shifts.dayTue', 'Tue'),
    t('shifts.dayWed', 'Wed'),
    t('shifts.dayThu', 'Thu'),
    t('shifts.dayFri', 'Fri'),
    t('shifts.daySat', 'Sat'),
    t('shifts.daySun', 'Sun'),
  ];

  const monthLabel = new Date(year, month, 1).toLocaleDateString(
    i18n.language === 'it' ? 'it-IT' : 'en-US',
    { month: 'long', year: 'numeric' },
  );

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const todayStr = formatDate(new Date());

  return (
    <div style={{ padding: '20px 0' }}>
      {/* Navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
        flexWrap: 'wrap',
      }}>
        <button onClick={prevMonth} style={navBtnStyle}><ChevronLeft size={18} /></button>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize', minWidth: 160, textAlign: 'center' }}>
          {monthLabel}
        </div>
        <button onClick={nextMonth} style={navBtnStyle}><ChevronRight size={18} /></button>
        <button onClick={goToday} style={{
          ...navBtnStyle, fontSize: 12, padding: '4px 12px', borderRadius: 8,
        }}>
          {t('common.today', 'Today')}
        </button>

        {/* Legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <LegendDot color="#16a34a" label={t('leave.status_approved')} />
          <LegendDot color="#b45309" label={t('leave.status_pending')} />
          <LegendDot color="#3b82f6" label={t('leave.type_vacation')} icon={<Palmtree size={12} />} />
          <LegendDot color="#ef4444" label={t('leave.type_sick')} icon={<Thermometer size={12} />} />
        </div>
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', margin: '0 auto 12px',
            border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
            animation: 'spin 0.7s linear infinite',
          }} />
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loading')}</div>
        </div>
      )}

      {!loading && (
        <div style={{
          background: 'var(--surface)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          {/* Day-of-week header */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-warm)',
          }}>
            {DAY_LABELS.map((label) => (
              <div key={label} style={{
                padding: '8px 4px', textAlign: 'center',
                fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: 0.8,
              }}>
                {label}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
              borderBottom: wi < weeks.length - 1 ? '1px solid var(--border-light)' : 'none',
            }}>
              {week.map((day, di) => {
                if (day === null) {
                  return <div key={`e-${di}`} style={{ minHeight: 90, background: 'var(--background)', borderRight: di < 6 ? '1px solid var(--border-light)' : 'none' }} />;
                }
                const dateStr = formatDate(new Date(year, month, day));
                const dayReqs = dayMap.get(dateStr) ?? [];
                const isToday = dateStr === todayStr;
                const isWeekend = di >= 5;
                const isHovered = hoveredDay === dateStr;

                return (
                  <div
                    key={day}
                    onMouseEnter={() => setHoveredDay(dateStr)}
                    onMouseLeave={() => setHoveredDay(null)}
                    style={{
                      minHeight: 90,
                      padding: '4px 6px',
                      borderRight: di < 6 ? '1px solid var(--border-light)' : 'none',
                      background: isToday ? 'rgba(182,140,86,0.06)' : isWeekend ? 'rgba(0,0,0,0.015)' : 'transparent',
                      position: 'relative',
                      transition: 'background 0.15s',
                      ...(isHovered ? { background: 'rgba(182,140,86,0.10)' } : {}),
                    }}
                  >
                    {/* Day number */}
                    <div style={{
                      fontSize: 12, fontWeight: isToday ? 800 : 600,
                      color: isToday ? '#b68c56' : 'var(--text)',
                      marginBottom: 4,
                      ...(isToday ? {
                        width: 22, height: 22, borderRadius: '50%',
                        background: '#b68c56', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      } : {}),
                    }}>
                      {day}
                    </div>

                    {/* Leave entries */}
                    {dayReqs.slice(0, MAX_VISIBLE).map((req) => {
                      const ss = statusStyle(req.status, t);
                      const isVacation = req.leaveType === 'vacation';
                      return (
                        <div key={req.id} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '2px 5px', marginBottom: 2,
                          borderRadius: 6, fontSize: 10, fontWeight: 600,
                          background: ss.bg, border: `1px solid ${ss.border}`,
                          color: ss.text, overflow: 'hidden', whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                        }}>
                          {req.userAvatarFilename ? (
                            <img
                              src={getAvatarUrl(req.userAvatarFilename) ?? undefined}
                              alt=""
                              style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0 }}
                            />
                          ) : (
                            <span style={{
                              width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                              background: isVacation ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)',
                              color: isVacation ? '#3b82f6' : '#ef4444',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 7, fontWeight: 800,
                            }}>
                              {initials(req.userName, req.userSurname)}
                            </span>
                          )}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {req.userName ?? ''} {(req.userSurname ?? '').slice(0, 1)}.
                          </span>
                          {isVacation
                            ? <Palmtree size={10} style={{ flexShrink: 0, opacity: 0.7 }} />
                            : <Thermometer size={10} style={{ flexShrink: 0, opacity: 0.7 }} />
                          }
                        </div>
                      );
                    })}
                    {dayReqs.length > MAX_VISIBLE && (
                      <div style={{
                        fontSize: 10, color: 'var(--text-muted)', fontWeight: 700,
                        padding: '1px 5px',
                      }}>
                        +{dayReqs.length - MAX_VISIBLE}
                      </div>
                    )}

                    {/* Hover tooltip for full list */}
                    {isHovered && dayReqs.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, zIndex: 100,
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 10, padding: '8px 10px', minWidth: 200,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                          {dateStr} — {dayReqs.length} {dayReqs.length === 1 ? t('leave.leave_singular', 'leave') : t('leave.leave_plural', 'leaves')}
                        </div>
                        {dayReqs.map((req) => {
                          const ss = statusStyle(req.status, t);
                          const isVacation = req.leaveType === 'vacation';
                          return (
                            <div key={req.id} style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '4px 0',
                              borderBottom: '1px solid var(--border-light)',
                            }}>
                              {req.userAvatarFilename ? (
                                <img src={getAvatarUrl(req.userAvatarFilename) ?? undefined} alt="" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                              ) : (
                                <span style={{
                                  width: 20, height: 20, borderRadius: '50%',
                                  background: isVacation ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)',
                                  color: isVacation ? '#3b82f6' : '#ef4444',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 9, fontWeight: 800,
                                }}>
                                  {initials(req.userName, req.userSurname)}
                                </span>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                                  {req.userName} {req.userSurname}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                  {req.storeName ?? ''} · {req.startDate} → {req.endDate}
                                </div>
                              </div>
                              <span style={{
                                padding: '2px 6px', borderRadius: 4,
                                fontSize: 9, fontWeight: 700,
                                background: ss.bg, color: ss.text, border: `1px solid ${ss.border}`,
                              }}>
                                {ss.label}
                              </span>
                              {isVacation
                                ? <Palmtree size={12} color="#3b82f6" />
                                : <Thermometer size={12} color="#ef4444" />
                              }
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small sub-components
// ---------------------------------------------------------------------------

function LegendDot({ color, label, icon }: { color: string; label: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
      {icon ?? <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />}
      <span style={{ fontWeight: 600 }}>{label}</span>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: 'var(--text)',
};
