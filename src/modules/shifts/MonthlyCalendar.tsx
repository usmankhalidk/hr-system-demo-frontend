import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shift } from '../../api/shifts';

interface MonthlyCalendarProps {
  shifts: Shift[];
  currentDate: Date;
  onDayClick: (date: string) => void;
}

const DAY_LABELS_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function MonthlyCalendar({ shifts, currentDate, onDayClick }: MonthlyCalendarProps) {
  const { t } = useTranslation();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Build shift count map by date
  const countMap = new Map<string, number>();
  for (const shift of shifts) {
    if (shift.status !== 'cancelled') {
      countMap.set(shift.date, (countMap.get(shift.date) ?? 0) + 1);
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
        {DAY_LABELS_IT.map((label) => (
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
            return <div key={`empty-${idx}`} style={{ minHeight: 80 }} />;
          }
          const dateStr = formatDate(date);
          const count = countMap.get(dateStr) ?? 0;
          const isToday = dateStr === today;

          return (
            <div
              key={dateStr}
              onClick={() => onDayClick(dateStr)}
              style={{
                minHeight: 80,
                borderRadius: 6,
                border: isToday ? '2px solid var(--accent)' : '1px solid var(--border)',
                padding: 6,
                cursor: 'pointer',
                background: isToday ? 'rgba(201, 151, 58, 0.05)' : 'var(--surface)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = isToday ? 'rgba(201, 151, 58, 0.05)' : 'var(--surface)')}
            >
              <div style={{
                fontWeight: isToday ? 700 : 500,
                color: isToday ? 'var(--accent)' : 'var(--text)',
                fontFamily: 'var(--font-display)',
                marginBottom: 4,
                fontSize: '0.9rem',
              }}>
                {date.getDate()}
              </div>
              {count > 0 && (
                <div style={{
                  background: 'var(--primary)',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '2px 6px',
                  fontSize: '0.75rem',
                  display: 'inline-block',
                }}>
                  {count} {t('shifts.shiftCount', count === 1 ? 'turno' : 'turni')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
