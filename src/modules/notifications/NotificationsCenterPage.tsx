import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCircle2, AlertCircle, Info, Clock, Search, AlertTriangle } from 'lucide-react';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  Notification,
  NotificationsPage as NotificationsPageData,
} from '../../api/notifications';
import { useToast } from '../../context/ToastContext';

interface FilterState {
  unreadOnly: boolean;
  priority: 'all' | 'urgent' | 'high' | 'medium' | 'low';
  searchTerm: string;
}

// Priority color system - from Shifts & Leaves modules for consistency
const PRIORITY_COLORS = {
  urgent: {
    // Red - from leaves rejected status
    text: '#DC2626',
    bg: 'rgba(220, 38, 38, 0.12)',
    border: 'rgba(220, 38, 38, 0.28)',
    dot: '#EF4444',
  },
  high: {
    // Orange - from affluence high level
    text: '#B45309',
    bg: 'rgba(180, 83, 9, 0.12)',
    border: 'rgba(180, 83, 9, 0.28)',
    dot: '#F59E0B',
  },
  medium: {
    // Amber - from affluence medium level
    text: '#D97706',
    bg: 'rgba(217, 119, 6, 0.12)',
    border: 'rgba(217, 119, 6, 0.28)',
    dot: '#FBBF24',
  },
  low: {
    // Green - from affluence low level / approved status
    text: '#16A34A',
    bg: 'rgba(22, 163, 74, 0.12)',
    border: 'rgba(22, 163, 74, 0.28)',
    dot: '#22C55E',
  },
};

