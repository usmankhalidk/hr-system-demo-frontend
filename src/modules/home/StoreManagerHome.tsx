import React from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface StoreInfo {
  id: number;
  name: string;
  code: string;
  maxStaff: number | null;
}

export interface StoreManagerHomeData {
  store: StoreInfo;
  employeeCount: number;
}

interface StoreManagerHomeProps {
  data: StoreManagerHomeData;
}

// ── Circular capacity ring ─────────────────────────────────────────────────────
function CapacityRing({ current, max }: { current: number; max: number | null }) {
  const pct = max && max > 0 ? Math.min(current / max, 1) : 0;
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const dash = pct * circumference;

  const color = pct >= 1 ? '#DC2626' : pct >= 0.8 ? '#B45309' : '#15803D';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <div style={{ position: 'relative', width: 140, height: 140 }}>
        <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
          {/* Progress */}
          <circle
            cx="70" cy="70" r={r} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.34,1.56,0.64,1), stroke 0.3s' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: '26px', fontWeight: 700, fontFamily: 'var(--font-display)',
            color: color, lineHeight: 1, letterSpacing: '-0.03em',
          }}>{current}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>/ {max ?? '—'}</span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '3px 10px', borderRadius: '999px',
          background: `${color}12`, border: `1px solid ${color}25`,
          fontSize: '12px', fontWeight: 600, color,
        }}>
          {Math.round(pct * 100)}% capacity
        </div>
      </div>
    </div>
  );
}

// ── Metric row ─────────────────────────────────────────────────────────────────
const MetricRow: React.FC<{ label: string; value: string | number; accent?: string }> = ({ label, value, accent }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '11px 0', borderBottom: '1px solid var(--border-light)',
  }}>
    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
    <span style={{ fontSize: '14px', fontWeight: 700, color: accent ?? 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{value}</span>
  </div>
);

export const StoreManagerHome: React.FC<StoreManagerHomeProps> = ({ data }) => {
  const { store, employeeCount } = data;
  const { t } = useTranslation();
  const { isMobile } = useBreakpoint();

  const available = store.maxStaff ? Math.max(0, store.maxStaff - employeeCount) : null;

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header banner */}
      <div className="banner-inner" style={{
        background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
        borderRadius: 'var(--radius-lg)', padding: '22px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        boxShadow: '0 4px 20px rgba(124,58,237,0.20)',
      }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            {t('home.storeManager.title')}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.60)', fontSize: '13px', margin: 0 }}>
            {store.name} · {store.code}
          </p>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '6px 14px', background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.20)', borderRadius: '999px',
          fontSize: '12px', fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FFFFFF', display: 'inline-block' }}/>
          {t('common.systemActive')}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', alignItems: 'start' }}>

        {/* Capacity ring card */}
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', letterSpacing: '-0.01em' }}>
              {t('home.storeManager.capacityTitle')}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{t('home.storeManager.capacityDesc')}</p>
          </div>
          <div style={{ padding: '28px 20px', display: 'flex', justifyContent: isMobile ? 'center' : 'flex-start' }}>
            <CapacityRing current={employeeCount} max={store.maxStaff} />
          </div>
        </div>

        {/* Store metrics */}
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-light)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', letterSpacing: '-0.01em' }}>
              {t('home.storeManager.storeInfo')}
            </h3>
          </div>
          <div style={{ padding: '4px 20px 12px' }}>
            <MetricRow label={t('home.storeManager.storeName')} value={store.name} />
            <MetricRow label={t('home.storeManager.storeCode')} value={store.code} />
            <MetricRow label={t('home.storeManager.maxCapacity')} value={store.maxStaff ?? '—'} />
            <MetricRow label={t('home.storeManager.activeEmployees')} value={employeeCount} accent="#15803D" />
            <MetricRow label={t('home.storeManager.availableSlots')} value={available ?? '—'} accent={available === null ? undefined : available > 0 ? '#0284C7' : '#DC2626'} />
          </div>
        </div>
      </div>

      {/* Phase 2 placeholders */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
        {[t('home.storeManager.todayShifts'), t('home.storeManager.todayAttendance')].map((title) => (
          <div key={title} style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-light)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                {title}
              </h3>
            </div>
            <div style={{
              padding: '32px 16px', textAlign: 'center',
              color: 'var(--text-disabled)', fontSize: '13px',
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px', borderRadius: '999px',
                background: 'var(--surface-warm)', border: '1px solid var(--border)',
                fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500,
              }}>
                {t('common.phase2')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StoreManagerHome;
