import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useToast } from '../../context/ToastContext';
import { getStores, createStore, updateStore, deactivateStore, activateStore, deleteStorePermanent } from '../../api/stores';
import { getCompanies } from '../../api/companies';
import { getCompanyLogoUrl } from '../../api/client';
import { translateApiError } from '../../utils/apiErrors';
import { Company, Store } from '../../types';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import { Select } from '../../components/ui/Select';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';

interface StoreFormData {
  name: string;
  code: string;
  address: string;
  cap: string;
  maxStaff: string;
}

const emptyForm: StoreFormData = {
  name: '',
  code: '',
  address: '',
  cap: '',
  maxStaff: '',
};

interface FormErrors {
  name?: string;
  code?: string;
  companyId?: string;
}

// Words to skip when deriving a store code from the name
const SKIP_WORDS = new Set([
  'negozio', 'store', 'shop', 'il', 'la', 'lo', 'le', 'gli', 'i',
  'di', 'del', 'della', 'dei', 'delle', 'degli', 'the', 'a', 'an',
]);

function generateStoreCode(name: string, existingCodes: string[]): string {
  const words = name.trim().split(/\s+/);
  const meaningful = words.find((w) => {
    const clean = w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return clean.length >= 2 && !SKIP_WORDS.has(clean);
  });
  if (!meaningful) return '';

  const prefix = meaningful
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 3)
    .toUpperCase();

  if (prefix.length < 2) return '';

  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const nums = existingCodes
    .map((c) => { const m = c.match(pattern); return m ? parseInt(m[1], 10) : NaN; })
    .filter((n) => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${String(next).padStart(2, '0')}`;
}

const COMPANY_AVATAR_PALETTE = ['#0D2137', '#163352', '#8B6914', '#1B4D3E', '#2C5282', '#5B2333'];

function getCompanyAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COMPANY_AVATAR_PALETTE[Math.abs(hash) % COMPANY_AVATAR_PALETTE.length];
}

function getCompanyInitials(name?: string): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function toStoreSlug(store: Store): string {
  const base = store.name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${store.id}-${base || 'store'}`;
}

