import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Palmtree, Thermometer, X, CheckCheck, XCircle, FileText, Clock } from 'lucide-react';
import { getLeaveRequests, LeaveRequest, approveLeaveRequest, rejectLeaveRequest, downloadCertificate } from '../../api/leave';
import { getAvatarUrl } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatusBadge, ApprovalStepper } from './LeaveApprovalList';
import { translateApiError } from '../../utils/apiErrors';

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

export default function LeaveCalendar({ onDayClick, onRefresh }: { onDayClick?: (date: string) => void; onRefresh?: () => void }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  
  // Details Modal State
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

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

  const handleApprove = async (req: LeaveRequest) => {
    setActionLoading(true);
    try {
      await approveLeaveRequest(req.id);
      showToast(t('leave.approved_success'), 'success');
      setSelectedRequest(null);
      fetchData();
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      showToast(translateApiError(err, t, t('common.error_generic')) ?? t('common.error_generic'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!rejectNotes.trim()) {
      setRejectError(t('leave.reject_notes_required'));
      return;
    }
    setActionLoading(true);
    try {
      await rejectLeaveRequest(rejectTarget.id, rejectNotes);
      showToast(t('leave.rejected_success'), 'success');
      setRejectTarget(null);
      setSelectedRequest(null);
      fetchData();
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      setRejectError(translateApiError(err, t, t('common.error_generic')) ?? t('common.error_generic'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadCert = async (req: LeaveRequest) => {
    try {
      const blob = await downloadCertificate(req.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = req.medicalCertificateName ?? 'certificato-medico';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast(t('leave.certificate_download_error'), 'error');
    }
  };

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

  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = (firstDay === 0 ? 6 : firstDay - 1);
  const daysInMonthTotal = daysInMonth(year, month);

  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonthTotal }, (_, i) => new Date(year, month, i + 1)),
  ];
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

  const renderAvatar = (req: LeaveRequest, size = 18): React.ReactNode => {
    const avatarUrl = getAvatarUrl(req.userAvatarFilename);
    const initialsStr = initials(req.userName, req.userSurname);
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt=""
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(148,163,184,0.45)' }}
        />
      );
    }
    return (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e3a5f, #3a7bd5)',
          color: '#fff',
          fontSize: size <= 20 ? '0.52rem' : '0.8rem',
          fontWeight: 800,
          border: '1px solid rgba(148,163,184,0.45)',
        }}
      >
        {initialsStr}
      </span>
    );
  };

  const effectiveApproverRole = user?.role === 'admin' ? 'admin' : user?.role;
  const canAct = (req: LeaveRequest) => {
    return req.status !== 'approved' &&
      !req.status.includes('rejected') &&
      req.status !== 'cancelled' &&
      !!effectiveApproverRole &&
      (user?.role === 'admin' || (user?.role === 'hr' && req.status !== 'HR approved') || req.currentApproverRole === effectiveApproverRole);
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
        <div style={{ padding: 0, overflowX: 'auto' }}>
          <div style={{ minWidth: 1200 }}>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 8 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
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
                    minWidth: 0,
                    minHeight: 92,
                    borderRadius: 6,
                    border: isToday ? '2px solid var(--accent)' : '1px solid var(--border)',
                    padding: 7,
                    cursor: 'pointer',
                    background: isToday ? 'rgba(201, 151, 58, 0.06)' : 'var(--surface)',
                    transition: 'background 0.15s',
                    position: 'relative',
                    boxShadow: hasLeaves ? 'var(--shadow-xs)' : undefined,
                  }}
                  onMouseEnter={() => {
                    setHoveredDay(dateStr);
                  }}
                  onMouseLeave={() => {
                    setHoveredDay(null);
                  }}
                  onClick={(e) => {
                    // Only open day click if we didn't click a specific leave item
                    if (e.target === e.currentTarget && onDayClick) {
                      onDayClick(dateStr);
                    }
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                    marginBottom: 6,
                    pointerEvents: 'none',
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
                          <div 
                            key={req.id} 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRequest(req);
                            }}
                            style={{
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
                              cursor: 'pointer',
                              transition: 'transform 0.1s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                          >
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
                    <div style={{ 
                      ...summaryHoverCardStyle, 
                      top: idx >= cells.length - 7 ? 'auto' : 'calc(100% + 4px)',
                      bottom: idx >= cells.length - 7 ? 'calc(100% + 4px)' : 'auto',
                      right: (idx % 7 > 3) ? 0 : 'auto', 
                      left: (idx % 7 > 3) ? 'auto' : 0 
                    }}>
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedRequest(req);
                                    }}
                                    style={{
                                      padding: '4px 0',
                                      marginBottom: vIdx === vacations.length - 1 ? 0 : 4,
                                      cursor: 'pointer',
                                      borderRadius: 4,
                                      transition: 'background 0.1s',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedRequest(req);
                                    }}
                                    style={{
                                      padding: '4px 0',
                                      marginBottom: sIdx === sickLeaves.length - 1 ? 0 : 4,
                                      cursor: 'pointer',
                                      borderRadius: 4,
                                      transition: 'background 0.1s',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
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
        </div>
      )}

      {/* Details Modal */}
      {selectedRequest && (
        <div 
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setSelectedRequest(null)}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }} />
          <div 
            style={{ 
              position: 'relative', width: '100%', maxWidth: 460, 
              background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {renderAvatar(selectedRequest, 36)}
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{selectedRequest.userName} {selectedRequest.userSurname}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedRequest.userRole ? t(`roles.${selectedRequest.userRole}`, selectedRequest.userRole) : ''}</div>
                </div>
              </div>
              <button onClick={() => setSelectedRequest(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <label style={modalLabelStyle}>{t('leave.type_label')}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    {selectedRequest.leaveType === 'vacation' ? <Palmtree size={16} /> : <Thermometer size={16} />}
                    {t(`leave.type_${selectedRequest.leaveType}`)}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={modalLabelStyle}>{t('leave.col_status')}</label>
                  <StatusBadge req={selectedRequest} />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={modalLabelStyle}>{t('leave.col_period')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  <Clock size={16} />
                  {selectedRequest.leaveDurationType === 'short_leave'
                    ? `${formatDate(new Date(selectedRequest.startDate))} · ${selectedRequest.shortStartTime ?? '--:--'} - ${selectedRequest.shortEndTime ?? '--:--'}`
                    : formatDateRange(selectedRequest.startDate, selectedRequest.endDate)}
                </div>
              </div>

              {selectedRequest.notes && (
                <div style={{ marginBottom: 20 }}>
                  <label style={modalLabelStyle}>{t('leave.notes_label')}</label>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{selectedRequest.notes}"</div>
                </div>
              )}

              {selectedRequest.medicalCertificateName && (
                <div style={{ marginBottom: 20 }}>
                  <button 
                    onClick={() => handleDownloadCert(selectedRequest)}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: 8, 
                      padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--surface-warm)', color: 'var(--primary)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    <FileText size={16} />
                    {t('leave.certificate_btn')}
                  </button>
                </div>
              )}

              <div style={{ background: 'var(--background)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.5px' }}>
                  {t('leave.approval_chain', 'Approval Flow')}
                </div>
                <ApprovalStepper req={selectedRequest} />
              </div>

              {canAct(selectedRequest) && (
                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button
                    onClick={() => handleApprove(selectedRequest)}
                    disabled={actionLoading}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '12px 0', borderRadius: 10, border: 'none',
                      background: 'var(--primary)', color: '#fff',
                      fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(13,33,55,0.2)'
                    }}
                  >
                    <CheckCheck size={18} />
                    {t('leave.action_approve')}
                  </button>
                  <button
                    onClick={() => setRejectTarget(selectedRequest)}
                    disabled={actionLoading}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '12px 0', borderRadius: 10, border: '1.5px solid var(--danger)',
                      background: 'transparent', color: 'var(--danger)',
                      fontSize: 14, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    <XCircle size={18} />
                    {t('leave.action_reject')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <div 
          style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setRejectTarget(null)}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }} />
          <div 
            style={{ 
              position: 'relative', width: '100%', maxWidth: 380, 
              background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', padding: 24 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{t('leave.reject_title')}</h3>
            <textarea
              autoFocus
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={3}
              placeholder={t('leave.reject_notes_placeholder')}
              style={{
                width: '100%', padding: '12px', borderRadius: 8, border: '1.5px solid var(--border)',
                fontFamily: 'inherit', fontSize: 14, resize: 'vertical', boxSizing: 'border-box'
              }}
            />
            {rejectError && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{rejectError}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setRejectTarget(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
              <button 
                onClick={handleReject} 
                disabled={actionLoading}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                {actionLoading ? t('common.saving') : t('leave.reject_confirm')}
              </button>
            </div>
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

const modalLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6
};
