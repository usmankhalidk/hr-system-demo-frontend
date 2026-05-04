import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Users, 
  Clock, 
  CalendarOff, 
  Mail, 
  Clipboard, 
  Star, 
  AlertTriangle, 
  Calendar, 
  CheckCircle,
  Search,
  Zap
} from 'lucide-react';
import { Card, Toggle, Button, Input } from '../../components/ui';
import { automationsApi } from '../../api/automations';

interface AutomationItem {
  id: string;
  icon: React.ReactNode;
  labelKey: string;
  descKey: string;
  roles: string[];
  triggerKey: string;
  lastRunKey?: string; // key for time translation if dynamic, or hardcoded for now
  lastRunValue?: any;
  enabled: boolean;
}

interface AutomationCategory {
  id: 'employees' | 'shifts' | 'leave';
  labelKey: string;
  accent: string;
  items: AutomationItem[];
}

const ROLE_COLORS: Record<string, string> = { 
  store_manager: '#7C3AED', 
  area_manager: '#15803D', 
  hr: '#0284C7', 
  admin: '#C9973A', 
  employee: '#64748B' 
};

const INITIAL_DATA: AutomationCategory[] = [
  {
    id: 'employees',
    labelKey: 'automations.categories.employees',
    accent: '#0284C7',
    items: [
      { id: 'benvenuto_email', icon: <Mail size={18} />, labelKey: 'automations.items.benvenuto_email.label', descKey: 'automations.items.benvenuto_email.desc', roles: ['employee'], triggerKey: 'automations.items.benvenuto_email.trigger', lastRunKey: 'automations.time.hours_ago', lastRunValue: { count: 2 }, enabled: true },
      { id: 'onboarding_reminder', icon: <Clipboard size={18} />, labelKey: 'automations.items.onboarding_reminder.label', descKey: 'automations.items.onboarding_reminder.desc', roles: ['employee', 'store_manager'], triggerKey: 'automations.items.onboarding_reminder.trigger', lastRunKey: 'automations.time.today', lastRunValue: ' 09:00', enabled: true },
      { id: 'compleanno_banner', icon: <Star size={18} />, labelKey: 'automations.items.compleanno_banner.label', descKey: 'automations.items.compleanno_banner.desc', roles: ['employee'], triggerKey: 'automations.items.compleanno_banner.trigger', lastRunKey: 'automations.time.days_ago', lastRunValue: { count: 3 }, enabled: true },
      { id: 'compleanno_email', icon: <Mail size={18} />, labelKey: 'automations.items.compleanno_email.label', descKey: 'automations.items.compleanno_email.desc', roles: ['employee'], triggerKey: 'automations.items.compleanno_email.trigger', lastRunKey: 'automations.time.days_ago', lastRunValue: { count: 3 }, enabled: false },
    ],
  },
  {
    id: 'shifts',
    labelKey: 'automations.categories.shifts',
    accent: '#DC2626',
    items: [
      { id: 'anomalia_ritardo', icon: <Clock size={18} />, labelKey: 'automations.items.anomalia_ritardo.label', descKey: 'automations.items.anomalia_ritardo.desc', roles: ['store_manager', 'area_manager'], triggerKey: 'automations.items.anomalia_ritardo.trigger', lastRunKey: 'automations.time.today', lastRunValue: ' 09:28', enabled: true },
      { id: 'anomalia_noshow', icon: <AlertTriangle size={18} />, labelKey: 'automations.items.anomalia_noshow.label', descKey: 'automations.items.anomalia_noshow.desc', roles: ['store_manager', 'area_manager', 'hr'], triggerKey: 'automations.items.anomalia_noshow.trigger', lastRunKey: 'automations.time.today', lastRunValue: ' 09:30', enabled: true },
      { id: 'turno_scoperto', icon: <Calendar size={18} />, labelKey: 'automations.items.turno_scoperto.label', descKey: 'automations.items.turno_scoperto.desc', roles: ['hr', 'area_manager'], triggerKey: 'automations.items.turno_scoperto.trigger', lastRunKey: 'automations.time.yesterday', lastRunValue: ' 18:00', enabled: true },
      { id: 'approvazione_turni', icon: <CheckCircle size={18} />, labelKey: 'automations.items.approvazione_turni.label', descKey: 'automations.items.approvazione_turni.desc', roles: ['hr'], triggerKey: 'automations.items.approvazione_turni.trigger', lastRunKey: 'automations.time.yesterday', lastRunValue: ' 10:00', enabled: false },
    ],
  },
  {
    id: 'leave',
    labelKey: 'automations.categories.leave',
    accent: '#7C3AED',
    items: [
      { id: 'ferie_approvazione', icon: <CalendarOff size={18} />, labelKey: 'automations.items.ferie_approvazione.label', descKey: 'automations.items.ferie_approvazione.desc', roles: ['store_manager', 'area_manager', 'hr'], triggerKey: 'automations.items.ferie_approvazione.trigger', lastRunKey: 'automations.time.today', lastRunValue: ' 11:00', enabled: true },
      { id: 'ferie_esito', icon: <CalendarOff size={18} />, labelKey: 'automations.items.ferie_esito.label', descKey: 'automations.items.ferie_esito.desc', roles: ['employee'], triggerKey: 'automations.items.ferie_esito.trigger', lastRunKey: 'automations.time.today', lastRunValue: ' 11:15', enabled: true },
    ],
  },
];

