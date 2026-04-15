import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Database,
  Eye,
  Link2,
  RefreshCcw,
  Server,
  Store,
  Trash2,
  Unlink,
  Users,
  WandSparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DatePicker } from '../../components/ui/DatePicker';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import {
  ExternalAffluencePreviewResponse,
  ExternalDbOverview,
  ExternalDepositoRow,
  ExternalIngressiResponse,
  ExternalStoreMapping,
  ExternalTableCatalogItem,
  getExternalAffluencePreview,
  getExternalCatalog,
  getExternalIngressi,
  getExternalOverview,
  listExternalDepositi,
  listExternalMappings,
  syncExternalAffluence,
  upsertExternalMapping,
  deleteExternalMapping,
} from '../../api/externalAffluence';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

const WRITER_ROLES = ['admin', 'hr', 'area_manager'] as const;
type WriterRole = typeof WRITER_ROLES[number];

type PanelKey = 'companies' | 'stores' | 'employees' | 'internalDb' | 'externalDb';

const EN = {
  title: 'External Database Integration',
  subtitle: 'Connect local stores to external DEPOSITI and INGRESSI with a clear, auditable flow.',
  refresh: 'Refresh',
  loading: 'Loading integration data...',

  cardsTitle: 'Integration Snapshot',
  companies: 'Companies',
  stores: 'Stores',
  employees: 'Employees',
  internalDb: 'Internal Database',
  externalDb: 'External Database',
  connected: 'Connected',
  disconnected: 'Disconnected',
  configured: 'Configured',
  notConfigured: 'Not configured',
  checkedAt: 'Checked at',
  engine: 'Engine',
  dbName: 'Database',
  tableCount: 'Tables',

  companiesPanelTitle: 'Companies In Scope',
  storesPanelTitle: 'Stores In Scope',
  employeesPanelTitle: 'Employees In Scope',
  internalDbPanelTitle: 'PostgreSQL Tables Overview',
  externalDbPanelTitle: 'MySQL Tables Overview',
  removePanel: 'Remove table',

  colCompany: 'Company',
  colStore: 'Store',
  colCode: 'Code',
  colEmployees: 'Employees',
  colEmployee: 'Employee',
  colEmail: 'Email',
  colStatus: 'Status',
  colActive: 'Active',
  colTable: 'Table',
  colRows: 'Rows',
  colSize: 'Size',
  colFields: 'Fields',
  colFieldList: 'Field names',

  noCompanies: 'No companies available in your scope.',
  noStores: 'No stores available in your scope.',
  noEmployees: 'No employees available in your scope.',
  noTables: 'No table metadata available.',

  step1Title: '1) Local Store and External Store Configuration',
  step1Hint: 'Select local company and store, search external stores, then save integration to local DB.',
  selectCompany: 'Local company',
  selectStore: 'Local store',
  companyPlaceholder: 'Select company',
  storePlaceholder: 'Select store',
  searchExternal: 'Search external stores',
  searchPlaceholder: 'Search by external code, store, or company',
  externalCode: 'External code',
  externalStore: 'External store',
  externalCompany: 'External company',
  mappedLocalStore: 'Mapped local store',
  action: 'Action',
  storeIntegrationAction: 'Store Integration',
  saving: 'Saving...',
  noExternalStores: 'No external stores found.',
  selectStoreFirst: 'Select local company and local store first.',

  savedIntegrationsTitle: 'Saved Integration Records (local table: external_store_mappings)',
  savedIntegrationsHint: 'Saved records avoid repeated manual integrations.',
  updatedAt: 'Updated at',
  remove: 'Remove',
  noMappings: 'No saved integrations for selected company.',
  mapSavedToast: 'Integration saved to local database.',
  mapDeletedToast: 'Integration removed from local database.',

  step2Title: '2) External Traffic Query (INGRESSI)',
  step2Hint: 'Use platform date pickers and load visitors traffic from mapped external store.',
  fromDate: 'From date',
  toDate: 'To date',
  selectedStore: 'Selected local store',
  noStore: 'No store selected',
  loadIngressi: 'Load INGRESSI',
  loadingTraffic: 'Loading...',
  totalDays: 'Total days',
  totalVisitors: 'Total visitors',
  avgDay: 'Average/day',
  minMax: 'Min - Max',
  date: 'Date',
  visitors: 'Visitors',
  noTrafficRows: 'No traffic rows found for selected range.',

  step3Title: '3) Affluence Preview and Recommendation',
  step3Hint: 'Preview recommended staffing with traffic formula and current scheduled shifts baseline.',
  generatePreview: 'Generate Preview',
  generating: 'Generating...',
  overwrite: 'Replace existing default local affluence on sync',
  applyToLocal: 'Apply To Local Affluence',
  syncing: 'Syncing...',
  syncToast: 'Affluence data synced to local database.',
  notMappedWarning: 'This store is not mapped yet. Complete step 1 first.',

  formulaTitle: 'Recommendation logic',
  formulaLine1: 'Estimated visitors per slot = weekday average visitors * slot weight.',
  formulaLine2Prefix: 'Recommended staff = ceil(estimated visitors /',
  formulaLine2Suffix: 'visitors per staff).',
  formulaLine3: 'Current scheduled staff is calculated from confirmed/scheduled shifts in selected date range.',

  day: 'Day',
  timeSlot: 'Time slot',
  level: 'Level',
  estimatedVisitors: 'Estimated visitors',
  recommendedStaff: 'Recommended',
  scheduledStaff: 'Scheduled',
  gap: 'Gap',
  currentDefault: 'Current default',
  noRecommendations: 'No recommendations available for selected range.',

  low: 'Low',
  medium: 'Medium',
  high: 'High',
  under: 'Under-staffed',
  balanced: 'Balanced',
  over: 'Over-staffed',

  dictionaryTitle: '4) External Fields Dictionary (IT + EN)',
  dictionaryHint: 'Original source fields and English labels are shown side by side for quick understanding.',
  itField: 'Italian source',
  enField: 'English label',
  fieldType: 'Type',
  fieldDescription: 'Description',

  stepError: 'Step error',
};

