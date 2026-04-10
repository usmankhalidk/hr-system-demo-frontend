import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import {
  getAffluence,
  createAffluence,
  updateAffluence,
  deleteAffluence,
  StoreAffluence,
} from '../../api/shifts';

function affluenceErrorKey(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const code: string = err.response?.data?.code ?? '';
    if (code === 'CONFLICT') return 'shifts.affluence_error_conflict';
    if (code === 'STORE_NOT_FOUND') return 'shifts.affluence_error_store_not_found';
    if (code === 'NOT_FOUND') return 'shifts.affluence_error_not_found';
  }
  return 'errors.DEFAULT';
}

const TIME_SLOTS = ['09:00-12:00', '12:00-15:00', '15:00-18:00', '18:00-21:00'] as const;
const LEVELS = ['low', 'medium', 'high'] as const;
const DAY_LABELS: Record<number, string> = {
  1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun',
};

interface Props {
  storeId: number;
  onClose: () => void;
}

type EditState = { id: number; level: 'low' | 'medium' | 'high'; required_staff: number } | null;

const emptyForm = {
  day_of_week: 1,
  time_slot: '09:00-12:00' as string,
  level: 'low' as 'low' | 'medium' | 'high',
  required_staff: 2,
  iso_week: '' as string,
};

export default function AffluenceAdminModal({ storeId, onClose }: Props) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<StoreAffluence[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAffluence({ store_id: storeId, raw: 1 });
      setRows(res.affluence);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  }

  async function handleAdd() {
    setSaving(true);
    setError(null);
    try {
      await createAffluence({
        store_id: storeId,
        day_of_week: form.day_of_week,
        time_slot: form.time_slot,
        level: form.level,
        required_staff: form.required_staff,
        iso_week: form.iso_week ? parseInt(form.iso_week, 10) : null,
      });
      setShowAddForm(false);
      setForm(emptyForm);
      flash(t('shifts.affluence_added'));
      await load();
    } catch (err) {
      setError(t(affluenceErrorKey(err)));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: number) {
    if (!editState || editState.id !== id) return;
    setSaving(true);
    setError(null);
    try {
      await updateAffluence(id, { level: editState.level, required_staff: editState.required_staff });
      setEditState(null);
      flash(t('shifts.affluence_updated'));
      await load();
    } catch (err) {
      setError(t(affluenceErrorKey(err)));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm(t('shifts.affluence_delete_confirm'))) return;
    setSaving(true);
    setError(null);
    try {
      await deleteAffluence(id);
      flash(t('shifts.affluence_deleted'));
      await load();
    } catch (err) {
      setError(t(affluenceErrorKey(err)));
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(13,33,55,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
          width: '100%', maxWidth: 680, maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
          border: '1px solid var(--border)', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          background: 'var(--primary)', padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 3 }}>
              {t('shifts.affluence_heading')}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: '#fff' }}>
              {t('shifts.affluence_manage')}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {notice && (
          <div style={{ padding: '8px 20px', background: 'rgba(22,163,74,0.1)', borderBottom: '1px solid rgba(22,163,74,0.2)', fontSize: 13, color: '#16a34a' }}>
            {notice}
          </div>
        )}
        {error && (
          <div style={{ padding: '8px 20px', background: 'var(--danger-bg)', borderBottom: '1px solid var(--danger-border)', fontSize: 13, color: 'var(--danger)', display: 'flex', justifyContent: 'space-between' }}>
            {error}
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 16 }}>×</button>
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
          <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className={`btn ${showAddForm ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => { setShowAddForm((o) => !o); setForm(emptyForm); }}
              style={{ fontSize: 12 }}
            >
              {showAddForm ? t('shifts.affluence_cancel') : `+ ${t('shifts.affluence_add_slot')}`}
            </button>
          </div>

          {showAddForm && (
            <div style={{
              background: 'var(--background)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 16,
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10,
            }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('shifts.affluence_day_label')}
                <select value={form.day_of_week} onChange={(e) => setForm((f) => ({ ...f, day_of_week: parseInt(e.target.value, 10) }))} style={{ padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 13 }}>
                  {[1,2,3,4,5,6,7].map((d) => <option key={d} value={d}>{t(`shifts.day${DAY_LABELS[d]}`)}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('shifts.affluence_time_slot_label')}
                <select value={form.time_slot} onChange={(e) => setForm((f) => ({ ...f, time_slot: e.target.value }))} style={{ padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 13 }}>
                  {TIME_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('shifts.affluence_level_label')}
                <select value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as 'low' | 'medium' | 'high' }))} style={{ padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 13 }}>
                  {LEVELS.map((l) => <option key={l} value={l}>{t(`shifts.level_${l}`)}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('shifts.affluence_required_staff_label')}
                <input type="number" min={0} max={999} value={form.required_staff} onChange={(e) => setForm((f) => ({ ...f, required_staff: parseInt(e.target.value, 10) || 0 }))} style={{ padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 13, width: '100%' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('shifts.affluence_week_label')}
                <input type="number" min={1} max={53} placeholder={t('shifts.affluence_iso_week_placeholder')} value={form.iso_week} onChange={(e) => setForm((f) => ({ ...f, iso_week: e.target.value }))} style={{ padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 13, width: '100%' }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>{t('shifts.affluence_week_default')}</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn btn-primary" onClick={handleAdd} disabled={saving} style={{ width: '100%', fontSize: 12 }}>
                  {saving ? '…' : t('shifts.affluence_save')}
                </button>
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            {t('shifts.affluence_all_entries')}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>…</div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>{t('shifts.affluence_no_data')}</div>
          ) : (
            <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--background)' }}>
                    {[t('shifts.affluence_day_label'), t('shifts.affluence_time_slot_label'), t('shifts.affluence_week_label'), t('shifts.affluence_level_label'), t('shifts.affluence_required_staff_label'), ''].map((h, i) => (
                      <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isEditing = editState?.id === row.id;
                    return (
                      <tr key={row.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--text)' }}>{t(`shifts.day${DAY_LABELS[row.dayOfWeek]}`)}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{row.timeSlot}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{row.isoWeek != null ? `W${row.isoWeek}` : '—'}</td>
                        <td style={{ padding: '7px 10px' }}>
                          {isEditing ? (
                            <select value={editState.level} onChange={(e) => setEditState((s) => s && ({ ...s, level: e.target.value as 'low' | 'medium' | 'high' }))} style={{ padding: '3px 6px', borderRadius: 5, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 12 }}>
                              {LEVELS.map((l) => <option key={l} value={l}>{t(`shifts.level_${l}`)}</option>)}
                            </select>
                          ) : (
                            <span style={{ fontWeight: 700, color: row.level === 'high' ? '#dc2626' : row.level === 'medium' ? '#b45309' : '#16a34a' }}>{t(`shifts.level_${row.level}`)}</span>
                          )}
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          {isEditing ? (
                            <input type="number" min={0} max={999} value={editState.required_staff} onChange={(e) => setEditState((s) => s && ({ ...s, required_staff: parseInt(e.target.value, 10) || 0 }))} style={{ width: 60, padding: '3px 6px', borderRadius: 5, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 12 }} />
                          ) : (
                            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{row.requiredStaff}</span>
                          )}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="btn btn-primary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => handleUpdate(row.id)} disabled={saving}>{saving ? '…' : t('shifts.affluence_save')}</button>
                              <button className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setEditState(null)}>{t('shifts.affluence_cancel')}</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setEditState({ id: row.id, level: row.level, required_staff: row.requiredStaff })}>{t('shifts.affluence_edit_slot')}</button>
                              <button className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 10px', color: 'var(--danger)', borderColor: 'var(--danger-border)' }} onClick={() => handleDelete(row.id)} disabled={saving}>{t('shifts.affluence_delete_slot')}</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button className="btn btn-secondary" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