export default function AutomationsPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState(INITIAL_DATA);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchAutomations = async () => {
      try {
        const data = await automationsApi.getAutomations();
        setCategories(prev => prev.map(cat => ({
          ...cat,
          items: cat.items.map(item => ({
            ...item,
            enabled: data[item.id] ?? item.enabled
          }))
        })));
      } catch (err) {
        console.error('Failed to fetch automations', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAutomations();
  }, []);

  const toggleAutomation = async (catId: string, itemId: string, currentEnabled: boolean) => {
    setCategories(prev => prev.map(cat => 
      cat.id !== catId ? cat : {
        ...cat,
        items: cat.items.map(item => 
          item.id !== itemId ? item : { ...item, enabled: !currentEnabled }
        )
      }
    ));
    try {
      await automationsApi.updateAutomation(itemId, !currentEnabled);
    } catch (err) {
      console.error('Failed to update automation', err);
      setCategories(prev => prev.map(cat => 
        cat.id !== catId ? cat : {
          ...cat,
          items: cat.items.map(item => 
            item.id !== itemId ? item : { ...item, enabled: currentEnabled }
          )
        }
      ));
    }
  };

  const totalEnabled = categories.flatMap(c => c.items).filter(i => i.enabled).length;
  const totalItems = categories.flatMap(c => c.items).length;

  const renderLastRun = (item: AutomationItem) => {
    if (!item.lastRunKey) return null;
    let text = t(item.lastRunKey, item.lastRunValue) as string;
    if (typeof item.lastRunValue === 'string') text += item.lastRunValue;
    return text;
  };

  return (
    <div className="page-enter" style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-display)' }}>
            {t('automations.page_title')}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            {totalEnabled}/{totalItems} {t('common.active', 'active')} · {t('automations.control_panel')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-disabled)' }} />
            <Input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('automations.search_placeholder')}
              style={{ paddingLeft: 32, height: 36, width: 220, fontSize: 13 }}
            />
          </div>
          <Button variant="primary" style={{ height: 36, padding: '0 16px' }}>
            {t('common.save')}
          </Button>
        </div>
      </div>


      {/* Content Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {categories.map(cat => {
          const filteredItems = cat.items.filter(item => 
            t(item.labelKey).toLowerCase().includes(search.toLowerCase()) || 
            t(item.descKey).toLowerCase().includes(search.toLowerCase())
          );

          if (search && filteredItems.length === 0) return null;

          return (
            <div key={cat.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '0 4px' }}>
                <div style={{ width: 4, height: 18, background: cat.accent, borderRadius: 2 }} />
                <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-display)' }}>
                  {t(cat.labelKey)}
                </h2>
                <span style={{ fontSize: 12, color: 'var(--text-disabled)', fontWeight: 500 }}>
                  ({filteredItems.length})
                </span>
              </div>

              <Card padding="none" style={{ overflow: 'hidden' }}>
                {filteredItems.map((item, idx) => (
                  <div key={item.id} style={{
                    padding: '20px',
                    borderBottom: idx < filteredItems.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex', gap: 16, alignItems: 'flex-start',
                    background: item.enabled ? 'transparent' : 'var(--background-alt)',
                    opacity: item.enabled ? 1 : 0.7,
                    transition: 'all 0.2s ease',
                  }}>
                    {/* Icon Container */}
                    <div style={{
                      width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                      background: item.enabled ? `${cat.accent}12` : 'var(--border)',
                      border: `1px solid ${item.enabled ? cat.accent : 'var(--border)'}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: item.enabled ? cat.accent : 'var(--text-disabled)',
                    }}>
                      {item.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t(item.labelKey)}</span>
                          {!item.enabled && (
                            <span style={{ 
                              fontSize: 10, fontWeight: 700, color: '#DC2626', 
                              background: '#FEF2F2', padding: '1px 6px', borderRadius: 4,
                              border: '1px solid rgba(220,38,38,0.2)'
                            }}>
                              OFF
                            </span>
                          )}
                        </div>
                        <Toggle checked={item.enabled} onChange={() => toggleAutomation(cat.id, item.id, item.enabled)} />
                      </div>
                      
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 12px' }}>
                        {t(item.descKey)}
                      </p>

                      {/* Meta row */}
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-disabled)' }}>
                          <Zap size={11} />
                          {t('automations.trigger_label')}: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t(item.triggerKey)}</span>
                        </div>
                        {item.lastRunKey && (
                          <div style={{ fontSize: 11, color: 'var(--text-disabled)' }}>
                            {t('automations.last_run')}: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{renderLastRun(item)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 4 }}>
                          {item.roles.map(role => (
                            <span key={role} style={{
                              fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 6,
                              color: ROLE_COLORS[role] || '#6B7280',
                              background: `${ROLE_COLORS[role] || '#6B7280'}12`,
                              border: `1px solid ${ROLE_COLORS[role] || '#6B7280'}20`,
                            }}>
                              {t(`roles.${role}`, { defaultValue: role.replace('_', ' ') })}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          );
        })}
        {search && categories.every(cat => cat.items.filter(item => 
          t(item.labelKey).toLowerCase().includes(search.toLowerCase()) || 
          t(item.descKey).toLowerCase().includes(search.toLowerCase())
        ).length === 0) && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            {t('common.noResults')}
          </div>
        )}
      </div>
    </div>
  );
}
