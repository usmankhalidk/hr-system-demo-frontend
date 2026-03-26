import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { BalancesTab } from '../leave/AdminLeavePanel';

const IconSettings = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const IconBalances = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isAdminOrHr = user?.role === 'admin' || user?.role === 'hr';

  const [showLeaveBalance, setShowLeaveBalance] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    apiClient.get('/companies/settings')
      .then(r => setShowLeaveBalance(r.data.data.showLeaveBalanceToEmployee ?? true))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const handleToggle = async () => {
    if (!isAdmin || saving) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const newVal = !showLeaveBalance;
      await apiClient.patch('/companies/settings', { showLeaveBalanceToEmployee: newVal });
      setShowLeaveBalance(newVal);
      setSaveMsg(t('settings.savedSuccess'));
    } catch {
      setSaveMsg(t('settings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (!isAdminOrHr) {
    return (
      <div className="page-enter" style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ color: 'var(--primary)', opacity: 0.7 }}><IconSettings /></div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', margin: 0 }}>
              {t('settings.title')}
            </h1>
          </div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          {t('settings.noSettingsAvailable')}
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ color: 'var(--primary)', opacity: 0.7 }}><IconSettings /></div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', margin: 0 }}>
            {t('settings.title')}
          </h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          {t('settings.subtitle')}
        </p>
      </div>

      {/* Leave Balance Management (admin + hr) */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderLeft: '4px solid #0284C7',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 24,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ color: '#0284C7' }}><IconBalances /></span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              {t('settings.sectionLeaveBalance')}
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            {t('settings.sectionLeaveBalanceDesc')}
          </p>
        </div>
        <BalancesTab showFlash={(msg) => setSaveMsg(msg)} />
      </div>

      {/* Leave Visibility Toggle (admin only) */}
      {isAdmin && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderLeft: '4px solid #15803D',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ color: '#15803D' }}><IconEye /></span>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {t('settings.sectionLeave')}
              </h3>
            </div>
          </div>
          <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                {t('settings.leaveBalanceVisibility')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {t('settings.leaveBalanceVisibilityDesc')}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: showLeaveBalance ? '#15803D' : '#9ca3af' }}>
                {showLeaveBalance ? t('settings.visibilityOn') : t('settings.visibilityOff')}
              </span>
              {loading ? (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common.loading')}</span>
              ) : (
                <button
                  type="button"
                  role="switch"
                  aria-checked={showLeaveBalance}
                  disabled={saving}
                  onClick={handleToggle}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: saving ? 'not-allowed' : 'pointer' }}
                >
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    width: 52, height: 28, borderRadius: 14,
                    background: showLeaveBalance ? '#15803D' : '#9ca3af',
                    opacity: saving ? 0.6 : 1,
                    transition: 'background 0.2s',
                    position: 'relative',
                  }}>
                    <span style={{
                      position: 'absolute', top: 3, width: 22, height: 22,
                      left: showLeaveBalance ? 27 : 3,
                      borderRadius: '50%', background: '#fff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      transition: 'left 0.2s',
                    }} />
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Flash snackbar */}
      {saveMsg && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: saveMsg.toLowerCase().includes('err') ? '#dc2626' : '#15803D',
          color: '#fff', padding: '10px 20px', borderRadius: 8,
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: 9999, whiteSpace: 'nowrap',
        }}>
          {saveMsg}
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
