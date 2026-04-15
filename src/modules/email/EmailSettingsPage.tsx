import React from 'react';
import { useTranslation } from 'react-i18next';

export default function EmailSettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="page-enter" style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 16 }}>
      <section style={{
        background: 'linear-gradient(135deg, rgba(13,33,55,0.95), rgba(24,63,98,0.94))',
        borderRadius: 14,
        border: '1px solid rgba(201,151,58,0.25)',
        padding: '18px 20px',
        color: '#F8FAFC',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 23 }}>{t('nav.email')}</h2>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            borderRadius: 999,
            padding: '3px 9px',
            border: '1px solid rgba(201,151,58,0.35)',
            background: 'rgba(201,151,58,0.2)',
            color: '#F3D48D',
          }}>
            {t('common.comingSoon')}
          </span>
        </div>
        <p style={{ margin: '8px 0 0', color: 'rgba(248,250,252,0.78)', lineHeight: 1.6 }}>
          This module will be implemented in Phase 4
          <br />
          Questo modulo sara implementato nella Fase 4
        </p>
      </section>

      <section style={{
        background: 'var(--surface)',
        borderRadius: 14,
        border: '1px solid var(--border)',
        padding: '14px 16px',
      }}>
        <h3 style={{ margin: '0 0 10px', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Planned features</h3>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <li>Multi-language templates (Italian + English)</li>
          <li>Template editor with preview</li>
          <li>Per-role notification preferences</li>
          <li>SMTP / SendGrid / Resend provider selection</li>
          <li>Test email sender</li>
          <li>Email logs</li>
        </ul>
      </section>
    </div>
  );
}
