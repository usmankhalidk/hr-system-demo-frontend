import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  uploadDocument,
  updateDocumentGeneric,
  DocumentCategory
} from '../../../api/documents';
import { getEmployees } from '../../../api/employees';
import { getCompanies } from '../../../api/companies';
import { Employee, Company } from '../../../types';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import { DatePicker } from '../../../components/ui/DatePicker';
import CustomSelect, { SelectOption } from '../../../components/ui/CustomSelect';
import { ModalBackdrop, ModalHeader, inputStyle, labelStyle, IconTag, IconPen, IconTrash } from './DocUtils';
import { getAvatarUrl } from '../../../api/client';

// ── Upload Document Modal ──────────────────────────────────────────────────

// ── Upload Document Modal ──────────────────────────────────────────────────

export const UploadModal: React.FC<{
  employeeId: number;
  employeeName: string;
  onClose: () => void;
  onSuccess: () => void
}> = ({ employeeId, employeeName, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      await uploadDocument(employeeId, file, { requiresSignature, expiresAt: expiresAt || null });
      showToast(t('documents.uploaded'), 'success');
      onSuccess(); onClose();
    } catch { showToast(t('documents.errorUpload'), 'error'); }
    finally { setUploading(false); }
  };

  return (
    <ModalBackdrop onClose={onClose} width={440}>
      <ModalHeader title={t('documents.uploadTitle')} onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '10px 14px', background: 'var(--background)', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }}>
            👤 {employeeName}
          </div>
          <div>
            <label style={labelStyle}>{t('documents.selectFile')}</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13, color: 'var(--text-primary)', width: '100%' }} />
          </div>
          <div>
            <label style={labelStyle}>{t('documents.expiresAtLabel')}</label>
            <DatePicker value={expiresAt} onChange={setExpiresAt} placement="top" />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
            <input type="checkbox" checked={requiresSignature} onChange={(e) => setRequiresSignature(e.target.checked)} />
            {t('documents.requiresSignatureLabel')}
          </label>
        </div>

        {/* Modal Footer Bar */}
        <div style={{
          padding: '12px 20px',
          background: 'var(--background)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 10,
          flexShrink: 0
        }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={uploading || !file} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: uploading || !file ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: uploading || !file ? 0.6 : 1, boxShadow: '0 2px 8px rgba(13,33,55,0.18)' }}>
            {uploading ? t('documents.uploading') : t('documents.uploadDoc')}
          </button>
        </div>
      </form>
    </ModalBackdrop>
  );
};

// ── Categories Modal ───────────────────────────────────────────────────────

