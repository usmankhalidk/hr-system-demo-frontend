import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { registerDevice } from '../../api/device';
import { getDeviceFingerprint } from '../../utils/deviceFingerprint';
import { translateApiError } from '../../utils/apiErrors';
import { Alert } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';
import { LanguageSwitcher } from '../../components/ui/LanguageSwitcher';

/** Returns a safe in-app path from `?next=` or null (blocks open redirects). */
function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;
    return decoded;
  } catch {
    return null;
  }
}

export default function DeviceRegistrationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresRegistration = user?.role === 'employee' && user?.requiresDeviceRegistration === true;

  useEffect(() => {
    // If the employee is already registered, avoid showing the registration screen.
    if (!user) return;
    if (user.role !== 'employee') {
      navigate('/', { replace: true });
      return;
    }
    if (!requiresRegistration) {
      const dest = safeNextPath(searchParams.get('next')) ?? '/';
      navigate(dest, { replace: true });
    }
  }, [user, requiresRegistration, navigate, searchParams]);

  const handleRegister = async () => {
    if (!user || user.role !== 'employee') return;
    setSubmitting(true);
    setError(null);
    try {
      const fp = await getDeviceFingerprint();
      await registerDevice({ fingerprint: fp.fingerprint, metadata: fp.metadata });
      await refreshUser();
      
      showToast(t('deviceRegistration.success'), 'success');
      
      const dest = safeNextPath(searchParams.get('next')) ?? '/';
      // Short delay to let the user see the success toast before redirecting
      setTimeout(() => {
        navigate(dest, { replace: true });
      }, 1500);
    } catch (err: unknown) {
      setError(translateApiError(err, t) ?? t('deviceRegistration.errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'linear-gradient(160deg, #0D2137 0%, #1A3B5C 100%)',
        color: '#fff',
      }}
    >
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <LanguageSwitcher variant="pill" />
      </div>
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 20,
          padding: 24,
          boxShadow: '0 16px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 44, lineHeight: 1 }}>🔐</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800 }}>
              {t('deviceRegistration.title')}
            </div>
            <div style={{ opacity: 0.75, fontSize: 14, marginTop: 4 }}>{t('deviceRegistration.subtitle')}</div>
          </div>
        </div>

        <div style={{ marginTop: 16, background: 'rgba(0,0,0,0.15)', borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.92 }}>
            {t('deviceRegistration.body')}
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 16 }}>
            <Alert variant="danger" title={t('common.error')}>
              {error}
            </Alert>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={submitting}
            onClick={handleRegister}
            style={{
              flex: '1 1 220px',
              padding: '13px 18px',
              borderRadius: 12,
              border: 'none',
              background: submitting ? '#4A6080' : '#C9973A',
              color: '#0A1929',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            {submitting ? <Spinner size="sm" color="#0A1929" /> : t('deviceRegistration.button')}
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => navigate('/')}
            style={{
              flex: '0 0 auto',
              padding: '13px 18px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontWeight: 700,
              fontFamily: 'var(--font-body)',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {t('deviceRegistration.backToDashboard')}
          </button>
        </div>

        <div style={{ marginTop: 16, fontSize: 12.5, opacity: 0.7, lineHeight: 1.5 }}>
          {t('deviceRegistration.note')}
        </div>
      </div>
    </div>
  );
}

