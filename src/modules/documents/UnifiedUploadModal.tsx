import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { uploadDocumentUnified, updateDocumentGeneric, deleteDocument } from '../../api/documents';
import { getEmployees } from '../../api/employees';
import { Employee, Company } from '../../types';
import { createPortal } from 'react-dom';
import { DatePicker } from '../../components/ui/DatePicker';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import CustomSelect from '../../components/ui/CustomSelect';
import { getCompanies } from '../../api/companies';
import { ModalBackdrop, ModalHeader } from './components/DocUtils';

// ── Components & Icons ──

const IconUpload = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconFile = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" /><polyline points="13 2 13 9 20 9" />
  </svg>
);

const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ── Styles ──

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  animation: 'fadeIn 0.2s ease-out'
};

const modalContentStyle: React.CSSProperties = {
  background: 'var(--surface)', borderRadius: 16, padding: 0,
  width: '100%', maxHeight: '90vh', overflow: 'hidden',
  boxShadow: '0 24px 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
  animation: 'popIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  margin: '0 16px',
  transition: 'max-width 0.25s ease-in-out'
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1.5px solid var(--border)', background: 'var(--background)',
  color: 'var(--text-primary)', fontSize: 13, outline: 'none', transition: 'border-color 0.2s'
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block'
};

// ── Types ──

interface UploadFileItem {
  id: string;
  file: File;
  requiresSignature: boolean;
  expiresAt: string;
  visibility: 'everyone' | 'hr';
  companyId: number | null;
  useGlobal: boolean;
  expanded?: boolean;
  uploaded?: boolean;
  documentId?: number;
  matched?: boolean;
  matchedEmployee?: any;
}

interface UnmatchedItem {
  documentId: number;
  fileName: string;
  editableTitle: string;
  fileExtension: string;
  manualEmployeeId: number | null;
  companyId: number | null;
}

interface UploadedDocDetail {
  documentId: number;
  fileName: string;
  requiresSignature: boolean;
  expiresAt: string;
  visibility: 'everyone' | 'hr';
  companyId: number | null;
  companyName: string;
  assignedEmployeeId: number | null;
  assignedEmployeeName: string;
  fileObject: File;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  targetEmployeeId?: number | null;
  targetEmployeeName?: string | null;
}

