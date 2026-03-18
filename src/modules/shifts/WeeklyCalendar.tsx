import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shift } from '../../api/shifts';

interface WeeklyCalendarProps {
  shifts: Shift[];
  weekStart: Date;
  onShiftClick: (shift: Shift) => void;
  onCellClick: (userId: number, date: string) => void;
  canEdit: boolean;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

const DAY_LABELS_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'var(--primary)',
  confirmed:  '#2e7d32',
  cancelled:  '#b71c1c',
};

export default function WeeklyCalendar({
  shifts,
  weekStart,
  onShiftClick,
  onCellClick,
  canEdit,
}: WeeklyCalendarProps) {
  const { t } = useTranslation();

  // Build 7 day columns
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Group shifts by user then by date
  const userMap = new Map<number, { name: string; surname: string; shifts: Map<string, Shift[]> }>();
  for (const shift of shifts) {
    if (!userMap.has(shift.user_id)) {
      userMap.set(shift.user_id, {
        name: shift.user_name,
        surname: shift.user_surname,
        shifts: new Map(),
      });
    }
    const entry = userMap.get(shift.user_id)!;
    const existing = entry.shifts.get(shift.date) ?? [];
    entry.shifts.set(shift.date, [...existing, shift]);
  }

  const users = Array.from(userMap.entries()).sort((a, b) =>
    a[1].surname.localeCompare(b[1].surname)
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: 'var(--font-body)',
        fontSize: '0.85rem',
      }}>
        <thead>
          <tr style={{ background: 'var(--primary)', color: '#fff' }}>
            <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: 140 }}>
              {t('shifts.employee', 'Dipendente')}
            </th>
            {days.map((day, i) => (
              <th key={i} style={{ padding: '10px 8px', textAlign: 'center', minWidth: 110 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                  {DAY_LABELS_IT[i]}
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                  {day.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                {t('shifts.noShiftsThisWeek', 'Nessun turno questa settimana')}
              </td>
            </tr>
          ) : (
            users.map(([userId, userData], rowIdx) => (
              <tr key={userId} style={{ background: rowIdx % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                <td style={{ padding: '8px 12px', fontWeight: 500, borderRight: '1px solid var(--border)' }}>
                  {userData.surname} {userData.name}
                </td>
                {days.map((day, colIdx) => {
                  const dateStr = formatDate(day);
                  const dayShifts = userData.shifts.get(dateStr) ?? [];
                  return (
                    <td
                      key={colIdx}
                      style={{
                        padding: 4,
                        verticalAlign: 'top',
                        borderRight: '1px solid var(--border)',
                        borderBottom: '1px solid var(--border)',
                        cursor: canEdit ? 'pointer' : 'default',
                        minHeight: 60,
                      }}
                      onClick={() => canEdit && dayShifts.length === 0 && onCellClick(userId, dateStr)}
                    >
                      {dayShifts.map((shift) => (
                        <div
                          key={shift.id}
                          onClick={(e) => { e.stopPropagation(); onShiftClick(shift); }}
                          style={{
                            background: STATUS_COLORS[shift.status] ?? 'var(--primary)',
                            color: '#fff',
                            borderRadius: 4,
                            padding: '3px 6px',
                            marginBottom: 2,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            opacity: shift.status === 'cancelled' ? 0.5 : 1,
                          }}
                        >
                          {shift.start_time}–{shift.end_time}
                          {shift.shift_hours && (
                            <span style={{ marginLeft: 4, opacity: 0.85 }}>
                              ({shift.shift_hours}h)
                            </span>
                          )}
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