// Read vs Unread styling - inspired by Shifts scheduled/confirmed states
const READ_UNREAD_STYLES = {
  unread: {
    // Scheduled state colors - soft blue gradient
    bg: 'linear-gradient(135deg, rgba(30, 74, 122, 0.08) 0%, rgba(13, 33, 55, 0.06) 100%)',
    border: '#3a7bd5',
    borderOpacity: '0.20',
    shadowBase: '0 1px 4px rgba(58, 123, 213, 0.08)',
    shadowHover: '0 4px 16px rgba(58, 123, 213, 0.15)',
  },
  read: {
    // Confirmed state colors - white/neutral
    bg: 'var(--surface)',
    border: 'var(--border)',
    borderOpacity: '1',
    shadowBase: '0 1px 4px rgba(0,0,0,0.04)',
    shadowHover: '0 4px 12px rgba(0,0,0,0.08)',
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function timeAgo(iso: string, t: (k: string, opts?: any) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('notifications.justNow');
  if (mins < 60) return t('notifications.minsAgo', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('notifications.hoursAgo', { count: hrs });
  const days = Math.floor(hrs / 24);
  if (days < 30) return t('notifications.daysAgo', { count: days });
  const months = Math.floor(days / 30);
  return t('notifications.monthsAgo', { count: months });
}

function typeLabel(type: string, t: (k: string) => string): string {
  const key = 'notifications.type_' + type.replace(/\./g, '_');
  const label = t(key);
  return label === key ? type : label;
}

function getTypeIcon(type: string) {
  if (type.includes('shift')) return <Clock size={16} strokeWidth={2.5} />;
  if (type.includes('attendance')) return <AlertTriangle size={16} strokeWidth={2.5} />;
  if (type.includes('leave')) return <CheckCircle2 size={16} strokeWidth={2.5} />;
  if (type.includes('document')) return <Info size={16} strokeWidth={2.5} />;
  if (type.includes('alert') || type.includes('manager')) return <AlertCircle size={16} strokeWidth={2.5} />;
  return <Bell size={16} strokeWidth={2.5} />;
}

export default function NotificationsCenterPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [data, setData] = useState<NotificationsPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    unreadOnly: false,
    priority: 'all',
    searchTerm: '',
  });
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [marking, setMarking] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const page = await getNotifications({
        unreadOnly: filters.unreadOnly,
        limit,
        offset,
      });
      setData(page);
    } catch (err) {
      showToast(t('common.error_generic'), 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters.unreadOnly, limit, offset, t, showToast]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (id: number) => {
    try {
      setMarking(id);
      await markNotificationRead(id);
      setData((prev) =>
        prev
          ? {
              ...prev,
              notifications: prev.notifications.map((n) =>
                n.id === id ? { ...n, isRead: true } : n
              ),
              unreadCount: Math.max(0, prev.unreadCount - 1),
            }
          : null
      );
      showToast(t('notifications.markedRead'), 'success');
    } catch (err) {
      showToast(t('common.error_generic'), 'error');
      console.error(err);
    } finally {
      setMarking(null);
    }
  };

  const handleMarkAll = async () => {
    try {
      setMarkingAll(true);
      await markAllNotificationsRead();
      setData((prev) =>
        prev
          ? {
              ...prev,
              notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
              unreadCount: 0,
            }
          : null
      );
      showToast(t('notifications.allMarkedRead'), 'success');
    } catch (err) {
      showToast(t('common.error_generic'), 'error');
      console.error(err);
    } finally {
      setMarkingAll(false);
    }
  };

  const filteredNotifications = data?.notifications.filter((n) => {
    if (filters.priority !== 'all' && n.priority !== filters.priority) return false;
    if (filters.unreadOnly && n.isRead) return false;
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      return (
        n.message.toLowerCase().includes(term) ||
        typeLabel(n.type, t).toLowerCase().includes(term)
      );
    }
    return true;
  }) ?? [];

  const hasUnread = data ? data.unreadCount > 0 : false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              fontFamily: 'Sora, sans-serif',
              letterSpacing: '-0.02em',
            }}
          >
            {t('notifications.title')}
          </h1>
          <p
            style={{
              margin: '8px 0 0 0',
              fontSize: '15px',
              color: 'var(--text-secondary)',
              fontWeight: 400,
            }}
          >
            {data
              ? t('notifications.totalNotifications', {
                  total: data.total,
                  unread: data.unreadCount,
                })
              : t('common.loading')}
          </p>
        </div>

        {/* Filter Bar - Single Row */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            padding: '14px 16px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            flexWrap: 'wrap',
          }}
        >
          {/* Search Input */}
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder={t('common.search')}
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                fontSize: '13px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--background)',
                color: 'var(--text-primary)',
                fontFamily: 'DM Sans, sans-serif',
                transition: '0.15s ease',
                outline: 'none',
              } as React.CSSProperties}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = 'var(--accent)';
                (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(201, 151, 58, 0.10)';
              }}
              onBlur={(e) => {
                (e.target as HTMLInputElement).style.borderColor = 'var(--border)';
                (e.target as HTMLInputElement).style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Priority Filter */}
          <select
            value={filters.priority}
            onChange={(e) =>
              setFilters({ ...filters, priority: e.target.value as any })
            }
            style={{
              padding: '10px 12px',
              fontSize: '13px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--surface)',
              color: 'var(--text-primary)',
              fontFamily: 'DM Sans, sans-serif',
              cursor: 'pointer',
              transition: '0.15s ease',
              outline: 'none',
              minWidth: '140px',
            }}
            onFocus={(e) => {
              (e.target as HTMLSelectElement).style.borderColor = 'var(--accent)';
              (e.target as HTMLSelectElement).style.boxShadow = '0 0 0 3px rgba(201, 151, 58, 0.10)';
            }}
            onBlur={(e) => {
              (e.target as HTMLSelectElement).style.borderColor = 'var(--border)';
              (e.target as HTMLSelectElement).style.boxShadow = 'none';
            }}
          >
            <option value="all">{t('notifications.priorityAll')}</option>
            <option value="urgent">{t('notifications.priority_urgent')}</option>
            <option value="high">{t('notifications.priority_high')}</option>
            <option value="medium">{t('notifications.priority_medium')}</option>
            <option value="low">{t('notifications.priority_low')}</option>
          </select>

          {/* Unread Toggle */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              color: 'var(--text-primary)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            <input
              type="checkbox"
              checked={filters.unreadOnly}
              onChange={(e) => setFilters({ ...filters, unreadOnly: e.target.checked })}
              style={{
                cursor: 'pointer',
                accentColor: 'var(--accent)',
                width: '16px',
                height: '16px',
              }}
            />
            {t('notifications.unreadOnly')}
          </label>

          {/* Mark All as Read Button */}
          {hasUnread && (
            <button
              onClick={handleMarkAll}
              disabled={loading || markingAll}
              style={{
                marginLeft: 'auto',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#16A34A',
                color: '#fff',
                cursor: loading || markingAll ? 'not-allowed' : 'pointer',
                opacity: loading || markingAll ? 0.65 : 1,
                transition: '0.15s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!loading && !markingAll) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#15803D';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    '0 4px 20px rgba(22, 163, 74, 0.22)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#16A34A';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
              }}
            >
              {markingAll ? `${t('common.loading')}...` : t('notifications.markAllRead')}
            </button>
          )}
        </div>
      </div>

      {/* Notifications List - Page Scroll, No Internal Scroll */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          flex: 1,
          minHeight: 0,
        }}
      >
        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              color: 'var(--text-muted)',
              fontSize: '14px',
            }}
          >
            {t('common.loading')}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '240px',
              color: 'var(--text-muted)',
              gap: '12px',
            }}
          >
            <Bell size={32} style={{ opacity: 0.3 }} />
            <p style={{ fontSize: '14px', margin: 0 }}>
              {filters.unreadOnly
                ? t('notifications.noUnreadNotifications')
                : t('notifications.noNotifications')}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onMarkRead={() => handleMarkRead(notification.id)}
              isMarking={marking === notification.id}
              typeLabel={typeLabel}
              timeAgo={timeAgo}
              getTypeIcon={getTypeIcon}
              t={t}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {data && data.total > limit && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '16px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
            {t('common.showingResults', {
              from: offset + 1,
              to: Math.min(offset + limit, data.total),
              total: data.total,
            })}
          </p>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0 || loading}
              style={{
                background: offset === 0 ? 'var(--background)' : 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: offset === 0 ? 'default' : 'pointer',
                color: offset === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
              }}
            >
              {t('common.previous')}
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= data.total || loading}
              style={{
                background: offset + limit >= data.total ? 'var(--background)' : 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: offset + limit >= data.total ? 'default' : 'pointer',
                color: offset + limit >= data.total ? 'var(--text-muted)' : 'var(--text-primary)',
              }}
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface NotificationRowProps {
  notification: Notification;
  onMarkRead: () => void;
  isMarking: boolean;
  typeLabel: (type: string, t: any) => string;
  timeAgo: (iso: string, t: any) => string;
  getTypeIcon: (type: string) => React.ReactNode;
  t: (key: string) => string;
}

