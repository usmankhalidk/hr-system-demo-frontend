import { useState, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getEmployees } from '../../api/employees';
import { getStores } from '../../api/stores';
import { formatLocalDate } from '../../utils/date';
import { DatePicker } from '../../components/ui/DatePicker';
import { WeekPicker } from '../../components/ui/WeekPicker';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import CustomSelect from '../../components/ui/CustomSelect';
import AnomalyList from './AnomalyList';

function isoWeekToDateRange(isoWeek: string): { from: string; to: string } | null {
  const m = isoWeek.match(/^(\d{4})-W(\d{1,2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (jan4Day - 1) + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${dd}`;
  };
  return { from: fmt(monday), to: fmt(sunday) };
}

export default function AnomaliesPage() {
  const { t } = useTranslation();
  const { isMobile, isTablet } = useBreakpoint();

  const today     = formatLocalDate(new Date());
  const weekAgoDate = new Date();
  weekAgoDate.setDate(weekAgoDate.getDate() - 7);
  const weekAgo   = formatLocalDate(weekAgoDate);

  const [dateFrom, setDateFrom]         = useState(weekAgo);
  const [dateTo, setDateTo]             = useState(today);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStoreId, setFilterStoreId] = useState('');
  const [filterUserId, setFilterUserId]   = useState('');
  const [filterEmployees, setFilterEmployees] = useState<Array<{ id: number; name: string; surname: string; storeId: number | null }>>([]);
  const [filterStores, setFilterStores]   = useState<Array<{ id: number; name: string; companyName?: string }>>([]);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [compact, setCompact] = useState(false);

  // Temporary filter states
  const [tempStoreId, setTempStoreId] = useState(filterStoreId);
  const [tempUserId, setTempUserId] = useState(filterUserId);
  const [tempDateFrom, setTempDateFrom] = useState(dateFrom);
  const [tempDateTo, setTempDateTo] = useState(dateTo);

  // Sync temp states on open
  const openFilterModal = () => {
    setTempStoreId(filterStoreId);
    setTempUserId(filterUserId);
    setTempDateFrom(dateFrom);
    setTempDateTo(dateTo);
    setShowFilterModal(true);
  };

  const applyFilters = () => {
    setFilterStoreId(tempStoreId);
    setFilterUserId(tempUserId);
    setDateFrom(tempDateFrom);
    setDateTo(tempDateTo);
    setShowFilterModal(false);
  };

  const resetAllFilters = () => {
    setTempStoreId('');
    setTempUserId('');
    setTempDateFrom(weekAgo);
    setTempDateTo(today);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterStoreId) count++;
    if (filterUserId) count++;
    if (dateFrom && dateFrom !== weekAgo) count++;
    if (dateTo && dateTo !== today) count++;
    return count;
  }, [filterStoreId, filterUserId, dateFrom, dateTo, weekAgo, today]);

  const filteredEmployeesForSelect = useMemo(() => {
    if (!tempStoreId) return filterEmployees;
    const sId = parseInt(tempStoreId, 10);
    return filterEmployees.filter((e) => e.storeId === sId);
  }, [tempStoreId, filterEmployees]);

  const loadFilterEmployees = useCallback(async (storeId?: number) => {
    try {
      const res = await getEmployees({ limit: 500, status: 'active', ...(storeId ? { storeId } : {}) });
      setFilterEmployees(
        res.employees.map((e) => ({
          id: e.id, name: e.name, surname: e.surname, storeId: e.storeId ?? null,
        })),
      );
    } catch {
      setFilterEmployees([]);
    }
  }, []);

  useEffect(() => {
    getStores()
      .then((stores) => setFilterStores(stores.map((s) => ({ id: s.id, name: s.name, companyName: s.companyName }))))
      .catch(() => setFilterStores([]));
    void loadFilterEmployees();
  }, [loadFilterEmployees]);

  const heroPad    = isMobile ? '20px 16px 0' : isTablet ? '24px 20px 0' : '28px 32px 0';
  const filterPad  = isMobile ? '10px 16px'   : isTablet ? '12px 20px' : '12px 32px';

  return (
    <div style={{ padding: 0, minHeight: '100%' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Hero header ───────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--primary)',
        padding: heroPad,
        paddingBottom: 24,
        margin: isMobile ? '16px 16px 0' : isTablet ? '20px 20px 0' : '24px 32px 0',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'flex-start',
          justifyContent: 'space-between',
          gap: isMobile ? 14 : 0,
          marginBottom: 0,
        }}>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '2.5px',
              color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 8,
            }}>
              {t('nav.anomalies', 'Anomalies')}
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: isMobile ? '1.4rem' : '1.75rem',
              fontWeight: 800, color: '#fff', margin: 0, letterSpacing: -0.5, lineHeight: 1.2,
            }}>
              {t('attendance.anomalies_title', 'Attendance Anomalies')}
            </h1>
            <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
              {t('attendance.anomalies_subtitle', 'Detect late arrivals, no-shows, long breaks, and early exits')}
            </div>
          </div>

          {/* Anomaly type legend */}
          {!isMobile && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
              {[
                { label: t('attendance.anomaly_late_arrival', 'Late Arrival'),  color: '#f59e0b' },
                { label: t('attendance.anomaly_no_show', 'No Show'),            color: '#ef4444' },
                { label: t('attendance.anomaly_long_break', 'Long Break'),      color: '#a78bfa' },
                { label: t('attendance.anomaly_early_exit', 'Early Exit'),      color: '#60a5fa' },
                { label: t('attendance.anomaly_overtime', 'Overtime'),          color: '#c2410c' },
              ].map(({ label, color }) => (
                <span key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 20,
                  background: `${color}18`, border: `1px solid ${color}35`,
                  fontSize: 11, fontWeight: 600, color,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div style={{
        margin: isMobile ? '12px 16px 0' : isTablet ? '16px 20px 0' : '20px 32px 0',
        padding: filterPad,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: 'auto',
        position: 'relative',
        zIndex: 20,
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      }}>
        {/* Search Input */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 14, top: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <input
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder={t('employees.searchPlaceholder', { defaultValue: 'Cerca dipendente...' })}
            style={{
              width: '100%',
              height: 42,
              borderRadius: 12,
              border: '1px solid var(--border)',
              padding: '0 16px 0 42px',
              background: 'var(--background)',
              color: 'var(--text)',
              fontSize: 14,
              outline: 'none',
              transition: 'all 0.15s',
            }}
          />
        </div>

        {/* Filter Button */}
        <button
          onClick={openFilterModal}
          style={{
            background: activeFiltersCount > 0
              ? 'linear-gradient(135deg, var(--accent) 0%, #B48719 100%)'
              : 'var(--surface)',
            color: activeFiltersCount > 0 ? '#fff' : 'var(--text-secondary)',
            border: activeFiltersCount > 0 ? 'none' : '1px solid var(--border)',
            borderRadius: 12,
            padding: '0 18px',
            height: 42,
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
            transition: 'all 0.2s',
            boxShadow: activeFiltersCount > 0 ? '0 2px 8px rgba(139,105,20,0.24)' : 'none',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          <span>{t('employees.filters', 'Filtri')}</span>
          {activeFiltersCount > 0 && (
            <span style={{
              background: activeFiltersCount > 0 ? '#fff' : 'var(--accent)',
              color: activeFiltersCount > 0 ? 'var(--accent)' : '#fff',
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '999px',
              marginLeft: '4px',
            }}>
              {activeFiltersCount}
            </span>
          )}
        </button>

        {/* Compact / Expand Button */}
        <button
          onClick={() => setCompact(!compact)}
          title={compact ? t('attendance.normalView', 'Visualizzazione normale') : t('attendance.compactView', 'Visualizzazione compatta')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 16px',
            height: 42,
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: compact ? 'var(--accent-light)' : 'var(--surface)',
            color: compact ? 'var(--accent)' : 'var(--text-secondary)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
          <span style={{ display: isMobile ? 'none' : 'inline' }}>
            {compact ? t('attendance.compact', 'Compatto') : t('attendance.normal', 'Normale')}
          </span>
        </button>
      </div>

      {/* ── Anomaly list ───────────────────────────────────────────────────── */}
      <AnomalyList
        dateFrom={dateFrom}
        dateTo={dateTo}
        storeId={filterStoreId ? parseInt(filterStoreId, 10) : undefined}
        userId={filterUserId ? parseInt(filterUserId, 10) : undefined}
        search={filterSearch.trim() || undefined}
        compact={compact}
      />

      {showFilterModal && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(13,33,55,0.48)',
            backdropFilter: 'blur(3px)',
          }}
          onClick={() => setShowFilterModal(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '16px',
              width: 'min(520px, 92vw)',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
              overflow: 'hidden',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Accent stripe */}
            <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent) 0%, var(--primary) 100%)' }} />

            {/* Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #8B6914 0%, #B48719 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                  </svg>
                </div>
                <div>
                  <h2
                    style={{
                      fontSize: '17px',
                      fontWeight: 700,
                      color: 'var(--text)',
                      fontFamily: 'var(--font-display)',
                      margin: 0,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {t('attendance.filterTitle', 'Filtra anomalie')}
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    {t('attendance.filterSubtitle', 'Affina la ricerca delle anomalie')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFilterModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '24px',
                  lineHeight: 1,
                  padding: '4px 8px',
                }}
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Store filter */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
                  {t('common.store', 'Negozio')}
                </label>
                <CustomSelect
                  value={tempStoreId || null}
                  onChange={(val) => {
                    const nextStoreId = val ?? '';
                    setTempStoreId(nextStoreId);
                    setTempUserId('');
                    void loadFilterEmployees(nextStoreId ? parseInt(nextStoreId, 10) : undefined);
                  }}
                  options={[
                    { value: '', label: t('common.all', 'Tutti') + ' ' + t('common.store').toLowerCase() },
                    ...filterStores.map((s) => ({
                      value: String(s.id),
                      label: s.companyName ? `${s.name} (${s.companyName})` : s.name,
                    })),
                  ]}
                  placeholder={t('common.all', 'Tutti') + ' ' + t('common.store').toLowerCase()}
                  searchable={true}
                  controlMinHeight={38}
                />
              </div>

              {/* Employee filter */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
                  {t('employees.colName', 'Dipendente')}
                </label>
                <CustomSelect
                  value={tempUserId || null}
                  onChange={(val) => setTempUserId(val ?? '')}
                  options={[
                    { value: '', label: t('common.all', 'Tutti') + ' ' + t('employees.colName').toLowerCase() },
                    ...filteredEmployeesForSelect.map((e) => ({
                      value: String(e.id),
                      label: `${e.name} ${e.surname}`,
                    })),
                  ]}
                  placeholder={t('common.all', 'Tutti') + ' ' + t('employees.colName').toLowerCase()}
                  searchable={true}
                  controlMinHeight={38}
                />
              </div>

              {/* Date pickers (row) */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                    {t('attendance.dateFrom', 'Dal')}
                  </label>
                  <DatePicker
                    value={tempDateFrom}
                    onChange={setTempDateFrom}
                    disablePortal={true}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                    {t('attendance.dateTo', 'Al')}
                  </label>
                  <DatePicker
                    value={tempDateTo}
                    onChange={setTempDateTo}
                    align="right"
                    disablePortal={true}
                  />
                </div>
              </div>

              {/* Week Picker */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  {t('shifts.week', 'Seleziona Settimana')}
                </label>
                <WeekPicker
                  value={''}
                  onChange={(w) => {
                    const range = isoWeekToDateRange(w);
                    if (range) {
                      setTempDateFrom(range.from);
                      setTempDateTo(range.to);
                    }
                  }}
                  placeholder={t('shifts.weekPickerHint', 'Scegli settimana...')}
                  disablePortal={true}
                />
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--border)',
                background: 'var(--surface-warm)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '10px',
                flexShrink: 0,
              }}
            >
              <button
                onClick={resetAllFilters}
                style={{
                  padding: '9px 20px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-secondary)',
                  transition: 'background 0.15s',
                }}
              >
                {t('employees.resetFilters', 'Reset all')}
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowFilterModal(false)}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {t('common.cancel', 'Annulla')}
                </button>
                <button
                  onClick={applyFilters}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    background: 'linear-gradient(135deg, var(--accent) 0%, #B48719 100%)',
                    color: '#fff',
                    boxShadow: '0 2px 8px rgba(139,105,20,0.24)',
                  }}
                >
                  {t('employees.applyFilters', 'Applica filtri')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
