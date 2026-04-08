import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  getMyDocuments,
  getEmployeeDocuments,
  getCategories,
  createCategory,
  updateCategory,
  uploadDocument,
  downloadDocument,
  deleteDocument,
  signDocument,
  bulkUploadDocuments,
  EmployeeDocument,
  DocumentCategory,
} from '../../api/documents';
import { getEmployees } from '../../api/employees';
import { Employee } from '../../types';

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

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('it-IT');
}
function mimeIcon(mime: string | null): string {
  if (mime === 'application/pdf') return '📄';
  if (mime?.startsWith('image/')) return '🖼️';
  return '📁';
}

const HR_ROLES = ['admin', 'hr', 'area_manager', 'store_manager'];

// ── Shared modal wrapper ────────────────────────────────────────────────────

const ModalBackdrop: React.FC<{ onClose: () => void; width?: number; children: React.ReactNode }> = ({ onClose, width = 440, children }) => (
  <div
    style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    onClick={onClose}
  >
    <div
      style={{ background: 'var(--surface)', borderRadius: 14, padding: 28, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'popIn 0.2s cubic-bezier(0.16,1,0.3,1)', margin: '0 16px' }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);

const ModalHeader: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
    <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{title}</div>
    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, lineHeight: 1, padding: '0 2px' }}>×</button>
  </div>
);

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 7,
  border: '1px solid var(--border)', background: 'var(--background)',
  color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 };

// ── Upload Document Modal ──────────────────────────────────────────────────

const UploadModal: React.FC<{ employeeId: number; employeeName: string; categories: DocumentCategory[]; onClose: () => void; onSuccess: () => void }> = ({ employeeId, employeeName, categories, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      await uploadDocument(employeeId, file, { categoryId: categoryId ? parseInt(categoryId, 10) : null, requiresSignature, expiresAt: expiresAt || null });
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
          <label style={labelStyle}>{t('documents.categoryLabel')}</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={inputStyle}>
            <option value="">{t('documents.noCategoryOption')}</option>
            {categories.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
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

// ── Bulk Upload Modal ──────────────────────────────────────────────────────

const BulkUploadModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ matched: number; unmatched: number; total: number; names: string[] } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const res = await bulkUploadDocuments(file);
      setResult({ matched: res.matchedFiles, unmatched: res.unmatchedFiles, total: res.totalFiles, names: res.unmatchedFileNames });
      showToast(t('documents.uploaded'), 'success');
      onSuccess();
    } catch { showToast(t('documents.errorBulk'), 'error'); }
    finally { setUploading(false); }
  };

  return (
    <ModalBackdrop onClose={onClose} width={500}>
      <ModalHeader title={t('documents.bulkTitle')} onClose={onClose} />
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6, marginTop: -8 }}>
        {t('documents.bulkDesc')}
      </p>
      {result ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ padding: '12px 16px', background: result.unmatched > 0 ? 'rgba(201,151,58,0.1)' : 'rgba(21,128,61,0.1)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
            {t('documents.bulkResult', { matched: result.matched, unmatched: result.unmatched, total: result.total })}
          </div>
          {result.names.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--background)', borderRadius: 7, padding: '10px 12px', lineHeight: 1.6 }}>
              <strong>{t('documents.bulkUnmatched', { files: '' }).replace(': ', '')}: </strong>{result.names.join(', ')}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
            <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
              {t('common.close')}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>{t('documents.bulkSelect')}</label>
            <input type="file" accept=".zip,application/zip" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13, color: 'var(--text-primary)' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={uploading || !file} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: '#fff', cursor: uploading || !file ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: uploading || !file ? 0.6 : 1 }}>
              {uploading ? t('documents.bulkUploading') : t('documents.bulkUpload')}
            </button>
          </div>
        </form>
      )}
    </ModalBackdrop>
  );
};

// ── Categories Modal ───────────────────────────────────────────────────────

const CategoriesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setCategories(await getCategories(showInactive)); }
    catch { showToast(t('documents.errorLoad'), 'error'); }
    finally { setLoading(false); }
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try { await createCategory(newName.trim()); setNewName(''); showToast(t('documents.categoryCreated'), 'success'); await load(); }
    catch { showToast(t('common.error'), 'error'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (cat: DocumentCategory) => {
    try { await updateCategory(cat.id, { isActive: !cat.isActive }); showToast(t('documents.categoryUpdated'), 'success'); await load(); }
    catch { showToast(t('common.error'), 'error'); }
  };

  const handleRename = async (cat: DocumentCategory) => {
    if (!editName.trim() || editName.trim() === cat.name) { setEditId(null); return; }
    try { await updateCategory(cat.id, { name: editName.trim() }); showToast(t('documents.categoryUpdated'), 'success'); setEditId(null); await load(); }
    catch { showToast(t('common.error'), 'error'); }
  };

  return (
    <ModalBackdrop onClose={onClose} width={480}>
      <ModalHeader title={t('documents.categoriesTitle')} onClose={onClose} />

      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('documents.categoryNamePlaceholder')} style={{ ...inputStyle, flex: 1 }} />
        <button type="submit" disabled={saving || !newName.trim()} style={{ padding: '9px 14px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: '#fff', cursor: saving || !newName.trim() ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: saving || !newName.trim() ? 0.6 : 1, whiteSpace: 'nowrap' }}>
          + {t('documents.newCategory')}
        </button>
      </form>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 14, fontSize: 12, color: 'var(--text-muted)' }}>
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        {t('documents.showInactive')}
      </label>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 7 }} />)}
        </div>
      ) : categories.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>Nessuna categoria ancora</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {categories.map(cat => (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: 'var(--background)', border: '1px solid var(--border)', opacity: cat.isActive ? 1 : 0.5 }}>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}><IconTag /></span>
              {editId === cat.id ? (
                <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => handleRename(cat)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRename(cat); if (e.key === 'Escape') setEditId(null); }}
                  style={{ flex: 1, padding: '3px 7px', borderRadius: 4, border: '1px solid var(--primary)', background: 'var(--background)', color: 'var(--text-primary)', fontSize: 13 }}
                />
              ) : (
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{cat.name}</span>
              )}
              <button onClick={() => { setEditId(cat.id); setEditName(cat.name); }} title={t('common.edit')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px', borderRadius: 4 }}>
                <IconPen />
              </button>
              <button onClick={() => handleToggle(cat)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: `1px solid ${cat.isActive ? '#DC2626' : '#15803D'}`, background: 'transparent', color: cat.isActive ? '#DC2626' : '#15803D', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {cat.isActive ? t('common.deactivate') : t('common.activate')}
              </button>
            </div>
          ))}
        </div>
      )}
    </ModalBackdrop>
  );
};

// ── Documents Table ────────────────────────────────────────────────────────