function NotificationRow({
  notification,
  onMarkRead,
  isMarking,
  typeLabel: getTypeLabel,
  timeAgo: getTimeAgo,
  getTypeIcon,
  t,
}: NotificationRowProps) {
  const priorityStyles = PRIORITY_COLORS[notification.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.low;
  const readStyles = notification.isRead ? READ_UNREAD_STYLES.read : READ_UNREAD_STYLES.unread;
  const [isHovering, setIsHovering] = React.useState(false);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '16px 1fr 120px',
        gap: '16px',
        alignItems: 'center',
        padding: '14px 16px',
        backgroundColor: notification.isRead ? READ_UNREAD_STYLES.read.bg : READ_UNREAD_STYLES.unread.bg,
        border: `1px solid ${notification.isRead ? READ_UNREAD_STYLES.read.border : READ_UNREAD_STYLES.unread.border}`,
        borderLeft: `4px solid ${priorityStyles.dot}`,
        borderRadius: 'var(--radius-lg)',
        transition: '0.15s ease',
        boxShadow: isHovering ? readStyles.shadowHover : readStyles.shadowBase,
        cursor: 'pointer',
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Priority Indicator */}
      <div
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: priorityStyles.darkDot,
          flexShrink: 0,
        }}
      />

      {/* Main Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          minWidth: 0,
        }}
      >
        {/* Message and Type Row */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            minWidth: 0,
          }}
        >
          {/* Type Icon */}
          <div
            style={{
              color: priorityStyles.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {getTypeIcon(notification.type)}
          </div>

          {/* Message */}
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              fontWeight: notification.isRead ? 400 : 600,
              color: 'var(--text-primary)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {notification.message}
          </p>
        </div>

        {/* Metadata Row */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
            fontSize: '11px',
          }}
        >
          {/* Priority Badge */}
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.035em',
              textTransform: 'uppercase',
              color: priorityStyles.text,
              backgroundColor: priorityStyles.bg,
              border: `1px solid ${priorityStyles.border}`,
              borderRadius: '4px',
              padding: '2px 8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span
              style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                backgroundColor: priorityStyles.dot,
              }}
            />
            {t(`notifications.priority_${notification.priority}`)}
          </span>

          {/* Type Label */}
          <span
            style={{
              fontSize: '10px',
              fontWeight: 500,
              color: 'var(--text-muted)',
              backgroundColor: 'var(--background)',
              borderRadius: '4px',
              padding: '2px 8px',
            }}
          >
            {getTypeLabel(notification.type, t)}
          </span>

          {/* Time */}
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
            }}
          >
            {getTimeAgo(notification.createdAt, t)}
          </span>

          {/* Read Status */}
          {!notification.isRead && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#DC2626',
                backgroundColor: 'rgba(220, 38, 38, 0.10)',
                border: '1px solid rgba(220, 38, 38, 0.20)',
                borderRadius: '4px',
                padding: '2px 8px',
              }}
            >
              {t('notifications.unread')}
            </span>
          )}
        </div>
      </div>

      {/* Mark As Read Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMarkRead();
        }}
        disabled={notification.isRead || isMarking}
        style={{
          padding: '6px 12px',
          backgroundColor: notification.isRead ? 'var(--background)' : '#16A34A',
          color: notification.isRead ? 'var(--text-muted)' : '#fff',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          fontSize: '11px',
          fontWeight: 600,
          cursor: notification.isRead ? 'default' : 'pointer',
          transition: '0.15s ease',
          whiteSpace: 'nowrap',
          display: isMarking ? 'flex' : 'block',
          alignItems: isMarking ? 'center' : 'auto',
          justifyContent: isMarking ? 'center' : 'auto',
        }}
        onMouseEnter={(e) => {
          if (!notification.isRead && !isMarking) {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#15803D';
          }
        }}
        onMouseLeave={(e) => {
          if (!notification.isRead && !isMarking) {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#16A34A';
          }
        }}
      >
        {isMarking ? t('common.loading') : notification.isRead ? t('notifications.marked') : t('notifications.markAsRead')}
      </button>
    </div>
  );
}
