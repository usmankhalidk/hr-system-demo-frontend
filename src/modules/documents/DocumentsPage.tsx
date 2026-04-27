import React from 'react';
import { useTranslation } from 'react-i18next';
import { DocumentManager } from './components/DocumentManager';
import { useBreakpoint } from '../../hooks/useBreakpoint';

const DocumentsPage: React.FC = () => {
  const { t } = useTranslation();
  const { isMobile } = useBreakpoint();

  return (
    <div style={{ padding: isMobile ? '12px 10px 24px' : '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <header style={{ marginBottom: isMobile ? 20 : 32 }}>
        <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}>
          {t('documents.title')}
        </h1>
        <p style={{ fontSize: isMobile ? 14 : 15, color: 'var(--text-muted)', fontWeight: 500 }}>
          {t('documents.subtitle')}
        </p>
      </header>

      <DocumentManager />
    </div>
  );
};

export default DocumentsPage;
