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

function initials(name?: string, surname?: string): string {
  const n = (name ?? '').trim();
  const s = (surname ?? '').trim();
  if (!n && !s) return 'U';
  if (!s) return n.slice(0, 1).toUpperCase();
  return `${n.slice(0, 1)}${s.slice(0, 1)}`.toUpperCase();
}

function formatDateRange(startDate: string, endDate: string): string {
  return startDate === endDate ? startDate : `${startDate} -> ${endDate}`;
}

function formatLeaveStatus(status: string, t: any): string {
  const normalized = String(status ?? '').toLowerCase().replace(/\s+/g, '_');
  return t(`leave.status_${normalized}`, status || t('leave.status_pending', 'Pending'));
}

function LegendDot({ color, label, icon }: { color: string; label: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
      {icon ?? <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />}
      <span style={{ fontWeight: 600 }}>{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 4;

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

  // Build day -> requests map
  const dayMap = new Map<string, LeaveRequest[]>();
  for (const req of requests) {
    const start = new Date(req.startDate + 'T12:00:00');
    const end = new Date(req.endDate + 'T12:00:00');
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

  // First day of month (0=Sun ... 6=Sat), convert to Mon-based (0=Mon ... 6=Sun)
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = (firstDay === 0 ? 6 : firstDay - 1);
  const daysInMonthTotal = daysInMonth(year, month);

  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonthTotal }, (_, i) => new Date(year, month, i + 1)),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const summaryHoverCardStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    minWidth: 220,
    maxWidth: 280,
    borderRadius: 10,
    border: '1px solid rgba(148,163,184,0.44)',
    background: '#ffffff',
    boxShadow: '0 14px 36px rgba(15,23,42,0.22)',
    padding: '8px 9px',
    zIndex: 100,
  };

  const renderAvatar = (req: LeaveRequest): React.ReactNode => {
    const avatarUrl = getAvatarUrl(req.userAvatarFilename);
    const initialsStr = initials(req.userName, req.userSurname);
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt=""
          style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(148,163,184,0.45)' }}
        />
      );
    }
    return (
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e3a5f, #3a7bd5)',
          color: '#fff',
          fontSize: '0.52rem',
          fontWeight: 800,
          border: '1px solid rgba(148,163,184,0.45)',
        }}
      >
        {initialsStr}
      </span>
    );
  };

  return (
    <div style={{
      padding: '24px 32px',
      background: 'var(--surface)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
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
        <div style={{ padding: 0 }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
            {DAY_LABELS.map((label) => (
              <div key={label} style={{
                textAlign: 'center', fontWeight: 600,
                fontFamily: 'var(--font-display)', color: 'var(--primary)',
                padding: '4px 0', fontSize: '0.85rem',
              }}>
                {label}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {cells.map((date, idx) => {
              if (!date) {
                return <div key={`empty-${idx}`} style={{ minHeight: 104 }} />;
              }
              const dateStr = formatDate(date);
              const dayReqs = dayMap.get(dateStr) ?? [];
              const isToday = dateStr === todayStr;
              const isHovered = hoveredDay === dateStr;
              const hasLeaves = dayReqs.length > 0;

              return (
                <div
                  key={dateStr}
                  style={{
                    minHeight: 92,
                    borderRadius: 6,
                    border: isToday ? '2px solid var(--accent)' : '1px solid var(--border)',
                    padding: 7,
                    cursor: 'default',
                    background: isToday ? 'rgba(201, 151, 58, 0.06)' : 'var(--surface)',
                    transition: 'background 0.15s',
                    position: 'relative',
                    boxShadow: hasLeaves ? 'var(--shadow-xs)' : undefined,
                  }}
                  onMouseEnter={(e) => {
                    setHoveredDay(dateStr);
                    e.currentTarget.style.background = 'var(--background)';
                  }}
                  onMouseLeave={(e) => {
                    setHoveredDay(null);
                    e.currentTarget.style.background = isToday ? 'rgba(201, 151, 58, 0.06)' : 'var(--surface)';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                    marginBottom: 6,
                  }}>
                    <div style={{
                      fontWeight: isToday ? 700 : 500,
                      color: isToday ? 'var(--accent)' : 'var(--text)',
                      fontFamily: 'var(--font-display)',
                      fontSize: '0.9rem',
                      lineHeight: 1,
                    }}>
                      {isToday ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 26, height: 26, borderRadius: '50%',
                          background: 'var(--accent)', color: '#fff', fontWeight: 700,
                          boxShadow: '0 0 0 3px rgba(201,151,58,0.16)',
                        }}>
                          {date.getDate()}
                        </span>
                      ) : date.getDate()}
                    </div>
                  </div>

                  {hasLeaves && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {dayReqs.slice(0, MAX_VISIBLE).map((req) => {
                        const isVacation = req.leaveType === 'vacation';
                        const color = isVacation ? '#1e40af' : '#92400e';
                        const bg = isVacation ? 'rgba(219,234,254,0.76)' : 'rgba(254,243,199,0.78)';
                        const borderLeft = isVacation ? '#2563eb' : '#d97706';
                        const border = isVacation ? 'rgba(37,99,235,0.22)' : 'rgba(217,119,6,0.22)';
                        const Icon = isVacation ? Palmtree : Thermometer;

                        return (
                          <div key={req.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            borderRadius: 6,
                            border: `1px solid ${border}`,
                            borderLeftWidth: 5,
                            borderLeftStyle: 'solid',
                            borderLeftColor: borderLeft,
                            background: bg,
                            color: color,
                            padding: '3px 8px',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            lineHeight: 1,
                            position: 'relative',
                            overflow: 'hidden',
                          }}>
                            <Icon size={11} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                            <span style={{ whiteSpace: 'nowrap' }}>
                              {isVacation ? t('leave.type_vacation', 'Vacation') : t('leave.type_sick', 'Sick leave')}
                            </span>

                            <div style={{
                              marginLeft: 'auto',
                              background: '#fff',
                              padding: '1px 5px',
                              borderRadius: 4,
                              fontSize: '0.55rem',
                              fontWeight: 900,
                              color: color,
                              border: `1px solid ${border}`,
                            }}>
                              {req.status.includes('pending') || req.status === 'pending'
                                ? t('leave.pending_short', 'pend.')
                                : t('leave.approved_label', 'Appr.')}
                            </div>
                          </div>
                        );
                      })}
                      {dayReqs.length > MAX_VISIBLE && (
                        <div style={{ fontSize: '0.55rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          +{dayReqs.length - MAX_VISIBLE} {t('common.more', 'more')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hover tooltip for full list */}
                  {isHovered && hasLeaves && (
                    <div style={{ ...summaryHoverCardStyle, right: (idx % 7 > 3) ? 0 : 'auto', left: (idx % 7 > 3) ? 'auto' : 0 }}>
                      {(() => {
                        const vacations = dayReqs.filter(r => r.leaveType === 'vacation');
                        const sickLeaves = dayReqs.filter(r => r.leaveType === 'sick');

                        return (
                          <>
                            {/* Vacation Group */}
                            {vacations.length > 0 && (
                              <div style={{ marginBottom: sickLeaves.length > 0 ? 10 : 0 }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  color: '#1e40af',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  marginBottom: 8,
                                  paddingBottom: 4,
                                  borderBottom: '1px solid rgba(30,64,175,0.1)'
                                }}>
                                  <Palmtree size={13} strokeWidth={2.5} />
                                  <span>{t('leave.type_vacation', 'Vacation')} {vacations.length}</span>
                                </div>
                                {vacations.map((req, vIdx) => (
                                  <div
                                    key={req.id}
                                    style={{
                                      padding: '4px 0',
                                      marginBottom: vIdx === vacations.length - 1 ? 0 : 4,
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                      {renderAvatar(req)}
                                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                                        {req.userName} {req.userSurname}
                                      </span>
                                    </div>
                                    <div style={{ marginTop: 2, paddingLeft: 25, fontSize: '0.56rem', color: 'var(--text-secondary)', lineHeight: 1.25 }}>
                                      {req.storeName ?? t('employees.noStore', 'No store')} {req.companyName ? `• ${req.companyName}` : ''}
                                    </div>
                                    <div style={{ marginTop: 1, paddingLeft: 25, fontSize: '0.56rem', color: 'var(--text-secondary)', lineHeight: 1.25 }}>
                                      {formatDateRange(req.startDate, req.endDate)}
                                    </div>
                                    <div style={{ marginTop: 3, paddingLeft: 25 }}>
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 3,
                                        borderRadius: 999,
                                        border: '1px solid rgba(37,99,235,0.25)',
                                        background: 'rgba(219,234,254,0.6)',
                                        color: '#1e40af',
                                        fontSize: '0.52rem', fontWeight: 800, padding: '1px 7px'
                                      }}>
                                        {formatLeaveStatus(req.status, t)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Sick Leave Group */}
                            {sickLeaves.length > 0 && (
                              <div>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  color: '#92400e',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  marginBottom: 8,
                                  paddingBottom: 4,
                                  borderBottom: '1px solid rgba(146,64,14,0.1)'
                                }}>
                                  <Thermometer size={13} strokeWidth={2.5} />
                                  <span>{t('leave.type_sick', 'Sick leave')} {sickLeaves.length}</span>
                                </div>
                                {sickLeaves.map((req, sIdx) => (
                                  <div
                                    key={req.id}
                                    style={{
                                      padding: '4px 0',
                                      marginBottom: sIdx === sickLeaves.length - 1 ? 0 : 4,
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                      {renderAvatar(req)}
                                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                                        {req.userName} {req.userSurname}
                                      </span>
                                    </div>
                                    <div style={{ marginTop: 2, paddingLeft: 25, fontSize: '0.56rem', color: 'var(--text-secondary)', lineHeight: 1.25 }}>
                                      {req.storeName ?? t('employees.noStore', 'No store')} {req.companyName ? `• ${req.companyName}` : ''}
                                    </div>
                                    <div style={{ marginTop: 1, paddingLeft: 25, fontSize: '0.56rem', color: 'var(--text-secondary)', lineHeight: 1.25 }}>
                                      {formatDateRange(req.startDate, req.endDate)}
                                    </div>
                                    <div style={{ marginTop: 3, paddingLeft: 25 }}>
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 3,
                                        borderRadius: 999,
                                        border: '1px solid rgba(217,119,6,0.25)',
                                        background: 'rgba(254,243,199,0.7)',
                                        color: '#92400e',
                                        fontSize: '0.52rem', fontWeight: 800, padding: '1px 7px'
                                      }}>
                                        {formatLeaveStatus(req.status, t)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: 'var(--text)',
};
