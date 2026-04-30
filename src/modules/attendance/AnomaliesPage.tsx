import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getEmployees } from '../../api/employees';
import { getStores } from '../../api/stores';
import { formatLocalDate } from '../../utils/date';
import { DatePicker } from '../../components/ui/DatePicker';
import { WeekPicker } from '../../components/ui/WeekPicker';
import { useBreakpoint } from '../../hooks/useBreakpoint';
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
      <div style={{ background: 'var(--primary)', padding: heroPad, paddingBottom: 24 }}>
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
        padding: filterPad,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        gap: isMobile ? 10 : 12,
        flexWrap: isMobile ? undefined : 'wrap',
        position: 'sticky', top: 0, zIndex: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>

        {/* Search */}
        <input
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          placeholder={t('employees.searchPlaceholder', 'Search by name, surname or ID...')}
          style={{
            minWidth: isMobile ? 180 : 240,
            width: isMobile ? '100%' : 260,
            height: 34,
            borderRadius: 8,
            border: '1px solid var(--border)',
            padding: '0 10px',
            background: 'var(--background)',
            color: 'var(--text)',
            fontSize: 12,
            outline: 'none',
          }}
        />

        {!isMobile && <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />}

        {/* Store filter */}
        <select
          value={filterStoreId}
          onChange={(e) => {
            const nextStoreId = e.target.value;
            setFilterStoreId(nextStoreId);
            setFilterUserId('');
            void loadFilterEmployees(nextStoreId ? parseInt(nextStoreId, 10) : undefined);
          }}
          style={{
            minWidth: isMobile ? 140 : 180, height: 34, borderRadius: 8,
            border: '1px solid var(--border)', padding: '0 10px',
            background: 'var(--background)', color: 'var(--text)', fontSize: 12, outline: 'none',
          }}
        >
          <option value="">{t('common.all')} {t('common.store', 'store').toLowerCase()}</option>
          {filterStores.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.companyName ? `${s.name} (${s.companyName})` : s.name}
            </option>
          ))}
        </select>

        {/* Employee filter */}
        <select
          value={filterUserId}
          onChange={(e) => setFilterUserId(e.target.value)}
          style={{
            minWidth: isMobile ? 160 : 220, height: 34, borderRadius: 8,
            border: '1px solid var(--border)', padding: '0 10px',
            background: 'var(--background)', color: 'var(--text)', fontSize: 12, outline: 'none',
          }}
        >
          <option value="">{t('common.all')} {t('employees.colName', 'employee').toLowerCase()}</option>
          {filterEmployees.map((e) => (
            <option key={e.id} value={String(e.id)}>{e.name} {e.surname}</option>
          ))}
        </select>

        {!isMobile && <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />}

        {/* Date range */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8,
          overflowX: isMobile ? 'auto' : undefined,
          width: isMobile ? '100%' : undefined,
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '1.2px', flexShrink: 0,
          }}>
            {t('attendance.dateFrom', 'From')}
          </span>
          <div style={{ width: isMobile ? 140 : 152, flexShrink: 0 }}>
            <DatePicker value={dateFrom} onChange={setDateFrom} />
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '1.2px', flexShrink: 0,
          }}>
            {t('attendance.dateTo', 'To')}
          </span>
          <div style={{ width: isMobile ? 140 : 152, flexShrink: 0 }}>
            <DatePicker value={dateTo} onChange={setDateTo} />
          </div>
          {!isMobile && <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />}
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '1.2px', flexShrink: 0,
          }}>
            {t('shifts.week', 'Week')}
          </span>
          <div style={{ width: isMobile ? 170 : 200, flexShrink: 0 }}>
            <WeekPicker
              value={''}
              onChange={(w) => {
                const range = isoWeekToDateRange(w);
                if (range) { setDateFrom(range.from); setDateTo(range.to); }
              }}
              placeholder={t('shifts.weekPickerHint', 'Choose a week')}
            />
          </div>
        </div>
      </div>

      {/* ── Anomaly list ───────────────────────────────────────────────────── */}
      <AnomalyList
        dateFrom={dateFrom}
        dateTo={dateTo}
        storeId={filterStoreId ? parseInt(filterStoreId, 10) : undefined}
        userId={filterUserId ? parseInt(filterUserId, 10) : undefined}
        search={filterSearch.trim() || undefined}
      />
    </div>
  );
}
