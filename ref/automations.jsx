
// Phase 3: Automations Control Panel
// Admin ON/OFF for every automation in the system

const { useState } = React;

const AUTOMATIONS = [
  {
    category: 'Dipendenti & Onboarding',
    accent: '#0284C7',
    items: [
      { id: 'benvenuto_email', icon: 'mail', label: 'Email di benvenuto', desc: 'Invio automatico email di benvenuto al nuovo dipendente con le credenziali di accesso.', roles: ['employee'], trigger: 'Creazione dipendente', lastRun: '2 ore fa', enabled: true },
      { id: 'onboarding_reminder', icon: 'clipboard', label: 'Promemoria onboarding', desc: 'Invia promemoria ai dipendenti con attività onboarding scadute o in scadenza entro 48h.', roles: ['employee', 'store_manager'], trigger: 'Ogni giorno alle 09:00', lastRun: 'Oggi 09:00', enabled: true },
      { id: 'compleanno_banner', icon: 'star', label: 'Banner buon compleanno', desc: 'Visualizza il banner "Buon Compleanno da Fusaro" sulla home del dipendente il giorno del compleanno.', roles: ['employee'], trigger: 'Giorno compleanno', lastRun: '3 giorni fa', enabled: true },
      { id: 'compleanno_email', icon: 'mail', label: 'Email buon compleanno', desc: 'Invia email automatica di auguri al dipendente il giorno del compleanno.', roles: ['employee'], trigger: 'Giorno compleanno', lastRun: '3 giorni fa', enabled: false },
    ],
  },
  {
    category: 'Presenze & Turni',
    accent: '#DC2626',
    items: [
      { id: 'anomalia_ritardo', icon: 'clock', label: 'Alert ritardo', desc: 'Notifica il Store Manager e l\'Area Manager quando un dipendente arriva con più di 10 minuti di ritardo.', roles: ['store_manager', 'area_manager'], trigger: 'Check-in tardivo', lastRun: 'Oggi 09:28', enabled: true },
      { id: 'anomalia_noshow', icon: 'alert', label: 'Alert assenza non giustificata', desc: 'Notifica urgente quando un dipendente non effettua il check-in entro 30 min dall\'inizio turno.', roles: ['store_manager', 'area_manager', 'hr'], trigger: '30 min dopo inizio turno', lastRun: 'Oggi 09:30', enabled: true },
      { id: 'turno_scoperto', icon: 'calendar', label: 'Alert turno scoperto', desc: 'Notifica HR e Area Manager quando un turno è pianificato ma non ha un dipendente assegnato.', roles: ['hr', 'area_manager'], trigger: '24h prima inizio turno', lastRun: 'Ieri 18:00', enabled: true },
      { id: 'approvazione_turni', icon: 'check', label: 'Promemoria approvazione turni', desc: 'Ricorda all\'HR di approvare i turni in stato "Pianificato" da più di 48h.', roles: ['hr'], trigger: 'Ogni 48h se ci sono turni in attesa', lastRun: 'Ieri 10:00', enabled: false },
    ],
  },
  {
    category: 'Documenti & Firma',
    accent: '#C9973A',
    items: [
      { id: 'firma_promemoria', icon: 'pen', label: 'Promemoria firma documenti', desc: 'Invia promemoria al dipendente per documenti non firmati dopo 24h dall\'invio.', roles: ['employee'], trigger: '24h dopo invio documento', lastRun: 'Ieri 14:00', enabled: true },
      { id: 'scadenza_formazione', icon: 'graduation', label: 'Alert scadenza formazioni', desc: 'Notifica HR 60 giorni prima della scadenza di formazioni o corsi obbligatori del dipendente.', roles: ['hr'], trigger: '60 giorni prima scadenza', lastRun: '5 giorni fa', enabled: true },
      { id: 'scadenza_visita', icon: 'medical', label: 'Alert scadenza visita medica', desc: 'Notifica HR 60 giorni prima della scadenza della visita medica obbligatoria.', roles: ['hr'], trigger: '60 giorni prima scadenza', lastRun: '5 giorni fa', enabled: true },
      { id: 'routing_documenti', icon: 'doc', label: 'Routing automatico documenti', desc: 'Distribuisce automaticamente i documenti caricati in bulk ai dipendenti tramite nome/cognome o ID univoco.', roles: ['employee'], trigger: 'Upload ZIP', lastRun: '2 giorni fa', enabled: true },
    ],
  },
  {
    category: 'Ferie & Permessi',
    accent: '#7C3AED',
    items: [
      { id: 'ferie_approvazione', icon: 'umbrella', label: 'Notifica richiesta ferie', desc: 'Invia notifica al responsabile quando un dipendente presenta una richiesta di ferie o permesso.', roles: ['store_manager', 'area_manager', 'hr'], trigger: 'Nuova richiesta ferie', lastRun: 'Oggi 11:00', enabled: true },
      { id: 'ferie_esito', icon: 'umbrella', label: 'Notifica esito ferie al dipendente', desc: 'Informa il dipendente via in-app e email quando la richiesta è approvata o rifiutata.', roles: ['employee'], trigger: 'Cambio stato richiesta', lastRun: 'Oggi 11:15', enabled: true },
    ],
  },
  {
    category: 'ATS & Recruiting',
    accent: '#15803D',
    items: [
      { id: 'ats_candidato_ricevuto', icon: 'briefcase', label: 'Email ricevuta candidatura', desc: 'Invia email automatica di conferma al candidato appena applica per una posizione.', roles: [], trigger: 'Nuova candidatura', lastRun: '1 ora fa', enabled: true },
      { id: 'ats_invito_colloquio', icon: 'calendar', label: 'Invito colloquio con ICS', desc: 'Invia al candidato email con invito al colloquio e allegato .ics per aggiungere al calendario.', roles: [], trigger: 'Colloquio pianificato', lastRun: '3 ore fa', enabled: true },
      { id: 'ats_esito', icon: 'check', label: 'Notifica esito candidatura', desc: 'Invia email al candidato per comunicare l\'esito del processo di selezione (assunto o rifiutato).', roles: [], trigger: 'Cambio stage candidato', lastRun: 'Ieri 16:30', enabled: true },
      { id: 'ats_alert_hr', icon: 'alert', label: 'Alert operativi HR (ATS)', desc: 'Invia riepilogo giornaliero (lun–ven) con: candidati non letti, colloqui mancanti, feedback assenti, pipeline bloccata.', roles: ['hr'], trigger: 'Ogni giorno lun-ven alle 08:00', lastRun: 'Oggi 08:00', enabled: true },
      { id: 'ats_bottleneck', icon: 'alert', label: 'Rilevamento collo di bottiglia', desc: 'Notifica quando una posizione è ferma in uno stage da più di 7 giorni senza progressi.', roles: ['hr', 'area_manager'], trigger: '7 giorni senza progressi', lastRun: '2 giorni fa', enabled: false },
    ],
  },
  {
    category: 'Report Automatici',
    accent: '#374151',
    items: [
      { id: 'report_hr_settimanale', icon: 'file', label: 'Report HR settimanale (PDF)', desc: 'Genera e invia ogni lunedì il report settimanale HR ai destinatari configurati.', roles: ['hr', 'admin'], trigger: 'Ogni lunedì alle 07:00', lastRun: 'Lun 21/04 07:00', enabled: true },
      { id: 'report_admin_mensile', icon: 'file', label: 'Report Admin mensile (PDF)', desc: 'Genera e invia il primo giorno del mese il report mensile completo per Admin e HR.', roles: ['admin', 'hr'], trigger: '1° del mese alle 07:00', lastRun: '01/04/2026 07:00', enabled: true },
    ],
  },
];

