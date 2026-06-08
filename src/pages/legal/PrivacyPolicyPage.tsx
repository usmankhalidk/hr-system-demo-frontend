import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../components/ui/LanguageSwitcher';

export default function PrivacyPolicyPage() {
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
            {lang === 'it' ? 'Informativa sulla Privacy' : 'Privacy Policy'}
          </h1>

          {/* Italian Version */}
          {lang === 'it' && (
            <section lang="it" style={{ color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                <strong>Ultimo aggiornamento: 8 Giugno 2026</strong>
              </p>
              <p style={{ marginBottom: '16px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                Questa informativa descrive come trattiamo i dati personali dei candidati che inviano la propria candidatura presso <strong>Fusaro Uomo S.r.l.</strong>, in qualità di Titolare del trattamento. Ci impegniamo a garantire la riservatezza e la sicurezza dei dati forniti, in piena conformità al <strong>Regolamento Generale sulla Protezione dei Dati (GDPR - Regolamento UE 2016/679)</strong>.
              </p>
              
              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
                1. Titolare del Trattamento
              </h3>
              <p style={{ marginBottom: '16px', lineHeight: 1.7 }}>
                Il Titolare del trattamento è <strong>Fusaro Uomo S.r.l.</strong> Per qualsiasi richiesta o domanda in merito al trattamento dei tuoi dati personali, puoi contattare il nostro referente per la privacy all'indirizzo email: <a href="mailto:diletta@fusarouomo.it" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>diletta@fusarouomo.it</a>.
              </p>

              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
                2. Dati Raccolti
              </h3>
              <p style={{ marginBottom: '12px', lineHeight: 1.7 }}>
                Raccogliamo le seguenti categorie di dati nel contesto delle candidature:
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', lineHeight: 1.7 }}>
                <li style={{ marginBottom: '6px' }}>Dati identificativi e di contatto: nome, cognome, indirizzo email, recapito telefonico.</li>
                <li style={{ marginBottom: '6px' }}>Informazioni professionali: CV/Resume, lettere di presentazione, referenze professionali, percorsi di istruzione e competenze.</li>
                <li style={{ marginBottom: '6px' }}>Preferenze lavorative: disponibilità lavorativa, aspettative salariali e preferenze di sede.</li>
              </ul>

              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
                3. Finalità del Trattamento
              </h3>
              <p style={{ marginBottom: '16px', lineHeight: 1.7 }}>
                I dati raccolti vengono utilizzati esclusivamente per scopi legati alla ricerca e selezione del personale, inclusa la valutazione del profilo per la posizione aperta selezionata o per future opportunità all'interno di Fusaro Uomo S.r.l.
              </p>

              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
                4. Conservazione dei Dati
              </h3>
              <p style={{ marginBottom: '16px', lineHeight: 1.7 }}>
                I dati dei candidati saranno conservati per un periodo massimo di 24 mesi dall'ultimo contatto o dall'invio della candidatura, dopodiché verranno eliminati o resi anonimi in modo sicuro per tutelare la tua riservatezza.
              </p>

              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
                5. Diritti dell'Interessato
              </h3>
              <p style={{ marginBottom: '16px', lineHeight: 1.7 }}>
                In base agli <strong>articoli da 15 a 22 del GDPR</strong>, in qualità di interessato, disponi dei seguenti diritti:
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', lineHeight: 1.7 }}>
                <li style={{ marginBottom: '6px' }}><strong>Diritto di Accesso (Art. 15):</strong> Diritto di ottenere la conferma che sia o meno in corso un trattamento di dati personali che ti riguardano.</li>
                <li style={{ marginBottom: '6px' }}><strong>Diritto di Rettifica (Art. 16):</strong> Diritto di ottenere la rettifica dei dati inesatti o l'integrazione di quelli incompleti.</li>
                <li style={{ marginBottom: '6px' }}><strong>Diritto alla Cancellazione / Oblio (Art. 17):</strong> Diritto di richiedere la cancellazione dei tuoi dati personali quando non sono più necessari o per revoca del consenso.</li>
                <li style={{ marginBottom: '6px' }}><strong>Diritto di Limitazione (Art. 18):</strong> Diritto di limitare il trattamento in caso di contestazione sull'esattezza dei dati o liceità del trattamento.</li>
                <li style={{ marginBottom: '6px' }}><strong>Diritto alla Portabilità (Art. 20):</strong> Diritto di ricevere i dati in formato strutturato di uso comune.</li>
                <li style={{ marginBottom: '6px' }}><strong>Diritto di Opposizione (Art. 21):</strong> Diritto di opporsi in qualsiasi momento al trattamento dei propri dati personali.</li>
                <li style={{ marginBottom: '6px' }}><strong>Processo decisionale non automatizzato (Art. 22):</strong> Diritto di non essere sottoposto a decisioni basate unicamente su trattamenti automatizzati.</li>
              </ul>
              <p style={{ marginBottom: '16px', lineHeight: 1.7 }}>
                Per esercitare i tuoi diritti, puoi inviare una richiesta scritta in qualsiasi momento a: <a href="mailto:diletta@fusarouomo.it" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>diletta@fusarouomo.it</a>.
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
                This privacy policy describes how we process the personal data of candidates applying for open positions at <strong>Fusaro Uomo S.r.l.</strong>, acting as Data Controller. We are committed to ensuring the confidentiality and security of the data provided, in full compliance with the <strong>General Data Protection Regulation (GDPR - EU Regulation 2016/679)</strong>.
              </p>
              
              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
                1. Data Controller
              </h3>
              <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
                The Data Controller is <strong>Fusaro Uomo S.r.l.</strong> For any privacy-related requests or questions regarding how your personal data is handled, please contact us at: <a href="mailto:diletta@fusarouomo.it" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>diletta@fusarouomo.it</a>.
              </p>

              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
                2. Data Collected
              </h3>
              <p style={{ marginBottom: '12px', lineHeight: 1.7, fontSize: '14px' }}>
                We collect the following categories of data in the context of applications:
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', fontSize: '14px', lineHeight: 1.7 }}>
                <li style={{ marginBottom: '6px' }}>Contact details: first name, last name, email address, phone number.</li>
                <li style={{ marginBottom: '6px' }}>Professional profile: CV/Resume, cover letters, references, education history, and skills.</li>
                <li style={{ marginBottom: '6px' }}>Preferences: work availability, salary expectations, and location preferences.</li>
              </ul>

              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
                3. Purpose of Processing
              </h3>
              <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
                The collected data is used exclusively for purposes related to the recruitment process, including evaluating profiles for selected open positions or future job opportunities within Fusaro Uomo S.r.l.
              </p>

              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
                4. Data Retention
              </h3>
              <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
                Candidate data will be retained for a maximum period of 24 months from the last contact or application submission, after which it will be safely deleted or anonymized to protect your privacy.
              </p>

              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
                5. Your Rights
              </h3>
              <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
                Under <strong>GDPR Articles 15 to 22</strong>, you have the following rights as a data subject:
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', fontSize: '14px', lineHeight: 1.7 }}>
                <li style={{ marginBottom: '6px' }}><strong>Right of Access (Art. 15):</strong> Right to obtain confirmation as to whether or not personal data concerning you is being processed.</li>
                <li style={{ marginBottom: '6px' }}><strong>Right to Rectification (Art. 16):</strong> Right to request the correction of inaccurate or incomplete personal data.</li>
                <li style={{ marginBottom: '6px' }}><strong>Right to Erasure / Diritto all'Oblio (Art. 17):</strong> Right to request deletion of personal data when no longer needed or if consent is withdrawn.</li>
                <li style={{ marginBottom: '6px' }}><strong>Right to Restriction (Art. 18):</strong> Right to limit processing under specific legal conditions.</li>
                <li style={{ marginBottom: '6px' }}><strong>Right to Portability (Art. 20):</strong> Right to receive data in a structured, commonly used format.</li>
                <li style={{ marginBottom: '6px' }}><strong>Right to Object (Art. 21):</strong> Right to object at any time to the processing of personal data.</li>
                <li style={{ marginBottom: '6px' }}><strong>Non-automated processing (Art. 22):</strong> Right not to be subject to a decision based solely on automated processing.</li>
              </ul>
              <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
                To exercise these rights, you can send your request at any time to: <a href="mailto:diletta@fusarouomo.it" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>diletta@fusarouomo.it</a>.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
