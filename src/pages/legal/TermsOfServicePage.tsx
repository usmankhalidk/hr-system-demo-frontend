import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh', padding: '40px 20px', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <a 
          href="/careers" 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px', 
            color: 'var(--primary)', 
            fontWeight: 600, 
            fontSize: '14px', 
            marginBottom: '32px', 
            textDecoration: 'none',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--primary)')}
        >
          <ArrowLeft size={16} />
          Torna alle Careers / Back to Careers
        </a>

        <div style={{ 
          background: 'var(--surface)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '40px', 
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)'
        }}>
          <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)', fontSize: '28px', fontWeight: 800, marginBottom: '6px' }}>
            Termini di Servizio
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '32px', fontWeight: 500 }}>
            Terms of Service (English translation below)
          </p>

          {/* Italian Version */}
          <section lang="it" style={{ marginBottom: '40px', borderBottom: '1px solid var(--border-light)', paddingBottom: '40px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              <strong>Ultimo aggiornamento: 4 Giugno 2026</strong>
            </p>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              Benvenuto nel portale Careers di Fusaro Uomo. Utilizzando questo portale per consultare gli annunci di lavoro e inviare la tua candidatura, accetti i presenti Termini di Servizio.
            </p>
            
            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
              1. Utilizzo del Portale
            </h3>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              Il portale è destinato a candidati reali in cerca di impiego presso Fusaro Uomo. È vietato l'invio di dati falsi, incompleti o fuorvianti. È vietato qualsiasi tentativo di alterare il funzionamento tecnico del sistema.
            </p>

            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
              2. Candidature
            </h3>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              L'invio di una candidatura non costituisce alcuna offerta formale di impiego né garantisce un colloquio conoscitivo. Il team recruiting valuterà le risposte a propria discrezione.
            </p>

            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
              3. Proprietà Intellettuale
            </h3>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              Tutti i contenuti presenti sul portale (loghi, testi, descrizioni delle posizioni) sono di proprietà esclusiva di Fusaro Uomo e non possono essere riutilizzati o diffusi senza autorizzazione.
            </p>
          </section>

          {/* English Version */}
          <section lang="en" style={{ color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              <strong>Last Updated: June 4, 2026</strong>
            </p>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px', fontStyle: 'italic' }}>
              Welcome to the Careers portal of Fusaro Uomo. By using this portal to view job openings and submit your application, you agree to these Terms of Service.
            </p>
            
            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
              1. Portal Usage
            </h3>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
              This portal is intended for genuine job seekers looking for employment opportunities at Fusaro Uomo. Submitting false, incomplete, or misleading data is strictly prohibited, as is any attempt to interfere with the technical operations of the system.
            </p>

            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
              2. Applications
            </h3>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
              Submitting an application does not constitute a formal offer of employment nor does it guarantee an interview. The recruiting team will evaluate candidate submissions at their sole discretion.
            </p>

            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
              3. Intellectual Property
            </h3>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
              All contents displayed on this portal (logos, texts, job descriptions) are the exclusive property of Fusaro Uomo and may not be reused or distributed without prior written consent.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
