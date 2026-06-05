import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
            Informativa sulla Privacy
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '32px', fontWeight: 500 }}>
            Privacy Policy (English translation below)
          </p>

          {/* Italian Version */}
          <section lang="it" style={{ marginBottom: '40px', borderBottom: '1px solid var(--border-light)', paddingBottom: '40px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              <strong>Ultimo aggiornamento: 4 Giugno 2026</strong>
            </p>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              Questa informativa descrive come trattiamo i dati personali dei candidati che applicano alle posizioni aperte presso Fusaro Uomo. Ci impegniamo a garantire la riservatezza e la sicurezza dei dati forniti, in piena conformità al Regolamento Generale sulla Protezione dei Dati (GDPR - Regolamento UE 2016/679).
            </p>
            
            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
              1. Dati Raccolti
            </h3>
            <p style={{ marginBottom: '12px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              Raccogliamo le seguenti categorie di dati nel contesto delle candidature:
            </p>
            <ul style={{ paddingLeft: '20px', marginBottom: '16px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <li style={{ marginBottom: '6px' }}>Nome, cognome, indirizzo email, recapito telefonico.</li>
              <li style={{ marginBottom: '6px' }}>CV/Resume, lettere di presentazione e referenze professionali.</li>
              <li style={{ marginBottom: '6px' }}>Precedenti esperienze lavorative, livello di istruzione e competenze.</li>
              <li style={{ marginBottom: '6px' }}>Disponibilità lavorativa, aspettative salariali e preferenze di sede.</li>
            </ul>

            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
              2. Finalità del Trattamento
            </h3>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              I dati raccolti vengono utilizzati esclusivamente per scopi legati al processo di recruiting, inclusa la valutazione del profilo per la posizione selezionata o per future opportunità lavorative all'interno del gruppo.
            </p>

            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
              3. Conservazione dei Dati
            </h3>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              I dati dei candidati saranno conservati per un periodo massimo di 24 mesi dall'ultimo contatto o dall'invio della candidatura, dopodiché verranno eliminati o resi anonimi in modo sicuro.
            </p>

            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
              4. I Tuoi Diritti
            </h3>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              Ai sensi del GDPR, hai il diritto di accedere ai tuoi dati personali, richiederne la rettifica o la cancellazione, limitarne il trattamento, o opporti allo stesso inviando una email al nostro team di risorse umane.
            </p>
          </section>

          {/* English Version */}
          <section lang="en" style={{ color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              <strong>Last Updated: June 4, 2026</strong>
            </p>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px', fontStyle: 'italic' }}>
              This privacy policy describes how we process the personal data of candidates applying for open positions at Fusaro Uomo. We are committed to ensuring the confidentiality and security of the data provided, in full compliance with the General Data Protection Regulation (GDPR - EU Regulation 2016/679).
            </p>
            
            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
              1. Data Collected
            </h3>
            <p style={{ marginBottom: '12px', lineHeight: 1.7, fontSize: '14px' }}>
              We collect the following categories of data in the context of applications:
            </p>
            <ul style={{ paddingLeft: '20px', marginBottom: '16px', fontSize: '14px', lineHeight: 1.7 }}>
              <li style={{ marginBottom: '6px' }}>First name, last name, email address, phone number.</li>
              <li style={{ marginBottom: '6px' }}>CV/Resume, cover letters, and professional references.</li>
              <li style={{ marginBottom: '6px' }}>Previous work experience, education level, and skills.</li>
              <li style={{ marginBottom: '6px' }}>Work availability, salary expectations, and location preferences.</li>
            </ul>

            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
              2. Purpose of Processing
            </h3>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
              The collected data is used exclusively for purposes related to the recruitment process, including the evaluation of the profile for the selected position or for future job opportunities within the group.
            </p>

            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
              3. Data Retention
            </h3>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
              Candidate data will be retained for a maximum period of 24 months from the last contact or application submission, after which it will be safely deleted or anonymized.
            </p>

            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
              4. Your Rights
            </h3>
            <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
              Under the GDPR, you have the right to access your personal data, request its rectification or erasure, restrict its processing, or object to it by sending an email to our HR team.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
