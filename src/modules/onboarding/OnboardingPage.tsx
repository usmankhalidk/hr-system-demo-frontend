import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { translateApiError } from '../../utils/apiErrors';
import {
  getTemplates, createTemplate, updateTemplate,
  getEmployeeTasks, assignTasks, completeTask,
  OnboardingTemplate, OnboardingProgress,
} from '../../api/onboarding';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_ROLES = ['admin', 'hr', 'area_manager'];

function ProgressRing({ pct }: { pct: number }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct === 100 ? '#15803D' : pct > 50 ? '#C9973A' : '#0284C7';
  return (
    <svg width={80} height={80} style={{ flexShrink: 0 }}>
      <circle cx={40} cy={40} r={r} fill="none" stroke="var(--border)" strokeWidth={7} />
      <circle
        cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x={40} y={44} textAnchor="middle" fontSize={14} fontWeight={700}
        fontFamily="var(--font-display)" fill={color}>
        {pct}%
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Admin: Templates panel
// ---------------------------------------------------------------------------

const TemplatesPanel: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState<OnboardingTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [fName, setFName] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fOrder, setFOrder] = useState('0');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getTemplates(showInactive);
      setTemplates(list);
    } catch {
      showToast(t('onboarding.errorLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => { fetch(); }, [fetch]);

  const openModal = (tmpl?: OnboardingTemplate) => {
    setEditTemplate(tmpl ?? null);
    setFName(tmpl?.name ?? '');
    setFDesc(tmpl?.description ?? '');
    setFOrder(String(tmpl?.sortOrder ?? 0));
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editTemplate) {
        const updated = await updateTemplate(editTemplate.id, {
          name: fName.trim(), description: fDesc.trim() || undefined,
          sortOrder: parseInt(fOrder) || 0,
        });
        setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        showToast(t('onboarding.templateUpdated'), 'success');
      } else {
        const created = await createTemplate({
          name: fName.trim(), description: fDesc.trim() || undefined,
          sortOrder: parseInt(fOrder) || 0,
        });
        setTemplates((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
        showToast(t('onboarding.templateCreated'), 'success');
      }
      setShowModal(false);
    } catch (err) {
      showToast(translateApiError(err, t, t('onboarding.errorSave')) ?? t('onboarding.errorSave'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (tmpl: OnboardingTemplate) => {
    try {
      const updated = await updateTemplate(tmpl.id, { isActive: !tmpl.isActive });
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      showToast(updated.isActive ? t('onboarding.templateActivated') : t('onboarding.templateDeactivated'), 'success');
    } catch {
      showToast(t('onboarding.errorSave'), 'error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          {t('onboarding.showInactive')}
        </label>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => openModal()}>
          + {t('onboarding.newTemplate')}
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {[1,2,3].map((i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 14, width: '35%', marginBottom: 7 }} />
                <div className="skeleton" style={{ height: 12, width: '55%' }} />
              </div>
              <div className="skeleton" style={{ height: 28, width: 70, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('onboarding.noTemplates')}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {templates.map((tmpl, idx) => (
            <div key={tmpl.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 16,
              opacity: tmpl.isActive ? 1 : 0.55,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: 'var(--primary)', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
              }}>
                {idx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{tmpl.name}</div>
                {tmpl.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{tmpl.description}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {!tmpl.isActive && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--background)', padding: '2px 8px', borderRadius: 6 }}>
                    {t('common.inactive')}
                  </span>
                )}
                <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => openModal(tmpl)}>
                  {t('common.edit')}
                </button>
                <button
                  className="btn"
                  style={{ fontSize: 12, padding: '4px 10px', background: tmpl.isActive ? '#FEF2F2' : '#F0FDF4', color: tmpl.isActive ? '#DC2626' : '#15803D', border: `1px solid ${tmpl.isActive ? '#FCA5A5' : '#86EFAC'}` }}
                  onClick={() => toggleActive(tmpl)}
                >
                  {tmpl.isActive ? t('common.deactivate') : t('common.activate')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowModal(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', animation: 'popIn 0.22s cubic-bezier(0.16,1,0.3,1)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontFamily: 'var(--font-display)', fontSize: 17 }}>
              {editTemplate ? t('onboarding.editTemplate') : t('onboarding.newTemplate')}
            </h3>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>{t('onboarding.templateName')} *</label>
                <input className="field-input" value={fName} onChange={(e) => setFName(e.target.value)} required placeholder={t('onboarding.templateNamePlaceholder')} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>{t('onboarding.templateDesc')}</label>
                <textarea className="field-input" value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={3} placeholder={t('onboarding.templateDescPlaceholder')} style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>{t('onboarding.sortOrder')}</label>
                <input className="field-input" type="number" min={0} value={fOrder} onChange={(e) => setFOrder(e.target.value)} style={{ width: 100 }} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !fName.trim()}>{saving ? t('common.saving') : t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Employee: My Tasks panel
// ---------------------------------------------------------------------------

const MyTasksPanel: React.FC<{ employeeId: number }> = ({ employeeId }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<number | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getEmployeeTasks(employeeId);
      setProgress(p);
    } catch {
      showToast(t('onboarding.errorLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleComplete = async (taskId: number) => {
    setCompleting(taskId);
    try {
      await completeTask(taskId);
      setProgress((prev) => {
        if (!prev) return prev;
        const tasks = prev.tasks.map((t) =>
          t.id === taskId ? { ...t, completed: true, completedAt: new Date().toISOString() } : t
        );
        const completed = tasks.filter((t) => t.completed).length;
        return {
          ...prev, tasks, completed,
          percentage: Math.round((completed / prev.total) * 100),
        };
      });
      showToast(t('onboarding.taskCompleted'), 'success');
    } catch {
      showToast(t('onboarding.errorComplete'), 'error');
    } finally {
      setCompleting(null);
    }
  };

  if (loading) return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px', marginBottom: 28, display: 'flex', gap: 24, alignItems: 'center' }}>
        <div className="skeleton" style={{ width: 80, height: 80, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ height: 18, width: '40%', marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 12, width: '60%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 6, width: '80%', borderRadius: 99 }} />
        </div>
      </div>
      {[1,2,3].map((i) => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 10, display: 'flex', gap: 16, alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 14, width: '45%' }} />
          </div>
        </div>
      ))}
    </div>
  );

  if (!progress || progress.total === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 56 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
        <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)', marginBottom: 6 }}>{t('onboarding.noTasksTitle')}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('onboarding.noTasksSubtitle')}</div>
      </div>
    );
  }

  const allDone = progress.completed === progress.total;

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Progress card */}
      <div style={{
        background: allDone ? 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)' : 'var(--surface)',
        border: `1px solid ${allDone ? '#86EFAC' : 'var(--border)'}`,
        borderRadius: 16, padding: '24px 28px', marginBottom: 28,
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <ProgressRing pct={progress.percentage} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--text-primary)', marginBottom: 4 }}>
            {allDone ? t('onboarding.allDone') : t('onboarding.progressTitle')}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {t('onboarding.progressSubtitle', { completed: progress.completed, total: progress.total })}
          </div>
          {!allDone && (
            <div style={{ marginTop: 10, background: 'var(--border)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: 'var(--accent)', borderRadius: 99,
                width: `${progress.percentage}%`, transition: 'width 0.6s ease',
              }} />
            </div>
          )}
        </div>
        {allDone && <div style={{ fontSize: 40 }}>🏆</div>}
      </div>

      {/* Tasks list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {progress.tasks.map((task, idx) => (
          <div key={task.id} style={{
            background: 'var(--surface)', border: `1px solid ${task.completed ? '#86EFAC' : 'var(--border)'}`,
            borderRadius: 12, padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 16,
            opacity: task.completed ? 0.75 : 1,
            transition: 'opacity 0.3s',
          }}>
            {/* Checkmark */}
            <button
              onClick={() => !task.completed && handleComplete(task.id)}
              disabled={task.completed || completing !== null}
              style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: task.completed ? '#15803D' : 'var(--background)',
                border: `2px solid ${task.completed ? '#15803D' : 'var(--border)'}`,
                cursor: task.completed ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 14, transition: 'all 0.2s',
                opacity: completing === task.id ? 0.6 : 1,
              }}
            >
              {task.completed ? '✓' : (completing === task.id ? '…' : '')}
            </button>

            {/* Number */}
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: 'var(--background)', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)',
            }}>
              {idx + 1}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: 600, fontSize: 14, color: 'var(--text-primary)',
                textDecoration: task.completed ? 'line-through' : 'none',
              }}>
                {task.templateName}
              </div>
              {task.templateDescription && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{task.templateDescription}</div>
              )}
            </div>

            {task.completed && task.completedAt && (
              <div style={{ fontSize: 11, color: '#15803D', fontWeight: 500, flexShrink: 0 }}>
                ✓ {new Date(task.completedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
              </div>
            )}
            {!task.completed && (
              <button
                className="btn btn-primary"
                style={{ fontSize: 12, padding: '5px 14px', flexShrink: 0 }}
                onClick={() => handleComplete(task.id)}
                disabled={completing !== null}
              >
                {completing === task.id ? '…' : t('onboarding.markDone')}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Admin: Employee overview panel
// ---------------------------------------------------------------------------

const EmployeesPanel: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [employeeId, setEmployeeId] = useState<string>('');
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  const lookupEmployee = async () => {
    if (!employeeId) return;
    setLoadingProgress(true);
    setProgress(null);
    try {
      const p = await getEmployeeTasks(parseInt(employeeId));
      setProgress(p);
    } catch {
      showToast(t('onboarding.errorLoad'), 'error');
    } finally {
      setLoadingProgress(false);
    }
  };

  const handleAssign = async () => {
    if (!employeeId) return;
    try {
      const result = await assignTasks(parseInt(employeeId));
      showToast(t('onboarding.assignedTasks', { n: result.assigned }), 'success');
      lookupEmployee();
    } catch {
      showToast(t('onboarding.errorSave'), 'error');
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 14 }}>{t('onboarding.lookupEmployee')}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            className="field-input"
            type="number"
            min={1}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder={t('onboarding.employeeIdPlaceholder')}
            style={{ flex: 1 }}
          />
          <button className="btn btn-secondary" onClick={lookupEmployee} disabled={!employeeId}>{t('onboarding.viewProgress')}</button>
          <button className="btn btn-primary" onClick={handleAssign} disabled={!employeeId}>{t('onboarding.assignTasks')}</button>
        </div>
      </div>

      {loadingProgress && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 16 }}>
            <div className="skeleton" style={{ width: 80, height: 80, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 15, width: '50%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: '30%' }} />
            </div>
          </div>
          {[1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: 38, borderRadius: 8, marginBottom: 8 }} />)}
        </div>
      )}

      {progress && !loadingProgress && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
            <ProgressRing pct={progress.percentage} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>
                {t('onboarding.progressSubtitle', { completed: progress.completed, total: progress.total })}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>ID dipendente: {employeeId}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {progress.tasks.map((task) => (
              <div key={task.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', background: 'var(--background)', borderRadius: 8,
              }}>
                <span style={{ fontSize: 16 }}>{task.completed ? '✅' : '⬜'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: task.completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.completed ? 'line-through' : 'none' }}>{task.templateName}</div>
                </div>
                {task.completedAt && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(task.completedAt).toLocaleDateString('it-IT')}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main OnboardingPage
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);
  const [tab, setTab] = useState<'tasks' | 'templates' | 'overview'>(isAdmin ? 'templates' : 'tasks');

  const tabs = isAdmin
    ? [
        { key: 'templates', label: t('onboarding.tabTemplates') },
        { key: 'overview', label: t('onboarding.tabOverview') },
      ]
    : [{ key: 'tasks', label: t('onboarding.tabMyTasks') }];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }} className="page-enter">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('nav.onboarding')}
        </h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
          {isAdmin ? t('onboarding.subtitleAdmin') : t('onboarding.subtitleEmployee')}
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {tabs.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key as typeof tab)} style={{
            padding: '10px 18px', background: 'none', border: 'none',
            borderBottom: tab === tb.key ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === tb.key ? 'var(--accent)' : 'var(--text-secondary)',
            fontWeight: tab === tb.key ? 600 : 400, fontSize: 14, cursor: 'pointer', marginBottom: -1,
          }}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'templates' && <TemplatesPanel />}
      {tab === 'overview' && <EmployeesPanel />}
      {tab === 'tasks' && user && <MyTasksPanel employeeId={user.id} />}
    </div>
  );
}
