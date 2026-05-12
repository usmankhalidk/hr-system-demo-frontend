/**
 * ATS Calendar Utilities
 * Helper functions for date calculations, formatting, and calendar logic
 */

import { Interview as APIInterview } from '../../api/ats';

// Extended Interview type for calendar display
export interface Interview extends APIInterview {
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  durationMinutes: number;
}

// ─── Date Formatting ──────────────────────────────────────────────────────────

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatTime(time: string): string {
  return time.slice(0, 5); // HH:mm
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateRange(startDate: string, endDate: string): string {
  return startDate === endDate ? startDate : `${startDate} → ${endDate}`;
}

// ─── Week/Month Calculations ──────────────────────────────────────────────────

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as first day
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

// ─── Time Slot Calculations ───────────────────────────────────────────────────

const START_HOUR = 1; // 01:00
const END_HOUR = 24; // 24:00
const TOTAL_MINS = (END_HOUR - START_HOUR) * 60;

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeToPosition(time: string): string {
  const mins = timeToMinutes(time);
  const percentage = Math.max(0, Math.min(100, ((mins - START_HOUR * 60) / TOTAL_MINS) * 100));
  return `${percentage.toFixed(3)}%`;
}

export function durationToWidth(durationMinutes: number): string {
  const percentage = Math.max(0.5, (durationMinutes / TOTAL_MINS) * 100);
  return `${percentage.toFixed(3)}%`;
}

export function getHourLabels(): string[] {
  return Array.from(
    { length: END_HOUR - START_HOUR + 1 },
    (_, i) => `${String(START_HOUR + i).padStart(2, '0')}:00`
  );
}

// ─── Interview Conflict Detection ─────────────────────────────────────────────

export interface InterviewConflict {
  interviewId: number;
  conflictsWith: number[];
}

export function detectConflicts(interviews: Interview[]): InterviewConflict[] {
  const conflicts: InterviewConflict[] = [];
  const interviewsByInterviewer = new Map<number, Interview[]>();

  // Group by interviewer
  for (const interview of interviews) {
    if (!interview.interviewerId) continue;
    if (interview.status === 'cancelled') continue;

    const list = interviewsByInterviewer.get(interview.interviewerId) ?? [];
    list.push(interview);
    interviewsByInterviewer.set(interview.interviewerId, list);
  }

  // Check for overlaps within each interviewer's schedule
  for (const [_, interviewerInterviews] of interviewsByInterviewer) {
    for (let i = 0; i < interviewerInterviews.length; i++) {
      const interview1 = interviewerInterviews[i];
      const start1 = timeToMinutes(interview1.scheduledTime);
      const end1 = start1 + interview1.durationMinutes;

      const conflictsWith: number[] = [];

      for (let j = i + 1; j < interviewerInterviews.length; j++) {
        const interview2 = interviewerInterviews[j];
        
        // Must be same date
        if (interview1.scheduledDate !== interview2.scheduledDate) continue;

        const start2 = timeToMinutes(interview2.scheduledTime);
        const end2 = start2 + interview2.durationMinutes;

        // Check for overlap
        if (start1 < end2 && start2 < end1) {
          conflictsWith.push(interview2.id);
        }
      }

      if (conflictsWith.length > 0) {
        conflicts.push({
          interviewId: interview1.id,
          conflictsWith,
        });
      }
    }
  }

  return conflicts;
}

export function hasConflict(interviewId: number, conflicts: InterviewConflict[]): boolean {
  return conflicts.some(
    (c) => c.interviewId === interviewId || c.conflictsWith.includes(interviewId)
  );
}

// ─── Filter Logic ─────────────────────────────────────────────────────────────

export interface InterviewFilter {
  positionId: number | null;
  interviewerId: number | null;
}

export function applyFilters(interviews: Interview[], filters: InterviewFilter): Interview[] {
  let filtered = interviews;

  if (filters.positionId !== null) {
    filtered = filtered.filter((i) => i.positionId === filters.positionId);
  }

  if (filters.interviewerId !== null) {
    filtered = filtered.filter((i) => i.interviewerId === filters.interviewerId);
  }

  return filtered;
}

export function getActiveFilterCount(filters: InterviewFilter): number {
  let count = 0;
  if (filters.positionId !== null) count++;
  if (filters.interviewerId !== null) count++;
  return count;
}

// ─── Color Schemes ────────────────────────────────────────────────────────────

export const INTERVIEW_STATUS_COLORS = {
  scheduled: {
    bg: 'rgba(219,234,254,0.76)',
    border: '#2563eb',
    text: '#1e40af',
    leftBorder: '#2563eb',
  },
  completed: {
    bg: 'rgba(220,252,231,0.76)',
    border: '#16a34a',
    text: '#15803d',
    leftBorder: '#16a34a',
  },
  cancelled: {
    bg: 'rgba(254,226,226,0.76)',
    border: '#dc2626',
    text: '#991b1b',
    leftBorder: '#dc2626',
  },
  rescheduled: {
    bg: 'rgba(254,243,199,0.78)',
    border: '#d97706',
    text: '#92400e',
    leftBorder: '#d97706',
  },
} as const;

export const CONFLICT_COLORS = {
  bg: 'rgba(251,191,36,0.12)',
  border: '#f59e0b',
  text: '#92400e',
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function initials(name: string, surname: string): string {
  const n = (name ?? '').trim();
  const s = (surname ?? '').trim();
  if (!n && !s) return 'U';
  if (!s) return n.slice(0, 1).toUpperCase();
  return `${n.slice(0, 1)}${s.slice(0, 1)}`.toUpperCase();
}

export function fullName(name: string, surname: string): string {
  return `${name ?? ''} ${surname ?? ''}`.trim() || 'Unknown';
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
  return `${hours}h ${mins}m`;
}

export function todayString(): string {
  return formatDate(new Date());
}

export function isToday(dateStr: string): boolean {
  return dateStr === todayString();
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return formatDate(date1) === formatDate(date2);
}

// ─── Interview Grouping ───────────────────────────────────────────────────────

export function groupInterviewsByDate(interviews: Interview[]): Map<string, Interview[]> {
  const grouped = new Map<string, Interview[]>();
  
  for (const interview of interviews) {
    const dateKey = interview.scheduledDate;
    const list = grouped.get(dateKey) ?? [];
    list.push(interview);
    grouped.set(dateKey, list);
  }

  return grouped;
}

export function sortInterviewsByTime(interviews: Interview[]): Interview[] {
  return [...interviews].sort((a, b) => {
    const timeA = timeToMinutes(a.scheduledTime);
    const timeB = timeToMinutes(b.scheduledTime);
    return timeA - timeB;
  });
}
