import React, { useState, useEffect, useCallback } from 'react';
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
import { ModalBackdrop, ModalHeader, inputStyle, labelStyle, IconTag, IconPen, IconTrash } from './DocUtils';

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
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, padding: '6px 10px', background: 'var(--background)', borderRadius: 6 }}>
        {employeeName}
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>{t('documents.selectFile')}</label>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13, color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label style={labelStyle}>{t('documents.expiresAtLabel')}</label>
          <DatePicker value={expiresAt} onChange={setExpiresAt} placement="top" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
          <input type="checkbox" checked={requiresSignature} onChange={(e) => setRequiresSignature(e.target.checked)} />
          {t('documents.requiresSignatureLabel')}
        </label>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={uploading || !file} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: '#fff', cursor: uploading || !file ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: uploading || !file ? 0.6 : 1 }}>
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

  const load = useCallback(async () => {
    setLoading(true);
    try { 
      const [allCats, allComps] = await Promise.all([
        getCategories(true),
        getCompanies(),
      ]);

      setCategories(allCats);
      const filteredComps = allComps.filter(c => allowedCompanyIds.includes(c.id));
      setCompanies(filteredComps);

      if (filteredComps.length === 1) {
        setSelectedCompanyId(filteredComps[0].id);
      }
    }
    catch { showToast(t('documents.errorLoad'), 'error'); }
    finally { setLoading(false); }
  }, [allowedCompanyIds, t, showToast]);

  useEffect(() => { load(); }, [load]);

  const companiesWithoutCategory = companies.filter(
    (c) => !categories.some((cat) => cat.companyId === c.id)
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCompanyId = companiesWithoutCategory.length === 1 ? companiesWithoutCategory[0].id : selectedCompanyId;
    if (!newName.trim() || !targetCompanyId) return;
    const exists = categories.some(c => c.companyId === targetCompanyId);
    if (exists) {
      showToast(t('documents.oneCategoryPerCompany'), 'error');
      return;
    }
    setSaving(true);
    try { 
      await createCategory(newName.trim(), targetCompanyId); 
      setNewName(''); 
      showToast(t('documents.categoryCreated'), 'success'); 
      await load(); 
    }
    catch { showToast(t('common.error'), 'error'); }
    finally { setSaving(false); }
  };

  const handleRename = async (cat: DocumentCategory) => {
    if (!editName.trim() || editName.trim() === cat.name) { setEditId(null); return; }
    try { await updateCategory(cat.id, { name: editName.trim(), companyId: cat.companyId, currentCompanyId: cat.companyId }); showToast(t('documents.categoryUpdated'), 'success'); setEditId(null); await load(); }
    catch { showToast(t('common.error'), 'error'); }
  };

  const handleToggle = async (cat: DocumentCategory) => {
    try { 
      await updateCategory(cat.id, { isActive: !cat.isActive, companyId: cat.companyId, currentCompanyId: cat.companyId }); 
      showToast(t('documents.categoryUpdated'), 'success'); 
      await load(); 
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
      await load();
    } catch (error) { 
      console.error('Delete category failed:', error);
      showToast(t('common.error'), 'error'); 
    } 
    finally {
      setCategoryToDelete(null);
    }
  };

  const filteredCategories = showInactive 
    ? categories.filter(c => !c.isActive)
    : categories.filter(c => c.isActive);

  return (
    <>
      <ModalBackdrop onClose={onClose} width={480}>
        <ModalHeader title={t('documents.categoriesTitle')} onClose={onClose} />
        {companiesWithoutCategory.length > 0 ? (
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('documents.categoryName')}</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('documents.categoryNamePlaceholder')} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('documents.companyLabel')}</label>
              <select value={selectedCompanyId || ''} onChange={(e) => setSelectedCompanyId(Number(e.target.value))} style={inputStyle}>
                <option value="">{t('documents.selectCompany')}</option>
                {companiesWithoutCategory.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button type="submit" disabled={saving || !newName.trim() || (!selectedCompanyId && companiesWithoutCategory.length > 1)} style={{ width: '100%', padding: '11px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: (saving || !newName.trim() || (!selectedCompanyId && companiesWithoutCategory.length > 1)) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: (saving || !newName.trim() || (!selectedCompanyId && companiesWithoutCategory.length > 1)) ? 0.6 : 1, marginTop: 4 }}>
              {saving ? '...' : `+ ${t('documents.newCategory')}`}
            </button>
          </form>
        ) : (
          <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--background)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' }}>
            {t('documents.allCompaniesHaveCategory')}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            {t('documents.showInactive')}
          </label>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{filteredCategories.length} {t('documents.categoriesCount')}</span>
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {loading ? <div>Loading...</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredCategories.map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <IconTag />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {editId === cat.id ? (
                      <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onBlur={() => handleRename(cat)} onKeyDown={(e) => { if (e.key === 'Enter') handleRename(cat); if (e.key === 'Escape') setEditId(null); }} style={inputStyle} />
                    ) : (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden' }}>{cat.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{companies.find(c => c.id === cat.companyId)?.name}</div>
                      </>
                    )}
                  </div>
                  <button onClick={() => { setEditId(cat.id); setEditName(cat.name); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><IconPen /></button>
                  <button onClick={() => handleDelete(cat)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><IconTrash /></button>
                  <button onClick={() => handleToggle(cat)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', cursor: 'pointer' }}>{cat.isActive ? t('common.deactivate') : t('common.activate')}</button>
                </div>
              ))}
            </div>
          )}
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoadingEmps(true);
    getEmployees({ status: 'active', excludeAdmins: true, limit: 1000 })
      .then(res => setEmployees(res.employees))
      .catch(() => showToast(t('employees.errorLoad'), 'error'))
      .finally(() => setLoadingEmps(false));
  }, [t, showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await updateDocumentGeneric(doc.id, { title: `${title}${extension}`, employee_id: employeeId });
      showToast(t('documents.categoryUpdated'), 'success');
      onSuccess(); onClose();
    } catch { showToast(t('common.error'), 'error'); }
    finally { setSaving(false); }
  };

  return (
    <ModalBackdrop onClose={onClose} width={440}>
      <ModalHeader title={t('documents.editDocument', 'Edit Document')} onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>{t('documents.fileName')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...inputStyle, flex: 1 }} required />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{extension}</span>
          </div>
        </div>
        <div>
          <label style={labelStyle}>{t('documents.assigned')}</label>
          <select value={employeeId || ''} onChange={(e) => setEmployeeId(e.target.value ? Number(e.target.value) : null)} style={inputStyle} disabled={loadingEmps}>
            <option value="">{t('documents.unassigned')}</option>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} {emp.surname} ({emp.uniqueId || emp.role}){emp.companyName ? ` - ${emp.companyName}` : ''}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8 }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 13 }}>{t('common.cancel')}</button>
          <button type="submit" disabled={saving || !title.trim()} style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, opacity: (saving || !title.trim()) ? 0.6 : 1 }}>{saving ? '...' : t('common.save')}</button>
        </div>
      </form>
    </ModalBackdrop>
  );
};
