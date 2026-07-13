import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/Card';
import { TimePicker } from '../../components/ui/TimePicker';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Company } from '../../types';
import { getCompanies } from '../../api/companies';
import { getAvatarUrl } from '../../api/client';
import {
  getReportOwners,
  getReportConfigurations,
  saveReportConfiguration,
  downloadLastReport,
  getReportHistory,
  downloadArchivedReport,
  deleteArchivedReport,
  getReportPreview,
  ReportOwner,
  ReportConfigData,
  ReportHistoryItem,
  ReportPreview,
  ReportCadence,
} from '../../api/reports';

/** Archive shows this many rows before "Load more" appears. */
const ARCHIVE_PAGE_SIZE = 8;

/** Each cadence gets one colour, used for the card accent and the calendar chip. */
const CADENCE_COLOR: Record<ReportCadence, string> = {
  monthly: '#7C3AED',
  weekly: '#0284C7',
  daily: '#DC2626',
};

const SECTIONS_BY_ROLE: Record<'admin' | 'hr', string[]> = {
  admin: ['workforce', 'shifts', 'anomalies', 'leave', 'contracts', 'ats'],
  hr: ['attendance', 'anomalies', 'shifts', 'leave', 'onboarding', 'trainings', 'medical', 'contracts', 'ats'],
};

const DEFAULT_SECTIONS: Record<string, string[]> = {
  admin_monthly: ['workforce', 'shifts', 'anomalies', 'leave', 'contracts', 'ats'],
  admin_weekly: ['shifts', 'anomalies', 'leave'],
  hr_monthly: ['workforce', 'leave', 'trainings', 'medical', 'contracts'],
  hr_weekly: ['attendance', 'anomalies', 'shifts', 'leave', 'onboarding'],
  anomaly_daily: ['ats'],
};

const DEFAULT_TIME: Record<string, string> = {
  admin_monthly: '07:00',
  admin_weekly: '07:00',
  hr_monthly: '08:00',
  hr_weekly: '07:00',
  anomaly_daily: '08:00',
};

const DEFAULT_DAY: Record<string, number> = {
  admin_monthly: 1,
  admin_weekly: 1,
  hr_monthly: 1,
  hr_weekly: 1,
  anomaly_daily: 1,
};

