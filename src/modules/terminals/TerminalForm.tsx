import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, RefreshCw, Copy, CheckCircle2, KeyRound, ChevronDown, Store as StoreIcon, Trash2, QrCode } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { createTerminal, updateTerminal, deleteTerminal, getStoresWithTerminalStatus, StoreTerminalStatus, Terminal } from '../../api/terminals';
import { generateQrToken, QrTokenResponse } from '../../api/attendance';
import { translateApiError } from '../../utils/apiErrors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';

interface TerminalFormProps {
  open?: boolean;
  terminal?: Terminal | null;
  onSuccess: () => void;
  onCancel: () => void;
}

function generateTempPassword(): string {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '@#!$%&';
  const all = upper + lower + digits + special;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
  for (let i = 0; i < 8; i++) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0 20px' }}>
      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
    </div>
  );
}

export function TerminalForm({ open = true, terminal, onSuccess, onCancel }: TerminalFormProps) {
  const { t } = useTranslation();
  const { isMobile } = useBreakpoint();
  
  const [stores, setStores] = useState<StoreTerminalStatus[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [createdCredentials, setCreatedCredentials] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [qrData, setQrData] = useState<QrTokenResponse | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const storePickerRef = useRef<HTMLDivElement | null>(null);

  const isEditMode = !!terminal;
  const selectedStore = stores.find(s => String(s.id) === selectedStoreId);

  const regeneratePassword = useCallback(() => {
    setPassword(generateTempPassword());
    setPasswordError(undefined);
  }, []);

  const getTerminalEmail = (store?: StoreTerminalStatus) => {
    if (isEditMode && terminal) return terminal.email;
    if (!store) return '';
    const sName = (store.name || '').toLowerCase().replace(/\s+/g, '');
    const cName = (store.companyName || '').toLowerCase().replace(/\s+/g, '');
    return `${sName}@${cName}.com`;
  };

  const loadQrCode = useCallback(async (storeId: number) => {
    setLoadingQr(true);
    try {
      const data = await generateQrToken(storeId);
      setQrData(data);
    } catch (err) {
      console.error('Failed to generate preview QR:', err);
      setQrData(null);
    } finally {
      setLoadingQr(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setLoadingStores(true);
      getStoresWithTerminalStatus()
        .then(data => {
          const list = Array.isArray(data) ? data : [];
          setStores(list);
          if (terminal) {
            setSelectedStoreId(String(terminal.storeId));
            loadQrCode(terminal.storeId);
          }
        })
        .catch(() => setError(t('common.error')))
        .finally(() => setLoadingStores(false));
      
      if (!terminal) {
        setPassword(generateTempPassword());
        setQrData(null);
      } else {
        setPassword(terminal.plainPassword || '');
      }
    } else {
      setSelectedStoreId('');
      setPassword('');
      setError(null);
      setCreatedCredentials(null);
      setStorePickerOpen(false);
      setPasswordError(undefined);
      setConfirmDelete(false);
      setQrData(null);
    }
  }, [open, terminal, t, loadQrCode]);

  useEffect(() => {
    if (selectedStoreId && !isEditMode) {
      loadQrCode(Number(selectedStoreId));
    } else if (!selectedStoreId) {
      setQrData(null);
    }
  }, [selectedStoreId, isEditMode, loadQrCode]);

  useEffect(() => {
    if (!storePickerOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (storePickerRef.current && !storePickerRef.current.contains(event.target as Node)) {
        setStorePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [storePickerOpen]);

  const handleSubmit = async () => {
    if (!selectedStoreId) {
      setError(t('terminals.fieldRequired'));
      return;
    }
    
    if (!password) {
      setError(t('terminals.fieldRequired')); 
      return;
    }

    if (password.length < 8) {
      setPasswordError(t('employees.passwordTooShort'));
      return;
    }
    if (!selectedStore) return;

    setLoading(true);
    setError(null);
    try {
      if (isEditMode && terminal) {
        await updateTerminal(terminal.id, { password });
        onSuccess();
      } else {
        const email = getTerminalEmail(selectedStore);
        await createTerminal({
          storeId: selectedStore.id,
          email,
          password,
        });
        setCreatedCredentials({
          name: selectedStore.name,
          email,
          password,
        });
      }
    } catch (err) {
      setError(translateApiError(err, t, t('terminals.errorSave')));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!terminal) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await deleteTerminal(terminal.id);
      onSuccess();
    } catch (err) {
      setError(translateApiError(err, t, t('common.error')));
      setConfirmDelete(false);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="drawer-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end', background: 'rgba(13, 33, 55, 0.48)', backdropFilter: 'blur(3px)' }} onClick={onCancel}>
      <div className="drawer-panel" style={{ position: 'relative', width: 'min(520px, 100vw)', height: '100%', background: 'var(--surface)', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 48px rgba(0,0,0,0.16)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ height: '3px', flexShrink: 0, background: 'linear-gradient(90deg, var(--accent) 0%, var(--primary) 100%)' }} />
        
        <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: '0 0 3px', letterSpacing: '-0.02em' }}>
              {isEditMode ? t('terminals.editTerminalTitle') : t('terminals.newTerminalTitle')} 
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, fontFamily: 'var(--font-body)' }}>
              {isEditMode ? t('terminals.editTerminalSubtitle') : t('terminals.readOnlyNotice')}
            </p>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 6px', fontSize: '22px', lineHeight: 1 }}>×</button>
        </div>

        {!createdCredentials ? (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {error && (
                <div style={{ marginBottom: '20px' }}>
                  <Alert variant="danger">{error}</Alert>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                {/* Store Selection */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('terminals.selectStore')}
                  </label>
                  <div style={{ position: 'relative' }} ref={storePickerRef}>
                    <button
                      onClick={() => !isEditMode && setStorePickerOpen(!storePickerOpen)}
                      type="button"
                      disabled={loadingStores || isEditMode}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', background: isEditMode ? 'var(--surface-warm)' : 'var(--surface)',
                        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                        cursor: isEditMode ? 'not-allowed' : 'pointer', textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: '14px', color: selectedStore ? 'var(--text-primary)' : 'var(--text-disabled)' }}>
                        {selectedStore ? `${selectedStore.name} (${selectedStore.companyName})` : t('terminals.selectStore')}
                      </span>
                      {!isEditMode && <ChevronDown size={16} color="var(--text-muted)" />}
                    </button>

                    {!isEditMode && storePickerOpen && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', zIndex: 10,
                        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                        boxShadow: 'var(--shadow-lg)', maxHeight: '250px', overflowY: 'auto', padding: '4px'
                      }}>
                        {stores.map(s => (
                          <button
                            key={s.id}
                            onClick={() => {
                              if (!s.hasTerminal) {
                                setSelectedStoreId(String(s.id));
                                setStorePickerOpen(false);
                                setError(null);
                              }
                            }}
                            disabled={s.hasTerminal}
                            style={{
                              width: '100%', padding: '10px 12px', border: 'none', borderRadius: 'var(--radius-sm)',
                              background: selectedStoreId === String(s.id) ? 'var(--primary-light)' : 'transparent',
                              cursor: s.hasTerminal ? 'not-allowed' : 'pointer', textAlign: 'left',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: s.hasTerminal ? 'var(--text-disabled)' : 'var(--text-primary)' }}>{s.name}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.companyName}</span>
                            </div>
                            <span style={{
                              fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                              background: s.hasTerminal ? 'rgba(21,128,61,0.1)' : 'rgba(100,116,139,0.1)',
                              color: s.hasTerminal ? 'var(--success)' : 'var(--text-muted)', textTransform: 'uppercase'
                            }}>
                              {s.hasTerminal ? t('terminals.terminalCreated') : t('terminals.terminalNotCreated')}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Constant Store Detail Fields */}
                <SectionDivider label={t('stores.detailsTitle')} />
                
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '18px' }}>
                  <div style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>{t('stores.colCompany')}</label>
                    <Input value={selectedStore?.companyName || (terminal?.companyName) || ''} readOnly disabled style={{ background: 'var(--surface-warm)', cursor: 'not-allowed' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>{t('stores.colCode')}</label>
                    <Input value={selectedStore?.code || ''} readOnly disabled style={{ background: 'var(--surface-warm)', cursor: 'not-allowed' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>{t('stores.fieldMaxStaff')}</label>
                    <Input value={selectedStore?.maxStaff !== undefined && selectedStore?.maxStaff !== null ? String(selectedStore.maxStaff) : ''} readOnly disabled style={{ background: 'var(--surface-warm)', cursor: 'not-allowed' }} />
                  </div>
                  <div style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>{t('stores.colAddress')}</label>
                    <Input value={selectedStore?.address || ''} readOnly disabled style={{ background: 'var(--surface-warm)', cursor: 'not-allowed' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>{t('stores.fieldCap')}</label>
                    <Input value={selectedStore?.cap || ''} readOnly disabled style={{ background: 'var(--surface-warm)', cursor: 'not-allowed' }} />
                  </div>
                </div>

                <SectionDivider label={t('terminals.terminalStep2')} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>{t('terminals.emailLabel')}</label>
                    <Input value={getTerminalEmail(selectedStore)} readOnly disabled style={{ background: 'var(--surface-warm)', cursor: 'not-allowed' }} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>{t('terminals.passwordLabel')}</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          placeholder={isEditMode ? '••••••••' : ''}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (e.target.value.length >= 8) setPasswordError(undefined);
                          }}
                          error={passwordError}
                          style={{ paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <Button variant="secondary" onClick={regeneratePassword} style={{ padding: '0 12px' }} title={t('common.generate')}>
                        <RefreshCw size={16} />
                      </Button>
                    </div>
                  </div>

                  {/* QR Code Section */}
                  {selectedStoreId && (
                    <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px', background: 'var(--surface-warm)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                      <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                        <QrCode size={14} />
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t('qr.title')} Preview
                        </span>
                      </div>
                      
                      <div style={{ padding: '12px', background: '#fff', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', opacity: loadingQr ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                        {loadingQr ? (
                          <div style={{ width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <RefreshCw size={24} className="animate-spin" color="var(--text-disabled)" />
                          </div>
                        ) : qrData ? (
                          <QRCode value={qrData.token} size={140} fgColor="var(--text-primary)" bgColor="#fff" level="M" />
                        ) : (
                          <div style={{ width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '10px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>QR not available</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface-warm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                {isEditMode && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDelete}
                    loading={loading}
                    style={{ border: confirmDelete ? '2px solid var(--danger)' : 'none' }}
                  >
                    <Trash2 size={16} style={{ marginRight: '8px' }} />
                    {confirmDelete ? t('common.confirm') : t('terminals.deleteTerminal')}
                  </Button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="secondary" onClick={onCancel} disabled={loading}>{t('common.cancel')}</Button>
                <Button onClick={handleSubmit} loading={loading}>
                  {isEditMode ? t('terminals.updateTerminal') : t('common.save')}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(21,128,61,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                <CheckCircle2 size={32} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>{t('terminals.terminalCreatedTitle')}</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '320px' }}>{t('terminals.terminalCreatedSubtitle')}</p>
              </div>

              <div style={{ width: '100%', background: 'var(--surface-warm)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px', fontWeight: 800 }}>
                    <StoreIcon size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{createdCredentials.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{createdCredentials.email}</div>
                  </div>
                </div>
                <div style={{ height: '1px', background: 'var(--border-light)' }} />
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>{t('employees.tempPasswordLabel')}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px' }}>
                    <KeyRound size={16} color="var(--accent)" />
                    <code style={{ flex: 1, fontFamily: 'monospace', fontSize: '16px', fontWeight: 700, letterSpacing: '0.05em' }}>{createdCredentials.password}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdCredentials.password);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      style={{ background: copied ? 'rgba(21,128,61,0.1)' : 'var(--accent-light)', border: 'none', borderRadius: '4px', padding: '6px 10px', fontSize: '12px', fontWeight: 600, color: copied ? 'var(--success)' : 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                      {copied ? t('employees.copied') : t('employees.copyPassword')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface-warm)', display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={onSuccess}>{t('common.close')}</Button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
