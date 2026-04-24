import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Globe, Plus } from 'lucide-react';
import { Toggle } from '../../components/ui/Toggle';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { translateApiError } from '../../utils/apiErrors';
import { useToast } from '../../context/ToastContext';
import { getCompanyGroups, createCompanyGroup, getGroupRoleVisibility, updateGroupRoleVisibility } from '../../api/companyGroups';
import { getCompanies } from '../../api/companies';
import { useAuth } from '../../context/AuthContext';
import type { Company } from '../../types';

import type { CompanyGroup, GroupRoleVisibility, GroupVisibilityCompany } from '../../api/companyGroups';

const defaultVisibility: GroupRoleVisibility = { hr: false, areaManager: false };

export default function GroupRoleVisibilityPanel() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<CompanyGroup[]>([]);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);

  const [serverVisibility, setServerVisibility] = useState<GroupRoleVisibility>(defaultVisibility);
  const [localVisibility, setLocalVisibility] = useState<GroupRoleVisibility>(defaultVisibility);
  const [groupCompanies, setGroupCompanies] = useState<GroupVisibilityCompany[]>([]);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);

  const dirty = useMemo(() => (
    localVisibility.hr !== serverVisibility.hr || localVisibility.areaManager !== serverVisibility.areaManager
  ), [localVisibility, serverVisibility]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [g, companies] = await Promise.all([getCompanyGroups(), getCompanies()]);
        setGroups(g);
        setAllCompanies(companies);
        setGroupId((prev) => prev ?? (g[0]?.id ?? -1));
      } catch {
        setErrorMsg(t('permissions.groupVisibility.errorLoadGroups'));
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!groupId) return;
    void (async () => {
      setErrorMsg(null);
      try {
        const v = await getGroupRoleVisibility(groupId);
        const nextVisibility: GroupRoleVisibility = {
          hr: v.hr,
          areaManager: v.areaManager,
        };
        setServerVisibility(nextVisibility);
        setLocalVisibility(nextVisibility);
        setGroupCompanies(v.companies ?? []);
      } catch (err) {
        setErrorMsg(translateApiError(err, t, t('permissions.groupVisibility.errorLoadVisibility')));
      }
    })();
  }, [groupId, t]);

  const isIsolatedSelection = groupId === -1;
  const selectedCompanies = isIsolatedSelection
    ? allCompanies
      .filter((company) => company.groupId == null)
      .map((company) => ({
        id: company.id,
        name: company.name,
        isActive: company.isActive,
        hasActiveHr: false,
        hasActiveAreaManager: false,
      }))
    : groupCompanies;

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreating(true);
    setErrorMsg(null);
    try {
      const created = await createCompanyGroup({ name: newGroupName.trim() });
      showToast(t('permissions.groupVisibility.groupCreatedSuccess'), 'success');
      setNewGroupName('');
      setShowNewGroup(false);
      const g = await getCompanyGroups();
      setGroups(g);
      setGroupId(created.id);
    } catch (err) {
      setErrorMsg(translateApiError(err, t, t('permissions.groupVisibility.errorCreateGroup')));
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    if (!groupId) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await updateGroupRoleVisibility(groupId, {
        hr: localVisibility.hr,
        areaManager: localVisibility.areaManager,
      });
      setServerVisibility(JSON.parse(JSON.stringify(localVisibility)));
      // Notify other open tabs to refresh their permissions immediately
      localStorage.setItem('hr_permissions_updated', Date.now().toString());
      showToast(t('permissions.groupVisibility.visibilitySavedSuccess'), 'success');
    } catch (err) {
      setErrorMsg(translateApiError(err, t, t('permissions.errorSave')));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 20 }}>
        <Spinner size="lg" color="var(--primary)" />
      </div>
    );
  }

  const ROLE_ITEMS: { key: 'hr' | 'areaManager'; label: string; hint: string; color: string }[] = [
    { key: 'hr', label: t('permissions.groupVisibility.hrRoleShort'), hint: t('permissions.groupVisibility.crossCompanyHint'), color: '#0284C7' },
    { key: 'areaManager', label: t('permissions.groupVisibility.areaManagerRoleShort'), hint: t('permissions.groupVisibility.crossCompanyHint'), color: '#15803D' },
  ];

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      marginBottom: 20,
      overflow: 'hidden',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        background: 'var(--surface-warm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
            flexShrink: 0,
          }}>
            <Layers size={16} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              {t('permissions.groupVisibility.title')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
              {t('permissions.groupVisibility.subtitle')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ minWidth: 200 }}>
            <Select
              value={groupId ?? -1}
              onChange={(e) => setGroupId(e.target.value ? parseInt(e.target.value, 10) : null)}
              disabled={saving}
            >
              <option value={-1}>{t('permissions.groupVisibility.isolatedCompaniesOption', 'Isolated companies')}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </div>
          <button
            onClick={() => setShowNewGroup((v) => !v)}
            title={t('permissions.groupVisibility.createGroupButton')}
            style={{
              height: 36,
              padding: '0 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: showNewGroup ? 'var(--accent-light)' : 'var(--surface)',
              color: showNewGroup ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              transition: 'background 0.15s',
            }}
          >
            <Plus size={13} />
            {t('permissions.groupVisibility.createGroupButton')}
          </button>
        </div>
      </div>

      {/* New group row */}
      {showNewGroup && (
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-light)',
          background: 'rgba(201,151,58,0.04)',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 10,
        }}>
          <div style={{ flex: 1 }}>
            <Input
              label={t('permissions.groupVisibility.newGroupOptionalLabel')}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              disabled={creating}
              placeholder={t('permissions.groupVisibility.newGroupPlaceholder')}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateGroup(); }}
            />
          </div>
          <Button loading={creating} onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
            {t('permissions.groupVisibility.createGroupButton')}
          </Button>
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '12px 20px' }}>
          <Alert variant="danger" title={t('common.error')} onClose={() => setErrorMsg(null)}>{errorMsg}</Alert>
        </div>
      )}

      {/* Visibility toggles */}
      {groupId == null ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          {t('common.noData')}
        </div>
      ) : (
        <div style={{ padding: '16px 20px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {ROLE_ITEMS.map(({ key, label, hint, color }) => (
            <div
              key={key}
              style={{
                flex: 1,
                minWidth: 220,
                border: `1px solid ${localVisibility[key] ? `${color}30` : 'var(--border-light)'}`,
                borderRadius: 'var(--radius)',
                padding: '14px 16px',
                background: localVisibility[key] ? `${color}08` : 'var(--surface-warm)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                transition: 'background 0.2s, border-color 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: `${color}18`,
                  border: `2px solid ${color}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color,
                  flexShrink: 0,
                }}>
                  <Globe size={14} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-display)' }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 3 }}>
                    {(() => {
                      const coverageCompanies = selectedCompanies;
                      const activeForRoleSafe = coverageCompanies.filter((c) => key === 'hr' ? c.hasActiveHr : c.hasActiveAreaManager).length;
                      return t('permissions.groupVisibility.coverageSummary', {
                        active: activeForRoleSafe,
                        total: coverageCompanies.length,
                        role: label,
                        defaultValue: `${activeForRoleSafe}/${coverageCompanies.length} companies have active ${label}`,
                      });
                    })()}
                  </div>
                </div>
              </div>
              <Toggle
                checked={localVisibility[key]}
                onChange={() => setLocalVisibility((prev) => ({ ...prev, [key]: !prev[key] }))}
                disabled={saving || isIsolatedSelection}
              />

              <div style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1px solid var(--border-light)',
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                width: '100%',
              }}>
                {(() => {
                  const displayCompanies = localVisibility[key]
                    ? selectedCompanies
                    : selectedCompanies.filter((c) => c.id === user?.companyId);

                  if (displayCompanies.length === 0) {
                    return (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {isIsolatedSelection
                          ? t('permissions.groupVisibility.noIsolatedCompanies', { defaultValue: 'No isolated companies found.' })
                          : t('permissions.groupVisibility.noCompaniesInGroup', { defaultValue: 'No companies linked to this group yet.' })}
                      </span>
                    );
                  }

                  return displayCompanies.map((company) => {
                    const roleActive = key === 'hr' ? company.hasActiveHr : company.hasActiveAreaManager;
                    return (
                      <span
                        key={`${key}-${company.id}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 8px',
                          borderRadius: 999,
                          border: `1px solid ${roleActive ? '#15803D55' : 'var(--border)'}`,
                          background: roleActive ? 'rgba(21,128,61,0.10)' : 'var(--surface)',
                          color: roleActive ? '#166534' : 'var(--text-secondary)',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        <span>{company.name}</span>
                        {roleActive && (
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#166534',
                            border: '1px solid #16A34A66',
                            borderRadius: 999,
                            padding: '0 5px',
                            lineHeight: 1.5,
                            background: 'rgba(34,197,94,0.14)',
                          }}>
                            {t('permissions.groupVisibility.activeTag', { defaultValue: 'Active' })}
                          </span>
                        )}
                      </span>
                    );
                  });
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save bar */}
      {dirty && !isIsolatedSelection && (
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-light)',
          background: 'var(--surface-warm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 10,
        }}>
          <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 500 }}>
            ● {t('common.unsavedChanges')}
          </span>
          <Button variant="secondary" onClick={() => setLocalVisibility(serverVisibility)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {t('permissions.groupVisibility.saveVisibilityButton')}
          </Button>
        </div>
      )}
    </div>
  );
}
