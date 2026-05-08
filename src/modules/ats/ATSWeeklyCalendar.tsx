import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import { Interview } from './atsCalendarUtils';
import InterviewEntry from './InterviewEntry';
import {
  formatDate,
  addDays,
  getHourLabels,
  timeToPosition,
  durationToWidth,
  groupInterviewsByDate,
  sortInterviewsByTime,
  detectConflicts,
  hasConflict,
  todayString,
  isToday,
} from './atsCalendarUtils';

interface ATSWeeklyCalendarProps {
  interviews: Interview[];
  weekStart: Date;
  onInterviewClick: (interview: Interview) => void;
  onSlotClick?: (date: string, time: string) => void;
}

export default function ATSWeeklyCalendar({
  interviews,
  weekStart,
  onInterviewClick,
  onSlotClick,
}: ATSWeeklyCalendarProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';

  const DAY_LABELS = [
    t('shifts.dayMon', 'Mon'),
    t('shifts.dayTue', 'Tue'),
    t('shifts.dayWed', 'Wed'),
    t('shifts.dayThu', 'Thu'),
    t('shifts.dayFri', 'Fri'),
    t('shifts.daySat', 'Sat'),
    t('shifts.daySun', 'Sun'),
  ];

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const hourLabels = getHourLabels();
  const today = todayString();

  // Group interviews by date
  const interviewsByDate = useMemo(() => {
    return groupInterviewsByDate(interviews);
  }, [interviews]);

  // Detect conflicts
  const conflicts = useMemo(() => {
    return detectConflicts(interviews);
  }, [interviews]);

  // Check if there are any interviews this week
  const hasInterviews = interviews.length > 0;

  return (
    <div style={{ overflowX: 'auto', display: 'flex', flexDirection: 'column' }}>
      {!hasInterviews ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <div
            style={{
              marginBottom: 10,
              opacity: 0.25,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <CalendarDays size={32} />
          </div>
          <div style={{ fontWeight: 600 }}>
            {t('ats.noInterviewsThisWeek', 'No interviews scheduled this week')}
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {t('ats.scheduleInterviewHint', 'Schedule interviews from the Candidates tab')}
          </div>
        </div>
      ) : (
        <div style={{ minWidth: 1000, display: 'flex' }}>
          {/* Time column on the left */}
          <div
            style={{
              width: 70,
              flexShrink: 0,
              borderRight: '2px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            {/* Empty space for day headers alignment */}
            <div
              style={{
                height: 70,
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}
            >
              {t('ats.time', 'Time')}
            </div>

            {/* Hour labels */}
            <div style={{ position: 'relative', minHeight: 600 }}>
              {hourLabels.map((h, i) => (
                <div
                  key={h}
                  style={{
                    position: 'absolute',
                    top: `${(i / (hourLabels.length - 1)) * 100}%`,
                    transform: 'translateY(-50%)',
                    width: '100%',
                    textAlign: 'center',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontFamily: 'var(--font-display)',
                    padding: '4px 0',
                  }}
                >
                  {h}
                </div>
              ))}
            </div>
          </div>

          {/* Day columns */}
          <div style={{ flex: 1, display: 'flex' }}>
            {/* Day headers row */}
            <div style={{ position: 'absolute', top: 0, left: 70, right: 0, display: 'flex', borderBottom: '1px solid var(--border)', zIndex: 5 }}>
              {days.map((day, colIdx) => {
                const dateStr = formatDate(day);
                const isTodayCol = dateStr === today;

                return (
                  <div
                    key={dateStr}
                    style={{
                      flex: 1,
                      minWidth: 140,
                      height: 70,
                      padding: '8px',
                      textAlign: 'center',
                      background: isTodayCol ? 'rgba(201,151,58,0.08)' : 'var(--background)',
                      borderRight: colIdx < 6 ? '1px solid var(--border)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      {DAY_LABELS[colIdx]}
                    </div>
                    <div
                      style={{
                        width: isTodayCol ? 32 : 'auto',
                        height: isTodayCol ? 32 : 'auto',
                        borderRadius: isTodayCol ? '50%' : 0,
                        background: isTodayCol ? 'var(--accent)' : 'transparent',
                        color: isTodayCol ? '#fff' : 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        fontWeight: 700,
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {day.getDate()}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      {day.toLocaleDateString(locale, { month: 'short' })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Day columns with time slots */}
            <div style={{ display: 'flex', width: '100%', marginTop: 70 }}>
              {days.map((day, colIdx) => {
                const dateStr = formatDate(day);
                const dayInterviews = sortInterviewsByTime(interviewsByDate.get(dateStr) ?? []);
                const isTodayCol = dateStr === today;

                return (
                  <div
                    key={dateStr}
                    style={{
                      flex: 1,
                      minWidth: 140,
                      borderRight: colIdx < 6 ? '1px solid var(--border)' : 'none',
                      background: isTodayCol ? 'rgba(201,151,58,0.04)' : 'var(--surface)',
                    }}
                  >
                    {/* Time slots with interviews */}
                    <div
                      style={{
                        position: 'relative',
                        minHeight: 600,
                        padding: '8px 4px',
                      }}
                    >
                      {/* Hour grid lines */}
                      {hourLabels.map((_, i) => (
                        <div
                          key={i}
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: `${(i / (hourLabels.length - 1)) * 100}%`,
                            borderTop: '1px solid rgba(0,0,0,0.05)',
                            pointerEvents: 'none',
                          }}
                        />
                      ))}

                      {/* Interview entries */}
                      {dayInterviews.map((interview, idx) => {
                        const top = timeToPosition(interview.scheduledTime);
                        const height = durationToWidth(interview.durationMinutes);
                        const hasConflictFlag = hasConflict(interview.id, conflicts);

                        return (
                          <div
                            key={interview.id}
                            style={{
                              position: 'absolute',
                              left: 4,
                              right: 4,
                              top,
                              minHeight: 40,
                              maxHeight: height,
                              zIndex: 10 + idx,
                            }}
                          >
                            <InterviewEntry
                              interview={interview}
                              variant="weekly"
                              onClick={() => onInterviewClick(interview)}
                              hasConflict={hasConflictFlag}
                            />
                          </div>
                        );
                      })}

                      {/* Empty state for day */}
                      {dayInterviews.length === 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                            fontSize: 11,
                            fontWeight: 600,
                            opacity: 0.4,
                          }}
                        >
                          {t('ats.noInterviews', 'No interviews')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