/** A report's row in report_configurations, merged with its registry definition. */
interface ReportRow {
  reportId: string;
  cadence: ReportCadence;
  ownerUserId: number;
  storeId: number | null;
  status: 'attivo' | 'sospeso' | 'errore';
  day: number;
  time: string;
  recipients: string[];
  sections: string[];
  runCount: number;
  lastGenerated: string | null;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${units[i]}`;
}

function formatDateTime(value: string | null, lang: string): string {
  if (!value) return lang === 'it' ? 'Mai generato' : 'Never generated';
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(lang, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date).replace(',', ' ·');
}

/** Next scheduled run, given the cadence. Daily reports run Monday to Friday. */
function nextRun(cadence: ReportCadence, day: number, time: string, lang: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  if (cadence === 'daily') {
    if (next <= now) next.setDate(next.getDate() + 1);
    while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
  } else if (cadence === 'weekly') {
    const todayIso = now.getDay() === 0 ? 7 : now.getDay();
    let until = (day - todayIso + 7) % 7;
    if (until === 0 && next <= now) until = 7;
    next.setDate(now.getDate() + until);
  } else {
    // Monthly: the Nth day of this month, or of next month if already past.
    const clamp = (y: number, m: number) => Math.min(day, new Date(y, m + 1, 0).getDate());
    next.setFullYear(now.getFullYear(), now.getMonth(), clamp(now.getFullYear(), now.getMonth()));
    next.setHours(hours, minutes, 0, 0);
    if (next <= now) {
      const m = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
      const y = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
      next.setFullYear(y, m, clamp(y, m));
      next.setHours(hours, minutes, 0, 0);
    }
  }

  return new Intl.DateTimeFormat(lang, {
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(next).replace(',', ' ·');
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function Avatar({ name, filename, color }: { name: string; filename: string | null; color: string }) {
  const url = getAvatarUrl(filename);
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

  return (
    <div style={{
      width: 42, height: 42, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: url ? 'transparent' : `${color}18`,
      border: `2px solid ${color}35`,
      color, fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-display)',
    }}>
      {url
        ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report card
// ---------------------------------------------------------------------------

function ReportCard({ report, onToggle, onConfigure, onDownload }: {
  report: ReportRow;
  onToggle: () => void;
  onConfigure: () => void;
  onDownload: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { isMobile } = useBreakpoint();
  const isIt = i18n.language === 'it';
  const color = CADENCE_COLOR[report.cadence];
  const active = report.status === 'attivo';

  const cadenceLabel = { monthly: isIt ? 'Mensile' : 'Monthly', weekly: isIt ? 'Settimanale' : 'Weekly', daily: isIt ? 'Giornaliero' : 'Daily' }[report.cadence];
  const title = t(`reports.data.${report.reportId}.name`, cadenceLabel);

  return (
    <Card padding="none" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', borderTop: `3px solid ${color}` }}>
      <div style={{ padding: '16px 18px' }}>
        {/* Title + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: `${color}14`, color, border: `1px solid ${color}30` }}>
            {cadenceLabel.toUpperCase()}
          </span>
          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', margin: 0, flex: 1, minWidth: 0 }}>
            {title}
          </h4>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
            color: active ? '#15803D' : '#B45309',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#15803D' : '#B45309' }} />
            {active ? (isIt ? 'Attivo' : 'Active') : (isIt ? 'In pausa' : 'Paused')}
          </span>
        </div>

        {/* Facts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[
            { k: isIt ? 'Prossimo invio' : 'Next run', v: active ? nextRun(report.cadence, report.day, report.time, i18n.language) : '—' },
            { k: isIt ? 'Ultimo report' : 'Last report', v: formatDateTime(report.lastGenerated, i18n.language) },
            { k: isIt ? 'Destinatari' : 'Recipients', v: String(report.recipients.length) },
            { k: isIt ? 'Generati' : 'Generated', v: String(report.runCount) },
          ].map(f => (
            <div key={f.k} style={{ background: 'var(--surface-warm)', borderRadius: 6, padding: '6px 10px', minWidth: 0 }}>
              <div style={{ fontSize: 9, color: 'var(--text-disabled)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.k}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.v}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={onToggle} style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-body)', border: 'none', color: '#FFF',
            background: active ? '#B45309' : '#15803D',
            flex: isMobile ? '1 1 auto' : 'none',
          }}>
            {active ? (isIt ? 'Metti in pausa' : 'Pause') : (isIt ? 'Attiva' : 'Activate')}
          </button>
          <button onClick={onConfigure} style={{
            padding: '6px 12px', background: 'transparent', color: 'var(--text-secondary)',
            border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)', flex: isMobile ? '1 1 auto' : 'none',
          }}>{isIt ? 'Configura' : 'Configure'}</button>
          <button onClick={onDownload} style={{
            padding: '6px 12px', background: 'transparent', color: 'var(--text-secondary)',
            border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)', flex: isMobile ? '1 1 auto' : 'none',
          }}>{isIt ? 'Scarica PDF' : 'Download PDF'}</button>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Owner row: avatar + name on the left, company/store on the right, reports below
// ---------------------------------------------------------------------------

function OwnerSection({ owner, reports, onToggle, onConfigure, onDownload }: {
  owner: ReportOwner;
  reports: ReportRow[];
  onToggle: (r: ReportRow) => void;
  onConfigure: (r: ReportRow) => void;
  onDownload: (r: ReportRow) => void;
}) {
  const { i18n } = useTranslation();
  const { isMobile } = useBreakpoint();
  const isIt = i18n.language === 'it';
  const isAdmin = owner.role === 'admin';
  const accent = isAdmin ? '#C9973A' : '#0284C7';

  const roleLabel = isAdmin ? 'Admin' : 'HR';
  const scopeCaption = isAdmin ? (isIt ? 'Azienda' : 'Company') : (isIt ? 'Negozio' : 'Store');
  const activeCount = reports.filter(r => r.status === 'attivo').length;

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Owner header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '12px 16px', marginBottom: 12,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderLeft: `4px solid ${accent}`, borderRadius: 10,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
      }}>
        {/* Left: who */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <Avatar name={owner.name} filename={owner.avatarFilename} color={accent} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                {owner.name}
              </span>
              <span style={{ padding: '1px 7px', borderRadius: 4, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.05em', background: `${accent}18`, color: accent }}>
                {roleLabel}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              {activeCount}/{reports.length} {isIt ? 'report attivi' : 'reports active'}
            </div>
          </div>
        </div>

        {/* Right: scope */}
        <div style={{ textAlign: isMobile ? 'left' : 'right', minWidth: 0 }}>
          <div style={{ fontSize: 9.5, color: 'var(--text-disabled)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {scopeCaption}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {owner.scopeLabel}
          </div>
        </div>
      </div>

      {/* Reports for this owner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : `repeat(${Math.min(reports.length, 3)}, 1fr)`,
        gap: 14,
      }}>
        {reports.map(r => (
          <ReportCard
            key={r.reportId}
            report={r}
            onToggle={() => onToggle(r)}
            onConfigure={() => onConfigure(r)}
            onDownload={() => onDownload(r)}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Configure modal — schedule, recipients, sections. Nothing else.
// ---------------------------------------------------------------------------

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ConfigModal({ report, ownerName, companyId, onClose, onSave }: {
  report: ReportRow;
  ownerName: string;
  companyId?: number;
  onClose: () => void;
  onSave: (data: Partial<ReportRow>) => void;
}) {
  const { t, i18n } = useTranslation();
  const { isMobile } = useBreakpoint();
  const isIt = i18n.language === 'it';
  const color = CADENCE_COLOR[report.cadence];

  const [recipients, setRecipients] = useState([...report.recipients]);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [sections, setSections] = useState(new Set(report.sections));
  const [day, setDay] = useState(report.day);
  const [time, setTime] = useState(report.time);
  const [preview, setPreview] = useState<ReportPreview | null>(null);

  const role: 'admin' | 'hr' = report.reportId.startsWith('admin') ? 'admin' : 'hr';
  const available = SECTIONS_BY_ROLE[role];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Show the user what this report will actually tell them, using their real data.
  useEffect(() => {
    let cancelled = false;
    getReportPreview(report.reportId, companyId, report.ownerUserId)
      .then(p => { if (!cancelled) setPreview(p); })
      .catch(() => { /* preview is a nicety; the form still works without it */ });
    return () => { cancelled = true; };
  }, [report.reportId, report.ownerUserId, companyId]);

  const addRecipient = () => {
    const candidate = newEmail.trim();
    if (!EMAIL_PATTERN.test(candidate)) {
      setEmailError(isIt ? 'Indirizzo email non valido.' : 'Invalid email address.');
      return;
    }
    if (recipients.some(r => r.toLowerCase() === candidate.toLowerCase())) {
      setEmailError(isIt ? 'Destinatario gia presente.' : 'Recipient already added.');
      return;
    }
    setRecipients([...recipients, candidate]);
    setNewEmail('');
    setEmailError('');
  };

  const scheduleHint = (() => {
    const days = isIt
      ? ['', 'Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato', 'Domenica']
      : ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (report.cadence === 'daily') return isIt ? `Ogni giorno feriale alle ${time}` : `Every weekday at ${time}`;
    if (report.cadence === 'weekly') return isIt ? `Ogni ${days[day]} alle ${time}` : `Every ${days[day]} at ${time}`;
    return isIt ? `Il giorno ${day} di ogni mese alle ${time}` : `Day ${day} of each month at ${time}`;
  })();

  return ReactDOM.createPortal(
    <div
      role="dialog" aria-modal="true"
      style={{
        position: 'fixed', inset: 0, padding: 16, zIndex: 1000,
        background: 'rgba(13,33,55,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 24px 72px rgba(0,0,0,0.22)',
          animation: 'popIn 0.22s cubic-bezier(0.16,1,0.3,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {t(`reports.data.${report.reportId}.name`, report.reportId)}
            </h2>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 0' }}>{ownerName}</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-disabled)', padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', flex: 1 }}>
          {/* What this report will say — real numbers from the last period */}
          {preview && (
            <div style={{ background: `${color}0A`, border: `1px solid ${color}28`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color, marginBottom: 8 }}>
                {isIt ? 'Cosa dira questo report' : 'What this report will say'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { v: String(preview.highlights.scheduledShifts), l: isIt ? 'Turni pianificati' : 'Shifts scheduled' },
                  { v: `${preview.highlights.completionRate}%`, l: isIt ? 'Completamento' : 'Completion rate' },
                  { v: String(preview.highlights.anomalies), l: isIt ? 'Anomalie' : 'Anomalies',
                    delta: preview.highlights.anomalies - preview.highlights.previousAnomalies },
                  { v: String(preview.highlights.pendingLeave), l: isIt ? 'Ferie da approvare' : 'Leave to approve' },
                  { v: String(preview.highlights.headcount), l: isIt ? 'Organico' : 'Headcount' },
                  { v: String(preview.highlights.completedShifts), l: isIt ? 'Turni completati' : 'Shifts completed' },
                ].map(m => (
                  <div key={m.l}>
                    <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                      {m.v}
                      {m.delta !== undefined && m.delta !== 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 4, color: m.delta > 0 ? '#DC2626' : '#15803D' }}>
                          {m.delta > 0 ? '+' : ''}{m.delta}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.l}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-disabled)', marginTop: 8 }}>
                {isIt ? 'Periodo' : 'Period'}: {preview.periodStart} → {preview.periodEnd}
              </div>
            </div>
          )}

          {/* Schedule */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              {isIt ? 'Quando inviarlo' : 'When to send it'}
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              {report.cadence !== 'daily' && (
                <select
                  value={day}
                  onChange={e => setDay(Number(e.target.value))}
                  style={{
                    flex: 1, height: 38, padding: '0 10px', border: '1.5px solid var(--border)',
                    borderRadius: 8, fontSize: 13.5, fontFamily: 'var(--font-body)', outline: 'none',
                    background: 'var(--surface)', color: 'var(--text-primary)',
                  }}
                >
                  {report.cadence === 'monthly'
                    ? Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{isIt ? `Giorno ${d}` : `Day ${d}`}</option>
                      ))
                    : [1, 2, 3, 4, 5, 6, 7].map(d => (
                        <option key={d} value={d}>{t(`reports.days.${d}`)}</option>
                      ))}
                </select>
              )}
              <div style={{ flex: 1 }}>
                <TimePicker value={time} onChange={setTime} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{scheduleHint}</div>
          </div>

          {/* Recipients */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              {isIt ? 'Chi lo riceve' : 'Who receives it'}
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexDirection: isMobile ? 'column' : 'row' }}>
              <input
                value={newEmail}
                onChange={e => { setNewEmail(e.target.value); setEmailError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRecipient(); } }}
                placeholder="nome@azienda.it"
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 6, fontSize: 13, outline: 'none',
                  border: `1.5px solid ${emailError ? '#DC2626' : 'var(--border)'}`,
                  fontFamily: 'var(--font-body)', background: 'var(--surface)', color: 'var(--text-primary)',
                }}
              />
              <button onClick={addRecipient} style={{ padding: '8px 16px', background: 'var(--primary)', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                {isIt ? 'Aggiungi' : 'Add'}
              </button>
            </div>
            {emailError && <div style={{ fontSize: 11, color: '#DC2626', marginBottom: 6, fontWeight: 600 }}>{emailError}</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {recipients.length === 0 && (
                <span style={{ fontSize: 11.5, color: 'var(--text-disabled)', fontStyle: 'italic' }}>
                  {isIt ? 'Nessun destinatario: il report verra solo archiviato.' : 'No recipients: the report will only be archived.'}
                </span>
              )}
              {recipients.map((r, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'var(--surface-warm)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {r}
                  <button onClick={() => setRecipients(recipients.filter((_, j) => j !== i))} aria-label="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-disabled)', padding: 0, display: 'flex' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Sections */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>
              {isIt ? 'Cosa includere' : 'What to include'}
            </label>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px' }}>
              {isIt
                ? 'Sintesi, criticita e andamento sono sempre presenti. Scegli i dettagli da aggiungere.'
                : 'Summary, exceptions and trends are always included. Choose the details to add.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 6 }}>
              {available.map(sec => (
                <label key={sec} style={{
                  display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', padding: '8px 10px', borderRadius: 8,
                  background: sections.has(sec) ? `${color}0C` : 'var(--surface-warm)',
                  border: `1px solid ${sections.has(sec) ? color + '30' : 'transparent'}`,
                }}>
                  <input
                    type="checkbox" checked={sections.has(sec)}
                    onChange={() => {
                      const next = new Set(sections);
                      if (next.has(sec)) next.delete(sec); else next.add(sec);
                      setSections(next);
                    }}
                    style={{ accentColor: color, width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{t(`reports.sections.${sec}`, sec)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: isMobile ? 'space-between' : 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: isMobile ? 1 : 'none', padding: '9px 20px', background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            {isIt ? 'Annulla' : 'Cancel'}
          </button>
          <button
            onClick={() => onSave({
              day, time,
              recipients: Array.from(new Set(recipients.filter(r => EMAIL_PATTERN.test(r)))),
              sections: Array.from(sections),
            })}
            style={{ flex: isMobile ? 1 : 'none', padding: '9px 20px', background: 'var(--primary)', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
          >
            {isIt ? 'Salva' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.getElementById('modal-root') || document.body
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { isMobile } = useBreakpoint();
  const isIt = i18n.language === 'it';

  const [owners, setOwners] = useState<ReportOwner[]>([]);
  const [configs, setConfigs] = useState<ReportConfigData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ report: ReportRow; ownerName: string } | null>(null);

  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReportHistoryItem | null>(null);
  // The refresh re-fetches the archive; without tracking how many rows are on screen
  // it would silently collapse back to the first page after "Load more".
  const loadedCountRef = useRef(ARCHIVE_PAGE_SIZE);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const isSuperAdmin = !!user?.isSuperAdmin || (user?.role as string) === 'super_admin';
  const companyId = isSuperAdmin ? (selectedCompanyId || undefined) : undefined;

  useEffect(() => {
    if (!isSuperAdmin) return;
    getCompanies()
      .then(list => { setCompanies(list); if (list.length) setSelectedCompanyId(list[0].id); })
      .catch(err => console.error('Failed to load companies:', err));
  }, [isSuperAdmin]);

  const load = useCallback(async () => {
    if (isSuperAdmin && !selectedCompanyId) return;
    try {
      const [ownerList, configList, page] = await Promise.all([
        getReportOwners(companyId),
        getReportConfigurations(companyId),
        getReportHistory(companyId, { limit: Math.max(ARCHIVE_PAGE_SIZE, loadedCountRef.current), offset: 0 }),
      ]);
      setOwners(ownerList);
      setConfigs(configList);
      setHistory(page.items);
      setHistoryTotal(page.total);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, selectedCompanyId, companyId]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => { void load(); }, 15000);
    return () => clearInterval(interval);
  }, [load]);

  /** Merges a registry report with its saved config, falling back to defaults. */
  const rowFor = (owner: ReportOwner, def: ReportOwner['reports'][number]): ReportRow => {
    const saved = configs.find(c => c.reportId === def.reportId && c.ownerUserId === owner.userId);
    return {
      reportId: def.reportId,
      cadence: def.cadence,
      ownerUserId: owner.userId,
      storeId: owner.storeId,
      status: (saved?.status ?? def.defaultStatus) as ReportRow['status'],
      day: saved?.day ?? DEFAULT_DAY[def.reportId] ?? 1,
      time: saved?.time ?? DEFAULT_TIME[def.reportId] ?? '07:00',
      recipients: saved?.recipients ?? [],
      sections: saved?.sections ?? DEFAULT_SECTIONS[def.reportId] ?? [],
      runCount: saved?.runCount ?? 0,
      lastGenerated: saved?.lastGenerated ?? null,
    };
  };

  const persist = async (report: ReportRow, changes: Partial<ReportRow>) => {
    const merged = { ...report, ...changes };
    await saveReportConfiguration(report.reportId, {
      day: merged.day,
      time: merged.time,
      recipients: merged.recipients,
      sections: merged.sections,
      status: merged.status,
      ownerUserId: report.ownerUserId,
      storeId: report.storeId,
    }, companyId);
    await load();
  };

  const handleToggle = async (report: ReportRow) => {
    const activating = report.status !== 'attivo';
    try {
      await persist(report, { status: activating ? 'attivo' : 'sospeso' });
      showToast(
        activating
          ? (isIt ? 'Invio automatico attivato.' : 'Automatic sending activated.')
          : (isIt ? 'Invio automatico messo in pausa.' : 'Automatic sending paused.'),
        'success',
      );
    } catch (err) {
      console.error('Failed to toggle report:', err);
      showToast(isIt ? 'Impossibile aggiornare lo stato.' : 'Failed to update status.', 'error');
    }
  };

  const handleSave = async (changes: Partial<ReportRow>) => {
    if (!editing) return;
    try {
      // Saving pauses the schedule: the user must explicitly re-activate, so a
      // half-finished edit never goes out to real recipients.
      await persist(editing.report, { ...changes, status: 'sospeso' });
      showToast(
        isIt ? 'Salvato. Attiva il report per riprendere gli invii.' : 'Saved. Activate the report to resume sending.',
        'success',
      );
      setEditing(null);
    } catch (err) {
      console.error('Failed to save report:', err);
      showToast(isIt ? 'Errore durante il salvataggio.' : 'Failed to save.', 'error');
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleDownload = async (report: ReportRow) => {
    try {
      showToast(isIt ? 'Generazione del PDF in corso...' : 'Generating PDF...', 'info');
      const blob = await downloadLastReport(report.reportId, companyId, report.ownerUserId);
      downloadBlob(blob, `${report.reportId}.pdf`);
      showToast(isIt ? 'Report scaricato.' : 'Report downloaded.', 'success');
    } catch (err) {
      console.error('Failed to download report:', err);
      showToast(isIt ? 'Impossibile scaricare il report.' : 'Failed to download report.', 'error');
    }
  };

  const handleDownloadArchived = async (item: ReportHistoryItem) => {
    try {
      const blob = await downloadArchivedReport(item.id, companyId);
      downloadBlob(blob, `${item.reportId}-${item.targetDate.slice(0, 10)}.pdf`);
      showToast(isIt ? 'Report scaricato.' : 'Report downloaded.', 'success');
    } catch (err) {
      console.error('Failed to download archived report:', err);
      showToast(isIt ? 'Impossibile scaricare il report.' : 'Failed to download report.', 'error');
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const next = await getReportHistory(companyId, { limit: ARCHIVE_PAGE_SIZE, offset: history.length });
      setHistory(prev => [...prev, ...next.items]);
      setHistoryTotal(next.total);
      loadedCountRef.current = history.length + next.items.length;
    } catch (err) {
      console.error('Failed to load more:', err);
      showToast(isIt ? 'Impossibile caricare altri report.' : 'Unable to load more reports.', 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteArchivedReport(target.id, companyId);
      setHistory(prev => prev.filter(i => i.id !== target.id));
      setHistoryTotal(prev => Math.max(0, prev - 1));
      loadedCountRef.current = Math.max(ARCHIVE_PAGE_SIZE, loadedCountRef.current - 1);
      showToast(isIt ? 'Report eliminato.' : 'Report deleted.', 'success');
    } catch (err) {
      console.error('Failed to delete report:', err);
      showToast(isIt ? 'Impossibile eliminare il report.' : 'Unable to delete report.', 'error');
    }
  };

  const allRows = owners.flatMap(o => o.reports.map(d => rowFor(o, d)));
  const totalActive = allRows.filter(r => r.status === 'attivo').length;
  const totalRuns = allRows.reduce((sum, r) => sum + r.runCount, 0);

  return (
    <div className="page-enter" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: 0, letterSpacing: '-0.02em' }}>
            {t('nav.reports')}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '3px 0 0' }}>
            {isIt
              ? `${totalActive} report attivi su ${allRows.length} · ${totalRuns} generati`
              : `${totalActive} of ${allRows.length} reports active · ${totalRuns} generated`}
          </p>
        </div>

        {isSuperAdmin && companies.length > 0 && (
          <select
            value={selectedCompanyId || ''}
            onChange={e => setSelectedCompanyId(Number(e.target.value))}
            style={{
              padding: '8px 14px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13,
              fontWeight: 600, outline: 'none', cursor: 'pointer',
            }}
          >
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {loading && (
        <Card padding="md" style={{ textAlign: 'center', color: 'var(--text-disabled)', fontSize: 13 }}>
          {isIt ? 'Caricamento...' : 'Loading...'}
        </Card>
      )}

      {!loading && owners.length === 0 && (
        <Card padding="md" style={{ textAlign: 'center', color: 'var(--text-disabled)', fontSize: 13 }}>
          {isIt
            ? 'Nessun destinatario configurato. Assegna un Admin o un HR a questa azienda.'
            : 'No report owners configured. Assign an Admin or HR user to this company.'}
        </Card>
      )}

      {/* One section per owner: Admin first, then each HR with their store */}
      {!loading && owners.map(owner => (
        <OwnerSection
          key={owner.userId}
          owner={owner}
          reports={owner.reports.map(d => rowFor(owner, d))}
          onToggle={handleToggle}
          onConfigure={r => setEditing({ report: r, ownerName: `${owner.name} · ${owner.scopeLabel}` })}
          onDownload={handleDownload}
        />
      ))}

      {/* Archive */}
      {!loading && (
        <Card padding="none" style={{ marginTop: 8 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {isIt ? 'Archivio report' : 'Report archive'}
              </h3>
              <p style={{ fontSize: 11.5, color: 'var(--text-disabled)', margin: '2px 0 0' }}>
                {isIt ? 'PDF generati automaticamente' : 'Automatically generated PDFs'}
              </p>
            </div>
            {historyTotal > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{history.length} / {historyTotal}</span>
            )}
          </div>

          {history.length === 0 ? (
            <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-disabled)', fontSize: 13 }}>
              {isIt
                ? 'Nessun report generato finora. Attiva un report o scarica un PDF per iniziare.'
                : 'No reports generated yet. Activate a report or download a PDF to start.'}
            </div>
          ) : (
            history.map((item, i) => (
              <div key={item.id} style={{
                padding: isMobile ? '12px 16px' : '12px 20px',
                borderBottom: i < history.length - 1 ? '1px solid var(--surface-warm)' : 'none',
                display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 10 : 14,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t(`reports.data.${item.reportId}.name`, item.reportId)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-disabled)' }}>
                    {formatDateTime(item.generatedAt, i18n.language)} · {formatBytes(item.sizeBytes)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleDownloadArchived(item)} style={{ padding: '7px 12px', background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', flex: isMobile ? 1 : 'none' }}>
                    {isIt ? 'Scarica' : 'Download'}
                  </button>
                  {/* Deleting an archived PDF is admin-only; it stays regenerable. */}
                  {user?.role !== 'hr' && (
                    <button onClick={() => setDeleteTarget(item)} aria-label={isIt ? 'Elimina' : 'Delete'} style={{ padding: '7px 10px', background: 'transparent', color: '#DC2626', border: '1.5px solid var(--border)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          {history.length < historyTotal && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--surface-warm)', display: 'flex', justifyContent: 'center' }}>
              <button onClick={handleLoadMore} disabled={loadingMore} style={{
                padding: '9px 20px', background: 'transparent', color: 'var(--text-secondary)',
                border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 12, fontWeight: 600,
                cursor: loadingMore ? 'wait' : 'pointer', fontFamily: 'var(--font-body)', opacity: loadingMore ? 0.6 : 1,
              }}>
                {loadingMore
                  ? (isIt ? 'Caricamento...' : 'Loading...')
                  : `${isIt ? 'Carica altri' : 'Load more'} (+${Math.min(ARCHIVE_PAGE_SIZE, historyTotal - history.length)})`}
              </button>
            </div>
          )}
        </Card>
      )}

      {editing && (
        <ConfigModal
          report={editing.report}
          ownerName={editing.ownerName}
          companyId={companyId}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        variant="danger"
        title={isIt ? 'Eliminare il report?' : 'Delete report?'}
        message={deleteTarget
          ? (isIt
            ? `Il PDF del ${formatDateTime(deleteTarget.generatedAt, i18n.language)} sara rimosso dall'archivio. Puo essere rigenerato in seguito.`
            : `The PDF from ${formatDateTime(deleteTarget.generatedAt, i18n.language)} will be removed from the archive. It can be regenerated later.`)
          : ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default ReportsPage;
