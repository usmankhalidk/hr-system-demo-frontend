import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users, Clock, CalendarCheck, CalendarOff, Store, CheckCircle2,
} from 'lucide-react';
import {
  getCompaniesPermissions,
  updateCompanyPermissions,
  CompanyPermissions,
  SystemPermissionUpdate,
} from '../../api/systemPermissions';
import { Toggle } from '../../components/ui/Toggle';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { translateApiError } from '../../utils/apiErrors';
import { useToast } from '../../context/ToastContext';
import GroupRoleVisibilityPanel from './GroupRoleVisibilityPanel';

type SystemModuleKey = 'turni' | 'permessi' | 'presenze' | 'negozi' | 'dipendenti';

const SYSTEM_MODULES: { key: SystemModuleKey; icon: React.ReactNode }[] = [
  { key: 'turni',       icon: <Clock size={15} /> },
  { key: 'permessi',    icon: <CalendarOff size={15} /> },
  { key: 'presenze',    icon: <CalendarCheck size={15} /> },
  { key: 'negozi',      icon: <Store size={15} /> },
  { key: 'dipendenti',  icon: <Users size={15} /> },
];

const MANAGED_ROLES = ['hr', 'area_manager', 'store_manager', 'employee', 'store_terminal'] as const;

type ManagedRole = typeof MANAGED_ROLES[number];
type LocalGrid = Record<SystemModuleKey, Record<ManagedRole, boolean>>;
type SavingMap = Record<string, boolean>;

function buildLocalGrid(grid: CompanyPermissions['grid']): LocalGrid {
  const result = {} as LocalGrid;
  for (const { key: mod } of SYSTEM_MODULES) {
    result[mod] = {
      hr:             grid[mod]?.hr              ?? true,
      area_manager:   grid[mod]?.areaManager    ?? true,
      store_manager:  grid[mod]?.storeManager   ?? true,
      employee:       grid[mod]?.employee       ?? true,
      store_terminal: grid[mod]?.storeTerminal  ?? true,
    };
  }
  return result;
}

const ROLE_COLORS: Record<ManagedRole, string> = {
  hr:            '#0284C7',
  area_manager:  '#15803D',
  store_manager: '#7C3AED',
  employee:      '#374151',
  store_terminal:'#9CA3AF',
};

