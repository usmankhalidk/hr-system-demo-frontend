import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Store as StoreIcon } from 'lucide-react';
import {
  ShiftTemplate,
  listTemplates,
  createTemplate,
  deleteTemplate,
  createShift,
} from '../../api/shifts';
import { getStores } from '../../api/stores';
import { getEmployees } from '../../api/employees';
import { Store as StoreType, Employee } from '../../types';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { WeekPicker } from '../../components/ui/WeekPicker';

// Shape of shift patterns stored in template_data
interface ShiftPattern {
  dayOfWeek: number; // 0=Mon … 6=Sun
  startTime: string; // 'HH:MM'
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
  notes?: string;
}

interface TemplateData {
  shifts: ShiftPattern[];
}

// Per-day config used inside the create wizard
interface DayConfig {
  enabled: boolean;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
}

const DEFAULT_DAY_CONFIG: DayConfig = {
  enabled: false,
  startTime: '',
  endTime: '',
  breakStart: '',
  breakEnd: '',
};

function parseHmToMinutes(value: string): number | null {
  const parts = value.split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return (h * 60) + m;
}

function diffMinutes(startHm: string, endHm: string): number {
  const start = parseHmToMinutes(startHm);
  const end = parseHmToMinutes(endHm);
  if (start == null || end == null) return 0;
  let diff = end - start;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function calculatePatternMinutes(pattern: ShiftPattern): number {
  const total = diffMinutes(pattern.startTime, pattern.endTime);
  const breakMinutes = pattern.breakStart && pattern.breakEnd
    ? diffMinutes(pattern.breakStart, pattern.breakEnd)
    : 0;
  return Math.max(0, total - breakMinutes);
}

function formatMinutesAsHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${String(mins).padStart(2, '0')}m`;
}

interface ShiftTemplatesPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function ShiftTemplatesPanel({ open, onClose }: ShiftTemplatesPanelProps) {
  const { t } = useTranslation();

  const DAY_LABELS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAY_LABELS_SHORT = [
    t('shifts.dayMon', 'Mon'),
    t('shifts.dayTue', 'Tue'),
    t('shifts.dayWed', 'Wed'),
    t('shifts.dayThu', 'Thu'),
    t('shifts.dayFri', 'Fri'),
    t('shifts.daySat', 'Sat'),
    t('shifts.daySun', 'Sun'),
  ];

  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Expanded template (to view shift patterns)
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Apply template state
  const [applyTemplate, setApplyTemplate] = useState<ShiftTemplate | null>(null);
  const [applyWeek, setApplyWeek] = useState('');
  const [applyEmployeeIds, setApplyEmployeeIds] = useState<number[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [applying, setApplying] = useState(false);

  // Confirm delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // ── Create Wizard ──────────────────────────────────────────────────────────
  // Step 0 = wizard hidden; Step 1 = name/store; Step 2 = day customisation
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2>(0);
  const [newName, setNewName] = useState('');
  const [newStoreId, setNewStoreId] = useState('');
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>(
    Array.from({ length: 7 }, () => ({ ...DEFAULT_DAY_CONFIG }))
  );

  function openWizard() {
    setNewName('');
    setNewStoreId('');
    setDayConfigs(Array.from({ length: 7 }, () => ({ ...DEFAULT_DAY_CONFIG })));
    setError(null);
    setWizardStep(1);
  }

  function closeWizard() {
    setWizardStep(0);
    setError(null);
  }

  function toggleDay(idx: number) {
    setDayConfigs((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, enabled: !d.enabled } : d))
    );
  }

  function updateDay(idx: number, field: keyof Omit<DayConfig, 'enabled'>, value: string) {
    setDayConfigs((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d))
    );
  }

  // Apply the same times to ALL enabled days at once
  function applyGlobalToAll(field: keyof Omit<DayConfig, 'enabled'>, value: string) {
    setDayConfigs((prev) =>
      prev.map((d) => (d.enabled ? { ...d, [field]: value } : d))
    );
  }

  useEffect(() => {
    if (!open) return;
    fetchTemplates();
    getStores().then(setStores).catch(() => { });
  }, [open]);

  async function fetchTemplates() {
    setLoading(true);
    setError(null);
    try {
      const data = await listTemplates();
      setTemplates(data.templates);
    } catch (err: any) {
      const code: string | undefined = err?.response?.data?.code;
      setError(code ? t(`errors.${code}`, t('errors.DEFAULT')) : t('errors.DEFAULT'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const enabledDays = dayConfigs
      .map((d, i) => ({ ...d, dayOfWeek: i }))
      .filter((d) => d.enabled);

    if (!newName.trim() || !newStoreId || enabledDays.length === 0) return;

    // Validate each enabled day has start/end times
    for (const d of enabledDays) {
      if (!d.startTime || !d.endTime) {
        setError(`Please set shift start and end time for ${DAY_LABELS_FULL[d.dayOfWeek]}.`);
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      await createTemplate({
        store_id: parseInt(newStoreId, 10),
        name: newName.trim(),
        template_data: {
          shifts: enabledDays.map((d) => ({
            dayOfWeek: d.dayOfWeek,
            startTime: d.startTime,
            endTime: d.endTime,
            breakStart: d.breakStart || undefined,
            breakEnd: d.breakEnd || undefined,
          })),
        },
      });
      setSuccessMsg(`✓ Template "${newName.trim()}" created successfully!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      closeWizard();
      await fetchTemplates();
    } catch (err: any) {
      const code: string | undefined = err?.response?.data?.code;
      setError(code ? t(`errors.${code}`, t('errors.DEFAULT')) : t('errors.DEFAULT'));
    } finally {
      setSaving(false);
    }
  }

  async function doDelete(id: number) {
    setConfirmDeleteId(null);
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((tmpl) => tmpl.id !== id));
    } catch (err: any) {
      const code: string | undefined = err?.response?.data?.code;
      setError(code ? t(`errors.${code}`, t('errors.DEFAULT')) : t('errors.DEFAULT'));
    }
  }

  function openApply(tmpl: ShiftTemplate) {
    setApplyTemplate(tmpl);
    setApplyWeek('');
    setApplyEmployeeIds([]);
    setEmployees([]);
    getEmployees({ storeId: tmpl.storeId, status: 'active', limit: 100 })
      .then((d) => setEmployees(d.employees.sort((a, b) => a.surname.localeCompare(b.surname))))
      .catch(() => { });
  }

  function getIsoMondayFromWeek(isoWeek: string): Date | null {
    const m = isoWeek.match(/^(\d{4})-W(\d{1,2})$/);
    if (!m) return null;
    const year = parseInt(m[1]);
    const week = parseInt(m[2]);
    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - (jan4Day - 1) + (week - 1) * 7);
    return monday;
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!applyTemplate || !applyWeek || applyEmployeeIds.length === 0) return;
    const monday = getIsoMondayFromWeek(applyWeek);
    if (!monday) return;

    setApplying(true);
    setError(null);
    let created = 0;
    let skipped = 0;
    let failed = 0;

    const patterns: ShiftPattern[] =
      ((applyTemplate.templateData as unknown as TemplateData)?.shifts) ?? [];

    for (const emp of applyEmployeeIds) {
      for (const pattern of patterns) {
        const shiftDate = new Date(monday);
        shiftDate.setDate(monday.getDate() + pattern.dayOfWeek);
        const y = shiftDate.getFullYear();
        const mo = String(shiftDate.getMonth() + 1).padStart(2, '0');
        const da = String(shiftDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${mo}-${da}`;
        try {
          await createShift({
            user_id: emp,
            store_id: applyTemplate.storeId,
            date: dateStr,
            start_time: pattern.startTime,
            end_time: pattern.endTime,
            break_start: pattern.breakStart ?? null,
            break_end: pattern.breakEnd ?? null,
            status: 'scheduled',
          });
          created++;
        } catch (err: any) {
          if (err?.response?.data?.code === 'OVERLAP_CONFLICT') {
            skipped++;
          } else {
            failed++;
          }
        }
      }
    }

    setApplying(false);
    setApplyTemplate(null);
    const parts: string[] = [`✓ ${t('shifts.shiftsCreated', { count: created })}`];
    if (skipped > 0) parts.push(t('shifts.shiftsSkipped', { count: skipped }));
    if (failed > 0) parts.push(t('shifts.shiftsFailed', { count: failed }));
    setSuccessMsg(parts.join(' · '));
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  function toggleEmployee(id: number) {
    setApplyEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (!open) return null;

  const enabledCount = dayConfigs.filter((d) => d.enabled).length;

  // ── Wizard Step 2: Day customisation UI ───────────────────────────────────
  const wizard = wizardStep > 0 ? (
    <>
      {/* Wizard backdrop */}
      <div
        onClick={closeWizard}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(13,33,55,0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 1200,
        }}
      />

      {/* Wizard panel */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: wizardStep === 2 ? 'min(700px, 96vw)' : 'min(460px, 96vw)',
        maxHeight: '90vh',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 1201,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.25s ease',
      }}>
        {/* Accent bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent) 0%, var(--primary) 100%)', flexShrink: 0 }} />

        {/* Header */}
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            {/* Step pills */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              {[1, 2].map((s) => (
                <div key={s} style={{
                  width: 26, height: 6, borderRadius: 3,
                  background: s <= wizardStep ? 'var(--accent)' : 'var(--border)',
                  transition: 'background 0.2s',
                }} />
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--primary)' }}>
              {wizardStep === 1
                ? t('shifts.newTemplate', 'New Shift Template')
                : t('shifts.customizeDays', 'Customize Days & Times')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {wizardStep === 1
                ? t('shifts.wizardStep1Hint', 'Step 1 of 2 — Name & Location')
                : t('shifts.wizardStep2Hint', 'Step 2 of 2 — Select days and configure shift times')}
            </div>
          </div>
          <button onClick={closeWizard} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '1.1rem', color: 'var(--text-muted)', padding: '4px 6px',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>

          {error && (
            <div style={{
              background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
              borderRadius: 8, padding: '9px 12px', marginBottom: 14,
              color: 'var(--danger)', fontSize: 13,
            }}>{error}</div>
          )}

          {/* ── STEP 1 ── */}
          {wizardStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Template Name</label>
                <input
                  type="text"
                  placeholder="e.g. Morning Shift, Weekend Shift…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>Location / Store</label>
                <select
                  value={newStoreId}
                  onChange={(e) => setNewStoreId(e.target.value)}
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <option value="">— Select a store —</option>
                  {stores.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.companyName ? `${s.name} (${s.companyName})` : s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {wizardStep === 2 && (
            <div>
              {/* Day selector pills */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  Select Working Days
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DAY_LABELS_FULL.map((label, idx) => {
                    const enabled = dayConfigs[idx].enabled;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 20,
                          border: `2px solid ${enabled ? 'var(--accent)' : 'var(--border)'}`,
                          background: enabled ? 'var(--accent)' : 'var(--surface-warm)',
                          color: enabled ? '#fff' : 'var(--text-secondary)',
                          fontWeight: 600, fontSize: 13,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        {DAY_LABELS_SHORT[idx]}
                      </button>
                    );
                  })}
                </div>
                {enabledCount === 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    ⚠ Please select at least one day.
                  </div>
                )}
              </div>

              {/* Global time applicator (only if ≥2 days selected) */}
              {enabledCount >= 2 && (
                <div style={{
                  background: 'rgba(201,151,58,0.07)',
                  border: '1px dashed var(--accent)',
                  borderRadius: 10, padding: '12px 14px', marginBottom: 18,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>
                    ⚡ Apply to All Selected Days
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { field: 'startTime' as const, label: 'Shift Start' },
                      { field: 'endTime' as const, label: 'Shift End' },
                      { field: 'breakStart' as const, label: 'Break Start' },
                      { field: 'breakEnd' as const, label: 'Break End' },
                    ].map(({ field, label }) => (
                      <div key={field}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                        <input
                          type="time"
                          onChange={(e) => applyGlobalToAll(field, e.target.value)}
                          style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '6px 8px' }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-day rows */}
              {enabledCount > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    Configure Each Day
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {dayConfigs.map((d, idx) => {
                      if (!d.enabled) return null;
                      return (
                        <div key={idx} style={{
                          background: 'var(--surface-warm)',
                          border: '1.5px solid var(--accent)',
                          borderRadius: 10, padding: '12px 14px',
                        }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            marginBottom: 10,
                          }}>
                            <div style={{
                              fontWeight: 700, fontSize: 13,
                              color: 'var(--primary)', fontFamily: 'var(--font-display)',
                            }}>
                              {DAY_LABELS_FULL[idx]}
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleDay(idx)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--text-muted)', fontSize: 12, padding: '2px 4px',
                              }}
                            >
                              ✕ Remove
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                            <div>
                              <label style={smallLabelStyle}>Shift Start *</label>
                              <input
                                type="time"
                                value={d.startTime}
                                onChange={(e) => updateDay(idx, 'startTime', e.target.value)}
                                required
                                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '6px 8px' }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                              />
                            </div>
                            <div>
                              <label style={smallLabelStyle}>Shift End *</label>
                              <input
                                type="time"
                                value={d.endTime}
                                onChange={(e) => updateDay(idx, 'endTime', e.target.value)}
                                required
                                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '6px 8px' }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                              />
                            </div>
                            <div>
                              <label style={smallLabelStyle}>Break Start</label>
                              <input
                                type="time"
                                value={d.breakStart}
                                onChange={(e) => updateDay(idx, 'breakStart', e.target.value)}
                                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '6px 8px' }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                              />
                            </div>
                            <div>
                              <label style={smallLabelStyle}>Break End</label>
                              <input
                                type="time"
                                value={d.breakEnd}
                                onChange={(e) => updateDay(idx, 'breakEnd', e.target.value)}
                                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '6px 8px' }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0,
        }}>
          {wizardStep === 1 ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={closeWizard}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!newName.trim() || !newStoreId}
                onClick={() => { setError(null); setWizardStep(2); }}
              >
                Next →
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => { setError(null); setWizardStep(1); }}>
                ← Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving || enabledCount === 0}
                onClick={(e) => handleCreate(e as any)}
              >
                {saving ? 'Saving…' : `✓ Create Template (${enabledCount} day${enabledCount !== 1 ? 's' : ''})`}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  ) : null;

  const modal = (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(13,33,55,0.48)',
          backdropFilter: 'blur(3px)',
          zIndex: 1100,
        }}
      />

      {/* Apply panel (side sheet) */}
      {applyTemplate && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(400px, 95vw)',
          background: 'var(--surface)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
          zIndex: 1103,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent) 0%, var(--primary) 100%)' }} />
          <div style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--primary)' }}>
                {t('shifts.applyTemplate', 'Apply Template')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{applyTemplate.name}</div>
            </div>
            <button onClick={() => setApplyTemplate(null)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1.1rem', color: 'var(--text-muted)', padding: '4px 6px',
            }}>✕</button>
          </div>

          <form onSubmit={handleApply} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
              <div style={{ marginBottom: 16 }}>
                <WeekPicker
                  label={t('shifts.applyWeek', 'Target Week')}
                  value={applyWeek}
                  onChange={setApplyWeek}
                  placeholder={t('shifts.weekPickerHint', 'Choose a week')}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {t('shifts.applyEmployees', 'Employees')}
                  {employees.length > 0 && (
                    <button type="button" onClick={() =>
                      setApplyEmployeeIds(applyEmployeeIds.length === employees.length ? [] : employees.map(e => e.id))
                    } style={{
                      marginLeft: 10, fontSize: 11, background: 'none', border: 'none',
                      color: 'var(--accent)', cursor: 'pointer', fontWeight: 600,
                    }}>
                      {applyEmployeeIds.length === employees.length ? t('common.none', 'None') : t('common.all', 'All')}
                    </button>
                  )}
                </div>
                {employees.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common.loading', 'Loading...')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {employees.map((emp) => (
                      <label key={emp.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 10px', borderRadius: 8,
                        border: `1.5px solid ${applyEmployeeIds.includes(emp.id) ? 'var(--accent)' : 'var(--border)'}`,
                        background: applyEmployeeIds.includes(emp.id) ? 'rgba(201,151,58,0.06)' : 'var(--surface-warm)',
                        cursor: 'pointer', fontSize: 13, fontWeight: 500,
                        transition: 'all 0.12s',
                      }}>
                        <input
                          type="checkbox"
                          checked={applyEmployeeIds.includes(emp.id)}
                          onChange={() => toggleEmployee(emp.id)}
                          style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                        />
                        {emp.surname} {emp.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setApplyTemplate(null)}>
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={applying || !applyWeek || applyEmployeeIds.length === 0}
              >
                {applying ? t('common.saving', '...') : t('shifts.applyBtn', 'Apply')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main modal */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(560px, 95vw)',
        maxHeight: '82vh',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 1101,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Gold accent stripe */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent) 0%, var(--primary) 100%)', flexShrink: 0 }} />

        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--primary)', margin: 0 }}>
            {t('shifts.templatesTitle', 'Shift Templates')}
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '1.1rem', color: 'var(--text-muted)', padding: '4px 6px',
          }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {successMsg && (
            <div style={{
              background: 'rgba(30,130,76,0.08)', border: '1px solid rgba(30,130,76,0.3)',
              borderRadius: 8, padding: '9px 12px', marginBottom: 14,
              color: '#1B6B3A', fontSize: 13,
            }}>{successMsg}</div>
          )}
          {error && !wizardStep && (
            <div style={{
              background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
              borderRadius: 8, padding: '9px 12px', marginBottom: 14,
              color: 'var(--danger)', fontSize: 13,
            }}>{error}</div>
          )}

          {/* Create new template button */}
          <div style={{ marginBottom: 20 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={openWizard}
              style={{
                width: '100%', padding: '12px',
                fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                borderRadius: 10,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
              {t('shifts.newTemplate', 'Create New Shift Template')}
            </button>
          </div>

          {/* Template list */}
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('common.loading', 'Loading...')}</p>
          ) : templates.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '32px 0',
              color: 'var(--text-muted)', fontSize: 13,
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <div>{t('shifts.noTemplates', 'No templates yet. Create your first shift template above!')}</div>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {templates.map((tmpl) => {
                const patterns: ShiftPattern[] = (tmpl.templateData as unknown as TemplateData)?.shifts ?? [];
                const storeName = stores.find((s) => s.id === tmpl.storeId)?.name ?? `#${tmpl.storeId}`;
                const isExpanded = expandedId === tmpl.id;
                return (
                  <li key={tmpl.id} style={{
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    marginBottom: 10,
                    overflow: 'hidden',
                  }}>
                    {/* Template header row */}
                    <div style={{
                      display: 'flex', alignItems: 'center', padding: '11px 14px',
                      background: 'var(--surface-warm)', gap: 10,
                    }}>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : tmpl.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', padding: 2, lineHeight: 1,
                          transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 13 }}>{tmpl.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 11, color: 'var(--text-muted)',
                            background: 'var(--border)', borderRadius: 999, padding: '2px 7px',
                          }}>
                            <StoreIcon size={11} />
                            {storeName}
                          </span>
                          {patterns.length > 0 && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {patterns.length} {t('shifts.patterns', 'pattern')}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={() => openApply(tmpl)}
                        style={{ fontSize: 11, padding: '4px 12px' }}
                      >
                        {t('shifts.applyBtn', 'Apply')}
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => setConfirmDeleteId(tmpl.id)}
                        style={{ fontSize: 11, padding: '4px 10px' }}
                      >
                        {t('common.delete', 'Delete')}
                      </button>
                    </div>

                    {/* Expanded: shift pattern table */}
                    {isExpanded && patterns.length > 0 && (
                      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                              <th style={{ textAlign: 'left', padding: '4px 6px' }}>{t('shifts.tableDay', 'Day')}</th>
                              <th style={{ textAlign: 'left', padding: '4px 6px' }}>{t('shifts.tableStart', 'Start')}</th>
                              <th style={{ textAlign: 'left', padding: '4px 6px' }}>{t('shifts.tableEnd', 'End')}</th>
                              <th style={{ textAlign: 'left', padding: '4px 6px' }}>{t('shifts.tableBreak', 'Break')}</th>
                              <th style={{ textAlign: 'left', padding: '4px 6px' }}>{t('common.time', 'Time')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {patterns.map((p, i) => (
                              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={{ padding: '5px 6px', fontWeight: 600 }}>{DAY_LABELS_FULL[p.dayOfWeek]}</td>
                                <td style={{ padding: '5px 6px' }}>{p.startTime}</td>
                                <td style={{ padding: '5px 6px' }}>{p.endTime}</td>
                                <td style={{ padding: '5px 6px', color: 'var(--text-muted)' }}>
                                  {p.breakStart && p.breakEnd ? `${p.breakStart}–${p.breakEnd}` : '—'}
                                </td>
                                <td style={{ padding: '5px 6px', fontWeight: 600, color: 'var(--primary)' }}>
                                  {formatMinutesAsHours(calculatePatternMinutes(p))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
          <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={onClose}>
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {createPortal(modal, document.body)}
      {wizardStep > 0 && createPortal(wizard, document.body)}
      <ConfirmModal
        open={confirmDeleteId !== null}
        title={t('shifts.deleteTemplateTitle', 'Delete Template')}
        message={t('shifts.deleteTemplateMsg', "Are you sure you want to delete this template? This action cannot be undone.")}
        confirmLabel={t('common.delete', 'Delete')}
        variant="danger"
        onConfirm={() => confirmDeleteId !== null && doDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1.5px solid var(--border)',
  borderRadius: 8,
  fontFamily: 'var(--font-body)',
  fontSize: '0.875rem',
  background: 'var(--surface)',
  color: 'var(--text-primary)',
  outline: 'none',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 6,
};

const smallLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: 4,
};
