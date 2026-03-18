import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Shift, CreateShiftPayload, createShift, updateShift, deleteShift } from '../../api/shifts';

interface ShiftDrawerProps {
  open: boolean;
  shift: Shift | null;
  prefillDate?: string;
  prefillUserId?: number;
  onClose: (refreshNeeded: boolean) => void;
}

interface FormState {
  user_id: string;
  store_id: string;
  date: string;
  start_time: string;
  end_time: string;
  break_start: string;
  break_end: string;
  is_split: boolean;
  split_start2: string;
  split_end2: string;
  notes: string;
  status: 'scheduled' | 'confirmed' | 'cancelled';
}

const EMPTY_FORM: FormState = {
  user_id: '',
  store_id: '',
  date: '',
  start_time: '',
  end_time: '',
  break_start: '',
  break_end: '',
  is_split: false,
  split_start2: '',
  split_end2: '',
  notes: '',
  status: 'scheduled',
};

export default function ShiftDrawer({ open, shift, prefillDate, prefillUserId, onClose }: ShiftDrawerProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (shift) {
      setForm({
        user_id: String(shift.user_id),
        store_id: String(shift.store_id),
        date: shift.date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        break_start: shift.break_start ?? '',
        break_end: shift.break_end ?? '',
        is_split: shift.is_split,
        split_start2: shift.split_start2 ?? '',
        split_end2: shift.split_end2 ?? '',
        notes: shift.notes ?? '',
        status: shift.status,
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        date: prefillDate ?? '',
        user_id: prefillUserId ? String(prefillUserId) : '',
      });
    }
    setError(null);
  }, [open, shift, prefillDate, prefillUserId]);

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: CreateShiftPayload = {
        user_id: parseInt(form.user_id, 10),
        store_id: parseInt(form.store_id, 10),
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        break_start: form.break_start || null,
        break_end: form.break_end || null,
        is_split: form.is_split,
        split_start2: form.is_split ? (form.split_start2 || null) : null,
        split_end2: form.is_split ? (form.split_end2 || null) : null,
        notes: form.notes || null,
        status: form.status,
      };
      if (shift) {
        await updateShift(shift.id, payload);
      } else {
        await createShift(payload);
      }
      onClose(true);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? t('common.error', 'Errore nel salvataggio'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!shift) return;
    if (!window.confirm(t('shifts.confirmDelete', 'Annullare questo turno?'))) return;
    setDeleting(true);
    try {
      await deleteShift(shift.id);
      onClose(true);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? t('common.error', 'Errore'));
    } finally {
      setDeleting(false);
    }
  }

  if (!open) return null;

  const panel = (
    <>
      {/* Backdrop */}
      <div
        onClick={() => onClose(false)}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(2px)',
          zIndex: 1000,
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 420, maxWidth: '100vw',
        background: 'var(--surface)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        zIndex: 1001,
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: '1.15rem',
            color: 'var(--primary)', margin: 0,
          }}>
            {shift ? t('shifts.editShift', 'Modifica turno') : t('shifts.newShift', 'Nuovo turno')}
          </h2>
          <button
            onClick={() => onClose(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {error && (
            <div style={{
              background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-sm)',
              padding: '10px 14px', marginBottom: 16, color: 'var(--danger)', fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}

          <label style={labelStyle}>
            {t('shifts.form.userId', 'ID Dipendente')}
            <input
              type="number"
              required
              value={form.user_id}
              onChange={set('user_id')}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            {t('shifts.form.storeId', 'ID Negozio')}
            <input
              type="number"
              required
              value={form.store_id}
              onChange={set('store_id')}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            {t('shifts.form.date', 'Data')}
            <input
              type="date"
              required
              value={form.date}
              onChange={set('date')}
              style={inputStyle}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={labelStyle}>
              {t('shifts.form.startTime', 'Inizio')}
              <input type="time" required value={form.start_time} onChange={set('start_time')} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              {t('shifts.form.endTime', 'Fine')}
              <input type="time" required value={form.end_time} onChange={set('end_time')} style={inputStyle} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={labelStyle}>
              {t('shifts.form.breakStart', 'Pausa inizio')}
              <input type="time" value={form.break_start} onChange={set('break_start')} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              {t('shifts.form.breakEnd', 'Pausa fine')}
              <input type="time" value={form.break_end} onChange={set('break_end')} style={inputStyle} />
            </label>
          </div>

          <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_split} onChange={set('is_split')} />
            {t('shifts.form.isSplit', 'Turno spezzato')}
          </label>

          {form.is_split && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
              <label style={labelStyle}>
                {t('shifts.form.splitStart2', 'Inizio 2')}
                <input type="time" value={form.split_start2} onChange={set('split_start2')} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                {t('shifts.form.splitEnd2', 'Fine 2')}
                <input type="time" value={form.split_end2} onChange={set('split_end2')} style={inputStyle} />
              </label>
            </div>
          )}

          <label style={labelStyle}>
            {t('shifts.form.status', 'Stato')}
            <select value={form.status} onChange={set('status')} style={inputStyle}>
              <option value="scheduled">{t('shifts.status.scheduled', 'Pianificato')}</option>
              <option value="confirmed">{t('shifts.status.confirmed', 'Confermato')}</option>
              <option value="cancelled">{t('shifts.status.cancelled', 'Annullato')}</option>
            </select>
          </label>

          <label style={labelStyle}>
            {t('shifts.form.notes', 'Note')}
            <textarea
              value={form.notes}
              onChange={set('notes')}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </label>
        </form>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          {shift && shift.status !== 'cancelled' && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={deleting}
              style={{ marginRight: 'auto' }}
            >
              {deleting ? t('common.loading', '...') : t('shifts.cancel', 'Annulla turno')}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => onClose(false)}>
            {t('common.close', 'Chiudi')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? t('common.saving', 'Salvataggio...') : t('common.save', 'Salva')}
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(panel, document.body);
}

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontFamily: 'var(--font-body)', fontSize: '0.875rem',
  fontWeight: 500, color: 'var(--text)', marginBottom: 14,
};

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontFamily: 'var(--font-body)',
  fontSize: '0.875rem',
  background: 'var(--bg)',
  color: 'var(--text)',
  width: '100%',
  boxSizing: 'border-box',
};
