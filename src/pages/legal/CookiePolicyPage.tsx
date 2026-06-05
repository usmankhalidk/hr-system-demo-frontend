import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function CookiePolicyPage() {
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
            Informativa sui Cookie
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '32px', fontWeight: 500 }}>
            Cookie Policy (English translation below)
          </p>

          {/* Italian Version */}
          <section lang="it" style={{ marginBottom: '40px', borderBottom: '1px solid var(--border-light)', paddingBottom: '40px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              <strong>Ultimo aggiornamento: 4 Giugno 2026</strong>
            </p>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              Il portale Careers di Fusaro Uomo utilizza cookie e tecnologie simili per migliorare l'esperienza di navigazione ed analizzare l'uso del nostro portale.
            </p>
            
            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
              1. Cosa sono i Cookie
            </h3>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              I cookie sono piccoli file di testo salvati sul tuo dispositivo durante la visita del sito. Consentono di memorizzare preferenze di navigazione (come la lingua selezionata) e informazioni sulle sessioni.
            </p>

            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
              2. Cookie Utilizzati
            </h3>
            <p style={{ marginBottom: '12px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              Utilizziamo le seguenti tipologie di cookie:
            </p>
            <ul style={{ paddingLeft: '20px', marginBottom: '16px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <li style={{ marginBottom: '6px' }}><strong>Cookie Tecnici Essenziali:</strong> Necessari per il funzionamento di base del portale (es. gestione delle sessioni di candidatura).</li>
              <li style={{ marginBottom: '6px' }}><strong>Cookie Analitici:</strong> Utilizzati in forma anonima per monitorare le statistiche di visita del sito (es. quante visite riceve un annuncio).</li>
            </ul>

            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
              3. Gestione dei Cookie
            </h3>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              Puoi scegliere di disabilitare o bloccare i cookie tramite le impostazioni del tuo browser web, ma questo potrebbe compromettere la corretta compilazione ed invio del modulo di candidatura.
            </p>
          </section>

          {/* English Version */}
          <section lang="en" style={{ color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              <strong>Last Updated: June 4, 2026</strong>
            </p>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px', fontStyle: 'italic' }}>
              The Careers portal of Fusaro Uomo uses cookies and similar technologies to improve the browsing experience and analyze the usage of our portal.
            </p>
            
            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
              1. What are Cookies
            </h3>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
              Cookies are small text files saved on your device during your visit to the website. They allow the storage of browsing preferences (such as selected language) and session details.
            </p>

            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
              2. Cookies Used
            </h3>
            <p style={{ marginBottom: '12px', lineHeight: 1.7, fontSize: '14px' }}>
              We use the following types of cookies:
            </p>
            <ul style={{ paddingLeft: '20px', marginBottom: '16px', fontSize: '14px', lineHeight: 1.7 }}>
              <li style={{ marginBottom: '6px' }}><strong>Essential Technical Cookies:</strong> Necessary for the basic functionality of the portal (e.g., managing application sessions).</li>
              <li style={{ marginBottom: '6px' }}><strong>Analytical Cookies:</strong> Used anonymously to monitor website traffic statistics (e.g., how many views a job post receives).</li>
            </ul>

            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
              3. Cookie Management
            </h3>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
              You can choose to disable or block cookies through your web browser settings, but this might affect the correct compilation and submission of the application form.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
