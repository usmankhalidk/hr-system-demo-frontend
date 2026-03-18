import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  ShiftTemplate,
  listTemplates,
  createTemplate,
  deleteTemplate,
} from '../../api/shifts';

interface ShiftTemplatesPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function ShiftTemplatesPanel({ open, onClose }: ShiftTemplatesPanelProps) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New template form
  const [newName, setNewName] = useState('');
  const [newStoreId, setNewStoreId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchTemplates();
  }, [open]);

  async function fetchTemplates() {
    setLoading(true);
    setError(null);
    try {
      const data = await listTemplates();
      setTemplates(data.templates);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? t('common.error', 'Errore nel caricamento'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newStoreId) return;
    setSaving(true);
    setError(null);
    try {
      await createTemplate({
        store_id: parseInt(newStoreId, 10),
        name: newName.trim(),
        template_data: {},
      });
      setNewName('');
      setNewStoreId('');
      await fetchTemplates();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? t('common.error', 'Errore nel salvataggio'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm(t('shifts.confirmDeleteTemplate', 'Eliminare questo template?'))) return;
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((tmpl) => tmpl.id !== id));
    } catch (err: any) {
      setError(err?.response?.data?.error ?? t('common.error', 'Errore'));
    }
  }

  if (!open) return null;

  const modal = (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(2px)',
          zIndex: 1100,
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 520, maxWidth: '95vw',
        maxHeight: '80vh',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        zIndex: 1101,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: '1.1rem',
            color: 'var(--primary)', margin: 0,
          }}>
            {t('shifts.templatesTitle', 'Template turni')}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {error && (
            <div style={{
              background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 6,
              padding: '10px 14px', marginBottom: 16, color: '#c62828', fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}

          {/* Create form */}
          <form onSubmit={handleCreate} style={{ marginBottom: 24 }}>
            <p style={{ fontWeight: 600, marginBottom: 8, fontFamily: 'var(--font-display)' }}>
              {t('shifts.newTemplate', 'Nuovo template')}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder={t('shifts.templateName', 'Nome template')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                style={{
                  flex: 2, minWidth: 160,
                  padding: '8px 10px', border: '1px solid var(--border)',
                  borderRadius: 6, fontFamily: 'var(--font-body)', fontSize: '0.875rem',
                  background: 'var(--bg)', color: 'var(--text)',
                }}
              />
              <input
                type="number"
                placeholder={t('shifts.storeId', 'ID Negozio')}
                value={newStoreId}
                onChange={(e) => setNewStoreId(e.target.value)}
                required
                style={{
                  flex: 1, minWidth: 100,
                  padding: '8px 10px', border: '1px solid var(--border)',
                  borderRadius: 6, fontFamily: 'var(--font-body)', fontSize: '0.875rem',
                  background: 'var(--bg)', color: 'var(--text)',
                }}
              />
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? '...' : t('common.save', 'Salva')}
              </button>
            </div>
          </form>

          {/* Template list */}
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>{t('common.loading', 'Caricamento...')}</p>
          ) : templates.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              {t('shifts.noTemplates', 'Nessun template salvato')}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {templates.map((tmpl) => (
                <li key={tmpl.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  marginBottom: 8,
                  background: 'var(--bg)',
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-display)' }}>{tmpl.name}</span>
                    <span style={{ marginLeft: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {t('shifts.store', 'Negozio')} #{tmpl.store_id}
                    </span>
                  </div>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDelete(tmpl.id)}
                    style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                  >
                    {t('common.delete', 'Elimina')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            {t('common.close', 'Chiudi')}
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}