export const CategoriesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { allowedCompanyIds } = useAuth();

  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState<DocumentCategory | null>(null);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [allCats, allComps] = await Promise.all([
        getCategories(true),
        getCompanies(),
      ]);

      setCategories(allCats);
      const filteredComps = allComps.filter(c => allowedCompanyIds.includes(c.id));
      setCompanies(filteredComps);

      if (filteredComps.length === 1 && !selectedCompanyId) {
        setSelectedCompanyId(filteredComps[0].id);
      }
    }
    catch { showToast(t('documents.errorLoad'), 'error'); }
    finally { if (showLoader) setLoading(false); }
  }, [allowedCompanyIds, selectedCompanyId, t, showToast]);

  useEffect(() => { load(true); }, []);

  const companyOptions = useMemo<SelectOption[]>(() => {
    return [
      { value: '', label: t('documents.selectCompany', 'Select Company...') },
      ...companies.map(c => ({
        value: String(c.id),
        label: c.name
      }))
    ];
  }, [companies, t]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !selectedCompanyId) return;
    setSaving(true);
    try {
      await createCategory(newName.trim(), selectedCompanyId);
      setNewName('');
      showToast(t('documents.categoryCreated'), 'success');
      await load(false);
    }
    catch { showToast(t('common.error'), 'error'); }
    finally { setSaving(false); }
  };

  const handleRename = async (cat: DocumentCategory) => {
    if (!editName.trim() || editName.trim() === cat.name) { setEditId(null); return; }
    try {
      await updateCategory(cat.id, { name: editName.trim(), companyId: cat.companyId, currentCompanyId: cat.companyId });
      showToast(t('documents.categoryUpdated'), 'success');
      setEditId(null);
      await load(false);
    }
    catch { showToast(t('common.error'), 'error'); }
  };

  const handleToggle = async (cat: DocumentCategory) => {
    try {
      await updateCategory(cat.id, { isActive: !cat.isActive, companyId: cat.companyId, currentCompanyId: cat.companyId });
      showToast(t('documents.categoryUpdated'), 'success');
      await load(false);
    }
    catch { showToast(t('common.error'), 'error'); }
  };

  const handleDelete = (cat: DocumentCategory) => {
    setCategoryToDelete(cat);
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;
    try {
      await deleteCategory(categoryToDelete.id, categoryToDelete.companyId);
      showToast(t('documents.categoryDeleted'), 'success');
      await load(false);
    } catch (error) {
      console.error('Delete category failed:', error);
      showToast(t('common.error'), 'error');
    }
    finally {
      setCategoryToDelete(null);
    }
  };

  const filteredCategories = categories.filter(c => {
    if (showInactive ? c.isActive : !c.isActive) return false;
    if (selectedCompanyId !== null) {
      if (c.companyId !== selectedCompanyId) return false;
    }
    return true;
  });

  return (
    <>
      <ModalBackdrop onClose={onClose} width={580}>
        <ModalHeader title={t('documents.categoriesTitle')} onClose={onClose} />

        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>{t('documents.categoryName')}</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('documents.categoryNamePlaceholder')} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t('documents.companyLabel')}</label>
              <CustomSelect
                options={companyOptions}
                value={selectedCompanyId ? String(selectedCompanyId) : ''}
                onChange={(val) => setSelectedCompanyId(val ? Number(val) : null)}
                placeholder={t('documents.selectCompany')}
                isClearable={false}
              />
            </div>
            <button type="submit" disabled={saving || !newName.trim() || !selectedCompanyId} style={{ width: '100%', padding: '9px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: (saving || !newName.trim() || !selectedCompanyId) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: (saving || !newName.trim() || !selectedCompanyId) ? 0.6 : 1, marginTop: 4, boxShadow: '0 2px 8px rgba(13,33,55,0.18)' }}>
              {saving ? '...' : `+ ${t('documents.newCategory')}`}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              {t('documents.showInactive')}
            </label>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{filteredCategories.length} {t('documents.categoriesCount')}</span>
          </div>

          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {loading ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredCategories.map(cat => (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <IconTag />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editId === cat.id ? (
                        <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onBlur={() => handleRename(cat)} onKeyDown={(e) => { if (e.key === 'Enter') handleRename(cat); if (e.key === 'Escape') setEditId(null); }} style={inputStyle} />
                      ) : (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{cat.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{companies.find(c => c.id === cat.companyId)?.name}</div>
                        </>
                      )}
                    </div>
                    <button onClick={() => { setEditId(cat.id); setEditName(cat.name); }} title={t('common.edit')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><IconPen /></button>
                    <button onClick={() => handleDelete(cat)} title={t('common.delete')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}><IconTrash /></button>
                    <button onClick={() => handleToggle(cat)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>{cat.isActive ? t('common.deactivate') : t('common.activate')}</button>
                  </div>
                ))}
                {filteredCategories.length === 0 && (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    {t('documents.noCategories', 'No categories found')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </ModalBackdrop>
      <ConfirmModal open={!!categoryToDelete} title={t('common.delete')} message={t('documents.deleteCategoryConfirm')} onConfirm={confirmDelete} onCancel={() => setCategoryToDelete(null)} variant="danger" />
    </>
  );
};

// ── Edit Document Modal ────────────────────────────────────────────────────

export const EditDocumentModal: React.FC<{ doc: any; onClose: () => void; onSuccess: () => void }> = ({ doc, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(true);

  const fileName = doc.fileName || doc.title || '';
  const lastDot = fileName.lastIndexOf('.');
  const initialTitle = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
  const extension = lastDot > 0 ? fileName.substring(lastDot) : '';

  const [title, setTitle] = useState(initialTitle);
  const [employeeId, setEmployeeId] = useState<number | null>(doc.employeeId || doc.employee_id || null);
  const getInitialExpiry = (val: any) => {
    if (!val) return '';
    try {
      const date = new Date(val);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };
  const [expiresAt, setExpiresAt] = useState<string>(() => getInitialExpiry(doc.expiresAt || doc.expires_at));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoadingEmps(true);
    getEmployees({ status: 'active', excludeAdmins: true, limit: 1000 })
      .then(res => setEmployees(res.employees))
      .catch(() => showToast(t('employees.errorLoad'), 'error'))
      .finally(() => setLoadingEmps(false));
  }, [t, showToast]);

  const employeeOptions = useMemo<SelectOption[]>(() => {
    const unassignedOption: SelectOption = {
      value: '',
      label: t('documents.unassigned', 'Unassigned'),
      render: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(201,151,58,0.15)', color: '#C9973A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 11, flexShrink: 0
          }}>
            ⚠
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#C9973A' }}>
              {t('documents.unassigned', 'Unassigned')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {t('documents.unassignedDesc', 'No employee assigned')}
            </div>
          </div>
        </div>
      )
    };

    const list = employees.map(emp => {
      const fullName = `${emp.name || ''} ${emp.surname || ''}`.trim();
      const avatarUrl = emp.avatarFilename ? getAvatarUrl(emp.avatarFilename) : null;
      const initials = `${(emp.name || '')[0] || ''}${(emp.surname || '')[0] || ''}`.toUpperCase() || 'U';

      return {
        value: String(emp.id),
        label: fullName,
        render: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0' }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={fullName} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--primary)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 10, flexShrink: 0
              }}>
                {initials}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName}</span>
                {emp.uniqueId && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'var(--background)', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {emp.uniqueId}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {emp.role ? emp.role : ''}{emp.companyName ? ` · ${emp.companyName}` : ''}
              </div>
            </div>
          </div>
        )
      };
    });

    return [unassignedOption, ...list];
  }, [employees, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await updateDocumentGeneric(doc.id, {
        title: `${title}${extension}`,
        employee_id: employeeId,
        expires_at: expiresAt || null
      });
      showToast(t('documents.categoryUpdated'), 'success');
      onSuccess(); onClose();
    } catch { showToast(t('common.error'), 'error'); }
    finally { setSaving(false); }
  };

  return (
    <ModalBackdrop onClose={onClose} width={460}>
      <ModalHeader title={t('documents.editDocument', 'Edit Document')} onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div>
            <label style={labelStyle}>{t('documents.fileName')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...inputStyle, flex: 1 }} required />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', padding: '0 4px' }}>{extension}</span>
            </div>
          </div>
          <div>
            <label style={labelStyle}>{t('documents.assigned')}</label>
            <CustomSelect
              value={employeeId ? String(employeeId) : ''}
              onChange={(val) => setEmployeeId(val ? Number(val) : null)}
              options={employeeOptions}
              placeholder={t('documents.selectEmployee', 'Select Employee...')}
              disabled={loadingEmps}
              isClearable={true}
              searchable={true}
              menuMaxHeight={240}
            />
          </div>
          <div>
            <label style={labelStyle}>{t('documents.expiresAtLabel')}</label>
            <DatePicker value={expiresAt} onChange={setExpiresAt} placement="bottom" />
          </div>
        </div>

        {/* Modal Footer Bar */}
        <div style={{
          padding: '12px 20px',
          background: 'var(--background)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 10,
          flexShrink: 0
        }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{t('common.cancel')}</button>
          <button type="submit" disabled={saving || !title.trim()} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: (saving || !title.trim()) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: (saving || !title.trim()) ? 0.6 : 1, boxShadow: '0 2px 8px rgba(13,33,55,0.18)' }}>{saving ? '...' : t('common.save')}</button>
        </div>
      </form>
    </ModalBackdrop>
  );
};

