import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { uploadDocumentUnified } from '../../api/documents';
import { Employee } from '../../types';
import { createPortal } from 'react-dom';

// ── Components & Icons ──

const IconUpload = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const IconFile = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/>
  </svg>
);

const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
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
  width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'hidden',
  boxShadow: '0 24px 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
  animation: 'popIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
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

// ── Main Component ──

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  targetEmployee?: Employee | null;
}

export const UnifiedUploadWizard: React.FC<Props> = ({ onClose, onSuccess, targetEmployee }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user } = useAuth();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Metadata
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [visibility, setVisibility] = useState<'everyone' | 'hr'>('everyone');

  const isHrOrAdmin = user && ['admin', 'hr'].includes(user.role);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Validation
    const isZip = selected.name.toLowerCase().endsWith('.zip');
    const maxSize = isZip ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    
    if (selected.size > maxSize) {
      showToast(isZip ? t('documents.errorBulk') : t('documents.errorUpload'), 'error');
      return;
    }

    setFile(selected);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!file) return;

    if (isHrOrAdmin && !expiresAt) {
      showToast(t('employees.fieldRequired'), 'error');
      return;
    }

    setUploading(true);
    
    try {
      const visibleToRoles = visibility === 'hr' 
        ? ['admin', 'hr'] 
        : ['admin', 'hr', 'area_manager', 'store_manager', 'employee'];

      await uploadDocumentUnified(file, {
        requiresSignature,
        expiresAt: expiresAt || null,
        visibleToRoles,
      });

      showToast(t('documents.uploaded'), 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(t('documents.errorUpload'), 'error');
    } finally {
      setUploading(false);
    }
  };

  return createPortal(
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('documents.uploadWizardTitle')}</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: step === 1 ? 'var(--primary)' : 'var(--border)' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: step === 2 ? 'var(--primary)' : 'var(--border)' }} />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          {step === 1 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t('documents.chooseFile')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  ZIP (max 50MB) · PDF, JPG, PNG (max 10MB)
                </div>
                <input type="file" hidden onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png,.webp,.zip,application/zip,application/x-zip-compressed" />
              </label>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* File Summary */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--background)', borderRadius: 12, border: '1.5px solid var(--border)' }}>
                <div style={{ color: 'var(--primary)' }}><IconFile /></div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {file?.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {(file!.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <button 
                  onClick={() => setStep(1)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                >
                  {t('documents.changeFile')}
                </button>
              </div>


              <div style={{ display: 'flex', gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>{t('documents.requiresSignature')}</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button 
                      onClick={() => setRequiresSignature(true)}
                      style={{ 
                        flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid ' + (requiresSignature ? 'var(--primary)' : 'var(--border)'),
                        background: requiresSignature ? 'rgba(2,132,199,0.05)' : 'var(--surface)',
                        color: requiresSignature ? 'var(--primary)' : 'var(--text-secondary)',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                      }}
                    >
                      {requiresSignature && <IconCheck />} {t('common.yes')}
                    </button>
                    <button 
                      onClick={() => setRequiresSignature(false)}
                      style={{ 
                        flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid ' + (!requiresSignature ? 'var(--primary)' : 'var(--border)'),
                        background: !requiresSignature ? 'rgba(2,132,199,0.05)' : 'var(--surface)',
                        color: !requiresSignature ? 'var(--primary)' : 'var(--text-secondary)',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                      }}
                    >
                      {!requiresSignature && <IconCheck />} {t('common.no')}
                    </button>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>
                    {t('documents.expiryDate')} {isHrOrAdmin && <span style={{ color: '#DC2626' }}>*</span>}
                  </label>
                  <input 
                    type="date" 
                    value={expiresAt} 
                    onChange={e => setExpiresAt(e.target.value)} 
                    style={inputStyle} 
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>{t('documents.visibility')}</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button 
                    onClick={() => setVisibility('everyone')}
                    style={{ 
                      flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid ' + (visibility === 'everyone' ? 'var(--primary)' : 'var(--border)'),
                      background: visibility === 'everyone' ? 'rgba(2,132,199,0.05)' : 'var(--surface)',
                      color: visibility === 'everyone' ? 'var(--primary)' : 'var(--text-secondary)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                  >
                    {visibility === 'everyone' && <IconCheck />} {t('documents.visibilityEveryone')}
                  </button>
                  <button 
                    onClick={() => setVisibility('hr')}
                    style={{ 
                      flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid ' + (visibility === 'hr' ? 'var(--primary)' : 'var(--border)'),
                      background: visibility === 'hr' ? 'rgba(2,132,199,0.05)' : 'var(--surface)',
                      color: visibility === 'hr' ? 'var(--primary)' : 'var(--text-secondary)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                  >
                    {visibility === 'hr' && <IconCheck />} {t('documents.visibilityHR')}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  {visibility === 'everyone' 
                    ? t('documents.visibilityEveryoneDesc') 
                    : t('documents.visibilityHRDesc')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-light)', display: 'flex', gap: 12, justifyContent: 'flex-end', background: 'var(--background)' }}>
          <button 
            onClick={onClose}
            style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            {t('common.cancel')}
          </button>
          {step === 2 && (
            <button 
              onClick={handleSubmit}
              disabled={uploading}
              style={{ 
                padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--primary)', 
                color: '#fff', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
                opacity: uploading ? 0.7 : 1, transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(2,132,199,0.2)'
              }}
            >
              {uploading ? t('common.loading') : t('documents.uploadWizardTitle')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
