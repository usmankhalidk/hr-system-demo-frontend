import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../components/ui/LanguageSwitcher';

export default function TermsOfServicePage() {
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
            {lang === 'it' ? 'Termini di Servizio' : 'Terms of Service'}
          </h1>

          {/* Italian Version */}
          {lang === 'it' && (
            <section lang="it" style={{ color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                <strong>Ultimo aggiornamento: 8 Giugno 2026</strong>
              </p>
              <p style={{ marginBottom: '16px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                Benvenuto nel portale Careers di <strong>Fusaro Uomo S.r.l.</strong> Utilizzando questo portale per consultare gli annunci di lavoro e inviare la tua candidatura, accetti i presenti Termini di Servizio.
              </p>
              
              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
                1. Utilizzo del Portale
              </h3>
              <p style={{ marginBottom: '16px', lineHeight: 1.7 }}>
                Il portale è destinato esclusivamente a candidati reali in cerca di impiego presso Fusaro Uomo S.r.l. È severamente vietato l'invio di dati falsi, incompleti o fuorvianti. È vietato qualsiasi tentativo di alterare o manomettere la funzionalità tecnica del sistema.
              </p>

              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
                2. Candidature e Selezione
              </h3>
              <p style={{ marginBottom: '16px', lineHeight: 1.7 }}>
                L'invio di una candidatura non costituisce alcuna offerta formale di impiego né garantisce l'avvio di colloqui conoscitivi. Il nostro team di recruiting valuterà le candidature a propria discrezione, contattando esclusivamente i profili ritenuti idonei per le posizioni aperte.
              </p>

              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>
                3. Proprietà Intellettuale
              </h3>
              <p style={{ marginBottom: '16px', lineHeight: 1.7 }}>
                Tutti i contenuti presenti sul portale (loghi, marchi, testi, descrizioni delle posizioni aperte, codice sorgente e design) sono di proprietà esclusiva di Fusaro Uomo S.r.l. e sono protetti dalle leggi vigenti sul diritto d'autore. Non possono essere riprodotti o diffusi senza preventiva autorizzazione scritta.
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
                Welcome to the Careers portal of <strong>Fusaro Uomo S.r.l.</strong> By using this portal to view job openings and submit your application, you agree to these Terms of Service.
              </p>
              
              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
                1. Portal Usage
              </h3>
              <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
                This portal is intended solely for genuine job seekers looking for employment opportunities at Fusaro Uomo S.r.l. Submitting false, incomplete, or misleading data is strictly prohibited, as is any attempt to interfere with the technical operations or security of the system.
              </p>

              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
                2. Applications and Selection
              </h3>
              <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
                Submitting an application does not constitute a formal offer of employment nor does it guarantee an interview. The recruiting team will evaluate candidate submissions at their sole discretion and will contact only those candidates selected for further stages.
              </p>

              <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>
                3. Intellectual Property
              </h3>
              <p style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
                All contents displayed on this portal (logos, trademarks, texts, job descriptions, source code, and design layouts) are the exclusive property of Fusaro Uomo S.r.l. and are protected by copyright laws. They may not be copied, reproduced, or distributed without prior written consent.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
