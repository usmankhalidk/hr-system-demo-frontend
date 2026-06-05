import React from 'react';

export default function CareersFooter() {
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
          <span>&copy; 2026 Fusaro Uomo. Powered by </span>
          <a href="https://veylohr.com" style={{ color: 'var(--primary)', fontWeight: 600 }}>Veylo HR</a>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          <a 
            href="/privacy" 
            style={{ color: 'var(--text-secondary)', transition: 'color 0.2s', textDecoration: 'none' }} 
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'} 
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            Privacy Policy
          </a>
          <a 
            href="/terms" 
            style={{ color: 'var(--text-secondary)', transition: 'color 0.2s', textDecoration: 'none' }} 
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'} 
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            Termini di Servizio
          </a>
          <a 
            href="/cookie-policy" 
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
