import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Users, Store, Plus, Pencil, PowerOff, Power, Trash2, Layers } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useAuth } from '../../context/AuthContext';
import { createCompany, getCompanies, updateCompany, deactivateCompany, activateCompany, deleteCompanyPermanent, uploadCompanyLogo } from '../../api/companies';
import { getCompanyGroups } from '../../api/companyGroups';
import { getCompanyLogoUrl } from '../../api/client';
import { translateApiError } from '../../utils/apiErrors';
import { Company } from '../../types';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';

type ModalMode = 'create' | 'edit';

const AVATAR_PALETTE = ['#0D2137', '#163352', '#8B6914', '#1B4D3E', '#2C5282', '#5B2333'];
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function StatBox({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
  return (
    <div style={{
      flex: 1,
      background: 'var(--surface-warm)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius)',
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <div style={{
        width: 34,
        height: 34,
        borderRadius: 'var(--radius-sm)',
        background: 'rgba(201,151,58,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: 'var(--accent)',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

export default function SystemCompanyManagement() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { isMobile } = useBreakpoint();
  const { user } = useAuth();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyGroups, setCompanyGroups] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  type ConfirmMode = 'deactivate' | 'activate' | 'delete';
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>('deactivate');
  const [confirmCompany, setConfirmCompany] = useState<Company | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);

  const [formName, setFormName] = useState('');
  const [formNameError, setFormNameError] = useState<string | undefined>();
  const [formGroupId, setFormGroupId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const locale = i18n.language?.startsWith('it') ? 'it-IT' : 'en-GB';

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCompanies();
      setCompanies(data);
    } catch {
      setError(t('companies.errorLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void (async () => {
      try {
        const groups = await getCompanyGroups();
        setCompanyGroups(groups);
      } catch {
        setCompanyGroups([]);
      }
    })();
  }, []);

  const openCreate = () => {
    setModalMode('create');
    setEditingCompanyId(null);
    setFormName('');
    setFormNameError(undefined);
    setFormGroupId(null);
    setFormError(null);
    setLogoError(null);
    setModalOpen(true);
  };

  const openEdit = (company: Company) => {
    setModalMode('edit');
    setEditingCompanyId(company.id);
    setFormName(company.name);
    setFormNameError(undefined);
    setFormGroupId(company.groupId ?? null);
    setFormError(null);
    setLogoError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormSaving(false);
    setFormError(null);
    setFormNameError(undefined);
    setLogoUploading(false);
    setLogoError(null);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || editingCompanyId === null) return;

    setLogoUploading(true);
    setLogoError(null);
    try {
      await uploadCompanyLogo(editingCompanyId, file);
      showToast(t('companies.logoUpdated'), 'success');
      await load();
    } catch (err: unknown) {
      setLogoError(translateApiError(err, t, t('companies.logoError')) ?? t('companies.logoError'));
    } finally {
      setLogoUploading(false);
      e.target.value = '';
    }
  };

  const openConfirm = (mode: ConfirmMode, company: Company) => {
    setConfirmMode(mode);
    setConfirmCompany(company);
    setConfirmError(null);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmCompany(null);
    setConfirmBusy(false);
    setConfirmError(null);
  };

  const handleConfirm = async () => {
    if (!confirmCompany) return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      if (confirmMode === 'deactivate') {
        await deactivateCompany(confirmCompany.id);
        showToast(t('companies.deactivatedSuccess'), 'success');
      } else if (confirmMode === 'activate') {
        await activateCompany(confirmCompany.id);
        showToast(t('companies.activatedSuccess'), 'success');
      } else {
        await deleteCompanyPermanent(confirmCompany.id);
        showToast(t('companies.deletedSuccess'), 'success');
      }
      closeConfirm();
      await load();
    } catch (err: unknown) {
      const msgKey = confirmMode === 'deactivate'
        ? 'companies.errorDeactivate'
        : confirmMode === 'activate' ? 'companies.errorActivate' : 'companies.errorDelete';
      setConfirmError(translateApiError(err, t, t(msgKey)) ?? t(msgKey));
    } finally {
      setConfirmBusy(false);
    }
  };

  const submit = async () => {
    if (!formName.trim()) { setFormNameError(t('companies.validationName')); return; }
    setFormSaving(true);
    setFormError(null);
    try {
      if (modalMode === 'create') {
        await createCompany({ name: formName.trim(), groupId: formGroupId });
        showToast(t('companies.createdSuccess'), 'success');
      } else {
        if (editingCompanyId === null) throw new Error('Missing company id');
        await updateCompany(editingCompanyId, { name: formName.trim(), groupId: formGroupId });
        showToast(t('companies.updatedSuccess'), 'success');
      }
      closeModal();
      await load();
    } catch (err: unknown) {
      setFormError(translateApiError(err, t, t('companies.errorSave')));
    } finally {
      setFormSaving(false);
    }
  };

  const activeCount = companies.filter((c) => c.isActive).length;
  const totalStores = companies.reduce((s, c) => s + c.storeCount, 0);
  const totalEmployees = companies.reduce((s, c) => s + c.employeeCount, 0);
  const editingCompany = editingCompanyId !== null ? companies.find((c) => c.id === editingCompanyId) ?? null : null;

  if (loading) {
    return (
      <div className="page-enter" style={{ width: '100%' }}>
        {[1, 2].map((i) => (
          <div key={i} style={{ height: 160, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', opacity: 0.5, marginBottom: 14 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-enter" style={{ width: '100%' }}>
        <Alert variant="danger" title={t('common.error')} onClose={() => setError(null)}>{error}</Alert>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 20 : 24, margin: 0, color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {t('nav.companies')}
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            {t('companies.systemSubtitle')}
          </p>
        </div>
        {user?.isSuperAdmin && (
          <Button variant="secondary" onClick={openCreate}>
            <Plus size={15} style={{ marginRight: 6 }} />
            {t('companies.new')}
          </Button>
        )}
      </div>

      {/* ── Summary strip ── */}
      {companies.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
          gap: 12,
        }}>
          {[
            { label: t('companies.statEmployees').replace('Attivi', '').replace('Active', ''), icon: <Building2 size={16} />, value: activeCount, sublabel: i18n.language?.startsWith('it') ? 'Aziende attive' : 'Active companies' },
            { label: '', icon: <Store size={16} />, value: totalStores, sublabel: t('companies.statStores') },
            { label: '', icon: <Users size={16} />, value: totalEmployees, sublabel: t('companies.statEmployees') },
          ].map((s, i) => (
            <div key={i} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 16px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius)',
                background: 'var(--accent-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
                flexShrink: 0,
              }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.03em' }}>
                  {s.value}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 3 }}>{s.sublabel}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Company cards ── */}
      {companies.length === 0 ? (
        <Alert variant="info" title={t('common.noData')}>{t('companies.errorLoad')}</Alert>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
          {companies.map((c) => {
            const avatarColor = getAvatarColor(c.name);
            const initials = getInitials(c.name);
            const groupName = companyGroups.find((g) => g.id === c.groupId)?.name;
            const createdDate = new Date(c.createdAt).toLocaleDateString(locale, { year: 'numeric', month: 'long' });
            const logoUrl = getCompanyLogoUrl(c.logoFilename);

            return (
              <div
                key={c.id}
                className="card-lift"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-sm)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: `3px solid ${c.isActive ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {/* Card header */}
                <div style={{ padding: '18px 20px 14px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {/* Avatar */}
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 'var(--radius)',
                    background: logoUrl ? 'transparent' : avatarColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 16,
                    flexShrink: 0,
                    letterSpacing: '0.02em',
                    overflow: 'hidden',
                  }}>
                    {logoUrl ? (
                      <img src={logoUrl} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : initials}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                      {c.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                      {c.isActive ? (
                        <Badge variant="success">{t('common.active')}</Badge>
                      ) : (
                        <Badge variant="danger">{t('common.inactive')}</Badge>
                      )}
                      {groupName && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--accent)',
                          background: 'var(--accent-light)',
                          padding: '2px 8px',
                          borderRadius: 4,
                          letterSpacing: '0.01em',
                        }}>
                          <Layers size={10} />
                          {groupName}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>{createdDate}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => openEdit(c)}
                      title={t('common.edit')}
                      style={{
                        width: 32, height: 32,
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-warm)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
                    >
                      <Pencil size={14} />
                    </button>
                    {user?.isSuperAdmin && (
                      <>
                        {c.isActive ? (
                          <button
                            onClick={() => openConfirm('deactivate', c)}
                            title={t('common.deactivate')}
                            style={{
                              width: 32, height: 32,
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--warning)',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(180,83,9,0.08)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)'; }}
                          >
                            <PowerOff size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => openConfirm('activate', c)}
                            title={t('common.activate')}
                            style={{
                              width: 32, height: 32,
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--success)',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(21,128,61,0.08)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)'; }}
                          >
                            <Power size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => openConfirm('delete', c)}
                          title={t('common.delete')}
                          style={{
                            width: 32, height: 32,
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--danger)',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,38,38,0.08)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)'; }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'var(--border-light)', margin: '0 20px' }} />

                {/* Stats */}
                <div style={{ padding: '14px 20px 18px', display: 'flex', gap: 10 }}>
                  <StatBox value={c.storeCount} label={t('companies.statStores')} icon={<Store size={16} />} />
                  <StatBox value={c.employeeCount} label={t('companies.statEmployees')} icon={<Users size={16} />} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={modalMode === 'create' ? t('companies.createCompany') : t('companies.editCompany')}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={formSaving}>{t('common.cancel')}</Button>
            <Button onClick={submit} loading={formSaving}>
              {modalMode === 'create' ? t('common.create') : t('common.save')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {formError && <Alert variant="danger" onClose={() => setFormError(null)}>{formError}</Alert>}
          <Input
            label={t('companies.fieldName')}
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            error={formNameError}
            placeholder={t('companies.placeholderName')}
            disabled={formSaving}
          />
          <Select
            label={t('companies.fieldGroup')}
            value={formGroupId ?? ''}
            onChange={(e) => { const raw = e.target.value; setFormGroupId(raw === '' ? null : parseInt(raw, 10)); }}
            disabled={formSaving}
          >
            <option value="">{t('companies.optionStandalone')}</option>
            {companyGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>

          {modalMode === 'edit' && editingCompany && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('companies.logoField')}
              </span>

              {logoError && <Alert variant="danger" onClose={() => setLogoError(null)}>{logoError}</Alert>}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  background: editingCompany.logoFilename ? 'transparent' : getAvatarColor(editingCompany.name),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 13,
                  flexShrink: 0,
                }}>
                  {editingCompany.logoFilename ? (
                    <img src={getCompanyLogoUrl(editingCompany.logoFilename) ?? ''} alt={editingCompany.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : getInitials(editingCompany.name)}
                </div>

                <input
                  id="company-logo-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleLogoUpload}
                  disabled={logoUploading || formSaving}
                />
                <label
                  htmlFor="company-logo-upload"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-warm)',
                    cursor: logoUploading || formSaving ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    opacity: logoUploading || formSaving ? 0.7 : 1,
                  }}
                >
                  {logoUploading ? t('companies.logoUploading') : t('companies.uploadLogo')}
                </label>
              </div>

              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('companies.logoHint')}</span>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Confirm Modal ── */}
      <Modal
        open={confirmOpen}
        onClose={closeConfirm}
        title={
          confirmMode === 'deactivate' ? t('companies.confirmDeactivateTitle')
            : confirmMode === 'activate' ? t('companies.confirmActivateTitle')
              : t('companies.confirmDeleteTitle')
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeConfirm} disabled={confirmBusy}>{t('common.cancel')}</Button>
            {confirmMode === 'activate' ? (
              <Button onClick={handleConfirm} loading={confirmBusy}>{t('common.activate')}</Button>
            ) : confirmMode === 'deactivate' ? (
              <Button variant="danger" onClick={handleConfirm} loading={confirmBusy}>{t('common.deactivate')}</Button>
            ) : (
              <Button variant="danger" onClick={handleConfirm} loading={confirmBusy}>{t('common.delete')}</Button>
            )}
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {confirmError && <Alert variant="danger" onClose={() => setConfirmError(null)}>{confirmError}</Alert>}
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>
            {confirmMode === 'deactivate' ? t('companies.confirmDeactivateMsg', { name: confirmCompany?.name ?? '' })
              : confirmMode === 'activate' ? t('companies.confirmActivateMsg', { name: confirmCompany?.name ?? '' })
                : t('companies.confirmDeleteMsg', { name: confirmCompany?.name ?? '' })}
          </p>
        </div>
      </Modal>
    </div>
  );
}
