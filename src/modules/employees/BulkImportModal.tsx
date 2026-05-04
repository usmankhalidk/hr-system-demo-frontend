import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Upload, X, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getCompanies } from '../../api/companies';
import { getStores } from '../../api/stores';
import { getEmployees } from '../../api/employees';
import { Company, Store, Employee, UserRole } from '../../types';
import { parseExcelFile, processRow, ParsedRow, ImportResult } from './bulkImportUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Phase = 'upload' | 'preview' | 'processing' | 'done';

export function BulkImportModal({ open, onClose, onComplete }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Reference data for name→id lookups
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [supervisors, setSupervisors] = useState<Employee[]>([]);

  useEffect(() => {
    if (!open) return;
    setPhase('upload'); setFile(null); setRows([]); setResults([]); setProgress(0); setError(null);
    // Load reference data
    getCompanies().then(setCompanies).catch(() => {});
    getStores().then(setStores).catch(() => {});
    getEmployees({ limit: 500 }).then(r => setSupervisors(r.employees.filter(
      (e: Employee) => ['admin','hr','area_manager','store_manager'].includes(e.role)
    ))).catch(() => {});
  }, [open]);

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError(t('employees.bulkImportAccepted', 'Accepted formats: .xlsx, .xls'));
      return;
    }
    setFile(f);
    try {
      const parsed = await parseExcelFile(f);
      if (parsed.length === 0) { setError(t('employees.bulkImportNoData', 'No valid data rows found.')); return; }
      setRows(parsed);
      setPhase('preview');
    } catch {
      setError(t('employees.bulkImportNoData', 'Failed to parse file.'));
    }
  }, [t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const startImport = useCallback(async () => {
    setPhase('processing'); setProgress(0); setResults([]);
    const allResults: ImportResult[] = [];
    for (let i = 0; i < rows.length; i++) {
      const result = await processRow(rows[i], companies, stores, supervisors);
      allResults.push(result);
      setProgress(i + 1);
      setResults([...allResults]);
    }
    setPhase('done');
    if (allResults.some(r => r.success)) onComplete();
  }, [rows, companies, stores, supervisors, onComplete]);

  if (!open) return null;

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const headers = rows.length > 0 ? Object.keys(rows[0].data) : [];

  const S = {
    backdrop: { position: 'fixed' as const, inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,33,55,0.48)', backdropFilter: 'blur(3px)' },
    card: { background: 'var(--surface)', borderRadius: '16px', width: 'min(680px, 95vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' as const, boxShadow: '0 24px 60px rgba(0,0,0,0.22)', overflow: 'hidden' },
    header: { padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    body: { flex: 1, overflowY: 'auto' as const, padding: '24px' },
    footer: { padding: '14px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface-warm)', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0 },
    btn: { padding: '9px 20px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', border: 'none', transition: 'background 0.15s' },
  };

  return createPortal(
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.card} onClick={e => e.stopPropagation()}>
        {/* Accent stripe */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent) 0%, var(--primary) 100%)', flexShrink: 0 }} />

        {/* Header */}
        <div style={S.header}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: 0, letterSpacing: '-0.02em' }}>
              {t('employees.bulkImportTitle', 'Import Employees from Excel')}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0', fontFamily: 'var(--font-body)' }}>
              {t('employees.bulkImportSubtitle', 'Upload an Excel file to create multiple employees at once.')}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '22px', lineHeight: 1, padding: '4px 6px', borderRadius: 'var(--radius-sm)' }}>×</button>
        </div>

        {/* Body */}
        <div style={S.body}>

          {/* ── UPLOAD phase ── */}
          {phase === 'upload' && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '14px', padding: '56px 24px', textAlign: 'center', cursor: 'pointer',
                background: dragOver ? 'rgba(139,105,20,0.06)' : 'var(--surface-warm)',
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <Upload size={36} color={dragOver ? 'var(--accent)' : 'var(--text-muted)'} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                {t('employees.bulkImportDropzone', 'Drag & drop Excel file here, or click to browse')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {t('employees.bulkImportAccepted', 'Accepted formats: .xlsx, .xls')}
              </div>
            </div>
          )}

          {/* ── PREVIEW phase ── */}
          {phase === 'preview' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 14px', background: 'var(--surface-warm)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <FileSpreadsheet size={20} color="var(--accent)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file?.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('employees.bulkImportRowsFound', { count: rows.length, defaultValue: '{{count}} rows found' })}</div>
                </div>
                <button onClick={() => { setPhase('upload'); setFile(null); setRows([]); }} style={{ ...S.btn, background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '5px 12px', fontSize: 11 }}>
                  {t('employees.bulkImportChangeFile', 'Change')}
                </button>
              </div>
              <div style={{ overflowX: 'auto', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-warm)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)' }}>#</th>
                      {headers.map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map(row => (
                      <tr key={row.rowIndex} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '7px 10px', color: 'var(--text-muted)', fontSize: 11 }}>{row.rowIndex}</td>
                        {headers.map(h => (
                          <td key={h} style={{ padding: '7px 10px', color: 'var(--text-secondary)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {String(row.data[h] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 5 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                  ... and {rows.length - 5} more rows
                </div>
              )}
            </div>
          )}

          {/* ── PROCESSING phase ── */}
          {phase === 'processing' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(13,33,55,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <FileSpreadsheet size={22} color="var(--primary)" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                {t('employees.bulkImportProcessing', 'Processing employees...')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                {t('employees.bulkImportProgress', { current: progress, total: rows.length, defaultValue: '{{current}} of {{total}} processed' })}
              </div>
              <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', maxWidth: 400, margin: '0 auto' }}>
                <div style={{ height: '100%', width: `${(progress / rows.length) * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--primary))', borderRadius: 4, transition: 'width 0.3s ease' }} />
              </div>
              {results.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16 }}>
                  <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>✅ {results.filter(r => r.success).length}</span>
                  <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>❌ {results.filter(r => !r.success).length}</span>
                </div>
              )}
            </div>
          )}

          {/* ── DONE phase ── */}
          {phase === 'done' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: successCount > 0 ? 'rgba(21,128,61,0.12)' : 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  {successCount > 0 ? <CheckCircle2 size={28} color="var(--success)" /> : <XCircle size={28} color="var(--danger)" />}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', marginBottom: 4 }}>
                  {t('employees.bulkImportComplete', 'Import Complete')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
                <div style={{ padding: '12px 20px', borderRadius: 'var(--radius)', background: 'rgba(21,128,61,0.08)', border: '1px solid rgba(21,128,61,0.2)', textAlign: 'center', minWidth: 120 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)', fontFamily: 'var(--font-display)' }}>{successCount}</div>
                  <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>{t('employees.bulkImportSuccessCount', { count: successCount, defaultValue: 'Created' })}</div>
                </div>
                <div style={{ padding: '12px 20px', borderRadius: 'var(--radius)', background: failCount > 0 ? 'rgba(220,38,38,0.06)' : 'var(--surface-warm)', border: `1px solid ${failCount > 0 ? 'rgba(220,38,38,0.15)' : 'var(--border)'}`, textAlign: 'center', minWidth: 120 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: failCount > 0 ? 'var(--danger)' : 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>{failCount}</div>
                  <div style={{ fontSize: 11, color: failCount > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600 }}>{t('employees.bulkImportFailCount', { count: failCount, defaultValue: 'Failed' })}</div>
                </div>
              </div>
              {failCount > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface-warm)' }}>
                  {results.filter(r => !r.success).map(r => (
                    <div key={r.rowIndex} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <AlertTriangle size={13} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Row {r.rowIndex}: </span>
                        <span style={{ fontSize: 11, color: 'var(--danger)' }}>{r.error}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Global error */}
          {error && (
            <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <XCircle size={14} color="var(--danger)" />
              <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          {phase === 'upload' && (
            <button onClick={onClose} style={{ ...S.btn, background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              {t('common.cancel')}
            </button>
          )}
          {phase === 'preview' && (
            <>
              <button onClick={() => { setPhase('upload'); setFile(null); setRows([]); }} style={{ ...S.btn, background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                {t('common.back')}
              </button>
              <button onClick={startImport} style={{ ...S.btn, background: 'var(--primary)', color: '#fff', boxShadow: '0 2px 8px rgba(13,33,55,0.18)' }}>
                {t('employees.bulkImportStart', 'Start Import')} ({rows.length})
              </button>
            </>
          )}
          {phase === 'done' && (
            <>
              <button onClick={() => { setPhase('upload'); setFile(null); setRows([]); setResults([]); }} style={{ ...S.btn, background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                {t('employees.bulkImportNewImport', 'New Import')}
              </button>
              <button onClick={onClose} style={{ ...S.btn, background: 'var(--primary)', color: '#fff' }}>
                {t('employees.bulkImportDone', 'Done')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default BulkImportModal;