export function StoreList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { isMobile } = useBreakpoint();
  const isAdmin = user?.role === 'admin';
  const isAdminOrHr = user?.role === 'admin' || user?.role === 'hr';
  const isSuperAdmin = user?.isSuperAdmin === true;

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [formCompanyId, setFormCompanyId] = useState<number | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState<StoreFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [terminalPassword, setTerminalPassword] = useState('');
  const [terminalPasswordVisible, setTerminalPasswordVisible] = useState(false);
  const [terminalPasswordError, setTerminalPasswordError] = useState<string | null>(null);
  // true while the code field shows an auto-suggested value (new form only)
  const codeIsAuto = useRef(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deactivatingStore, setDeactivatingStore] = useState<Store | null>(null);
  const [deactivateInput, setDeactivateInput] = useState('');
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const [activateOpen, setActivateOpen] = useState(false);
  const [activatingStore, setActivatingStore] = useState<Store | null>(null);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingStore, setDeletingStore] = useState<Store | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);

  const loadStores = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStores();
      setStores(data);
    } catch {
      setError(t('stores.errorLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
  }, []);

  // Load companies for any admin/HR so grouped users can pick a target company
  useEffect(() => {
    if (!isAdminOrHr) return;
    setCompaniesLoading(true);
    getCompanies()
      .then(setCompanies)
      .catch(() => setCompanies([]))
      .finally(() => setCompaniesLoading(false));
  }, [isAdminOrHr]);

  const openNewForm = () => {
    setEditingStore(null);
    setFormData(emptyForm);
    setFormErrors({});
    setFormError(null);
    // Super-admin has no default company; require explicit selection.
    // Grouped admin/hr default to their own company.
    setFormCompanyId(isSuperAdmin ? null : (user?.companyId ?? null));
    codeIsAuto.current = true;
    setFormStep(1);
    setTerminalPassword('');
    setTerminalPasswordVisible(false);
    setTerminalPasswordError(null);
    setFormOpen(true);
  };

  const openEditForm = (store: Store) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      code: store.code,
      address: store.address ?? '',
      cap: store.cap ?? '',
      maxStaff: store.maxStaff != null ? String(store.maxStaff) : '',
    });
    setFormErrors({});
    setFormError(null);
    codeIsAuto.current = false;
    setFormStep(1);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormStep(1);
    setEditingStore(null);
    setFormData(emptyForm);
    setFormErrors({});
    setFormError(null);
    setTerminalPasswordError(null);
    codeIsAuto.current = false;
    setFormCompanyId(null);
  };

  // Show company selector when multiple companies are available (grouped admin/HR + super admin)
  const showCompanyPicker = companies.length > 1;

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!formData.name.trim()) errors.name = t('stores.validationName');
    if (!formData.code.trim()) errors.code = t('stores.validationCode');
    if (showCompanyPicker && !editingStore && !formCompanyId) errors.companyId = t('stores.validationCompany');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let newPassword = '';
    for (let i = 0; i < 12; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTerminalPassword(newPassword);
    setTerminalPasswordError(null);
  };

  const getTerminalEmail = () => {
    const storeName = formData.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    let companyName = '';
    if (formCompanyId) {
      companyName = companies.find((c) => c.id === formCompanyId)?.name || 'company';
    } else {
      companyName = companies[0]?.name || 'company';
    }
    companyName = companyName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${storeName || 'store'}@${companyName}.com`;
  };

  const validateTerminal = (): boolean => {
    if (!terminalPassword || terminalPassword.length < 8) {
      setTerminalPasswordError('Password must be at least 8 characters');
      return false;
    }
    setTerminalPasswordError(null);
    return true;
  };

  const handleNext = () => {
    if (!validateForm()) return;
    if (!terminalPassword) {
      // Auto-generate and reveal the password so user can note it down
      generatePassword();
      setTerminalPasswordVisible(true);
    }
    setFormStep(2);
  };

  const handleSkipClick = () => {
    setSkipConfirmOpen(true);
  };

  const handleConfirmSkip = () => {
    setSkipConfirmOpen(false);
    handleSave(true);
  };
  const handleSave = async (skipTerminal: boolean = false) => {
    if (editingStore) {
      if (!validateForm()) return;
    } else if (!skipTerminal) {
      if (!validateTerminal()) return;
    }
    setFormSaving(true);
    setFormError(null);
    try {
      const payload: Partial<Store> = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        address: formData.address.trim() || null,
        cap: formData.cap.trim() || null,
        maxStaff: formData.maxStaff ? parseInt(formData.maxStaff, 10) : 0,
      };

      // Cross-company store creation: send the target company
      if (showCompanyPicker && !editingStore && formCompanyId != null) {
        payload.companyId = formCompanyId;
      }
      if (editingStore) {
        await updateStore(editingStore.id, payload);
        showToast(t('stores.updatedSuccess'), 'success');
      } else {
        const terminalPayload = skipTerminal
          ? undefined
          : { email: getTerminalEmail(), password: terminalPassword };

        if (!skipTerminal && !terminalPassword) {
          setFormError('Terminal password is required');
          setFormSaving(false);
          return;
        }

        await createStore({
          ...payload,
          terminal: terminalPayload
        });
        showToast(t('stores.createdSuccess'), 'success');
      }
      closeForm();
      await loadStores();
    } catch (err: unknown) {
      setFormError(translateApiError(err, t, t('stores.errorSave')));
    } finally {
      setFormSaving(false);
    }
  };

  const openDelete = (store: Store) => {
    setDeletingStore(store);
    setDeleteError(null);
    setDeleteOpen(true);
  };

  const closeDelete = () => {
    setDeleteOpen(false);
    setDeletingStore(null);
    setDeleteError(null);
  };

  const handleDeletePermanent = async () => {
    if (!deletingStore) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteStorePermanent(deletingStore.id);
      showToast(t('stores.deletedSuccess'), 'success');
      closeDelete();
      await loadStores();
    } catch (err: unknown) {
      setDeleteError(translateApiError(err, t, t('stores.errorDelete')));
    } finally {
      setDeleting(false);
    }
  };

  const openActivate = (store: Store) => {
    setActivatingStore(store);
    setActivateError(null);
    setActivateOpen(true);
  };

  const closeActivate = () => {
    setActivateOpen(false);
    setActivatingStore(null);
    setActivateError(null);
  };

  const handleActivate = async () => {
    if (!activatingStore) return;
    setActivating(true);
    setActivateError(null);
    try {
      await activateStore(activatingStore.id);
      showToast(t('stores.activatedSuccess'), 'success');
      closeActivate();
      await loadStores();
    } catch (err: unknown) {
      setActivateError(translateApiError(err, t, t('stores.errorActivate')));
    } finally {
      setActivating(false);
    }
  };

  const openConfirm = (store: Store) => {
    setDeactivatingStore(store);
    setDeactivateInput('');
    setDeactivateError(null);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setDeactivatingStore(null);
    setDeactivateInput('');
    setDeactivateError(null);
  };

  const handleDeactivate = async () => {
    if (!deactivatingStore) return;
    if (deactivateInput.trim() !== deactivatingStore.name) {
      setDeactivateError(t('stores.deactivateNameError', 'Type the exact store name to confirm deactivation.'));
      return;
    }
    setDeactivating(true);
    setDeactivateError(null);
    try {
      await deactivateStore(deactivatingStore.id);
      showToast(t('stores.deactivatedSuccess'), 'success');
      closeConfirm();
      await loadStores();
    } catch (err: unknown) {
      setDeactivateError(translateApiError(err, t, t('stores.errorDeactivate')));
    } finally {
      setDeactivating(false);
    }
  };

  const columns: Column<Store>[] = [
    ...(isSuperAdmin || stores.some((s) => !!s.companyName) ? [{
      key: 'companyName' as keyof Store,
      label: t('stores.colCompany'),
      render: (row: Store) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            overflow: 'hidden',
            background: row.companyName ? getCompanyAvatarColor(row.companyName) : 'var(--border)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {row.companyLogoFilename ? (
              <img
                src={getCompanyLogoUrl(row.companyLogoFilename) ?? ''}
                alt={row.companyName ?? 'Company'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              getCompanyInitials(row.companyName)
            )}
          </div>
          <span
            style={{
              fontSize: '13px',
              color: row.companyName ? 'var(--text-secondary)' : 'var(--text-disabled)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={row.companyName ?? undefined}
          >
            {row.companyName ?? '—'}
          </span>
        </div>
      ),
    }] : []),
    { key: 'name', label: t('stores.colName') },
    { key: 'code', label: t('stores.colCode') },
    { key: 'address', label: t('stores.colAddress'), render: (row) => row.address ?? '—' },
    { key: 'cap', label: t('stores.colCap'), render: (row) => row.cap ?? '—' },
    { key: 'maxStaff', label: t('stores.colMaxStaff'), render: (row) => String(row.maxStaff) },
    { key: 'employeeCount', label: t('stores.colEmployees'), render: (row) => String(row.employeeCount ?? 0) },
    {
      key: 'isActive',
      label: t('stores.colStatus'),
      render: (row) =>
        row.isActive ? (
          <Badge variant="success">{t('common.active')}</Badge>
        ) : (
          <Badge variant="danger">{t('common.inactive')}</Badge>
        ),
    },
    {
      key: 'actions',
      label: t('stores.colActions'),
      render: (row) => {
        return (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => navigate(`/negozi/${toStoreSlug(row)}`)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600, color: 'var(--accent)',
                fontFamily: 'var(--font-body)', padding: '5px 10px',
                borderRadius: 'var(--radius-sm)', display: 'inline-flex',
                alignItems: 'center', gap: '3px', whiteSpace: 'nowrap',
              }}
            >
              {t('common.open')} →
            </button>
            {!row.isActive && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
                {t('common.inactive')}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="page-enter" style={{ width: '100%' }}>
      <div style={{
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            margin: '0 0 3px',
            letterSpacing: '-0.02em',
          }}>
            {t('stores.title')}
          </h1>
          {!loading && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              {stores.length > 0
                ? t('common.showingResults', { from: 1, to: stores.length, total: stores.length })
                : t('common.noData')}
            </p>
          )}
        </div>
        {isAdminOrHr && (
          <Button onClick={openNewForm}>{t('stores.newStore')}</Button>
        )}
      </div>

      {error && (
        <div style={{ marginBottom: '16px' }}>
          <Alert variant="danger" title={t('common.error')} onClose={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      <Table<Store>
        columns={columns}
        data={stores}
        loading={loading}
        emptyText={t('stores.noStores')}
      />

      {/* Create / Edit Modal */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editingStore ? t('stores.editStore') : (formStep === 1 ? t('stores.newStore') : 'Store Terminal')}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={formSaving}>
              {t('common.cancel')}
            </Button>
            {editingStore ? (
              <Button onClick={() => handleSave()} loading={formSaving}>
                {t('common.save')}
              </Button>
            ) : formStep === 1 ? (
              <Button onClick={() => handleNext()}>
                {t('common.next')}
              </Button>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="secondary" onClick={() => handleSkipClick()} disabled={formSaving}>
                  {t('stores.skipTerminal')}
                </Button>
                <Button onClick={() => handleSave()} loading={formSaving}>
                  {t('common.save')}
                </Button>
              </div>
            )}
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && (
            <Alert variant="danger" onClose={() => setFormError(null)}>
              {formError}
            </Alert>
          )}

          {(!editingStore && formStep === 2) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {t('stores.terminalDescription', "It's the terminal that employees use to scan QR codes from their mobile devices.")}
              </div>
              
              <Input
                label="Terminal Email"
                value={getTerminalEmail()}
                readOnly
                onChange={() => {}} // noop to avoid react warnings
                style={{ backgroundColor: 'var(--surface-50)' }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Temporary password *
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Input
                      type={terminalPasswordVisible ? 'text' : 'password'}
                      value={terminalPassword}
                      onChange={(e) => {
                        setTerminalPassword(e.target.value);
                        if (terminalPasswordError) setTerminalPasswordError(null);
                      }}
                      placeholder="Enter password..."
                      style={{
                        paddingRight: '40px',
                        borderColor: terminalPasswordError ? '#DC2626' : undefined,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setTerminalPasswordVisible(!terminalPasswordVisible)}
                      style={{
                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                        padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      {terminalPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Button variant="secondary" onClick={() => { generatePassword(); setTerminalPasswordVisible(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={14} /> Generate
                  </Button>
                </div>
                {terminalPasswordError ? (
                  <p style={{ margin: 0, fontSize: '12px', color: '#DC2626', fontWeight: 600 }}>
                    {terminalPasswordError}
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                    {t('users.passwordHint', 'At least 8 characters. Save it — it will not be shown again.')}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {showCompanyPicker && !editingStore && (
            <div>
              <Select
                label={t('stores.fieldCompany')}
                value={formCompanyId ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  setFormCompanyId(raw ? parseInt(raw, 10) : null);
                }}
                disabled={formSaving || companiesLoading}
              >
                <option value="">{t('stores.placeholderCompany')}</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {formErrors.companyId && (
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#DC2626', fontWeight: 600 }}>
                  {formErrors.companyId}
                </p>
              )}
            </div>
          )}
          <Input
            label={t('stores.fieldName')}
            value={formData.name}
            onChange={(e) => {
              const name = e.target.value;
              setFormData((prev) => {
                if (codeIsAuto.current) {
                  const existingCodes = stores
                    .filter((s) => !editingStore || s.id !== editingStore.id)
                    .map((s) => s.code);
                  const suggested = generateStoreCode(name, existingCodes);
                  return { ...prev, name, code: suggested };
                }
                return { ...prev, name };
              });
            }}
            error={formErrors.name}
            placeholder={t('stores.placeholderName')}
          />
          <div>
            <Input
              label={t('stores.fieldCode')}
              value={formData.code}
              onChange={(e) => {
                codeIsAuto.current = false;
                setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }));
              }}
              error={formErrors.code}
              placeholder={t('stores.placeholderCode')}
            />
            {codeIsAuto.current && formData.code && (
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                {t('stores.codeAutoHint')}
              </p>
            )}
          </div>
          <Input
            label={t('stores.fieldAddress')}
            value={formData.address}
            onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
            placeholder={t('stores.placeholderAddress')}
          />
          <Input
            label={t('stores.fieldCap')}
            value={formData.cap}
            onChange={(e) => setFormData((prev) => ({ ...prev, cap: e.target.value }))}
            placeholder={t('stores.placeholderCap')}
          />
          <Input
            label={t('stores.fieldMaxStaff')}
            type="number"
            min="0"
            value={formData.maxStaff}
            onChange={(e) => setFormData((prev) => ({ ...prev, maxStaff: e.target.value }))}
            placeholder={t('stores.placeholderMaxStaff')}
          />
          </>
          )}
        </div>
      </Modal>

      {/* Confirm Deactivate Modal */}
      <Modal
        open={confirmOpen}
        onClose={closeConfirm}
        title={t('stores.confirmDeactivate')}
        footer={
          <>
            <Button variant="secondary" onClick={closeConfirm} disabled={deactivating}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDeactivate} loading={deactivating} disabled={deactivateInput.trim() !== (deactivatingStore?.name ?? '')}>
              {t('common.deactivate')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {deactivateError && (
            <Alert variant="danger" onClose={() => setDeactivateError(null)}>
              {deactivateError}
            </Alert>
          )}
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>
            {t('stores.confirmDeactivateMsg', { name: deactivatingStore?.name ?? '' })}
          </p>
          <Input
            label={t('stores.typeNameToDeactivate', 'Type the exact store name to deactivate')}
            value={deactivateInput}
            onChange={(event) => setDeactivateInput(event.target.value)}
            placeholder={deactivatingStore?.name ?? ''}
            disabled={deactivating}
          />
          <div style={{ fontSize: 12, color: deactivateInput.trim() === (deactivatingStore?.name ?? '') ? '#166534' : 'var(--text-muted)' }}>
            {deactivateInput.trim() === (deactivatingStore?.name ?? '')
              ? t('stores.deactivateNameMatched', 'Name matches. Deactivation is enabled.')
              : t('stores.deactivateNameMismatch', 'Name must match exactly to deactivate.')}
          </div>
        </div>
      </Modal>

      {/* Activate Modal */}
      <Modal
        open={activateOpen}
        onClose={closeActivate}
        title={t('stores.confirmActivate')}
        footer={
          <>
            <Button variant="secondary" onClick={closeActivate} disabled={activating}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleActivate} loading={activating}>
              {t('common.activate')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {activateError && (
            <Alert variant="danger" onClose={() => setActivateError(null)}>
              {activateError}
            </Alert>
          )}
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>
            {t('stores.confirmActivateMsg', { name: activatingStore?.name ?? '' })}
          </p>
        </div>
      </Modal>

      {/* Permanent Delete Modal */}
      <Modal
        open={deleteOpen}
        onClose={closeDelete}
        title={t('stores.confirmDeleteTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={closeDelete} disabled={deleting}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDeletePermanent} loading={deleting}>
              {t('stores.confirmDeleteBtn')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {deleteError && (
            <Alert variant="danger" onClose={() => setDeleteError(null)}>
              {deleteError}
            </Alert>
          )}
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>
            {t('stores.confirmDeleteMsg', { name: deletingStore?.name ?? '' })}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--warning)', fontWeight: 500 }}>
            {t('stores.confirmDeleteWarning')}
          </p>
        </div>
      </Modal>

      {/* Skip Terminal Confirmation Modal */}
      <Modal
        open={skipConfirmOpen}
        onClose={() => setSkipConfirmOpen(false)}
        title={t('stores.skipTerminalConfirmTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSkipConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleConfirmSkip}>
              {t('common.confirm')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>
            {t('stores.skipTerminalConfirmMsg')}
          </p>
        </div>
      </Modal>
    </div>
  );
}

export default StoreList;
