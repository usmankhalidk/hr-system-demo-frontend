import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  getMyDocuments,
  getEmployeeDocuments,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  signDocument,
  deleteDocument,
  getDeletedDocuments,
  restoreDocument,
  uploadDocument,
  bulkUploadDocuments,
  getDocumentsGeneric,
  downloadDocumentGeneric,
  updateDocumentGeneric,
  EmployeeDocument,
  DocumentCategory,
} from '../../api/documents';
import { UnifiedUploadWizard } from './UnifiedUploadModal';
import { getEmployees } from '../../api/employees';
import { getCompanies } from '../../api/companies';
import { Employee, Company } from '../../types';
import ConfirmModal from '../../components/ui/ConfirmModal';

// ── Icons ──────────────────────────────────────────────────────────────────

const IconDownload = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const IconUpload = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const IconPen = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);
const IconTag = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconHistory = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/>
  </svg>
);
const IconRestore = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────────

function mimeIcon(mime: string | null): string {
  if (mime === 'application/pdf') return '📄';
  if (mime?.startsWith('image/')) return '🖼️';
  return '📁';
}

const CAN_MANAGE_ROLES = ['admin', 'hr'];
const CAN_VIEW_ALL_ROLES = ['admin', 'hr', 'area_manager', 'store_manager', 'employee'];
const HR_ROLES = CAN_VIEW_ALL_ROLES;

// ── Shared modal wrapper ────────────────────────────────────────────────────

