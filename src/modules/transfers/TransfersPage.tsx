import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, MapPin, Store } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAvatarUrl } from '../../api/client';
import { Employee, Store as StoreType } from '../../types';
import { getEmployees, EmployeeListParams } from '../../api/employees';
import { getStores } from '../../api/stores';
import {
  TransferAssignment,
  TransferLinkedShift,
  TransferStatus,
  createTransfer,
  updateTransfer,
  listTransfers,
  listTransferShifts,
  cancelTransfer,
  deleteTransfer,
  completeTransfer,
} from '../../api/transfers';
import ConfirmModal from '../../components/ui/ConfirmModal';

const WRITE_ROLES = ['admin', 'hr', 'area_manager'] as const;

interface TransferFormState {
  user_id: string;
  origin_store_id: string;
  target_store_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  notes: string;
}

const EMPTY_FORM: TransferFormState = {
  user_id: '',
  origin_store_id: '',
  target_store_id: '',
  start_date: '',
  end_date: '',
  reason: '',
  notes: '',
};

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function statusBadge(status: TransferStatus): { bg: string; color: string; label: string } {
  if (status === 'active') {
    return { bg: 'rgba(21,128,61,0.12)', color: '#166534', label: 'Attivo' };
  }
  if (status === 'completed') {
    return { bg: 'rgba(2,132,199,0.12)', color: '#0c4a6e', label: 'Completato' };
  }
  return { bg: 'rgba(107,114,128,0.14)', color: '#374151', label: 'Annullato' };
}

function shiftStatusBadge(status: TransferLinkedShift['status']): { bg: string; color: string } {
  if (status === 'confirmed') {
    return { bg: 'rgba(22,163,74,0.14)', color: '#166534' };
  }
  if (status === 'cancelled') {
    return { bg: 'rgba(107,114,128,0.18)', color: '#374151' };
  }
  return { bg: 'rgba(30,64,175,0.14)', color: '#1e3a8a' };
}

function transferDaysInclusive(startDate: string, endDate: string): number | null {
  const s = startDate.split('-').map(Number);
  const e = endDate.split('-').map(Number);
  if (s.length !== 3 || e.length !== 3 || s.some(Number.isNaN) || e.some(Number.isNaN)) {
    return null;
  }
  const startMs = Date.UTC(s[0], s[1] - 1, s[2]);
  const endMs = Date.UTC(e[0], e[1] - 1, e[2]);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return null;
  }
  return Math.floor((endMs - startMs) / 86400000) + 1;
}

function truncateText(value: string, max = 16): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

async function loadEmployeesByPages(baseParams: Omit<EmployeeListParams, 'page' | 'limit'>): Promise<Employee[]> {
  const limit = 100;
  let page = 1;
  let pages = 1;
  const all: Employee[] = [];

  do {
    const res = await getEmployees({ ...baseParams, limit, page });
    all.push(...res.employees);
    pages = Math.max(1, res.pages || 1);
    page += 1;
  } while (page <= pages);

  return Array.from(new Map(all.map((emp) => [emp.id, emp])).values())
    .filter((emp) => emp.role === 'employee' && emp.status === 'active')
    .sort((a, b) => a.surname.localeCompare(b.surname));
}

