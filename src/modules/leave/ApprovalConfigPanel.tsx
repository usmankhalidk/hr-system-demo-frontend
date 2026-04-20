import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getApprovalConfig, updateApprovalConfig, ApprovalLevel } from '../../api/leave';
import { useAuth } from '../../context/AuthContext';

const ROLE_LABELS: Record<string, { en: string; it: string }> = {
  store_manager: { en: 'Store Manager', it: 'Store Manager' },
  area_manager:  { en: 'Area Manager',  it: 'Area Manager' },
  hr:            { en: 'HR',            it: 'HR' },
  admin:         { en: 'Admin',         it: 'Admin' },
};

const ROLE_COLORS: Record<string, string> = {
  store_manager: '#3b82f6',
  area_manager:  '#8b5cf6',
  hr:            '#059669',
  admin:         '#b45309',
};

export default function ApprovalConfigPanel() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const lang = i18n.language === 'it' ? 'it' : 'en';

  const [levels, setLevels] = useState<ApprovalLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const companyId = user?.companyId;
  const isAdmin = user?.role === 'admin' || user?.isSuperAdmin;

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getApprovalConfig(companyId ?? undefined);
      setLevels(data);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleToggle = (role: string) => {
    setSuccess(false);
    setLevels((prev) => prev.map((l) =>
      l.role === role ? { ...l, enabled: !l.enabled } : l
    ));
  };

  const handleSave = async () => {
    if (!companyId) return;
    const enabledCount = levels.filter((l) => l.enabled).length;
    if (enabledCount === 0) {
      setError(t('leave.approval_config_min_one'));
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload = levels.map((l) => ({
        role: l.role,
        enabled: l.enabled,
        sort_order: l.sortOrder,
      }));
      const updated = await updateApprovalConfig(companyId, payload);
      setLevels(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', margin: '0 auto 12px',
          border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
          animation: 'spin 0.7s linear infinite',
        }} />
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loading')}</div>
      </div>
    );
  }

  const enabledLevels = levels.filter((l) => l.enabled);

  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        overflow: 'hidden',
        maxWidth: 560,
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-warm)',
        }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
            {t('leave.approval_config_title')}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            {t('leave.approval_config_desc')}
          </p>
        </div>

        {/* Levels */}
        <div style={{ padding: '12px 20px' }}>
          {levels.map((level, idx) => {
            const color = ROLE_COLORS[level.role] ?? '#64748b';
            const label = ROLE_LABELS[level.role]?.[lang] ?? level.role;
            return (
              <div key={level.role} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0',
                borderBottom: idx < levels.length - 1 ? '1px solid var(--border-light)' : 'none',
                opacity: level.enabled ? 1 : 0.5,
                transition: 'opacity 0.2s',
              }}>
                {/* Step number */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: level.enabled ? `${color}18` : 'var(--background)',
                  color: level.enabled ? color : 'var(--text-disabled)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, flexShrink: 0,
                  border: `1.5px solid ${level.enabled ? color : 'var(--border)'}`,
                }}>
                  {idx + 1}
                </div>

                {/* Role label */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    {label}
                  </div>
                </div>

                {/* Toggle switch */}
                {isAdmin && (
                  <button
                    onClick={() => handleToggle(level.role)}
                    style={{
                      width: 44, height: 24, borderRadius: 12,
                      background: level.enabled ? color : 'var(--border)',
                      border: 'none', cursor: 'pointer', position: 'relative',
                      transition: 'background 0.2s', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      position: 'absolute', top: 3,
                      left: level.enabled ? 23 : 3,
                      transition: 'left 0.2s',
                    }} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Flow preview */}
        {enabledLevels.length > 0 && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-warm)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              {t('leave.approval_flow_preview')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: 'rgba(107,114,128,0.1)', color: '#6b7280',
              }}>
                {t('leave.employee_request')}
              </span>
              {enabledLevels.map((l) => {
                const color = ROLE_COLORS[l.role] ?? '#64748b';
                const label = ROLE_LABELS[l.role]?.[lang] ?? l.role;
                return (
                  <span key={l.role} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--text-disabled)', fontSize: 13 }}>&rarr;</span>
                    <span style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: `${color}14`, color,
                    }}>
                      {label}
                    </span>
                  </span>
                );
              })}
              <span style={{ color: 'var(--text-disabled)', fontSize: 13 }}>&rarr;</span>
              <span style={{
                padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: 'rgba(22,163,74,0.1)', color: '#16a34a',
              }}>
                {t('leave.approved_label')}
              </span>
            </div>
          </div>
        )}

        {/* Error / Success */}
        {error && (
          <div style={{
            margin: '0 20px 12px', padding: '8px 12px', borderRadius: 8,
            background: 'rgba(220,38,38,0.08)', color: '#dc2626', fontSize: 12, fontWeight: 600,
          }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{
            margin: '0 20px 12px', padding: '8px 12px', borderRadius: 8,
            background: 'rgba(22,163,74,0.08)', color: '#16a34a', fontSize: 12, fontWeight: 600,
          }}>
            {t('leave.approval_config_saved')}
          </div>
        )}

        {/* Save button */}
        {isAdmin && (
          <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--border)' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 8,
                border: 'none', background: '#b68c56', color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
