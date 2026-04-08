import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

function ProgressRing({ pct, light = false }: { pct: number; light?: boolean }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct === 100 ? '#4ADE80' : pct > 50 ? '#C9973A' : '#60A5FA';
  const trackColor = light ? 'rgba(255,255,255,0.2)' : 'var(--border)';
  const textColor = light ? '#fff' : color;
  return (
    <svg width={80} height={80} style={{ flexShrink: 0 }}>
      <circle cx={40} cy={40} r={r} fill="none" stroke={trackColor} strokeWidth={7} />
      <circle
        cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x={40} y={44} textAnchor="middle" fontSize={14} fontWeight={700}
        fontFamily="var(--font-display)" fill={textColor}>
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
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // Form state
  const [fName, setFName] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fOrder, setFOrder] = useState('0');

  const fetchData = useCallback(async () => {
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

  useEffect(() => { fetchData(); }, [fetchData]);

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
        setTemplates((prev) => prev.map((tmpl) => (tmpl.id === updated.id ? updated : tmpl)));
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
      setTemplates((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      showToast(updated.isActive ? t('onboarding.templateActivated') : t('onboarding.templateDeactivated'), 'success');
    } catch {
      showToast(t('onboarding.errorSave'), 'error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
          color: 'var(--text-secondary)', cursor: 'pointer',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '6px 12px',
        }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
          {t('onboarding.showInactive')}
        </label>
        <button className="btn btn-primary" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => openModal()}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          {t('onboarding.newTemplate')}
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {[1,2,3].map((i) => (
            <div key={i} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 14, width: '35%', marginBottom: 7 }} />
                <div className="skeleton" style={{ height: 12, width: '55%' }} />
              </div>
              <div className="skeleton" style={{ height: 28, width: 70, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 56,
          background: 'var(--surface)', borderRadius: 16,
          border: '1px dashed var(--border)',
        }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>📝</div>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>
            {t('onboarding.noTemplates')}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {t('onboarding.noTemplatesHint', 'Create your first onboarding template to get started.')}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {templates.map((tmpl, idx) => {
            const isHovered = hoveredId === tmpl.id;
            return (
              <div
                key={tmpl.id}
                onMouseEnter={() => setHoveredId(tmpl.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderLeft: tmpl.isActive ? '3px solid var(--accent)' : '3px solid transparent',
                  borderRadius: 12,
                  padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: 16,
                  opacity: tmpl.isActive ? 1 : 0.55,
                  transition: 'box-shadow 0.18s ease, transform 0.18s ease',
                  boxShadow: isHovered ? 'var(--shadow)' : 'none',
                  transform: isHovered ? 'translateY(-1px)' : 'none',
                }}
              >
                {/* Number badge */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--primary)', color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
                  boxShadow: '0 2px 6px rgba(13,33,55,0.18)',
                }}>
                  {idx + 1}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {tmpl.name}
                  </div>
                  {tmpl.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tmpl.description}
                    </div>
                  )}
                </div>

                {/* Sort order badge */}
                <span style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
                  color: 'var(--text-muted)', background: 'var(--background)',
                  border: '1px solid var(--border-light, var(--border))',
                  padding: '2px 7px', borderRadius: 6, flexShrink: 0,
                }}>
                  #{tmpl.sortOrder}
                </span>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {!tmpl.isActive && (
                    <span style={{
                      fontSize: 11, color: 'var(--text-muted)', background: 'var(--background)',
                      padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)',
                    }}>
                      {t('common.inactive')}
                    </span>
                  )}
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 12, padding: '4px 12px' }}
                    onClick={() => openModal(tmpl)}
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    className="btn"
                    style={{
                      fontSize: 12, padding: '4px 12px',
                      background: tmpl.isActive ? '#FEF2F2' : '#F0FDF4',
                      color: tmpl.isActive ? '#DC2626' : '#15803D',
                      border: `1px solid ${tmpl.isActive ? '#FCA5A5' : '#86EFAC'}`,
                    }}
                    onClick={() => toggleActive(tmpl)}
                  >
                    {tmpl.isActive ? t('common.deactivate') : t('common.activate')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal via portal to avoid fixed-in-animated-container breakage */}
      {showModal && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(13,33,55,0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: 'var(--surface)', borderRadius: 16, padding: 0,
              width: '100%', maxWidth: 500,
              boxShadow: '0 24px 72px rgba(0,0,0,0.22)',
              animation: 'popIn 0.22s cubic-bezier(0.16,1,0.3,1)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{
              padding: '20px 28px 18px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h3 style={{
                margin: 0, fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700,
                color: 'var(--text-primary)',
              }}>
                {editTemplate ? t('onboarding.editTemplate') : t('onboarding.newTemplate')}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 20, lineHeight: 1,
                  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 6,
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleSave} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                  display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {t('onboarding.templateName')} *
                </label>
                <input
                  className="field-input"
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  required
                  placeholder={t('onboarding.templateNamePlaceholder')}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                  display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {t('onboarding.templateDesc')}
                </label>
                <textarea
                  className="field-input"
                  value={fDesc}
                  onChange={(e) => setFDesc(e.target.value)}
                  rows={3}
                  placeholder={t('onboarding.templateDescPlaceholder')}
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <label style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                  display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {t('onboarding.sortOrder')}
                </label>
                <input
                  className="field-input"
                  type="number"
                  min={0}
                  value={fOrder}
                  onChange={(e) => setFOrder(e.target.value)}
                  style={{ width: 120 }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {t('onboarding.sortOrderHint', 'Lower numbers appear first in the list.')}
                </div>
              </div>

              {/* Footer */}
              <div style={{
                display: 'flex', gap: 10, justifyContent: 'flex-end',
                paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4,
              }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || !fName.trim()}
                  style={{ minWidth: 90 }}
                >
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
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
  const [hoveredTask, setHoveredTask] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
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

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleComplete = async (taskId: number) => {
    setCompleting(taskId);
    try {
      await completeTask(taskId);
      setProgress((prev) => {
        if (!prev) return prev;
        const tasks = prev.tasks.map((task) =>
          task.id === taskId ? { ...task, completed: true, completedAt: new Date().toISOString() } : task
        );
        const completed = tasks.filter((task) => task.completed).length;
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
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #163352 100%)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 28,
        display: 'flex', gap: 24, alignItems: 'center',
      }}>
        <div className="skeleton" style={{ width: 80, height: 80, borderRadius: '50%', flexShrink: 0, opacity: 0.3 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ height: 18, width: '40%', marginBottom: 10, opacity: 0.3 }} />
          <div className="skeleton" style={{ height: 12, width: '60%', marginBottom: 8, opacity: 0.3 }} />
          <div className="skeleton" style={{ height: 6, width: '80%', borderRadius: 99, opacity: 0.3 }} />
        </div>
      </div>
      {[1,2,3].map((i) => (
        <div key={i} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '16px 20px', marginBottom: 10,
          display: 'flex', gap: 16, alignItems: 'center',
        }}>
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
      <div style={{ textAlign: 'center', padding: 64 }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
        <div style={{ fontWeight: 700, fontSize: 18, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: 8 }}>
          {t('onboarding.noTasksTitle')}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('onboarding.noTasksSubtitle')}</div>
      </div>
    );
  }

  const allDone = progress.completed === progress.total;

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Progress card — gradient hero */}
      <div style={{
        background: allDone
          ? 'linear-gradient(135deg, #166534 0%, #15803D 100%)'
          : 'linear-gradient(135deg, var(--primary) 0%, #163352 100%)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 28,
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        boxShadow: '0 8px 32px rgba(13,33,55,0.18)',
      }}>
        <ProgressRing pct={progress.percentage} light />
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20,
            color: '#fff', marginBottom: 4,
          }}>
            {allDone ? t('onboarding.allDone') : t('onboarding.progressTitle')}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', marginBottom: allDone ? 0 : 10 }}>
            {t('onboarding.progressSubtitle', { completed: progress.completed, total: progress.total })}
          </div>
          {!allDone && (
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                background: 'linear-gradient(90deg, #C9973A, #E6B85C)',
                borderRadius: 99,
                width: `${progress.percentage}%`,
                transition: 'width 0.6s ease',
              }} />
            </div>
          )}
        </div>
        {allDone && <div style={{ fontSize: 44 }}>🏆</div>}
      </div>

      {/* Tasks list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {progress.tasks.map((task, idx) => {
          const isHovered = hoveredTask === task.id;
          return (
            <div
              key={task.id}
              onMouseEnter={() => setHoveredTask(task.id)}
              onMouseLeave={() => setHoveredTask(null)}
              style={{
                background: task.completed
                  ? 'rgba(21,128,61,0.04)'
                  : isHovered ? 'var(--surface)' : 'var(--surface)',
                border: `1px solid ${task.completed ? 'rgba(134,239,172,0.6)' : isHovered ? 'var(--border)' : 'var(--border)'}`,
                borderRadius: 12, padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: 14,
                transition: 'box-shadow 0.18s ease, transform 0.18s ease, background 0.2s ease',
                boxShadow: isHovered && !task.completed ? 'var(--shadow-sm)' : 'none',
                transform: isHovered && !task.completed ? 'translateY(-1px)' : 'none',
              }}
            >
              {/* Checkbox button */}
              <button
                onClick={() => !task.completed && handleComplete(task.id)}
                disabled={task.completed || completing !== null}
                style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: task.completed
                    ? 'linear-gradient(135deg, #15803D, #16A34A)'
                    : 'var(--background)',
                  border: `2px solid ${task.completed ? '#15803D' : isHovered ? 'var(--accent)' : 'var(--border)'}`,
                  cursor: task.completed ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 13, fontWeight: 700,
                  transition: 'all 0.2s ease',
                  opacity: completing === task.id ? 0.6 : 1,
                  boxShadow: task.completed ? '0 2px 8px rgba(21,128,61,0.25)' : 'none',
                }}
                aria-label={task.completed ? 'Completed' : 'Mark as done'}
              >
                {task.completed ? '✓' : (completing === task.id ? '…' : '')}
              </button>

              {/* Number */}
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: 'var(--background)', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-display)',
                border: '1px solid var(--border)',
              }}>
                {idx + 1}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600, fontSize: 14,
                  color: task.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                  textDecoration: task.completed ? 'line-through' : 'none',
                  transition: 'color 0.2s ease, text-decoration 0.2s ease',
                }}>
                  {task.templateName}
                </div>
                {task.templateDescription && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {task.templateDescription}
                  </div>
                )}
              </div>

              {task.completed && task.completedAt && (
                <div style={{
                  fontSize: 11, color: '#15803D', fontWeight: 600, flexShrink: 0,
                  background: 'rgba(21,128,61,0.08)', padding: '3px 8px',
                  borderRadius: 6, border: '1px solid rgba(21,128,61,0.15)',
                }}>
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
          );
        })}
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

  const pct = progress?.percentage ?? 0;
  const allDone = progress ? progress.completed === progress.total && progress.total > 0 : false;

  return (
    <div style={{ maxWidth: 620 }}>
      {/* Lookup card */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '22px 24px', marginBottom: 20,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
          color: 'var(--text-primary)', marginBottom: 4,
        }}>
          {t('onboarding.lookupEmployee')}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          {t('onboarding.lookupHint', 'Enter an employee ID to view or assign onboarding tasks.')}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="field-input"
            type="number"
            min={1}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookupEmployee()}
            placeholder={t('onboarding.employeeIdPlaceholder')}
            style={{ flex: 1, minWidth: 120 }}
          />
          <button
            className="btn btn-secondary"
            onClick={lookupEmployee}
            disabled={!employeeId}
          >
            {t('onboarding.viewProgress')}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleAssign}
            disabled={!employeeId}
          >
            {t('onboarding.assignTasks')}
          </button>
        </div>
      </div>

      {loadingProgress && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '22px 24px',
        }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 16 }}>
            <div className="skeleton" style={{ width: 80, height: 80, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 15, width: '50%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: '30%' }} />
            </div>
          </div>
          {[1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8, marginBottom: 8 }} />)}
        </div>
      )}

      {progress && !loadingProgress && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}>
          {/* Progress header */}
          <div style={{
            background: allDone
              ? 'linear-gradient(135deg, #166534 0%, #15803D 100%)'
              : 'linear-gradient(135deg, var(--primary) 0%, #163352 100%)',
            padding: '20px 24px',
            display: 'flex', alignItems: 'center', gap: 20,
          }}>
            <ProgressRing pct={pct} light />
            <div>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17,
                color: '#fff', marginBottom: 4,
              }}>
                {allDone ? t('onboarding.allDone') : t('onboarding.progressTitle')}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                {t('onboarding.progressSubtitle', { completed: progress.completed, total: progress.total })}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                {t('onboarding.employeeIdLabel', 'Employee ID')}: {employeeId}
              </div>
            </div>
            {allDone && <div style={{ fontSize: 36, marginLeft: 'auto' }}>🏆</div>}
          </div>

          {/* Task list */}
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {progress.tasks.map((task) => (
              <div key={task.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                background: task.completed ? 'rgba(21,128,61,0.04)' : 'var(--background)',
                borderRadius: 10,
                border: `1px solid ${task.completed ? 'rgba(134,239,172,0.5)' : 'var(--border)'}`,
                transition: 'background 0.2s',
              }}>
                {/* Status icon */}
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: task.completed
                    ? 'linear-gradient(135deg, #15803D, #16A34A)'
                    : 'var(--surface)',
                  border: `2px solid ${task.completed ? '#15803D' : 'var(--border)'}`,
                  color: 'white', fontSize: 12, fontWeight: 700,
                  boxShadow: task.completed ? '0 2px 6px rgba(21,128,61,0.2)' : 'none',
                }}>
                  {task.completed ? '✓' : ''}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: task.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: task.completed ? 'line-through' : 'none',
                  }}>
                    {task.templateName}
                  </div>
                </div>

                {task.completedAt && (
                  <div style={{
                    fontSize: 11, color: '#15803D', fontWeight: 600, flexShrink: 0,
                    background: 'rgba(21,128,61,0.08)', padding: '2px 8px',
                    borderRadius: 6,
                  }}>
                    {new Date(task.completedAt).toLocaleDateString('it-IT')}
                  </div>
                )}
                {!task.completed && (
                  <span style={{
                    fontSize: 11, color: 'var(--text-muted)',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    padding: '2px 8px', borderRadius: 6, flexShrink: 0,
                  }}>
                    {t('common.pending', 'Pending')}
                  </span>
                )}
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
        { key: 'templates', label: t('onboarding.tabTemplates'), icon: '📋' },
        { key: 'overview', label: t('onboarding.tabOverview'), icon: '👥' },
      ]
    : [{ key: 'tasks', label: t('onboarding.tabMyTasks'), icon: '✅' }];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }} className="page-enter">

      {/* Hero header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #163352 100%)',
        borderRadius: 16, padding: '28px 32px', marginBottom: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16,
        boxShadow: '0 8px 32px rgba(13,33,55,0.14)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'rgba(201,151,58,0.18)',
              border: '1px solid rgba(201,151,58,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
            }}>
              🚀
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800,
              color: '#fff', margin: 0, letterSpacing: '-0.02em',
            }}>
              {t('nav.onboarding')}
            </h1>
          </div>
          <p style={{
            margin: 0, fontSize: 14,
            color: 'rgba(255,255,255,0.65)',
            maxWidth: 480,
          }}>
            {isAdmin ? t('onboarding.subtitleAdmin') : t('onboarding.subtitleEmployee')}
          </p>
        </div>

        {/* Quick stat badge */}
        <div style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12, padding: '10px 18px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            {isAdmin ? t('onboarding.tabTemplates') : t('onboarding.tabMyTasks')}
          </div>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20,
            color: 'var(--accent)',
          }}>
            {isAdmin ? t('onboarding.manageTasks', 'Manage') : t('onboarding.trackProgress', 'Track')}
          </div>
        </div>
      </div>

      {/* Pill tab switcher */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 28,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 4,
        width: 'fit-content',
      }}>
        {tabs.map((tb) => {
          const isActive = tab === tb.key;
          return (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key as typeof tab)}
              style={{
                padding: '8px 20px',
                background: isActive ? 'var(--primary)' : 'transparent',
                border: 'none',
                borderRadius: 9,
                color: isActive ? '#fff' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                display: 'flex', alignItems: 'center', gap: 7,
                fontFamily: 'var(--font-body)',
                boxShadow: isActive ? '0 2px 8px rgba(13,33,55,0.18)' : 'none',
              }}
            >
              <span style={{ fontSize: 15 }}>{tb.icon}</span>
              {tb.label}
            </button>
          );
        })}
      </div>

      {tab === 'templates' && <TemplatesPanel />}
      {tab === 'overview' && <EmployeesPanel />}
      {tab === 'tasks' && user && <MyTasksPanel employeeId={user.id} />}
    </div>
  );
}