export default function TransfersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const canWrite = Boolean(user && WRITE_ROLES.includes(user.role as (typeof WRITE_ROLES)[number]));

  const [statusFilter, setStatusFilter] = useState<TransferStatus | 'all'>('all');
  const [transfers, setTransfers] = useState<TransferAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<TransferAssignment | null>(null);
  const [form, setForm] = useState<TransferFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [linkedShifts, setLinkedShifts] = useState<TransferLinkedShift[]>([]);
  const [linkedShiftsLoading, setLinkedShiftsLoading] = useState(false);

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const selectedEmployee = useMemo(
    () => employees.find((emp) => emp.id === Number(form.user_id)),
    [employees, form.user_id],
  );

  const selectedEmployeeAvatarUrl = selectedEmployee?.avatarFilename
    ? getAvatarUrl(selectedEmployee.avatarFilename)
    : null;

  const selectedEmployeeInitials = `${selectedEmployee?.name?.[0] ?? ''}${selectedEmployee?.surname?.[0] ?? ''}`.toUpperCase() || 'U';
  const selectedEmployeeFullName = selectedEmployee
    ? `${selectedEmployee.surname} ${selectedEmployee.name}`
    : t('transfers.form.employee', 'Dipendente');

  const selectedEmployeeRoleLabel = selectedEmployee
    ? t(`roles.${selectedEmployee.role}`, selectedEmployee.role)
    : '';

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listTransfers(statusFilter === 'all' ? undefined : { status: statusFilter });
      setTransfers(data.transfers);
    } catch (err: any) {
      const code = err?.response?.data?.code as string | undefined;
      setError(code ? t(`errors.${code}`, t('errors.DEFAULT')) : t('errors.DEFAULT'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, t]);

  useEffect(() => {
    void fetchTransfers();
  }, [fetchTransfers]);

  useEffect(() => {
    if (!drawerOpen) return;
    let mounted = true;

    Promise.all([
      loadEmployeesByPages({ status: 'active' }),
      getStores(),
    ])
      .then(([loadedEmployees, loadedStores]) => {
        if (!mounted) return;
        setEmployees(loadedEmployees);
        setStores(loadedStores.filter((s) => s.isActive));
      })
      .catch(() => {
        if (!mounted) return;
        setEmployees([]);
        setStores([]);
      });

    return () => {
      mounted = false;
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen || !editingTransfer) {
      setLinkedShifts([]);
      setLinkedShiftsLoading(false);
      return;
    }

    let mounted = true;
    setLinkedShiftsLoading(true);

    listTransferShifts(editingTransfer.id)
      .then((res) => {
        if (!mounted) return;
        setLinkedShifts(res.shifts ?? []);
      })
      .catch(() => {
        if (!mounted) return;
        setLinkedShifts([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLinkedShiftsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [drawerOpen, editingTransfer]);

  function openCreateDrawer() {
    const today = toIsoDate(new Date());
    setEditingTransfer(null);
    setLinkedShifts([]);
    setLinkedShiftsLoading(false);
    setForm({ ...EMPTY_FORM, start_date: today, end_date: today });
    setDrawerOpen(true);
  }

  function openEditDrawer(transfer: TransferAssignment) {
    setEditingTransfer(transfer);
    setLinkedShifts([]);
    setLinkedShiftsLoading(false);
    setForm({
      user_id: String(transfer.userId),
      origin_store_id: String(transfer.originStoreId),
      target_store_id: String(transfer.targetStoreId),
      start_date: transfer.startDate,
      end_date: transfer.endDate,
      reason: transfer.reason ?? '',
      notes: transfer.notes ?? '',
    });
    setDrawerOpen(true);
  }

  function closeDrawer() {
    if (saving) return;
    setDrawerOpen(false);
    setEditingTransfer(null);
    setForm(EMPTY_FORM);
    setLinkedShifts([]);
    setLinkedShiftsLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.user_id || !form.target_store_id || !form.start_date || !form.end_date) {
      setError(t('errors.VALIDATION_ERROR'));
      return;
    }

    if (form.start_date > form.end_date) {
      setError(t('errors.INVALID_DATE_RANGE', t('errors.DEFAULT')));
      return;
    }

    const payload = {
      user_id: Number(form.user_id),
      origin_store_id: form.origin_store_id ? Number(form.origin_store_id) : undefined,
      target_store_id: Number(form.target_store_id),
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason.trim() || null,
      notes: form.notes.trim() || null,
    };

    setSaving(true);
    try {
      if (editingTransfer) {
        const updated = await updateTransfer(editingTransfer.id, payload);
        const warn = updated.warnings?.existingShifts ?? 0;
        setSuccess(
          warn > 0
            ? t('transfers.updatedWithWarnings', {
                defaultValue: `Trasferimento aggiornato. ${warn} turni esistenti nel periodo da verificare.`,
                count: warn,
              })
            : t('transfers.updated', 'Trasferimento aggiornato'),
        );
      } else {
        const created = await createTransfer(payload);
        const warn = created.warnings?.existingShifts ?? 0;
        setSuccess(
          warn > 0
            ? t('transfers.createdWithWarnings', {
                defaultValue: `Trasferimento creato. ${warn} turni esistenti nel periodo da verificare.`,
                count: warn,
              })
            : t('transfers.created', 'Trasferimento creato'),
        );
      }

      closeDrawer();
      await fetchTransfers();
    } catch (err: any) {
      const code = err?.response?.data?.code as string | undefined;
      setError(code ? t(`errors.${code}`, t('errors.DEFAULT')) : t('errors.DEFAULT'));
    } finally {
      setSaving(false);
    }
  }

  async function doCancelTransfer() {
    if (!editingTransfer) return;
    setConfirmCancelOpen(false);
    setError(null);
    try {
      const result = await cancelTransfer(editingTransfer.id);
      const cancelledCount = result.cancelledShifts ?? result.detachedShifts ?? 0;
      setSuccess(
        t('transfers.cancelledWithShiftCount', {
          defaultValue: `Trasferimento annullato. ${cancelledCount} turni nel periodo trasferimento impostati su annullato.`,
          count: cancelledCount,
        }),
      );
      closeDrawer();
      await fetchTransfers();
    } catch (err: any) {
      const code = err?.response?.data?.code as string | undefined;
      setError(code ? t(`errors.${code}`, t('errors.DEFAULT')) : t('errors.DEFAULT'));
    }
  }

  async function doCompleteTransfer() {
    if (!editingTransfer) return;
    setConfirmCompleteOpen(false);
    setError(null);
    try {
      await completeTransfer(editingTransfer.id);
      setSuccess(t('transfers.completed', 'Trasferimento completato'));
      closeDrawer();
      await fetchTransfers();
    } catch (err: any) {
      const code = err?.response?.data?.code as string | undefined;
      setError(code ? t(`errors.${code}`, t('errors.DEFAULT')) : t('errors.DEFAULT'));
    }
  }

  async function doDeleteTransfer() {
    if (!editingTransfer) return;
    setConfirmDeleteOpen(false);
    setError(null);
    try {
      await deleteTransfer(editingTransfer.id);
      setSuccess(t('transfers.deleted', 'Trasferimento eliminato'));
      closeDrawer();
      await fetchTransfers();
    } catch (err: any) {
      const code = err?.response?.data?.code as string | undefined;
      setError(code ? t(`errors.${code}`, t('errors.DEFAULT')) : t('errors.DEFAULT'));
    }
  }

  function handleEmployeeSelect(employeeId: string) {
    const employee = employees.find((emp) => emp.id === Number(employeeId));
    setForm((prev) => ({
      ...prev,
      user_id: employeeId,
      origin_store_id: employee?.storeId != null ? String(employee.storeId) : '',
    }));
  }

  return (
    <div className="page-enter" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>
            {t('transfers.title', 'Trasferimenti temporanei')}
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            {t('transfers.subtitle', 'Gestisci assegnazioni temporanee tra negozi e monitora i turni impattati.')}
          </p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={openCreateDrawer}>
            <ArrowLeftRight size={14} />
            {t('transfers.new', 'Nuovo trasferimento')}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {(['all', 'active', 'completed', 'cancelled'] as const).map((item) => {
          const active = item === statusFilter;
          return (
            <button
              key={item}
              onClick={() => setStatusFilter(item)}
              style={{
                border: active ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                background: active ? 'rgba(13,33,55,0.08)' : 'var(--surface)',
                color: active ? 'var(--primary)' : 'var(--text-secondary)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t(`transfers.filter.${item}`, item)}
            </button>
          );
        })}
      </div>

      {success && (
        <div style={{ marginBottom: 12, borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(22,163,74,0.3)', background: 'rgba(22,163,74,0.08)', color: '#166534', fontSize: 13 }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 12, borderRadius: 8, padding: '10px 12px', border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1080 }}>
            <thead>
              <tr style={{ background: 'var(--primary)', color: '#fff' }}>
                <th style={thStyle}>{t('transfers.table.employee', 'Dipendente')}</th>
                <th style={thStyle}>{t('transfers.table.company', 'Azienda')}</th>
                <th style={thStyle}>{t('transfers.table.origin', 'Origine')}</th>
                <th style={thStyle}>{t('transfers.table.target', 'Destinazione')}</th>
                <th style={thStyle}>{t('transfers.table.period', 'Periodo')}</th>
                <th style={thStyle}>{t('transfers.table.days', 'Days')}</th>
                <th style={thStyle}>{t('transfers.table.status', 'Stato')}</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>{t('common.actions', 'Azioni')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t('common.loading', 'Caricamento...')}
                  </td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t('transfers.empty', 'Nessun trasferimento trovato')}
                  </td>
                </tr>
              ) : transfers.map((transfer) => {
                const badge = statusBadge(transfer.status);
                const fullName = `${transfer.userSurname} ${transfer.userName}`.trim();
                const initials = `${transfer.userName?.[0] ?? ''}${transfer.userSurname?.[0] ?? ''}`.toUpperCase() || 'U';
                const avatarUrl = getAvatarUrl(transfer.userAvatarFilename);
                const daysInPeriod = transferDaysInclusive(transfer.startDate, transfer.endDate);
                return (
                  <tr key={transfer.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fullName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3 }}>
                            {transfer.userEmail || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>{transfer.companyName ?? '—'}</td>
                    <td style={tdStyle}>
                      <span style={chipStyle}><Store size={11} />{transfer.originStoreName}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ ...chipStyle, borderColor: 'rgba(13,33,55,0.28)' }}><ArrowLeftRight size={11} />{transfer.targetStoreName}</span>
                    </td>
                    <td style={tdStyle}>
                      <span>{transfer.startDate} - {transfer.endDate}</span>
                    </td>
                    <td style={tdStyle}>
                      {daysInPeriod != null ? (
                        <span style={{
                          width: 'fit-content',
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: '1px solid rgba(13,33,55,0.2)',
                          background: 'rgba(13,33,55,0.05)',
                          color: 'var(--text-secondary)',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-block',
                        }}>
                          {daysInPeriod}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ background: badge.bg, color: badge.color, padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                        {t(`transfers.status.${transfer.status}`, badge.label)}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button className="btn btn-secondary" onClick={() => openEditDrawer(transfer)}>
                        {t('common.detail', 'Dettaglio')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {drawerOpen && createPortal(
        <>
          <div
            onClick={closeDrawer}
            style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(13,33,55,0.5)', backdropFilter: 'blur(2px)' }}
          />
          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: 'min(520px, 100vw)',
            background: 'var(--surface)',
            zIndex: 1101,
            borderLeft: '1px solid var(--border)',
            boxShadow: '-8px 0 30px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--primary)' }}>
                {editingTransfer ? t('transfers.edit', 'Modifica trasferimento') : t('transfers.new', 'Nuovo trasferimento')}
              </h3>
              <button onClick={closeDrawer} style={closeBtnStyle}>x</button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
                <div style={fieldRowStyle}>
                  <label style={labelStyle}>{t('transfers.form.employee', 'Dipendente')}</label>
                  <select
                    value={form.user_id}
                    onChange={(e) => handleEmployeeSelect(e.target.value)}
                    style={inputStyle}
                    required
                    disabled={Boolean(editingTransfer)}
                  >
                    <option value="">{t('transfers.form.selectEmployee', 'Seleziona dipendente')}</option>
                    {employees.map((emp) => {
                      const roleLabel = t(`roles.${emp.role}`, emp.role);
                      return (
                        <option key={emp.id} value={String(emp.id)}>
                          {emp.surname} {emp.name} · {roleLabel}
                        </option>
                      );
                    })}
                  </select>
                  {selectedEmployee && (
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
                        {selectedEmployeeAvatarUrl ? (
                          <img src={selectedEmployeeAvatarUrl} alt={selectedEmployeeFullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : selectedEmployeeInitials}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {selectedEmployeeFullName}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedEmployeeRoleLabel}
                          {selectedEmployee.storeName ? ` · ${selectedEmployee.storeName}` : ''}
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={helpTextStyle}>
                    {t('transfers.form.employeeRoleOnly', 'Vengono mostrati solo utenti con ruolo Employee.')}
                  </div>
                </div>

                <div style={{ ...fieldRowStyle, marginTop: 8 }}>
                  <label style={labelStyle}>{t('transfers.form.originStore', 'Negozio origine')}</label>
                  <select
                    value={form.origin_store_id}
                    onChange={(e) => setForm((p) => ({ ...p, origin_store_id: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="">{t('transfers.form.useEmployeeStore', 'Usa negozio assegnato al dipendente')}</option>
                    {stores.map((store) => (
                      <option key={store.id} value={String(store.id)}>
                        {store.companyName ? `${store.name} (${store.companyName})` : store.name}
                      </option>
                    ))}
                  </select>
                  {!form.origin_store_id && selectedEmployee?.storeName && (
                    <div style={helpTextStyle}>
                      <MapPin size={11} />
                      {t('transfers.form.detectedOrigin', {
                        defaultValue: `Origine rilevata: ${selectedEmployee.storeName}`,
                        store: selectedEmployee.storeName,
                      })}
                    </div>
                  )}
                </div>

                <div style={{ ...fieldRowStyle, marginTop: 8 }}>
                  <label style={labelStyle}>{t('transfers.form.targetStore', 'Negozio destinazione')}</label>
                  <select
                    value={form.target_store_id}
                    onChange={(e) => setForm((p) => ({ ...p, target_store_id: e.target.value }))}
                    style={inputStyle}
                    required
                  >
                    <option value="">{t('transfers.form.selectStore', 'Seleziona negozio')}</option>
                    {stores.map((store) => (
                      <option key={store.id} value={String(store.id)}>
                        {store.companyName ? `${store.name} (${store.companyName})` : store.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div style={fieldRowStyle}>
                    <label style={labelStyle}>{t('transfers.form.startDate', 'Data inizio')}</label>
                    <input type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} style={inputStyle} required />
                  </div>
                  <div style={fieldRowStyle}>
                    <label style={labelStyle}>{t('transfers.form.endDate', 'Data fine')}</label>
                    <input type="date" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} style={inputStyle} required />
                  </div>
                </div>

                <div style={{ ...fieldRowStyle, marginTop: 8 }}>
                  <label style={labelStyle}>{t('transfers.form.reason', 'Motivazione')}</label>
                  <input
                    type="text"
                    maxLength={500}
                    value={form.reason}
                    onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                    style={inputStyle}
                    placeholder={t('transfers.form.reasonPlaceholder', 'Es. supporto picco vendite')}
                  />
                </div>

                <div style={{ ...fieldRowStyle, marginTop: 8 }}>
                  <label style={labelStyle}>{t('common.notes', 'Note')}</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    style={{ ...inputStyle, minHeight: 84, resize: 'vertical' }}
                    maxLength={1500}
                  />
                </div>

                {editingTransfer && (
                  <div style={{
                    marginTop: 14,
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    background: 'rgba(13,33,55,0.03)',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      {t('transfers.linkedShiftsTitle', 'Linked shifts')}
                      {(() => {
                        const days = transferDaysInclusive(editingTransfer.startDate, editingTransfer.endDate);
                        if (days == null) return null;
                        return (
                          <span style={{
                            marginLeft: 8,
                            width: 'fit-content',
                            padding: '2px 8px',
                            borderRadius: 999,
                            border: '1px solid rgba(13,33,55,0.2)',
                            background: 'rgba(13,33,55,0.05)',
                            color: 'var(--text-secondary)',
                            fontSize: 10,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            display: 'inline-block',
                            verticalAlign: 'middle',
                          }}>
                            {t('transfers.table.daysShort', 'days') ? `${days} ${t('transfers.table.daysShort', 'days')}` : `${days} days`}
                          </span>
                        );
                      })()}
                    </div>

                    {linkedShiftsLoading ? (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {t('common.loading', 'Caricamento...')}
                      </div>
                    ) : linkedShifts.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {t('transfers.linkedShiftsEmpty', 'No linked shifts found for this transfer.')}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {linkedShifts.map((shift) => {
                          const sb = shiftStatusBadge(shift.status);
                          return (
                            <div key={shift.id} style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              padding: '7px 9px',
                            }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 700 }}>
                                  {shift.date} · {shift.startTime.slice(0, 5)}-{shift.endTime.slice(0, 5)}
                                  {shift.shiftHours != null && shift.shiftHours !== '' ? ` (${shift.shiftHours}h)` : ''}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={shift.storeName}>
                                  {truncateText(shift.storeName, 28)}
                                </div>
                              </div>
                              <span style={{
                                background: sb.bg,
                                color: sb.color,
                                borderRadius: 999,
                                padding: '3px 8px',
                                fontSize: 10,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                whiteSpace: 'nowrap',
                              }}>
                                {t(`shifts.status.${shift.status}`, shift.status)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {editingTransfer && (
                  <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {editingTransfer.status === 'active' && (
                      <>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setConfirmCompleteOpen(true)}
                        >
                          {t('transfers.markCompleted', 'Segna completato')}
                        </button>
                        {canWrite && (
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => setConfirmCancelOpen(true)}
                          >
                            {t('transfers.cancel', 'Annulla trasferimento')}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div>
                  {editingTransfer && canWrite && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => setConfirmDeleteOpen(true)}
                      disabled={saving}
                    >
                      {t('transfers.delete', 'Elimina trasferimento')}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={closeDrawer} disabled={saving}>
                  {t('common.cancel', 'Annulla')}
                </button>
                {canWrite && (
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? t('common.saving', 'Salvataggio...') : t('common.save', 'Salva')}
                  </button>
                )}
                </div>
              </div>
            </form>
          </div>
        </>,
        document.body,
      )}

      <ConfirmModal
        open={confirmCancelOpen}
        title={t('transfers.cancelConfirmTitle', 'Conferma annullamento')}
        message={t('transfers.cancelConfirmMessage', 'Vuoi annullare questo trasferimento? I turni del periodo trasferimento verranno impostati su annullato.')}
        variant="warning"
        onCancel={() => setConfirmCancelOpen(false)}
        onConfirm={() => { void doCancelTransfer(); }}
      />

      <ConfirmModal
        open={confirmCompleteOpen}
        title={t('transfers.completeConfirmTitle', 'Conferma completamento')}
        message={t('transfers.completeConfirmMessage', 'Segnare il trasferimento come completato?')}
        variant="primary"
        onCancel={() => setConfirmCompleteOpen(false)}
        onConfirm={() => { void doCompleteTransfer(); }}
      />

      <ConfirmModal
        open={confirmDeleteOpen}
        title={t('transfers.deleteConfirmTitle', 'Conferma eliminazione')}
        message={t('transfers.deleteConfirmMessage', 'Eliminare definitivamente questo trasferimento? I collegamenti ai turni verranno rimossi.')}
        variant="danger"
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => { void doDeleteTransfer(); }}
      />
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 700,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--text-secondary)',
};

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 8px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  background: 'rgba(13,33,55,0.03)',
};

const closeBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontWeight: 700,
  cursor: 'pointer',
};

const fieldRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text-secondary)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const inputStyle: React.CSSProperties = {
  border: '1.5px solid var(--border)',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  color: 'var(--text-primary)',
  background: 'var(--surface)',
  fontFamily: 'var(--font-body)',
};

const helpTextStyle: React.CSSProperties = {
  marginTop: 2,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  color: 'var(--text-muted)',
};
