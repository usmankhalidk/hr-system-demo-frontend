import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users, Clock, CalendarCheck, CalendarOff, Store,
  FileText, Briefcase, BarChart2, Settings, Lock,
  CheckCircle2,
} from 'lucide-react';
import { getPermissions, updatePermissions } from '../../api/permissions';
import { translateApiError } from '../../utils/apiErrors';
import { PermissionGrid } from '../../types';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Toggle } from '../../components/ui/Toggle';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const MODULE_KEYS: { key: string; implemented: boolean; icon: React.ReactNode }[] = [
  { key: 'dipendenti',   implemented: true,  icon: <Users size={15} /> },
  { key: 'turni',        implemented: true,  icon: <Clock size={15} /> },
  { key: 'presenze',     implemented: true,  icon: <CalendarCheck size={15} /> },
  { key: 'permessi',     implemented: true,  icon: <CalendarOff size={15} /> },
  { key: 'negozi',       implemented: true,  icon: <Store size={15} /> },
  { key: 'impostazioni', implemented: true,  icon: <Settings size={15} /> },
  { key: 'documenti',    implemented: false, icon: <FileText size={15} /> },
  { key: 'ats',          implemented: false, icon: <Briefcase size={15} /> },
  { key: 'report',       implemented: false, icon: <BarChart2 size={15} /> },
];

const ROLE_KEYS = ['admin', 'hr', 'area_manager', 'store_manager', 'employee', 'store_terminal'];

const ROLE_COLORS: Record<string, string> = {
  admin: '#C9973A',
  hr: '#0284C7',
  area_manager: '#15803D',
  store_manager: '#7C3AED',
  employee: '#374151',
  store_terminal: '#9CA3AF',
};

type LocalGrid = Record<string, Record<string, boolean>>;
// key: `${moduleKey}:${roleKey}` → true while saving
type SavingMap = Record<string, boolean>;

const snakeToCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_, l) => l.toUpperCase());

function buildLocalGrid(data: PermissionGrid): LocalGrid {
  const result: LocalGrid = {};
  for (const mod of MODULE_KEYS) {
    result[mod.key] = {};
    for (const roleKey of ROLE_KEYS) {
      const camelKey = snakeToCamel(roleKey);
      result[mod.key][roleKey] = mod.implemented ? (data.grid?.[mod.key]?.[camelKey] ?? true) : false;
    }
  }
  return result;
}

