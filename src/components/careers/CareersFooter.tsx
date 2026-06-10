import React from 'react';
import { useTranslation } from 'react-i18next';

interface CareersFooterProps {
  companyName?: string;
  companyEmail?: string;
}

export default function CareersFooter({ companyName, companyEmail }: CareersFooterProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('en') ? 'en' : 'it';
  const displayCompany = companyName || 'Fusaro Uomo';

  const queryParams = new URLSearchParams();
  if (companyName) queryParams.set('companyName', companyName);
  if (companyEmail) queryParams.set('companyEmail', companyEmail || '');
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  return (
    <footer style={{
      background: 'var(--surface-warm)',
      borderTop: '1px solid var(--border)',
      padding: '24px 40px',
      marginTop: '48px',
      fontFamily: 'var(--font-body)',
      fontSize: '13px',
      color: 'var(--text-secondary)'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }} className="flex-col-mobile">
        <div>
          <span>&copy; 2026 {displayCompany}. Powered by </span>
          <a href="https://veylohr.com" style={{ color: 'var(--primary)', fontWeight: 600 }}>Veylo HR</a>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          <a 
            href={`/privacy${queryString}`} 
            style={{ color: 'var(--text-secondary)', transition: 'color 0.2s', textDecoration: 'none' }} 
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'} 
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            {lang === 'it' ? 'Informativa Privacy' : 'Privacy Policy'}
          </a>
          <a 
            href={`/terms${queryString}`} 
            style={{ color: 'var(--text-secondary)', transition: 'color 0.2s', textDecoration: 'none' }} 
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'} 
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            {lang === 'it' ? 'Termini di Servizio' : 'Terms of Service'}
          </a>
          <a 
            href={`/cookie-policy${queryString}`} 
            style={{ color: 'var(--text-secondary)', transition: 'color 0.2s', textDecoration: 'none' }} 
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'} 
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            Cookie Policy
          </a>
        </div>
      </div>
    </footer>
  );
}
