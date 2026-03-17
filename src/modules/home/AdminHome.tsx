import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

interface RoleBreakdownItem {
  role: string;
  count: number;
}

interface StoreBreakdownItem {
  name: string;
  count: number;
}

export interface AdminHomeData {
  stats: {
    companies: number;
    activeStores: number;
    activeEmployees: number;
  };
  roleBreakdown: RoleBreakdownItem[];
  storeBreakdown?: StoreBreakdownItem[];
}

interface AdminHomeProps {
  data: AdminHomeData;
}

const roleColors: Record<string, string> = {
  admin: '#C9973A',
  hr: '#0284C7',
  area_manager: '#15803D',
  store_manager: '#7C3AED',
  employee: '#374151',
  store_terminal: '#9CA3AF',
};

// ── Stat card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  description?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, accent, description }) => (
  <div className="card-lift" style={{
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    borderTop: `3px solid ${accent}`,
    padding: '22px 24px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex', flexDirection: 'column', gap: '14px',
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: `${accent}14`, border: `1px solid ${accent}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent, flexShrink: 0,
      }}>{icon}</div>
      <span style={{
        fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: '2px',
      }}>{label}</span>
    </div>
    <div>
      <div className="stat-num" style={{
        fontSize: '38px', fontWeight: 700, fontFamily: 'var(--font-display)',
        color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.03em',
      }}>{value}</div>
      {description && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{description}</div>
      )}
    </div>
  </div>
);

// ── Icons ──────────────────────────────────────────────────────────────────────
const IconBuilding = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18z"/>
    <path d="M6 12H4a2 2 0 00-2 2v6a2 2 0 002 2h2"/>
    <path d="M18 9h2a2 2 0 012 2v9a2 2 0 01-2 2h-2"/>
    <path d="M10 6h4M10 10h4M10 14h4"/>
  </svg>
);
const IconStore = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 7l1-4h18l1 4"/>
    <path d="M2 7h20v13a2 2 0 01-2 2H4a2 2 0 01-2-2V7z"/>
    <path d="M10 21V12h4v9"/>
  </svg>
);
const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
);
const IconArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

// ── Quick link ─────────────────────────────────────────────────────────────────
interface QuickLinkProps {
  to: string; label: string; description: string;
  icon: React.ReactNode; color: string; isMobile?: boolean;
}
const QuickLink: React.FC<QuickLinkProps> = ({ to, label, description, icon, color, isMobile }) => (
  <Link to={to} className="quick-link" style={{
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '14px 18px', background: 'var(--primary)',
    borderRadius: 'var(--radius)', textDecoration: 'none',
    border: `1px solid ${color}30`,
    flex: isMobile ? '1 1 calc(50% - 8px)' : '1 1 180px',
    minWidth: isMobile ? 'calc(50% - 8px)' : '180px',
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 8,
      background: `${color}18`, border: `1px solid ${color}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: color, flexShrink: 0,
    }}>{icon}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>{description}</div>
    </div>
    <span style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}><IconArrow /></span>
  </Link>
);

// ── Custom tooltip ─────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '8px 12px',
      boxShadow: 'var(--shadow)', fontSize: '12px', fontFamily: 'var(--font-body)',
    }}>
      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{payload[0].name}</span>
      <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{payload[0].value}</span>
    </div>
  );
};

