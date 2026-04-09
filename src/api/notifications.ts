import apiClient from './client';

export interface Notification {
  id: number;
  companyId: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  /** Locale in which title/message were stored (e.g. 'it', 'en'). */
  locale?: string;
}

export interface NotificationsPage {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  limit: number;
  offset: number;
}

export async function getNotifications(params?: {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<NotificationsPage> {
  const { data } = await apiClient.get('/notifications', { params });
  return data.data as NotificationsPage;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await apiClient.get('/notifications/unread-count');
  return data.data.count as number;
}

export async function markNotificationRead(id: number): Promise<void> {
  await apiClient.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<number> {
  const { data } = await apiClient.patch('/notifications/read-all');
  return data.data.count as number;
}

/**
 * Persists the user's chosen locale to the database.
 * Called whenever the language switcher changes the active language.
 * This ensures background jobs (cron-based notifications) use the correct language.
 */
export async function updateUserLocale(locale: 'it' | 'en'): Promise<void> {
  await apiClient.patch('/auth/locale', { locale });
}