const IT = {
  title: 'Integrazione Database Esterno',
  subtitle: 'Collega i negozi locali a DEPOSITI e INGRESSI con un flusso chiaro e tracciabile.',
  refresh: 'Aggiorna',
  loading: 'Caricamento dati integrazione...',

  cardsTitle: 'Riepilogo Integrazione',
  companies: 'Aziende',
  stores: 'Negozi',
  employees: 'Dipendenti',
  internalDb: 'Database Interno',
  externalDb: 'Database Esterno',
  connected: 'Connesso',
  disconnected: 'Disconnesso',
  configured: 'Configurato',
  notConfigured: 'Non configurato',
  checkedAt: 'Verificato alle',
  engine: 'Motore',
  dbName: 'Database',
  tableCount: 'Tabelle',

  companiesPanelTitle: 'Aziende Nel Perimetro',
  storesPanelTitle: 'Negozi Nel Perimetro',
  employeesPanelTitle: 'Dipendenti Nel Perimetro',
  internalDbPanelTitle: 'Panoramica Tabelle PostgreSQL',
  externalDbPanelTitle: 'Panoramica Tabelle MySQL',
  removePanel: 'Rimuovi tabella',

  colCompany: 'Azienda',
  colStore: 'Negozio',
  colCode: 'Codice',
  colEmployees: 'Dipendenti',
  colEmployee: 'Dipendente',
  colEmail: 'Email',
  colStatus: 'Stato',
  colActive: 'Attivo',
  colTable: 'Tabella',
  colRows: 'Righe',
  colSize: 'Dimensione',
  colFields: 'Campi',
  colFieldList: 'Nomi campi',

  noCompanies: 'Nessuna azienda disponibile nel tuo perimetro.',
  noStores: 'Nessun negozio disponibile nel tuo perimetro.',
  noEmployees: 'Nessun dipendente disponibile nel tuo perimetro.',
  noTables: 'Nessun metadato tabella disponibile.',

  step1Title: '1) Configurazione Negozio Locale e Negozio Esterno',
  step1Hint: 'Seleziona azienda e negozio locale, cerca negozio esterno, poi salva integrazione nel DB locale.',
  selectCompany: 'Azienda locale',
  selectStore: 'Negozio locale',
  companyPlaceholder: 'Seleziona azienda',
  storePlaceholder: 'Seleziona negozio',
  searchExternal: 'Cerca negozi esterni',
  searchPlaceholder: 'Cerca per codice esterno, negozio o azienda',
  externalCode: 'Codice esterno',
  externalStore: 'Negozio esterno',
  externalCompany: 'Azienda esterna',
  mappedLocalStore: 'Negozio locale collegato',
  action: 'Azione',
  storeIntegrationAction: 'Salva Integrazione',
  saving: 'Salvataggio...',
  noExternalStores: 'Nessun negozio esterno trovato.',
  selectStoreFirst: 'Seleziona prima azienda locale e negozio locale.',

  savedIntegrationsTitle: 'Record Integrazione Salvati (tabella locale: external_store_mappings)',
  savedIntegrationsHint: 'I record salvati evitano integrazioni manuali ripetute.',
  updatedAt: 'Aggiornato il',
  remove: 'Rimuovi',
  noMappings: 'Nessuna integrazione salvata per azienda selezionata.',
  mapSavedToast: 'Integrazione salvata nel database locale.',
  mapDeletedToast: 'Integrazione rimossa dal database locale.',

  step2Title: '2) Query Traffico Esterno (INGRESSI)',
  step2Hint: 'Usa i date picker della piattaforma e carica il traffico visitatori dal negozio esterno collegato.',
  fromDate: 'Data da',
  toDate: 'Data a',
  selectedStore: 'Negozio locale selezionato',
  noStore: 'Nessun negozio selezionato',
  loadIngressi: 'Carica INGRESSI',
  loadingTraffic: 'Caricamento...',
  totalDays: 'Giorni totali',
  totalVisitors: 'Visitatori totali',
  avgDay: 'Media/giorno',
  minMax: 'Min - Max',
  date: 'Data',
  visitors: 'Visitatori',
  noTrafficRows: 'Nessun record traffico nel periodo selezionato.',

  step3Title: '3) Anteprima Affluenza e Raccomandazioni',
  step3Hint: 'Anteprima del fabbisogno staff con formula traffico e baseline dei turni attuali.',
  generatePreview: 'Genera Anteprima',
  generating: 'Generazione...',
  overwrite: 'Sostituisci affluenza locale default esistente in sincronizzazione',
  applyToLocal: 'Applica Ad Affluenza Locale',
  syncing: 'Sincronizzazione...',
  syncToast: 'Dati affluenza sincronizzati nel database locale.',
  notMappedWarning: 'Questo negozio non e ancora collegato. Completa prima lo step 1.',

  formulaTitle: 'Logica raccomandazione',
  formulaLine1: 'Visitatori stimati per fascia = media visitatori del giorno * peso fascia.',
  formulaLine2Prefix: 'Staff consigliato = ceil(visitatori stimati /',
  formulaLine2Suffix: 'visitatori per addetto).',
  formulaLine3: 'Lo staff schedulato attuale e calcolato dai turni confermati/schedulati nel periodo selezionato.',

  day: 'Giorno',
  timeSlot: 'Fascia oraria',
  level: 'Livello',
  estimatedVisitors: 'Visitatori stimati',
  recommendedStaff: 'Consigliato',
  scheduledStaff: 'Schedulato',
  gap: 'Scostamento',
  currentDefault: 'Default attuale',
  noRecommendations: 'Nessuna raccomandazione disponibile nel periodo selezionato.',

  low: 'Basso',
  medium: 'Medio',
  high: 'Alto',
  under: 'Sotto organico',
  balanced: 'Bilanciato',
  over: 'Sovra organico',

  dictionaryTitle: '4) Dizionario Campi Esterni (IT + EN)',
  dictionaryHint: 'Campi sorgente originali e etichette in inglese mostrati affiancati.',
  itField: 'Sorgente italiana',
  enField: 'Etichetta inglese',
  fieldType: 'Tipo',
  fieldDescription: 'Descrizione',

  stepError: 'Errore step',
};

function dateToInputValue(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseApiError(err: unknown): string {
  const anyErr = err as {
    response?: {
      data?: {
        error?: string;
        code?: string;
      };
    };
    message?: string;
  };

  return anyErr.response?.data?.error
    ?? anyErr.response?.data?.code
    ?? anyErr.message
    ?? 'Unknown error';
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function weekdayLabel(dayOfWeek: number, isItalian: boolean): string {
  const en: Record<number, string> = {
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
    7: 'Sunday',
  };
  const it: Record<number, string> = {
    1: 'Lunedi',
    2: 'Martedi',
    3: 'Mercoledi',
    4: 'Giovedi',
    5: 'Venerdi',
    6: 'Sabato',
    7: 'Domenica',
  };
  return (isItalian ? it : en)[dayOfWeek] ?? String(dayOfWeek);
}

const sectionStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--surface)',
  boxShadow: 'var(--shadow-sm)',
  padding: 18,
  display: 'grid',
  gap: 12,
};

const panelShellStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--surface-warm)',
  overflow: 'hidden',
};

const tinyCell: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-secondary)',
  verticalAlign: 'top',
};

