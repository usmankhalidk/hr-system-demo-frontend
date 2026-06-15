import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search, X, Building, Users, UserCheck, Briefcase, Loader2, CornerDownLeft } from 'lucide-react';
import { searchGlobal, GlobalSearchResults } from '../../api/search';
import { useAuth } from '../../context/AuthContext';

interface FlatResultItem {
  type: 'company' | 'employee' | 'candidate' | 'job';
  id: number;
  label: string;
  sub: string;
  data: any;
}

export const GlobalSearch: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'companies' | 'employees' | 'candidates' | 'jobs'>('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResults>({
    companies: [],
    employees: [],
    candidates: [],
    jobs: []
  });
  const [activeIndex, setActiveIndex] = useState(0);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut to open (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Autofocus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setQueryText('');
      setResults({ companies: [], employees: [], candidates: [], jobs: [] });
    }
  }, [isOpen]);

  // Debounced search query
  useEffect(() => {
    if (queryText.trim().length < 2) {
      setResults({ companies: [], employees: [], candidates: [], jobs: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const searchResults = await searchGlobal(queryText, activeTab);
        setResults(searchResults);
        setActiveIndex(0);
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [queryText, activeTab]);

  // Flatten results for easy keyboard navigation
  const flatResults: FlatResultItem[] = [];

  if (results.companies && results.companies.length > 0) {
    results.companies.forEach((c) => {
      flatResults.push({
        type: 'company',
        id: c.id,
        label: c.name,
        sub: c.slug,
        data: c,
      });
    });
  }
  if (results.employees && results.employees.length > 0) {
    results.employees.forEach((e) => {
      flatResults.push({
        type: 'employee',
        id: e.id,
        label: `${e.name} ${e.surname}`,
        sub: `${e.uniqueId || ''} • ${e.email} (${t(`roles.${e.role}`, e.role)})`,
        data: e,
      });
    });
  }
  if (results.candidates && results.candidates.length > 0) {
    results.candidates.forEach((cand) => {
      flatResults.push({
        type: 'candidate',
        id: cand.id,
        label: cand.fullName,
        sub: `${cand.email || ''} • ${cand.jobTitle || ''} (${cand.status})`,
        data: cand,
      });
    });
  }
  if (results.jobs && results.jobs.length > 0) {
    results.jobs.forEach((j) => {
      flatResults.push({
        type: 'job',
        id: j.id,
        label: j.title,
        sub: `${j.companyName} • ${j.status}`,
        data: j,
      });
    });
  }

  // Handle keydown inside input/modal for list navigation
  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (flatResults.length > 0 ? (prev + 1) % flatResults.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (flatResults.length > 0 ? (prev - 1 + flatResults.length) % flatResults.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatResults[activeIndex]) {
        handleNavigate(flatResults[activeIndex]);
      }
    }
  };

  const handleNavigate = (item: FlatResultItem) => {
    setIsOpen(false);
    switch (item.type) {
      case 'company':
        navigate(`/aziende/${item.id}`);
        break;
      case 'employee':
        navigate(`/dipendenti/${item.id}`);
        break;
      case 'candidate':
        navigate(`/ats?view=candidates&candidateId=${item.id}`);
        break;
      case 'job':
        navigate(`/ats?view=jobs&jobId=${item.id}`);
        break;
      default:
        break;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'company': return t('search.companies', 'Companies');
      case 'employee': return t('search.employees', 'Employees');
      case 'candidate': return t('search.candidates', 'Candidates');
      case 'job': return t('search.jobs', 'Job Openings');
      default: return '';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'company': return <Building size={16} />;
      case 'employee': return <Users size={16} />;
      case 'candidate': return <UserCheck size={16} />;
      case 'job': return <Briefcase size={16} />;
      default: return null;
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'hr' && !user.isSuperAdmin)) {
    return null; // Restricted to super admins, company admins, and HR
  }

  const getBadgeStyles = (type: string) => {
    switch (type) {
      case 'company': return { bg: 'rgba(13, 33, 55, 0.08)', color: 'var(--primary)' };
      case 'employee': return { bg: 'rgba(2, 132, 199, 0.1)', color: '#0284C7' };
      case 'candidate': return { bg: 'rgba(124, 58, 237, 0.1)', color: '#7C3AED' };
      case 'job': return { bg: 'rgba(21, 128, 61, 0.1)', color: '#15803D' };
      default: return { bg: 'var(--background)', color: 'var(--text-secondary)' };
    }
  };

  const getTypeIconSmall = (type: string) => {
    switch (type) {
      case 'company': return <Building size={10} />;
      case 'employee': return <Users size={10} />;
      case 'candidate': return <UserCheck size={10} />;
      case 'job': return <Briefcase size={10} />;
      default: return null;
    }
  };

  return (
    <>
      {/* Search CSS Styles - always active */}
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes borderGradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .gemini-border-active {
          position: relative;
        }
        .gemini-border-active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, #9b5DE5, #F15BB5, #00F5D4, #00BBF9, #9b5DE5);
          background-size: 400% 400%;
          animation: borderGradientMove 3s ease infinite;
        }
        @keyframes slideDownMobile {
          from { transform: translateY(-30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (max-width: 767px) {
          .global-search-trigger {
            max-width: 36px !important;
            height: 36px !important;
            padding: 0 !important;
            justify-content: center !important;
            margin: 0 4px !important;
            border-radius: 50% !important;
            flex-shrink: 0 !important;
            background: none !important;
            border: none !important;
            box-shadow: none !important;
          }
          .global-search-trigger svg {
            width: 18px !important;
            height: 18px !important;
          }
          .global-search-trigger-text {
            display: none !important;
          }
          .global-search-trigger-kbd {
            display: none !important;
          }
          .global-search-backdrop {
            position: fixed !important;
            top: var(--header-height) !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(13, 33, 55, 0.3) !important;
            backdrop-filter: blur(8px) !important;
            display: flex !important;
            align-items: flex-start !important;
            justify-content: center !important;
            padding-top: 0 !important;
            z-index: 9999 !important;
          }
          .global-search-modal-container {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            border-radius: 0 0 16px 16px !important;
            border-top: none !important;
            max-height: calc(100vh - var(--header-height)) !important;
            box-shadow: 0 8px 30px rgba(0,0,0,0.15) !important;
            animation: slideDownMobile 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
          .global-search-results-list {
            max-height: 280px !important;
            overflow-y: auto !important;
          }
        }
      `}</style>

      {/* ── Search Input Trigger Box in Header ── */}
      <div
        className="global-search-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'var(--background)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '6px 16px',
          color: 'var(--text-muted)',
          fontSize: '13px',
          width: '100%',
          maxWidth: '360px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          margin: '0 16px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-focus)';
          e.currentTarget.style.background = 'var(--surface)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.background = 'var(--background)';
        }}
      >
        <Search size={15} style={{ color: 'var(--text-muted)' }} />
        <span className="global-search-trigger-text" style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {t('search.trigger_placeholder', 'Search everything...')}
        </span>
        <kbd
          className="global-search-trigger-kbd"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '1px 6px',
            fontSize: '10px',
            fontWeight: 600,
            fontFamily: 'monospace',
            color: 'var(--text-muted)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          ⌘K
        </kbd>
      </div>

      {/* ── Search Backdrop Modal Overlay ── */}
      {isOpen && (
        <div
          className="global-search-backdrop"
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(13, 33, 55, 0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '10vh',
            zIndex: 9999,
          }}
        >
          {/* Modal Container */}
          <div
            ref={modalRef}
            className="global-search-modal-container"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleModalKeyDown}
            style={{
              background: 'var(--surface)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '640px',
              maxHeight: '75vh',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--border)',
              position: 'relative',
              animation: 'slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* CSS styles are handled globally at root */}

            {/* Input Header Area */}
            <div
              className="gemini-border-active"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface-warm)',
                flexShrink: 0,
              }}
            >
              <Search size={20} style={{ color: 'var(--text-muted)', marginRight: '14px' }} />
              <input
                ref={inputRef}
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder={t('search.placeholder_detailed', 'Find employees, candidates, and job positions...')}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '16px',
                  fontFamily: 'inherit',
                  color: 'var(--text-primary)',
                }}
              />
              {loading ? (
                <Loader2 size={18} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
              ) : queryText ? (
                <button
                  onClick={() => setQueryText('')}
                  style={{
                    border: 'none',
                    background: 'none',
                    padding: '4px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                  }}
                >
                  <X size={18} />
                </button>
              ) : null}
            </div>

            {/* Category Filter Chips */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                padding: '10px 20px',
                background: 'var(--surface-warm)',
                borderBottom: '1px solid var(--border)',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                flexShrink: 0,
              }}
            >
              {[
                { id: 'all', label: t('search.filter_all', 'All'), icon: <Search size={13} /> },
                ...(user?.isSuperAdmin ? [{ id: 'companies', label: t('search.filter_companies', 'Companies'), icon: <Building size={13} /> }] : []),
                { id: 'employees', label: t('search.filter_employees', 'Employees'), icon: <Users size={13} /> },
                { id: 'candidates', label: t('search.filter_candidates', 'Candidates'), icon: <UserCheck size={13} /> },
                { id: 'jobs', label: t('search.filter_jobs', 'Jobs'), icon: <Briefcase size={13} /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: activeTab === tab.id ? 'var(--primary)' : 'var(--surface)',
                    color: activeTab === tab.id ? 'var(--surface)' : 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '20px',
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.borderColor = 'var(--text-muted)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }
                  }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Results List */}
            <div className="global-search-results-list" style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
              {queryText.trim().length < 2 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Search size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                  <p style={{ fontSize: '13px' }}>
                    {t('search.prompt_type', 'Type at least 2 characters to search the platform.')}
                  </p>
                </div>
              ) : flatResults.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '13px' }}>{t('search.no_results', 'No matches found.')}</p>
                </div>
              ) : (
                flatResults.map((item, index) => {
                  const isHighlighted = index === activeIndex;
                  const showHeader = index === 0 || flatResults[index].type !== flatResults[index - 1].type;

                  return (
                    <div key={`${item.type}-${item.id}`}>
                      {/* Section Header */}
                      {showHeader && (
                        <div
                          style={{
                            padding: '8px 20px 4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            background: 'var(--surface-warm)',
                            borderTop: index > 0 ? '1px solid var(--border-light)' : 'none',
                            borderBottom: '1px solid var(--border-light)',
                          }}
                        >
                          {getTypeName(item.type)}
                        </div>
                      )}

                      {/* Result Row */}
                      <div
                        onClick={() => handleNavigate(item)}
                        onMouseEnter={() => setActiveIndex(index)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          padding: '10px 20px',
                          cursor: 'pointer',
                          background: isHighlighted ? 'var(--accent-light)' : 'transparent',
                          transition: 'background 0.1s ease',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'var(--background)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {getTypeIcon(item.type)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '2px',
                              flexWrap: 'wrap'
                            }}
                          >
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {item.label}
                            </span>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '9px',
                              fontWeight: 700,
                              background: getBadgeStyles(item.type).bg,
                              color: getBadgeStyles(item.type).color,
                              borderRadius: '4px',
                              padding: '1px 6px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em',
                            }}>
                              {getTypeIconSmall(item.type)}
                              <span>{getTypeName(item.type)}</span>
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--text-secondary)',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.sub}
                          </div>
                        </div>
                        {isHighlighted && (
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              color: 'var(--accent)',
                              fontWeight: 500,
                            }}
                          >
                            {t('search.navigate', 'Select')}
                            <CornerDownLeft size={12} />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Details */}
            <div
              style={{
                padding: '10px 20px',
                borderTop: '1px solid var(--border)',
                background: 'var(--surface-warm)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
                color: 'var(--text-muted)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', gap: '16px' }}>
                <span>
                  <kbd style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1px 4px', borderRadius: '3px' }}>↑↓</kbd>{' '}
                  {t('search.nav_tips', 'Navigate')}
                </span>
                <span>
                  <kbd style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1px 4px', borderRadius: '3px' }}>Enter</kbd>{' '}
                  {t('search.open_tips', 'Open')}
                </span>
                <span>
                  <kbd style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1px 4px', borderRadius: '3px' }}>Esc</kbd>{' '}
                  {t('search.close_tips', 'Close')}
                </span>
              </div>
              <div>{t('search.powered_by', 'Global Search')}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
