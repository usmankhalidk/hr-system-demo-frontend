import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, Pencil, PlayCircle, Store as StoreIcon, Trash2 } from 'lucide-react';
import {
  ShiftTemplate,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createShift,
} from '../../api/shifts';
import { getStores } from '../../api/stores';
import { getEmployees } from '../../api/employees';
import { getTransferBlocks, TransferAssignment } from '../../api/transfers';
import { getAvatarUrl } from '../../api/client';
import { Store as StoreType, Employee } from '../../types';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { DatePicker } from '../../components/ui/DatePicker';

// Shape of shift patterns stored in template_data
interface ShiftPattern {
  dayOfWeek: number; // 0=Mon … 6=Sun
  startTime: string; // 'HH:MM'
  endTime: string;
  breakType?: 'fixed' | 'flexible';
  breakStart?: string;
  breakEnd?: string;
  breakMinutes?: number;
  notes?: string;
}

interface TemplateData {
  shifts: ShiftPattern[];
}

type ApplyEmployeeItem = Employee & {
  isTransferredForApply?: boolean;
  transferForApply?: TransferAssignment | null;
};

// Per-day config used inside the create wizard
interface DayConfig {
  enabled: boolean;
  startTime: string;
  endTime: string;
  breakType: 'fixed' | 'flexible';
  breakStart: string;
  breakEnd: string;
  breakMinutes: string;
}

const DEFAULT_DAY_CONFIG: DayConfig = {
  enabled: false,
  startTime: '',
  endTime: '',
  breakType: 'fixed',
  breakStart: '',
  breakEnd: '',
  breakMinutes: '',
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
  const breakMinutes = (pattern.breakType ?? 'fixed') === 'flexible'
    ? (pattern.breakMinutes ?? 0)
    : (pattern.breakStart && pattern.breakEnd
      ? diffMinutes(pattern.breakStart, pattern.breakEnd)
      : 0);
  return Math.max(0, total - breakMinutes);
}

function formatMinutesAsHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${String(mins).padStart(2, '0')}m`;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDate(dateStr: string): Date | null {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function dayOfWeekMonBased(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function normalizeOffDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [5, 6];
  const normalized = Array.from(new Set(
    raw
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6),
  )).sort((a, b) => a - b);
  return normalized.length > 0 ? normalized : [5, 6];
}

function enumerateDatesForPattern(patternDay: number, startDate: string, endDate: string): string[] {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end || start > end) return [];
  const out: string[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    if (dayOfWeekMonBased(cursor) === patternDay) {
      out.push(toIsoDate(cursor));
    }
  }
  return out;
}

function validateShiftPatternTiming(pattern: ShiftPattern, t: (k: string, o?: any) => string, dayLabel: string): string | null {
  const startMinutes = parseHmToMinutes(pattern.startTime);
  const endMinutes = parseHmToMinutes(pattern.endTime);
  if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
    return t('shifts.validation.endAfterStart', "L'orario di fine deve essere successivo all'inizio") + ` (${dayLabel})`;
  }

  const breakType = pattern.breakType ?? 'fixed';
  if (breakType === 'flexible') {
    const breakMinutes = pattern.breakMinutes ?? null;
    if (breakMinutes == null || Number.isNaN(breakMinutes) || breakMinutes <= 0 || breakMinutes > 480) {
      return t('shifts.validation.breakMinutesInvalid', 'La durata della pausa deve essere compresa tra 1 e 480 minuti') + ` (${dayLabel})`;
    }
    if (breakMinutes >= (endMinutes - startMinutes)) {
      return t('shifts.validation.breakWithinShift', 'La pausa deve rientrare nella finestra del turno') + ` (${dayLabel})`;
    }
  } else {
    const hasBreakStart = Boolean(pattern.breakStart);
    const hasBreakEnd = Boolean(pattern.breakEnd);
    if (hasBreakStart !== hasBreakEnd) {
      return t('shifts.validation.breakBothRequired', 'Se si inserisce una pausa, entrambi gli orari sono obbligatori') + ` (${dayLabel})`;
    }

    if (hasBreakStart && hasBreakEnd) {
      const breakStartMinutes = parseHmToMinutes(pattern.breakStart!);
      const breakEndMinutes = parseHmToMinutes(pattern.breakEnd!);
      if (breakStartMinutes == null || breakEndMinutes == null || breakEndMinutes <= breakStartMinutes) {
        return t('shifts.validation.breakEndAfterStart', "L'orario di fine pausa deve essere successivo all'inizio") + ` (${dayLabel})`;
      }
      if (breakStartMinutes < startMinutes || breakEndMinutes > endMinutes) {
        return t('shifts.validation.breakWithinShift', 'La pausa deve rientrare nella finestra del turno') + ` (${dayLabel})`;
      }
    }
  }

  return null;
}

interface ShiftTemplatesPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function ShiftTemplatesPanel({ open, onClose }: ShiftTemplatesPanelProps) {
  const { t } = useTranslation();

  const DAY_LABELS_FULL = [
    t('stores.dayMonday', 'Monday'),
    t('stores.dayTuesday', 'Tuesday'),
    t('stores.dayWednesday', 'Wednesday'),
    t('stores.dayThursday', 'Thursday'),
    t('stores.dayFriday', 'Friday'),
    t('stores.daySaturday', 'Saturday'),
    t('stores.daySunday', 'Sunday'),
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
  const [applyStartDate, setApplyStartDate] = useState('');
  const [applyEndDate, setApplyEndDate] = useState('');
  const [applyEmployeeIds, setApplyEmployeeIds] = useState<number[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [applyTransfers, setApplyTransfers] = useState<TransferAssignment[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const applyEmployees = useMemo<ApplyEmployeeItem[]>(() => {
    const byId = new Map<number, ApplyEmployeeItem>();
    for (const emp of employees) {
      byId.set(emp.id, { ...emp, isTransferredForApply: false, transferForApply: null });
    }

    if (!applyTemplate) {
      return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name) || a.surname.localeCompare(b.surname));
    }

    const transferPriority: Record<TransferAssignment['status'], number> = {
      active: 0,
      completed: 1,
      cancelled: 2,
    };

    const transferByUser = new Map<number, TransferAssignment>();
    for (const tb of applyTransfers
      .filter((tb) => tb.targetStoreId === applyTemplate.storeId && tb.status !== 'cancelled')
      .sort((a, b) => {
        if (transferPriority[a.status] !== transferPriority[b.status]) {
          return transferPriority[a.status] - transferPriority[b.status];
        }
        return b.id - a.id;
      })) {
      if (!transferByUser.has(tb.userId)) {
        transferByUser.set(tb.userId, tb);
      }
    }

    for (const transfer of transferByUser.values()) {
      const existing = byId.get(transfer.userId);
      if (existing) {
        byId.set(transfer.userId, {
          ...existing,
          isTransferredForApply: true,
          transferForApply: transfer,
        });
        continue;
      }

      byId.set(transfer.userId, {
        id: transfer.userId,
        companyId: transfer.companyId,
        storeId: transfer.targetStoreId,
        supervisorId: null,
        name: transfer.userName,
        surname: transfer.userSurname,
        email: transfer.userEmail,
        role: 'employee',
        uniqueId: null,
        department: null,
        hireDate: null,
        contractEndDate: null,
        terminationDate: null,
        workingType: null,
        weeklyHours: null,
        offDays: [5, 6],
        status: 'active',
        firstAidFlag: false,
        maritalStatus: null,
        storeName: transfer.targetStoreName,
        companyName: transfer.companyName,
        avatarFilename: transfer.userAvatarFilename,
        isTransferredForApply: true,
        transferForApply: transfer,
      });
    }

    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name) || a.surname.localeCompare(b.surname));
  }, [employees, applyTransfers, applyTemplate]);

  // Confirm delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // ── Create Wizard ──────────────────────────────────────────────────────────
  // Step 0 = wizard hidden; Step 1 = name/store; Step 2 = day customisation
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2>(0);
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);
  const [newName, setNewName] = useState('');
  const [newStoreId, setNewStoreId] = useState('');
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>(
    Array.from({ length: 7 }, () => ({ ...DEFAULT_DAY_CONFIG }))
  );

  function openWizard() {
    setEditingTemplate(null);
    setNewName('');
    setNewStoreId('');
    setDayConfigs(Array.from({ length: 7 }, () => ({ ...DEFAULT_DAY_CONFIG })));
    setError(null);
    setWizardStep(1);
  }

  function openEditWizard(template: ShiftTemplate) {
    const patterns: ShiftPattern[] = (template.templateData as unknown as TemplateData)?.shifts ?? [];
    const nextDays = Array.from({ length: 7 }, () => ({ ...DEFAULT_DAY_CONFIG }));

    for (const pattern of patterns) {
      if (pattern.dayOfWeek < 0 || pattern.dayOfWeek > 6) continue;
      const breakType = pattern.breakType ?? (pattern.breakMinutes != null ? 'flexible' : 'fixed');
      nextDays[pattern.dayOfWeek] = {
        enabled: true,
        startTime: pattern.startTime,
        endTime: pattern.endTime,
        breakType,
        breakStart: breakType === 'fixed' ? (pattern.breakStart ?? '') : '',
        breakEnd: breakType === 'fixed' ? (pattern.breakEnd ?? '') : '',
        breakMinutes: breakType === 'flexible' && pattern.breakMinutes != null ? String(pattern.breakMinutes) : '',
      };
    }

    setEditingTemplate(template);
    setNewName(template.name);
    setNewStoreId(String(template.storeId));
    setDayConfigs(nextDays);
    setError(null);
    setWizardStep(1);
  }

  function closeWizard() {
    setWizardStep(0);
    setEditingTemplate(null);
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

      const timingError = validateShiftPatternTiming(
        {
          dayOfWeek: d.dayOfWeek,
          startTime: d.startTime,
          endTime: d.endTime,
          breakType: d.breakType,
          breakStart: d.breakType === 'fixed' ? (d.breakStart || undefined) : undefined,
          breakEnd: d.breakType === 'fixed' ? (d.breakEnd || undefined) : undefined,
          breakMinutes: d.breakType === 'flexible' && d.breakMinutes ? parseInt(d.breakMinutes, 10) : undefined,
        },
        t as (k: string, o?: any) => string,
        DAY_LABELS_FULL[d.dayOfWeek],
      );
      if (timingError) {
        setError(timingError);
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        store_id: parseInt(newStoreId, 10),
        name: newName.trim(),
        template_data: {
          shifts: enabledDays.map((d) => ({
            dayOfWeek: d.dayOfWeek,
            startTime: d.startTime,
            endTime: d.endTime,
            breakType: d.breakType,
            breakStart: d.breakType === 'fixed' ? (d.breakStart || undefined) : undefined,
            breakEnd: d.breakType === 'fixed' ? (d.breakEnd || undefined) : undefined,
            breakMinutes: d.breakType === 'flexible' && d.breakMinutes ? parseInt(d.breakMinutes, 10) : undefined,
          })),
        },
      };

      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, payload);
        setSuccessMsg(`✓ ${t('shifts.templateUpdated', 'Template updated successfully')}`);
      } else {
        await createTemplate(payload);
        setSuccessMsg(`✓ Template "${newName.trim()}" created successfully!`);
      }
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
    const today = toIsoDate(new Date());
    setApplyTemplate(tmpl);
    setApplyStartDate(today);
    setApplyEndDate(today);
    setApplyEmployeeIds([]);
    setEmployees([]);
    setApplyTransfers([]);
    setEmployeesLoading(true);
    getEmployees({ storeId: tmpl.storeId, status: 'active', limit: 100 })
      .then((d) => setEmployees(d.employees.sort((a, b) => a.name.localeCompare(b.name) || a.surname.localeCompare(b.surname))))
      .catch(() => { setEmployees([]); })
      .finally(() => setEmployeesLoading(false));
  }

  useEffect(() => {
    if (!applyTemplate || !applyStartDate || !applyEndDate || applyStartDate > applyEndDate) {
      setApplyTransfers([]);
      return;
    }

    let mounted = true;
    getTransferBlocks({
      date_from: applyStartDate,
      date_to: applyEndDate,
      status: 'all',
      store_id: applyTemplate.storeId,
    })
      .then((res) => {
        if (!mounted) return;
        setApplyTransfers(res.blocks ?? []);
      })
      .catch(() => {
        if (!mounted) return;
        setApplyTransfers([]);
      });

    return () => {
      mounted = false;
    };
  }, [applyTemplate, applyStartDate, applyEndDate]);

  useEffect(() => {
    setApplyEmployeeIds((prev) => prev.filter((id) => applyEmployees.some((emp) => emp.id === id)));
  }, [applyEmployees]);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!applyTemplate || !applyStartDate || !applyEndDate || applyEmployeeIds.length === 0) return;
    if (applyStartDate > applyEndDate) {
      setError(t('errors.INVALID_DATE_RANGE', t('errors.DEFAULT')));
      return;
    }

    setApplying(true);
    setError(null);
    let created = 0;
    let skipped = 0;
    let skippedOffDay = 0;
    let failed = 0;
    const failureMessages: string[] = [];

    const patterns: ShiftPattern[] =
      ((applyTemplate.templateData as unknown as TemplateData)?.shifts) ?? [];

    for (const pattern of patterns) {
      const timingError = validateShiftPatternTiming(
        pattern,
        t as (k: string, o?: any) => string,
        DAY_LABELS_FULL[pattern.dayOfWeek] ?? `#${pattern.dayOfWeek}`,
      );
      if (timingError) {
        setApplying(false);
        setError(timingError);
        return;
      }
    }

    const patternDates = patterns.map((pattern) => ({
      pattern,
      dates: enumerateDatesForPattern(pattern.dayOfWeek, applyStartDate, applyEndDate),
    }));

    const applyEmployeeById = new Map(applyEmployees.map((employee) => [employee.id, employee]));

    for (const empId of applyEmployeeIds) {
      const employee = applyEmployeeById.get(empId);
      const employeeOffDays = normalizeOffDays(employee?.offDays);
      for (const item of patternDates) {
        for (const dateStr of item.dates) {
          const dayMonBased = dayOfWeekMonBased(new Date(`${dateStr}T12:00:00`));
          if (employeeOffDays.includes(dayMonBased)) {
            skippedOffDay++;
            continue;
          }
          try {
            const breakType = item.pattern.breakType ?? 'fixed';
            const isFlexible = breakType === 'flexible';
            await createShift({
              user_id: empId,
              store_id: applyTemplate.storeId,
              date: dateStr,
              start_time: item.pattern.startTime,
              end_time: item.pattern.endTime,
              break_type: breakType,
              break_start: isFlexible ? null : (item.pattern.breakStart ?? null),
              break_end: isFlexible ? null : (item.pattern.breakEnd ?? null),
              break_minutes: isFlexible ? (item.pattern.breakMinutes ?? null) : null,
              status: 'scheduled',
            });
            created++;
          } catch (err: any) {
            if (err?.response?.data?.code === 'OVERLAP_CONFLICT') {
              skipped++;
            } else {
              failed++;
              const backendMessage: string | undefined = err?.response?.data?.error ?? err?.message;
              if (backendMessage) {
                failureMessages.push(`${dateStr}: ${backendMessage}`);
              }
            }
          }
        }
      }
    }

    setApplying(false);
    const parts: string[] = [`✓ ${t('shifts.shiftsCreated', { count: created })}`];
    if (skipped > 0) parts.push(t('shifts.shiftsSkipped', { count: skipped }));
    if (skippedOffDay > 0) parts.push(t('shifts.shiftsSkippedOffDay', { count: skippedOffDay }));
    if (failed > 0) parts.push(t('shifts.shiftsFailed', { count: failed }));
    setSuccessMsg(parts.join(' · '));
    setTimeout(() => setSuccessMsg(null), 4000);

    if (failureMessages.length > 0) {
      const uniqueMessages = Array.from(new Set(failureMessages));
      setError(uniqueMessages.slice(0, 3).join(' | '));
      return;
    }

    setApplyTemplate(null);
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
                ? (editingTemplate
                  ? t('shifts.editTemplate', 'Edit Shift Template')
                  : t('shifts.newTemplate', 'New Shift Template'))
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
                  {t('shifts.templateDayToggleTitle', 'Working / Off days')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                  {t('shifts.templateDayToggleHint', 'Click each day to toggle whether the template works that day or keeps it off.')}
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
                          padding: '8px 12px',
                          borderRadius: 20,
                          border: `2px solid ${enabled ? 'var(--accent)' : 'var(--border)'}`,
                          background: enabled ? 'rgba(201,151,58,0.13)' : 'var(--surface-warm)',
                          color: 'var(--text-secondary)',
                          fontWeight: 600, fontSize: 13,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          fontFamily: 'var(--font-body)',
                          minWidth: 114,
                        }}
                      >
                        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1, gap: 2 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{label}</span>
                          <span style={{
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: '0.07em',
                            textTransform: 'uppercase',
                            borderRadius: 999,
                            padding: '2px 7px',
                            border: enabled ? '1px solid rgba(22,101,52,0.28)' : '1px solid rgba(180,83,9,0.3)',
                            background: enabled ? 'rgba(134,239,172,0.2)' : 'rgba(251,191,36,0.2)',
                            color: enabled ? '#166534' : '#92400e',
                          }}>
                            {enabled ? t('shifts.dayWorking', 'Working') : t('shifts.dayOff', 'Off')}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {enabledCount === 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    {t('shifts.templateDayRequired', 'Please set at least one working day.')}
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
                      { field: 'startTime' as const, label: 'Shift Start', inputType: 'time' as const },
                      { field: 'endTime' as const, label: 'Shift End', inputType: 'time' as const },
                      { field: 'breakStart' as const, label: 'Break Start', inputType: 'time' as const },
                      { field: 'breakEnd' as const, label: 'Break End', inputType: 'time' as const },
                      { field: 'breakMinutes' as const, label: 'Break (min)', inputType: 'number' as const },
                    ].map(({ field, label, inputType }) => (
                      <div key={field}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                        <input
                          type={inputType}
                          min={inputType === 'number' ? 1 : undefined}
                          max={inputType === 'number' ? 480 : undefined}
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
                            gap: 8,
                          }}>
                            <div style={{
                              fontWeight: 700, fontSize: 13,
                              color: 'var(--primary)', fontFamily: 'var(--font-display)',
                            }}>
                              {DAY_LABELS_FULL[idx]}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                                {(['fixed', 'flexible'] as const).map((breakType) => (
                                  <button
                                    key={breakType}
                                    type="button"
                                    onClick={() => updateDay(idx, 'breakType', breakType)}
                                    style={{
                                      border: 'none',
                                      background: d.breakType === breakType ? 'var(--accent)' : 'var(--surface)',
                                      color: d.breakType === breakType ? '#fff' : 'var(--text-secondary)',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: '5px 10px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {breakType === 'fixed'
                                      ? t('shifts.form.breakType_fixed', 'Fixed break')
                                      : t('shifts.form.breakType_flexible', 'Flexible break')}
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleDay(idx)}
                                title={t('common.delete', 'Delete')}
                                aria-label={t('common.delete', 'Delete')}
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 8,
                                  border: '1px solid rgba(185,28,28,0.24)',
                                  background: 'rgba(220,38,38,0.08)',
                                  color: '#991b1b',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: d.breakType === 'flexible' ? '1fr 1fr 1fr' : '1fr 1fr 1fr 1fr', gap: 8 }}>
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
                            {d.breakType === 'flexible' ? (
                              <div>
                                <label style={smallLabelStyle}>{t('shifts.form.breakMinutes', 'Break duration')}</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={480}
                                  value={d.breakMinutes}
                                  onChange={(e) => updateDay(idx, 'breakMinutes', e.target.value)}
                                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '6px 8px' }}
                                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                                />
                              </div>
                            ) : (
                              <>
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
                              </>
                            )}
                          </div>
                          {d.breakType === 'flexible' && (
                            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                              {t('shifts.form.breakFlexHint', 'Employee can take this break at any time during the shift, respecting total minutes.')}
                            </div>
                          )}
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
                {saving
                  ? 'Saving…'
                  : (editingTemplate
                    ? t('shifts.saveTemplate', 'Save Template')
                    : `✓ Create Template (${enabledCount} day${enabledCount !== 1 ? 's' : ''})`)}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <DatePicker
                  label={t('transfers.form.startDate', 'Start date')}
                  value={applyStartDate}
                  onChange={setApplyStartDate}
                />
                <DatePicker
                  label={t('transfers.form.endDate', 'End date')}
                  value={applyEndDate}
                  onChange={setApplyEndDate}
                />
              </div>
              {applyStartDate && applyEndDate && applyStartDate > applyEndDate && (
                <div style={{
                  marginBottom: 12,
                  background: 'var(--danger-bg)',
                  border: '1px solid var(--danger-border)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  color: 'var(--danger)',
                  fontSize: 12,
                }}>
                  {t('errors.INVALID_DATE_RANGE', t('errors.DEFAULT'))}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {t('shifts.applyEmployees', 'Employees')}
                  {applyEmployees.length > 0 && (
                    <button type="button" onClick={() =>
                      setApplyEmployeeIds(applyEmployeeIds.length === applyEmployees.length ? [] : applyEmployees.map(e => e.id))
                    } style={{
                      marginLeft: 10, fontSize: 11, background: 'none', border: 'none',
                      color: 'var(--accent)', cursor: 'pointer', fontWeight: 600,
                    }}>
                      {applyEmployeeIds.length === applyEmployees.length ? t('common.none', 'None') : t('common.all', 'All')}
                    </button>
                  )}
                </div>
                {employeesLoading ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common.loading', 'Loading...')}</p>
                ) : applyEmployees.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common.noData', 'No data available')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {applyEmployees.map((emp) => {
                      const selected = applyEmployeeIds.includes(emp.id);
                      const fullName = `${emp.name} ${emp.surname}`.trim();
                      const initials = `${emp.name?.[0] ?? ''}${emp.surname?.[0] ?? ''}`.toUpperCase() || 'U';
                      const avatarUrl = getAvatarUrl(emp.avatarFilename);
                      const transfer = emp.transferForApply ?? null;
                      const isTransferred = Boolean(emp.isTransferredForApply);
                      const homeStoreName = transfer?.originStoreName ?? emp.storeName;
                      return (
                        <label key={emp.id} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          padding: '8px 10px', borderRadius: 8,
                          border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                          background: selected ? 'rgba(201,151,58,0.06)' : 'var(--surface-warm)',
                          cursor: 'pointer',
                          transition: 'all 0.12s',
                        }}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleEmployee(emp.id)}
                            style={{ accentColor: 'var(--accent)', width: 14, height: 14, marginTop: 6 }}
                          />
                          <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            background: 'rgba(13,33,55,0.14)',
                            color: '#0D2137',
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            {avatarUrl ? (
                              <img src={avatarUrl} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {fullName}
                                </div>
                                {isTransferred && (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '1px 6px',
                                    borderRadius: 999,
                                    border: '1px solid rgba(15,118,110,0.32)',
                                    background: 'rgba(13,148,136,0.08)',
                                    color: '#0f766e',
                                    fontSize: 9,
                                    fontWeight: 800,
                                    flexShrink: 0,
                                    textTransform: 'uppercase',
                                    lineHeight: 1.3,
                                  }}>
                                    <ArrowLeftRight size={10} />
                                    {t('shifts.transferredEmployee', 'Transferred')}
                                  </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                {homeStoreName && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '2px 7px',
                                  borderRadius: 999,
                                  background: 'rgba(13,33,55,0.06)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--text-muted)',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  lineHeight: 1.2,
                                }}>
                                  <StoreIcon size={10} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }} title={homeStoreName}>
                                    {homeStoreName}
                                  </span>
                                </span>
                              )}
                              {transfer && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '2px 7px',
                                  borderRadius: 999,
                                  background: transfer.status === 'cancelled' ? 'rgba(239,68,68,0.08)' : 'rgba(13,148,136,0.1)',
                                  border: `1px solid ${transfer.status === 'cancelled' ? 'rgba(185,28,28,0.32)' : 'rgba(15,118,110,0.32)'}`,
                                  color: transfer.status === 'cancelled' ? '#991b1b' : '#0f766e',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  lineHeight: 1.2,
                                }}>
                                  <ArrowLeftRight size={10} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }} title={transfer.targetStoreName}>
                                    {transfer.targetStoreName}
                                  </span>
                                  <span style={{ textTransform: 'uppercase', fontSize: 9 }}>
                                    {t(`transfers.status.${transfer.status}`, transfer.status)}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
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
                disabled={applying || !applyStartDate || !applyEndDate || applyStartDate > applyEndDate || applyEmployeeIds.length === 0}
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
                const storeName = tmpl.storeName ?? stores.find((s) => s.id === tmpl.storeId)?.name ?? `#${tmpl.storeId}`;
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
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => openApply(tmpl)}
                          style={templateApplyBtnStyle}
                        >
                          <PlayCircle size={13} />
                          {t('shifts.applyBtn', 'Apply')}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditWizard(tmpl)}
                          style={templateIconBtnStyle}
                          title={t('common.edit', 'Edit')}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(tmpl.id)}
                          style={templateDangerIconBtnStyle}
                          title={t('common.delete', 'Delete')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
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
                                  {(p.breakType ?? 'fixed') === 'flexible'
                                    ? `${p.breakMinutes ?? 0}m (${t('shifts.form.breakType_flexible', 'Flexible break')})`
                                    : (p.breakStart && p.breakEnd ? `${p.breakStart}–${p.breakEnd}` : '—')}
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

const templateApplyBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  border: '1px solid rgba(13,33,55,0.15)',
  background: 'rgba(13,33,55,0.9)',
  color: '#fff',
  borderRadius: 8,
  fontSize: 11,
  fontWeight: 700,
  padding: '4px 10px',
  cursor: 'pointer',
};

const templateIconBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-secondary)',
  borderRadius: 8,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const templateDangerIconBtnStyle: React.CSSProperties = {
  ...templateIconBtnStyle,
  color: '#991b1b',
  borderColor: 'rgba(185,28,28,0.24)',
  background: 'rgba(220,38,38,0.08)',
};