// ── Panel wrapper ──────────────────────────────────────────────────────────────
const Panel: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ title, subtitle, children, style }) => (
  <div style={{
    background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden', ...style,
  }}>
    <div style={{
      padding: '18px 20px 14px', borderBottom: '1px solid var(--border-light)',
    }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', letterSpacing: '-0.01em' }}>
        {title}
      </h3>
      {subtitle && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{subtitle}</p>}
    </div>
    <div style={{ padding: '20px' }}>{children}</div>
  </div>
);

// ── Component ──────────────────────────────────────────────────────────────────
export const AdminHome: React.FC<AdminHomeProps> = ({ data }) => {
  const { stats, roleBreakdown, storeBreakdown } = data;
  const { t } = useTranslation();
  const { isMobile, isTablet } = useBreakpoint();
  const tRole = (role: string) => (t as (k: string) => string)(`roles.${role}`);

  const pieData = roleBreakdown.map((r) => ({
    name: tRole(r.role),
    value: r.count,
    color: roleColors[r.role] ?? '#9CA3AF',
  }));

  const barData = (storeBreakdown ?? []).map((s) => ({ name: s.name, value: s.count }));

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Welcome bar */}
      <div className="banner-inner" style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #1A3B5C 100%)',
        borderRadius: 'var(--radius-lg)', padding: '22px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        boxShadow: '0 4px 20px rgba(13,33,55,0.20)',
      }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            {t('home.admin.title')}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', margin: 0 }}>{t('home.admin.subtitle')}</p>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '6px 14px', background: 'rgba(201,151,58,0.15)',
          border: '1px solid rgba(201,151,58,0.25)', borderRadius: '999px',
          fontSize: '12px', fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }}/>
          {t('common.systemActive')}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
        <StatCard label={t('home.admin.companies')} value={stats.companies} icon={<IconBuilding />} accent="#C9973A" description={t('home.admin.companiesDesc')} />
        <StatCard label={t('home.admin.activeStores')} value={stats.activeStores} icon={<IconStore />} accent="#0284C7" description={t('home.admin.activeStoresDesc')} />
        <StatCard label={t('home.admin.activeEmployees')} value={stats.activeEmployees} icon={<IconUsers />} accent="#15803D" description={t('home.admin.activeEmployeesDesc')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', alignItems: 'start' }}>

        {/* Role distribution donut chart */}
        <Panel title={t('home.admin.roleDistribution')} subtitle={t('home.admin.roleDistributionDesc')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ width: 160, height: 160, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={48} outerRadius={72}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0 }}>
              {pieData.map((entry) => (
                <div key={entry.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.name}
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: entry.color, fontFamily: 'var(--font-display)', flexShrink: 0 }}>
                    {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Employees per store bar chart */}
        {barData.length > 0 ? (
          <Panel title={t('home.admin.employeesPerStore')} subtitle={t('home.admin.employeesPerStoreDesc')}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border-light)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-body)' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category" dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
                  axisLine={false} tickLine={false} width={90}
                  tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + '…' : v}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201,151,58,0.06)' }} />
                <Bar dataKey="value" name={t('home.admin.activeEmployees')} fill="#0D2137" radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        ) : (
          /* Quick links fallback if no store data */
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', padding: '18px 20px',
          }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', letterSpacing: '-0.01em' }}>
                {t('home.admin.quickAccess')}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{t('home.admin.quickAccessDesc')}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <QuickLink to="/dipendenti" label={t('home.admin.manageEmployees')} description={t('home.admin.manageEmployeesDesc')} icon={<IconUsers />} color="#C9973A" isMobile={isMobile} />
              <QuickLink to="/negozi" label={t('home.admin.manageStores')} description={t('home.admin.manageStoresDesc')} icon={<IconStore />} color="#0284C7" isMobile={isMobile} />
              <QuickLink to="/aziende" label={t('home.admin.manageCompanies')} description={t('home.admin.manageCompaniesDesc')} icon={<IconBuilding />} color="#15803D" isMobile={isMobile} />
            </div>
          </div>
        )}
      </div>

      {/* Quick links row (always shown when store chart is also visible) */}
      {barData.length > 0 && (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', padding: '18px 20px',
        }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', letterSpacing: '-0.01em' }}>
              {t('home.admin.quickAccess')}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{t('home.admin.quickAccessDesc')}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <QuickLink to="/dipendenti" label={t('home.admin.manageEmployees')} description={t('home.admin.manageEmployeesDesc')} icon={<IconUsers />} color="#C9973A" isMobile={isMobile} />
            <QuickLink to="/negozi" label={t('home.admin.manageStores')} description={t('home.admin.manageStoresDesc')} icon={<IconStore />} color="#0284C7" isMobile={isMobile} />
            <QuickLink to="/aziende" label={t('home.admin.manageCompanies')} description={t('home.admin.manageCompaniesDesc')} icon={<IconBuilding />} color="#15803D" isMobile={isMobile} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHome;