const ModalBackdrop: React.FC<{ onClose: () => void; width?: number; children: React.ReactNode }> = ({ onClose, width = 440, children }) => {
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(13,33,55,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--surface)', borderRadius: 16, padding: 32, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(13,33,55,0.24)', animation: 'popIn 0.22s cubic-bezier(0.16,1,0.3,1)', margin: '0 16px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

const ModalHeader: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border-light)' }}>
    <div style={{ fontWeight: 700, fontSize: 17, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{title}</div>
    <button onClick={onClose} style={{ background: 'var(--background)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1, padding: '5px 8px', borderRadius: 6, transition: 'background 0.12s' }}>✕</button>
  </div>
);

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 13px', borderRadius: 8,
  border: '1.5px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  outline: 'none',
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
  display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em'
};

// ── Upload Document Modal ──────────────────────────────────────────────────

const UploadModal: React.FC<{ employeeId: number; employeeName: string; onClose: () => void; onSuccess: () => void }> = ({ employeeId, employeeName, onClose, onSuccess }) => {
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
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={inputStyle} />
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

const CategoriesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
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
      // Fetch both categories and companies
      const [allCats, allComps] = await Promise.all([
        getCategories(true), // Fetch all to handle UI filtering
        getCompanies(),
      ]);

      setCategories(allCats);
      
      // Filter companies based on allowed IDs
      const filteredComps = allComps.filter(c => allowedCompanyIds.includes(c.id));
      setCompanies(filteredComps);

      // Auto-select company if only one
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

    // Strict duplicate check: one category per company
    const exists = categories.some(c => c.companyId === targetCompanyId);

    if (exists) {
      showToast(t('documents.oneCategoryPerCompany', 'This company already has a category. You can only edit it.'), 'error');
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

  // UI Filtering: Show active only or inactive only
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
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t('documents.categoryName')}
              </label>
              <input 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)} 
                placeholder={t('documents.categoryNamePlaceholder')} 
                style={{ ...inputStyle, width: '100%' }} 
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t('documents.companyLabel')}
              </label>
              <select 
                value={selectedCompanyId || ''} 
                onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
                style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}
              >
                <option value="">{t('documents.selectCompany')}</option>
                {companiesWithoutCategory.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <button 
              type="submit" 
              disabled={saving || !newName.trim() || (!selectedCompanyId && companiesWithoutCategory.length > 1)} 
              style={{ 
                width: '100%',
                padding: '11px 14px', 
                borderRadius: 8, 
                border: 'none', 
                background: 'var(--primary)', 
                color: '#fff', 
                cursor: (saving || !newName.trim() || (!selectedCompanyId && companiesWithoutCategory.length > 1)) ? 'not-allowed' : 'pointer', 
                fontSize: 13, 
                fontWeight: 700, 
                opacity: (saving || !newName.trim() || (!selectedCompanyId && companiesWithoutCategory.length > 1)) ? 0.6 : 1,
                marginTop: 4,
                transition: 'all 0.15s ease'
              }}
            >
              {saving ? '...' : `+ ${t('documents.newCategory')}`}
            </button>
          </form>
        ) : (
          <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--background)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' }}>
            {t('documents.allCompaniesHaveCategory', 'Tutte le aziende hanno già una categoria. Puoi modificarla dalla lista sottostante.')}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            {t('documents.showInactive')}
          </label>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
            {filteredCategories.length} {t('documents.categoriesCount')}
          </span>
        </div>

        <div style={{ maxHeight: 300, overflowY: 'auto', paddingRight: 4 }} className="sidebar-scroll">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />)}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: 13, background: 'var(--background)', borderRadius: 12, border: '1.5px dashed var(--border)' }}>
            {showInactive ? 'No inactive categories' : t('documents.noCategories')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredCategories.map(cat => (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', transition: 'all 0.2s ease' }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}><IconTag /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editId === cat.id ? (
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleRename(cat)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRename(cat); if (e.key === 'Escape') setEditId(null); }}
                      style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--primary)', background: 'var(--background)', color: 'var(--text-primary)', fontSize: 13 }}
                    />
                  ) : (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.name}</div>
                      {companies.length > 1 && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                          {companies.find(c => c.id === cat.companyId)?.name || `Company ID: ${cat.companyId}`}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <button 
                  onClick={() => { setEditId(cat.id); setEditName(cat.name); }} 
                  title={t('common.edit')} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: 6, transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--background)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <IconPen />
                </button>
                <button 
                  onClick={() => handleDelete(cat)} 
                  title={t('common.delete')} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: 6, transition: 'background 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; e.currentTarget.style.color = '#DC2626'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <IconTrash />
                </button>
                <button onClick={() => handleToggle(cat)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, border: `1px solid ${cat.isActive ? '#DC262630' : '#15803D30'}`, background: cat.isActive ? 'rgba(220,38,38,0.05)' : 'rgba(21,128,61,0.05)', color: cat.isActive ? '#DC2626' : '#15803D', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {cat.isActive ? t('common.deactivate') : t('common.activate')}
                </button>
              </div>
            ))}
          </div>
        )}
        </div>
      </ModalBackdrop>

      <ConfirmModal
        open={!!categoryToDelete}
        title={t('common.delete', 'Delete')}
        message={t('documents.deleteCategoryConfirm', 'Are you sure you want to delete this category? This action cannot be undone.')}
        onConfirm={confirmDelete}
        onCancel={() => setCategoryToDelete(null)}
        variant="danger"
      />
    </>
  );
};

// ── Edit Document Modal ────────────────────────────────────────────────────

const EditDocumentModal: React.FC<{ doc: any; onClose: () => void; onSuccess: () => void }> = ({ doc, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { allowedCompanyIds } = useAuth();
  
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
    // Fetch employees across all allowed companies (limit cross-company view to 500)
    setLoadingEmps(true);
    getEmployees({ status: 'active', excludeAdmins: true })
      .then(res => {
        setEmployees(res.employees);
      })
      .catch(() => showToast(t('employees.errorLoad'), 'error'))
      .finally(() => setLoadingEmps(false));
  }, [t, showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await updateDocumentGeneric(doc.id, { 
        title: `${title}${extension}`, 
        employee_id: employeeId 
      });
      showToast(t('documents.categoryUpdated'), 'success');
      onSuccess();
      onClose();
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose} width={440}>
      <ModalHeader title={t('documents.editDocument')} onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>{t('documents.fileNameNoExt')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              style={{ ...inputStyle, flex: 1 }} 
              required 
            />
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{extension}</span>
          </div>
        </div>

        <div>
          <label style={labelStyle}>{t('documents.assigned')}</label>
          <select 
            value={employeeId || ''} 
            onChange={(e) => setEmployeeId(e.target.value ? Number(e.target.value) : null)}
            style={inputStyle}
            disabled={loadingEmps}
          >
            <option value="">{t('documents.unassigned')}</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name} {emp.surname} (ID: {emp.uniqueId || emp.id})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8 }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={saving || !title.trim()} style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: (saving || !title.trim()) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: (saving || !title.trim()) ? 0.6 : 1 }}>
            {saving ? '...' : t('documents.saveChanges')}
          </button>
        </div>
      </form>
    </ModalBackdrop>
  );
};

