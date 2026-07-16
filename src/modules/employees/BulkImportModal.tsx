import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Upload, X, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getCompanies } from '../../api/companies';
import { getStores } from '../../api/stores';
import { getEmployees } from '../../api/employees';
import { Company, Store, Employee, UserRole } from '../../types';
import { parseExcelFile, processRow, ParsedRow, ImportResult, COLUMN_MAP } from './bulkImportUtils';
import CustomSelect from '../../components/ui/CustomSelect';

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
  const [guideOpen, setGuideOpen] = useState(false);
  const [isEditingData, setIsEditingData] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [pendingRows, setPendingRows] = useState<ParsedRow[]>([]);
  const [pendingHeaders, setPendingHeaders] = useState<string[]>([]);

  // Reference data for name→id lookups
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [supervisors, setSupervisors] = useState<Employee[]>([]);

  useEffect(() => {
    if (!open) return;
    setPhase('upload'); setFile(null); setRows([]); setResults([]); setProgress(0); setError(null); setGuideOpen(false);
    setShowMappingModal(false); setPendingRows([]); setPendingHeaders([]);
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
      
      const fileHeaders = Object.keys(parsed[0].data);
      const mappedFields = new Set<string>();
      for (const h of fileHeaders) {
        const key = COLUMN_MAP[h.trim().toLowerCase()];
        if (key) mappedFields.add(key);
      }
      
      const requiredKeys = ['name', 'surname', 'email', 'role', 'personalEmail', 'companyName', 'storeName'];
      const missingRequired = requiredKeys.filter(k => !mappedFields.has(k));
      
      if (missingRequired.length > 0) {
        setPendingRows(parsed);
        setPendingHeaders(fileHeaders);
        setShowMappingModal(true);
      } else {
        setRows(parsed);
        setPhase('preview');
      }
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
      const result = await processRow(rows[i], companies, stores, supervisors, t);
      allResults.push(result);
      setProgress(i + 1);
      setResults([...allResults]);
    }
    setPhase('done');
    if (allResults.some(r => r.success)) onComplete();
  }, [rows, companies, stores, supervisors, onComplete, t]);

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

          {/* ── Format guide (collapsible) ── */}
          {phase === 'upload' && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setGuideOpen(!guideOpen); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 7,
                    border: '1.5px solid var(--border)', background: 'transparent',
                    color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-warm)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <AlertTriangle size={14} style={{ color: guideOpen ? 'var(--primary)' : 'var(--text-muted)' }} />
                  {guideOpen ? t('employees.bulkImportGuideHide') : t('employees.bulkImportGuideToggle')}
                </button>
              </div>

              {guideOpen && (
                <div style={{
                  borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden',
                  fontSize: 12, boxShadow: 'var(--shadow-sm)', background: 'var(--surface)',
                }}>
                  <div style={{
                    background: 'var(--primary)', color: '#fff',
                    padding: '8px 14px', fontWeight: 700, fontSize: 11,
                    letterSpacing: '1px', textTransform: 'uppercase',
                  }}>
                    {t('employees.bulkImportGuideTitle')}
                  </div>
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr style={{ background: 'var(--surface-warm)' }}>
                          {[t('common.column'), t('common.required'), t('common.format'), t('common.example')].map((h, i) => (
                            <th key={h} style={{
                              padding: '8px 12px', textAlign: i === 1 ? 'center' : 'left',
                              fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)',
                              textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.05em'
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { col: t('employees.bulkImportGuideCols.name', 'name'), req: true, fmt: t('employees.bulkImportGuideFmt.text', 'Text'), ex: 'John' },
                          { col: t('employees.bulkImportGuideCols.surname', 'surname'), req: true, fmt: t('employees.bulkImportGuideFmt.text', 'Text'), ex: 'Doe' },
                          { col: t('employees.bulkImportGuideCols.email', 'email'), req: true, fmt: t('employees.bulkImportGuideFmt.email', 'Email'), ex: 'john.doe@example.com' },
                          { col: t('employees.bulkImportGuideCols.role', 'role'), req: true, fmt: t('employees.bulkImportGuideFmt.role', 'admin / hr / area_manager / store_manager / employee'), ex: 'employee' },
                          { col: t('employees.bulkImportGuideCols.company', 'company'), req: true, fmt: t('employees.bulkImportGuideFmt.companyName', 'Company name'), ex: 'Acme Corp' },
                          { col: t('employees.bulkImportGuideCols.store', 'store'), req: true, fmt: t('employees.bulkImportGuideFmt.storeName', 'Store name'), ex: 'Paris Store' },
                          { col: t('employees.bulkImportGuideCols.supervisor', 'supervisor'), req: false, fmt: t('employees.bulkImportGuideFmt.supervisor', 'Full name or Email'), ex: 'Jane Smith' },
                          { col: t('employees.bulkImportGuideCols.department', 'department'), req: false, fmt: t('employees.bulkImportGuideFmt.text', 'Text'), ex: 'Sales' },
                          { col: t('employees.bulkImportGuideCols.hireDate', 'hire date'), req: false, fmt: t('employees.bulkImportGuideFmt.date', 'YYYY-MM-DD'), ex: '2026-05-01' },
                          { col: t('employees.bulkImportGuideCols.workSchedule', 'work schedule'), req: false, fmt: t('employees.bulkImportGuideFmt.workSchedule', 'Full Time / Part Time'), ex: 'Full Time' },
                          { col: t('employees.bulkImportGuideCols.weeklyHours', 'weekly hours'), req: false, fmt: t('employees.bulkImportGuideFmt.number', 'Number'), ex: '40' },
                          { col: t('employees.bulkImportGuideCols.personalEmail', 'personal email'), req: true, fmt: t('employees.bulkImportGuideFmt.email', 'Email'), ex: 'john.personal@gmail.com' },
                          { col: t('employees.bulkImportGuideCols.dateOfBirth', 'date of birth'), req: false, fmt: t('employees.bulkImportGuideFmt.date', 'YYYY-MM-DD'), ex: '1990-01-01' },
                          { col: t('employees.bulkImportGuideCols.gender', 'gender'), req: false, fmt: t('employees.bulkImportGuideFmt.gender', 'M / F / Other'), ex: 'M' },
                          { col: t('employees.bulkImportGuideCols.postalCode', 'postal code'), req: false, fmt: t('employees.bulkImportGuideFmt.digits5', '5 digits'), ex: '00100' },
                          { col: t('employees.bulkImportGuideCols.firstAid', 'first aid'), req: false, fmt: t('employees.bulkImportGuideFmt.yesNo', 'YES / NO'), ex: 'NO' },
                        ].map((row, i) => (
                          <tr key={row.col} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-warm)', borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{row.col}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                              {row.req ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{t('common.yes')}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>
                            <td style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>{row.fmt}</td>
                            <td style={{ padding: '6px 12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{row.ex}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '8px 14px', background: 'rgba(139,105,20,0.05)', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>💡</span>
                    <span>{t('employees.bulkImportTemplateHint', 'Required fields: Name, Surname, Email, Role, Personal email, Company, Store. Dates should be YYYY-MM-DD.')}</span>
                  </div>
                </div>
              )}
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
                        <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 500 }}>
                          {typeof r.error === 'string' 
                            ? r.error 
                            : r.error && t(r.error.key, { ...r.error.params, defaultValue: r.error.fallback })}
                        </span>
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
              {failCount > 0 && (
                <button 
                  onClick={() => setIsEditingData(true)} 
                  style={{ ...S.btn, background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }}
                >
                  {t('employees.bulkImportEditData', 'Edit data')}
                </button>
              )}
              <button onClick={() => { setPhase('upload'); setFile(null); setRows([]); setResults([]); }} style={{ ...S.btn, background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                {t('employees.bulkImportNewImport', 'New Import')}
              </button>
              <button onClick={onClose} style={{ ...S.btn, background: 'var(--primary)', color: '#fff' }}>
                {t('employees.bulkImportDone', 'Done')}
              </button>
            </>
          )}
        </div>

        <EditDataModal 
          open={isEditingData} 
          rows={rows} 
          onClose={() => setIsEditingData(false)} 
          onSave={(newRows) => {
            setRows(newRows);
            setIsEditingData(false);
            setPhase('preview');
            setResults([]);
          }}
        />

        <ColumnMappingModal
          open={showMappingModal}
          headers={pendingHeaders}
          rows={pendingRows}
          onClose={() => {
            setShowMappingModal(false);
            setFile(null);
            setPhase('upload');
          }}
          onSave={(mappedRows) => {
            setRows(mappedRows);
            setShowMappingModal(false);
            setPhase('preview');
          }}
        />
      </div>
    </div>,
    document.body
  );
}

/* ── Edit Data Modal ─────────────────────────────────────────────────── */

function EditDataModal({ 
  open, 
  rows, 
  onClose, 
  onSave 
}: { 
  open: boolean; 
  rows: ParsedRow[]; 
  onClose: () => void; 
  onSave: (newRows: ParsedRow[]) => void; 
}) {
  const { t } = useTranslation();
  const [localRows, setLocalRows] = useState<ParsedRow[]>([]);

  useEffect(() => {
    if (open) {
      setLocalRows(JSON.parse(JSON.stringify(rows)));
    }
  }, [open, rows]);

  if (!open) return null;

  const headers = localRows.length > 0 ? Object.keys(localRows[0].data) : [];

  const handleCellChange = (rowIndex: number, header: string, val: string) => {
    setLocalRows(prev => prev.map(r => r.rowIndex === rowIndex 
      ? { ...r, data: { ...r.data, [header]: val } } 
      : r
    ));
  };

  const S = {
    backdrop: { position: 'fixed' as const, inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' },
    card: { background: 'var(--surface)', borderRadius: '16px', width: 'min(1000px, 95vw)', height: '85vh', display: 'flex', flexDirection: 'column' as const, boxShadow: '0 24px 60px rgba(0,0,0,0.3)', overflow: 'hidden' },
    header: { padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    body: { flex: 1, overflow: 'auto' as const, padding: '0' },
    footer: { padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-warm)', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0 },
    btn: { padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none' },
    input: { width: '100%', border: 'none', background: 'transparent', padding: '8px 10px', fontSize: '11.5px', color: 'var(--text-primary)', fontFamily: 'inherit', minWidth: '120px' },
  };

  return createPortal(
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.card} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileSpreadsheet size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>{t('employees.bulkImportEditData', 'Edit data')}</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>
        
        <div style={S.body}>
          <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface-warm)' }}>
              <tr>
                <th style={{ width: 50, padding: '12px 10px', fontSize: 10, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', textAlign: 'left', background: 'var(--surface-warm)', position: 'sticky', left: 0, zIndex: 11 }}>#</th>
                {headers.map(h => (
                  <th key={h} style={{ minWidth: 150, padding: '12px 10px', fontSize: 10, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {localRows.map((row) => (
                <tr key={row.rowIndex} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface)', position: 'sticky', left: 0, zIndex: 1 }}>{row.rowIndex}</td>
                  {headers.map(h => (
                    <td key={h} style={{ padding: 0, borderLeft: '1px solid var(--border-light)' }}>
                      <input 
                        style={S.input}
                        value={String(row.data[h] ?? '')}
                        onChange={e => handleCellChange(row.rowIndex, h, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={S.footer}>
          <button onClick={onClose} style={{ ...S.btn, background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            {t('common.cancel')}
          </button>
          <button 
            onClick={() => onSave(localRows)} 
            style={{ ...S.btn, background: 'var(--primary)', color: '#fff' }}
          >
            {t('employees.bulkImportEditAction', 'Edit')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


/* ── Column Mapping Modal ───────────────────────────────────────────────── */

const SCHEMA_FIELDS = [
  { key: 'name', label: 'Name', format: 'text', required: true },
  { key: 'surname', label: 'Surname', format: 'text', required: true },
  { key: 'email', label: 'Email', format: 'email', required: true },
  { key: 'role', label: 'Role', format: 'text', required: true },
  { key: 'companyName', label: 'Company', format: 'text', required: true },
  { key: 'storeName', label: 'Store', format: 'text', required: true },
  { key: 'personalEmail', label: 'Personal Email', format: 'email', required: true },
  { key: 'password', label: 'Temporary Password', format: 'password', required: false },
  { key: 'weeklyHours', label: 'Weekly Hours', format: 'number', required: false },
  { key: 'cap', label: 'Postal Code', format: 'number', required: false },
  { key: 'supervisorName', label: 'Supervisor', format: 'text', required: false },
  { key: 'department', label: 'Department', format: 'text', required: false },
  { key: 'hireDate', label: 'Hire Date', format: 'text', required: false },
  { key: 'workingType', label: 'Work Schedule', format: 'text', required: false },
  { key: 'dateOfBirth', label: 'Date of Birth', format: 'text', required: false },
  { key: 'gender', label: 'Gender', format: 'text', required: false },
  { key: 'nationality', label: 'Nationality', format: 'text', required: false },
  { key: 'iban', label: 'IBAN', format: 'text', required: false },
  { key: 'address', label: 'Address', format: 'text', required: false },
  { key: 'city', label: 'City', format: 'text', required: false },
  { key: 'state', label: 'State', format: 'text', required: false },
  { key: 'country', label: 'Country', format: 'text', required: false },
  { key: 'phone', label: 'Company Phone', format: 'text', required: false },
  { key: 'maritalStatus', label: 'Marital Status', format: 'text', required: false },
  { key: 'firstAidFlag', label: 'First Aid', format: 'text', required: false },
  { key: 'contractType', label: 'Contract Type', format: 'text', required: false },
  { key: 'probationMonths', label: 'Probation Period', format: 'text', required: false },
  { key: 'terminationDate', label: 'Termination Date', format: 'text', required: false },
  { key: 'terminationType', label: 'Termination Type', format: 'text', required: false },
];

const FIELD_TO_HEADER: Record<string, string> = {
  name: 'name',
  surname: 'surname',
  email: 'email',
  role: 'role',
  companyName: 'company',
  storeName: 'store',
  personalEmail: 'personal email',
  password: 'temporary password',
  weeklyHours: 'weekly hours',
  cap: 'postal code',
  supervisorName: 'supervisor',
  department: 'department',
  hireDate: 'hire date',
  workingType: 'work schedule',
  dateOfBirth: 'date of birth',
  gender: 'gender',
  nationality: 'nationality',
  iban: 'iban',
  address: 'address',
  city: 'city',
  state: 'state',
  country: 'country',
  phone: 'company phone numbers',
  maritalStatus: 'marital status',
  firstAidFlag: 'first aid',
  contractType: 'contract type',
  probationMonths: 'probation period',
  terminationDate: 'termination date',
  terminationType: 'termination type',
};

function getHeaderFormat(header: string, rows: ParsedRow[]): 'text' | 'email' | 'number' | 'password' {
  const lowerHeader = header.toLowerCase();
  if (lowerHeader.includes('pass') || lowerHeader.includes('pwd')) {
    return 'password';
  }
  const values = rows.map(r => r.data[header]);
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmail = values.some(val => val && emailRegex.test(String(val).trim()));
  if (isEmail) return 'email';

  const hasNumbers = values.some(val => val !== '' && val !== null && val !== undefined && !isNaN(Number(val)));
  const allNumbersOrEmpty = values.every(val => val === '' || val === null || val === undefined || !isNaN(Number(val)));
  if (hasNumbers && allNumbersOrEmpty) return 'number';

  return 'text';
}

function ColumnMappingModal({
  open,
  headers,
  rows,
  onClose,
  onSave
}: {
  open: boolean;
  headers: string[];
  rows: ParsedRow[];
  onClose: () => void;
  onSave: (mappedRows: ParsedRow[]) => void;
}) {
  const { t } = useTranslation();
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const initialMappedKeys = React.useMemo(() => {
    const matched = new Set<string>();
    if (!headers) return matched;
    for (const h of headers) {
      const key = COLUMN_MAP[h.trim().toLowerCase()];
      if (key) matched.add(key);
    }
    return matched;
  }, [headers]);

  const unmappedHeaders = React.useMemo(() => {
    if (!headers) return [];
    return headers.filter(h => !COLUMN_MAP[h.trim().toLowerCase()]);
  }, [headers]);

  const headerFormats = React.useMemo(() => {
    const formats: Record<string, 'text' | 'email' | 'number' | 'password'> = {};
    for (const h of unmappedHeaders) {
      formats[h] = getHeaderFormat(h, rows);
    }
    return formats;
  }, [unmappedHeaders, rows]);

  const getAvailableSchemaFields = (currentHeader: string, format: string) => {
    const selectedKeys = Object.entries(mapping)
      .filter(([h, k]) => h !== currentHeader && k !== '')
      .map(([h, k]) => k);

    return SCHEMA_FIELDS.filter(field => 
      field.format === format && 
      !initialMappedKeys.has(field.key) && 
      !selectedKeys.includes(field.key)
    );
  };

  const handleSelectField = (header: string, fieldKey: string) => {
    setMapping(prev => ({
      ...prev,
      [header]: fieldKey
    }));
  };

  const handleSave = () => {
    const newRows = rows.map(row => {
      const newData = { ...row.data };
      for (const [header, fieldKey] of Object.entries(mapping)) {
        if (fieldKey) {
          const targetHeader = FIELD_TO_HEADER[fieldKey] || fieldKey;
          newData[targetHeader] = newData[header];
          delete newData[header];
        }
      }
      return {
        ...row,
        data: newData
      };
    });
    onSave(newRows);
  };

  if (!open) return null;

  const S = {
    backdrop: { position: 'fixed' as const, inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,33,55,0.48)', backdropFilter: 'blur(3px)' },
    card: { background: 'var(--surface)', borderRadius: '16px', width: 'min(600px, 95vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' as const, boxShadow: '0 24px 60px rgba(0,0,0,0.22)', overflow: 'hidden' },
    header: { padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    body: { flex: 1, overflowY: 'auto' as const, padding: '20px' },
    footer: { padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-warm)', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0 },
    btn: { padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none' },
    row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' },
    select: { padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '12px', width: '220px' }
  };

  return createPortal(
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.card} onClick={e => e.stopPropagation()}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent) 0%, var(--primary) 100%)', flexShrink: 0 }} />

        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} color="var(--accent)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Map Columns</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>

        <div style={S.body}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
            Some required columns in your file do not match our database structure. Please map the different columns to proceed.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {unmappedHeaders.map(h => {
              const fmt = headerFormats[h] || 'text';
              const available = getAvailableSchemaFields(h, fmt);
              const selectedValue = mapping[h] || '';

              const selectOptions = available.map(f => ({
                value: f.key,
                label: `${f.label}${f.required ? ' *' : ''}`
              }));

              if (selectedValue && !available.some(f => f.key === selectedValue)) {
                const matchedField = SCHEMA_FIELDS.find(f => f.key === selectedValue);
                selectOptions.push({
                  value: selectedValue,
                  label: matchedField ? `${matchedField.label}${matchedField.required ? ' *' : ''}` : selectedValue
                });
              }

              return (
                <div key={h} style={S.row}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{h}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--surface-warm)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', fontWeight: 700 }}>
                      {fmt}
                    </span>
                  </div>

                  <div style={{ width: '220px' }}>
                    <CustomSelect
                      value={selectedValue || null}
                      onChange={val => handleSelectField(h, val || '')}
                      options={selectOptions}
                      placeholder="Select target field..."
                      isClearable={true}
                      searchable={true}
                      controlMinHeight={36}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={S.footer}>
          <button onClick={onClose} style={{ ...S.btn, background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{ ...S.btn, background: 'var(--primary)', color: '#fff' }}
          >
            Save Mapping
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default BulkImportModal;
