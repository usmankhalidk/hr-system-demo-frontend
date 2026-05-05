
// Phase 4: Automated Reports Management
// Configure, schedule, preview and download automated PDF reports

const { useState } = React;

const REPORTS_DATA = [
  {
    id: 'hr_weekly',
    name: 'Report HR Settimanale',
    desc: 'Riepilogo settimanale completo: presenze, anomalie, turni, ferie, onboarding. Inviato ogni lunedì ai destinatari HR.',
    schedule: 'Ogni lunedì alle 07:00',
    nextRun: 'Lun 28/04/2026 · 07:00',
    lastGenerated: 'Lun 21/04/2026 · 07:02',
    lastSize: '1.2 MB',
    status: 'attivo',
    recipients: ['hr@fusaro.it', 'admin@fusaro.it'],
    sections: ['Riepilogo presenze', 'Anomalie rilevate', 'Turni confermati', 'Richieste ferie', 'Onboarding in corso'],
    roles: ['hr', 'admin'],
    color: '#0284C7',
    runCount: 18,
  },
  {
    id: 'admin_monthly',
    name: 'Report Admin Mensile',
    desc: 'Report mensile direzionale con KPI completi: organico, costi, performance negozi, funnel ATS, scadenze critiche.',
    schedule: '1° del mese alle 07:00',
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
    name: 'Report HR Mensile',
    desc: 'Report mensile HR con focus su personale: assunzioni, dimissioni, turnover, ferie, formazioni e visite mediche in scadenza.',
    schedule: '1° del mese alle 08:00',
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
    name: 'Alert Giornaliero HR (ATS)',
    desc: 'Riepilogo operativo giornaliero per HR: candidati non letti, colloqui mancanti, feedback assenti, pipeline bloccata.',
    schedule: 'Ogni giorno (lun–ven) alle 08:00',
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

const AVAILABLE_SECTIONS = {
  hr_weekly: ['Riepilogo presenze', 'Anomalie rilevate', 'Turni confermati', 'Richieste ferie', 'Onboarding in corso', 'Scadenze formazioni', 'Scadenze visite mediche'],
  admin_monthly: ['Organico e variazioni', 'KPI presenze', 'Copertura turni', 'ATS funnel', 'Scadenze contratti', 'Scadenze formazioni', 'Budget e costi', 'Store comparison'],
  hr_monthly: ['Variazioni organico', 'Ferie & permessi', 'Scadenze formazioni', 'Scadenze visite mediche', 'Contratti in scadenza', 'Turnover mensile'],
  anomaly_daily: ['Candidati non letti', 'Colloqui non pianificati', 'Feedback mancanti', 'Pipeline bloccata'],
};

const STATUS_CONFIG = {
  attivo: { label: 'Attivo', color: '#15803D', bg: '#F0FDF4', border: 'rgba(21,128,61,0.2)' },
  sospeso: { label: 'Sospeso', color: '#B45309', bg: '#FFFBEB', border: 'rgba(180,83,9,0.2)' },
  errore: { label: 'Errore', color: '#DC2626', bg: '#FEF2F2', border: 'rgba(220,38,38,0.2)' },
};

function ReportCard({ report, onEdit, onRun, selected, onSelect }) {
  const status = STATUS_CONFIG[report.status];
  return (
    <Card style={{
      cursor: 'pointer', transition: 'all 0.15s ease',
      border: selected ? `1.5px solid ${report.color}` : '1px solid #E4E1DA',
      boxShadow: selected ? `0 0 0 3px ${report.color}20` : '0 1px 4px rgba(0,0,0,0.06)',
    }} onClick={onSelect}>
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
              <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>{report.name}</h3>
              <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, color: status.color, background: status.bg, border: `1px solid ${status.border}`, flexShrink: 0 }}>{status.label}</span>
            </div>
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>{report.desc}</p>
          </div>
        </div>

        {/* Meta */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Frequenza', value: report.schedule },
            { label: 'Prossima esecuzione', value: report.nextRun },
            { label: 'Ultima generazione', value: report.lastGenerated },
            { label: 'Report generati', value: `${report.runCount} totali · ${report.lastSize}` },
          ].map(m => (
            <div key={m.label} style={{ background: '#F7F5F1', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Recipients */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Destinatari</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {report.recipients.map(r => (
              <span key={r} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: '#F2F0EC', color: '#374151', border: '1px solid #E4E1DA' }}>📧 {r}</span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid #F2F0EC' }}>
          <button onClick={e => { e.stopPropagation(); onRun(); }} style={{
            padding: '7px 14px', background: report.color, color: '#FFF', border: 'none',
            borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Esegui ora
          </button>
          <button onClick={e => { e.stopPropagation(); onEdit(); }} style={{
            padding: '7px 14px', background: 'transparent', color: '#374151',
            border: '1.5px solid #E4E1DA', borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
          }}>Configura</button>
          <button onClick={e => e.stopPropagation()} style={{
            padding: '7px 14px', background: 'transparent', color: '#374151',
            border: '1.5px solid #E4E1DA', borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Scarica ultimo
          </button>
        </div>
      </div>
    </Card>
  );
}

function ConfigModal({ report, onClose }) {
  const [recipients, setRecipients] = useState([...report.recipients]);
  const [newEmail, setNewEmail] = useState('');
  const [sections, setSections] = useState(new Set(report.sections));
  const available = AVAILABLE_SECTIONS[report.id] || report.sections;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(13,33,55,0.55)', backdropFilter: 'blur(4px)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#FFF', borderRadius: 16, width: 560, maxHeight: '85vh',
        overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }} onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E4E1DA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Configura report</h2>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>{report.name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Schedule (read-only) */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>FREQUENZA</label>
            <div style={{ padding: '10px 14px', background: '#F7F5F1', borderRadius: 8, fontSize: 13, color: '#6B7280' }}>{report.schedule}</div>
          </div>

          {/* Recipients */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>DESTINATARI EMAIL</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder="aggiungi@email.it"
                style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #E4E1DA', borderRadius: 6, fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
                onKeyDown={e => { if (e.key === 'Enter' && newEmail.includes('@')) { setRecipients([...recipients, newEmail]); setNewEmail(''); }}}
              />
              <button onClick={() => { if (newEmail.includes('@')) { setRecipients([...recipients, newEmail]); setNewEmail(''); }}}
                style={{ padding: '8px 16px', background: '#0D2137', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                Aggiungi
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {recipients.map((r, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: '#F2F0EC', border: '1px solid #E4E1DA', fontSize: 12, color: '#374151' }}>
                  {r}
                  <button onClick={() => setRecipients(recipients.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, display: 'flex' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Sections */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>SEZIONI INCLUSE</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {available.map(sec => (
                <label key={sec} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, background: sections.has(sec) ? `${report.color}08` : '#F7F5F1', border: `1px solid ${sections.has(sec) ? report.color + '30' : 'transparent'}`, transition: 'all 0.12s' }}>
                  <input type="checkbox" checked={sections.has(sec)} onChange={() => {
                    const next = new Set(sections);
                    next.has(sec) ? next.delete(sec) : next.add(sec);
                    setSections(next);
                  }} style={{ accentColor: report.color, width: 15, height: 15 }} />
                  <span style={{ fontSize: 13, color: '#374151' }}>{sec}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>STATO</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {['attivo', 'sospeso'].map(s => {
                const cfg = STATUS_CONFIG[s];
                return (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 14px', borderRadius: 8, background: report.status === s ? cfg.bg : '#F7F5F1', border: `1px solid ${report.status === s ? cfg.border : 'transparent'}` }}>
                    <input type="radio" name="status" value={s} defaultChecked={report.status === s} style={{ accentColor: cfg.color }} />
                    <span style={{ fontSize: 13, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #E4E1DA', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', background: 'transparent', color: '#374151', border: '1.5px solid #E4E1DA', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Annulla</button>
          <button onClick={onClose} style={{ padding: '9px 20px', background: '#0D2137', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Salva modifiche</button>
        </div>
      </div>
    </div>
  );
}

function RunToast({ report, onClose }) {
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 2000,
      background: '#0D2137', color: '#FFF', borderRadius: 12, padding: '14px 20px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 12,
      animation: 'fadeSlideUp 0.3s ease',
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#C9973A', animation: 'pulse 1s infinite' }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Generazione in corso...</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{report.name} · Riceverai email a destinatari configurati</div>
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', marginLeft: 8 }}>✕</button>
    </div>
  );
}

function ReportsPage() {
  const [reports, setReports] = useState(REPORTS_DATA);
  const [selectedId, setSelectedId] = useState(null);
  const [editReport, setEditReport] = useState(null);
  const [runningReport, setRunningReport] = useState(null);

  const handleRun = (report) => {
    setRunningReport(report);
    setTimeout(() => setRunningReport(null), 4000);
  };

  const totalActive = reports.filter(r => r.status === 'attivo').length;
  const totalRuns = reports.reduce((s, r) => s + r.runCount, 0);

  return (
    <PageShell
      title="Report Automatici"
      subtitle={`${totalActive}/${reports.length} report attivi · ${totalRuns} esecuzioni totali`}
      headerRight={
        <button style={{ padding: '8px 18px', background: '#C9973A', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuovo report
        </button>
      }
    >
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Report attivi', value: totalActive, color: '#15803D', icon: '✓' },
          { label: 'Esecuzioni totali', value: totalRuns, color: '#0284C7', icon: '▶' },
          { label: 'Prossima esecuzione', value: 'Lun 28/04', color: '#C9973A', icon: '⏰' },
          { label: 'Archivio report', value: `${totalRuns} PDF`, color: '#7C3AED', icon: '📁' },
        ].map(s => (
          <Card key={s.label} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Sora', sans-serif", color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Execution timeline */}
      <Card style={{ padding: '18px 22px', marginBottom: 24 }}>
        <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 14px' }}>Calendario esecuzioni</h3>
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
          {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day, i) => (
            <div key={day} style={{ flex: 1, minWidth: 80, padding: '8px 0', borderRight: i < 6 ? '1px solid #F2F0EC' : 'none', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginBottom: 8 }}>{day}</div>
              {i === 0 && <div style={{ fontSize: 10, padding: '3px 6px', background: '#0284C7', color: '#FFF', borderRadius: 4, margin: '0 4px 4px', fontWeight: 600 }}>Report HR Set.</div>}
              {i === 0 && <div style={{ fontSize: 10, padding: '3px 6px', background: '#7C3AED', color: '#FFF', borderRadius: 4, margin: '0 4px 4px', fontWeight: 600 }}>Report HR Men.</div>}
              {[0,1,2,3,4].includes(i) && <div style={{ fontSize: 10, padding: '3px 6px', background: '#DC2626', color: '#FFF', borderRadius: 4, margin: '0 4px', fontWeight: 600 }}>Alert ATS</div>}
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
            selected={selectedId === report.id}
            onSelect={() => setSelectedId(selectedId === report.id ? null : report.id)}
            onEdit={() => setEditReport(report)}
            onRun={() => handleRun(report)}
          />
        ))}
      </div>

      {/* Archive section */}
      <Card style={{ marginTop: 24 }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #E4E1DA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Archivio report recenti</h3>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>Ultimi 10 report generati · scaricabili in PDF</p>
          </div>
          <button style={{ padding: '6px 14px', background: 'transparent', color: '#374151', border: '1.5px solid #E4E1DA', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Vedi archivio completo</button>
        </div>
        <div>
          {[
            { name: 'Report HR Settimanale', date: '21/04/2026', size: '1.2 MB', color: '#0284C7' },
            { name: 'Alert Giornaliero HR (ATS)', date: '25/04/2026', size: '0.3 MB', color: '#DC2626' },
            { name: 'Alert Giornaliero HR (ATS)', date: '24/04/2026', size: '0.3 MB', color: '#DC2626' },
            { name: 'Report HR Mensile', date: '01/04/2026', size: '2.1 MB', color: '#7C3AED' },
            { name: 'Report Admin Mensile', date: '01/04/2026', size: '3.8 MB', color: '#C9973A' },
          ].map((item, i) => (
            <div key={i} style={{
              padding: '14px 22px', borderBottom: i < 4 ? '1px solid #F2F0EC' : 'none',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${item.color}12`, border: `1px solid ${item.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{item.name}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>Generato il {item.date} · {item.size}</div>
              </div>
              <button style={{ padding: '5px 12px', background: 'transparent', color: '#374151', border: '1.5px solid #E4E1DA', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Scarica PDF
              </button>
            </div>
          ))}
        </div>
      </Card>

      {editReport && <ConfigModal report={editReport} onClose={() => setEditReport(null)} />}
      {runningReport && <RunToast report={runningReport} onClose={() => setRunningReport(null)} />}
    </PageShell>
  );
}

Object.assign(window, { ReportsPage });