const ICON_SVG = (name, color = 'currentColor') => {
  const s = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    mail: <svg {...s}><path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    clipboard: <svg {...s}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>,
    star: <svg {...s}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    clock: <svg {...s}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>,
    alert: <svg {...s}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    calendar: <svg {...s}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    check: <svg {...s}><polyline points="20 6 9 17 4 12"/></svg>,
    pen: <svg {...s}><path d="M17 3a2.828 2.828 0 014 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>,
    graduation: <svg {...s}><path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
    medical: <svg {...s}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    doc: <svg {...s}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/></svg>,
    umbrella: <svg {...s}><path d="M23 12a11.05 11.05 0 00-22 0zm-5 7a3 3 0 01-6 0v-7"/></svg>,
    briefcase: <svg {...s}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>,
    file: <svg {...s}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  };
  return paths[name] || paths.file;
};

const ROLE_LABELS = { store_manager: 'Store Mgr', area_manager: 'Area Mgr', hr: 'HR', admin: 'Admin', employee: 'Dipendente' };
const ROLE_COLORS = { store_manager: '#7C3AED', area_manager: '#15803D', hr: '#0284C7', admin: '#C9973A', employee: '#64748B' };

function AutomationsPage() {
  const [automations, setAutomations] = useState(AUTOMATIONS);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const toggleAutomation = (catIdx, itemIdx) => {
    setAutomations(prev => prev.map((cat, ci) =>
      ci !== catIdx ? cat : {
        ...cat,
        items: cat.items.map((item, ii) =>
          ii !== itemIdx ? item : { ...item, enabled: !item.enabled }
        ),
      }
    ));
  };

  const totalEnabled = automations.flatMap(c => c.items).filter(i => i.enabled).length;
  const total = automations.flatMap(c => c.items).length;

  return (
    <PageShell
      title="Automazioni"
      subtitle={`${totalEnabled}/${total} automazioni attive · Controllo completo Admin`}
      headerRight={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cerca automazione..."
              style={{ padding: '7px 12px 7px 32px', border: '1.5px solid #E4E1DA', borderRadius: 6, fontSize: 13, width: 200, fontFamily: "'DM Sans', sans-serif", outline: 'none', background: '#F7F5F1' }}
            />
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            style={{ padding: '7px 12px', border: '1.5px solid #E4E1DA', borderRadius: 6, fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: '#F7F5F1', color: '#374151', outline: 'none', cursor: 'pointer' }}>
            <option value="all">Tutte</option>
            <option value="enabled">Solo attive</option>
            <option value="disabled">Solo disattivate</option>
          </select>
        </div>
      }
    >
      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Automazioni attive', value: totalEnabled, color: '#15803D', bg: '#F0FDF4' },
          { label: 'Disattivate', value: total - totalEnabled, color: '#DC2626', bg: '#FEF2F2' },
          { label: 'Con trigger giornaliero', value: automations.flatMap(c => c.items).filter(i => i.trigger.includes('giorno') || i.trigger.includes('lun')).length, color: '#0284C7', bg: '#F0F9FF' },
          { label: 'Eseguite oggi', value: automations.flatMap(c => c.items).filter(i => i.lastRun && i.lastRun.includes('Oggi')).length, color: '#C9973A', bg: '#FFFBEB' },
        ].map(s => (
          <Card key={s.label} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "'Sora', sans-serif" }}>{s.value}</span>
            </div>
            <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>{s.label}</span>
          </Card>
        ))}
      </div>

      {/* Categories */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {automations.map((cat, catIdx) => {
          const filtered = cat.items.filter(item => {
            const matchSearch = search === '' || item.label.toLowerCase().includes(search.toLowerCase()) || item.desc.toLowerCase().includes(search.toLowerCase());
            const matchFilter = filter === 'all' || (filter === 'enabled' && item.enabled) || (filter === 'disabled' && !item.enabled);
            return matchSearch && matchFilter;
          });
          if (filtered.length === 0) return null;
          return (
            <div key={cat.category}>
              {/* Category header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 4, height: 18, borderRadius: 2, background: cat.accent }} />
                <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>{cat.category}</h3>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>{cat.items.filter(i => i.enabled).length}/{cat.items.length} attive</span>
              </div>
              <Card>
                {filtered.map((item, itemIdx) => {
                  const realIdx = cat.items.findIndex(i => i.id === item.id);
                  return (
                    <div key={item.id} style={{
                      padding: '18px 20px',
                      borderBottom: itemIdx < filtered.length - 1 ? '1px solid #F2F0EC' : 'none',
                      display: 'flex', gap: 16, alignItems: 'flex-start',
                      opacity: item.enabled ? 1 : 0.6,
                      transition: 'opacity 0.2s ease',
                    }}>
                      {/* Icon */}
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        background: item.enabled ? `${cat.accent}12` : '#F2F0EC',
                        border: `1px solid ${item.enabled ? cat.accent : '#E4E1DA'}25`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: item.enabled ? cat.accent : '#9CA3AF',
                      }}>
                        {ICON_SVG(item.icon, item.enabled ? cat.accent : '#9CA3AF')}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{item.label}</span>
                            {!item.enabled && (
                              <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 999, padding: '1px 6px' }}>DISATTIVATA</span>
                            )}
                          </div>
                          <Toggle checked={item.enabled} onChange={() => toggleAutomation(catIdx, realIdx)} accent={cat.accent} />
                        </div>
                        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 10px', lineHeight: 1.5 }}>{item.desc}</p>

                        {/* Meta row */}
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
                            Trigger: <strong style={{ color: '#6B7280' }}>{item.trigger}</strong>
                          </span>
                          {item.lastRun && (
                            <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                              Ultima esecuzione: <strong style={{ color: '#6B7280' }}>{item.lastRun}</strong>
                            </span>
                          )}
                          {item.roles.length > 0 && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              {item.roles.map(role => (
                                <span key={role} style={{
                                  fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 999,
                                  color: ROLE_COLORS[role] || '#6B7280',
                                  background: `${ROLE_COLORS[role] || '#6B7280'}12`,
                                  border: `1px solid ${ROLE_COLORS[role] || '#6B7280'}25`,
                                }}>{ROLE_LABELS[role] || role}</span>
                              ))}
                            </div>
                          )}
                          {item.roles.length === 0 && (
                            <span style={{ fontSize: 11, color: '#9CA3AF' }}>→ Destinatari esterni (candidati)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </div>
          );
        })}
      </div>

      {/* Save */}
      <div style={{ marginTop: 24, padding: '16px 0', borderTop: '1px solid #E4E1DA', display: 'flex', gap: 10 }}>
        <button style={{ padding: '10px 24px', background: '#0D2137', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Salva configurazione</button>
        <button style={{ padding: '10px 24px', background: 'transparent', color: '#374151', border: '1.5px solid #E4E1DA', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Disattiva tutte</button>
      </div>
    </PageShell>
  );
}

Object.assign(window, { AutomationsPage });
