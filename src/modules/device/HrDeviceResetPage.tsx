import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { getEmployees, resetEmployeeDevice } from '../../api/employees';
import { useToast } from '../../context/ToastContext';
import { translateApiError } from '../../utils/apiErrors';
import { Employee, UserRole } from '../../types';
import { Spinner } from '../../components/ui/Spinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useSocket } from '../../context/SocketContext';
import { Badge } from '../../components/ui/Badge';
import { getAvatarUrl } from '../../api/client';
import { Pagination } from '../../components/ui/Pagination';

export default function HrDeviceResetPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const loadEmployees = async () => {
    const res = await getEmployees({ limit: 500, status: 'active', role: 'employee' });
    setEmployees(res.employees ?? []);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadEmployees()
      .catch(() => {
        if (!cancelled) setEmployees([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadEmployees().catch(() => {});
    }, 12000);
    return () => window.clearInterval(timer);
  }, []);

  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleDeviceRegistered = (data: { userId: number }) => {
      console.log('Real-time: device registered for user', data.userId);
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === data.userId
            ? { ...emp, deviceRegistered: true, deviceResetPending: false, deviceRegisteredAt: new Date().toISOString() }
            : emp
        )
      );
    };

    const handleDeviceReset = (data: { userId: number }) => {
      console.log('Real-time: device reset for user', data.userId);
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === data.userId
            ? { ...emp, deviceRegistered: false, deviceResetPending: false, deviceRegisteredAt: null }
            : emp
        )
      );
    };

    socket.on('DEVICE_REGISTERED', handleDeviceRegistered);
    socket.on('DEVICE_RESET', handleDeviceReset);

    return () => {
      socket.off('DEVICE_REGISTERED', handleDeviceRegistered);
      socket.off('DEVICE_RESET', handleDeviceReset);
    };
  }, [socket]);

  const filteredEmployees = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) => {
      const full = `${emp.surname} ${emp.name}`.toLowerCase();
      return (
        full.includes(q) ||
        (emp.uniqueId ?? '').toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        (emp.storeName ?? '').toLowerCase().includes(q)
      );
    });
  }, [employees, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const total = filteredEmployees.length;
  const pages = Math.ceil(total / limit);

  const paginatedEmployees = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredEmployees.slice(start, start + limit);
  }, [filteredEmployees, page, limit]);

  const handleReset = async () => {
    if (!selectedEmployee || submitting) return;
    setSubmitting(true);
    try {
      await resetEmployeeDevice(selectedEmployee.id);
      showToast(t('deviceReset.successToast'), 'success');
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === selectedEmployee.id
            ? { ...emp, deviceRegistered: false, deviceResetPending: false, deviceRegisteredAt: null }
            : emp
        )
      );
      setSelectedEmployee(null);
      setConfirmOpen(false);
    } catch (err: unknown) {
      showToast(translateApiError(err, t) ?? t('employees.deviceResetRequestedError'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ fontFamily: 'var(--font-body)' }}>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.55 }}>
        {t('deviceReset.subtitle')}
      </p>

      <input
        className="field-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('deviceReset.searchPlaceholder')}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 8,
          border: '1.5px solid var(--border)',
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          background: 'var(--surface)',
          color: 'var(--text-primary)',
          marginBottom: 20,
        }}
      />

      <div className="table-scroll" style={{ border: '1px solid var(--border-light)', background: 'var(--surface)', borderRadius: 24, overflowX: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 930 }}>
          <thead>
            <tr style={{ background: 'var(--primary)', color: '#fff' }}>
              <th style={{ ...thCell, borderTopLeftRadius: 12 }}>{t('deviceReset.colName')}</th>
              <th style={thCell}>{t('deviceReset.colUniqueId')}</th>
              <th style={thCell}>{t('deviceReset.colRole')}</th>
              <th style={thCell}>{t('deviceReset.colCompanyStore')}</th>
              <th style={thCell}>{t('deviceReset.colDeviceStatus')}</th>
              <th style={{ ...thCell, textAlign: 'right', borderTopRightRadius: 12 }}>{t('deviceReset.colAction')}</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEmployees.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '18px 16px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {t('deviceReset.empty')}
                </td>
              </tr>
            )}
            {paginatedEmployees.map((emp) => {
              const fullName = [emp.surname, emp.name].filter(Boolean).join(' ') || 'Utente';
              const rawInitials = (emp.surname?.[0] ?? '') + (emp.name?.[0] ?? '');
              const initials = (rawInitials || '?').toUpperCase();
              const bg = getAvatarColor(fullName);

              return (
                <tr key={emp.id} style={{ transition: 'background 0.12s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--background)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={tdCell}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                      <div style={{
                        width: '34px', height: '34px', borderRadius: '50%',
                        background: emp.avatarFilename ? 'transparent' : bg, color: '#fff', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
                        fontFamily: 'var(--font-display)', overflow: 'hidden',
                      }}>
                        {emp.avatarFilename ? (
                          <img
                            src={getAvatarUrl(emp.avatarFilename) ?? ''}
                            alt={fullName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : initials}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13.5px', lineHeight: 1.3 }}>
                          {emp.surname} {emp.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }} title={emp.email}>
                          {emp.email.length > 15 ? `${emp.email.slice(0, 15)}...` : emp.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={tdCell}>{emp.uniqueId ?? '-'}</td>
                  <td style={tdCell}>
                    <Badge variant={ROLE_BADGE_VARIANT[emp.role]}>
                      {emp.isSuperAdmin ? t('roles.super_admin') : t(`roles.${emp.role}`)}
                    </Badge>
                  </td>
                  <td style={tdCell}>
                    <div>{emp.companyName ?? '-'}</div>
                    <div style={{ fontSize: 12, color: '#9A6808' }}>{emp.storeName ?? '-'}</div>
                  </td>
                  <td style={tdCell}>
                    {emp.deviceResetPending ? (
                      <span style={statusChip('#d97706', 'rgba(217,119,6,0.10)')}>{t('employees.deviceStatusResetPending')}</span>
                    ) : emp.deviceRegistered ? (
                      <span style={statusChip('#15803d', 'rgba(21,128,61,0.10)')}>{t('employees.deviceStatusRegistered')}</span>
                    ) : (
                      <span style={statusChip('#6b7280', 'rgba(107,114,128,0.10)')}>{t('employees.deviceStatusNotRegistered')}</span>
                    )}
                  </td>
                  <td style={{ ...tdCell, textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={submitting || emp.deviceResetPending === true}
                      onClick={() => {
                        setSelectedEmployee(emp);
                        setConfirmOpen(true);
                      }}
                    >
                      {t('deviceReset.resetButton')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pages={pages}
        total={total}
        limit={limit}
        onPageChange={setPage}
      />

      <ConfirmModal
        open={confirmOpen}
        title={t('deviceReset.confirmTitle')}
        message={t('deviceReset.confirmMessage', {
          employee:
            selectedEmployee
              ? `${selectedEmployee.surname} ${selectedEmployee.name}`
              : '',
        })}
        confirmLabel={submitting ? t('common.loading') : t('deviceReset.resetButton')}
        cancelLabel={t('common.cancel')}
        variant="warning"
        onCancel={() => {
          if (!submitting) setConfirmOpen(false);
        }}
        onConfirm={() => { void handleReset(); }}
      />
    </div>
  );
}

const thCell: CSSProperties = {
  padding: '14px 16px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#fff',
};

const tdCell: CSSProperties = {
  padding: '14px 16px',
  verticalAlign: 'middle',
  color: 'var(--text-primary)',
  fontSize: 13,
  borderBottom: '1px solid var(--border-light)',
};

function statusChip(color: string, bg: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5px 12px',
    borderRadius: 999,
    border: `1px solid ${color}44`,
    background: bg,
    color,
    fontSize: 11.5,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
  };
}

const ROLE_BADGE_VARIANT: Record<UserRole, 'accent' | 'primary' | 'info' | 'success' | 'warning' | 'neutral'> = {
  admin: 'accent',
  hr: 'info',
  area_manager: 'success',
  store_manager: 'warning',
  employee: 'neutral',
  store_terminal: 'neutral',
};

const AVATAR_PALETTE = ['#0D2137', '#163352', '#8B6914', '#1B4D3E', '#2C5282', '#5B2333'];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