function StatusPill({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '3px 8px',
        fontSize: 11,
        fontWeight: 700,
        background: ok ? 'rgba(22,163,74,0.14)' : 'rgba(220,38,38,0.12)',
        color: ok ? '#166534' : '#991b1b',
        border: `1px solid ${ok ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`,
      }}
    >
      {ok ? yes : no}
    </span>
  );
}

export default function ExternalAffluencePage() {
  const { i18n } = useTranslation();
  const { showToast } = useToast();
  const { targetCompanyId, user } = useAuth();

  const isItalian = i18n.language.startsWith('it');
  const tx = isItalian ? IT : EN;
  const canWrite = Boolean(user && WRITER_ROLES.includes(user.role as WriterRole));

  const [overview, setOverview] = useState<ExternalDbOverview | null>(null);
  const [catalog, setCatalog] = useState<ExternalTableCatalogItem[]>([]);
  const [mappings, setMappings] = useState<ExternalStoreMapping[]>([]);
  const [depositiRows, setDepositiRows] = useState<ExternalDepositoRow[]>([]);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [externalSearch, setExternalSearch] = useState<string>('');

  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 56);
    return dateToInputValue(d);
  });
  const [toDate, setToDate] = useState<string>(() => dateToInputValue(new Date()));

  const [trafficData, setTrafficData] = useState<ExternalIngressiResponse | null>(null);
  const [previewData, setPreviewData] = useState<ExternalAffluencePreviewResponse | null>(null);
  const [overwriteDefault, setOverwriteDefault] = useState<boolean>(true);

  const [hoveredCard, setHoveredCard] = useState<PanelKey | null>(null);
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    companies: false,
    stores: false,
    employees: false,
    internalDb: false,
    externalDb: false,
  });

  const [loadingOverview, setLoadingOverview] = useState<boolean>(false);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(false);
  const [loadingMappings, setLoadingMappings] = useState<boolean>(false);
  const [loadingDepositi, setLoadingDepositi] = useState<boolean>(false);
  const [loadingTraffic, setLoadingTraffic] = useState<boolean>(false);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [savingMappingCode, setSavingMappingCode] = useState<string | null>(null);

  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const [step3Error, setStep3Error] = useState<string | null>(null);

  const selectedCompanyIdNum = useMemo(() => {
    const parsed = parseInt(selectedCompanyId, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [selectedCompanyId]);

  const companies = overview?.companies ?? [];
  const stores = overview?.stores ?? [];
  const employees = overview?.employees ?? [];

  const companyStores = useMemo(() => {
    if (!selectedCompanyIdNum) return [];
    return stores.filter((store) => store.companyId === selectedCompanyIdNum);
  }, [stores, selectedCompanyIdNum]);

  const selectedStore = useMemo(() => {
    const id = parseInt(selectedStoreId, 10);
    if (!Number.isFinite(id)) return null;
    return stores.find((store) => store.id === id) ?? null;
  }, [stores, selectedStoreId]);

  const mappingByStore = useMemo(() => {
    const map = new Map<number, ExternalStoreMapping>();
    for (const item of mappings) {
      map.set(item.localStoreId, item);
    }
    return map;
  }, [mappings]);

  const selectedStoreMapping = selectedStore ? (mappingByStore.get(selectedStore.id) ?? null) : null;

  const previewByDay = useMemo(() => {
    const byDay = new Map<number, ExternalAffluencePreviewResponse['recommendations']>();
    if (!previewData) return byDay;
    for (const row of previewData.recommendations) {
      const list = byDay.get(row.dayOfWeek) ?? [];
      list.push(row);
      byDay.set(row.dayOfWeek, list);
    }
    for (const [day, rows] of byDay.entries()) {
      byDay.set(day, [...rows].sort((a, b) => a.timeSlot.localeCompare(b.timeSlot)));
    }
    return byDay;
  }, [previewData]);

  const openPanel = (key: PanelKey) => {
    setOpenPanels((prev) => ({ ...prev, [key]: true }));
  };

  const closePanel = (key: PanelKey) => {
    setOpenPanels((prev) => ({ ...prev, [key]: false }));
  };

  const loadOverview = async () => {
    setLoadingOverview(true);
    setOverviewError(null);
    try {
      const data = await getExternalOverview(targetCompanyId ?? undefined);
      setOverview(data);

      setSelectedCompanyId((prev) => {
        if (!prev) return '';
        const asNum = parseInt(prev, 10);
        return data.companies.some((company) => company.id === asNum) ? prev : '';
      });

      setSelectedStoreId((prev) => {
        if (!prev) return '';
        const asNum = parseInt(prev, 10);
        return data.stores.some((store) => store.id === asNum) ? prev : '';
      });
    } catch (err) {
      const message = parseApiError(err);
      setOverviewError(message);
      showToast(message, 'error');
    } finally {
      setLoadingOverview(false);
    }
  };

  const loadCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const rows = await getExternalCatalog(targetCompanyId ?? undefined);
      setCatalog(rows);
    } catch (err) {
      showToast(parseApiError(err), 'error');
    } finally {
      setLoadingCatalog(false);
    }
  };

  const loadMappings = async (companyId: number | null) => {
    if (!companyId) {
      setMappings([]);
      return;
    }

    setLoadingMappings(true);
    try {
      const rows = await listExternalMappings(companyId);
      setMappings(rows);
      setStep1Error(null);
    } catch (err) {
      const message = parseApiError(err);
      setStep1Error(message);
      showToast(message, 'error');
    } finally {
      setLoadingMappings(false);
    }
  };

  const loadDepositi = async (search: string, companyId: number | null) => {
    if (!companyId) {
      setDepositiRows([]);
      return;
    }

    setLoadingDepositi(true);
    try {
      const rows = await listExternalDepositi({
        search,
        limit: 300,
        targetCompanyId: companyId,
      });
      setDepositiRows(rows);
      setStep1Error(null);
    } catch (err) {
      const message = parseApiError(err);
      setStep1Error(message);
      showToast(message, 'error');
    } finally {
      setLoadingDepositi(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadOverview(), loadCatalog()]);
  }, []);

  useEffect(() => {
    setSelectedStoreId('');
    setTrafficData(null);
    setPreviewData(null);

    if (!selectedCompanyIdNum) {
      setMappings([]);
      setDepositiRows([]);
      return;
    }

    void Promise.all([
      loadMappings(selectedCompanyIdNum),
      loadDepositi(externalSearch, selectedCompanyIdNum),
    ]);
  }, [selectedCompanyIdNum]);

  useEffect(() => {
    if (!selectedCompanyIdNum) return;
    const timer = window.setTimeout(() => {
      void loadDepositi(externalSearch, selectedCompanyIdNum);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [externalSearch]);

  const refreshAll = async () => {
    await Promise.all([
      loadOverview(),
      loadCatalog(),
      loadMappings(selectedCompanyIdNum),
      loadDepositi(externalSearch, selectedCompanyIdNum),
    ]);
  };

  const handleMapStore = async (externalStoreCode: string) => {
    if (!selectedStore || !selectedCompanyIdNum) {
      setStep1Error(tx.selectStoreFirst);
      showToast(tx.selectStoreFirst, 'warning');
      return;
    }

    setSavingMappingCode(externalStoreCode);
    try {
      await upsertExternalMapping(selectedStore.id, {
        externalStoreCode,
        notes: null,
        targetCompanyId: selectedCompanyIdNum,
      });

      setStep1Error(null);
      showToast(tx.mapSavedToast, 'success');
      await Promise.all([
        loadMappings(selectedCompanyIdNum),
        loadDepositi(externalSearch, selectedCompanyIdNum),
      ]);
    } catch (err) {
      const message = parseApiError(err);
      setStep1Error(message);
      showToast(message, 'error');
    } finally {
      setSavingMappingCode(null);
    }
  };

  const handleDeleteMapping = async (storeId: number) => {
    if (!selectedCompanyIdNum) return;

    try {
      await deleteExternalMapping(storeId, selectedCompanyIdNum);
      setStep1Error(null);
      showToast(tx.mapDeletedToast, 'success');
      await Promise.all([
        loadMappings(selectedCompanyIdNum),
        loadDepositi(externalSearch, selectedCompanyIdNum),
      ]);
    } catch (err) {
      const message = parseApiError(err);
      setStep1Error(message);
      showToast(message, 'error');
    }
  };

  const handleLoadTraffic = async () => {
    if (!selectedStore || !selectedCompanyIdNum) {
      setStep2Error(tx.selectStoreFirst);
      showToast(tx.selectStoreFirst, 'warning');
      return;
    }

    if (!selectedStoreMapping) {
      setStep2Error(tx.notMappedWarning);
      showToast(tx.notMappedWarning, 'warning');
      return;
    }

    setLoadingTraffic(true);
    setStep2Error(null);
    try {
      const data = await getExternalIngressi({
        storeId: selectedStore.id,
        targetCompanyId: selectedCompanyIdNum,
        fromDate,
        toDate,
      });
      setTrafficData(data);
    } catch (err) {
      const message = parseApiError(err);
      setStep2Error(message);
      setTrafficData(null);
      showToast(message, 'error');
    } finally {
      setLoadingTraffic(false);
    }
  };

  const handleLoadPreview = async () => {
    if (!selectedStore || !selectedCompanyIdNum) {
      setStep3Error(tx.selectStoreFirst);
      showToast(tx.selectStoreFirst, 'warning');
      return;
    }

    if (!selectedStoreMapping) {
      setStep3Error(tx.notMappedWarning);
      showToast(tx.notMappedWarning, 'warning');
      return;
    }

    setLoadingPreview(true);
    setStep3Error(null);
    try {
      const data = await getExternalAffluencePreview({
        storeId: selectedStore.id,
        targetCompanyId: selectedCompanyIdNum,
        fromDate,
        toDate,
      });
      setPreviewData(data);
    } catch (err) {
      const message = parseApiError(err);
      setStep3Error(message);
      setPreviewData(null);
      showToast(message, 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSyncPreview = async () => {
    if (!selectedStore || !selectedCompanyIdNum) {
      setStep3Error(tx.selectStoreFirst);
      showToast(tx.selectStoreFirst, 'warning');
      return;
    }

    setSyncing(true);
    setStep3Error(null);
    try {
      await syncExternalAffluence({
        storeId: selectedStore.id,
        targetCompanyId: selectedCompanyIdNum,
        fromDate,
        toDate,
        overwriteDefault,
      });
      showToast(tx.syncToast, 'success');
      await handleLoadPreview();
    } catch (err) {
      const message = parseApiError(err);
      setStep3Error(message);
      showToast(message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const showLoading = loadingOverview || loadingCatalog;

  return (
    <div className="page-enter" style={{ display: 'grid', gap: 16 }}>
      <section style={{ ...sectionStyle, background: 'linear-gradient(165deg, rgba(13,33,55,0.04) 0%, rgba(201,151,58,0.08) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--primary)' }}>{tx.title}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>{tx.subtitle}</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { void refreshAll(); }}
            disabled={showLoading || loadingMappings || loadingDepositi}
          >
            <RefreshCcw size={14} />
            {tx.refresh}
          </button>
        </div>

        {overviewError && (
          <div style={{ border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 10, padding: 10, fontSize: 13 }}>
            {overviewError}
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {tx.cardsTitle}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          <div
            onMouseEnter={() => setHoveredCard('companies')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              position: 'relative',
              borderRadius: 12,
              padding: 14,
              color: '#fff',
              background: 'linear-gradient(140deg, #0D2137 0%, #163352 100%)',
              boxShadow: '0 8px 20px rgba(13,33,55,0.28)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.9 }}><Building2 size={14} /> {tx.companies}</div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 6 }}>{overview?.counts.companies ?? 0}</div>
            <button
              type="button"
              onClick={() => openPanel('companies')}
              style={{
                position: 'absolute',
                right: 10,
                top: 10,
                width: 30,
                height: 30,
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.35)',
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: hoveredCard === 'companies' ? 1 : 0,
                transition: 'opacity 0.18s ease',
              }}
            >
              <Eye size={14} />
            </button>
          </div>

          <div
            onMouseEnter={() => setHoveredCard('stores')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              position: 'relative',
              borderRadius: 12,
              padding: 14,
              color: '#fff',
              background: 'linear-gradient(140deg, #163352 0%, #1A3B5C 100%)',
              boxShadow: '0 8px 20px rgba(22,51,82,0.24)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.9 }}><Store size={14} /> {tx.stores}</div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 6 }}>{overview?.counts.stores ?? 0}</div>
            <button
              type="button"
              onClick={() => openPanel('stores')}
              style={{
                position: 'absolute',
                right: 10,
                top: 10,
                width: 30,
                height: 30,
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.35)',
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: hoveredCard === 'stores' ? 1 : 0,
                transition: 'opacity 0.18s ease',
              }}
            >
              <Eye size={14} />
            </button>
          </div>

          <div
            onMouseEnter={() => setHoveredCard('employees')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              position: 'relative',
              borderRadius: 12,
              padding: 14,
              color: '#3f2b08',
              background: 'linear-gradient(140deg, #C9973A 0%, #E0B363 100%)',
              boxShadow: '0 8px 20px rgba(201,151,58,0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.92 }}><Users size={14} /> {tx.employees}</div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 6 }}>{overview?.counts.employees ?? 0}</div>
            <button
              type="button"
              onClick={() => openPanel('employees')}
              style={{
                position: 'absolute',
                right: 10,
                top: 10,
                width: 30,
                height: 30,
                borderRadius: 999,
                border: '1px solid rgba(63,43,8,0.24)',
                background: 'rgba(255,255,255,0.55)',
                color: '#3f2b08',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: hoveredCard === 'employees' ? 1 : 0,
                transition: 'opacity 0.18s ease',
              }}
            >
              <Eye size={14} />
            </button>
          </div>

          <div
            onMouseEnter={() => setHoveredCard('internalDb')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              position: 'relative',
              borderRadius: 12,
              padding: 14,
              border: '1px solid rgba(13,33,55,0.12)',
              background: 'linear-gradient(180deg, #ffffff 0%, #f7f5f1 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}><Server size={14} /> {tx.internalDb}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>
              {overview?.databases.internal.databaseName ?? '-'}
            </div>
            <div style={{ display: 'grid', gap: 4, marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
              <div>{tx.engine}: {overview?.databases.internal.engine ?? 'PostgreSQL'}</div>
              <div>{tx.tableCount}: {overview?.databases.internal.tableCount ?? 0}</div>
              <div>{tx.checkedAt}: {formatDateTime(overview?.databases.internal.checkedAt)}</div>
              <StatusPill ok={overview?.connections.internal.ok === true} yes={tx.connected} no={tx.disconnected} />
            </div>
            <button
              type="button"
              onClick={() => openPanel('internalDb')}
              style={{
                position: 'absolute',
                right: 10,
                top: 10,
                width: 30,
                height: 30,
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: '#fff',
                color: 'var(--primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: hoveredCard === 'internalDb' ? 1 : 0,
                transition: 'opacity 0.18s ease',
              }}
            >
              <Eye size={14} />
            </button>
          </div>

          <div
            onMouseEnter={() => setHoveredCard('externalDb')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              position: 'relative',
              borderRadius: 12,
              padding: 14,
              border: '1px solid rgba(13,33,55,0.12)',
              background: 'linear-gradient(180deg, #ffffff 0%, #f7f5f1 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}><Database size={14} /> {tx.externalDb}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>
              {overview?.databases.external.databaseName ?? '-'}
            </div>
            <div style={{ display: 'grid', gap: 4, marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
              <div>{tx.engine}: {overview?.databases.external.engine ?? 'MySQL'}</div>
              <div>{tx.tableCount}: {overview?.databases.external.tableCount ?? 0}</div>
              <div>{tx.checkedAt}: {formatDateTime(overview?.databases.external.checkedAt)}</div>
              <StatusPill ok={overview?.connections.external.ok === true} yes={tx.connected} no={tx.disconnected} />
            </div>
            <button
              type="button"
              onClick={() => openPanel('externalDb')}
              style={{
                position: 'absolute',
                right: 10,
                top: 10,
                width: 30,
                height: 30,
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: '#fff',
                color: 'var(--primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: hoveredCard === 'externalDb' ? 1 : 0,
                transition: 'opacity 0.18s ease',
              }}
            >
              <Eye size={14} />
            </button>
          </div>
        </div>

        {openPanels.companies && (
          <div style={panelShellStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--primary)', fontSize: 13 }}>{tx.companiesPanelTitle}</strong>
              <button type="button" className="btn btn-ghost" onClick={() => closePanel('companies')} title={tx.removePanel}>
                <Trash2 size={13} />
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(13,33,55,0.04)' }}>
                    <th style={{ textAlign: 'left', padding: 8, fontSize: 12 }}>{tx.colCompany}</th>
                    <th style={{ textAlign: 'left', padding: 8, fontSize: 12 }}>{tx.stores}</th>
                    <th style={{ textAlign: 'left', padding: 8, fontSize: 12 }}>{tx.colEmployees}</th>
                    <th style={{ textAlign: 'left', padding: 8, fontSize: 12 }}>{tx.colActive}</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                      <td style={{ padding: 8, fontSize: 13 }}>{company.name}</td>
                      <td style={{ padding: 8, fontSize: 13 }}>{company.storeCount}</td>
                      <td style={{ padding: 8, fontSize: 13 }}>{company.employeeCount}</td>
                      <td style={{ padding: 8, fontSize: 13 }}>{company.isActive ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                  {companies.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 10, fontSize: 12, color: 'var(--text-muted)' }}>{tx.noCompanies}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {openPanels.stores && (
          <div style={panelShellStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--primary)', fontSize: 13 }}>{tx.storesPanelTitle}</strong>
              <button type="button" className="btn btn-ghost" onClick={() => closePanel('stores')} title={tx.removePanel}>
                <Trash2 size={13} />
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(13,33,55,0.04)' }}>
                    <th style={{ textAlign: 'left', padding: 8, fontSize: 12 }}>{tx.colCompany}</th>
                    <th style={{ textAlign: 'left', padding: 8, fontSize: 12 }}>{tx.colCode}</th>
                    <th style={{ textAlign: 'left', padding: 8, fontSize: 12 }}>{tx.colStore}</th>
                    <th style={{ textAlign: 'left', padding: 8, fontSize: 12 }}>{tx.colEmployees}</th>
                    <th style={{ textAlign: 'left', padding: 8, fontSize: 12 }}>{tx.colActive}</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((store) => (
                    <tr key={store.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                      <td style={{ padding: 8, fontSize: 13 }}>{store.companyName}</td>
                      <td style={{ padding: 8, fontSize: 13, fontFamily: 'monospace' }}>{store.code}</td>
                      <td style={{ padding: 8, fontSize: 13 }}>{store.name}</td>
                      <td style={{ padding: 8, fontSize: 13 }}>{store.employeeCount}</td>
                      <td style={{ padding: 8, fontSize: 13 }}>{store.isActive ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                  {stores.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: 10, fontSize: 12, color: 'var(--text-muted)' }}>{tx.noStores}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {openPanels.employees && (
          <div style={panelShellStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--primary)', fontSize: 13 }}>{tx.employeesPanelTitle}</strong>
              <button type="button" className="btn btn-ghost" onClick={() => closePanel('employees')} title={tx.removePanel}>
                <Trash2 size={13} />
              </button>
            </div>
            <div style={{ maxHeight: 260, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(13,33,55,0.04)' }}>
                    <th style={{ textAlign: 'left', padding: 8, fontSize: 12 }}>{tx.colCompany}</th>
                    <th style={{ textAlign: 'left', padding: 8, fontSize: 12 }}>{tx.colStore}</th>
                    <th style={{ textAlign: 'left', padding: 8, fontSize: 12 }}>{tx.colEmployee}</th>
                    <th style={{ textAlign: 'left', padding: 8, fontSize: 12 }}>{tx.colEmail}</th>
                    <th style={{ textAlign: 'left', padding: 8, fontSize: 12 }}>{tx.colStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                      <td style={{ padding: 8, fontSize: 13 }}>{employee.companyName}</td>
                      <td style={{ padding: 8, fontSize: 13 }}>{employee.storeName ?? '-'}</td>
                      <td style={{ padding: 8, fontSize: 13 }}>{`${employee.name} ${employee.surname}`.trim()}</td>
                      <td style={{ padding: 8, fontSize: 13 }}>{employee.email}</td>
                      <td style={{ padding: 8, fontSize: 13 }}>{employee.status}</td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: 10, fontSize: 12, color: 'var(--text-muted)' }}>{tx.noEmployees}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {openPanels.internalDb && (
          <div style={panelShellStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--primary)', fontSize: 13 }}>{tx.internalDbPanelTitle}</strong>
              <button type="button" className="btn btn-ghost" onClick={() => closePanel('internalDb')} title={tx.removePanel}>
                <Trash2 size={13} />
              </button>
            </div>
            <div style={{ padding: 10, fontSize: 12, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)' }}>
              {tx.engine}: PostgreSQL | {tx.dbName}: {overview?.databases.internal.databaseName ?? '-'} | {tx.tableCount}: {overview?.databases.internal.tableCount ?? 0} | {tx.checkedAt}: {formatDateTime(overview?.databases.internal.checkedAt)}
            </div>
            <div style={{ maxHeight: 270, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(13,33,55,0.04)' }}>
                    <th style={{ textAlign: 'left', padding: 7, fontSize: 11 }}>{tx.colTable}</th>
                    <th style={{ textAlign: 'left', padding: 7, fontSize: 11 }}>{tx.colRows}</th>
                    <th style={{ textAlign: 'left', padding: 7, fontSize: 11 }}>{tx.colSize}</th>
                    <th style={{ textAlign: 'left', padding: 7, fontSize: 11 }}>{tx.colFields}</th>
                    <th style={{ textAlign: 'left', padding: 7, fontSize: 11 }}>{tx.colFieldList}</th>
                  </tr>
                </thead>
                <tbody>
                  {(overview?.localTableDetails ?? []).map((table) => (
                    <tr key={`local-${table.tableName}`} style={{ borderTop: '1px solid var(--border-light)' }}>
                      <td style={{ ...tinyCell, padding: 7, fontFamily: 'monospace' }}>{table.tableName}</td>
                      <td style={{ ...tinyCell, padding: 7 }}>{table.rowEstimate}</td>
                      <td style={{ ...tinyCell, padding: 7 }}>{table.totalSizePretty}</td>
                      <td style={{ ...tinyCell, padding: 7 }}>{table.columns.length}</td>
                      <td style={{ ...tinyCell, padding: 7 }}>{table.columns.map((column) => column.columnName).join(', ')}</td>
                    </tr>
                  ))}
                  {(overview?.localTableDetails ?? []).length === 0 && (
                    <tr><td colSpan={5} style={{ padding: 10, fontSize: 12, color: 'var(--text-muted)' }}>{tx.noTables}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {openPanels.externalDb && (
          <div style={panelShellStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--primary)', fontSize: 13 }}>{tx.externalDbPanelTitle}</strong>
              <button type="button" className="btn btn-ghost" onClick={() => closePanel('externalDb')} title={tx.removePanel}>
                <Trash2 size={13} />
              </button>
            </div>
            <div style={{ padding: 10, fontSize: 12, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)' }}>
              {tx.engine}: MySQL | {tx.dbName}: {overview?.databases.external.databaseName ?? '-'} | {tx.tableCount}: {overview?.databases.external.tableCount ?? 0} | {tx.checkedAt}: {formatDateTime(overview?.databases.external.checkedAt)}
            </div>
            <div style={{ maxHeight: 270, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(13,33,55,0.04)' }}>
                    <th style={{ textAlign: 'left', padding: 7, fontSize: 11 }}>{tx.colTable}</th>
                    <th style={{ textAlign: 'left', padding: 7, fontSize: 11 }}>{tx.colRows}</th>
                    <th style={{ textAlign: 'left', padding: 7, fontSize: 11 }}>{tx.colSize}</th>
                    <th style={{ textAlign: 'left', padding: 7, fontSize: 11 }}>{tx.colFields}</th>
                    <th style={{ textAlign: 'left', padding: 7, fontSize: 11 }}>{tx.colFieldList}</th>
                  </tr>
                </thead>
                <tbody>
                  {(overview?.externalTableDetails ?? []).map((table) => (
                    <tr key={`external-${table.tableName}`} style={{ borderTop: '1px solid var(--border-light)' }}>
                      <td style={{ ...tinyCell, padding: 7, fontFamily: 'monospace' }}>{table.tableName}</td>
                      <td style={{ ...tinyCell, padding: 7 }}>{table.rowEstimate}</td>
                      <td style={{ ...tinyCell, padding: 7 }}>{table.totalSizePretty}</td>
                      <td style={{ ...tinyCell, padding: 7 }}>{table.columns.length}</td>
                      <td style={{ ...tinyCell, padding: 7 }}>{table.columns.map((column) => column.columnName).join(', ')}</td>
                    </tr>
                  ))}
                  {(overview?.externalTableDetails ?? []).length === 0 && (
                    <tr><td colSpan={5} style={{ padding: 10, fontSize: 12, color: 'var(--text-muted)' }}>{tx.noTables}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link2 size={16} color="var(--primary)" />
          <h3 style={{ margin: 0, color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>{tx.step1Title}</h3>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{tx.step1Hint}</p>

        {step1Error && (
          <div style={{ border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 10, padding: 10, fontSize: 13 }}>
            <strong>{tx.stepError}: </strong>{step1Error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10 }}>
          <Select
            label={tx.selectCompany}
            value={selectedCompanyId}
            onChange={(event) => setSelectedCompanyId(event.target.value)}
          >
            <option value="">{tx.companyPlaceholder}</option>
            {companies.map((company) => (
              <option key={company.id} value={String(company.id)}>
                {company.name} ({company.storeCount} / {company.employeeCount})
              </option>
            ))}
          </Select>

          <Select
            label={tx.selectStore}
            value={selectedStoreId}
            onChange={(event) => setSelectedStoreId(event.target.value)}
            disabled={!selectedCompanyIdNum}
          >
            <option value="">{tx.storePlaceholder}</option>
            {companyStores.map((store) => (
              <option key={store.id} value={String(store.id)}>
                {store.code} - {store.name} ({store.employeeCount})
              </option>
            ))}
          </Select>

          <Input
            label={tx.searchExternal}
            value={externalSearch}
            onChange={(event) => setExternalSearch(event.target.value)}
            placeholder={tx.searchPlaceholder}
            disabled={!selectedCompanyIdNum}
          />
        </div>

        <div style={{ ...panelShellStyle, background: '#fff' }}>
          <div style={{ maxHeight: 260, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(13,33,55,0.04)' }}>
                  <th style={{ textAlign: 'left', padding: 9, fontSize: 12 }}>{tx.externalCode}</th>
                  <th style={{ textAlign: 'left', padding: 9, fontSize: 12 }}>{tx.externalStore}</th>
                  <th style={{ textAlign: 'left', padding: 9, fontSize: 12 }}>{tx.externalCompany}</th>
                  <th style={{ textAlign: 'left', padding: 9, fontSize: 12 }}>{tx.mappedLocalStore}</th>
                  <th style={{ textAlign: 'left', padding: 9, fontSize: 12 }}>{tx.action}</th>
                </tr>
              </thead>
              <tbody>
                {depositiRows.map((row) => (
                  <tr key={row.externalStoreCode} style={{ borderTop: '1px solid var(--border-light)' }}>
                    <td style={{ padding: 9, fontSize: 13, fontFamily: 'monospace' }}>{row.externalStoreCode}</td>
                    <td style={{ padding: 9, fontSize: 13 }}>{row.storeName ?? '-'}</td>
                    <td style={{ padding: 9, fontSize: 13 }}>{row.companyName ?? '-'}</td>
                    <td style={{ padding: 9, fontSize: 13 }}>
                      {row.mappedLocalStoreCode
                        ? `${row.mappedLocalStoreCode} - ${row.mappedLocalStoreName}`
                        : '-'}
                    </td>
                    <td style={{ padding: 9 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => { void handleMapStore(row.externalStoreCode); }}
                        disabled={!selectedStore || !canWrite || savingMappingCode === row.externalStoreCode}
                      >
                        {savingMappingCode === row.externalStoreCode ? tx.saving : tx.storeIntegrationAction}
                      </button>
                    </td>
                  </tr>
                ))}
                {depositiRows.length === 0 && !loadingDepositi && (
                  <tr>
                    <td colSpan={5} style={{ padding: 10, fontSize: 12, color: 'var(--text-muted)' }}>{tx.noExternalStores}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ ...panelShellStyle, background: '#fff' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{tx.savedIntegrationsTitle}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{tx.savedIntegrationsHint}</div>
          </div>
          <div style={{ maxHeight: 220, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(13,33,55,0.04)' }}>
                  <th style={{ textAlign: 'left', padding: 9, fontSize: 12 }}>{tx.colStore}</th>
                  <th style={{ textAlign: 'left', padding: 9, fontSize: 12 }}>{tx.externalCode}</th>
                  <th style={{ textAlign: 'left', padding: 9, fontSize: 12 }}>{tx.externalStore}</th>
                  <th style={{ textAlign: 'left', padding: 9, fontSize: 12 }}>{tx.updatedAt}</th>
                  <th style={{ textAlign: 'left', padding: 9, fontSize: 12 }}>{tx.action}</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => (
                  <tr key={mapping.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                    <td style={{ padding: 9, fontSize: 13 }}>{mapping.localStoreCode} - {mapping.localStoreName}</td>
                    <td style={{ padding: 9, fontSize: 13, fontFamily: 'monospace' }}>{mapping.externalStoreCode}</td>
                    <td style={{ padding: 9, fontSize: 13 }}>{mapping.externalStoreName ?? '-'}</td>
                    <td style={{ padding: 9, fontSize: 13 }}>{formatDateTime(mapping.updatedAt)}</td>
                    <td style={{ padding: 9 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => { void handleDeleteMapping(mapping.localStoreId); }}
                        disabled={!canWrite}
                      >
                        <Unlink size={13} /> {tx.remove}
                      </button>
                    </td>
                  </tr>
                ))}
                {mappings.length === 0 && !loadingMappings && (
                  <tr>
                    <td colSpan={5} style={{ padding: 10, fontSize: 12, color: 'var(--text-muted)' }}>{tx.noMappings}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Database size={16} color="var(--primary)" />
          <h3 style={{ margin: 0, color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>{tx.step2Title}</h3>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{tx.step2Hint}</p>

        {step2Error && (
          <div style={{ border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 10, padding: 10, fontSize: 13 }}>
            <strong>{tx.stepError}: </strong>{step2Error}
          </div>
        )}

        {!selectedStoreMapping && selectedStore && (
          <div style={{ border: '1px solid var(--warning-border)', background: 'var(--warning-bg)', color: 'var(--warning)', borderRadius: 10, padding: 10, fontSize: 13 }}>
            {tx.notMappedWarning}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, alignItems: 'end' }}>
          <DatePicker label={tx.fromDate} value={fromDate} onChange={setFromDate} />
          <DatePicker label={tx.toDate} value={toDate} onChange={setToDate} />

          <div style={{ display: 'grid', gap: 5 }}>
            <label style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{tx.selectedStore}</label>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', padding: '9px 12px', minHeight: 39, fontSize: 13, color: 'var(--text-secondary)' }}>
              {selectedStore ? `${selectedStore.code} - ${selectedStore.name}` : tx.noStore}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { void handleLoadTraffic(); }}
            disabled={loadingTraffic || !selectedStore || !selectedStoreMapping}
          >
            {loadingTraffic ? tx.loadingTraffic : tx.loadIngressi}
          </button>
        </div>

        {trafficData && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: '#fff' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tx.totalDays}</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--primary)' }}>{trafficData.summary.totalDays}</div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: '#fff' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tx.totalVisitors}</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--primary)' }}>{trafficData.summary.totalVisitors.toLocaleString()}</div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: '#fff' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tx.avgDay}</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--primary)' }}>{trafficData.summary.avgVisitors.toFixed(2)}</div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: '#fff' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tx.minMax}</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--primary)' }}>{trafficData.summary.minVisitors} - {trafficData.summary.maxVisitors}</div>
              </div>
            </div>

            <div style={{ ...panelShellStyle, background: '#fff' }}>
              <div style={{ maxHeight: 260, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(13,33,55,0.04)' }}>
                      <th style={{ textAlign: 'left', padding: 9, fontSize: 12 }}>{tx.date}</th>
                      <th style={{ textAlign: 'left', padding: 9, fontSize: 12 }}>{tx.externalCode}</th>
                      <th style={{ textAlign: 'left', padding: 9, fontSize: 12 }}>{tx.visitors}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trafficData.rows.map((row) => (
                      <tr key={`${row.externalStoreCode}-${row.date}`} style={{ borderTop: '1px solid var(--border-light)' }}>
                        <td style={{ padding: 9, fontSize: 13 }}>{row.date}</td>
                        <td style={{ padding: 9, fontSize: 13, fontFamily: 'monospace' }}>{row.externalStoreCode}</td>
                        <td style={{ padding: 9, fontSize: 13 }}>{row.visitors.toLocaleString()}</td>
                      </tr>
                    ))}
                    {trafficData.rows.length === 0 && (
                      <tr><td colSpan={3} style={{ padding: 10, fontSize: 12, color: 'var(--text-muted)' }}>{tx.noTrafficRows}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      <section style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <WandSparkles size={16} color="var(--primary)" />
          <h3 style={{ margin: 0, color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>{tx.step3Title}</h3>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{tx.step3Hint}</p>

        {step3Error && (
          <div style={{ border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 10, padding: 10, fontSize: 13 }}>
            <strong>{tx.stepError}: </strong>{step3Error}
          </div>
        )}

        {!selectedStoreMapping && selectedStore && (
          <div style={{ border: '1px solid var(--warning-border)', background: 'var(--warning-bg)', color: 'var(--warning)', borderRadius: 10, padding: 10, fontSize: 13 }}>
            {tx.notMappedWarning}
          </div>
        )}

        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: 'rgba(13,33,55,0.03)', fontSize: 12, color: 'var(--text-secondary)', display: 'grid', gap: 5 }}>
          <strong style={{ color: 'var(--primary)' }}>{tx.formulaTitle}</strong>
          <div>{tx.formulaLine1}</div>
          <div>{tx.formulaLine2Prefix} {previewData?.visitorsPerStaff ?? 10} {tx.formulaLine2Suffix}</div>
          <div>{tx.formulaLine3}</div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { void handleLoadPreview(); }}
            disabled={loadingPreview || !selectedStore || !selectedStoreMapping}
          >
            {loadingPreview ? tx.generating : tx.generatePreview}
          </button>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={overwriteDefault}
              onChange={(event) => setOverwriteDefault(event.target.checked)}
            />
            {tx.overwrite}
          </label>

          <button
            type="button"
            className="btn btn-accent"
            onClick={() => { void handleSyncPreview(); }}
            disabled={!canWrite || syncing || !selectedStore || !selectedStoreMapping}
          >
            {syncing ? tx.syncing : tx.applyToLocal}
          </button>
        </div>

        {previewData && (
          <div style={{ ...panelShellStyle, background: '#fff' }}>
            {previewData.recommendations.length === 0 ? (
              <div style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>{tx.noRecommendations}</div>
            ) : (
              <div style={{ maxHeight: 360, overflow: 'auto' }}>
                {Array.from(previewByDay.keys()).sort((a, b) => a - b).map((dayOfWeek) => {
                  const rows = previewByDay.get(dayOfWeek) ?? [];
                  return (
                    <div key={`day-${dayOfWeek}`}>
                      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)', background: 'rgba(13,33,55,0.04)', fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        {weekdayLabel(dayOfWeek, isItalian)}
                      </div>
                      {rows.map((row) => {
                        const levelColor = row.level === 'high'
                          ? '#b91c1c'
                          : row.level === 'medium'
                            ? '#a16207'
                            : '#166534';
                        const levelBg = row.level === 'high'
                          ? 'rgba(220,38,38,0.12)'
                          : row.level === 'medium'
                            ? 'rgba(202,138,4,0.12)'
                            : 'rgba(22,163,74,0.12)';

                        const coverageColor = row.coverageStatus === 'under'
                          ? '#b91c1c'
                          : row.coverageStatus === 'over'
                            ? '#1d4ed8'
                            : '#166534';
                        const coverageBg = row.coverageStatus === 'under'
                          ? 'rgba(220,38,38,0.12)'
                          : row.coverageStatus === 'over'
                            ? 'rgba(29,78,216,0.12)'
                            : 'rgba(22,163,74,0.12)';

                        const coverageLabel = row.coverageStatus === 'under'
                          ? tx.under
                          : row.coverageStatus === 'over'
                            ? tx.over
                            : tx.balanced;

                        return (
                          <div key={`${dayOfWeek}-${row.timeSlot}`} style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr 1fr 1fr 1fr 1fr 1fr', gap: 8, alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-light)' }}>
                            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{row.timeSlot}</div>

                            <div style={{ display: 'inline-flex', justifySelf: 'start', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, background: levelBg, color: levelColor, fontSize: 11, fontWeight: 700 }}>
                              {row.level === 'low' ? tx.low : row.level === 'medium' ? tx.medium : tx.high}
                            </div>

                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              <strong>{tx.estimatedVisitors}:</strong> {row.estimatedVisitors.toFixed(2)}
                            </div>

                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              <strong>{tx.recommendedStaff}:</strong> {row.requiredStaff}
                            </div>

                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              <strong>{tx.scheduledStaff}:</strong> {row.currentScheduledStaff.toFixed(2)}
                            </div>

                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              <strong>{tx.currentDefault}:</strong> {row.currentRequiredStaff ?? '-'}
                            </div>

                            <div style={{ display: 'inline-flex', justifySelf: 'start', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, background: coverageBg, color: coverageColor, fontSize: 11, fontWeight: 700 }}>
                              {tx.gap}: {row.deltaToScheduledStaff > 0 ? `+${row.deltaToScheduledStaff.toFixed(2)}` : row.deltaToScheduledStaff.toFixed(2)} ({coverageLabel})
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h3 style={{ margin: 0, color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>{tx.dictionaryTitle}</h3>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{tx.dictionaryHint}</p>

        {catalog.map((table) => (
          <div key={table.table} style={{ ...panelShellStyle, background: '#fff' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
              {table.table.toUpperCase()} - {table.englishName}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(13,33,55,0.04)' }}>
                    <th style={{ textAlign: 'left', padding: 8, fontSize: 11 }}>🇮🇹 {tx.itField}</th>
                    <th style={{ textAlign: 'left', padding: 8, fontSize: 11 }}>🇬🇧 {tx.enField}</th>
                    <th style={{ textAlign: 'left', padding: 8, fontSize: 11 }}>{tx.fieldType}</th>
                    <th style={{ textAlign: 'left', padding: 8, fontSize: 11 }}>{tx.fieldDescription}</th>
                  </tr>
                </thead>
                <tbody>
                  {table.columns.map((column) => (
                    <tr key={`${table.table}-${column.field}`} style={{ borderTop: '1px solid var(--border-light)' }}>
                      <td style={{ ...tinyCell, padding: 8, fontFamily: 'monospace' }}>{column.field}</td>
                      <td style={{ ...tinyCell, padding: 8, fontFamily: 'monospace' }}>{column.englishLabel}</td>
                      <td style={{ ...tinyCell, padding: 8 }}>{column.type}</td>
                      <td style={{ ...tinyCell, padding: 8 }}>{column.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      {(showLoading || loadingMappings || loadingDepositi) && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tx.loading}</div>
      )}
    </div>
  );
}