const SystemPermissionsPanel: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [loading, setLoading]         = useState(true);
  const [companies, setCompanies]     = useState<CompanyPermissions[]>([]);
  const [activeTab, setActiveTab]     = useState(0);
  const [grids, setGrids]             = useState<Record<number, LocalGrid>>({});
  const [saving, setSaving]           = useState<Record<number, SavingMap>>({});
  const [lastSaved, setLastSaved]     = useState<Record<number, string>>({});
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getCompaniesPermissions()
      .then(({ companies: data }) => {
        setCompanies(data);
        const built: Record<number, LocalGrid> = {};
        for (const c of data) built[c.id] = buildLocalGrid(c.grid);
        setGrids(built);
      })
      .catch((err) => setErrorMsg(translateApiError(err, t, t('permissions.errorLoad'))))
      .finally(() => setLoading(false));
  }, [t]);

  const activeCompany = companies[activeTab];

  const handleToggle = async (mod: SystemModuleKey, role: ManagedRole): Promise<void> => {
    if (!activeCompany) return;
    const cid = activeCompany.id;
    const cellKey = `${mod}:${role}`;
    const newValue = !grids[cid]?.[mod]?.[role];

    // Optimistic update
    setGrids((prev) => ({
      ...prev,
      [cid]: {
        ...prev[cid],
        [mod]: { ...prev[cid][mod], [role]: newValue },
      },
    }));
    setSaving((prev) => ({
      ...prev,
      [cid]: { ...(prev[cid] ?? {}), [cellKey]: true },
    }));
    setLastSaved((prev) => ({ ...prev, [cid]: '' }));

    const updates: SystemPermissionUpdate[] = [{ module: mod, role, enabled: newValue }];
    try {
      await updateCompanyPermissions(cid, updates);
      setLastSaved((prev) => ({ ...prev, [cid]: cellKey }));
      setTimeout(() => setLastSaved((prev) => ({ ...prev, [cid]: prev[cid] === cellKey ? '' : prev[cid] })), 1800);
    } catch (err) {
      // Revert
      setGrids((prev) => ({
        ...prev,
        [cid]: {
          ...prev[cid],
          [mod]: { ...prev[cid][mod], [role]: !newValue },
        },
      }));
      showToast(translateApiError(err, t, t('permissions.errorSave')) ?? t('permissions.errorSave'), 'error');
    } finally {
      setSaving((prev) => {
        const next = { ...prev[cid] };
        delete next[cellKey];
        return { ...prev, [cid]: next };
      });
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
        <Spinner size="lg" color="var(--primary)" />
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ fontFamily: 'var(--font-body)', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
          {t('nav.permissions')}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          {t('permissions.systemSubtitle')}
        </p>
      </div>

      {errorMsg && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant="danger" title={t('common.error')} onClose={() => setErrorMsg(null)}>{errorMsg}</Alert>
        </div>
      )}

      {/* Group role visibility */}
      <GroupRoleVisibilityPanel />

      {/* Company Tabs */}
      {companies.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 2,
          marginBottom: 20,
          borderBottom: '2px solid var(--border)',
          paddingBottom: 0,
          overflowX: 'auto',
        }}>
          {companies.map((company, idx) => {
            const isActive = idx === activeTab;
            return (
              <button
                key={company.id}
                onClick={() => setActiveTab(idx)}
                style={{
                  padding: '10px 20px',
                  background: isActive ? 'var(--surface)' : 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -2,
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  borderRadius: `var(--radius-sm) var(--radius-sm) 0 0`,
                  transition: 'color 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                <div style={{
                  width: 22,
                  height: 22,
                  borderRadius: 'var(--radius-xs)',
                  background: isActive ? 'var(--accent)' : 'var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  fontWeight: 800,
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  letterSpacing: '0.01em',
                }}>
                  {company.name.slice(0, 2).toUpperCase()}
                </div>
                {company.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Permission Grid */}
      {activeCompany && (
        <>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'auto',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={{
                    padding: '16px 20px',
                    textAlign: 'left',
                    width: 200,
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    borderBottom: '2px solid var(--border)',
                    background: 'var(--surface-warm)',
                    whiteSpace: 'nowrap',
                  }}>
                    {t('permissions.colModule')}
                  </th>
                  {MANAGED_ROLES.map((role) => (
                    <th key={role} style={{
                      padding: '16px 10px',
                      textAlign: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      borderBottom: '2px solid var(--border)',
                      background: 'var(--surface-warm)',
                      whiteSpace: 'nowrap',
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: `${ROLE_COLORS[role]}18`,
                          border: `2px solid ${ROLE_COLORS[role]}40`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          fontWeight: 800,
                          color: ROLE_COLORS[role],
                        }}>
                          {t(`roles.${role}`).slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ color: ROLE_COLORS[role], fontWeight: 700 }}>{t(`roles.${role}`)}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SYSTEM_MODULES.map(({ key: mod, icon }, rowIdx) => {
                  const isLast = rowIdx === SYSTEM_MODULES.length - 1;
                  const compSaving = saving[activeCompany.id] ?? {};
                  const compLastSaved = lastSaved[activeCompany.id] ?? '';
                  return (
                    <tr
                      key={mod}
                      style={{ transition: 'background 0.15s' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-warm)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                    >
                      <td style={{
                        padding: '14px 20px',
                        borderBottom: isLast ? 'none' : '1px solid var(--border-light)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--accent-light)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent)',
                            flexShrink: 0,
                          }}>
                            {icon}
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13.5 }}>
                            {t(`permissions.modules.${mod}`)}
                          </span>
                        </div>
                      </td>
                      {MANAGED_ROLES.map((role) => {
                        const cellKey = `${mod}:${role}`;
                        const isSaving = !!compSaving[cellKey];
                        const isSaved = compLastSaved === cellKey;
                        return (
                          <td key={role} style={{
                            padding: '14px 10px',
                            textAlign: 'center',
                            borderBottom: isLast ? 'none' : '1px solid var(--border-light)',
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                              {isSaving ? (
                                <Spinner size="sm" color="var(--accent)" />
                              ) : isSaved ? (
                                <CheckCircle2 size={18} color="var(--success)" className="pop-in" />
                              ) : (
                                <Toggle
                                  checked={grids[activeCompany.id]?.[mod]?.[role] ?? true}
                                  onChange={() => void handleToggle(mod, role)}
                                  disabled={isSaving}
                                />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Auto-save hint */}
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <span style={{ fontSize: 11, color: 'var(--text-disabled)', fontStyle: 'italic' }}>
              {t('permissions.autoSaveHint', { defaultValue: 'Le modifiche vengono salvate automaticamente' })}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default SystemPermissionsPanel;
