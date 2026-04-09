import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { UserRole } from '../../types';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { getAvatarUrl } from '../../api/client';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  Notification,
} from '../../api/notifications';

interface HeaderProps {
  onToggleSidebar: () => void;
  title: string;
}

const ROLE_COLORS: Record<UserRole, { bg: string; color: string }> = {
  admin:          { bg: 'rgba(201,151,58,0.10)',  color: '#C9973A' },
  hr:             { bg: 'rgba(2,132,199,0.10)',   color: '#0284C7' },
  area_manager:   { bg: 'rgba(21,128,61,0.10)',   color: '#15803D' },
  store_manager:  { bg: 'rgba(124,58,237,0.10)',  color: '#7C3AED' },
  employee:       { bg: 'rgba(107,114,128,0.10)', color: '#6B7280' },
  store_terminal: { bg: 'rgba(107,114,128,0.10)', color: '#6B7280' },
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#DC2626',
  high:   '#EA580C',
  medium: '#C9973A',
  low:    '#6B7280',
};

const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="3" y1="7" x2="21" y2="7"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="17" x2="14" y2="17"/>
  </svg>
);

const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function timeAgo(iso: string, t: (k: string, opts?: any) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('notifications.justNow');
  if (mins < 60) return t('notifications.minsAgo', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('notifications.hoursAgo', { count: hrs });
  const days = Math.floor(hrs / 24);
  return t('notifications.daysAgo', { count: days });
}

/** Convert a dot-notation event type (e.g. 'leave.approved') to its i18n key. */
function typeLabel(type: string, t: (k: string) => string): string {
  const key = 'notifications.type_' + type.replace(/\./g, '_');
  const label = t(key);
  // If i18next couldn't find the key it returns the key itself — fall back gracefully
  return label === key ? type : label;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar, title }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { isMobile } = useBreakpoint();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropOpen, setDropOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Fetch on open and poll every 60s
  useEffect(() => {
    if (!user || user.role === 'store_terminal') return;
    const load = () => {
      getNotifications({ limit: 20 })
        .then((page) => {
          setNotifications(page.notifications);
          setUnreadCount(page.unreadCount);
        })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [user?.id]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropOpen]);

  const handleMarkRead = async (id: number) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* ignore */ }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* ignore */ } finally {
      setMarkingAll(false);
    }
  };

  const roleStyle = user ? ROLE_COLORS[user.role] : { bg: 'transparent', color: 'var(--text-muted)' };
  const fullName = user ? (user.surname ? `${user.name} ${user.surname}` : user.name) : '';
  const initials = user
    ? `${user.name.charAt(0)}${user.surname ? user.surname.charAt(0) : ''}`.toUpperCase()
    : '';
  const roleLabel = user ? t(`roles.${user.role}`) : '';

  return (
    <header style={{
      minHeight: 'var(--header-height)',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: isMobile
        ? 'max(4px, env(safe-area-inset-top, 0px)) 16px 0 16px'
        : '0 24px',
      gap: '12px',
      flexShrink: 0,
      boxShadow: '0 1px 0 var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>

      {/* Menu toggle */}
      <button
        onClick={onToggleSidebar}
        aria-label="Apri/chiudi menu"
        style={{
          background: 'none', border: 'none', padding: '6px',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', cursor: 'pointer',
          flexShrink: 0, transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--background)';
          (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'none';
          (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
        }}
      >
        <MenuIcon />
      </button>

      {/* Title */}
      <div role="heading" aria-level={2} style={{
        flex: 1,
        fontSize: '16px',
        fontWeight: 600,
        fontFamily: 'var(--font-display)',
        color: 'var(--text-primary)',
        margin: 0,
        letterSpacing: '-0.01em',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>{title}</div>

      {/* Language switcher */}
      <span className="hide-mobile">
        <LanguageSwitcher variant="pill" />
      </span>
      <span className="show-mobile-only-header">
        <LanguageSwitcher variant="pill" />
      </span>

      {/* Notification bell */}
      {user && user.role !== 'store_terminal' && (
        <div ref={dropRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setDropOpen((v) => !v)}
            aria-label={t('notifications.bell')}
            style={{
              background: dropOpen ? 'var(--background)' : 'none',
              border: 'none', padding: '7px 8px',
              borderRadius: 'var(--radius-sm)', color: dropOpen ? 'var(--text-primary)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', position: 'relative',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!dropOpen) {
                (e.currentTarget as HTMLElement).style.background = 'var(--background)';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!dropOpen) {
                (e.currentTarget as HTMLElement).style.background = 'none';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              }
            }}
          >
            <BellIcon />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 3, right: 3,
                background: '#DC2626', color: '#fff',
                borderRadius: 99, minWidth: 16, height: 16,
                fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px', fontFamily: 'var(--font-display)',
                boxShadow: '0 0 0 2px var(--surface)',
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {dropOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              width: 340, maxWidth: 'calc(100vw - 24px)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              zIndex: 50,
              animation: 'popIn 0.18s cubic-bezier(0.16,1,0.3,1)',
            }}>
              {/* Header */}
              <div style={{
                padding: '14px 16px 10px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                  {t('notifications.title')}
                  {unreadCount > 0 && (
                    <span style={{
                      marginLeft: 8, background: '#DC262614', color: '#DC2626',
                      borderRadius: 99, fontSize: 11, fontWeight: 700,
                      padding: '1px 7px', fontFamily: 'var(--font-display)',
                    }}>{unreadCount}</span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAll}
                    disabled={markingAll}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 12, color: 'var(--primary)', fontWeight: 500,
                      padding: '2px 4px', borderRadius: 4,
                    }}>
                    {markingAll ? '...' : t('notifications.markAllRead')}
                  </button>
                )}
              </div>

              {/* List */}
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>🔔</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('notifications.empty')}</div>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.isRead && handleMarkRead(n.id)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border)',
                        cursor: n.isRead ? 'default' : 'pointer',
                        background: n.isRead ? 'transparent' : 'rgba(201,151,58,0.04)',
                        transition: 'background 0.15s',
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                      }}
                      onMouseEnter={(e) => {
                        if (!n.isRead) (e.currentTarget as HTMLElement).style.background = 'rgba(201,151,58,0.08)';
                      }}
                      onMouseLeave={(e) => {
                        if (!n.isRead) (e.currentTarget as HTMLElement).style.background = 'rgba(201,151,58,0.04)';
                      }}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                        background: n.isRead ? 'transparent' : (PRIORITY_COLOR[n.priority] ?? '#C9973A'),
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: n.isRead ? 400 : 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 4 }}>
                          {n.message}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {timeAgo(n.createdAt, t)}
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 600,
                            color: PRIORITY_COLOR[n.priority] ?? '#C9973A',
                            background: `${PRIORITY_COLOR[n.priority] ?? '#C9973A'}15`,
                            borderRadius: 4,
                            padding: '1px 5px',
                            fontFamily: 'var(--font-display)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                          }}>
                            {t(`notifications.priority_${n.priority}`)}
                          </span>
                          <span style={{
                            fontSize: 10,
                            color: 'var(--text-muted)',
                            background: 'var(--background)',
                            borderRadius: 4,
                            padding: '1px 5px',
                            fontFamily: 'var(--font-display)',
                          }}>
                            {typeLabel(n.type, t)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* User pill */}
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span className="hide-mobile" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{fullName}</span>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px 4px 6px',
            background: roleStyle.bg,
            borderRadius: 999,
            border: `1px solid ${roleStyle.color}30`,
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: user?.avatarFilename ? 'transparent' : roleStyle.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '10px', fontWeight: 700,
              fontFamily: 'var(--font-display)',
              overflow: 'hidden',
            }}>
              {user?.avatarFilename ? (
                <img
                  src={getAvatarUrl(user.avatarFilename) ?? ''}
                  alt={fullName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : initials}
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: roleStyle.color, whiteSpace: 'nowrap' }}>
              {roleLabel}
            </span>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
