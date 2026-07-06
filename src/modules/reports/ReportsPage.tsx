import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TimePicker } from '../../components/ui/TimePicker';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Company } from '../../types';
import { getCompanies } from '../../api/companies';
import {
  getReportConfigurations,
  saveReportConfiguration,
  downloadLastReport,
  getReportHistory,
  downloadArchivedReport,
  ReportHistoryItem
} from '../../api/reports';

// Phase 4: Automated Reports Management
// Configure, schedule, preview and download automated PDF reports

interface ReportData {
  id: string;
  status: 'attivo' | 'sospeso' | 'errore';
  recipients: string[];
  sections: string[];
  roles: string[];
  color: string;
  runCount: number;
  lastSize: string;
  nextRun: string;
  lastGenerated: string | null;
  day?: number;
  time?: string; // HH:MM
}

function isMonthlyDayBasedReport(reportId: string): boolean {
  return false;
}

function getClampedMonthDay(year: number, monthIndex: number, targetDay: number): number {
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(Math.max(targetDay, 1), lastDayOfMonth);
}

function getMonthlyDayLabel(day: number, lang: string): string {
  return lang === 'it' ? `Giorno ${day}` : `Day ${day}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatExecutionTime(dateStr: string | null, lang: string, isAnomalyDaily?: boolean): string {
  if (!dateStr) {
    return lang === 'it' ? 'Mai generato' : 'Never generated';
  }
  // If the string is already custom-formatted (e.g. contains ' ·'), return it directly
  if (dateStr.includes(' ·') || dateStr.includes(', ')) {
    return dateStr;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return dateStr;
  }
  if (isAnomalyDaily) {
    return formatAnomalyDailyDate(date, lang);
  }
  const formatter = new Intl.DateTimeFormat(lang, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return formatter.format(date).replace(',', ' ·');
}

function getNextExecution(day: number, time: string, lang: string, reportId?: string): string {
  if (!day || !time) return '--/--/---- · --:--';
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const next = new Date(now);
  if (isMonthlyDayBasedReport(reportId || '')) {
    next.setFullYear(now.getFullYear(), now.getMonth(), getClampedMonthDay(now.getFullYear(), now.getMonth(), day));
    next.setHours(hours, minutes, 0, 0);
    if (next.getTime() <= now.getTime()) {
      const nextMonth = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
      const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
      next.setFullYear(nextYear, nextMonth, getClampedMonthDay(nextYear, nextMonth, day));
      next.setHours(hours, minutes, 0, 0);
    }
  } else {
    next.setHours(hours, minutes, 0, 0);
  }

  if (!isMonthlyDayBasedReport(reportId || '')) {
    const todayWeekday = now.getDay() === 0 ? 7 : now.getDay();
    let daysUntil = (day - todayWeekday + 7) % 7;
    if (daysUntil === 0 && next.getTime() <= now.getTime()) {
      daysUntil = 7;
    }
    next.setDate(now.getDate() + daysUntil);
  }

  const formatter = new Intl.DateTimeFormat(lang, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return formatter.format(next).replace(',', ' ·');
}

function formatAnomalyDailyDate(date: Date, lang: string): string {
  const isIt = lang === 'it';
  const weekdaysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdaysIt = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const dayName = isIt ? weekdaysIt[date.getDay()] : weekdaysEn[date.getDay()];

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();

  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const formattedTime = `${String(h12).padStart(2, '0')}:${m} ${ampm}`;

  return `${dayName} · ${dd}/${mm}/${yyyy}, ${formattedTime}`;
}

function getNextExecutionAnomalyDaily(time: string, lang: string): string {
  if (!time) return '--/--/---- · --:--';
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();

  let checkDate = new Date(now);
  checkDate.setHours(hours, minutes, 0, 0);

  if (checkDate.getTime() <= now.getTime()) {
    checkDate.setDate(checkDate.getDate() + 1);
  }

  return formatAnomalyDailyDate(checkDate, lang);
}

const INITIAL_REPORTS_DATA: ReportData[] = [
  {
    id: 'hr_weekly',
    nextRun: 'Lun 28/04/2026 · 07:00',
    lastGenerated: null,
    lastSize: '1.2 MB',
    status: 'attivo',
    recipients: [],
    sections: ['Riepilogo presenze', 'Anomalie rilevate', 'Turni confermati', 'Richieste ferie', 'Onboarding in corso'],
    roles: ['hr', 'admin'],
    color: '#0284C7',
    runCount: 0,
    day: 1,
    time: '07:00',
  },
  {
    id: 'admin_monthly',
    nextRun: '01/05/2026 · 07:00',
    lastGenerated: '01/04/2026 · 07:05',
    lastSize: '3.8 MB',
    status: 'attivo',
    recipients: [],
    sections: ['KPI', 'Employees', 'ATS', 'Onboarding in process', 'Shift coverage', 'Contract deadlines'],
    roles: ['admin'],
    color: '#C9973A',
    runCount: 4,
    day: 1,
    time: '07:00',
  },
  {
    id: 'hr_monthly',
    nextRun: '01/05/2026 · 08:00',
    lastGenerated: '01/04/2026 · 08:03',
    lastSize: '2.1 MB',
    status: 'attivo',
    recipients: [],
    sections: ['Variazioni organico', 'Ferie & permessi', 'Scadenze formazioni', 'Scadenze visite mediche', 'Contratti in scadenza'],
    roles: ['hr', 'admin'],
    color: '#7C3AED',
    runCount: 4,
    day: 1,
    time: '08:00',
  },
  {
    id: 'anomaly_daily',
    nextRun: 'Dom 28/04/2026 · 08:00',
    lastGenerated: 'Ven 25/04/2026 · 08:01',
    lastSize: '0.3 MB',
    status: 'attivo',
    recipients: [],
    sections: ['position', 'Received Candidates', 'In Review Candidates', 'Phone Interview Candidates', 'In-person Interview Candidates', 'Hired Candidates', 'Rejected Candidates'],
    roles: ['hr'],
    color: '#DC2626',
    runCount: 63,
    day: 1,
    time: '08:00',
  },
];

const AVAILABLE_SECTIONS: Record<string, string[]> = {
  hr_weekly: ['Riepilogo presenze', 'Anomalie rilevate', 'Turni confermati', 'Richieste ferie', 'Onboarding in corso', 'Scadenze formazioni', 'Scadenze visite mediche'],
  admin_monthly: ['KPI', 'Employees', 'ATS', 'Onboarding in process', 'Shift coverage', 'Contract deadlines', 'Attendance', 'Anomalies', 'Leave Requests', 'Training deadlines'],
  hr_monthly: ['Variazioni organico', 'Ferie & permessi', 'Scadenze formazioni', 'Scadenze visite mediche', 'Contratti in scadenza', 'Turnover mensile'],
  anomaly_daily: ['position', 'Received Candidates', 'In Review Candidates', 'Phone Interview Candidates', 'In-person Interview Candidates', 'Hired Candidates', 'Rejected Candidates'],
};

function ReportCard({ report, onEdit, onRun, onDownloadLast }: {
  report: ReportData;
  onEdit: () => void;
  onRun: () => void;
  onDownloadLast: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { isMobile } = useBreakpoint();

  const isRecentlyGenerated = (() => {
    if (!report.lastGenerated) return false;
    const genTime = new Date(report.lastGenerated).getTime();
    if (isNaN(genTime)) return false;
    const now = new Date().getTime();
    // Show the green message if generated within the last 15 minutes
    return (now - genTime) >= 0 && (now - genTime) < 15 * 60 * 1000;
  })();

  const STATUS_CONFIG = {
    attivo: { label: t('reports.status.active'), color: '#15803D', bg: '#F0FDF4', border: 'rgba(21,128,61,0.2)' },
    sospeso: { label: t('reports.status.suspended'), color: '#B45309', bg: '#FFFBEB', border: 'rgba(180,83,9,0.2)' },
    errore: { label: t('reports.status.error'), color: '#DC2626', bg: '#FEF2F2', border: 'rgba(220,38,38,0.2)' },
  };

  const status = STATUS_CONFIG[report.status];
  const name = t(`reports.data.${report.id}.name`);

  let desc = t(`reports.data.${report.id}.desc`);
  if (report.id === 'hr_weekly') {
    const isIt = i18n.language === 'it';
    const dayNamesIt = ['', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
    const dayNamesEn = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const activeDay = report.day || 1;
    const activeTime = report.time || '07:00';
    const dayName = isIt ? dayNamesIt[activeDay] : dayNamesEn[activeDay];

    const sectionsList = report.sections && report.sections.length > 0
      ? report.sections.map(s => t(`reports.sections.${s}`, s)).join(', ')
      : (isIt ? 'nessuna sezione selezionata' : 'no sections selected');

    const recipientsCount = report.recipients ? report.recipients.length : 0;

    if (isIt) {
      desc = `Riepilogo settimanale completo (presenze, anomalie, turni, ferie, onboarding). Inviato ogni ${dayName} alle ${activeTime} a ${recipientsCount} destinatari configurati.`;
    } else {
      desc = `Complete weekly summary (attendance, anomalies, shifts, leave, onboarding). Sent every ${dayName} at ${activeTime} to ${recipientsCount} configured recipients.`;
    }
  }

  let displayFrequency = '';
  if (report.id === 'anomaly_daily') {
    const formattedTime = (() => {
      if (!report.time) return '07:00 AM';
      const [hStr, mStr] = report.time.split(':');
      const h = parseInt(hStr, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${String(h12).padStart(2, '0')}:${mStr} ${ampm}`;
    })();
    const isIt = i18n.language === 'it';
    displayFrequency = isIt ? `Lunedì - Venerdì ${formattedTime}` : `Monday - Friday ${formattedTime}`;
  } else {
    displayFrequency = ((report.id === 'hr_weekly' || report.id === 'admin_monthly' || report.id === 'hr_monthly') && report.day && report.time)
      ? `${isMonthlyDayBasedReport(report.id) ? getMonthlyDayLabel(report.day, i18n.language) : t(`reports.days.${report.day}`)} ${report.time}`
      : t(`reports.data.${report.id}.schedule`);
  }

  return (
    <Card
      padding="none"
      style={{
        transition: 'all 0.15s ease',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ padding: '20px 22px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, flexShrink: 0,
            background: `${report.color}12`, border: `1px solid ${report.color}25`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={report.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="13" y2="17" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{name}</h3>
              <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, color: status.color, background: status.bg, border: `1px solid ${status.border}`, flexShrink: 0 }}>{status.label}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{desc}</p>
          </div>
        </div>

        {/* Meta */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {[
            { label: t('reports.card.frequency'), value: displayFrequency },
            { label: t('reports.card.nextRun'), value: report.nextRun },
            { label: t('reports.card.lastGenerated'), value: formatExecutionTime(report.lastGenerated, i18n.language, report.id === 'anomaly_daily') },
            { label: t('reports.card.totalReports'), value: `${report.runCount} ${t('reports.stats.executionsSuffix')}` },
          ].map(m => (
            <div key={m.label} style={{ background: 'var(--surface-warm)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-disabled)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Recipients */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-disabled)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{t('reports.card.recipients')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {report.recipients.map(r => (
              <span key={r} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: 'var(--surface-warm)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>📧 {r}</span>
            ))}
          </div>
          {isRecentlyGenerated && (
            <div style={{
              color: '#16A34A',
              fontSize: '12px',
              fontWeight: 600,
              marginTop: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ fontSize: '14px' }}>✨</span>
              <span>
                {i18n.language === 'it'
                  ? `Nuovo PDF generato: ${formatExecutionTime(report.lastGenerated, i18n.language, report.id === 'anomaly_daily')}`
                  : `New PDF generated: ${formatExecutionTime(report.lastGenerated, i18n.language, report.id === 'anomaly_daily')}`}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <button onClick={onRun} style={{
            padding: '7px 14px',
            background: report.status === 'attivo' ? '#DC2626' : report.color,
            color: '#FFF', border: 'none',
            borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 5,
            transition: 'all 0.2s ease',
            flex: isMobile ? '1 1 auto' : 'none',
            justifyContent: 'center',
          }}>
            {report.status === 'attivo' ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="5" y="5" width="14" height="14" rx="1" fill="currentColor" />
                </svg>
                {t('reports.card.pauseSchedule')}
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {t('reports.card.activateSchedule')}
              </>
            )}
          </button>
          <button onClick={onEdit} style={{
            padding: '7px 14px', background: 'transparent', color: 'var(--text-secondary)',
            border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)',
            flex: isMobile ? '1 1 auto' : 'none',
            textAlign: 'center',
          }}>{t('reports.card.configure')}</button>
          <button onClick={onDownloadLast} style={{
            padding: '7px 14px', background: 'transparent', color: 'var(--text-secondary)',
            border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 5,
            flex: isMobile ? '1 1 auto' : 'none',
            justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            {t('reports.card.downloadLast')}
          </button>
        </div>
      </div>
    </Card>
  );
}

function ConfigModal({ report, onClose, onSave }: { report: ReportData; onClose: () => void; onSave: (data: Partial<ReportData>) => void }) {
  const { t } = useTranslation();
  const { isMobile } = useBreakpoint();
  const [recipients, setRecipients] = useState([...report.recipients]);
  const [newEmail, setNewEmail] = useState('');
  const [sections, setSections] = useState(() => {
    const availableSections = new Set(AVAILABLE_SECTIONS[report.id] || report.sections);
    return new Set(report.sections.filter(s => availableSections.has(s)));
  });
  const [day, setDay] = useState<number>(report.day || 1);
  const [time, setTime] = useState<string>(report.time || '07:00');

  const available = AVAILABLE_SECTIONS[report.id] || report.sections;

  const name = t(`reports.data.${report.id}.name`);

  const handleSave = () => {
    const normalizedRecipients = Array.from(
      new Set(recipients.map((recipient) => recipient.trim()).filter((recipient) => recipient.includes('@')))
    );
    onSave({
      recipients: normalizedRecipients,
      sections: Array.from(sections),
      day,
      time,
      status: report.status
    });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(13,33,55,0.55)', backdropFilter: 'blur(4px)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#FFF', borderRadius: 16, width: 'min(560px, 95vw)', maxHeight: '85vh',
        overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }} onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{t('reports.modal.title')}</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-disabled)', padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Frequency Selection */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>{t('reports.modal.frequencyLabel')}</label>
            <div style={{ display: 'flex', gap: 12 }}>
              {report.id !== 'anomaly_daily' && (
                <div style={{ flex: 1 }}>
                  <select
                    value={day}
                    onChange={e => setDay(Number(e.target.value))}
                    style={{
                      width: '100%', height: 38, padding: '0 10px',
                      border: '1.5px solid var(--border)', borderRadius: 8,
                      fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none'
                    }}
                  >
                    {(isMonthlyDayBasedReport(report.id) ? Array.from({ length: 31 }, (_, index) => index + 1) : [1, 2, 3, 4, 5, 6, 7]).map(d => (
                      <option key={d} value={d}>
                        {isMonthlyDayBasedReport(report.id) ? d : t(`reports.days.${d}`)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <TimePicker value={time} onChange={setTime} />
              </div>
            </div>
          </div>

          {/* Recipients */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>{t('reports.modal.recipientsLabel')}</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexDirection: isMobile ? 'column' : 'row' }}>
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder={t('reports.modal.emailPlaceholder')}
                style={{ flex: 1, padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }}
                onKeyDown={e => { if (e.key === 'Enter' && newEmail.includes('@')) { setRecipients([...recipients, newEmail]); setNewEmail(''); } }}
              />
              <button onClick={() => { if (newEmail.includes('@')) { setRecipients([...recipients, newEmail]); setNewEmail(''); } }}
                style={{ padding: '8px 16px', background: 'var(--primary)', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                {t('reports.modal.addRecipient')}
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {recipients.map((r, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'var(--surface-warm)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {r}
                  <button onClick={() => setRecipients(recipients.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-disabled)', padding: 0, display: 'flex' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Sections */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>{t('reports.modal.sectionsLabel')}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {available.map(sec => (
                <label key={sec} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, background: sections.has(sec) ? `${report.color}08` : 'var(--surface-warm)', border: `1px solid ${sections.has(sec) ? report.color + '30' : 'transparent'}`, transition: 'all 0.12s' }}>
                  <input type="checkbox" checked={sections.has(sec)} onChange={() => {
                    const next = new Set(sections);
                    if (next.has(sec)) next.delete(sec); else next.add(sec);
                    setSections(next);
                  }} style={{ accentColor: report.color, width: 15, height: 15 }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t(`reports.sections.${sec}`, sec)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
          <button onClick={onClose} style={{ flex: isMobile ? 1 : 'none', padding: '9px 20px', background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>{t('reports.modal.cancel')}</button>
          <button onClick={handleSave} style={{ flex: isMobile ? 1 : 'none', padding: '9px 20px', background: 'var(--primary)', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>{t('reports.modal.save')}</button>
        </div>
      </div>
    </div>
  );
}

function RunToast({ report, onClose }: { report: ReportData; onClose: () => void }) {
  const { t } = useTranslation();
  const name = t(`reports.data.${report.id}.name`);
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 2000,
      background: 'var(--primary)', color: '#FFF', borderRadius: 12, padding: '14px 20px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 12,
      animation: 'fadeSlideUp 0.3s ease',
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#C9973A', animation: 'pulse 1s infinite' }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('reports.toast.running')}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{t('reports.toast.hint', { name })}</div>
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', marginLeft: 8 }}>✕</button>
    </div>
  );
}

export function ReportsPage() {
  const [reports, setReports] = useState(INITIAL_REPORTS_DATA);
  const [editReport, setEditReport] = useState<ReportData | null>(null);
  const [runningReport, setRunningReport] = useState<ReportData | null>(null);
  const [historyList, setHistoryList] = useState<ReportHistoryItem[]>([]);
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { isMobile } = useBreakpoint();
  const [loading, setLoading] = useState(true);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  const isSuperAdmin = !!user?.isSuperAdmin || (user?.role as string) === 'super_admin';

  useEffect(() => {
    if (isSuperAdmin) {
      getCompanies().then(list => {
        setCompanies(list);
        if (list.length > 0) {
          setSelectedCompanyId(list[0].id);
        }
      }).catch(err => {
        console.error('Failed to load companies:', err);
      });
    }
  }, [isSuperAdmin]);

  const loadConfigs = useCallback(async () => {
    if (isSuperAdmin && !selectedCompanyId) {
      return;
    }
    try {
      const companyIdParam = isSuperAdmin ? (selectedCompanyId || undefined) : undefined;
      const dbConfigs = await getReportConfigurations(companyIdParam);
      setReports(prev => prev.map(r => {
        const dbConf = dbConfigs.find(dbc => dbc.reportId === r.id);
        if (dbConf) {
          const nextRun = r.id === 'anomaly_daily'
            ? getNextExecutionAnomalyDaily(dbConf.time, i18n.language)
            : getNextExecution(dbConf.day, dbConf.time, i18n.language, r.id);
          return {
            ...r,
            day: dbConf.day,
            time: dbConf.time,
            recipients: dbConf.recipients || [],
            sections: dbConf.sections || [],
            status: (dbConf.status || r.status) as any,
            nextRun,
            runCount: dbConf.runCount !== undefined ? dbConf.runCount : r.runCount,
            lastGenerated: dbConf.lastGenerated !== undefined ? dbConf.lastGenerated : r.lastGenerated
          };
        }
        
        // If not found in db, reset config values back to defaults for this company view
        const defaultR = INITIAL_REPORTS_DATA.find(initial => initial.id === r.id) || r;
        return {
          ...r,
          day: defaultR.day,
          time: defaultR.time,
          recipients: defaultR.recipients || [],
          sections: defaultR.sections || [],
          status: defaultR.status,
          nextRun: r.id === 'anomaly_daily'
            ? getNextExecutionAnomalyDaily(defaultR.time || '07:00', i18n.language)
            : getNextExecution(defaultR.day || 1, defaultR.time || '07:00', i18n.language, r.id),
          runCount: 0,
          lastGenerated: null
        };
      }));

      const history = await getReportHistory(companyIdParam);
      setHistoryList(history);
    } catch (err) {
      console.error('Failed to load report configurations or history from database:', err);
    } finally {
      setLoading(false);
    }
  }, [i18n.language, isSuperAdmin, selectedCompanyId]);

  useEffect(() => {
    void loadConfigs();

    // Set up a polling interval to auto-refresh database statistics every 10 seconds
    const interval = setInterval(() => {
      void loadConfigs();
    }, 10000);

    return () => clearInterval(interval);
  }, [loadConfigs]);

  const handleRun = async (report: ReportData) => {
    try {
      const isActivating = report.status !== 'attivo';
      const newStatus = isActivating ? 'attivo' : 'sospeso';
      const companyIdParam = isSuperAdmin ? (selectedCompanyId || undefined) : undefined;

      await saveReportConfiguration(report.id, {
        status: newStatus,
      }, companyIdParam);

      setReports(prev => prev.map(r => {
        if (r.id === report.id) {
          return {
            ...r,
            status: newStatus,
          };
        }
        return r;
      }));

      const isIt = i18n.language === 'it';
      const activeMsg = isIt ? 'Generazione programmata attivata con successo.' : 'Scheduled report generation activated successfully.';
      const stopMsg = isIt ? 'Generazione programmata disattivata.' : 'Scheduled report generation deactivated.';

      showToast(isActivating ? activeMsg : stopMsg, 'success');
    } catch (err) {
      console.error('Failed to toggle report status:', err);
      const isIt = i18n.language === 'it';
      const errorMsg = isIt ? 'Impossibile modificare lo stato.' : 'Failed to update report status.';
      showToast(errorMsg, 'error');
    }
  };

  const handleSaveReport = async (newData: Partial<ReportData>) => {
    if (!editReport) return;

    try {
      const companyIdParam = isSuperAdmin ? (selectedCompanyId || undefined) : undefined;
      // Requirements: saving changes always resets schedule to suspended ('sospeso')
      const savedConfig = await saveReportConfiguration(editReport.id, {
        day: newData.day ?? editReport.day ?? 1,
        time: newData.time ?? editReport.time ?? '07:00',
        recipients: newData.recipients || [],
        sections: newData.sections || [],
        status: 'sospeso',
      }, companyIdParam);

      setReports(prev => prev.map(r => {
        if (r.id === editReport.id) {
          const updated = {
            ...r,
            ...newData,
            status: 'sospeso' as const,
            runCount: savedConfig.runCount !== undefined ? savedConfig.runCount : r.runCount,
            lastGenerated: savedConfig.lastGenerated !== undefined ? savedConfig.lastGenerated : r.lastGenerated
          };
          if (updated.id === 'anomaly_daily') {
            updated.nextRun = getNextExecutionAnomalyDaily(updated.time || '07:00', i18n.language);
          } else if (updated.day && updated.time) {
            updated.nextRun = getNextExecution(updated.day, updated.time, i18n.language, updated.id);
          }
          return updated;
        }
        return r;
      }));

      showToast(t('reports.modal.saveSuccess', 'Modifiche salvate con successo. Attiva la programmazione per avviare gli invii automatici.'), 'success');
      setEditReport(null);
    } catch (err) {
      console.error('Failed to save report configuration:', err);
      showToast(t('reports.modal.saveError', 'Errore durante il salvataggio.'), 'error');
    }
  };

  const handleDownloadLast = async (reportId: string) => {
    try {
      const isIt = i18n.language === 'it';
      showToast(isIt ? 'Generazione e download del report in corso...' : 'Generating and downloading last report...', 'info');

      const companyIdParam = isSuperAdmin ? (selectedCompanyId || undefined) : undefined;
      const blob = await downloadLastReport(reportId, companyIdParam);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportId}-last-report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showToast(isIt ? 'Report scaricato con successo.' : 'Report downloaded successfully.', 'success');
    } catch (err) {
      console.error('Failed to download last report:', err);
      const isIt = i18n.language === 'it';
      showToast(isIt ? 'Impossibile scaricare il report.' : 'Failed to download report.', 'error');
    }
  };

  const handleDownloadArchived = async (item: ReportHistoryItem) => {
    try {
      const isIt = i18n.language === 'it';
      showToast(isIt ? 'Generazione e download del report in corso...' : 'Generating and downloading archived report...', 'info');

      const companyIdParam = isSuperAdmin ? (selectedCompanyId || undefined) : undefined;
      const blob = await downloadArchivedReport(item.id, companyIdParam);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Filename construction
      const targetDate = new Date(item.targetDate);
      const end = new Date(targetDate);
      end.setDate(targetDate.getDate() - 1);
      const start = new Date(targetDate);

      const formatDate = (d: Date) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };

      let filename = '';
      if (item.reportId === 'admin_monthly') {
        start.setMonth(targetDate.getMonth() - 1);
        filename = `monthly-admin-report-${formatDate(start)}-to-${formatDate(end)}.pdf`;
      } else if (item.reportId === 'hr_monthly') {
        start.setDate(targetDate.getDate() - 30);
        filename = `monthly-hr-report-${formatDate(start)}-to-${formatDate(end)}.pdf`;
      } else {
        start.setDate(targetDate.getDate() - 7);
        filename = `weekly-hr-report-${formatDate(start)}-to-${formatDate(end)}.pdf`;
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showToast(isIt ? 'Report scaricato con successo.' : 'Report downloaded successfully.', 'success');
    } catch (err) {
      console.error('Failed to download archived report:', err);
      const isIt = i18n.language === 'it';
      showToast(isIt ? 'Impossibile scaricare il report.' : 'Failed to download report.', 'error');
    }
  };

  const visibleReports = reports.filter(r => !(user?.role === 'hr' && r.id === 'admin_monthly'));
  const totalActive = visibleReports.filter(r => r.status === 'attivo').length;
  const totalRuns = visibleReports.reduce((s, r) => s + r.runCount, 0);

  const nextRunVal = (() => {
    const getReportNextExecutionDate = (r: ReportData): Date | null => {
      if (r.status !== 'attivo') return null;
      const time = r.time || '07:00';
      const [hours, minutes] = time.split(':').map(Number);
      const now = new Date();

      if (r.id === 'anomaly_daily') {
        const next = new Date(now);
        next.setHours(hours, minutes, 0, 0);
        if (next.getTime() <= now.getTime()) {
          next.setDate(next.getDate() + 1);
        }
        while (next.getDay() === 0 || next.getDay() === 6) {
          next.setDate(next.getDate() + 1);
        }
        return next;
      } else {
        const next = new Date(now);
        const targetDay = r.day || 1;

        if (isMonthlyDayBasedReport(r.id)) {
          next.setFullYear(now.getFullYear(), now.getMonth(), getClampedMonthDay(now.getFullYear(), now.getMonth(), targetDay));
          next.setHours(hours, minutes, 0, 0);
          if (next.getTime() <= now.getTime()) {
            const nextMonth = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
            const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
            next.setFullYear(nextYear, nextMonth, getClampedMonthDay(nextYear, nextMonth, targetDay));
            next.setHours(hours, minutes, 0, 0);
          }
          return next;
        }

        next.setHours(hours, minutes, 0, 0);
        let daysUntil = (targetDay - now.getDay() + 7) % 7;
        if (daysUntil === 0 && next.getTime() <= now.getTime()) {
          daysUntil = 7;
        }
        next.setDate(now.getDate() + daysUntil);
        return next;
      }
    };

    const nextDates = visibleReports
      .map(r => ({ report: r, date: getReportNextExecutionDate(r) }))
      .filter((x): x is { report: ReportData; date: Date } => x.date !== null);

    if (nextDates.length === 0) {
      return t('reports.mock.nextRunDate');
    }

    nextDates.sort((a, b) => a.date.getTime() - b.date.getTime());
    const closest = nextDates[0];

    const isIt = i18n.language === 'it';
    const weekdaysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdaysIt = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    return isIt ? weekdaysIt[closest.date.getDay()] : weekdaysEn[closest.date.getDay()];
  })();

  const hrWeeklyDay = reports.find(r => r.id === 'hr_weekly')?.day ?? 1;
  const adminMonthlyDay = reports.find(r => r.id === 'admin_monthly')?.day ?? 1;
  const hrMonthlyDay = reports.find(r => r.id === 'hr_monthly')?.day ?? 1;

  return (
    <div className="page-enter" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header mimic */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: '24px', gap: '12px',
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{
            fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)', margin: 0, letterSpacing: '-0.02em',
          }}>
            {t('nav.reports')}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '3px 0 0' }}>
            {t('reports.subtitle', { active: totalActive, total: visibleReports.length, runs: totalRuns })}
          </p>
        </div>

        {isSuperAdmin && companies.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {i18n.language === 'it' ? 'Seleziona Azienda:' : 'Select Company:'}
            </span>
            <select
              value={selectedCompanyId || ''}
              onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.2s'
              }}
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('reports.stats.active'), value: totalActive, color: '#15803D', icon: '✓' },
          { label: t('reports.stats.totalRuns'), value: totalRuns, color: '#0284C7', icon: '▶' },
          { label: t('reports.stats.nextRun'), value: nextRunVal, color: '#C9973A', icon: '⏰' },
          { label: t('reports.stats.archive'), value: `${totalRuns} ${t('reports.stats.pdfSuffix')}`, color: '#7C3AED', icon: '📁' },
        ].map(s => (
          <Card key={s.label} padding="sm" style={{ display: 'flex', alignItems: 'center', gap: 14, borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Execution timeline */}
      <Card padding="md" style={{ marginBottom: 24 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px' }}>{t('reports.calendar.title')}</h3>
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
            <div key={day} style={{ flex: 1, minWidth: 80, padding: '8px 0', borderRight: i < 6 ? '1px solid var(--border)' : 'none', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-disabled)', fontWeight: 600, marginBottom: 8 }}>{t(`reports.calendar.days.${day}`)}</div>
              {(i + 1) === hrWeeklyDay && <div style={{ fontSize: 10, padding: '3px 6px', background: '#0284C7', color: '#FFF', borderRadius: 4, margin: '0 4px 4px', fontWeight: 600 }}>{t('reports.data.hr_weekly.name')}</div>}
              {(i + 1) === adminMonthlyDay && user?.role !== 'hr' && <div style={{ fontSize: 10, padding: '3px 6px', background: '#C9973A', color: '#FFF', borderRadius: 4, margin: '0 4px 4px', fontWeight: 600 }}>{t('reports.data.admin_monthly.name')}</div>}
              {(i + 1) === hrMonthlyDay && <div style={{ fontSize: 10, padding: '3px 6px', background: '#7C3AED', color: '#FFF', borderRadius: 4, margin: '0 4px 4px', fontWeight: 600 }}>{t('reports.data.hr_monthly.name')}</div>}
              {[0, 1, 2, 3, 4].includes(i) && <div style={{ fontSize: 10, padding: '3px 6px', background: '#DC2626', color: '#FFF', borderRadius: 4, margin: '0 4px', fontWeight: 600 }}>{t('reports.data.anomaly_daily.name')}</div>}
            </div>
          ))}
        </div>
      </Card>

      {/* Reports grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
        {visibleReports.map(report => (
          <ReportCard
            key={report.id}
            report={report}
            onEdit={() => setEditReport(report)}
            onRun={() => handleRun(report)}
            onDownloadLast={() => handleDownloadLast(report.id)}
          />
        ))}
      </div>

      {/* Archive section */}
      <Card padding="none" style={{ marginTop: 24 }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{t('reports.archive.title')}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-disabled)', margin: '2px 0 0' }}>{t('reports.archive.subtitle')}</p>
          </div>
        </div>
        <div>
          {historyList.filter(item => !(user?.role === 'hr' && item.reportId === 'admin_monthly')).length === 0 ? (
            <div style={{ padding: '30px 22px', textAlign: 'center', color: 'var(--text-disabled)', fontSize: 13 }}>
              {i18n.language === 'it'
                ? 'Nessun report generato finora. Clicca su "Esegui ora" o attendi l\'orario programmato per generare un report.'
                : 'No reports generated yet. Click on "Run now" or wait for the scheduled time to generate a report.'}
            </div>
          ) : (
            historyList
              .filter(item => !(user?.role === 'hr' && item.reportId === 'admin_monthly'))
              .map((item, i, arr) => {
                const reportDef = reports.find(r => r.id === item.reportId) || { color: '#0284C7' };
                const itemColor = reportDef.color;
                const formattedDate = formatExecutionTime(item.generatedAt, i18n.language);
                const formattedSize = formatBytes(item.sizeBytes);

                return (
                  <div key={item.id} style={{
                    padding: isMobile ? '14px 16px' : '14px 22px', borderBottom: i < arr.length - 1 ? '1px solid var(--surface-warm)' : 'none',
                    display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 14,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${itemColor}12`, border: `1px solid ${itemColor}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={itemColor} strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{t(`reports.data.${item.reportId}.name`)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-disabled)' }}>{t('reports.archive.generatedOn')} {formattedDate} · {formattedSize}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownloadArchived(item)}
                      style={{ padding: '8px 12px', background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: isMobile ? '100%' : 'auto' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                      {t('reports.archive.downloadPdf')}
                    </button>
                  </div>
                );
              })
          )}
        </div>
      </Card>

      {editReport && <ConfigModal report={editReport} onClose={() => setEditReport(null)} onSave={handleSaveReport} />}
      {runningReport && <RunToast report={runningReport} onClose={() => setRunningReport(null)} />}
    </div>
  );
}

export default ReportsPage;
