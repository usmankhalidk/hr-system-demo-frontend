import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { listShifts, Shift, copyWeek, exportShifts } from '../../api/shifts';
import WeeklyCalendar from './WeeklyCalendar';
import MonthlyCalendar from './MonthlyCalendar';
import ShiftDrawer from './ShiftDrawer';
import ShiftTemplatesPanel from './ShiftTemplatesPanel';

type ViewMode = 'week' | 'month';

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatIsoWeek(date: Date): string {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function formatIsoMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

const MANAGEMENT_ROLES = ['admin', 'hr', 'area_manager', 'store_manager'];

export default function ShiftsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState<Date>(getWeekStart(new Date()));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | undefined>();
  const [prefillUserId, setPrefillUserId] = useState<number | undefined>();

  // Templates panel state
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const canEdit = user ? MANAGEMENT_ROLES.includes(user.role) : false;

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = viewMode === 'week'
        ? { week: formatIsoWeek(currentDate) }
        : { month: formatIsoMonth(currentDate) };
      const data = await listShifts(params);
      setShifts(data.shifts);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? t('common.error', 'Errore nel caricamento'));
    } finally {
      setLoading(false);
    }
  }, [currentDate, viewMode, t]);

  useEffect(() => { fetchShifts(); }, [fetchShifts]);

  function navigate(direction: -1 | 1) {
    if (viewMode === 'week') setCurrentDate((d) => addWeeks(d, direction));
    else setCurrentDate((d) => addMonths(d, direction));
  }

  function handleShiftClick(shift: Shift) {
    setEditingShift(shift);
    setPrefillDate(undefined);
    setPrefillUserId(undefined);
    setDrawerOpen(true);
  }

  function handleCellClick(userId: number, date: string) {
    setEditingShift(null);
    setPrefillDate(date);
    setPrefillUserId(userId);
    setDrawerOpen(true);
  }

  function handleDrawerClose(refreshNeeded: boolean) {
    setDrawerOpen(false);
    setEditingShift(null);
    if (refreshNeeded) fetchShifts();
  }

  async function handleExport() {
    try {
      const blob = await exportShifts({ week: formatIsoWeek(currentDate) });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `turni-${formatIsoWeek(currentDate)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t('shifts.exportError', 'Errore durante l\'esportazione'));
    }
  }

  async function handleCopyWeek() {
    const targetWeek = formatIsoWeek(addWeeks(currentDate, 1));
    if (!window.confirm(t('shifts.confirmCopyWeek', `Copiare i turni nella settimana ${targetWeek}?`))) return;
    try {
      await copyWeek({
        store_id: user?.storeId ?? 0,
        source_week: formatIsoWeek(currentDate),
        target_week: targetWeek,
      });
      fetchShifts();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? t('common.error', 'Errore'));
    }
  }

  const periodLabel = viewMode === 'week'
    ? `${t('shifts.week', 'Settimana')} ${formatIsoWeek(currentDate)}`
    : currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--primary)', margin: 0 }}>
          {t('shifts.title', 'Turni')}
        </h1>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setTemplatesOpen(true)}>
              {t('shifts.templates', 'Template')}
            </button>
            {viewMode === 'week' && (
              <>
                <button className="btn btn-secondary" onClick={handleCopyWeek}>
                  {t('shifts.copyWeek', 'Copia settimana')}
                </button>
                <button className="btn btn-secondary" onClick={handleExport}>
                  {t('shifts.export', 'Esporta CSV')}
                </button>
              </>
            )}
            <button className="btn btn-primary" onClick={() => { setEditingShift(null); setDrawerOpen(true); }}>
              + {t('shifts.newShift', 'Nuovo turno')}
            </button>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)', padding: '12px 16px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        {/* View toggle */}
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {(['week', 'month'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '6px 16px',
                background: viewMode === mode ? 'var(--primary)' : 'transparent',
                color: viewMode === mode ? '#fff' : 'var(--text)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontSize: '0.875rem',
              }}
            >
              {mode === 'week' ? t('shifts.weekView', 'Settimana') : t('shifts.monthView', 'Mese')}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>&#8249;</button>
        <span style={{ fontWeight: 600, minWidth: 180, textAlign: 'center', fontFamily: 'var(--font-display)' }}>
          {periodLabel}
        </span>
        <button className="btn btn-secondary" onClick={() => navigate(1)}>&#8250;</button>
        <button className="btn btn-secondary" onClick={() => setCurrentDate(getWeekStart(new Date()))}>
          {t('shifts.today', 'Oggi')}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: '#ffebee', border: '1px solid #ef9a9a',
          borderRadius: 6, padding: '10px 16px', marginBottom: 16,
          color: '#c62828', fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      {/* Calendar */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            {t('common.loading', 'Caricamento...')}
          </div>
        ) : viewMode === 'week' ? (
          <WeeklyCalendar
            shifts={shifts}
            weekStart={currentDate}
            onShiftClick={handleShiftClick}
            onCellClick={handleCellClick}
            canEdit={canEdit}
          />
        ) : (
          <MonthlyCalendar
            shifts={shifts}
            currentDate={currentDate}
            onDayClick={(date) => {
              setCurrentDate(getWeekStart(new Date(date)));
              setViewMode('week');
            }}
          />
        )}
      </div>

      {/* Shift Drawer */}
      <ShiftDrawer
        open={drawerOpen}
        shift={editingShift}
        prefillDate={prefillDate}
        prefillUserId={prefillUserId}
        onClose={handleDrawerClose}
      />

      {/* Templates Panel */}
      <ShiftTemplatesPanel
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
      />
    </div>
  );
}
