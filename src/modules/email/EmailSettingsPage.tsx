import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { getEmailConfig, saveEmailConfig, SmtpConfig } from '../../api/email';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import { Eye, EyeOff, Mail, ShieldCheck, Info } from 'lucide-react';

export default function EmailSettingsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<SmtpConfig>({
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpFrom: '',
  });

  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        const data = await getEmailConfig();
        setIsSuperAdmin(data.superAdmin);
        if (data.company) {
          setCompanyName(data.company.name);
        }
        if (data.config) {
          setFormData({
            smtpHost: data.config.smtpHost || '',
            smtpPort: data.config.smtpPort || 587,
            smtpUser: data.config.smtpUser || '',
            smtpPass: data.config.smtpPass || '',
            smtpFrom: data.config.smtpFrom || '',
          });
        }
      } catch (err) {
        console.error('Failed to load email config:', err);
        setError(t('email.errorLoad', 'Failed to load email configuration'));
      } finally {
        setLoading(false);
      }
    }
    void loadConfig();
  }, [t]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveEmailConfig(formData);
      showToast(t('email.saveSuccess', 'SMTP configuration saved successfully'), 'success');
    } catch (err: any) {
      console.error('Failed to save email config:', err);
      const backendError = err.response?.data?.error;
      setError(backendError || t('email.errorSave', 'Failed to save email configuration'));
      showToast(backendError || t('email.errorSave', 'Failed to save email configuration'), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page-enter" style={{ maxWidth: 920, margin: '0 auto', padding: '20px' }}>
        <div style={{ height: 200, borderRadius: 14, background: 'var(--surface)', opacity: 0.5, border: '1px solid var(--border)' }} />
      </div>
    );
  }

  if (isSuperAdmin) {
    return (
      <div className="page-enter" style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 16 }}>
        <section style={{
          background: 'linear-gradient(135deg, rgba(13,33,55,0.95), rgba(24,63,98,0.94))',
          borderRadius: 14,
          border: '1px solid rgba(201,151,58,0.25)',
          padding: '18px 20px',
          color: '#F8FAFC',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShieldCheck size={28} color="var(--accent)" />
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 23 }}>{t('nav.email')}</h2>
          </div>
          <p style={{ margin: '12px 0 0', color: 'rgba(248,250,252,0.78)', lineHeight: 1.6 }}>
            {t('email.superAdminNote', 'As Super Admin, SMTP settings are configured per company by each company\'s Admin.')}
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 16 }}>
      {/* Company Header */}
      <section style={{
        background: 'linear-gradient(135deg, rgba(13,33,55,0.95), rgba(24,63,98,0.94))',
        borderRadius: 14,
        border: '1px solid rgba(201,151,58,0.25)',
        padding: '18px 20px',
        color: '#F8FAFC',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Mail size={24} color="var(--accent)" />
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 23 }}>{t('nav.email')}</h2>
          </div>
          {companyName && (
             <span style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              borderRadius: 8,
              padding: '4px 10px',
              border: '1px solid rgba(201,151,58,0.35)',
              background: 'rgba(201,151,58,0.2)',
              color: '#F3D48D',
            }}>
              {companyName}
            </span>
          )}
        </div>
        <p style={{ margin: '8px 0 0', color: 'rgba(248,250,252,0.78)', lineHeight: 1.6, fontSize: 14 }}>
          {t('email.configSubtitle', 'Configure your company\'s SMTP server to send automated emails (e.g., leave approvals, shift assignments).')}
        </p>
      </section>

      {error && <Alert variant="danger" onClose={() => setError(null)}>{error}</Alert>}

      <section style={{
        background: 'var(--surface)',
        borderRadius: 14,
        border: '1px solid var(--border)',
        padding: '24px',
      }}>
        <form onSubmit={handleSave} style={{ display: 'grid', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            <Input
              label={t('email.smtpHost', 'SMTP Host')}
              placeholder="e.g., smtp.gmail.com"
              value={formData.smtpHost}
              onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
              required
            />
            <Input
              label={t('email.smtpPort', 'SMTP Port')}
              type="number"
              placeholder="587"
              value={formData.smtpPort}
              onChange={(e) => setFormData({ ...formData, smtpPort: parseInt(e.target.value, 10) })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            <Input
              label={t('email.smtpUser', 'SMTP User / Username')}
              placeholder="e.g., user@company.com"
              value={formData.smtpUser}
              onChange={(e) => setFormData({ ...formData, smtpUser: e.target.value })}
              required
            />
            <div style={{ position: 'relative' }}>
              <Input
                label={t('email.smtpPass', 'SMTP Password')}
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={formData.smtpPass}
                onChange={(e) => setFormData({ ...formData, smtpPass: e.target.value })}
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 36,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10
                }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Input
            label={t('email.smtpFrom', 'Send Emails From (Address)')}
            placeholder="e.g., HR System <noreply@company.com>"
            value={formData.smtpFrom}
            onChange={(e) => setFormData({ ...formData, smtpFrom: e.target.value })}
            required
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '10px', borderRadius: 8, background: 'rgba(201,151,58,0.05)', border: '1px solid rgba(201,151,58,0.1)' }}>
            <Info size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
              {t('email.configSecurityNote', 'Credentials are stored securely. Ensure your SMTP provider allows connections from this server.')}
            </p>
          </div>

          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              loading={saving}
              style={{ minWidth: 140 }}
            >
              {t('common.save', 'Save Configuration')}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
