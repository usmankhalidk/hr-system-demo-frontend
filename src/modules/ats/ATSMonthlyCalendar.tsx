import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Interview } from '../../api/ats';
import InterviewEntry from './InterviewEntry';
import {
  formatDate,
  getDaysInMonth,
  groupInterviewsByDate,
  sortInterviewsByTime,
  detectConflicts,
  hasConflict,
  todayString,
  fullName,
} from './atsCalendarUtils';
import { getAvatarUrl } from '../../api/client';

interface ATSMonthlyCalendarProps {
  interviews: Interview[];
  currentDate: Date;
  onDayClick: (date: string) => void;
  onInterviewClick: (interview: Interview) => void;
}

const MAX_VISIBLE = 4;

export default function ATSMonthlyCalendar({
  interviews,
  currentDate,
  onDayClick,
  onInterviewClick,
}: ATSMonthlyCalendarProps) {
  const { t } = useTranslation();
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const DAY_LABELS = [
    t('shifts.dayMon', 'Mon'),
    t('shifts.dayTue', 'Tue'),
    t('shifts.dayWed', 'Wed'),
    t('shifts.dayThu', 'Thu'),
    t('shifts.dayFri', 'Fri'),
    t('shifts.daySat', 'Sat'),
    t('shifts.daySun', 'Sun'),
  ];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = todayString();

  // Group interviews by date
  const interviewsByDate = useMemo(() => {
    return groupInterviewsByDate(interviews);
  }, [interviews]);

  // Detect conflicts
  const conflicts = useMemo(() => {
    return detectConflicts(interviews);
  }, [interviews]);

  // Build calendar grid
  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Monday as first day
    const daysInMonthTotal = getDaysInMonth(year, month);

    const cellArray: (Date | null)[] = [
      ...Array(startOffset).fill(null),
      ...Array.from({ length: daysInMonthTotal }, (_, i) => new Date(year, month, i + 1)),
    ];

    // Pad to complete last row
    while (cellArray.length % 7 !== 0) cellArray.push(null);

    return cellArray;
  }, [year, month]);

  return (
    <div style={{ padding: 16, overflowX: 'auto' }}>
      <div style={{ minWidth: 1200 }}>
        {/* Day headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: 4,
            marginBottom: 8,
          }}
        >
          {DAY_LABELS.map((label) => (
            <div
              key={label}
              style={{
                textAlign: 'center',
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: 'var(--primary)',
                padding: '4px 0',
                fontSize: '0.85rem',
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: 4,
          }}
        >
          {cells.map((date, idx) => {
            if (!date) {
              return <div key={`empty-${idx}`} style={{ minHeight: 104 }} />;
            }

            const dateStr = formatDate(date);
            const dayInterviews = sortInterviewsByTime(interviewsByDate.get(dateStr) ?? []);
            const isTodayCell = dateStr === today;
            const isHovered = hoveredDay === dateStr;
            const hasInterviews = dayInterviews.length > 0;

            return (
              <div
                key={dateStr}
                style={{
                  minWidth: 0,
                  minHeight: 92,
                  borderRadius: 6,
                  border: isTodayCell ? '2px solid var(--accent)' : '1px solid var(--border)',
                  padding: 7,
                  cursor: 'pointer',
                  background: isTodayCell ? 'rgba(201, 151, 58, 0.06)' : 'var(--surface)',
                  transition: 'background 0.15s',
                  position: 'relative',
                  boxShadow: hasInterviews ? 'var(--shadow-xs)' : undefined,
                }}
                onMouseEnter={() => setHoveredDay(dateStr)}
                onMouseLeave={() => setHoveredDay(null)}
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    onDayClick(dateStr);
                  }
                }}
              >
                {/* Date number */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                    marginBottom: 6,
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      fontWeight: isTodayCell ? 700 : 500,
                      color: isTodayCell ? 'var(--accent)' : 'var(--text)',
                      fontFamily: 'var(--font-display)',
                      fontSize: '0.9rem',
                      lineHeight: 1,
                    }}
                  >
                    {isTodayCell ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          color: '#fff',
                          fontWeight: 700,
                          boxShadow: '0 0 0 3px rgba(201,151,58,0.16)',
                        }}
                      >
                        {date.getDate()}
                      </span>
                    ) : (
                      date.getDate()
                    )}
                  </div>

                  {/* Interview count badge */}
                  {hasInterviews && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 20,
                        height: 20,
                        borderRadius: 999,
                        background: 'var(--primary)',
                        color: '#fff',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '0 6px',
                      }}
                    >
                      {dayInterviews.length}
                    </div>
                  )}
                </div>

                {/* Interview entries */}
                {hasInterviews && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {dayInterviews.slice(0, MAX_VISIBLE).map((interview) => {
                      const hasConflictFlag = hasConflict(interview.id, conflicts);
                      return (
                        <InterviewEntry
                          key={interview.id}
                          interview={interview}
                          variant="monthly"
                          onClick={() => onInterviewClick(interview)}
                          hasConflict={hasConflictFlag}
                        />
                      );
                    })}
                    {dayInterviews.length > MAX_VISIBLE && (
                      <div
                        style={{
                          fontSize: '0.55rem',
                          fontWeight: 700,
                          color: 'var(--text-secondary)',
                          paddingLeft: 8,
                        }}
                      >
                        +{dayInterviews.length - MAX_VISIBLE} {t('common.more', 'more')}
                      </div>
                    )}
                  </div>
                )}

                {/* Hover tooltip with full list */}
                {isHovered && hasInterviews && (
                  <div
                    style={{
                      position: 'absolute',
                      top: idx >= cells.length - 7 ? 'auto' : 'calc(100% + 4px)',
                      bottom: idx >= cells.length - 7 ? 'calc(100% + 4px)' : 'auto',
                      right: idx % 7 > 3 ? 0 : 'auto',
                      left: idx % 7 > 3 ? 'auto' : 0,
                      minWidth: 240,
                      maxWidth: 320,
                      borderRadius: 10,
                      border: '1px solid rgba(148,163,184,0.44)',
                      background: '#ffffff',
                      boxShadow: '0 14px 36px rgba(15,23,42,0.22)',
                      padding: '10px 12px',
                      zIndex: 100,
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: 8,
                        paddingBottom: 6,
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {dayInterviews.length} {t('ats.interviews', 'Interviews')} •{' '}
                      {date.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>

                    {dayInterviews.map((interview, iIdx) => {
                      const candidateFullName = fullName(
                        interview.candidateName,
                        interview.candidateSurname
                      );
                      const avatarUrl = getAvatarUrl(interview.candidateAvatarFilename);

                      return (
                        <div
                          key={interview.id}
                          style={{
                            padding: '6px 0',
                            marginBottom: iIdx === dayInterviews.length - 1 ? 0 : 6,
                            borderBottom:
                              iIdx === dayInterviews.length - 1
                                ? 'none'
                                : '1px solid rgba(0,0,0,0.05)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={candidateFullName}
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: '1px solid rgba(148,163,184,0.45)',
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: 'linear-gradient(135deg, #1e3a5f, #3a7bd5)',
                                  color: '#fff',
                                  fontSize: '0.6rem',
                                  fontWeight: 800,
                                  border: '1px solid rgba(148,163,184,0.45)',
                                }}
                              >
                                {candidateFullName
                                  .split(' ')
                                  .map((w) => w[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </div>
                            )}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  color: 'var(--text-primary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {candidateFullName}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.62rem',
                                  color: 'var(--text-muted)',
                                  marginTop: 2,
                                }}
                              >
                                {interview.scheduledTime.slice(0, 5)} •{' '}
                                {interview.positionTitle}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