const PermissionsPanel: React.FC = () => {
  const { t } = useTranslation();
  const { refreshPermissions } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [grid, setGrid] = useState<LocalGrid>({});
  const [saving, setSaving] = useState<SavingMap>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const tRole = (roleKey: string) => (t as (k: string) => string)(`roles.${roleKey}`);
  const tModule = (moduleKey: string) => (t as (k: string) => string)(`permissions.modules.${moduleKey}`);

  useEffect(() => {
    setLoading(true);
    getPermissions()
      .then((data) => setGrid(buildLocalGrid(data)))
      .catch((err) => setErrorMsg(translateApiError(err, t, t('permissions.errorLoad'))))
      .finally(() => setLoading(false));
  }, [t]);

  const handleToggle = async (moduleKey: string, roleKey: string) => {
    const cellKey = `${moduleKey}:${roleKey}`;
    const newValue = !(grid[moduleKey]?.[roleKey] ?? false);

    // Optimistic update
    setGrid((prev) => ({
      ...prev,
      [moduleKey]: { ...prev[moduleKey], [roleKey]: newValue },
    }));
    setSaving((prev) => ({ ...prev, [cellKey]: true }));
    setLastSaved(null);

    try {
      await updatePermissions([{ module: moduleKey, role: roleKey, enabled: newValue }]);
      setLastSaved(cellKey);
      setTimeout(() => setLastSaved(null), 1800);
      // Refresh current user's permissions so sidebar updates immediately
      await refreshPermissions();
    } catch (err) {
      // Revert on error
      setGrid((prev) => ({
        ...prev,
        [moduleKey]: { ...prev[moduleKey], [roleKey]: !newValue },
      }));
      showToast(translateApiError(err, t, t('permissions.errorSave')) ?? t('permissions.errorSave'), 'error');
    } finally {
      setSaving((prev) => {
        const next = { ...prev };
        delete next[cellKey];
        return next;
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
          {t('permissions.title')}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          {t('permissions.subtitle')}
        </p>
      </div>

      {errorMsg && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant="danger" title={t('common.error')} onClose={() => setErrorMsg(null)}>
            {errorMsg}
          </Alert>
        </div>
      )}

      {/* Table */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'auto',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
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
              {ROLE_KEYS.map((roleKey) => (
                <th key={roleKey} style={{
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
                      background: `${ROLE_COLORS[roleKey]}18`,
                      border: `2px solid ${ROLE_COLORS[roleKey]}40`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      fontWeight: 800,
                      color: ROLE_COLORS[roleKey],
                    }}>
                      {tRole(roleKey).slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ color: ROLE_COLORS[roleKey], fontWeight: 700 }}>{tRole(roleKey)}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Implemented modules */}
            {MODULE_KEYS.filter((m) => m.implemented).map((mod, rowIdx, arr) => {
              const isLast = rowIdx === arr.length - 1;
              return (
                <tr key={mod.key} style={{ transition: 'background 0.15s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-warm)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                >
                  <td style={{
                    padding: '14px 20px',
                    borderBottom: isLast ? '2px solid var(--border)' : '1px solid var(--border-light)',
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
                        {mod.icon}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13.5 }}>
                        {tModule(mod.key)}
                      </span>
                    </div>
                  </td>
                  {ROLE_KEYS.map((roleKey) => {
                    const cellKey = `${mod.key}:${roleKey}`;
                    const isSaving = !!saving[cellKey];
                    const isSaved = lastSaved === cellKey;
                    const enabled = grid[mod.key]?.[roleKey] ?? false;
                    return (
                      <td key={roleKey} style={{
                        padding: '14px 10px',
                        textAlign: 'center',
                        borderBottom: isLast ? '2px solid var(--border)' : '1px solid var(--border-light)',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          {isSaving ? (
                            <Spinner size="sm" color="var(--accent)" />
                          ) : isSaved ? (
                            <CheckCircle2 size={18} color="var(--success)" style={{ animation: 'popIn 0.22s cubic-bezier(0.34,1.56,0.64,1)' }} />
                          ) : (
                            <Toggle checked={enabled} onChange={() => void handleToggle(mod.key, roleKey)} disabled={isSaving} />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Upcoming modules section header */}
            <tr>
              <td colSpan={ROLE_KEYS.length + 1} style={{
                padding: '10px 20px 8px',
                background: 'var(--surface-warm)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--text-disabled)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    whiteSpace: 'nowrap',
                  }}>
                    {t('common.comingSoon')}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
                </div>
              </td>
            </tr>

            {/* Coming soon modules */}
            {MODULE_KEYS.filter((m) => !m.implemented).map((mod, rowIdx, arr) => {
              const isLast = rowIdx === arr.length - 1;
              return (
                <tr key={mod.key} style={{ background: 'var(--surface-warm)', opacity: 0.75 }}>
                  <td style={{
                    padding: '12px 20px',
                    borderBottom: isLast ? 'none' : '1px solid var(--border-light)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-disabled)',
                        flexShrink: 0,
                      }}>
                        {mod.icon}
                      </div>
                      <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: 13.5 }}>
                        {tModule(mod.key)}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 2 }}>
                        <Lock size={10} color="var(--text-disabled)" />
                        <span style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: 'var(--text-disabled)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          background: 'var(--border)',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}>
                          {t('common.comingSoon')}
                        </span>
                      </div>
                    </div>
                  </td>
                  {ROLE_KEYS.map((roleKey) => (
                    <td key={roleKey} style={{
                      padding: '12px 10px',
                      textAlign: 'center',
                      borderBottom: isLast ? 'none' : '1px solid var(--border-light)',
                    }}>
                      <Toggle checked={false} onChange={() => {}} disabled />
                    </td>
                  ))}
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
    </div>
  );
};

export default PermissionsPanel;
