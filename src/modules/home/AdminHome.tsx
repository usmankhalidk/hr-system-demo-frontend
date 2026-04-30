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
  dashboardStats: {
    attendanceRate: number;
    totalAbsences: number;
    delays: number;
    shiftCoverage: number;
  };
  staticStats: {
    documentExpiryCount: number;
    onboardingInProgress: number;
    onboardingCompletionRate: number;
    atsTotalCandidates: number;
    atsInterviewCandidates: number;
  };
  roleBreakdown: RoleBreakdownItem[];
  storeBreakdown?: StoreBreakdownItem[];
}

interface AdminHomeProps {
  data: AdminHomeData;
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
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
  value: number | string;
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
const IconActivity = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
  </svg>
);
const IconUserMinus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="8.5" cy="7" r="4"></circle>
    <line x1="23" y1="11" x2="17" y2="11"></line>
  </svg>
);
const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);
const IconCalendar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);
const IconDocument = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
);
const IconClipboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
  </svg>
);
const IconBriefcase = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
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
    flex: isMobile ? '1 1 100%' : '1 1 180px',
    minWidth: isMobile ? '100%' : '180px',
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
export const AdminHome: React.FC<AdminHomeProps> = ({ data, timeRange, onTimeRangeChange }) => {
  const { stats, dashboardStats, roleBreakdown, storeBreakdown } = data;
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select
            value={timeRange}
            onChange={(e) => onTimeRangeChange(e.target.value)}
            style={{
              padding: '6px 28px 6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.2)',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              appearance: 'none',
              outline: 'none',
              backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23FFFFFF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
              backgroundSize: '14px',
            }}
          >
            <option value="this_week" style={{ color: '#000' }}>This Week</option>
            <option value="this_month" style={{ color: '#000' }}>This Month</option>
            <option value="three_months" style={{ color: '#000' }}>Three Months</option>
          </select>

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
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : isTablet ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '16px' }}>
        <StatCard 
          label="Attendance Rate" 
          value={dashboardStats?.attendanceRate ? `${dashboardStats.attendanceRate}%` : '0%'} 
          icon={<IconActivity />} 
          accent="#15803D" 
          description={timeRange === 'this_week' ? 'This week' : timeRange === 'three_months' ? 'Last 3 months' : 'This month'} 
        />
        <StatCard 
          label="Total Absences" 
          value={dashboardStats?.totalAbsences || 0} 
          icon={<IconUserMinus />} 
          accent="#EF4444" 
          description={timeRange === 'this_week' ? 'This week' : timeRange === 'three_months' ? 'Last 3 months' : 'This month'} 
        />
        <StatCard 
          label="Delays" 
          value={dashboardStats?.delays || 0} 
          icon={<IconClock />} 
          accent="#D97706" 
          description={timeRange === 'this_week' ? 'This week' : timeRange === 'three_months' ? 'Last 3 months' : 'This month'} 
        />
        <StatCard 
          label="Shift Coverage" 
          value={dashboardStats?.shiftCoverage ? `${dashboardStats.shiftCoverage}%` : '0%'} 
          icon={<IconCalendar />} 
          accent="#0284C7" 
          description="Confirmed Shifts" 
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', alignItems: 'start' }}>

        {/* Role distribution donut chart */}
        <Panel 
          title={t('home.admin.roleDistribution')} 
          subtitle={t('home.admin.roleDistributionDesc')}
          style={{ gridColumn: barData.length > 0 ? 'span 1' : 'span 2' }}
        >
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
        {barData.length > 0 && (
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
        )}
      </div>

      {/* Static KPI Cards Row (Moved up) */}
      {data.staticStats && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
          <StatCard 
            label="Document Expiry" 
            value={data.staticStats.documentExpiryCount} 
            icon={<IconDocument />} 
            accent="#D97706" 
            description="Documents expiring in 60 days" 
          />
          <StatCard 
            label="Onboarding in progress" 
            value={data.staticStats.onboardingInProgress} 
            icon={<IconClipboard />} 
            accent="#0284C7" 
            description={`${data.staticStats.onboardingCompletionRate}% average completion`} 
          />
          <StatCard 
            label="ATS Candidates" 
            value={data.staticStats.atsTotalCandidates} 
            icon={<IconBriefcase />} 
            accent="#15803D" 
            description={`${data.staticStats.atsInterviewCandidates} in interview stage`} 
          />
        </div>
      )}

      {/* Quick Access section (Moved to bottom) */}
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
    </div>
  );
};

export default AdminHome;
