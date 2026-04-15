import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, Clock3, Moon, Palmtree, Store, Thermometer, Users } from 'lucide-react';
import { Shift } from '../../api/shifts';
import { LeaveBlock } from '../../api/leave';
import { TransferAssignment } from '../../api/transfers';
import { getAvatarUrl } from '../../api/client';

interface MonthlyCalendarProps {
  shifts: Shift[];
  currentDate: Date;
  onDayClick: (date: string) => void;
  leaveBlocks?: LeaveBlock[];
  transferBlocks?: TransferAssignment[];
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addUserToDateSet(map: Map<string, Set<number>>, dateKey: string, userId: number): void {
  const set = map.get(dateKey) ?? new Set<number>();
  set.add(userId);
  map.set(dateKey, set);
}

function initialsFromName(fullName: string): string {
  const parts = fullName.split(' ').filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

export default function MonthlyCalendar({ shifts, currentDate, onDayClick, leaveBlocks, transferBlocks }: MonthlyCalendarProps) {
  const { t } = useTranslation();
  const MAX_VISIBLE_AVATARS = 4;
  const DAY_LABELS = [
    t('shifts.dayMon', 'Lun'),
    t('shifts.dayTue', 'Mar'),
    t('shifts.dayWed', 'Mer'),
    t('shifts.dayThu', 'Gio'),
    t('shifts.dayFri', 'Ven'),
    t('shifts.daySat', 'Sab'),
    t('shifts.daySun', 'Dom'),
  ];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Build monthly aggregates per date.
  const shiftCountMap = new Map<string, number>();
  const storesByDate = new Map<string, Set<number>>();
  const employeesByDate = new Map<string, Set<number>>();
  const offDayUsersByDate = new Map<string, Set<number>>();
  const scheduledUsersByDate = new Map<string, Map<number, { fullName: string; avatarFilename: string | null }>>();
  for (const shift of shifts) {
    const dateKey = shift.date.split('T')[0];
    if (shift.isOffDay) {
      addUserToDateSet(offDayUsersByDate, dateKey, shift.userId);
      continue;
    }
    if (shift.status !== 'cancelled') {
      shiftCountMap.set(dateKey, (shiftCountMap.get(dateKey) ?? 0) + 1);
      addUserToDateSet(employeesByDate, dateKey, shift.userId);
      const stores = storesByDate.get(dateKey) ?? new Set<number>();
      stores.add(shift.storeId);
      storesByDate.set(dateKey, stores);

      const users = scheduledUsersByDate.get(dateKey) ?? new Map<number, { fullName: string; avatarFilename: string | null }>();
      const existingUser = users.get(shift.userId);
      const fullName = `${shift.userName ?? ''} ${shift.userSurname ?? ''}`.trim() || `${t('shifts.employee', 'Employee')} ${shift.userId}`;
      if (existingUser) {
        if (!existingUser.avatarFilename && shift.userAvatarFilename) {
          existingUser.avatarFilename = shift.userAvatarFilename;
          users.set(shift.userId, existingUser);
        }
      } else {
        users.set(shift.userId, {
          fullName,
          avatarFilename: shift.userAvatarFilename ?? null,
        });
      }
      scheduledUsersByDate.set(dateKey, users);
    }
  }

  // Build approved leave user maps: date → distinct users on approved vacation/sick.
  const approvedVacationUsersByDate = new Map<string, Set<number>>();
  const approvedSickUsersByDate = new Map<string, Set<number>>();
  if (leaveBlocks) {
    for (const lb of leaveBlocks) {
      const normalizedStatus = String(lb.status ?? '').toLowerCase().replace(/\s+/g, '_');
      const isApproved = normalizedStatus === 'hr_approved' || normalizedStatus === 'approved';
      if (!isApproved) continue;

      const start = new Date(lb.startDate + 'T12:00:00');
      const end   = new Date(lb.endDate   + 'T12:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = formatDate(d);
        if (lb.leaveType === 'vacation') {
          addUserToDateSet(approvedVacationUsersByDate, key, lb.userId);
        } else {
          addUserToDateSet(approvedSickUsersByDate, key, lb.userId);
        }
      }
    }
  }

  interface TransferDayCounts {
    active: number;
    completed: number;
    cancelled: number;
  }
  const transferMap = new Map<string, TransferDayCounts>();
  if (transferBlocks) {
    for (const tb of transferBlocks) {
      const start = new Date(tb.startDate + 'T12:00:00');
      const end = new Date(tb.endDate + 'T12:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = formatDate(d);
        const existing = transferMap.get(key) ?? { active: 0, completed: 0, cancelled: 0 };
        if (tb.status === 'completed') existing.completed += 1;
        else if (tb.status === 'cancelled') existing.cancelled += 1;
        else existing.active += 1;
        transferMap.set(key, existing);
      }
    }
  }

  // First day of month (0=Sun … 6=Sat), convert to Mon-based (0=Mon … 6=Sun)
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = (firstDay === 0 ? 6 : firstDay - 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const today = formatDate(new Date());

  return (
    <div style={{ padding: 16 }}>
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
          const shiftCount = shiftCountMap.get(dateStr) ?? 0;
          const storeCount = storesByDate.get(dateStr)?.size ?? 0;
          const employeeCount = employeesByDate.get(dateStr)?.size ?? 0;
          const offDayUserCount = offDayUsersByDate.get(dateStr)?.size ?? 0;
          const vacationApprovedUsers = approvedVacationUsersByDate.get(dateStr)?.size ?? 0;
          const sickApprovedUsers = approvedSickUsersByDate.get(dateStr)?.size ?? 0;
          const usersForDay = Array.from(scheduledUsersByDate.get(dateStr)?.values() ?? []);
          const visibleUsers = usersForDay.slice(0, MAX_VISIBLE_AVATARS);
          const transferCounts = transferMap.get(dateStr) ?? { active: 0, completed: 0, cancelled: 0 };
          const transferCount = transferCounts.active + transferCounts.completed + transferCounts.cancelled;
          const isToday = dateStr === today;
          const hasTransfer = transferCount > 0;
          const hasStoreShiftSummary = storeCount > 0 || shiftCount > 0;
          const hasSummaryTags = hasTransfer || vacationApprovedUsers > 0 || sickApprovedUsers > 0 || offDayUserCount > 0;

          return (
            <div
              key={dateStr}
              onClick={() => onDayClick(dateStr)}
              style={{
                minHeight: 92,
                borderRadius: 6,
                border: isToday ? '2px solid var(--accent)' : '1px solid var(--border)',
                padding: 7,
                cursor: 'pointer',
                background: isToday ? 'rgba(201, 151, 58, 0.06)' : 'var(--surface)',
                transition: 'background 0.15s',
                boxShadow: (shiftCount > 0 || vacationApprovedUsers > 0 || sickApprovedUsers > 0 || offDayUserCount > 0 || hasTransfer)
                  ? 'var(--shadow-xs)'
                  : undefined,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--background)')}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isToday ? 'rgba(201, 151, 58, 0.06)' : 'var(--surface)';
              }}
            >
              <div style={{
                fontWeight: isToday ? 700 : 500,
                color: isToday ? 'var(--accent)' : 'var(--text)',
                fontFamily: 'var(--font-display)',
                marginBottom: 6,
                fontSize: '0.9rem',
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

              {hasStoreShiftSummary && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  borderRadius: 5,
                  border: '1px solid rgba(58,123,213,0.34)',
                  borderLeft: '3px solid #1e4a7a',
                  background: 'linear-gradient(135deg, rgba(30,74,122,0.14), rgba(13,33,55,0.08))',
                  padding: '3px 6px',
                }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    borderRadius: 4,
                    color: '#12345a',
                    padding: '0 2px',
                    fontSize: '0.64rem',
                    fontWeight: 800,
                    lineHeight: 1.2,
                  }} title={t('shifts.monthlyStores', 'Stores')}>
                    <Store size={10} strokeWidth={2.4} />
                    {t('shifts.monthlyStores', 'Stores')} {storeCount}
                  </span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    borderRadius: 4,
                    border: '1px solid rgba(58,123,213,0.55)',
                    background: 'linear-gradient(135deg, #1E4A7A, #0D2137)',
                    color: '#f8fbff',
                    padding: '2px 7px',
                    fontSize: '0.64rem',
                    fontWeight: 800,
                    lineHeight: 1.2,
                  }}
                  title={t('shifts.shiftCountPlural', 'Shifts')}
                  >
                    <Clock3 size={10} strokeWidth={2.4} />
                    {t('shifts.shiftCountPlural', 'Shifts')} {shiftCount}
                  </span>
                </div>
              )}