// ── Documents Table ────────────────────────────────────────────────────────

const DocumentsTable: React.FC<{ 
  docs: any[]; 
  categories: DocumentCategory[]; 
  canManage: boolean; 
  isEmployee: boolean; 
  onRefresh: () => void; 
  onEdit?: (doc: any) => void;
  isTrash?: boolean;
}> = ({ docs, categories, canManage, isEmployee, onRefresh, onEdit, isTrash }) => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [signingDoc, setSigningDoc] = useState<any | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<any | null>(null);
  const [signConsent, setSignConsent] = useState(false);
  const [signing, setSigning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const lang = i18n.language || 'it';
    return new Date(iso).toLocaleDateString(lang.startsWith('it') ? 'it-IT' : 'en-US');
  }

  const handleDownload = async (doc: any) => {
    try { 
      const name = doc.fileName || doc.title || 'document';
      await downloadDocumentGeneric(doc.id, name); 
    }
    catch { showToast(t('documents.errorLoad'), 'error'); }
  };

  const handleDeleteClick = (doc: any) => {
    setDeletingDoc(doc);
  };

  const handleConfirmDelete = async () => {
    if (!deletingDoc) return;
    setDeleting(true);
    try { 
      await deleteDocument(deletingDoc.id); 
      showToast(t('documents.deleted', 'Document deleted successfully'), 'success'); 
      onRefresh(); 
      setDeletingDoc(null);
    }
    catch { showToast(t('documents.errorDelete', 'Error deleting document'), 'error'); }
    finally { setDeleting(false); }
  };

  const handleRestore = async (doc: any) => {
    try {
      await restoreDocument(doc.id, doc.sourceTable || 'employee_documents');
      showToast(t('documents.restoredSuccess', 'Document restored successfully'), 'success');
      onRefresh();
    } catch {
      showToast(t('documents.errorRestore', 'Error restoring document'), 'error');
    }
  };

  const handleSignClick = (doc: any) => {
    setSigningDoc(doc);
    setSignConsent(false);
  };

  const handleSignConfirm = async () => {
    if (!signingDoc) return;
    setSigning(true);
    try {
      // Capture exact moment of confirmation in local time
      const now = new Date();
      const signedAt = now.toISOString();
      const lang = i18n.language || 'it';
      const signedAtDisplay = now.toLocaleString(lang.startsWith('it') ? 'it-IT' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'medium',
        hour12: false // Force 24h for consistency if needed, or keep local default
      });
      
      console.log('Signing document at:', signedAtDisplay, 'ISO:', signedAt);
      
      await signDocument(signingDoc.id, lang, signedAt, signedAtDisplay);
      showToast(t('documents.signedSuccess'), 'success');
      setSigningDoc(null);
      onRefresh();
    } catch (err: any) {
      console.error('Sign error:', err);
      showToast(t('documents.errorSign'), 'error');
    } finally {
      setSigning(false);
    }
  };

  if (docs.length === 0) {
    return (
      <div style={{ padding: '56px 24px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '36px 48px', background: 'var(--background)', border: '1.5px dashed var(--border)', borderRadius: 16, maxWidth: 360 }}>
          <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.6 }}>📂</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>{t('documents.noDocuments')}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{t('documents.noDocumentsHint')}</div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--background)' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('documents.fileName')}
            </th>
            {(!isEmployee) && (
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('documents.assigned')}
              </th>
            )}
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('documents.category')}
            </th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('documents.uploadedOn')}
            </th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isTrash ? t('documents.deletedOn', 'Deleted On') : t('documents.expiresOn')}
            </th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isTrash ? t('documents.restoredBy', 'Last Restoration') : t('documents.signature')}
            </th>
            <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('common.actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {docs.map((doc: any) => (
            <tr key={doc.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.12s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--background)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{mimeIcon(doc.mimeType || doc.mime_type)}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.fileName || doc.title}
                  </span>
                </div>
              </td>
              {(!isEmployee) && (
                <td style={{ padding: '12px 14px' }}>
                  {doc.employeeName || doc.employee_name ? (
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {doc.employeeName || doc.employee_name}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: '#C9973A', fontStyle: 'italic', fontWeight: 600 }}>
                      ⚠ {t('documents.unassigned')}
                    </span>
                  )}
                </td>
              )}
              <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                {(doc.categoryName || doc.category) ? (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--background)', border: '1px solid var(--border)', fontWeight: 500 }}>
                    {doc.categoryName || doc.category}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, fontStyle: 'italic' }}>
                    {t('documents.noCategory')}
                  </span>
                )}
              </td>
              <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(doc.createdAt)}</td>
              <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                {isTrash ? (
                  <span style={{ color: 'var(--text-secondary)' }}>{formatDate(doc.deletedAt)}</span>
                ) : doc.expiresAt ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ color: new Date(doc.expiresAt) < new Date() ? '#DC2626' : 'var(--text-secondary)', fontWeight: new Date(doc.expiresAt) < new Date() ? 600 : 400 }}>
                      {formatDate(doc.expiresAt)}
                    </span>
                    {new Date(doc.expiresAt) < new Date() && (
                      <span style={{ 
                        fontSize: 9, padding: '2px 6px', borderRadius: 4, 
                        background: 'rgba(220,38,38,0.1)', color: '#DC2626', 
                        fontWeight: 800, textTransform: 'uppercase', width: 'fit-content',
                        letterSpacing: '0.02em', border: '1px solid rgba(220,38,38,0.2)'
                      }}>
                      {t('documents.expired', 'EXPIRED')}
                      </span>
                    )}
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </td>
              <td style={{ padding: '12px 14px' }}>
                {isTrash ? (
                   doc.restoredAt ? (
                     <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>{formatDate(doc.restoredAt)}</span>
                       <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>ID {doc.restoredBy}</span>
                     </div>
                   ) : <span style={{ color: 'var(--text-muted)' }}>—</span>
                ) : !doc.requiresSignature ? (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('documents.notRequired')}</span>
                ) : doc.signedAt ? (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(21,128,61,0.1)', color: '#15803D', fontWeight: 600 }}>✓ {t('documents.signed')}</span>
                ) : (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(201,151,58,0.1)', color: '#C9973A', fontWeight: 600 }}>{t('documents.required')}</span>
                )}
              </td>
              <td style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {isTrash ? (
                    <button 
                      onClick={() => handleRestore(doc)} 
                      title={t('documents.restore', 'Restore')}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      <IconRestore /> {t('documents.restore', 'Restore')}
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleDownload(doc)} 
                        title={t('documents.download')}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>
                        <IconDownload />
                      </button>
                      {onEdit && canManage && (
                        <button 
                          onClick={() => onEdit(doc)} 
                          title={t('common.edit')}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>
                          <IconPen />
                        </button>
                      )}
                      {doc.requiresSignature && !doc.signedAt && Number(doc.employeeId || doc.employee_id) === user?.id && (
                        <>
                          {doc.expiresAt && new Date(doc.expiresAt) < new Date() ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(220,38,38,0.05)', color: '#DC2626', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                              🚫 {t('documents.expired', 'EXPIRED')}
                            </div>
                          ) : (
                            <button onClick={() => handleSignClick(doc)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                              <IconPen /> {t('documents.sign')}
                            </button>
                          )}
                        </>
                      )}
                      {canManage && (
                        <button 
                          onClick={() => handleDeleteClick(doc)} 
                          title={t('common.delete')}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderRadius: 6, border: '1px solid #DC262630', background: 'rgba(220,38,38,0.05)', color: '#DC2626', cursor: 'pointer', fontSize: 12 }}>
                          <IconTrash />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {signingDoc && (
      <ModalBackdrop onClose={() => !signing && setSigningDoc(null)} width={440}>
        <ModalHeader title={t('documents.signTitle')} onClose={() => !signing && setSigningDoc(null)} />
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', padding: '9px 13px', background: 'var(--background)', borderRadius: 8, marginBottom: 16, border: '1px solid var(--border)' }}>
          {signingDoc.fileName || signingDoc.title}
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: 'rgba(201,151,58,0.08)', border: '1.5px solid rgba(201,151,58,0.28)', borderRadius: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.4 }}>⚖️</span>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {t('documents.signConsentLabel')}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
           <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px 0', fontStyle: 'italic' }}>
             {t('documents.signedBy')}: <strong>{user?.name} {user?.surname}</strong> ({user?.role})
           </p>
           <button 
             onClick={handleSignConfirm} 
             disabled={signing} 
             style={{ 
               display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, 
               padding: '12px 24px', borderRadius: 10, border: 'none', 
               background: 'var(--primary)', color: '#fff', 
               cursor: signing ? 'not-allowed' : 'pointer', 
               fontSize: 14, fontWeight: 700, 
               boxShadow: '0 4px 15px rgba(var(--primary-rgb), 0.3)',
               transition: 'transform 0.2s, background 0.2s',
               opacity: signing ? 0.7 : 1
             }}
             onMouseEnter={(e) => !signing && (e.currentTarget.style.transform = 'translateY(-1px)')}
             onMouseLeave={(e) => !signing && (e.currentTarget.style.transform = 'translateY(0)')}
           >
             <IconPen /> {signing ? t('common.saving') : t('common.confirm')}
           </button>
           <button 
             onClick={() => setSigningDoc(null)} 
             disabled={signing} 
             style={{ 
               padding: '10px 24px', borderRadius: 10, border: '1px solid var(--border)', 
               background: 'transparent', color: 'var(--text-secondary)', 
               cursor: signing ? 'not-allowed' : 'pointer', 
               fontSize: 13, fontWeight: 500 
             }}
           >
             {t('common.cancel')}
           </button>
        </div>
      </ModalBackdrop>
    )}
    {deletingDoc && (
      <ModalBackdrop onClose={() => !deleting && setDeletingDoc(null)} width={400}>
        <ModalHeader title={t('common.confirmAction', 'Confirm action')} onClose={() => !deleting && setDeletingDoc(null)} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>🗑️</span>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {t('documents.confirmDelete', { name: deletingDoc.fileName || deletingDoc.title })}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {t('documents.deleteConfirmHint', 'This will move the document to the Trash view. You can restore it later if needed.')}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button onClick={() => setDeletingDoc(null)} disabled={deleting} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', cursor: deleting ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}>
              {t('common.cancel')}
            </button>
            <button onClick={handleConfirmDelete} disabled={deleting} style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 12px rgba(220,38,38,0.2)' }}>
              {deleting ? '...' : t('common.delete', 'Delete')}
            </button>
          </div>
        </div>
      </ModalBackdrop>
    )}
    </>
  );
};

