import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../components/ui/LanguageSwitcher';

export default function CookiePolicyPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'it';

  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh', padding: '40px 20px', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <a 
            href="/careers" 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px', 
              color: 'var(--primary)', 
              fontWeight: 600, 
              fontSize: '14px', 
              textDecoration: 'none',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--primary)')}
          >
            <ArrowLeft size={16} />
            {lang === 'it' ? 'Torna alle Careers' : 'Back to Careers'}
          </a>
          <LanguageSwitcher variant="pill" />
        </div>

        <div style={{ 
          background: 'var(--surface)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '40px', 
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)'
        }}>
          <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)', fontSize: '28px', fontWeight: 800, marginBottom: '24px' }}>
            {lang === 'it' ? 'Informativa sui Cookie' : 'Cookie Policy'}
          </h1>

          {/* Italian Version */}
          {lang === 'it' && (
            <section lang="it" style={{ color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                <strong>Ultimo aggiornamento: 8 Giugno 2026</strong>
              </p>
              <p style={{ marginBottom: '16px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                Il portale Careers di <strong>Fusaro Uomo S.r.l.</strong> utilizza cookie e tecnologie simili per migliorare l'esperienza di navigazione ed analizzare l'uso del nostro portale.
              </p>
              
              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
                1. Cosa sono i Cookie
              </h3>
              <p style={{ marginBottom: '16px', lineHeight: 1.7 }}>
                I cookie sono piccoli file di testo salvati sul tuo dispositivo durante la visita del sito. Consentono di memorizzare preferenze di navigazione (come la lingua selezionata) e informazioni sulle sessioni per agevolare le interazioni successive.
              </p>

              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
                2. Tipologie di Cookie Utilizzati
              </h3>
              <p style={{ marginBottom: '12px', lineHeight: 1.7 }}>
                Utilizziamo le seguenti tipologie di cookie:
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', lineHeight: 1.7 }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Cookie Tecnici (Necessari):</strong> Indispensabili per consentire la navigazione del sito e il funzionamento di base del portale (es. mantenimento della sessione di compilazione della candidatura).
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Cookie Analitici:</strong> Utilizzati in forma anonima e aggregata per raccogliere informazioni statistiche sulle visite al sito (es. quante visualizzazioni ha ricevuto un annuncio di lavoro).
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Cookie di Profilazione e Marketing:</strong> Utilizzati per tracciare la navigazione dell'utente e creare profili pubblicitari personalizzati. <em>Nota: Fusaro Uomo S.r.l. non utilizza cookie di profilazione proprietari o di terze parti a scopo pubblicitario sul portale Careers.</em>
                </li>
              </ul>

              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
                3. Gestione e Consenso dei Cookie
              </h3>
              <p style={{ marginBottom: '16px', lineHeight: 1.7 }}>
                Puoi scegliere di disabilitare o bloccare i cookie tramite le impostazioni del tuo browser web. Tuttavia, tieni presente che la disattivazione dei cookie tecnici essenziali potrebbe compromettere la corretta visualizzazione delle pagine o il caricamento e l'invio del modulo di candidatura.
              </p>
              <p style={{ marginBottom: '16px', lineHeight: 1.7 }}>
                Per domande o richieste in merito al trattamento dei dati personali legati ai cookie, puoi scrivere a: <a href="mailto:diletta@fusarouomo.it" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>diletta@fusarouomo.it</a>.
              </p>
            </section>
          )}

          {/* English Version */}
          {lang === 'en' && (
            <section lang="en" style={{ color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                <strong>Last Updated: June 8, 2026</strong>
              </p>
              <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
                The Careers portal of <strong>Fusaro Uomo S.r.l.</strong> uses cookies and similar technologies to improve your browsing experience and analyze the usage of our portal.
              </p>
              
              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
                1. What are Cookies
              </h3>
              <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
                Cookies are small text files saved on your device during your visit to the website. They allow the storage of browsing preferences (such as selected language) and session details to facilitate subsequent interactions.
              </p>

              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
                2. Types of Cookies Used
              </h3>
              <p style={{ marginBottom: '12px', lineHeight: 1.7, fontSize: '14px' }}>
                We use the following types of cookies:
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', fontSize: '14px', lineHeight: 1.7 }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Technical Cookies (Necessary):</strong> Essential for enabling website navigation and basic portal operations (e.g., maintaining the session during application submittal).
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Analytical Cookies:</strong> Used anonymously to track website performance and compile aggregate visit statistics (e.g., how many views a job post receives).
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Marketing & Profiling Cookies:</strong> Used to track user navigation and build personalized advertising profiles. <em>Note: Fusaro Uomo S.r.l. does not deploy proprietary or third-party marketing cookies on this recruitment portal.</em>
                </li>
              </ul>

              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
                3. Managing Cookie Preferences
              </h3>
              <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
                You can choose to disable or block cookies through your web browser settings. However, please note that disabling essential technical cookies might affect the correct rendering of the pages or the completion and submission of the job application form.
              </p>
              <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
                For any questions regarding our cookie usage, please contact us at: <a href="mailto:diletta@fusarouomo.it" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>diletta@fusarouomo.it</a>.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
