import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Search, CheckSquare, FileText, Calendar, Building, Users, Briefcase, X, ArrowRight } from 'lucide-react';
import { searchGlobal } from '../../api/search';
import { Spinner } from '../../components/ui/Spinner';
import { useAuth } from '../../context/AuthContext';

export interface PlatformReference {
  type: 'task' | 'document' | 'shift' | 'store' | 'employee' | 'job';
  id: number;
  title: string;
  subtitle?: string;
  url: string;
}

interface Props {
  onSelect: (ref: PlatformReference) => void;
  onClose: () => void;
}

export const PlatformReferencePicker: React.FC<Props> = ({ onSelect, onClose }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'task' | 'document' | 'store' | 'employee' | 'job'>('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PlatformReference[]>([]);

  const isRoleAuthorized = (role?: string) => ['admin', 'hr', 'area_manager', 'store_manager'].includes(role || '');

  useEffect(() => {
    let isMounted = true;
    const fetchResults = async () => {
      setLoading(true);
      try {
        const data = await searchGlobal(query.trim() || 'a');
        if (!isMounted) return;

        const items: PlatformReference[] = [];

        // Employees (Admin, HR, Managers)
        if (data.employees && data.employees.length > 0) {
          data.employees.forEach((emp) => {
            const fullName = `${emp.name} ${emp.surname}`;
            items.push({
              type: 'employee',
              id: emp.id,
              title: fullName,
              subtitle: `${emp.role ? emp.role.toUpperCase() + ' · ' : ''}${emp.companyName || ''}`,
              url: `/dipendenti?search=${encodeURIComponent(fullName)}`,
            });
          });
        }

        // Tasks (onboarding tasks/templates)
        if (data.onboarding && data.onboarding.length > 0) {
          data.onboarding.forEach((tItem) => {
            const title = tItem.taskName || tItem.name || 'Task';
            const subtitle = tItem.employeeName ? `${tItem.employeeName} ${tItem.employeeSurname ?? ''}` : tItem.companyName;
            items.push({
              type: 'task',
              id: tItem.id,
              title,
              subtitle: subtitle ? `Assigned: ${subtitle}` : undefined,
              url: `/onboarding?search=${encodeURIComponent(title)}`,
            });
          });
        }

        // Documents
        if (data.documents && data.documents.length > 0) {
          data.documents.forEach((doc) => {
            items.push({
              type: 'document',
              id: doc.id,
              title: doc.fileName,
              subtitle: doc.employeeName ? `${doc.employeeName} ${doc.employeeSurname}` : doc.companyName,
              url: `/documenti?search=${encodeURIComponent(doc.fileName)}`,
            });
          });
        }

        // Stores / Locations
        if (data.stores && data.stores.length > 0) {
          data.stores.forEach((store) => {
            items.push({
              type: 'store',
              id: store.id,
              title: store.name,
              subtitle: store.companyName ? `${store.code ? store.code + ' · ' : ''}${store.companyName}` : store.code,
              url: `/negozi/${store.id}`,
            });
          });
        }

        // Jobs / ATS
        if (data.jobs && data.jobs.length > 0) {
          data.jobs.forEach((job) => {
            items.push({
              type: 'job',
              id: job.id,
              title: job.title,
              subtitle: job.companyName,
              url: `/ats`,
            });
          });
        }

        setResults(items);
      } catch {
        if (isMounted) setResults([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const timer = setTimeout(fetchResults, 200);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [query]);

  const filtered = activeTab === 'all' ? results : results.filter((r) => r.type === activeTab);

  const getIcon = (type: PlatformReference['type']) => {
    switch (type) {
      case 'task':
        return <CheckSquare size={16} color="#2563eb" />;
      case 'document':
        return <FileText size={16} color="#7c3aed" />;
      case 'shift':
        return <Calendar size={16} color="#16a34a" />;
      case 'store':
        return <Building size={16} color="#d97706" />;
      case 'employee':
        return <Users size={16} color="#0284c7" />;
      case 'job':
        return <Briefcase size={16} color="#e11d48" />;
      default:
        return <CheckSquare size={16} color="var(--accent)" />;
    }
  };

  const getTypeBadge = (type: PlatformReference['type']) => {
    switch (type) {
      case 'task':
        return { label: 'TASK', bg: 'rgba(37,99,235,0.1)', color: '#2563eb', border: 'rgba(37,99,235,0.25)' };
      case 'document':
        return { label: 'DOCUMENT', bg: 'rgba(124,58,237,0.1)', color: '#7c3aed', border: 'rgba(124,58,237,0.25)' };
      case 'shift':
        return { label: 'SHIFT', bg: 'rgba(22,163,74,0.1)', color: '#16a34a', border: 'rgba(22,163,74,0.25)' };
      case 'store':
        return { label: 'STORE', bg: 'rgba(217,119,6,0.1)', color: '#d97706', border: 'rgba(217,119,6,0.25)' };
      case 'employee':
        return { label: 'EMPLOYEE', bg: 'rgba(2,132,199,0.1)', color: '#0284c7', border: 'rgba(2,132,199,0.25)' };
      case 'job':
        return { label: 'JOB', bg: 'rgba(225,29,72,0.1)', color: '#e11d48', border: 'rgba(225,29,72,0.25)' };
      default:
        return { label: 'REF', bg: 'rgba(201,151,58,0.1)', color: 'var(--accent)', border: 'rgba(201,151,58,0.25)' };
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(13,33,55,0.55)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(520px, 92vw)',
          maxHeight: '80vh',
          background: 'var(--surface)',
          borderRadius: 16,
          border: '1px solid var(--border)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface-warm)',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              {t('messages.attachReference', 'Attach Platform Reference')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {t('messages.attachRefSubtitle', 'Search and link tasks, documents, or stores')}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Search Input */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('messages.searchRefPlaceholder', 'Search tasks, documents, stores...')}
              autoFocus
              style={{
                width: '100%',
                height: 38,
                padding: '0 14px 0 36px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--background)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Tab Filters */}
        <div style={{ display: 'flex', gap: 6, padding: '8px 20px', borderBottom: '1px solid var(--border-light)', background: 'var(--surface)', overflowX: 'auto' }}>
          {(['all', 'task', 'document', 'store', 'employee', 'job'] as const)
            .filter((tab) => {
              if (tab === 'employee' || tab === 'job') return isRoleAuthorized(user?.role);
              return true;
            })
            .map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === tab ? 'var(--accent)' : 'transparent',
                  color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab === 'all' ? t('common.all', 'All') : tab}
              </button>
            ))}
        </div>

        {/* Results List */}
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: 340, padding: '4px 0' }}>
          {loading ? (
            <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
              <Spinner size="md" color="var(--accent)" />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {t('common.noResults', 'No items found')}
            </div>
          ) : (
            filtered.map((item) => {
              const badge = getTypeBadge(item.type);
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => { onSelect(item); onClose(); }}
                  style={{
                    padding: '10px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-light)',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-warm)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: badge.bg,
                      border: `1px solid ${badge.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {getIcon(item.type)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                    }}>
                      {badge.label}
                    </span>
                    <ArrowRight size={14} color="var(--text-muted)" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
