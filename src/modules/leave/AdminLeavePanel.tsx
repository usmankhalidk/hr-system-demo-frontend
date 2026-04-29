import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, CheckCheck, Clock3, FileText, Palmtree, Thermometer, Trash2, XCircle } from 'lucide-react';
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
  LeaveDurationType,
} from '../../api/leave';
import { getEmployees } from '../../api/employees';
import { getStores } from '../../api/stores';
import { getAvatarUrl, getStoreLogoUrl } from '../../api/client';
import { DatePicker } from '../../components/ui/DatePicker';
import { formatLocalDate } from '../../utils/date';
import { LeaveRequestDrawer } from './LeaveRequestDrawer';
import ApprovalConfigPanel from './ApprovalConfigPanel';
import LeaveCalendar from './LeaveCalendar';
import { translateApiError } from '../../utils/apiErrors';
import { Store as StoreModel } from '../../types';

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

function parseIsoDate(iso: string): Date {
  const match = (iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date();
  return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const aStart = parseIsoDate(startA).getTime();
  const aEnd = parseIsoDate(endA).getTime();
  const bStart = parseIsoDate(startB).getTime();
  const bEnd = parseIsoDate(endB).getTime();
  return aStart <= bEnd && bStart <= aEnd;
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

function shortLeaveHours(startTime?: string | null, endTime?: string | null): number | null {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if ([sh, sm, eh, em].some((value) => Number.isNaN(value))) return null;
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  if (endMinutes <= startMinutes) return null;
  return Number(((endMinutes - startMinutes) / 60).toFixed(2));
}

function fmtDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const lang = locale === 'en' ? 'en-GB' : 'it-IT';
  return date.toLocaleString(lang, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function avatarColorFromName(name: string): string {
  if (!name) return 'linear-gradient(135deg, var(--primary), var(--accent))';
  return 'linear-gradient(135deg, var(--primary), var(--accent))';
}

function initialsForPerson(name: string | null | undefined, surname: string | null | undefined): string {
  return `${(name?.[0] ?? '').toUpperCase()}${(surname?.[0] ?? '').toUpperCase()}` || 'U';
}

function recentUniqueUsers(rows: LeaveRequest[], limit: number): LeaveRequest[] {
  const byUser = new Map<number, LeaveRequest>();
  const sorted = [...rows].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  for (const req of sorted) {
    if (!byUser.has(req.userId)) byUser.set(req.userId, req);
    if (byUser.size >= limit) break;
  }
  return Array.from(byUser.values());
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

  const [employees, setEmployees] = useState<Array<{ id: number; name: string; surname: string; avatarFilename?: string | null }>>([]);
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
    border: '1.5px solid #d1d5db', background: '#ffffff',
    color: '#111827', fontSize: 13, outline: 'none', cursor: 'pointer',
  };

  const [empError, setEmpError] = useState<string | null>(null);

  // Load employees once
  useEffect(() => {
    setEmpError(null);
    getEmployees({ limit: 200, status: 'active' })
      .then((r) => setEmployees(r.employees.map((e) => ({ id: e.id, name: e.name, surname: e.surname, avatarFilename: e.avatarFilename ?? null }))))
      .catch(() => {
        setEmpError(t('common.error'));
        setEmployees([]);
      });
  }, [t]);

  // Load balances when employees or year changes
  const loadBalances = useCallback(async (emps: Array<{ id: number; name: string; surname: string; avatarFilename?: string | null }>, selectedYear: number) => {
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
                <tr style={{ background: 'var(--primary)' }}>
                  {[
                    t('leave.col_employee'),
                    t('leave.balance_vacation'),
                    t('leave.balance_sick'),
                    t('common.actions'),
                  ].map((h, i) => (
                    <th key={`${h}-${i}`} style={{
                      padding: '10px 16px', textAlign: 'left',
                      fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.84)',
                      textTransform: 'uppercase', letterSpacing: '1.5px',
                      borderBottom: '1px solid rgba(255,255,255,0.22)',
                      ...(i === 0 ? { paddingLeft: 20 } : {}),
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.slice(0, 50).map((emp) => {
                  const avatarUrl = getAvatarUrl(emp.avatarFilename ?? null);
                  const initials = initialsForPerson(emp.name, emp.surname);
                  const fallbackColor = avatarColorFromName(`${emp.name ?? ''} ${emp.surname ?? ''}`.trim() || String(emp.id));
                  return (
                  <tr
                    key={emp.id}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-warm)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                  >
                    <td style={{ padding: '12px 16px 12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                        <span style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          border: '1px solid rgba(148,163,184,0.4)',
                          background: avatarUrl ? 'transparent' : fallbackColor,
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={`${emp.surname ?? ''} ${emp.name ?? ''}`.trim()} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : initials}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {emp.surname} {emp.name}
                        </span>
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
                  );
                })}
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

type PanelTab = 'requests' | 'balances' | 'calendar' | 'approval_config';

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
  const [stores, setStores]           = useState<StoreModel[]>([]);
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
  const [filterStoreId, setFilterStoreId] = useState('');
  const [search, setSearch]             = useState('');

  // ── Create modal ───────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen]     = useState(false);
  const [empList, setEmpList]           = useState<CreateEmployeeOption[]>([]);
  const [cUserId,  setCUserId]          = useState('');
  const [cEmployeeOpen, setCEmployeeOpen] = useState(false);
  const [cType,    setCType]            = useState('vacation');
  const [cDurationType, setCDurationType] = useState<LeaveDurationType>('full_day');
  const [cStart,   setCStart]           = useState(today);
  const [cEnd,     setCEnd]             = useState(today);
  const [cShortStartTime, setCShortStartTime] = useState('');
  const [cShortEndTime, setCShortEndTime] = useState('');
  const [cNotes,   setCNotes]           = useState('');
  const [cSaving,  setCSaving]          = useState(false);
  const [cError,   setCError]           = useState<string | null>(null);
  const [cOverlapLoading, setCOverlapLoading] = useState(false);
  const [cOverlappingLeaves, setCOverlappingLeaves] = useState<LeaveRequest[]>([]);
  const cEmployeePickerRef = useRef<HTMLDivElement | null>(null);

  // ── Reject modal ───────────────────────────────────────────────────────────
  const [approveTarget, setApproveTarget] = useState<LeaveRequest | null>(null);
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
    let active = true;
    getStores()
      .then((rows) => {
        if (active) setStores(rows);
      })
      .catch(() => {
        if (active) setStores([]);
      });

    return () => {
      active = false;
    };
  }, []);

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

  useEffect(() => {
    if (cType !== 'vacation') {
      setCDurationType('full_day');
      setCShortStartTime('');
      setCShortEndTime('');
    }
  }, [cType]);

  useEffect(() => {
    if (cDurationType === 'short_leave') {
      setCEnd(cStart);
    }
  }, [cDurationType, cStart]);

  useEffect(() => {
    let active = true;
    if (!createOpen || !cUserId || !cStart || !cEnd) {
      setCOverlappingLeaves([]);
      setCOverlapLoading(false);
      return;
    }

    setCOverlapLoading(true);
    getLeaveRequests({ dateFrom: cStart, dateTo: cEnd })
      .then((res) => {
        if (!active) return;
        const userId = parseInt(cUserId, 10);
        const overlaps = res.requests.filter((req) => {
          if (req.userId !== userId) return false;
          if (req.status.includes('rejected') || req.status === 'cancelled') return false;
          return rangesOverlap(req.startDate, req.endDate, cStart, cEnd);
        });
        setCOverlappingLeaves(overlaps);
      })
      .catch(() => {
        if (!active) return;
        setCOverlappingLeaves([]);
      })
      .finally(() => {
        if (!active) return;
        setCOverlapLoading(false);
      });

    return () => {
      active = false;
    };
  }, [createOpen, cUserId, cStart, cEnd]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const isPendingWorkflowStatus = (status: LeaveStatus): boolean => (
    status === 'pending' || (status.includes('approved') && status !== 'approved')
  );

  const pendingCount  = requests.filter((r) => isPendingWorkflowStatus(r.status)).length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const pendingVacationCount = requests.filter((r) => isPendingWorkflowStatus(r.status) && r.leaveType === 'vacation').length;
  const pendingSickCount = requests.filter((r) => isPendingWorkflowStatus(r.status) && r.leaveType === 'sick').length;
  const approvedVacationCount = requests.filter((r) => r.status === 'approved' && r.leaveType === 'vacation').length;
  const approvedSickCount = requests.filter((r) => r.status === 'approved' && r.leaveType === 'sick').length;
  const totalVacationCount = requests.filter((r) => r.leaveType === 'vacation').length;
  const totalSickCount = requests.filter((r) => r.leaveType === 'sick').length;

  const pendingPeople = useMemo(
    () => recentUniqueUsers(requests.filter((r) => isPendingWorkflowStatus(r.status)), 20),
    [requests],
  );
  const approvedPeople = useMemo(
    () => recentUniqueUsers(requests.filter((r) => r.status === 'approved'), 20),
    [requests],
  );

  // ── Filtered rows ──────────────────────────────────────────────────────────
  const storeLookup = new Map<number, StoreModel>();
  for (const store of stores) storeLookup.set(store.id, store);

  const resolveRequestStoreMeta = (req: LeaveRequest): { storeName: string; companyName: string; storeLogoFilename: string | null } => {
    const fallbackCompany = t('common.company', 'Company');
    if (req.storeId != null) {
      const known = storeLookup.get(req.storeId);
      const storeName = known?.name ?? `${t('common.store', 'Store')} #${req.storeId}`;
      const companyName = known?.companyName ?? (req.companyId != null ? `${fallbackCompany} #${req.companyId}` : fallbackCompany);
      return {
        storeName,
        companyName,
        storeLogoFilename: known?.logoFilename ?? req.storeLogoFilename ?? null,
      };
    }
    return {
      storeName: t('employees.noStore', 'No store'),
      companyName: req.companyId != null ? `${fallbackCompany} #${req.companyId}` : fallbackCompany,
      storeLogoFilename: req.storeLogoFilename ?? null,
    };
  };

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = requests.filter((req) => {
    const storeMeta = resolveRequestStoreMeta(req);
    const fullName = `${req.userSurname ?? ''} ${req.userName ?? ''}`.trim().toLowerCase();
    const matchesSearch = !normalizedSearch
      || fullName.includes(normalizedSearch)
      || storeMeta.storeName.toLowerCase().includes(normalizedSearch)
      || storeMeta.companyName.toLowerCase().includes(normalizedSearch);
    const matchesStore = !filterStoreId || String(req.storeId ?? '') === filterStoreId;
    return matchesSearch && matchesStore;
  });

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
    setCUserId('');
    setCType('vacation');
    setCDurationType('full_day');
    setCStart(today);
    setCEnd(today);
    setCShortStartTime('');
    setCShortEndTime('');
    setCNotes('');
    setCError(null);
    setCOverlappingLeaves([]);
    setCOverlapLoading(false);
    setCEmployeeOpen(false);
    setCreateOpen(true);
    if (empList.length === 0) {
      getEmployees({
        limit: 200,
        status: 'active',
        excludeAdmins: true,
        targetCompanyId: user?.role === 'hr' ? user.companyId : undefined
      })
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

    if (cOverlappingLeaves.length > 0) {
      setCError(t('leave.error_employee_has_leave_same_day', 'This user already has leave on the same day.'));
      return;
    }

    if (cDurationType === 'short_leave') {
      if (cType !== 'vacation') {
        setCError(t('leave.error_short_vacation_only', 'Short leave is available only for vacation.'));
        return;
      }
      if (cStart !== cEnd) {
        setCError(t('leave.error_short_same_day', 'Short leave must start and end on the same day.'));
        return;
      }
      if (!cShortStartTime || !cShortEndTime) {
        setCError(t('leave.error_short_time_required', 'Start and end time are required for short leave.'));
        return;
      }
      const [startHour, startMinute] = cShortStartTime.split(':').map(Number);
      const [endHour, endMinute] = cShortEndTime.split(':').map(Number);
      if ([startHour, startMinute, endHour, endMinute].some((value) => Number.isNaN(value))) {
        setCError(t('leave.error_short_time_required', 'Start and end time are required for short leave.'));
        return;
      }
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      if (endMinutes <= startMinutes) {
        setCError(t('leave.error_short_time_range', 'End time must be after start time.'));
        return;
      }
      const shortHours = Number(((endMinutes - startMinutes) / 60).toFixed(2));
      if (shortHours >= 24) {
        setCError(t('leave.error_short_duration', 'Short leave must be less than 24 hours.'));
        return;
      }
    }

    setCSaving(true);
    setCError(null);
    try {
      await createLeaveOnBehalf({
        userId: parseInt(cUserId, 10),
        leaveType: cType as 'vacation' | 'sick',
        startDate: cStart,
        endDate: cEnd,
        leaveDurationType: cDurationType,
        shortStartTime: cDurationType === 'short_leave' ? cShortStartTime : undefined,
        shortEndTime: cDurationType === 'short_leave' ? cShortEndTime : undefined,
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
    border: '1.5px solid #d1d5db', background: '#ffffff',
    color: '#111827', fontSize: 13, outline: 'none', cursor: 'pointer',
  };

  const filterControlStyle = {
    ...selectStyle,
    border: '1.5px solid #dfd2c2',
    background: '#fffdfa',
    color: '#374151',
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

      {/* ── Header Summary ────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{
          background: 'var(--primary)',
          border: '1px solid rgba(13,33,55,0.9)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 16px 36px rgba(13,33,55,0.28)',
          padding: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.7px', color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', marginBottom: 6 }}>
                {t('leave.page_title')}
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.45rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
                {t('leave.admin_title')}
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', margin: '4px 0 0' }}>
                {t('leave.admin_subtitle')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
              <button
                onClick={() => setMyLeaveOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 14px', borderRadius: 9,
                  border: '1px solid rgba(255,255,255,0.32)',
                  background: 'rgba(255,255,255,0.08)',
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
                  padding: '9px 14px', borderRadius: 9,
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
        </div>

        <div style={{
          marginTop: 12,
          background: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xs)',
          padding: '14px',
        }}>
          {(() => {
            const summaryMaxAvatars = 5;
            return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
            {[
              {
                key: 'pending',
                label: t('leave.admin_stat_pending'),
                value: loading ? '—' : pendingCount,
                color: '#b45309',
                bg: 'rgba(245,158,11,0.10)',
                vacation: pendingVacationCount,
                sick: pendingSickCount,
                people: pendingPeople,
              },
              {
                key: 'approved',
                label: t('leave.admin_stat_approved'),
                value: loading ? '—' : approvedCount,
                color: '#15803d',
                bg: 'rgba(22,163,74,0.10)',
                vacation: approvedVacationCount,
                sick: approvedSickCount,
                people: approvedPeople,
              },
              {
                key: 'total',
                label: t('leave.admin_stat_total'),
                value: loading ? '—' : requests.length,
                color: '#0D2137',
                bg: 'rgba(13,33,55,0.08)',
                vacation: totalVacationCount,
                sick: totalSickCount,
                people: [] as LeaveRequest[],
              },
            ].map(({ key, label, value, color, bg, vacation, sick, people }) => {
              const strips = [
                {
                  key: 'vacation',
                  count: vacation,
                  icon: <Palmtree size={10} strokeWidth={2.5} />,
                  border: '1px solid rgba(37,99,235,0.26)',
                  left: '#2563eb',
                  background: 'rgba(219,234,254,0.86)',
                  color: '#1e40af',
                  label: t('leave.type_vacation'),
                },
                {
                  key: 'sick',
                  count: sick,
                  icon: <Thermometer size={10} strokeWidth={2.5} />,
                  border: '1px solid rgba(217,119,6,0.26)',
                  left: '#d97706',
                  background: 'rgba(254,243,199,0.86)',
                  color: '#92400e',
                  label: t('leave.type_sick'),
                },
              ].filter((item) => loading || item.count > 0);
              const visiblePeople = people.slice(0, summaryMaxAvatars);
              const showOverflow = people.length > summaryMaxAvatars;

              return (
              <div key={label} style={{ background: bg, border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12, padding: '12px 14px', minHeight: 120, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 5 }}>{label}</div>
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {strips.map((strip) => (
                      <span
                        key={strip.key}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          borderRadius: 999,
                          border: strip.border,
                          borderLeft: `3px solid ${strip.left}`,
                          background: strip.background,
                          color: strip.color,
                          padding: '2px 8px',
                          fontSize: 10,
                          fontWeight: 800,
                          lineHeight: 1.2,
                        }}
                      >
                        {strip.icon}
                        {strip.label} {loading ? '—' : strip.count}
                      </span>
                    ))}
                  </div>

                  {(key === 'pending' || key === 'approved') && visiblePeople.length > 0 && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', marginLeft: 'auto' }}>
                      {visiblePeople.map((person, index) => {
                        const avatarUrl = getAvatarUrl(person.userAvatarFilename);
                        const fullName = `${person.userSurname ?? ''} ${person.userName ?? ''}`.trim();
                        const initials = initialsForPerson(person.userName, person.userSurname);
                        const fallbackColor = avatarColorFromName(fullName || String(person.userId));
                        return (
                          <span
                            key={`${person.userId}-${index}`}
                            title={fullName}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              overflow: 'hidden',
                              border: '1.5px solid #fff',
                              background: avatarUrl ? 'transparent' : fallbackColor,
                              color: '#fff',
                              fontSize: '0.58rem',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginLeft: index === 0 ? 0 : -8,
                              boxShadow: '0 1px 2px rgba(15,23,42,0.16)',
                              zIndex: 25 - index,
                            }}
                          >
                            {avatarUrl ? (
                              <img src={avatarUrl} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : initials}
                          </span>
                        );
                      })}

                      {showOverflow && (
                        <span
                          title={t('shifts.monthlyEmployeesOverflow', 'More employees')}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginLeft: visiblePeople.length > 0 ? -8 : 0,
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            border: '1.5px solid #fff',
                            background: 'linear-gradient(135deg, rgba(15,23,42,0.78), rgba(51,65,85,0.76))',
                            color: '#e2e8f0',
                            fontSize: '0.55rem',
                            fontWeight: 900,
                            lineHeight: 1,
                            boxShadow: '0 1px 2px rgba(15,23,42,0.16)',
                            zIndex: 30,
                          }}
                        >
                          5+
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
            );
          })()}
        </div>
      </div>

      {/* ── Tabs + Filters bar ───────────────────────────────────────────── */}
      <div style={{ padding: '14px 24px 0' }}>
        <div style={{
          background: '#f8f3ec',
          border: '1px solid #e3d7c8',
          borderRadius: 14,
          padding: '10px 12px 12px',
          boxShadow: '0 4px 12px rgba(15,23,42,0.06)',
        }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {((['requests', 'balances', 'calendar', 'approval_config'] as PanelTab[]).filter((tab) => {
              if (tab === 'requests') return true;
              if (tab === 'balances') return permissions?.saldi || user?.isSuperAdmin;
              if (tab === 'calendar') return true;
              if (tab === 'approval_config') return (user?.role === 'admin' || user?.isSuperAdmin) && !user?.isSuperAdmin;
              return false;
            })).map((tab) => {
              const selected = panelTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setPanelTab(tab)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: `1px solid ${selected ? '#b68c56' : '#d8c7b3'}`,
                    background: selected ? '#fff8ef' : '#ffffff',
                    color: selected ? '#6b4b22' : '#6f5a41',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {tab === 'requests' ? t('leave.admin_title') : tab === 'balances' ? t('leave.balance_tab') : tab === 'calendar' ? t('leave.calendar_tab') : t('leave.approval_config_tab')}
                </button>
              );
            })}
          </div>

          {panelTab === 'requests' && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder={t('common.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ ...filterControlStyle, flex: '1 1 180px', minWidth: 150, cursor: 'text' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 180px', minWidth: 150 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6f5a41', textTransform: 'uppercase', letterSpacing: '1px', flexShrink: 0 }}>{t('attendance.dateFrom')}</span>
                <div style={{ flex: 1 }}><DatePicker value={dateFrom} onChange={setDateFrom} /></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 180px', minWidth: 150 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6f5a41', textTransform: 'uppercase', letterSpacing: '1px', flexShrink: 0 }}>{t('attendance.dateTo')}</span>
                <div style={{ flex: 1 }}><DatePicker value={dateTo} onChange={setDateTo} /></div>
              </div>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...filterControlStyle, flex: '1 1 170px', minWidth: 140 }}>
                <option value="">{t('leave.admin_filter_all_status')}</option>
                <option value="pending">{t('leave.status_pending')}</option>
                <option value="store manager approved">{t('leave.status_store_manager_approved')}</option>
                <option value="area manager approved">{t('leave.status_area_manager_approved')}</option>
                <option value="HR approved">{t('leave.status_hr_approved')}</option>
                <option value="approved">{t('leave.status_approved')}</option>
                <option value="rejected">{t('leave.status_rejected')}</option>
                <option value="cancelled">{t('leave.status_cancelled')}</option>
              </select>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ ...filterControlStyle, flex: '1 1 150px', minWidth: 120 }}>
                <option value="">{t('leave.admin_filter_all_types')}</option>
                <option value="vacation">{t('leave.type_vacation')}</option>
                <option value="sick">{t('leave.type_sick')}</option>
              </select>
              <select value={filterStoreId} onChange={(e) => setFilterStoreId(e.target.value)} style={{ ...filterControlStyle, flex: '1 1 190px', minWidth: 150 }}>
                <option value="">{t('leave.admin_filter_all_stores', 'All stores')}</option>
                {[...stores]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((store) => (
                    <option key={store.id} value={String(store.id)}>{store.name}</option>
                  ))}
              </select>
              {loading && <span style={{ fontSize: 12, color: '#6f5a41' }}>{t('common.loading')}</span>}
            </div>
          )}
        </div>
      </div>

      {/* ── Requests tab ──────────────────────────────────────────────────── */}
      {panelTab === 'requests' && (
        <>
          {/* ── Table ─────────────────────────────────────────────────────── */}
          <div style={{ padding: '20px 24px 24px' }}>
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
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                    <thead>
                      <tr style={{ background: 'var(--primary)' }}>
                        {[
                          t('leave.col_employee'),
                          t('leave.col_role', 'Role'),
                          t('leave.col_store', 'Store'),
                          t('leave.type_label'),
                          t('leave.col_period'),
                          t('leave.col_days'),
                          t('leave.col_status'),
                          t('leave.col_action_time', 'Last action'),
                          t('common.actions'),
                        ].map((h, i) => (
                          <th key={`${h}-${i}`} style={{
                            padding: '10px 16px', textAlign: 'left',
                            fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.84)',
                            textTransform: 'uppercase', letterSpacing: '1.5px',
                            borderBottom: '1px solid rgba(255,255,255,0.22)',
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
                        const isShortLeave = req.leaveDurationType === 'short_leave';
                        const shortHours = shortLeaveHours(req.shortStartTime, req.shortEndTime);
                        const isVacation = req.leaveType === 'vacation';
                        const typeColor = isVacation ? '#3b82f6' : '#f59e0b';
                        const storeMeta = resolveRequestStoreMeta(req);
                        const storeLogoUrl = getStoreLogoUrl(storeMeta.storeLogoFilename);
                        const storeInitial = (storeMeta.storeName?.[0] ?? 'S').toUpperCase();
                        const avatarUrl = getAvatarUrl(req.userAvatarFilename);
                        const initials = initialsForPerson(req.userName, req.userSurname);
                        const avatarFallbackColor = avatarColorFromName(`${req.userName ?? ''} ${req.userSurname ?? ''}`.trim() || String(req.userId));
                        const isHR = user?.role === 'hr';
                        const latestActionLabel = req.latestAction === 'approved'
                          ? t('leave.action_approve')
                          : req.latestAction === 'rejected'
                            ? t('leave.action_reject')
                            : null;
                        const latestActionTime = req.latestActionAt
                          ? fmtDateTime(req.latestActionAt, locale)
                          : '—';
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <span style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: '50%',
                                  overflow: 'hidden',
                                  flexShrink: 0,
                                  border: '1px solid rgba(148,163,184,0.4)',
                                  background: avatarUrl ? 'transparent' : avatarFallbackColor,
                                  color: '#fff',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                  {avatarUrl ? (
                                    <img src={avatarUrl} alt={`${req.userSurname ?? ''} ${req.userName ?? ''}`.trim()} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : initials}
                                </span>
                                <span style={{ minWidth: 0 }}>
                                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {req.userSurname} {req.userName}
                                  </span>
                                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                                    #{req.id} · {new Date(req.createdAt).toLocaleDateString(locale === 'en' ? 'en-GB' : 'it-IT')}
                                  </span>
                                </span>
                              </div>
                            </td>
                            {/* Role */}
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                {req.userRole ? t(`roles.${req.userRole}`, { defaultValue: req.userRole }) : '—'}
                              </span>
                            </td>
                            {/* Store */}
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <span style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  overflow: 'hidden',
                                  border: '1px solid rgba(148,163,184,0.35)',
                                  background: 'rgba(13,33,55,0.12)',
                                  color: '#0D2137',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}>
                                  {storeLogoUrl ? (
                                    <img src={storeLogoUrl} alt={storeMeta.storeName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : storeInitial}
                                </span>
                                <span style={{ minWidth: 0 }}>
                                  <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {storeMeta.storeName}
                                  </span>
                                  <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {storeMeta.companyName}
                                  </span>
                                </span>
                              </div>
                            </td>
                            {/* Type */}
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '3px 10px', borderRadius: 20,
                                fontSize: 11, fontWeight: 700,
                                background: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}30`,
                              }}>
                                {isVacation ? <Palmtree size={11} strokeWidth={2.4} /> : <Thermometer size={11} strokeWidth={2.4} />}
                                {t(`leave.type_${req.leaveType}`)}
                              </span>
                            </td>
                            {/* Period */}
                            <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                              {isShortLeave
                                ? `${fmtDate(req.startDate, locale)} · ${req.shortStartTime ?? '--:--'}-${req.shortEndTime ?? '--:--'}`
                                : `${fmtDate(req.startDate, locale)} → ${fmtDate(req.endDate, locale)}`}
                            </td>
                            {/* Days */}
                            <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                              {isShortLeave && shortHours != null
                                ? `${shortHours}h`
                                : days}
                            </td>
                            {/* Status */}
                            <td style={{ padding: '12px 16px' }}>
                              <StatusBadge status={req.status} />
                            </td>
                            {/* Last Action */}
                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                              {latestActionLabel ? (
                                <>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{latestActionLabel}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{latestActionTime}</div>
                                </>
                              ) : (
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                            {/* Actions */}
                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {req.medicalCertificateName && (
                                  <button
                                    onClick={() => handleDownloadCertificate(req)}
                                    title={t('leave.certificate_btn')}
                                    aria-label={t('leave.certificate_btn')}
                                    style={{
                                      width: 28, height: 28, borderRadius: 7,
                                      border: '1px solid rgba(3,105,161,0.25)',
                                      background: 'rgba(3,105,161,0.08)',
                                      color: '#0369a1', cursor: 'pointer',
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                  >
                                    <FileText size={13} strokeWidth={2.5} />
                                  </button>
                                )}
                                {canAct && (
                                  <>
                                    <button
                                      onClick={() => setApproveTarget(req)}
                                      title={t('leave.action_approve')}
                                      aria-label={t('leave.action_approve')}
                                      style={{
                                        width: 28, height: 28, borderRadius: 7,
                                        border: '1px solid rgba(22,163,74,0.3)',
                                        background: 'rgba(22,163,74,0.08)',
                                        color: '#16a34a', cursor: 'pointer',
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      }}
                                    >
                                      <CheckCheck size={14} strokeWidth={2.6} />
                                    </button>
                                    <button
                                      onClick={() => { setRejectTarget(req); setRejectNotes(''); setRejectError(null); }}
                                      title={t('leave.action_reject')}
                                      aria-label={t('leave.action_reject')}
                                      style={{
                                        width: 28, height: 28, borderRadius: 7,
                                        border: '1px solid rgba(220,38,38,0.3)',
                                        background: 'rgba(220,38,38,0.08)',
                                        color: '#dc2626', cursor: 'pointer',
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      }}
                                    >
                                      <XCircle size={14} strokeWidth={2.6} />
                                    </button>
                                  </>
                                )}
                                {isAdmin && (
                                  <button
                                    onClick={() => setDeleteTarget(req)}
                                    title={t('common.delete')}
                                    aria-label={t('common.delete')}
                                    style={{
                                      width: 28, height: 28, borderRadius: 7,
                                      border: '1px solid rgba(107,114,128,0.25)',
                                      background: 'rgba(107,114,128,0.06)',
                                      color: 'var(--text-muted)', cursor: 'pointer',
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                  >
                                    <Trash2 size={13} strokeWidth={2.4} />
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

      {/* ── Calendar tab ────────────────────────────────────────────────── */}
      {panelTab === 'calendar' && (
        <div style={{ padding: '20px 24px 24px' }}>
          <LeaveCalendar onDayClick={(date) => { setCStart(date); setCEnd(date); setCreateOpen(true); }} onRefresh={fetchRequests} />
        </div>
      )}

      {/* ── Approval Config tab ─────────────────────────────────────────── */}
      {panelTab === 'approval_config' && !user?.isSuperAdmin && (
        <div style={{ padding: '20px 24px 24px' }}>
          <ApprovalConfigPanel />
        </div>
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
          <div style={{ background: 'var(--surface)', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', width: '100%', maxWidth: 520, maxHeight: '88vh', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  {t('leave.page_title')}
                </div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                  {t('leave.admin_create_title')}
                </h2>
              </div>
              <button
                onClick={() => { setCreateOpen(false); setCEmployeeOpen(false); }}
                disabled={cSaving}
                style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto' }}>
              {cError && (
                <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderLeft: '4px solid #dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: 13 }}>
                  {cError}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>{t('leave.select_employee')} *</label>
                <div ref={cEmployeePickerRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setCEmployeeOpen((prev) => !prev)}
                    style={{ ...selectStyle, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
                  >
                    {selectedCreateEmployee ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                    <div style={{ position: 'absolute', zIndex: 20, top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 10, boxShadow: '0 16px 30px rgba(0,0,0,0.18)', maxHeight: 230, overflowY: 'auto' }}>
                      {empList.length === 0 ? (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{t('common.loading')}</div>
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
                              style={{ width: '100%', border: 'none', borderBottom: '1px solid #e5e7eb', background: selected ? '#f8fafc' : '#ffffff', padding: '8px 10px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                            >
                              <span style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>{t('leave.type_label')} *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {([
                    { key: 'vacation', label: t('leave.type_vacation'), icon: <Palmtree size={13} strokeWidth={2.4} /> },
                    { key: 'sick', label: t('leave.type_sick'), icon: <Thermometer size={13} strokeWidth={2.4} /> },
                  ] as const).map((opt) => {
                    const selected = cType === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setCType(opt.key)}
                        style={{
                          borderRadius: 8,
                          border: `1px solid ${selected ? 'var(--primary)' : '#d1d5db'}`,
                          background: '#ffffff',
                          color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '10px 12px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          gap: 6,
                        }}
                      >
                        {opt.icon}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {cType === 'vacation' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>{t('leave.duration_mode_label', 'Duration')} *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {([
                      { key: 'full_day', label: t('leave.duration_full_day', 'Full day leave'), icon: <CalendarDays size={13} strokeWidth={2.4} /> },
                      { key: 'short_leave', label: t('leave.duration_short_leave', 'Short leave'), icon: <Clock3 size={13} strokeWidth={2.4} /> },
                    ] as const).map((opt) => {
                      const selected = cDurationType === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setCDurationType(opt.key)}
                          style={{ borderRadius: 8, border: `1px solid ${selected ? 'var(--primary)' : '#d1d5db'}`, background: '#ffffff', color: selected ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 12, fontWeight: 700, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <DatePicker label={`${t('leave.start_date')} *`} value={cStart} onChange={setCStart} />
                </div>
                <div style={{ flex: 1 }}>
                  <DatePicker label={`${t('leave.end_date')} *`} value={cEnd} onChange={setCEnd} disabled={cDurationType === 'short_leave'} />
                </div>
              </div>

              {cDurationType === 'short_leave' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>{t('leave.short_leave_time_range', 'Time range')} *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input type="time" value={cShortStartTime} onChange={(e) => setCShortStartTime(e.target.value)} style={{ ...selectStyle, width: '100%', boxSizing: 'border-box', cursor: 'text' }} />
                    <input type="time" value={cShortEndTime} onChange={(e) => setCShortEndTime(e.target.value)} style={{ ...selectStyle, width: '100%', boxSizing: 'border-box', cursor: 'text' }} />
                  </div>
                </div>
              )}

              {cStart && cEnd && new Date(cStart) <= new Date(cEnd) && (
                <div style={{ marginBottom: 14, padding: '8px 12px', background: '#ffffff', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, color: '#4b5563', fontWeight: 600 }}>
                  {cDurationType === 'short_leave'
                    ? (() => {
                        const hours = shortLeaveHours(cShortStartTime, cShortEndTime);
                        return hours != null
                          ? t('leave.short_leave_hours', { hours })
                          : t('leave.short_leave_hint', 'Select start and end time for a short leave.');
                      })()
                    : t('leave.working_days', { n: countWorkingDays(cStart, cEnd) })}
                </div>
              )}

              {cOverlapLoading && cUserId && (
                <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, color: '#4b5563', fontWeight: 600 }}>
                  {t('common.loading')}
                </div>
              )}

              {!cOverlapLoading && cOverlappingLeaves.length > 0 && (
                <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.06)' }}>
                  <div style={{ fontSize: 12, color: '#b91c1c', fontWeight: 700, marginBottom: 8 }}>
                    {t('leave.error_employee_has_leave_same_day', 'This user already has leave on the same day.')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {cOverlappingLeaves.slice(0, 3).map((conflict) => {
                      const conflictShort = conflict.leaveDurationType === 'short_leave';
                      return (
                        <div key={conflict.id} style={{ background: '#fff', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 7, padding: '7px 9px' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                            {t(`leave.type_${conflict.leaveType}`)} · {t(`leave.status_${conflict.status.toLowerCase().replace(/ /g, '_')}`)}
                          </div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>
                            {conflictShort
                              ? `${fmtDate(conflict.startDate, locale)} · ${conflict.shortStartTime ?? '--:--'}-${conflict.shortEndTime ?? '--:--'}`
                              : `${fmtDate(conflict.startDate, locale)} → ${fmtDate(conflict.endDate, locale)}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>{t('leave.notes_label')}</label>
                <textarea
                  value={cNotes}
                  onChange={(e) => setCNotes(e.target.value)}
                  rows={2}
                  placeholder={t('leave.notes_placeholder')}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', color: 'var(--text)', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setCreateOpen(false); setCEmployeeOpen(false); }}
                  disabled={cSaving}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={cSaving}
                  style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: cSaving ? 'not-allowed' : 'pointer', opacity: cSaving ? 0.7 : 1 }}
                >
                  {cSaving ? t('common.saving') : t('leave.admin_new')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Approve Confirm Modal ───────────────────────────────────────── */}
      {approveTarget && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setApproveTarget(null); }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', width: '100%', maxWidth: 390, border: '1px solid var(--border)', padding: 24 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              {t('leave.action_approve')}
            </h3>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--text-secondary)' }}>
              {approveTarget.userSurname} {approveTarget.userName} · {fmtDate(approveTarget.startDate, locale)} → {fmtDate(approveTarget.endDate, locale)}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setApproveTarget(null)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1.5px solid var(--border)', background: '#fff', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={async () => {
                  const target = approveTarget;
                  setApproveTarget(null);
                  if (target) await handleApprove(target);
                }}
                style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                {t('common.confirm', 'Confirm')}
              </button>
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