export const UnifiedUploadWizard: React.FC<Props> = ({ onClose, onSuccess, targetEmployeeId, targetEmployeeName }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user, allowedCompanyIds = [] } = useAuth();
  const { isMobile } = useBreakpoint();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [files, setFiles] = useState<UploadFileItem[]>([]);
  const [uploading, setUploading] = useState(false);

  // Global Metadata
  const [globalRequiresSignature, setGlobalRequiresSignature] = useState(false);
  const [globalExpiresAt, setGlobalExpiresAt] = useState('');
  const [globalVisibility, setGlobalVisibility] = useState<'everyone' | 'hr'>('everyone');
  const [globalCompanyId, setGlobalCompanyId] = useState<number | null>(null);

  // Manual Assignment (Step 3)
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(false);
  const [unmatchedDocs, setUnmatchedDocs] = useState<UnmatchedItem[]>([]);

  // Companies List
  const [companies, setCompanies] = useState<Company[]>([]);

  // Uploaded Docs List (Step 4)
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocDetail[]>([]);
  const [hoveredDocId, setHoveredDocId] = useState<number | null>(null);

  // Preview Modal States (Stable URLs, no blinking)
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocName, setPreviewDocName] = useState<string>('');
  const [previewDocMimeType, setPreviewDocMimeType] = useState<string>('');

  const isConfirmedRef = useRef(false);
  const uploadedDocsRef = useRef(uploadedDocs);

  const isHrOrAdmin = user && ['admin', 'hr'].includes(user.role);

  // Keep ref in sync
  useEffect(() => {
    uploadedDocsRef.current = uploadedDocs;
  }, [uploadedDocs]);

  // Clean up any uploaded but unconfirmed documents on unmount
  useEffect(() => {
    return () => {
      if (!isConfirmedRef.current && uploadedDocsRef.current.length > 0) {
        uploadedDocsRef.current.forEach(doc => {
          deleteDocument(doc.documentId).catch(() => {});
        });
      }
    };
  }, []);

  // Return to step 1 if all documents are removed in step 4
  useEffect(() => {
    if (step === 4 && uploadedDocs.length === 0) {
      setStep(1);
    }
  }, [uploadedDocs, step]);

  // Fetch initial data
  useEffect(() => {
    setLoadingEmps(true);
    Promise.all([
      getEmployees({ status: 'active', excludeAdmins: false, limit: 1000 }).then(res => setEmployees(res.employees)),
      getCompanies().then(res => setCompanies(res))
    ])
      .catch(() => {})
      .finally(() => setLoadingEmps(false));
  }, []);

  const associatedCompanies = React.useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin' || user.isSuperAdmin) return companies;
    return companies.filter(c => c.id === user.companyId || allowedCompanyIds.includes(c.id));
  }, [companies, user, allowedCompanyIds]);

  // Auto-select company if only one is available
  useEffect(() => {
    if (associatedCompanies.length === 1 && !globalCompanyId) {
      handleGlobalCompany(associatedCompanies[0].id);
    }
  }, [associatedCompanies, globalCompanyId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    // Validation
    for (const f of selectedFiles) {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      const isArchive = ['.zip', '.rar', '.7z'].includes(ext);
      const maxSize = isArchive ? 50 * 1024 * 1024 : 10 * 1024 * 1024;

      if (f.size > maxSize) {
        showToast(isArchive ? t('documents.errorBulk') : t('documents.errorUpload'), 'error');
        return;
      }
    }

    // Clean up previously uploaded files if user changes files
    if (uploadedDocs.length > 0) {
      uploadedDocs.forEach(d => {
        deleteDocument(d.documentId).catch(() => {});
      });
      setUploadedDocs([]);
    }

    const items: UploadFileItem[] = selectedFiles.map((f, i) => ({
      id: `${f.name}-${i}-${Date.now()}`,
      file: f,
      requiresSignature: globalRequiresSignature,
      expiresAt: globalExpiresAt,
      visibility: globalVisibility,
      companyId: globalCompanyId,
      useGlobal: true,
      expanded: false
    }));

    setFiles(items);
    setStep(2);
  };

  // Global Settings Handlers
  const handleGlobalSignature = (val: boolean) => {
    setGlobalRequiresSignature(val);
    setFiles(prev => prev.map(item => item.useGlobal ? { ...item, requiresSignature: val } : item));
  };

  const handleGlobalExpiry = (val: string) => {
    setGlobalExpiresAt(val);
    setFiles(prev => prev.map(item => item.useGlobal ? { ...item, expiresAt: val } : item));
  };

  const handleGlobalVisibility = (val: 'everyone' | 'hr') => {
    setGlobalVisibility(val);
    setFiles(prev => prev.map(item => item.useGlobal ? { ...item, visibility: val } : item));
  };

  const handleGlobalCompany = (val: number | null) => {
    setGlobalCompanyId(val);
    setFiles(prev => prev.map(item => item.useGlobal ? { ...item, companyId: val } : item));
  };

  // Individual Settings Handlers
  const updateIndividualItem = (id: string, updates: Partial<UploadFileItem>) => {
    setFiles(prev => prev.map(item => item.id === id ? { ...item, ...updates, useGlobal: false } : item));
  };

  const toggleItemGlobal = (id: string, useGlobal: boolean) => {
    setFiles(prev => prev.map(item => {
      if (item.id === id) {
        if (useGlobal) {
          return {
            ...item,
            useGlobal: true,
            requiresSignature: globalRequiresSignature,
            expiresAt: globalExpiresAt,
            visibility: globalVisibility,
            companyId: globalCompanyId
          };
        } else {
          return { ...item, useGlobal: false };
        }
      }
      return item;
    }));
  };

  const toggleExpandItem = (id: string) => {
    setFiles(prev => prev.map(item => item.id === id ? { ...item, expanded: !item.expanded } : item));
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    } else if (step === 4) {
      if (unmatchedDocs.length > 0) {
        setStep(3);
      } else {
        setStep(2);
      }
    }
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;

    if (isHrOrAdmin) {
      for (const item of files) {
        if (!item.companyId) {
          showToast(t('companies.selectCompany', 'Select Company') + ` (${item.file.name})`, 'error');
          return;
        }
        if (!item.expiresAt) {
          showToast(t('employees.fieldRequired') + ` (${item.file.name})`, 'error');
          return;
        }
      }
    }

    setUploading(true);
    const unmatchedList: UnmatchedItem[] = [];
    const updatedFiles = [...files];

    for (let i = 0; i < updatedFiles.length; i++) {
      const item = updatedFiles[i];
      try {
        const visibleToRoles = item.visibility === 'hr'
          ? ['admin', 'hr']
          : ['admin', 'hr', 'area_manager', 'store_manager', 'employee'];

        if (item.uploaded && item.documentId) {
          // Sync changes in Step 2 if any, without actual employee assignment
          await updateDocumentGeneric(item.documentId, {
            title: item.file.name,
            employee_id: null, // Always unassigned before Step 4 Confirmation
            requires_signature: item.requiresSignature,
            expires_at: item.expiresAt || null,
            visible_to_roles: visibleToRoles
          });

          if (!item.matched) {
            const fileName = item.file.name;
            const lastDot = fileName.lastIndexOf('.');
            const initialTitle = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
            const extension = lastDot > 0 ? fileName.substring(lastDot) : '';
            unmatchedList.push({
              documentId: item.documentId,
              fileName,
              editableTitle: initialTitle,
              fileExtension: extension,
              manualEmployeeId: null,
              companyId: item.companyId
            });
          }
        } else {
          // Upload in simulation mode (does not save DB assignment, only checks matches in memory)
          const response = await uploadDocumentUnified(item.file, {
            requiresSignature: item.requiresSignature,
            expiresAt: item.expiresAt || null,
            visibleToRoles,
            employeeId: targetEmployeeId,
            companyId: item.companyId
          });

          if (response && response.documentId) {
            updatedFiles[i] = {
              ...item,
              uploaded: true,
              documentId: response.documentId,
              matched: response.matched,
              matchedEmployee: response.employee
            };

            if (!response.matched) {
              const fileName = response.fileName || item.file.name;
              const lastDot = fileName.lastIndexOf('.');
              const initialTitle = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
              const extension = lastDot > 0 ? fileName.substring(lastDot) : '';

              unmatchedList.push({
                documentId: response.documentId,
                fileName,
                editableTitle: initialTitle,
                fileExtension: extension,
                manualEmployeeId: null,
                companyId: item.companyId
              });
            }
          }
        }
      } catch (err: any) {
        if (err.response?.data?.code === 'EXPIRY_DATE_REQUIRED') {
          showToast(t('employees.fieldRequired') + ` (${item.file.name})`, 'error');
        } else {
          showToast(t('documents.errorUpload') + ` (${item.file.name})`, 'error');
        }
        setUploading(false);
        return;
      }
    }

    setFiles(updatedFiles);
    setUploading(false);

    const initialUploadedDocs: UploadedDocDetail[] = updatedFiles.map(item => {
      const compName = companies.find(c => c.id === item.companyId)?.name || 'No Company';
      return {
        documentId: item.documentId!,
        fileName: item.file.name,
        requiresSignature: item.requiresSignature,
        expiresAt: item.expiresAt,
        visibility: item.visibility,
        companyId: item.companyId,
        companyName: compName,
        assignedEmployeeId: item.matchedEmployee?.id || null,
        assignedEmployeeName: item.matchedEmployee ? `${item.matchedEmployee.name} ${item.matchedEmployee.surname}` : 'Unassigned',
        fileObject: item.file
      };
    });

    setUploadedDocs(initialUploadedDocs);

    if (unmatchedList.length > 0) {
      const updatedUnmatchedList = unmatchedList.map(newUn => {
        const existingUn = unmatchedDocs.find(un => un.documentId === newUn.documentId);
        return existingUn ? { ...newUn, manualEmployeeId: existingUn.manualEmployeeId } : newUn;
      });
      setUnmatchedDocs(updatedUnmatchedList);
      setStep(3);
    } else {
      setStep(4);
    }
  };

  const handleStep3Save = () => {
    for (const doc of unmatchedDocs) {
      if (!doc.manualEmployeeId) {
        showToast(t('documents.selectEmployee', 'Please assign all documents to an employee'), 'error');
        return;
      }
    }

    setUploadedDocs(prev => prev.map(doc => {
      const unmatched = unmatchedDocs.find(u => u.documentId === doc.documentId);
      if (unmatched) {
        const selectedEmp = employees.find(e => e.id === unmatched.manualEmployeeId);
        return {
          ...doc,
          assignedEmployeeId: unmatched.manualEmployeeId,
          assignedEmployeeName: selectedEmp ? `${selectedEmp.name} ${selectedEmp.surname}` : 'Unassigned'
        };
      }
      return doc;
    }));
    setStep(4);
  };

  const handleConfirmSave = async () => {
    isConfirmedRef.current = true;
    setUploading(true);
    try {
      // Activating final assignments ONLY when Confirm is clicked
      await Promise.all(
        uploadedDocs.map(async (doc) => {
          const visibleToRoles = doc.visibility === 'hr'
            ? ['admin', 'hr']
            : ['admin', 'hr', 'area_manager', 'store_manager', 'employee'];

          await updateDocumentGeneric(doc.documentId, {
            title: doc.fileName,
            employee_id: doc.assignedEmployeeId, // Actual assignment happens here!
            requires_signature: doc.requiresSignature,
            expires_at: doc.expiresAt || null,
            visible_to_roles: visibleToRoles
          });
        })
      );
      showToast(t('documents.uploaded'), 'success');
      onSuccess();
      onClose();
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveDocument = async (docId: number) => {
    try {
      await deleteDocument(docId);
      setUploadedDocs(prev => prev.filter(d => d.documentId !== docId));
      setFiles(prev => prev.filter(d => d.documentId !== docId));
      showToast(t('documents.deleted', 'Document removed successfully'), 'success');
    } catch {
      showToast(t('common.error'), 'error');
    }
  };

  const handleUnmatchedTitleChange = (idx: number, title: string) => {
    setUnmatchedDocs(prev => prev.map((item, i) => i === idx ? { ...item, editableTitle: title } : item));
  };

  const handleUnmatchedEmpChange = (idx: number, empId: number | null) => {
    setUnmatchedDocs(prev => prev.map((item, i) => i === idx ? { ...item, manualEmployeeId: empId } : item));
  };

  // Preview management
  const openPreview = (doc: UploadedDocDetail) => {
    if (previewDocUrl) {
      URL.revokeObjectURL(previewDocUrl);
    }
    const url = URL.createObjectURL(doc.fileObject);
    setPreviewDocUrl(url);
    setPreviewDocName(doc.fileName);
    setPreviewDocMimeType(doc.fileObject.type);
  };

  const closePreview = () => {
    if (previewDocUrl) {
      URL.revokeObjectURL(previewDocUrl);
      setPreviewDocUrl(null);
    }
  };

  const modalWidth = 650; // Cozy, readable width for stacked layout

  return createPortal(
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={{ ...modalContentStyle, maxWidth: modalWidth }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('documents.uploadWizardTitle')}</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: step === 1 ? 'var(--primary)' : 'var(--border)' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: step === 2 ? 'var(--primary)' : 'var(--border)' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: step === 3 ? 'var(--primary)' : 'var(--border)' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: step === 4 ? 'var(--primary)' : 'var(--border)' }} />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          {step === 1 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {targetEmployeeName && (
                <div style={{ padding: '10px 14px', background: 'var(--background)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />
                  {t('documents.assignedTo', 'Assigned to')}: <strong>{targetEmployeeName}</strong>
                </div>
              )}
              <label
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  height: 200, border: '2px dashed var(--border)', borderRadius: 12, cursor: 'pointer',
                  transition: 'all 0.2s', background: 'var(--background)'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ background: 'rgba(2,132,199,0.1)', color: 'var(--primary)', padding: 12, borderRadius: 12, marginBottom: 12 }}>
                  <IconUpload />
                </div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{t('documents.chooseFile')} (Multiple files allowed)</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  ZIP (max 50MB) · PDF, JPG, PNG (max 10MB)
                </div>
                <input type="file" multiple hidden onChange={handleFileChange} accept=".zip,.rar,.7z,.pdf,.jpg,.jpeg,.png,.webp,application/zip,application/x-zip-compressed,application/rar,application/x-rar-compressed,application/x-7z-compressed,application/octet-stream" />
              </label>
            </div>
          ) : step === 2 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Global Settings Section */}
              <div style={{ padding: '16px', background: 'var(--background)', borderRadius: 12, border: '1.5px solid var(--primary)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>GLOBAL SETTINGS (Applies to all documents)</div>

                <div style={{ display: 'flex', gap: isMobile ? 16 : 20, flexDirection: isMobile ? 'column' : 'row' }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>{t('documents.requiresSignature')}</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => handleGlobalSignature(true)}
                        style={{
                          flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid ' + (globalRequiresSignature ? 'var(--primary)' : 'var(--border)'),
                          background: globalRequiresSignature ? 'rgba(2,132,199,0.05)' : 'var(--surface)',
                          color: globalRequiresSignature ? 'var(--primary)' : 'var(--text-secondary)',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                        }}
                      >
                        {globalRequiresSignature && <IconCheck />} {t('common.yes')}
                      </button>
                      <button
                        onClick={() => handleGlobalSignature(false)}
                        style={{
                          flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid ' + (!globalRequiresSignature ? 'var(--primary)' : 'var(--border)'),
                          background: !globalRequiresSignature ? 'rgba(2,132,199,0.05)' : 'var(--surface)',
                          color: !globalRequiresSignature ? 'var(--primary)' : 'var(--text-secondary)',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                        }}
                      >
                        {!globalRequiresSignature && <IconCheck />} {t('common.no')}
                      </button>
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>
                      {t('documents.expiryDate')} {isHrOrAdmin && <span style={{ color: '#DC2626' }}>*</span>}
                    </label>
                    <DatePicker value={globalExpiresAt} onChange={handleGlobalExpiry} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: isMobile ? 16 : 20, flexDirection: isMobile ? 'column' : 'row' }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>{t('documents.visibility')}</label>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button
                        onClick={() => handleGlobalVisibility('everyone')}
                        style={{
                          flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid ' + (globalVisibility === 'everyone' ? 'var(--primary)' : 'var(--border)'),
                          background: globalVisibility === 'everyone' ? 'rgba(2,132,199,0.05)' : 'var(--surface)',
                          color: globalVisibility === 'everyone' ? 'var(--primary)' : 'var(--text-secondary)',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                        }}
                      >
                        {globalVisibility === 'everyone' && <IconCheck />} {t('documents.visibilityEveryone')}
                      </button>
                      <button
                        onClick={() => handleGlobalVisibility('hr')}
                        style={{
                          flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid ' + (globalVisibility === 'hr' ? 'var(--primary)' : 'var(--border)'),
                          background: globalVisibility === 'hr' ? 'rgba(2,132,199,0.05)' : 'var(--surface)',
                          color: globalVisibility === 'hr' ? 'var(--primary)' : 'var(--text-secondary)',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                        }}
                      >
                        {globalVisibility === 'hr' && <IconCheck />} {t('documents.visibilityHR')}
                      </button>
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>{t('companies.company', 'Company')} <span style={{ color: '#DC2626' }}>*</span></label>
                    <CustomSelect
                      value={globalCompanyId ? String(globalCompanyId) : null}
                      onChange={(val) => handleGlobalCompany(val ? Number(val) : null)}
                      options={associatedCompanies.map(c => ({ value: String(c.id), label: c.name }))}
                      placeholder={t('companies.selectCompany', 'Select Company')}
                    />
                  </div>
                </div>
              </div>

              {/* Individual Document Settings Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    INDIVIDUAL DOCUMENTS ({files.length})
                  </div>
                  <button
                    onClick={() => setStep(1)}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                  >
                    + Add / Change Files
                  </button>
                </div>

                {files.map(item => (
                  <div key={item.id} style={{ background: 'var(--background)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <div
                      onClick={() => toggleExpandItem(item.id)}
                      style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: item.expanded ? 'var(--surface)' : 'transparent' }}
                    >
                      <div style={{ color: 'var(--primary)' }}><IconFile /></div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.file.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB · {item.useGlobal ? 'Using Global Settings' : 'Custom Settings'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={item.useGlobal}
                            onChange={e => toggleItemGlobal(item.id, e.target.checked)}
                          />
                          Use Global
                        </label>
                        <div style={{ transform: item.expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'flex', alignItems: 'center' }}>
                          <IconChevronDown />
                        </div>
                      </div>
                    </div>

                    {item.expanded && (
                      <div style={{ padding: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', gap: isMobile ? 16 : 20, flexDirection: isMobile ? 'column' : 'row' }}>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>{t('documents.requiresSignature')}</label>
                            <div style={{ display: 'flex', gap: 10 }}>
                              <button
                                onClick={() => updateIndividualItem(item.id, { requiresSignature: true })}
                                style={{
                                  flex: 1, padding: '8px', borderRadius: 8, border: '1.5px solid ' + (item.requiresSignature ? 'var(--primary)' : 'var(--border)'),
                                  background: item.requiresSignature ? 'rgba(2,132,199,0.05)' : 'var(--surface)',
                                  color: item.requiresSignature ? 'var(--primary)' : 'var(--text-secondary)',
                                  fontSize: 12, fontWeight: 600, cursor: 'pointer'
                                }}
                              >
                                {t('common.yes')}
                              </button>
                              <button
                                onClick={() => updateIndividualItem(item.id, { requiresSignature: false })}
                                style={{
                                  flex: 1, padding: '8px', borderRadius: 8, border: '1.5px solid ' + (!item.requiresSignature ? 'var(--primary)' : 'var(--border)'),
                                  background: !item.requiresSignature ? 'rgba(2,132,199,0.05)' : 'var(--surface)',
                                  color: !item.requiresSignature ? 'var(--primary)' : 'var(--text-secondary)',
                                  fontSize: 12, fontWeight: 600, cursor: 'pointer'
                                }}
                              >
                                {t('common.no')}
                              </button>
                            </div>
                          </div>

                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>{t('documents.expiryDate')}</label>
                            <DatePicker
                              value={item.expiresAt}
                              onChange={val => updateIndividualItem(item.id, { expiresAt: val })}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: isMobile ? 16 : 20, flexDirection: isMobile ? 'column' : 'row' }}>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>{t('documents.visibility')}</label>
                            <div style={{ display: 'flex', gap: 12 }}>
                              <button
                                onClick={() => updateIndividualItem(item.id, { visibility: 'everyone' })}
                                style={{
                                  flex: 1, padding: '8px', borderRadius: 8, border: '1.5px solid ' + (item.visibility === 'everyone' ? 'var(--primary)' : 'var(--border)'),
                                  background: item.visibility === 'everyone' ? 'rgba(2,132,199,0.05)' : 'var(--surface)',
                                  color: item.visibility === 'everyone' ? 'var(--primary)' : 'var(--text-secondary)',
                                  fontSize: 12, fontWeight: 600, cursor: 'pointer'
                                }}
                              >
                                {t('documents.visibilityEveryone')}
                              </button>
                              <button
                                onClick={() => updateIndividualItem(item.id, { visibility: 'hr' })}
                                style={{
                                  flex: 1, padding: '8px', borderRadius: 8, border: '1.5px solid ' + (item.visibility === 'hr' ? 'var(--primary)' : 'var(--border)'),
                                  background: item.visibility === 'hr' ? 'rgba(2,132,199,0.05)' : 'var(--surface)',
                                  color: item.visibility === 'hr' ? 'var(--primary)' : 'var(--text-secondary)',
                                  fontSize: 12, fontWeight: 600, cursor: 'pointer'
                                }}
                              >
                                {t('documents.visibilityHR')}
                              </button>
                            </div>
                          </div>

                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>{t('companies.company', 'Company')} <span style={{ color: '#DC2626' }}>*</span></label>
                            <CustomSelect
                              value={item.companyId ? String(item.companyId) : null}
                              onChange={(val) => updateIndividualItem(item.id, { companyId: val ? Number(val) : null })}
                              options={associatedCompanies.map(c => ({ value: String(c.id), label: c.name }))}
                              placeholder={t('companies.selectCompany', 'Select Company')}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : step === 3 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, fontSize: 13, color: '#B45309', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                {t('documents.noAutoMatchFound', 'No auto-match found. Please assign manually.')}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  UNASSIGNED DOCUMENTS ({unmatchedDocs.length})
                </div>

                {unmatchedDocs.map((doc, idx) => (
                  <div key={doc.documentId} style={{ padding: 16, background: 'var(--background)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{doc.fileName}</div>

                    <div style={{ display: 'flex', gap: isMobile ? 16 : 12, flexDirection: isMobile ? 'column' : 'row' }}>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>{t('documents.fileName')}</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            value={doc.editableTitle}
                            onChange={e => handleUnmatchedTitleChange(idx, e.target.value)}
                            style={inputStyle}
                          />
                          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{doc.fileExtension}</span>
                        </div>
                      </div>

                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>{t('documents.assigned')}</label>
                        <select
                          value={doc.manualEmployeeId || ''}
                          onChange={e => handleUnmatchedEmpChange(idx, e.target.value ? Number(e.target.value) : null)}
                          style={inputStyle}
                          disabled={loadingEmps}
                        >
                          <option value="">{t('documents.selectEmployee')}</option>
                          {employees
                            .filter(emp => !doc.companyId || emp.companyId === doc.companyId)
                            .map(emp => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name} {emp.surname} ({emp.uniqueId || emp.role}){emp.companyName ? ` - ${emp.companyName}` : ''}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : step === 4 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Alert Message Bar */}
              <div style={{ padding: '12px 16px', background: 'rgba(21,128,61,0.1)', border: '1px solid rgba(21,128,61,0.3)', borderRadius: 10, fontSize: 13, color: '#15803D', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>✓</span>
                {t('documents.confirmTitle', 'Review and confirm document upload details')}
              </div>

              {/* Uploaded Documents List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {uploadedDocs.map(doc => {
                  const isHovered = hoveredDocId === doc.documentId;
                  return (
                    <div
                      key={doc.documentId}
                      onMouseEnter={() => setHoveredDocId(doc.documentId)}
                      onMouseLeave={() => setHoveredDocId(null)}
                      style={{
                        borderRadius: 12, border: '1.5px solid var(--border)',
                        background: 'var(--surface)', overflow: 'hidden', display: 'flex', flexDirection: 'column'
                      }}
                    >
                      {/* Document Row Header (Full Width Bar) */}
                      <div
                        style={{
                          padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14,
                          background: 'var(--background)', borderBottom: '1.5px solid var(--border-light)',
                          position: 'relative'
                        }}
                      >
                        <div style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}><IconFile /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {doc.fileName}
                          </div>
                        </div>

                        {/* Hover View and Remove Action buttons */}
                        <div style={{ display: 'flex', gap: 8, opacity: isHovered ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: isHovered ? 'auto' : 'none' }}>
                          <button
                            onClick={() => openPreview(doc)}
                            style={{
                              padding: '6px 12px', borderRadius: 6, border: '1px solid var(--primary)',
                              background: 'transparent', color: 'var(--primary)', cursor: 'pointer',
                              fontSize: 12, fontWeight: 600, transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'var(--primary)';
                              e.currentTarget.style.color = '#fff';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = 'var(--primary)';
                            }}
                          >
                            {t('common.view', 'View')}
                          </button>
                          <button
                            onClick={() => handleRemoveDocument(doc.documentId)}
                            style={{
                              padding: '6px 12px', borderRadius: 6, border: '1px solid #DC2626',
                              background: 'transparent', color: '#DC2626', cursor: 'pointer',
                              fontSize: 12, fontWeight: 600, transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = '#DC2626';
                              e.currentTarget.style.color = '#fff';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = '#DC2626';
                            }}
                          >
                            {t('common.remove', 'Remove')}
                          </button>
                        </div>
                      </div>

                      {/* Document Details Block (styled nicely matching screenshot) */}
                      <div
                        style={{
                          padding: '16px 20px', background: '#F4F2EE', // warm beige background
                          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                          gap: '14px 20px', borderTop: 'none'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#5C5B57', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            COMPANY
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginTop: 4 }}>
                            {doc.companyName}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#5C5B57', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            ASSIGNING TO
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginTop: 4 }}>
                            {doc.assignedEmployeeName}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#5C5B57', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            REQUIRES SIGNATURE
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginTop: 4 }}>
                            {doc.requiresSignature ? 'Yes' : 'No'}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#5C5B57', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            EXPIRY DATE
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginTop: 4 }}>
                            {doc.expiresAt || '—'}
                          </div>
                        </div>

                        <div style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#5C5B57', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            VISIBILITY
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginTop: 4 }}>
                            {doc.visibility === 'hr' ? 'Only HR' : 'Everyone'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-light)', display: 'flex', gap: 12, justifyContent: 'flex-end', background: 'var(--background)' }}>
          {step > 1 && (
            <button
              onClick={handleBack}
              data-testid="wizard-back-button"
              style={{ marginRight: 'auto', padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              {t('common.back', 'Back')}
            </button>
          )}
          <button
            onClick={onClose}
            data-testid="wizard-cancel-button"
            style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            {t('common.cancel')}
          </button>
          {step === 2 ? (
            <button
              onClick={handleSubmit}
              disabled={uploading}
              data-testid="wizard-submit-button"
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--primary)',
                color: '#fff', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
                opacity: uploading ? 0.7 : 1, transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(2,132,199,0.2)'
              }}
            >
              {uploading ? t('common.loading') : t('documents.uploadWizardTitle')}
            </button>
          ) : step === 3 ? (
            <button
              onClick={handleStep3Save}
              style={{
                padding: '10px 32px', borderRadius: 8, border: 'none', background: 'var(--primary)',
                color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(2,132,199,0.2)'
              }}
            >
              {t('common.save')}
            </button>
          ) : step === 4 ? (
            <button
              onClick={handleConfirmSave}
              disabled={uploading}
              style={{
                padding: '10px 32px', borderRadius: 8, border: 'none', background: 'var(--primary)',
                color: '#fff', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
                opacity: uploading ? 0.7 : 1, transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(2,132,199,0.2)'
              }}
            >
              {uploading ? t('common.loading') : t('common.confirm', 'Confirm')}
            </button>
          ) : null}
        </div>
      </div>

      {/* Preview Modal Overlay (Stops bubbling to keep wizard open) */}
      {previewDocUrl && (
        <div onClick={e => e.stopPropagation()}>
          <ModalBackdrop onClose={closePreview} width={800}>
            <ModalHeader title={previewDocName} onClose={closePreview} />
            <div style={{ width: '100%', height: '75vh', background: 'var(--background)', borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {['zip', 'rar', '7z'].some(ext => previewDocName.toLowerCase().endsWith(`.${ext}`)) ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
                  <div style={{ fontSize: 48 }}>📦</div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {t('documents.previewArchiveTitle', 'Archive preview is not supported')}
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', maxWidth: 400 }}>
                    {t('documents.previewArchiveText', 'To view the contents of this archive, please download and extract the file.')}
                  </p>
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = previewDocUrl;
                      link.setAttribute('download', previewDocName);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                    }}
                    style={{
                      padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)',
                      color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                      boxShadow: '0 4px 12px rgba(2,132,199,0.2)'
                    }}
                  >
                    {t('documents.download', 'Download')}
                  </button>
                </div>
              ) : previewDocMimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].some(ext => previewDocName.toLowerCase().endsWith(`.${ext}`)) ? (
                <img
                  src={previewDocUrl}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  alt={previewDocName}
                />
              ) : (
                <iframe
                  src={previewDocUrl}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title={previewDocName}
                />
              )}
            </div>
          </ModalBackdrop>
        </div>
      )}
    </div>,
    document.body
  );
};