              {employeeCount > 0 && (
                <div style={{ marginTop: 5, minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: '0.63rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.2,
                    textTransform: 'uppercase',
                    letterSpacing: 0.2,
                  }}>
                    <Users size={10} strokeWidth={2.4} />
                    {t('shifts.monthlyEmployees', 'Employees')}
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: 999,
                      border: '1px solid rgba(100,116,139,0.34)',
                      background: 'rgba(248,250,252,0.94)',
                      color: '#334155',
                      padding: '1px 6px',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      lineHeight: 1.2,
                    }}>
                      {employeeCount}
                    </span>
                  </span>

                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', marginLeft: 'auto' }}>
                    {visibleUsers.map((user, index) => {
                      const avatarUrl = getAvatarUrl(user.avatarFilename);
                      const initials = initialsFromName(user.fullName);
                      return (
                        <div
                          key={`${user.fullName}-${index}`}
                          title={user.fullName}
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            marginLeft: index === 0 ? 0 : -8,
                            border: '1.5px solid #fff',
                            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                            color: '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.56rem',
                            fontWeight: 800,
                            boxShadow: '0 1px 2px rgba(15,23,42,0.16)',
                            zIndex: 20 - index,
                          }}
                        >
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={user.fullName}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : initials}
                        </div>
                      );
                    })}

                    {employeeCount > MAX_VISIBLE_AVATARS && (
                      <span
                        title={t('shifts.monthlyEmployeesOverflow', 'More employees')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginLeft: visibleUsers.length > 0 ? -8 : 0,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          border: '1.5px solid #fff',
                          background: 'linear-gradient(135deg, rgba(15,23,42,0.78), rgba(51,65,85,0.76))',
                          color: '#e2e8f0',
                          fontSize: '0.54rem',
                          fontWeight: 900,
                          lineHeight: 1,
                          boxShadow: '0 1px 2px rgba(15,23,42,0.16)',
                          zIndex: 30,
                        }}
                      >
                        4+
                      </span>
                    )}
                  </div>
                </div>
              )}

              {hasSummaryTags && (
                <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {hasTransfer && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      borderRadius: 6,
                      border: '1px solid rgba(30,64,175,0.28)',
                      borderLeft: '3px solid #1e40af',
                      background: 'rgba(239,246,255,0.92)',
                      color: '#1e40af',
                      padding: '1px 6px',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      lineHeight: 1.2,
                    }} title={t('shifts.monthlyTransfers', 'Transfers')}>
                      <ArrowLeftRight size={9} strokeWidth={2.5} />
                      {t('shifts.monthlyTransfers', 'Transfers')} {transferCount}
                    </span>
                  )}
                  {vacationApprovedUsers > 0 && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      borderRadius: 6,
                      border: '1px solid rgba(37,99,235,0.22)',
                      borderLeft: '3px solid #2563eb',
                      background: 'rgba(219,234,254,0.76)',
                      color: '#1e40af',
                      padding: '1px 6px',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      lineHeight: 1.2,
                    }} title={t('leave.type_vacation', 'Vacation')}>
                      <Palmtree size={9} strokeWidth={2.4} />
                      {t('leave.type_vacation', 'Vacation')} {vacationApprovedUsers}
                    </span>
                  )}
                  {sickApprovedUsers > 0 && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      borderRadius: 6,
                      border: '1px solid rgba(217,119,6,0.22)',
                      borderLeft: '3px solid #d97706',
                      background: 'rgba(254,243,199,0.78)',
                      color: '#92400e',
                      padding: '1px 6px',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      lineHeight: 1.2,
                    }} title={t('leave.type_sick', 'Leave')}>
                      <Thermometer size={9} strokeWidth={2.4} />
                      {t('leave.type_sick', 'Leave')} {sickApprovedUsers}
                    </span>
                  )}
                  {offDayUserCount > 0 && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      borderRadius: 6,
                      border: '1px solid rgba(100,116,139,0.24)',
                      borderLeft: '3px solid #64748b',
                      background: 'rgba(241,245,249,0.92)',
                      color: '#475569',
                      padding: '1px 6px',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      lineHeight: 1.2,
                    }} title={t('shifts.form.offDay', 'Off day')}>
                      <Moon size={9} strokeWidth={2.4} />
                      {t('shifts.form.offDay', 'Off day')} {offDayUserCount}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
