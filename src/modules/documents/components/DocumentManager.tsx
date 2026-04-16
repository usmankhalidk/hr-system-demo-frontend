import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import {
  getMyDocuments,
  getEmployeeDocuments,
  getDocumentsGeneric,
  getDeletedDocuments,
  getCategories,
  EmployeeDocument,
  DocumentCategory
} from '../../../api/documents';
import { DocumentsTable } from './DocumentsTable';
import { UploadModal, CategoriesModal, EditDocumentModal } from './Modals';
import { IconUpload, IconTrash, IconTag, IconSearch, IconHistory } from './DocUtils';
import { UnifiedUploadWizard } from '../UnifiedUploadModal';

interface DocumentManagerProps {
  employeeId?: number;
  employeeName?: string;
  isTrashEnabled?: boolean;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({ 
  employeeId, 
  employeeName,
  isTrashEnabled = true
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'active' | 'trash'>('active');
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [editDoc, setEditDoc] = useState<any | null>(null);

  const canManage = ['admin', 'hr'].includes(user?.role || '');
  const isEmployee = user?.role === 'employee';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allCats] = await Promise.all([getCategories()]);
      setCategories(allCats);

      let fetchedDocs: EmployeeDocument[] = [];
      if (view === 'trash') {
        fetchedDocs = await getDeletedDocuments(employeeId);
      } else {
        if (employeeId) {
          fetchedDocs = await getEmployeeDocuments(employeeId);
        } else if (isEmployee) {
          fetchedDocs = await getMyDocuments();
        } else {
          fetchedDocs = await getDocumentsGeneric();
        }
      }
      setDocs(fetchedDocs);
    } catch {
      showToast(t('documents.errorLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [employeeId, isEmployee, view, t, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredDocs = docs.filter(d => {
    const term = search.toLowerCase();
    const name = (d.fileName || '').toLowerCase();
    const emp = (d.employeeName || '').toLowerCase();
    return name.includes(term) || emp.includes(term);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', gap: 10, background: 'var(--background)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
          <button 
            onClick={() => setView('active')}
            style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: view === 'active' ? 'var(--surface)' : 'transparent', color: view === 'active' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600, boxShadow: view === 'active' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>
            {t('common.active', 'Active')}
          </button>
          {isTrashEnabled && canManage && (
            <button 
              onClick={() => setView('trash')}
              style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: view === 'trash' ? 'var(--surface)' : 'transparent', color: view === 'trash' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600, boxShadow: view === 'trash' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconTrash /> {t('documents.trash', 'Trash')}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><IconSearch /></span>
            <input 
              value={search} onChange={(e) => setSearch(e.target.value)} 
              placeholder={t('common.search')}
              style={{ padding: '8px 12px 8px 36px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13, width: 220 }}
            />
          </div>

          {canManage && view === 'active' && (
            <>
              <button 
                onClick={() => setShowCategories(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <IconTag /> {t('documents.manageCategories')}
              </button>
              <button 
                onClick={() => setShowUpload(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(var(--primary-rgb), 0.2)' }}>
                <IconUpload /> {t('documents.uploadDoc')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>{t('common.loading')}</div>
        ) : (
          <DocumentsTable 
            docs={filteredDocs} 
            categories={categories} 
            canManage={canManage} 
            isEmployee={isEmployee}
            onRefresh={load} 
            onEdit={setEditDoc}
            isTrash={view === 'trash'}
          />
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showUpload && (
        <UnifiedUploadWizard 
          targetEmployeeId={employeeId} 
          targetEmployeeName={employeeName} 
          onClose={() => setShowUpload(false)} 
          onSuccess={load} 
        />
      )}
      {showCategories && <CategoriesModal onClose={() => setShowCategories(false)} />}
      {editDoc && <EditDocumentModal doc={editDoc} onClose={() => setEditDoc(null)} onSuccess={load} />}
    </div>
  );
};
