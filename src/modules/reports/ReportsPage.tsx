import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TimePicker } from '../../components/ui/TimePicker';

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
  lastGenerated: string;
  day?: number; // 1 (Mon) - 5 (Fri)
  time?: string; // HH:MM
}

function getNextExecution(day: number, time: string, lang: string): string {
  if (!day || !time) return '--/--/---- · --:--';
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  let daysUntil = (day - now.getDay() + 7) % 7;
  if (daysUntil === 0 && next.getTime() <= now.getTime()) {
    daysUntil = 7;
  }
  
  next.setDate(now.getDate() + daysUntil);
  
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

const INITIAL_REPORTS_DATA: ReportData[] = [
  {
    id: 'hr_weekly',
    nextRun: 'Lun 28/04/2026 · 07:00',
    lastGenerated: 'Lun 21/04/2026 · 07:02',
    lastSize: '1.2 MB',
    status: 'attivo',
    recipients: ['hr@fusaro.it', 'admin@fusaro.it'],
    sections: ['Riepilogo presenze', 'Anomalie rilevate', 'Turni confermati', 'Richieste ferie', 'Onboarding in corso'],
    roles: ['hr', 'admin'],
    color: '#0284C7',
    runCount: 18,
    day: 1,
    time: '07:00',
  },
  {
    id: 'admin_monthly',
    nextRun: '01/05/2026 · 07:00',
    lastGenerated: '01/04/2026 · 07:05',
    lastSize: '3.8 MB',
    status: 'attivo',
    recipients: ['admin@fusaro.it', 'direzione@fusaro.it'],
    sections: ['Organico e variazioni', 'KPI presenze', 'Copertura turni', 'ATS funnel', 'Scadenze contratti', 'Scadenze formazioni'],
    roles: ['admin'],
    color: '#C9973A',
    runCount: 4,
  },
  {
    id: 'hr_monthly',
    nextRun: '01/05/2026 · 08:00',
    lastGenerated: '01/04/2026 · 08:03',
    lastSize: '2.1 MB',
    status: 'attivo',
    recipients: ['hr@fusaro.it'],
    sections: ['Variazioni organico', 'Ferie & permessi', 'Scadenze formazioni', 'Scadenze visite mediche', 'Contratti in scadenza'],
    roles: ['hr', 'admin'],
    color: '#7C3AED',
    runCount: 4,
  },
  {
    id: 'anomaly_daily',
    nextRun: 'Dom 28/04/2026 · 08:00',
    lastGenerated: 'Ven 25/04/2026 · 08:01',
    lastSize: '0.3 MB',
    status: 'attivo',
    recipients: ['hr@fusaro.it'],
    sections: ['Candidati non letti', 'Colloqui non pianificati', 'Feedback mancanti', 'Pipeline bloccata'],
    roles: ['hr'],
    color: '#DC2626',
    runCount: 63,
  },
];

const AVAILABLE_SECTIONS: Record<string, string[]> = {
  hr_weekly: ['Riepilogo presenze', 'Anomalie rilevate', 'Turni confermati', 'Richieste ferie', 'Onboarding in corso', 'Scadenze formazioni', 'Scadenze visite mediche'],
  admin_monthly: ['Organico e variazioni', 'KPI presenze', 'Copertura turni', 'ATS funnel', 'Scadenze contratti', 'Scadenze formazioni', 'Budget e costi', 'Store comparison'],
  hr_monthly: ['Variazioni organico', 'Ferie & permessi', 'Scadenze formazioni', 'Scadenze visite mediche', 'Contratti in scadenza', 'Turnover mensile'],
  anomaly_daily: ['Candidati non letti', 'Colloqui non pianificati', 'Feedback mancanti', 'Pipeline bloccata'],
};

function ReportCard({ report, onEdit, onRun }: { 
  report: ReportData; 
  onEdit: () => void; 
  onRun: () => void; 
}) {
  const { t } = useTranslation();
  
  const STATUS_CONFIG = {
    attivo: { label: t('reports.status.active'), color: '#15803D', bg: '#F0FDF4', border: 'rgba(21,128,61,0.2)' },
    sospeso: { label: t('reports.status.suspended'), color: '#B45309', bg: '#FFFBEB', border: 'rgba(180,83,9,0.2)' },
    errore: { label: t('reports.status.error'), color: '#DC2626', bg: '#FEF2F2', border: 'rgba(220,38,38,0.2)' },
  };

  const status = STATUS_CONFIG[report.status];
  const name = t(`reports.data.${report.id}.name`);
  const desc = t(`reports.data.${report.id}.desc`);
  
  const displayFrequency = (report.id === 'hr_weekly' && report.day && report.time)
    ? `${t(`reports.days.${report.day}`)} ${report.time}`
    : t(`reports.data.${report.id}.schedule`);

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
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/>
              <line x1="8" y1="17" x2="13" y2="17"/>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {[
            { label: t('reports.card.frequency'), value: displayFrequency },
            { label: t('reports.card.nextRun'), value: report.nextRun },
            { label: t('reports.card.lastGenerated'), value: report.lastGenerated },
            { label: t('reports.card.totalReports'), value: `${report.runCount} ${t('reports.stats.executionsSuffix')} · ${report.lastSize}` },
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
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <button onClick={onRun} style={{
            padding: '7px 14px', background: report.color, color: '#FFF', border: 'none',
            borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            {t('reports.card.runNow')}
          </button>
          <button onClick={onEdit} style={{
            padding: '7px 14px', background: 'transparent', color: 'var(--text-secondary)',
            border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>{t('reports.card.configure')}</button>
          <button style={{
            padding: '7px 14px', background: 'transparent', color: 'var(--text-secondary)',
            border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {t('reports.card.downloadLast')}
          </button>
        </div>
      </div>
    </Card>
  );
}

function ConfigModal({ report, onClose, onSave }: { report: ReportData; onClose: () => void; onSave: (data: Partial<ReportData>) => void }) {
  const { t } = useTranslation();
  const [recipients, setRecipients] = useState([...report.recipients]);
  const [newEmail, setNewEmail] = useState('');
  const [sections, setSections] = useState(new Set(report.sections));
  const [day, setDay] = useState<number>(report.day || 1);
  const [time, setTime] = useState<string>(report.time || '07:00');
  const [status, setStatus] = useState<ReportData['status']>(report.status);

  const available = AVAILABLE_SECTIONS[report.id] || report.sections;
  
  const STATUS_CONFIG = {
    attivo: { label: t('reports.status.active'), color: '#15803D', bg: '#F0FDF4', border: 'rgba(21,128,61,0.2)' },
    sospeso: { label: t('reports.status.suspended'), color: '#B45309', bg: '#FFFBEB', border: 'rgba(180,83,9,0.2)' },
  };

  const name = t(`reports.data.${report.id}.name`);

  const handleSave = () => {
    onSave({
      recipients,
      sections: Array.from(sections),
      day,
      time,
      status
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Frequency Selection */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>{t('reports.modal.frequencyLabel')}</label>
            <div style={{ display: 'flex', gap: 12 }}>
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
                  {[1, 2, 3, 4, 5].map(d => (
                    <option key={d} value={d}>{t(`reports.days.${d}`)}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <TimePicker value={time} onChange={setTime} />
              </div>
            </div>
          </div>

          {/* Recipients */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>{t('reports.modal.recipientsLabel')}</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder={t('reports.modal.emailPlaceholder')}
                style={{ flex: 1, padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }}
                onKeyDown={e => { if (e.key === 'Enter' && newEmail.includes('@')) { setRecipients([...recipients, newEmail]); setNewEmail(''); }}}
              />
              <button onClick={() => { if (newEmail.includes('@')) { setRecipients([...recipients, newEmail]); setNewEmail(''); }}}
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
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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

          {/* Status */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>{t('reports.modal.statusLabel')}</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {['attivo', 'sospeso'].map(s => {
                const cfg = STATUS_CONFIG[s as keyof typeof STATUS_CONFIG];
                return (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', borderRadius: 8, background: status === s ? cfg.bg : 'var(--surface-warm)', border: `1px solid ${status === s ? cfg.border : 'transparent'}` }}>
                    <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s as any)} style={{ accentColor: cfg.color }} />
                    <span style={{ fontSize: 13, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>{t('reports.modal.cancel')}</button>
          <button onClick={handleSave} style={{ padding: '9px 20px', background: 'var(--primary)', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>{t('reports.modal.save')}</button>
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
  const { t, i18n } = useTranslation();

  const handleRun = (report: ReportData) => {
    setRunningReport(report);
    setTimeout(() => setRunningReport(null), 4000);
  };

  const handleSaveReport = (newData: Partial<ReportData>) => {
    if (!editReport) return;
    
    setReports(prev => prev.map(r => {
      if (r.id === editReport.id) {
        const updated = { ...r, ...newData };
        if (updated.id === 'hr_weekly' && updated.day && updated.time) {
          updated.nextRun = getNextExecution(updated.day, updated.time, i18n.language);
        }
        return updated;
      }
      return r;
    }));
    
    setEditReport(null);
  };

  const totalActive = reports.filter(r => r.status === 'attivo').length;
  const totalRuns = reports.reduce((s, r) => s + r.runCount, 0);

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
            {t('reports.subtitle', { active: totalActive, total: reports.length, runs: totalRuns })}
          </p>
        </div>
        <button style={{ 
          padding: '9px 18px', background: '#C9973A', color: '#FFF', border: 'none', 
          borderRadius: 'var(--radius)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', 
          fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 7,
          boxShadow: '0 2px 8px rgba(13,33,55,0.18)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {t('reports.newReport')}
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('reports.stats.active'), value: totalActive, color: '#15803D', icon: '✓' },
          { label: t('reports.stats.totalRuns'), value: totalRuns, color: '#0284C7', icon: '▶' },
          { label: t('reports.stats.nextRun'), value: reports.find(r => r.id === 'hr_weekly')?.nextRun.split(' · ')[0] || t('reports.mock.nextRunDate'), color: '#C9973A', icon: '⏰' },
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
              {i === 0 && <div style={{ fontSize: 10, padding: '3px 6px', background: '#0284C7', color: '#FFF', borderRadius: 4, margin: '0 4px 4px', fontWeight: 600 }}>{t('reports.data.hr_weekly.name')}</div>}
              {i === 0 && <div style={{ fontSize: 10, padding: '3px 6px', background: '#7C3AED', color: '#FFF', borderRadius: 4, margin: '0 4px 4px', fontWeight: 600 }}>{t('reports.data.hr_monthly.name')}</div>}
              {[0,1,2,3,4].includes(i) && <div style={{ fontSize: 10, padding: '3px 6px', background: '#DC2626', color: '#FFF', borderRadius: 4, margin: '0 4px', fontWeight: 600 }}>{t('reports.data.anomaly_daily.name')}</div>}
            </div>
          ))}
        </div>
      </Card>

      {/* Reports grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {reports.map(report => (
          <ReportCard
            key={report.id}
            report={report}
            onEdit={() => setEditReport(report)}
            onRun={() => handleRun(report)}
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
          <button style={{ padding: '6px 14px', background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>{t('reports.archive.viewFull')}</button>
        </div>
        <div>
          {[
            { id: 'hr_weekly', date: t('reports.mock.hrWeeklyDate'), size: '1.2 MB', color: '#0284C7' },
            { id: 'anomaly_daily', date: t('reports.mock.anomalyDailyDate1'), size: '0.3 MB', color: '#DC2626' },
            { id: 'anomaly_daily', date: t('reports.mock.anomalyDailyDate2'), size: '0.3 MB', color: '#DC2626' },
            { id: 'hr_monthly', date: t('reports.mock.hrMonthlyDate'), size: '2.1 MB', color: '#7C3AED' },
            { id: 'admin_monthly', date: t('reports.mock.adminMonthlyDate'), size: '3.8 MB', color: '#C9973A' },
          ].map((item, i, arr) => (
            <div key={i} style={{
              padding: '14px 22px', borderBottom: i < arr.length - 1 ? '1px solid var(--surface-warm)' : 'none',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${item.color}12`, border: `1px solid ${item.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t(`reports.data.${item.id}.name`)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-disabled)' }}>{t('reports.archive.generatedOn')} {item.date} · {item.size}</div>
              </div>
              <button style={{ padding: '5px 12px', background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {t('reports.archive.downloadPdf')}
              </button>
            </div>
          ))}
        </div>
      </Card>

      {editReport && <ConfigModal report={editReport} onClose={() => setEditReport(null)} onSave={handleSaveReport} />}
      {runningReport && <RunToast report={runningReport} onClose={() => setRunningReport(null)} />}
    </div>
  );
}

export default ReportsPage;
