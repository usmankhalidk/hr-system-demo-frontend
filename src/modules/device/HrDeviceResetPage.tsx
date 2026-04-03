import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { getEmployees, resetEmployeeDevice } from '../../api/employees';
import { useToast } from '../../context/ToastContext';
import { translateApiError } from '../../utils/apiErrors';
import { Employee } from '../../types';
import { Spinner } from '../../components/ui/Spinner';
import ConfirmModal from '../../components/ui/ConfirmModal';

export default function HrDeviceResetPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

      <div className="table-scroll" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 930 }}>
          <thead>
            <tr style={{ background: 'var(--surface-warm)' }}>
              <th style={thCell}>{t('deviceReset.colName')}</th>
              <th style={thCell}>{t('deviceReset.colUniqueId')}</th>
              <th style={thCell}>{t('deviceReset.colRole')}</th>
              <th style={thCell}>{t('deviceReset.colCompanyStore')}</th>
              <th style={thCell}>{t('deviceReset.colDeviceStatus')}</th>
              <th style={{ ...thCell, textAlign: 'right' }}>{t('deviceReset.colAction')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '18px 16px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {t('deviceReset.empty')}
                </td>
              </tr>
            )}
            {filteredEmployees.map((emp) => (
              <tr key={emp.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                <td style={tdCell}>
                  <div style={{ fontWeight: 700 }}>{emp.surname} {emp.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.email}</div>
                </td>
                <td style={tdCell}>{emp.uniqueId ?? '-'}</td>
                <td style={tdCell}>{t(`roles.${emp.role}`)}</td>
                <td style={tdCell}>
                  <div>{emp.companyName ?? '-'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.storeName ?? '-'}</div>
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
            ))}
          </tbody>
        </table>
      </div>

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
  padding: '12px 14px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
};

const tdCell: CSSProperties = {
  padding: '12px 14px',
  verticalAlign: 'middle',
  color: 'var(--text-primary)',
  fontSize: 13,
};

function statusChip(color: string, bg: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 9px',
    borderRadius: 999,
    border: `1px solid ${color}44`,
    background: bg,
    color,
    fontSize: 12,
    fontWeight: 700,
  };
}
