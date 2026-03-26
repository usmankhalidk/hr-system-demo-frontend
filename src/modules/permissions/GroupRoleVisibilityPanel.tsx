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

import type { CompanyGroup, GroupRoleVisibility } from '../../api/companyGroups';

const defaultVisibility: GroupRoleVisibility = { hr: false, areaManager: false };

export default function GroupRoleVisibilityPanel() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<CompanyGroup[]>([]);
  const [groupId, setGroupId] = useState<number | null>(null);

  const [serverVisibility, setServerVisibility] = useState<GroupRoleVisibility>(defaultVisibility);
  const [localVisibility, setLocalVisibility] = useState<GroupRoleVisibility>(defaultVisibility);

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
        const g = await getCompanyGroups();
        setGroups(g);
        setGroupId((prev) => prev ?? (g[0]?.id ?? null));
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
        setServerVisibility(v);
        setLocalVisibility(v);
      } catch (err) {
        setErrorMsg(translateApiError(err, t, t('permissions.groupVisibility.errorLoadVisibility')));
      }
    })();
  }, [groupId, t]);

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
    { key: 'hr',          label: t('permissions.groupVisibility.hrRoleShort'),          hint: t('permissions.groupVisibility.crossCompanyHint'), color: '#0284C7' },
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
          {groups.length > 0 && (
            <div style={{ minWidth: 200 }}>
              <Select
                value={groupId ?? ''}
                onChange={(e) => setGroupId(e.target.value ? parseInt(e.target.value, 10) : null)}
                disabled={saving || groups.length === 0}
              >
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            </div>
          )}
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
      {groups.length === 0 ? (
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
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
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
                </div>
              </div>
              <Toggle
                checked={localVisibility[key]}
                onChange={() => setLocalVisibility((prev) => ({ ...prev, [key]: !prev[key] }))}
                disabled={saving}
              />
            </div>
          ))}
        </div>
      )}

      {/* Save bar */}
      {dirty && (
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
