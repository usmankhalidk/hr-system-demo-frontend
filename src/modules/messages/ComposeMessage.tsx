import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';
import { sendMessage } from '../../api/messages';
import { getEmployees } from '../../api/employees';
import { translateApiError } from '../../utils/apiErrors';

interface Props {
  /** Pre-set recipient (reply mode or employee→HR). If omitted, show picker. */
  recipientId?: number;
  recipientName?: string;
  /** Optional prefill for reply mode */
  defaultSubject?: string;
  defaultBody?: string;
  onClose: () => void;
  onSent?: () => void;
}

interface PickableEmployee { id: number; name: string; surname: string; role: string }

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  display: 'block', marginBottom: 6,
};

export function ComposeMessage({ recipientId, recipientName, defaultSubject, defaultBody, onClose, onSent }: Props) {
  const { t } = useTranslation();

  const showPicker = recipientId === undefined;

  const [subject, setSubject] = useState(defaultSubject ?? '');
  const [body, setBody] = useState(defaultBody ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Picker state
  const [employees, setEmployees] = useState<PickableEmployee[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [pickedName, setPickedName] = useState<string>('');

  useEffect(() => {
    if (!showPicker) return;
    setEmpLoading(true);
    getEmployees({ limit: 200, status: 'active' })
      .then(({ employees: list }) => setEmployees(list))
      .catch(() => {})
      .finally(() => setEmpLoading(false));
  }, [showPicker]);

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.surname.toLowerCase().includes(q)
    );
  });

  const effectiveRecipientId = showPicker ? pickedId : recipientId;
  const effectiveRecipientName = showPicker ? pickedName : (recipientName ?? '');

  const handleSend = async () => {
    if (!effectiveRecipientId) {
      setError(t('messages.errorPickRecipient'));
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError(t('messages.errorSend'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await sendMessage({ recipientId: effectiveRecipientId, subject: subject.trim(), body: body.trim() });
      onSent?.();
      onClose();
    } catch (err: unknown) {
      setError(translateApiError(err, t, t('messages.errorSend')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('messages.compose')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button loading={saving} onClick={handleSend} disabled={!effectiveRecipientId}>
            {t('messages.send')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <Alert variant="danger" title={t('common.error')} onClose={() => setError(null)}>{error}</Alert>
        )}

        {/* Recipient row */}
        <div>
          <label style={LABEL_STYLE}>{t('messages.recipientLabel')}</label>

          {showPicker ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Search input */}
              <div style={{ position: 'relative' }}>
                <Search
                  size={13}
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
                />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('messages.searchEmployee')}
                  disabled={empLoading || saving}
                  style={{
                    width: '100%', padding: '8px 12px 8px 32px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    fontSize: '13px', fontFamily: 'var(--font-body)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Employee list */}
              {empLoading ? (
                <div style={{ padding: '12px', display: 'flex', justifyContent: 'center' }}>
                  <Spinner size="sm" />
                </div>
              ) : (
                <div style={{
                  maxHeight: 180, overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface)',
                }}>
                  {filtered.length === 0 ? (
                    <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {t('common.noResults')}
                    </div>
                  ) : filtered.map(emp => {
                    const fullName = `${emp.name} ${emp.surname}`;
                    const isPicked = pickedId === emp.id;
                    return (
                      <button
                        key={emp.id}
                        onClick={() => { setPickedId(emp.id); setPickedName(fullName); }}
                        style={{
                          width: '100%', textAlign: 'left', border: 'none',
                          padding: '9px 14px', cursor: 'pointer',
                          background: isPicked ? 'var(--accent-light)' : 'transparent',
                          color: isPicked ? 'var(--accent)' : 'var(--text-primary)',
                          fontWeight: isPicked ? 700 : 400,
                          fontSize: 13, fontFamily: 'var(--font-body)',
                          borderBottom: '1px solid var(--border-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (!isPicked) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-warm)'; }}
                        onMouseLeave={e => { if (!isPicked) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                      >
                        <span>{fullName}</span>
                        {isPicked && <span style={{ fontSize: 11 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {pickedId && (
                <div style={{
                  padding: '7px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--accent-light)', border: '1px solid var(--accent)',
                  fontSize: 12, fontWeight: 700, color: 'var(--accent)',
                }}>
                  ✓ {pickedName}
                </div>
              )}
            </div>
          ) : (
            /* Fixed recipient */
            <div style={{
              padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-warm)', border: '1px solid var(--border)',
              fontSize: '13px', color: 'var(--text-primary)',
            }}>
              {effectiveRecipientName}
            </div>
          )}
        </div>

        {/* Subject */}
        <div>
          <label style={LABEL_STYLE}>{t('messages.subject')}</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            disabled={saving}
            placeholder={t('messages.subjectPlaceholder')}
            style={{
              width: '100%', padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              fontSize: '13px', fontFamily: 'var(--font-body)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Body */}
        <div>
          <label style={LABEL_STYLE}>{t('messages.body')}</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            disabled={saving}
            placeholder={t('messages.bodyPlaceholder')}
            rows={5}
            style={{
              width: '100%', padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              fontSize: '13px', fontFamily: 'var(--font-body)',
              resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>
    </Modal>
  );
}
