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
import { getCompanies } from '../../../api/companies';
import { Company } from '../../../types';
import { DocumentsTable } from './DocumentsTable';
import { UploadModal, CategoriesModal, EditDocumentModal } from './Modals';
import { IconUpload, IconTrash, IconTag, IconSearch, IconHistory, IconFolder, IconFolderSelected, IconClose, IconChevronRight } from './DocUtils';
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
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'active' | 'trash'>('active');
  const [search, setSearch] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [editDoc, setEditDoc] = useState<any | null>(null);

  const canManage = ['admin', 'hr'].includes(user?.role || '');
  const isEmployee = user?.role === 'employee';
  const isStoreManager = user?.role === 'store_manager';

  const load = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    try {
      const [allCats, allComps] = await Promise.all([
        getCategories(),
        (isEmployee || isStoreManager) ? Promise.resolve([]) : getCompanies()
      ]);
      setCategories(allCats);

      // Filter companies based on role:
      // The backend (resolveAllowedCompanyIds) already handles scoping for HR/Area Manager groups.
      // We display all companies returned by the API.
      const allowedComps = allComps;

      setCompanies(allowedComps);

      // Store Managers automatically operate on their own company
      if (isStoreManager && user?.companyId) {
        setSelectedCompanyId(user.companyId);
      } else if (allowedComps.length === 1 && !selectedCompanyId) {
        // Auto-select if there's only one company available for this user
        setSelectedCompanyId(allowedComps[0].id);
      }

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
    } catch (err) {
      console.error('Error loading documents:', err);
      showToast(t('documents.errorLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [employeeId, isEmployee, view, t, showToast, authLoading, user]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = React.useMemo(() => {
    const map = new Map<string, { companyId: number; categoryId: number | null; count: number }>();
    docs.forEach(d => {
      const key = `${d.companyId}:${d.categoryId}`;
      if (!map.has(key)) {
        map.set(key, { companyId: d.companyId, categoryId: d.categoryId, count: 0 });
      }
      map.get(key)!.count++;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [docs]);

  const filteredDocs = docs.filter(d => {
    if (selectedCompanyId !== null) {
      // Use Number() to ensure robust comparison (handles cases where backend might return numeric strings)
      if (Number(d.companyId) !== selectedCompanyId) return false;
    }
    const term = search.toLowerCase();
    const name = (d.fileName || '').toLowerCase();
    const emp = (d.employeeName || '').toLowerCase();
    return name.includes(term) || emp.includes(term);
  });

  const getCompanyName = (compId: number | null) => {
    if (!compId) return '';
    return companies.find(c => c.id === compId)?.name || `Company ${compId}`;
  };

  const getCompanyCategories = (compId: number) => {
    const list = categories
      .filter(c => c.companyId === compId && c.isActive)
      .map(c => c.name);
    return list.length > 0 ? list.join(', ') : t('documents.noCategory', 'No Category');
  };

  const getCompanyFileCount = (compId: number) => {
    return docs.filter(d => Number(d.companyId) === compId).length;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* ── Header Toolbar ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
        {(!isEmployee || employeeId) && (
          <div style={{ display: 'flex', gap: 8, background: 'rgba(0,0,0,0.03)', padding: 5, borderRadius: 12, border: '1px solid var(--border-light)' }}>
            <button
              onClick={() => { setView('active'); setSelectedCompanyId(null); }}
              style={{ padding: '8px 20px', borderRadius: 9, border: 'none', background: view === 'active' ? 'var(--surface)' : 'transparent', color: view === 'active' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: view === 'active' ? '0 4px 12px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)' }}>
              {t('common.active', 'Active')}
            </button>
            {isTrashEnabled && canManage && (
              <button
                onClick={() => { setView('trash'); setSelectedCompanyId(null); }}
                style={{ padding: '8px 20px', borderRadius: 9, border: 'none', background: view === 'trash' ? 'var(--surface)' : 'transparent', color: view === 'trash' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: view === 'trash' ? '0 4px 12px rgba(0,0,0,0.08)' : 'none', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)' }}>
                <IconTrash /> {t('documents.trash', 'Trash')}
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {!employeeId && (
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}><IconSearch /></span>
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={t('common.search')}
                style={{ padding: '10px 16px 10px 42px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 14, width: 260, transition: 'border-color 0.2s', outline: 'none' }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          )}

          {!isEmployee && !isStoreManager && canManage && view === 'active' && (
            <>
              <button
                onClick={() => setShowCategories(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all 0.2s' }}>
                <IconTag /> {t('documents.manageCategories', 'Categories')}
              </button>
              <button
                onClick={() => setShowUpload(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 8px 16px rgba(var(--primary-rgb), 0.25)', transition: 'all 0.2s' }}>
                <IconUpload /> {t('documents.uploadDoc', 'Upload Document')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Cards Grid (Hidden for Employees, Store Managers, Individual Employee View, or Active Search) ────────────── */}
      {!loading && !isEmployee && !isStoreManager && !employeeId && !search.trim() && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
          gap: 20,
          opacity: loading ? 0.5 : 1,
          transition: 'opacity 0.2s',
          width: '100%',
          marginBottom: 32
        }}>
          {companies.map(company => {
            const isSelected = selectedCompanyId === company.id;
            return (
              <div
                key={company.id}
                onClick={() => setSelectedCompanyId(isSelected ? null : company.id)}
                style={{
                  padding: '18px 16px',
                  borderRadius: 20,
                  background: isSelected ? 'var(--surface)' : '#f9f9f9',
                  border: isSelected ? '3px solid #002D5B' : '1px solid #eee',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isSelected ? '0 12px 32px rgba(0,45,91,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.background = '#f3f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = '#eee';
                    e.currentTarget.style.background = '#f9f9f9';
                  }
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <IconFolder />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 750, color: '#002D5B', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.02em' }}>
                    {company.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {getCompanyCategories(company.id)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                    {getCompanyFileCount(company.id)} {t('documents.filesLabel', 'Files')}
                  </div>
                </div>

              </div>
            );
          })}

          {companies.length === 0 && (
            <div style={{ gridColumn: '1/-1', padding: '60px', textAlign: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: 24, border: '2px dashed var(--border-light)', color: 'var(--text-muted)' }}>
              {t('companies.noStores', 'No companies found')}
            </div>
          )}
        </div>
      )}

      {/* ── Table Container ────────────────────────────────────────────────── */}
      {(isEmployee || isStoreManager || selectedCompanyId || employeeId || (search.trim() !== '' && !isEmployee)) && (
        <div style={{
          background: 'var(--surface)',
          borderRadius: 24,
          boxShadow: '0 32px 64px rgba(0,0,0,0.1)',
          border: '1px solid var(--border-light)',
          overflow: 'hidden',
          animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{ padding: '32px 40px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.005)' }}>
            <div>
              <h3 style={{ fontSize: 22, fontWeight: 900, color: '#002D5B', margin: 0, letterSpacing: '-0.04em' }}>
                {search.trim() && !selectedCompanyId && !employeeId ? t('documents.searchResults', 'Search Results') :
                  employeeId ? `${t('documents.title', 'Documents')} - ${employeeName}` :
                    isEmployee ? t('documents.myDocuments', 'My Documents') :
                      isStoreManager ? t('documents.storeDocuments', 'Store Documents') :
                        `${getCompanyName(selectedCompanyId)}`}
              </h3>
              <p style={{ margin: '8px 0 0 0', fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
                {search.trim() && !selectedCompanyId && !employeeId ? t('documents.searchResultsDesc', 'Showing matches from all accessible companies') :
                  employeeId ? t('documents.personalDocsDesc', 'Viewing personal and payroll documents') :
                    isEmployee ? t('documents.myDocsDesc', 'Your personal documents and salary records') :
                      isStoreManager ? t('documents.storeDocsDesc', 'Documents for your store and employees') :
                        t('documents.companyViewDesc', 'Viewing all documents associated with this company')}
              </p>
            </div>
            {!isEmployee && !isStoreManager && !employeeId && (
              <button
                onClick={() => setSelectedCompanyId(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 14, fontWeight: 800, transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f8f8f8'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                {t('documents.closeCompany', 'Close View')} <IconClose />
              </button>
            )}
          </div>

          <div style={{ padding: '0 12px 12px 12px' }}>
            {loading ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>{t('common.loading')}</div>
            ) : isStoreManager && !user?.storeId ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#DC2626', fontWeight: 600 }}>
                {t('documents.noStoreAssigned', 'No store assigned to your profile')}
              </div>
            ) : filteredDocs.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                {isEmployee ? t('documents.noDocsEmployee', 'No documents available') :
                  isStoreManager ? t('documents.noDocsStore', 'No documents available for this store') :
                    t('documents.noDocs', 'No documents found')}
              </div>
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
        </div>
      )}

      {/* ── Standalone Placeholder (Admins/Area Managers only) ──────────── */}
      {!isEmployee && !isStoreManager && !selectedCompanyId && !employeeId && !search.trim() && !loading && (
        <div style={{ padding: '40px 20px', textAlign: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: 24, border: '2px dashed var(--border-light)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>{t('documents.selectCompany', 'Select a company to view documents')}</h3>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>{t('documents.selectCompanyDesc', 'Browse documents by choosing a company folder above.')}</p>
        </div>
      )}

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
