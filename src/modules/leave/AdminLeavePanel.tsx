import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import {
  getLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
  createLeaveOnBehalf,
  deleteLeaveRequest,
  downloadCertificate,
  getLeaveBalance,
  setLeaveBalance,
  exportLeaveBalances,
  importLeaveBalances,
  downloadLeaveBalanceTemplate,
  ImportResult,
  LeaveRequest,
  LeaveStatus,
  LeaveBalance,
  LeaveType,
} from '../../api/leave';
import { getEmployees } from '../../api/employees';
import { getAvatarUrl } from '../../api/client';
import { DatePicker } from '../../components/ui/DatePicker';
import { formatLocalDate } from '../../utils/date';
import { LeaveRequestDrawer } from './LeaveRequestDrawer';
import { translateApiError } from '../../utils/apiErrors';

// ── Status badge ───────────────────────────────────────────────────────────

const STATUS_META: Record<LeaveStatus, { bg: string; color: string }> = {
  pending:                         { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' },
  'store manager approved':        { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6' },
  'store manager rejected':        { bg: 'rgba(220,38,38,0.12)',   color: '#dc2626' },
  'area manager approved':         { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6' },
  'area manager rejected':         { bg: 'rgba(220,38,38,0.12)',   color: '#dc2626' },
  'HR approved':                   { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6' },
  'HR rejected':                   { bg: 'rgba(220,38,38,0.12)',   color: '#dc2626' },
  approved:                        { bg: 'rgba(22,163,74,0.12)',   color: '#16a34a' },
  rejected:                        { bg: 'rgba(220,38,38,0.12)',   color: '#dc2626' },
  cancelled:                       { bg: 'rgba(0,0,0,0.05)',       color: '#6b7280' },
};

function StatusBadge({ status }: { status: LeaveStatus }) {
  const { t } = useTranslation();
  const { bg, color } = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
      background: bg, color, textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      {t(`leave.status_${status.toLowerCase().replace(/ /g, '_')}`)}
    </span>
  );
}

// ── Working days helper ────────────────────────────────────────────────────

function countWorkingDays(isoStart: string, isoEnd: string): number {
  const parse = (iso: string) => {
    const match = (iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return new Date();
    return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
  };
  const s = parse(isoStart);
  const e = parse(isoEnd);
  let n = 0;
  const d = new Date(s);
  while (d <= e) {
    const w = d.getDay();
    if (w !== 0 && w !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

// ── Format date range nicely ───────────────────────────────────────────────

function fmtDate(iso: string, locale: string): string {
  if (!iso) return '';
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  const [, y, m, d] = match;
  const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  return dateObj.toLocaleDateString(locale === 'en' ? 'en-GB' : 'it-IT', {
    day: '2-digit', month: 'short',
  });
}

// ── BalancesTab ────────────────────────────────────────────────────────────

interface BalancesTabProps {
  showFlash: (msg: string) => void;
}

export function BalancesTab({ showFlash }: BalancesTabProps) {
  const { t } = useTranslation();

  const currentYear = new Date().getFullYear();
  const yearOptions: number[] = [];
  for (let y = 2024; y <= currentYear + 2; y++) yearOptions.push(y);

  const [employees, setEmployees] = useState<Array<{ id: number; name: string; surname: string }>>([]);
  const [balances, setBalances] = useState<Record<number, LeaveBalance[]>>({});
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragover, setDragover] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit modal state
  const [editTarget, setEditTarget] = useState<{
    userId: number;
    name: string;
    surname: string;
    vacationTotal: string;
    sickTotal: string;
    origVacation: number | undefined;
    origSick: number | undefined;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 700 as const,
    color: 'var(--text-secondary)', marginBottom: 6,
    textTransform: 'uppercase' as const, letterSpacing: '0.8px',
  };

  const selectStyle = {
    padding: '8px 12px', borderRadius: 8,
    border: '1.5px solid var(--border)', background: 'var(--background)',
    color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer',
  };

  const [empError, setEmpError] = useState<string | null>(null);

  // Load employees once
  useEffect(() => {
    setEmpError(null);
    getEmployees({ limit: 200, status: 'active' })
      .then((r) => setEmployees(r.employees.map((e) => ({ id: e.id, name: e.name, surname: e.surname }))))
      .catch(() => {
        setEmpError(t('common.error'));
        setEmployees([]);
      });
  }, [t]);

  // Load balances when employees or year changes
  const loadBalances = useCallback(async (emps: Array<{ id: number; name: string; surname: string }>, selectedYear: number) => {
    if (emps.length === 0) return;
    setLoading(true);
    const balanceMap: Record<number, LeaveBalance[]> = {};
    await Promise.all(
      emps.slice(0, 50).map(async (emp) => {
        try {
          const res = await getLeaveBalance({ userId: emp.id, year: selectedYear });
          balanceMap[emp.id] = res.balances;
        } catch {
          balanceMap[emp.id] = [];
        }
      })
    );
    setBalances(balanceMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      loadBalances(employees, year);
    }
  }, [employees, year, loadBalances]);

  function openEdit(emp: { id: number; name: string; surname: string }) {
    const empBalances = balances[emp.id] ?? [];
    const vac = empBalances.find((b) => b.leaveType === 'vacation');
    const sick = empBalances.find((b) => b.leaveType === 'sick');
    setEditTarget({
      userId: emp.id,
      name: emp.name,
      surname: emp.surname,
      vacationTotal: vac ? String(vac.totalDays) : '',
      sickTotal: sick ? String(sick.totalDays) : '',
      origVacation: vac?.totalDays,
      origSick: sick?.totalDays,
    });
    setEditError(null);
  }

  async function handleExport() {
    try {
      const blob = await exportLeaveBalances(year);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `saldi_${year}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showFlash(t('common.error'));
    }
  }

  async function handleDownloadTemplate() {
    try {
      const blob = await downloadLeaveBalanceTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'saldi_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showFlash(t('common.error'));
    }
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importLeaveBalances(importFile);
      setImportResult(result);
      if (result.imported > 0 && employees.length > 0) {
        loadBalances(employees, year);
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error ?? err?.message ?? t('common.error');
      setImportResult({ imported: 0, skipped: 0, failed: 0, errors: [errMsg], total: 0 });
    } finally {
      setImporting(false);
    }
  }

  function handleImportClose() {
    setImportOpen(false);
    setImportFile(null);
    setImportResult(null);
    setDragover(false);
  }

  async function handleSave() {
    if (!editTarget) return;
    const vacTotal = parseFloat(editTarget.vacationTotal);
    const sickTotal = parseFloat(editTarget.sickTotal);

    if (isNaN(vacTotal) || vacTotal < 0 || isNaN(sickTotal) || sickTotal < 0) {
      setEditError(t('leave.balance_set_error'));
      return;
    }

    setEditSaving(true);
    setEditError(null);

    const origVac = (balances[editTarget.userId] ?? []).find((b) => b.leaveType === 'vacation');
    const origSick = (balances[editTarget.userId] ?? []).find((b) => b.leaveType === 'sick');

    const newBalances: LeaveBalance[] = [...(balances[editTarget.userId] ?? [])];
    let hasError = false;

    // Save vacation if changed
    if (origVac === undefined || vacTotal !== origVac.totalDays) {
      try {
        const updated = await setLeaveBalance({
          userId: editTarget.userId,
          year,
          leaveType: 'vacation',
          totalDays: vacTotal,
        });
        const idx = newBalances.findIndex((b) => b.leaveType === 'vacation');
        if (idx >= 0) newBalances[idx] = updated;
        else newBalances.push(updated);
      } catch (err: unknown) {
        setEditError(translateApiError(err, t, t('leave.balance_set_error')) ?? t('leave.balance_set_error'));
        hasError = true;
      }
    }

    // Save sick if changed (even if vacation failed — attempt both)
    if (origSick === undefined || sickTotal !== origSick.totalDays) {
      try {
        const updated = await setLeaveBalance({
          userId: editTarget.userId,
          year,
          leaveType: 'sick',
          totalDays: sickTotal,
        });
        const idx = newBalances.findIndex((b) => b.leaveType === 'sick');
        if (idx >= 0) newBalances[idx] = updated;
        else newBalances.push(updated);
      } catch (err: unknown) {
        if (!hasError) {
          setEditError(translateApiError(err, t, t('leave.balance_set_error')) ?? t('leave.balance_set_error'));
        }
        hasError = true;
      }
    }

    // Always update local state with whatever succeeded
    setBalances((prev) => ({ ...prev, [editTarget.userId]: newBalances }));
    setEditSaving(false);

    if (!hasError) {
      showFlash(t('leave.balance_set_success'));
      setEditTarget(null);
    }
    // If hasError, modal stays open with the error message shown
  }

  function renderBalanceCell(empId: number, type: LeaveType) {
    const empBalances = balances[empId] ?? [];
    const b = empBalances.find((x) => x.leaveType === type);
    if (!b) {
      return <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>— / — (—)</span>;
    }
    return (
      <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{b.usedDays}</span>
        <span style={{ color: 'var(--text-muted)' }}> / {b.totalDays}</span>
        <span style={{ color: '#16a34a', fontSize: 11, marginLeft: 4 }}>
          ({b.remainingDays} {t('leave.balance_remaining_short').toLowerCase()})
        </span>
      </span>
    );
  }

  return (
    <div style={{ padding: '20px 32px' }}>
      {/* Year selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>{t('leave.balance_year')}</label>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          style={selectStyle}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {loading && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common.loading')}</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={() => handleExport()}
            style={{
              padding: '8px 14px', borderRadius: 8,
              border: '1.5px solid var(--border)', background: 'var(--background)',
              color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>
          <button
            onClick={() => { setImportOpen(true); setImportResult(null); setImportFile(null); }}
            style={{
              padding: '8px 14px', borderRadius: 8,
              border: 'none', background: 'var(--accent)',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Import
          </button>
        </div>
      </div>

      {/* Employee fetch error */}
      {empError && (
        <div style={{
          padding: '12px 16px', margin: '16px 0',
          background: 'rgba(220,38,38,0.08)',
          border: '1px solid rgba(220,38,38,0.25)',
          borderLeft: '4px solid #dc2626',
          borderRadius: 8, color: '#dc2626', fontSize: 13,
        }}>
          {empError}
        </div>
      )}

      {/* Table */}
      {!loading && employees.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 32px', color: 'var(--text-secondary)' }}>
          {t('leave.balance_no_data')}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr style={{ background: 'var(--surface)' }}>
                  {[
                    t('leave.col_employee'),
                    t('leave.balance_vacation'),
                    t('leave.balance_sick'),
                    t('common.actions'),
                  ].map((h, i) => (
                    <th key={`${h}-${i}`} style={{
                      padding: '10px 16px', textAlign: 'left',
                      fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '1.5px',
                      borderBottom: '2px solid var(--border)',
                      ...(i === 0 ? { paddingLeft: 20 } : {}),
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.slice(0, 50).map((emp) => (
                  <tr
                    key={emp.id}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-warm)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                  >
                    <td style={{ padding: '12px 16px 12px 20px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                        {emp.surname} {emp.name}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {renderBalanceCell(emp.id, 'vacation')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {renderBalanceCell(emp.id, 'sick')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => openEdit(emp)}
                        style={{
                          padding: '4px 10px', borderRadius: 6,
                          border: '1px solid var(--border)',
                          background: 'var(--background)',
                          color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        {t('leave.balance_edit_btn')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && employees.length === 0 && (
            <div style={{ padding: '56px 32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
              {t('leave.balance_no_data')}
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget && !editSaving) setEditTarget(null); }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', width: '100%', maxWidth: 420, border: '1px solid var(--border)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  {year}
                </div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  {t('leave.balance_set_title')}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                  {editTarget.surname} {editTarget.name}
                </p>
              </div>
              <button
                onClick={() => setEditTarget(null)}
                disabled={editSaving}
                style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {editError && (
                <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderLeft: '4px solid #dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: 13 }}>
                  {editError}
                </div>
              )}

              {/* Vacation */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>{t('leave.balance_vacation')} — {t('leave.balance_total_label')}</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={editTarget.vacationTotal}
                  onChange={(e) => setEditTarget((prev) => prev ? { ...prev, vacationTotal: e.target.value } : prev)}
                  style={{ ...selectStyle, width: '100%', boxSizing: 'border-box', cursor: 'text' }}
                  placeholder="—"
                />
              </div>

              {/* Sick */}
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>{t('leave.balance_sick')} — {t('leave.balance_total_label')}</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={editTarget.sickTotal}
                  onChange={(e) => setEditTarget((prev) => prev ? { ...prev, sickTotal: e.target.value } : prev)}
                  style={{ ...selectStyle, width: '100%', boxSizing: 'border-box', cursor: 'text' }}
                  placeholder="—"
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setEditTarget(null)}
                  disabled={editSaving}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={editSaving}
                  style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.7 : 1 }}
                >
                  {editSaving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importOpen && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(13,33,55,0.55)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }} onClick={handleImportClose}>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
            width: '100%', maxWidth: 440, overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
            border: '1px solid var(--border)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              background: 'var(--primary)', padding: '18px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
               <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>
                    {t('leave.balance_import_title')}
                  </div>
               </div>
               <button onClick={handleImportClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <button
                    onClick={handleDownloadTemplate}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      padding: '7px 14px', borderRadius: 7,
                      border: '1.5px solid var(--accent)', background: 'var(--accent-light)',
                      color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    {t('leave.balance_download_template')}
                </button>
                <button
                  onClick={() => setGuideOpen((o) => !o)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 7,
                    border: '1.5px solid var(--border)', background: 'transparent',
                    color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  {guideOpen ? t('leave.balance_import_guide_hide') : t('leave.balance_import_guide_toggle')}
                </button>
              </div>

              {/* Format guide (collapsible) */}
              {guideOpen && (
                <div style={{
                  marginBottom: 16, borderRadius: 8,
                  border: '1px solid var(--border)', overflow: 'hidden',
                  fontSize: 12,
                }}>
                  <div style={{
                    background: 'var(--primary)', color: '#fff',
                    padding: '8px 14px', fontWeight: 700, fontSize: 11,
                    letterSpacing: '1px', textTransform: 'uppercase',
                  }}>
                    {t('leave.balance_import_guide_title')}
                  </div>
                  <div className="table-scroll" style={{ borderRadius: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg)' }}>
                          {[t('leave.table_column'), t('leave.table_required'), t('leave.table_format')].map((h) => (
                            <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { col: t('leave.col_matricola'),       req: true, fmt: t('leave.col_matricola_fmt') },
                          { col: t('leave.col_year'),             req: true, fmt: t('leave.col_year_fmt') },
                          { col: t('leave.col_total_holidays'),   req: true, fmt: t('leave.col_days_fmt') },
                          { col: t('leave.col_total_sick'),       req: true, fmt: t('leave.col_days_fmt') },
                        ].map((row, i) => (
                          <tr key={row.col} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{row.col}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                              {row.req
                                ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{t('leave.yes')}</span>
                                : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>
                            <td style={{ padding: '5px 10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{row.fmt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '8px 14px', background: 'rgba(201,151,58,0.06)', borderTop: '1px solid var(--border)', fontSize: 11, color: '#b45309', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span>💡</span>
                    <span>{t('leave.balance_import_template_hint')}</span>
                  </div>
                </div>
              )}

              {!importResult && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
                  onDragLeave={() => setDragover(false)}
                  onDrop={(e) => {
                    e.preventDefault(); setDragover(false);
                    try {
                      const f = e.dataTransfer.files[0];
                      if (f) setImportFile(f);
                    } catch {
                      // ignore empty
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragover ? 'var(--accent)' : importFile ? '#22c55e' : 'var(--border)'}`,
                    borderRadius: 10, padding: '28px 20px', textAlign: 'center',
                    background: dragover ? 'var(--accent-light)' : importFile ? 'rgba(34,197,94,0.05)' : 'var(--bg)',
                    cursor: 'pointer', transition: 'all 0.18s', marginBottom: 16,
                  }}
                >
                  <input
                    ref={fileInputRef} type="file" accept=".xlsx,.csv"
                    style={{ display: 'none' }}
                    onChange={(e) => { try { const f = e.target.files?.[0]; if (f) setImportFile(f); } catch {} }}
                  />
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{importFile ? '✓' : '📂'}</div>
                  {importFile ? (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#16a34a' }}>{importFile.name}</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)' }}>
                        {t('leave.balance_import_drop')}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                        {t('leave.balance_import_browse')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, opacity: 0.7 }}>
                        {t('leave.balance_import_accept')}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {importResult && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    padding: '14px 16px', borderRadius: 8, marginBottom: 12,
                    background: importResult.failed > 0 || importResult.errors.length > 0
                      ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)',
                    border: `1px solid ${importResult.failed > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.25)'}`,
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: 'var(--text)' }}>
                      {t('leave.balance_import_success')}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {t('leave.balance_import_result', {
                        imported: importResult.imported,
                        skipped: importResult.skipped,
                        failed: importResult.failed,
                      })}
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div style={{ maxHeight: 140, overflowY: 'auto', fontSize: 12, color: '#b45309' }}>
                      {importResult.errors.map((e, i) => (
                         <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid var(--border)' }}>{e}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div style={{ padding: '12px 24px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={handleImportClose} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                {t('common.close')}
              </button>
              {!importResult && (
                <button
                  onClick={handleImport}
                  disabled={!importFile || importing}
                  style={{
                    padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)',
                    color: '#fff', fontWeight: 600, fontSize: 13, cursor: importing || !importFile ? 'not-allowed' : 'pointer', opacity: importing || !importFile ? 0.7 : 1,
                  }}
                >
                  {importing ? t('common.saving') : t('common.save')}
                </button>
              )}
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type PanelTab = 'requests' | 'balances';

type CreateEmployeeOption = {
  id: number;
  name: string;
  surname: string;
  role: string;
  storeName?: string | null;
  avatarFilename?: string | null;
};

export default function AdminLeavePanel() {
  const { t, i18n } = useTranslation();
  const { user, permissions } = useAuth();

  const isAdmin = user?.role === 'admin';
  const effectiveApproverRole = user?.role === 'admin' ? 'admin' : user?.role;
  const locale = i18n.language;

  const [panelTab, setPanelTab] = useState<PanelTab>('requests');

  const [requests, setRequests]       = useState<LeaveRequest[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  // ── Filters ────────────────────────────────────────────────────────────────
  const today       = formatLocalDate(new Date());
  const now         = new Date();
  const monthStart  = today.slice(0, 8) + '01';
  const lastDay     = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthEnd    = formatLocalDate(lastDay);

  const [dateFrom, setDateFrom]     = useState(monthStart);
  const [dateTo,   setDateTo]       = useState(monthEnd);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType]     = useState('');
  const [search, setSearch]             = useState('');

  // ── Create modal ───────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen]     = useState(false);
  const [empList, setEmpList]           = useState<CreateEmployeeOption[]>([]);
  const [cUserId,  setCUserId]          = useState('');
  const [cEmployeeOpen, setCEmployeeOpen] = useState(false);
  const [cType,    setCType]            = useState('vacation');
  const [cStart,   setCStart]           = useState(today);
  const [cEnd,     setCEnd]             = useState(today);
  const [cNotes,   setCNotes]           = useState('');
  const [cSaving,  setCSaving]          = useState(false);
  const [cError,   setCError]           = useState<string | null>(null);
  const cEmployeePickerRef = useRef<HTMLDivElement | null>(null);

  // ── Reject modal ───────────────────────────────────────────────────────────
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectNotes,  setRejectNotes]  = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);
  const [rejectError,  setRejectError]  = useState<string | null>(null);

  // ── Delete confirm ─────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<LeaveRequest | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // ── My Leave drawer (admin/hr submitting their own leave) ──────────────────
  const [myLeaveOpen, setMyLeaveOpen] = useState(false);

  // ── Action feedback ────────────────────────────────────────────────────────
  const [flash, setFlash] = useState<string | null>(null);

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  }

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (dateFrom)     params.dateFrom    = dateFrom;
      if (dateTo)       params.dateTo      = dateTo;
      if (filterStatus) params.status      = filterStatus as LeaveStatus;
      if (filterType)   params.leaveType   = filterType as 'vacation' | 'sick';
      const res = await getLeaveRequests(params);
      setRequests(res.requests);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, filterStatus, filterType, t]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    if (!cEmployeeOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!cEmployeePickerRef.current?.contains(event.target as Node)) {
        setCEmployeeOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [cEmployeeOpen]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const pendingCount  = requests.filter((r) => r.status === 'pending' || r.status.includes('approved') && r.status !== 'approved').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;

  // ── Filtered rows ──────────────────────────────────────────────────────────
  const filtered = search
    ? requests.filter((r) => {
        const full = `${r.userSurname ?? ''} ${r.userName ?? ''}`.toLowerCase();
        return full.includes(search.toLowerCase());
      })
    : requests;

  // ── Download certificate ────────────────────────────────────────────────────
  async function handleDownloadCertificate(req: LeaveRequest) {
    try {
      const blob = await downloadCertificate(req.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = req.medicalCertificateName ?? 'certificato-medico';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showFlash(t('leave.certificate_download_error'));
    }
  }

  // ── Approve ────────────────────────────────────────────────────────────────
  async function handleApprove(req: LeaveRequest) {
    try {
      await approveLeaveRequest(req.id);
      showFlash(t('leave.approved_success'));
      fetchRequests();
    } catch (err: unknown) {
      setError(translateApiError(err, t, t('common.error')) ?? t('common.error'));
    }
  }

  // ── Reject ─────────────────────────────────────────────────────────────────
  async function handleReject() {
    if (!rejectTarget) return;
    if (!rejectNotes.trim()) { setRejectError(t('leave.reject_notes_required')); return; }
    setRejectSaving(true);
    setRejectError(null);
    try {
      await rejectLeaveRequest(rejectTarget.id, rejectNotes);
      showFlash(t('leave.rejected_success'));
      setRejectTarget(null);
      setRejectNotes('');
      fetchRequests();
    } catch (err: unknown) {
      setRejectError(translateApiError(err, t, t('common.error')) ?? t('common.error'));
    } finally {
      setRejectSaving(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteLeaveRequest(deleteTarget.id);
      showFlash(t('leave.admin_delete_success'));
      setDeleteTarget(null);
      fetchRequests();
    } catch (err: unknown) {
      setError(translateApiError(err, t, t('common.error')) ?? t('common.error'));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  function openCreate() {
    setCUserId(''); setCType('vacation'); setCStart(today); setCEnd(today); setCNotes(''); setCError(null);
    setCEmployeeOpen(false);
    setCreateOpen(true);
    if (empList.length === 0) {
      getEmployees({ limit: 200, status: 'active', role: 'employee' })
        .then((r) => {
          const rows = r.employees
            .filter((e) => (user?.id ? e.id !== user.id : true))
            .map((e) => ({
              id: e.id,
              name: e.name,
              surname: e.surname,
              role: e.role,
              storeName: e.storeName,
              avatarFilename: e.avatarFilename ?? null,
            }));
          setEmpList(rows);
        })
        .catch(() => {});
    }
  }

  async function handleCreate() {
    if (!cUserId) { setCError(t('common.required')); return; }
    if (user?.id && parseInt(cUserId, 10) === user.id) { setCError(t('leave.admin_cannot_create_self')); return; }
    if (new Date(cStart) > new Date(cEnd)) { setCError(t('leave.error_date_range')); return; }
    setCSaving(true);
    setCError(null);
    try {
      await createLeaveOnBehalf({
        userId: parseInt(cUserId, 10),
        leaveType: cType as 'vacation' | 'sick',
        startDate: cStart,
        endDate: cEnd,
        notes: cNotes || undefined,
      });
      showFlash(t('leave.admin_create_success'));
      setCreateOpen(false);
      setCEmployeeOpen(false);
      fetchRequests();
    } catch (err: unknown) {
      setCError(translateApiError(err, t, t('common.error')) ?? t('common.error'));
    } finally {
      setCSaving(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const selectStyle = {
    padding: '8px 12px', borderRadius: 8,
    border: '1.5px solid var(--border)', background: 'var(--background)',
    color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer',
  };

  const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 700 as const,
    color: 'var(--text-secondary)', marginBottom: 6,
    textTransform: 'uppercase' as const, letterSpacing: '0.8px',
  };

  const selectedCreateEmployeeId = cUserId ? parseInt(cUserId, 10) : null;
  const selectedCreateEmployee = selectedCreateEmployeeId == null
    ? null
    : empList.find((emp) => emp.id === selectedCreateEmployeeId) ?? null;
  const selectedCreateEmployeeFullName = selectedCreateEmployee
    ? `${selectedCreateEmployee.surname} ${selectedCreateEmployee.name}`.trim()
    : '';
  const selectedCreateEmployeeRoleLabel = selectedCreateEmployee
    ? t(`roles.${selectedCreateEmployee.role}`, selectedCreateEmployee.role)
    : '';
  const selectedCreateEmployeeAvatarUrl = getAvatarUrl(selectedCreateEmployee?.avatarFilename);
  const selectedCreateEmployeeInitials = selectedCreateEmployee
    ? `${selectedCreateEmployee.name?.[0] ?? ''}${selectedCreateEmployee.surname?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U';

  return (
    <div style={{ padding: 0, minHeight: '100%' }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--primary)', padding: '28px 32px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2.5px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 8 }}>
              {t('leave.page_title')}
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: -0.5 }}>
              {t('leave.admin_title')}
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: '6px 0 0' }}>
              {t('leave.admin_subtitle')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
            <button
              onClick={() => setMyLeaveOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 8,
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', fontWeight: 600, fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {t('leave.my_leave_btn')}
            </button>
            <button
              onClick={openCreate}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 8,
                background: 'var(--accent)', border: 'none',
                color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
              {t('leave.admin_new')}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, paddingBottom: 0 }}>
          {[
            { label: t('leave.admin_stat_pending'),  value: loading ? '—' : pendingCount,          color: '#f59e0b' },
            { label: t('leave.admin_stat_approved'), value: loading ? '—' : approvedCount,         color: '#22c55e' },
            { label: t('leave.admin_stat_total'),    value: loading ? '—' : requests.length,       color: 'var(--accent)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px 8px 0 0', padding: '12px 16px',
            }}>
              <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: '0 32px',
      }}>
        {((['requests', 'balances'] as PanelTab[]).filter(t => t === 'requests' || permissions?.saldi || user?.isSuperAdmin)).map((tab) => (
          <button
            key={tab}
            onClick={() => setPanelTab(tab)}
            style={{
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: panelTab === tab ? 700 : 500,
              color: panelTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              borderBottom: panelTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab === 'requests' ? t('leave.admin_title') : t('leave.balance_tab')}
          </button>
        ))}
      </div>

      {/* ── Requests tab ──────────────────────────────────────────────────── */}
      {panelTab === 'requests' && (
        <>
          {/* ── Filter bar ────────────────────────────────────────────────── */}
          <div style={{
            padding: '12px 32px', background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            position: 'sticky', top: 0, zIndex: 20,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            {/* Search */}
            <input
              type="text"
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...selectStyle, flex: '1 1 140px', minWidth: 120, cursor: 'text' }}
            />
            {/* Date range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 160px', minWidth: 140 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', flexShrink: 0 }}>{t('attendance.dateFrom')}</span>
              <div style={{ flex: 1 }}><DatePicker value={dateFrom} onChange={setDateFrom} /></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 160px', minWidth: 140 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', flexShrink: 0 }}>{t('attendance.dateTo')}</span>
              <div style={{ flex: 1 }}><DatePicker value={dateTo} onChange={setDateTo} /></div>
            </div>
            {/* Status filter */}
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...selectStyle, flex: '1 1 140px', minWidth: 120 }}>
              <option value="">{t('leave.admin_filter_all_status')}</option>
              <option value="pending">{t('leave.status_pending')}</option>
              <option value="store manager approved">{t('leave.status_store_manager_approved')}</option>
              <option value="area manager approved">{t('leave.status_area_manager_approved')}</option>
              <option value="HR approved">{t('leave.status_hr_approved')}</option>
              <option value="approved">{t('leave.status_approved')}</option>
              <option value="rejected">{t('leave.status_rejected')}</option>
              <option value="cancelled">{t('leave.status_cancelled')}</option>
            </select>
            {/* Type filter */}
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ ...selectStyle, flex: '1 1 120px', minWidth: 100 }}>
              <option value="">{t('leave.admin_filter_all_types')}</option>
              <option value="vacation">{t('leave.type_vacation')}</option>
              <option value="sick">{t('leave.type_sick')}</option>
            </select>
            {loading && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common.loading')}</span>
            )}
          </div>

          {/* ── Table ─────────────────────────────────────────────────────── */}
          <div style={{ padding: '20px 32px' }}>
            {flash && (
              <div style={{
                background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)',
                borderLeft: '4px solid #16a34a', borderRadius: 8,
                padding: '10px 16px', marginBottom: 16, color: '#16a34a', fontSize: 13, fontWeight: 600,
              }}>
                {flash}
              </div>
            )}
            {error && (
              <div style={{
                background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)',
                borderLeft: '4px solid #dc2626', borderRadius: 8,
                padding: '10px 16px', marginBottom: 16, color: '#dc2626', fontSize: 13,
              }}>
                {error}
              </div>
            )}

            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              {!loading && filtered.length === 0 ? (
                <div style={{ padding: '56px 32px', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, opacity: 0.2, marginBottom: 12 }}>📋</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('leave.no_requests')}</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface)' }}>
                        {[
                          t('leave.col_employee'),
                          t('leave.type_label'),
                          t('leave.col_period'),
                          t('leave.col_days'),
                          t('leave.col_status'),
                          t('common.actions'),
                        ].map((h, i) => (
                          <th key={`${h}-${i}`} style={{
                            padding: '10px 16px', textAlign: 'left',
                            fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                            textTransform: 'uppercase', letterSpacing: '1.5px',
                            borderBottom: '2px solid var(--border)',
                            ...(i === 0 ? { paddingLeft: 20 } : {}),
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((req) => {
                        const days = countWorkingDays(req.startDate, req.endDate);
                        const isVacation = req.leaveType === 'vacation';
                        const typeColor = isVacation ? '#3b82f6' : '#f59e0b';
                        const isHR = user?.role === 'hr';
                        const canAct =
                          req.status !== 'approved' &&
                          !req.status.includes('rejected') &&
                          req.status !== 'cancelled' &&
                          !!effectiveApproverRole &&
                          (isAdmin || (isHR && req.status !== 'HR approved') || req.currentApproverRole === effectiveApproverRole);
                        return (
                          <tr
                            key={req.id}
                            style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-warm)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                          >
                            {/* Employee */}
                            <td style={{ padding: '12px 16px 12px 20px' }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                                {req.userSurname} {req.userName}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                #{req.id} · {new Date(req.createdAt).toLocaleDateString(locale === 'en' ? 'en-GB' : 'it-IT')}
                              </div>
                            </td>
                            {/* Type */}
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                                fontSize: 11, fontWeight: 700,
                                background: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}30`,
                              }}>
                                {t(`leave.type_${req.leaveType}`)}
                              </span>
                            </td>
                            {/* Period */}
                            <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                              {fmtDate(req.startDate, locale)} → {fmtDate(req.endDate, locale)}
                            </td>
                            {/* Days */}
                            <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                              {days}
                            </td>
                            {/* Status */}
                            <td style={{ padding: '12px 16px' }}>
                              <StatusBadge status={req.status} />
                            </td>
                            {/* Actions */}
                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {req.medicalCertificateName && (
                                  <button
                                    onClick={() => handleDownloadCertificate(req)}
                                    style={{
                                      padding: '4px 10px', borderRadius: 6,
                                      border: '1px solid rgba(3,105,161,0.25)',
                                      background: 'rgba(3,105,161,0.08)',
                                      color: '#0369a1', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                    }}
                                  >
                                    {t('leave.certificate_btn')}
                                  </button>
                                )}
                                {canAct && (
                                  <>
                                    <button
                                      onClick={() => handleApprove(req)}
                                      style={{
                                        padding: '4px 10px', borderRadius: 6,
                                        border: '1px solid rgba(22,163,74,0.3)',
                                        background: 'rgba(22,163,74,0.08)',
                                        color: '#16a34a', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                      }}
                                    >
                                      {t('leave.action_approve')}
                                    </button>
                                    <button
                                      onClick={() => { setRejectTarget(req); setRejectNotes(''); setRejectError(null); }}
                                      style={{
                                        padding: '4px 10px', borderRadius: 6,
                                        border: '1px solid rgba(220,38,38,0.3)',
                                        background: 'rgba(220,38,38,0.08)',
                                        color: '#dc2626', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                      }}
                                    >
                                      {t('leave.action_reject')}
                                    </button>
                                  </>
                                )}
                                {isAdmin && (
                                  <button
                                    onClick={() => setDeleteTarget(req)}
                                    style={{
                                      padding: '4px 10px', borderRadius: 6,
                                      border: '1px solid rgba(107,114,128,0.25)',
                                      background: 'rgba(107,114,128,0.06)',
                                      color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                    }}
                                  >
                                    {t('common.delete')}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {!loading && filtered.length > 0 && (
                <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg)', fontSize: 12, color: 'var(--text-muted)' }}>
                  <strong>{filtered.length}</strong> {filtered.length === 1 ? t('leave.request_singular') : t('leave.request_plural')}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Balances tab ──────────────────────────────────────────────────── */}
      {panelTab === 'balances' && (
        <>
          {flash && (
            <div style={{
              margin: '16px 32px 0',
              background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)',
              borderLeft: '4px solid #16a34a', borderRadius: 8,
              padding: '10px 16px', color: '#16a34a', fontSize: 13, fontWeight: 600,
            }}>
              {flash}
            </div>
          )}
          <BalancesTab showFlash={showFlash} />
        </>
      )}

      {/* ── Create Modal ──────────────────────────────────────────────────── */}
      {createOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !cSaving) {
              setCreateOpen(false);
              setCEmployeeOpen(false);
            }
          }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', width: '100%', maxWidth: 480, border: '1px solid var(--border)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  {t('leave.page_title')}
                </div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  {t('leave.admin_create_title')}
                </h2>
              </div>
              <button onClick={() => { setCreateOpen(false); setCEmployeeOpen(false); }} disabled={cSaving} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {cError && (
                <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderLeft: '4px solid #dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: 13 }}>
                  {cError}
                </div>
              )}

              {/* Employee */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>{t('leave.select_employee')} *</label>
                <div ref={cEmployeePickerRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setCEmployeeOpen((prev) => !prev)}
                    style={{
                      ...selectStyle,
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    {selectedCreateEmployee ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          background: 'rgba(13,33,55,0.14)',
                          color: '#0D2137',
                          fontSize: 10,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {selectedCreateEmployeeAvatarUrl ? (
                            <img src={selectedCreateEmployeeAvatarUrl} alt={selectedCreateEmployeeFullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : selectedCreateEmployeeInitials}
                        </span>
                        <span style={{ minWidth: 0, textAlign: 'left' }}>
                          <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedCreateEmployeeFullName}
                          </span>
                          <span style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedCreateEmployeeRoleLabel}
                            {selectedCreateEmployee.storeName ? ` · ${selectedCreateEmployee.storeName}` : ''}
                          </span>
                        </span>
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('leave.select_employee')}</span>
                    )}
                    <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>{cEmployeeOpen ? '▲' : '▼'}</span>
                  </button>

                  {cEmployeeOpen && (
                    <div style={{
                      position: 'absolute',
                      zIndex: 20,
                      top: 'calc(100% + 6px)',
                      left: 0,
                      right: 0,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      boxShadow: '0 16px 30px rgba(0,0,0,0.18)',
                      maxHeight: 230,
                      overflowY: 'auto',
                    }}>
                      {empList.length === 0 ? (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                          {t('common.loading')}
                        </div>
                      ) : (
                        empList.map((emp) => {
                          const fullName = `${emp.surname} ${emp.name}`.trim();
                          const roleLabel = t(`roles.${emp.role}`, emp.role);
                          const avatarUrl = getAvatarUrl(emp.avatarFilename);
                          const initials = `${emp.name?.[0] ?? ''}${emp.surname?.[0] ?? ''}`.toUpperCase() || 'U';
                          const selected = String(emp.id) === cUserId;
                          return (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => {
                                setCUserId(String(emp.id));
                                setCEmployeeOpen(false);
                              }}
                              style={{
                                width: '100%',
                                border: 'none',
                                borderBottom: '1px solid var(--border)',
                                background: selected ? 'var(--surface-warm)' : 'var(--surface)',
                                padding: '8px 10px',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                cursor: 'pointer',
                              }}
                            >
                              <span style={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                overflow: 'hidden',
                                background: 'rgba(13,33,55,0.14)',
                                color: '#0D2137',
                                fontSize: 10,
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                                {avatarUrl ? (
                                  <img src={avatarUrl} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : initials}
                              </span>
                              <span style={{ minWidth: 0 }}>
                                <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {fullName}
                                </span>
                                <span style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {roleLabel}
                                  {emp.storeName ? ` · ${emp.storeName}` : ''}
                                </span>
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {selectedCreateEmployee && (
                  <div style={{
                    marginTop: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-warm)',
                  }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: 'rgba(13,33,55,0.14)',
                      color: '#0D2137',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {selectedCreateEmployeeAvatarUrl ? (
                        <img src={selectedCreateEmployeeAvatarUrl} alt={selectedCreateEmployeeFullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : selectedCreateEmployeeInitials}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {selectedCreateEmployeeFullName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedCreateEmployeeRoleLabel}
                        {selectedCreateEmployee.storeName ? ` · ${selectedCreateEmployee.storeName}` : ''}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Type */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>{t('leave.type_label')} *</label>
                <select value={cType} onChange={(e) => setCType(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
                  <option value="vacation">{t('leave.type_vacation')}</option>
                  <option value="sick">{t('leave.type_sick')}</option>
                </select>
              </div>

              {/* Dates */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <DatePicker label={`${t('leave.start_date')} *`} value={cStart} onChange={setCStart} />
                </div>
                <div style={{ flex: 1 }}>
                  <DatePicker label={`${t('leave.end_date')} *`} value={cEnd} onChange={setCEnd} />
                </div>
              </div>

              {/* Working days preview */}
              {cStart && cEnd && new Date(cStart) <= new Date(cEnd) && (
                <div style={{ marginBottom: 14, padding: '8px 12px', background: 'var(--background)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {t('leave.working_days', { n: countWorkingDays(cStart, cEnd) })}
                </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>{t('leave.notes_label')}</label>
                <textarea
                  value={cNotes}
                  onChange={(e) => setCNotes(e.target.value)}
                  rows={2}
                  placeholder={t('leave.notes_placeholder')}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--background)', color: 'var(--text)', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setCreateOpen(false); setCEmployeeOpen(false); }} disabled={cSaving} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {t('common.cancel')}
                </button>
                <button onClick={handleCreate} disabled={cSaving} style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: cSaving ? 'not-allowed' : 'pointer', opacity: cSaving ? 0.7 : 1 }}>
                  {cSaving ? t('common.saving') : t('leave.admin_new')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ──────────────────────────────────────────────────── */}
      {rejectTarget && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget && !rejectSaving) setRejectTarget(null); }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', width: '100%', maxWidth: 400, border: '1px solid var(--border)', padding: 28 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              {t('leave.reject_title')}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
              {rejectTarget.userSurname} {rejectTarget.userName} · {fmtDate(rejectTarget.startDate, locale)} → {fmtDate(rejectTarget.endDate, locale)}
            </p>
            {rejectError && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{rejectError}</div>}
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={3}
              placeholder={t('leave.reject_notes_placeholder')}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--background)', color: 'var(--text)', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setRejectTarget(null)} disabled={rejectSaving} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
              <button onClick={handleReject} disabled={rejectSaving} style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontSize: 14, fontWeight: 700, cursor: rejectSaving ? 'not-allowed' : 'pointer', opacity: rejectSaving ? 0.7 : 1 }}>
                {rejectSaving ? t('common.loading') : t('leave.reject_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── My Leave Drawer ───────────────────────────────────────────────── */}
      <LeaveRequestDrawer
        open={myLeaveOpen}
        onClose={() => setMyLeaveOpen(false)}
        onSubmitted={() => { setMyLeaveOpen(false); fetchRequests(); }}
      />

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      {deleteTarget && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) setDeleteTarget(null); }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', width: '100%', maxWidth: 380, border: '1px solid var(--border)', padding: 28 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>⚠</div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              {t('leave.admin_delete_confirm')}
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-secondary)' }}>
              {deleteTarget.userSurname} {deleteTarget.userName} · {t(`leave.type_${deleteTarget.leaveType}`)} · {fmtDate(deleteTarget.startDate, locale)} → {fmtDate(deleteTarget.endDate, locale)}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontSize: 14, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
