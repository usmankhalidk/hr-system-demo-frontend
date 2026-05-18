import type { Notification } from '../api/notifications';

export function getNotificationNavigationUrl(notification: Pick<Notification, 'type'>): string | null {
  const { type } = notification;

  if (type.startsWith('ats.')) {
    return '/ats';
  }

  if (type.startsWith('employee.')) {
    return '/dipendenti';
  }

  if (type.startsWith('shift.')) {
    return '/turni';
  }

  if (type.startsWith('attendance.')) {
    return '/presenze';
  }

  if (type.startsWith('leave.')) {
    return '/permessi';
  }

  if (type.startsWith('document.')) {
    return '/documenti';
  }

  if (type.startsWith('onboarding.')) {
    return '/onboarding';
  }

  if (type.startsWith('manager.')) {
    return '/';
  }

  return null;
}