const DocumentsTable: React.FC<{ docs: EmployeeDocument[]; categories: DocumentCategory[]; canManage: boolean; isEmployee: boolean; onRefresh: () => void }> = ({ docs, categories, canManage, isEmployee, onRefresh }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [signingDoc, setSigningDoc] = useState<EmployeeDocument | null>(null);
  const [signConsent, setSignConsent] = useState(false);
  const [signing, setSigning] = useState(false);

  const handleDownload = async (doc: EmployeeDocument) => {
    try { await downloadDocument(doc.id, doc.fileName); }
    catch { showToast(t('documents.errorLoad'), 'error'); }
  };

  const handleDelete = async (doc: EmployeeDocument) => {
    if (!window.confirm(t('documents.confirmDelete', { name: doc.fileName }))) return;
    try { await deleteDocument(doc.id); showToast(t('documents.deleted'), 'success'); onRefresh(); }
    catch { showToast(t('documents.errorDelete'), 'error'); }
  };

  const handleSignClick = (doc: EmployeeDocument) => {
    setSigningDoc(doc);
    setSignConsent(false);
  };

  const handleSignConfirm = async () => {
    if (!signingDoc || !signConsent) return;
    setSigning(true);
    try {
      await signDocument(signingDoc.id);
      showToast(t('documents.signedSuccess'), 'success');
      setSigningDoc(null);
      onRefresh();
    } catch {
      showToast(t('documents.errorSign'), 'error');
    } finally {
      setSigning(false);
    }
  };

  if (docs.length === 0) {
    return (
      <div style={{ padding: '56px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 14 }}>📂</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{t('documents.noDocuments')}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('documents.noDocumentsHint')}</div>
      </div>
    );
  }

  return (
    <>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--background)' }}>
            {[t('documents.fileName'), t('documents.category'), t('documents.uploadedOn'), t('documents.expiresOn'), t('documents.signature'), t('common.actions')].map((h, i) => (
              <th key={i} style={{ padding: '10px 14px', textAlign: i === 5 ? 'right' : 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => (
            <tr key={doc.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.12s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--background)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{mimeIcon(doc.mimeType)}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.fileName}</span>
                </div>
              </td>
              <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                {doc.categoryName ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--background)', border: '1px solid var(--border)', fontWeight: 500 }}>{doc.categoryName}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
              </td>
              <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(doc.createdAt)}</td>
              <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                {doc.expiresAt
                  ? <span style={{ color: new Date(doc.expiresAt) < new Date() ? '#DC2626' : 'var(--text-secondary)' }}>{formatDate(doc.expiresAt)}</span>
                  : <span style={{ color: 'var(--text-muted)' }}>—</span>}
              </td>
              <td style={{ padding: '12px 14px' }}>
                {!doc.requiresSignature
                  ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('documents.notRequired')}</span>
                  : doc.signedAt
                    ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(21,128,61,0.1)', color: '#15803D', fontWeight: 600 }}>✓ {t('documents.signed')}</span>
                    : <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(201,151,58,0.1)', color: '#C9973A', fontWeight: 600 }}>{t('documents.unsigned')}</span>
                }
              </td>
              <td style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button onClick={() => handleDownload(doc)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                    <IconDownload /> {t('documents.download')}
                  </button>
                  {doc.requiresSignature && !doc.signedAt && (isEmployee || canManage) && (
                    <button onClick={() => handleSignClick(doc)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      <IconPen /> {t('documents.sign')}
                    </button>
                  )}
                  {canManage && (
                    <button onClick={() => handleDelete(doc)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderRadius: 6, border: '1px solid #DC262630', background: 'rgba(220,38,38,0.05)', color: '#DC2626', cursor: 'pointer', fontSize: 12 }}>
                      <IconTrash />
                    </button>
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
        <ModalHeader title={t('documents.signTitle', 'Firma documento')} onClose={() => !signing && setSigningDoc(null)} />
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', padding: '8px 12px', background: 'var(--background)', borderRadius: 7, marginBottom: 16 }}>
          {signingDoc.fileName}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, padding: '12px 14px', background: 'rgba(201,151,58,0.06)', border: '1px solid rgba(201,151,58,0.2)', borderRadius: 8, marginBottom: 18 }}>
          {t('documents.signLegalText', 'Firmando questo documento dichiari di averne preso visione e di acconsentire alla firma digitale. La firma sarà registrata insieme alla data, all\'ora e al tuo indirizzo IP come prova legale di consenso.')}
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 22 }}>
          <input type="checkbox" checked={signConsent} onChange={(e) => setSignConsent(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {t('documents.signConsentLabel', 'Ho letto il documento e acconsento alla firma digitale')}
          </span>
        </label>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => setSigningDoc(null)} disabled={signing} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', cursor: signing ? 'not-allowed' : 'pointer', fontSize: 13 }}>
            {t('common.cancel')}
          </button>
          <button onClick={handleSignConfirm} disabled={!signConsent || signing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: '#fff', cursor: !signConsent || signing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: !signConsent || signing ? 0.6 : 1 }}>
            <IconPen /> {signing ? t('documents.signing', 'Firma in corso...') : t('documents.sign')}
          </button>
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

  const isHR = user ? HR_ROLES.includes(user.role) : false;
  const isEmployee = user?.role === 'employee';

  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);

  useEffect(() => {
    getCategories(false).then(setCategories).catch(() => {});
  }, []);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      if (isEmployee) {
        setDocs(await getMyDocuments());
      } else if (selectedEmployee) {
        setDocs(await getEmployeeDocuments(selectedEmployee.id));
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

        {isHR && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => setShowCatModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              <IconTag /> {t('documents.manageCategories')}
            </button>
            <button onClick={() => setShowBulkModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              <IconUpload /> {t('documents.bulkUpload')}
            </button>
            {selectedEmployee && (
              <button onClick={() => setShowUploadModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <IconUpload /> {t('documents.uploadDoc')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main panel */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

        {/* Panel toolbar */}
        {isHR && (
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
        ) : isEmployee || selectedEmployee ? (
          <DocumentsTable
            docs={docs}
            categories={categories}
            canManage={isHR}
            isEmployee={isEmployee}
            onRefresh={loadDocs}
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
      {showUploadModal && selectedEmployee && (
        <UploadModal employeeId={selectedEmployee.id} employeeName={employeeName} categories={categories} onClose={() => setShowUploadModal(false)} onSuccess={loadDocs} />
      )}
      {showBulkModal && <BulkUploadModal onClose={() => setShowBulkModal(false)} onSuccess={loadDocs} />}
      {showCatModal && <CategoriesModal onClose={() => { setShowCatModal(false); getCategories(false).then(setCategories).catch(() => {}); }} />}
    </div>
  );
};

export default DocumentsPage;
