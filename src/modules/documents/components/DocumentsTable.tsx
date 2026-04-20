import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import {
  downloadDocumentGeneric,
  deleteDocument,
  signDocument,
  restoreDocument,
  EmployeeDocument,
  DocumentCategory,
  getDocumentPreviewUrlGeneric
} from '../../../api/documents';
import { IconDownload, IconPen, IconTrash, IconRestore, mimeIcon, IconEye, ModalBackdrop, ModalHeader } from './DocUtils';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import { Pagination } from '../../../components/ui/Pagination';

interface DocumentsTableProps {
  docs: EmployeeDocument[];
  categories: DocumentCategory[];
  canManage: boolean;
  isEmployee: boolean;
  onRefresh: () => void;
  onEdit?: (doc: any) => void;
  isTrash?: boolean;
}

export const DocumentsTable: React.FC<DocumentsTableProps> = ({ 
  docs, 
  categories, 
  canManage, 
  isEmployee, 
  onRefresh, 
  onEdit, 
  isTrash 
}) => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [signingDoc, setSigningDoc] = useState<any | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<any | null>(null);
  const [signing, setSigning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocName, setPreviewDocName] = useState<string>('');
  const [previewLoadingId, setPreviewLoadingId] = useState<number | null>(null);
  const pageSize = 10;

  // Reset to page 1 when docs change (e.g. search or filter)
  useEffect(() => {
    setCurrentPage(1);
  }, [docs]);

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

  const handlePreview = async (doc: any) => {
    setPreviewLoadingId(doc.id);
    try {
      const mimeType = doc.mimeType || doc.mime_type || 'application/pdf';
      const url = await getDocumentPreviewUrlGeneric(doc.id, mimeType);
      setPreviewDocUrl(url);
      setPreviewDocName(doc.fileName || doc.title || 'Preview');
    } catch {
      showToast(t('documents.errorLoad', 'Error loading document'), 'error');
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const closePreview = () => {
    if (previewDocUrl) {
      URL.revokeObjectURL(previewDocUrl);
    }
    setPreviewDocUrl(null);
  };

  const handleDeleteClick = (doc: any) => {
    setDeletingDoc(doc);
  };

  const handleConfirmDelete = async () => {
    if (!deletingDoc) return;
    setDeleting(true);
    try { 
      await deleteDocument(deletingDoc.id); 
      showToast(t('documents.deleted'), 'success'); 
      onRefresh(); 
      setDeletingDoc(null);
    }
    catch { showToast(t('documents.errorDelete'), 'error'); }
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
  };

  const handleSignConfirm = async () => {
    if (!signingDoc) return;
    setSigning(true);
    try {
      const now = new Date();
      const signedAt = now.toISOString();
      const lang = i18n.language || 'it';
      const signedAtDisplay = now.toLocaleString(lang.startsWith('it') ? 'it-IT' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'medium',
        hour12: false
      });
      
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

  const totalDocs = docs.length;
  const totalPages = Math.ceil(totalDocs / pageSize);
  const currentDocs = docs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
              {isTrash ? t('documents.deletedOn') : t('documents.expiresOn')}
            </th>
            {!isTrash && (
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('documents.signature')}
              </th>
            )}
            <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('common.actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {currentDocs.map((doc: any) => (
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
                      {t('documents.expired')}
                      </span>
                    )}
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </td>
              {!isTrash && (
                <td style={{ padding: '12px 14px' }}>
                  {!doc.requiresSignature ? (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('documents.notRequired')}</span>
                  ) : doc.signedAt ? (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(21,128,61,0.1)', color: '#15803D', fontWeight: 600 }}>✓ {t('documents.signed')}</span>
                  ) : (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(201,151,58,0.1)', color: '#C9973A', fontWeight: 600 }}>{t('documents.required')}</span>
                  )}
                </td>
              )}
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
                        onClick={() => handlePreview(doc)} 
                        title={t('common.preview', 'Preview')}
                        disabled={previewLoadingId === doc.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-secondary)', cursor: previewLoadingId === doc.id ? 'wait' : 'pointer', fontSize: 12 }}>
                        {previewLoadingId === doc.id ? '...' : <IconEye />}
                      </button>
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
                              🚫 {t('documents.expired')}
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

    {totalPages > 1 && (
      <div style={{ padding: '0 24px' }}>
        <Pagination 
          page={currentPage}
          pages={totalPages}
          total={totalDocs}
          limit={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>
    )}

    <ConfirmModal
      open={!!deletingDoc}
      title={t('common.confirm')}
      message={t('documents.confirmDelete', { name: deletingDoc?.fileName || deletingDoc?.title })}
      onConfirm={handleConfirmDelete}
      onCancel={() => setDeletingDoc(null)}
      confirmLabel={deleting ? '...' : t('common.delete')}
      variant="danger"
    />

    <ConfirmModal
      open={!!signingDoc}
      title={t('documents.signTitle')}
      message={t('documents.signConsentLabel')}
      onConfirm={handleSignConfirm}
      onCancel={() => setSigningDoc(null)}
      confirmLabel={signing ? '...' : t('common.sign', 'Sign')}
      variant="primary"
    />

    {previewDocUrl && (
      <ModalBackdrop onClose={closePreview} width={800}>
        <ModalHeader title={previewDocName} onClose={closePreview} />
        <div style={{ width: '100%', height: '75vh', background: 'var(--background)', borderRadius: 12, overflow: 'hidden' }}>
          <iframe 
            src={previewDocUrl} 
            style={{ width: '100%', height: '100%', border: 'none' }} 
            title={previewDocName}
          />
        </div>
      </ModalBackdrop>
    )}
    </>
  );
};