// ── Employee Search Combobox ───────────────────────────────────────────────

interface EmployeeComboProps {
  onSelect: (emp: Employee) => void;
}

const EmployeeCombobox: React.FC<EmployeeComboProps> = ({ onSelect }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); setOpen(false); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await getEmployees({ search: query, limit: 8 });
        setResults(res.employees ?? []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (emp: Employee) => {
    setQuery(''); setResults([]); setOpen(false);
    onSelect(emp);
  };

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
          <IconSearch />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('documents.searchEmployee')}
          onFocus={() => results.length > 0 && setOpen(true)}
          style={{ ...inputStyle, paddingLeft: 32, paddingRight: searching ? 32 : 11 }}
        />
        {searching && (
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-muted)' }}>⟳</span>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, overflow: 'hidden' }}>
          {results.map(emp => (
            <button key={emp.id} onMouseDown={() => handleSelect(emp)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--background)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {emp.name.charAt(0)}{emp.surname?.charAt(0) ?? ''}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name} {emp.surname ?? ''}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID {emp.id} · {emp.role}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────

const DocumentsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const canManage = user ? CAN_MANAGE_ROLES.includes(user.role) : false;
  const canViewAll = user ? CAN_VIEW_ALL_ROLES.includes(user.role) : false;
  const isEmployee = user?.role === 'employee';

  const [docs, setDocs] = useState<any[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [viewingTrash, setViewingTrash] = useState(false);

  useEffect(() => {
    getCategories(false).then(setCategories).catch(() => {});
  }, []);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      if (viewingTrash) {
        setDocs(await getDeletedDocuments());
      } else if (isEmployee) {
        setDocs(await getMyDocuments());
      } else if (selectedEmployee) {
        setDocs(await getEmployeeDocuments(selectedEmployee.id));
      } else if (canViewAll) {
        const globalDocs = await getDocumentsGeneric();
        setDocs(globalDocs);
      } else {
        setDocs([]);
      }
    } catch {
      showToast(t('documents.errorLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [isEmployee, selectedEmployee]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setDocs([]);
  };

  const clearEmployee = () => {
    setSelectedEmployee(null);
    setDocs([]);
  };

  const employeeName = selectedEmployee
    ? `${selectedEmployee.name} ${selectedEmployee.surname ?? ''}`.trim()
    : '';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }} className="page-enter">
      {/* Page header — matches ATSPage pattern exactly */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {isEmployee ? t('documents.myTitle') : t('documents.title')}
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            {isEmployee ? t('documents.mySubtitle') : t('documents.subtitle')}
          </p>
        </div>

        {canManage && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button 
              onClick={() => setViewingTrash(v => !v)} 
              style={{ 
                display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, 
                border: viewingTrash ? '1px solid var(--primary)' : '1px solid var(--border)', 
                background: viewingTrash ? 'rgba(var(--primary-rgb), 0.1)' : 'var(--surface)', 
                color: viewingTrash ? 'var(--primary)' : 'var(--text-secondary)', 
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
            >
              <IconHistory /> {viewingTrash ? t('documents.backToList', 'Back to list') : t('documents.viewTrash', 'Trash')}
            </button>
            <button onClick={() => setShowCatModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              <IconTag /> {t('documents.manageCategories')}
            </button>
            <button onClick={() => setShowUploadModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <IconUpload /> {t('documents.uploadDoc')}
            </button>
          </div>
        )}
      </div>

      {/* Main panel */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

        {/* Panel toolbar */}
        {canViewAll && (
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'var(--background)' }}>
            <EmployeeCombobox onSelect={handleSelectEmployee} />
            {selectedEmployee && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 99, background: 'rgba(2,132,199,0.08)', border: '1px solid rgba(2,132,199,0.2)', fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: '#0284C7' }}>{employeeName}</span>
                <span style={{ color: '#0284C780', fontSize: 11 }}>ID {selectedEmployee.id}</span>
                <button onClick={clearEmployee} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0284C7', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '4px 0' }}>
                <div className="skeleton" style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0 }} />
                <div className="skeleton" style={{ flex: 1, height: 16, borderRadius: 4 }} />
                <div className="skeleton" style={{ width: 80, height: 16, borderRadius: 4 }} />
                <div className="skeleton" style={{ width: 80, height: 16, borderRadius: 4 }} />
                <div className="skeleton" style={{ width: 100, height: 28, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        ) : (isEmployee || selectedEmployee || canViewAll) ? (
          <DocumentsTable
            docs={docs}
            categories={categories}
            canManage={canManage}
            isEmployee={isEmployee}
            onRefresh={loadDocs}
            onEdit={setEditingDoc}
            isTrash={viewingTrash}
          />
        ) : (
          <div style={{ padding: '72px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.5 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{t('documents.selectEmployee')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('documents.selectEmployeeHint')}</div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showUploadModal && (
        <UnifiedUploadWizard 
          onClose={() => setShowUploadModal(false)} 
          onSuccess={loadDocs} 
          targetEmployee={selectedEmployee}
        />
      )}
      {showCatModal && <CategoriesModal onClose={() => { setShowCatModal(false); getCategories(false).then(setCategories).catch(() => {}); }} />}
      {editingDoc && (
        <EditDocumentModal 
          doc={editingDoc} 
          onClose={() => setEditingDoc(null)} 
          onSuccess={loadDocs} 
        />
      )}
    </div>
  );
};

export default DocumentsPage;
