import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight } from 'lucide-react';
import { getEmployees } from '../../api/employees';
import apiClient, { getAvatarUrl } from '../../api/client';
import { listTransfers, TransferAssignment } from '../../api/transfers';
import { translateApiError } from '../../utils/apiErrors';
import { getStores } from '../../api/stores';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Employee, Store, UserRole } from '../../types';
import { Table, Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Alert } from '../../components/ui/Alert';
import { Pagination } from '../../components/ui/Pagination';
import { EmployeeForm } from './EmployeeForm';

interface CompanyOption {
  id: number;
  name: string;
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

function formatTransferDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function EmployeeList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, allowedCompanyIds } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [showNewForm, setShowNewForm] = useState(false);
  const [newFormInstance, setNewFormInstance] = useState(0);
  const [listReloadTick, setListReloadTick] = useState(0);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [activeTransfersByUser, setActiveTransfersByUser] = useState<Record<number, TransferAssignment>>({});
  const [hoveredTransferUserId, setHoveredTransferUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const search = searchParams.get('search') ?? '';
  const storeId = searchParams.get('store_id') ?? '';
  const department = searchParams.get('department') ?? '';
  const status = searchParams.get('status') ?? '';
  const role = searchParams.get('role') ?? '';
  const companyFilter = searchParams.get('company_id') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = 20;

  const { isMobile } = useBreakpoint();
  const isAdminOrHr = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'area_manager';
  const isSuperAdmin = user?.isSuperAdmin === true;
  const tRole = (roleKey: string) => (t as (k: string) => string)(`roles.${roleKey}`);
  const hasActiveFilters = !!(search || storeId || department || status || role || companyFilter);

  const updateParam = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) { next.set(key, value); } else { next.delete(key); }
        if (key !== 'page') next.set('page', '1');
        return next;
      });
    },
    [setSearchParams]
  );

  // Re-fetch stores whenever the company filter changes (super admin viewing a different company)
  useEffect(() => {
    const targetId = companyFilter ? parseInt(companyFilter, 10) : undefined;
    getStores(targetId ? { targetCompanyId: targetId } : undefined).then(setStores).catch(() => {});
  }, [companyFilter]);

  useEffect(() => {
    if (!isAdminOrHr && !isSuperAdmin) return;
    apiClient.get<{ data: CompanyOption[] }>('/companies')
      .then((res) => {
        const data = res.data?.data;
        if (Array.isArray(data)) {
          setCompanies(data.map((c) => ({ id: c.id, name: c.name })));
        }
      })
      .catch(() => {});
  }, [isAdminOrHr, isSuperAdmin]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getEmployees({
      search: search || undefined,
      storeId: storeId ? parseInt(storeId, 10) : undefined,
      department: department || undefined,
      status: status || undefined,
      role: role || undefined,
      page,
      limit,
      targetCompanyId: companyFilter ? parseInt(companyFilter, 10) : undefined,
    })
      .then((res) => { setEmployees(res.employees); setTotal(res.total); setPages(res.pages); })
      .catch((err) => { setError(translateApiError(err, t, t('employees.errorLoad'))); })
      .finally(() => setLoading(false));
  }, [search, storeId, department, status, role, companyFilter, page, listReloadTick]);

  useEffect(() => {
    let mounted = true;
    listTransfers({ status: 'active' })
      .then((res) => {
        if (!mounted) return;
        const byUser = new Map<number, TransferAssignment>();
        for (const tr of res.transfers) {
          const current = byUser.get(tr.userId);
          if (!current || tr.startDate > current.startDate) {
            byUser.set(tr.userId, tr);
          }
        }
        setActiveTransfersByUser(Object.fromEntries(Array.from(byUser.entries())));
      })
      .catch(() => {
        if (!mounted) return;
        setActiveTransfersByUser({});
      });

    return () => {
      mounted = false;
    };
  }, [companyFilter, page, limit, allowedCompanyIds.join(',')]);

  // Show company column when admin/hr/super admin is viewing all companies (no specific company filter)
  const showCompanyColumn = (isAdminOrHr || isSuperAdmin) && !companyFilter;

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      label: t('employees.colName'),
      render: (row) => {
        const fullName = [row.name, row.surname].filter(Boolean).join(' ') || 'Utente';
        const rawInitials = (row.name?.[0] ?? '') + (row.surname?.[0] ?? '');
        const initials = (rawInitials || '?').toUpperCase();
        const bg = getAvatarColor(fullName);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: row.avatarFilename ? 'transparent' : bg, color: '#fff', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
              fontFamily: 'var(--font-display)', overflow: 'hidden',
            }}>
              {row.avatarFilename ? (
                <img
                  src={getAvatarUrl(row.avatarFilename) ?? ''}
                  alt={fullName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : initials}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13.5px', lineHeight: 1.3 }}>
                {fullName}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {row.email}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'uniqueId',
      label: t('employees.colUniqueId'),
      render: (row) => (
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: '12px', letterSpacing: '0.04em',
          color: row.uniqueId ? 'var(--text-secondary)' : 'var(--text-disabled)',
        }}>
          {row.uniqueId ?? '—'}
        </span>
      ),
    },
    {
      key: 'role',
      label: t('employees.colRole'),
      render: (row) => <Badge variant={ROLE_BADGE_VARIANT[row.role]}>{tRole(row.role)}</Badge>,
    },
    ...(showCompanyColumn ? [{
      key: 'companyName' as keyof Employee,
      label: t('employees.colCompany'),
      render: (row: Employee) => (
        <span style={{ fontSize: '13px', color: row.companyName ? 'var(--text-secondary)' : 'var(--text-disabled)' }}>
          {row.companyName ?? '—'}
        </span>
      ),
    }] : []),
    {
      key: 'storeName',
      label: t('employees.colStore'),
      render: (row) => {
        const transfer = activeTransfersByUser[row.id];
        if (transfer) {
          const showPopover = hoveredTransferUserId === row.id;
          return (
            <div style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 5,
              position: 'relative',
            }}>
              <span style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
              }}>
                {transfer.originStoreName || row.storeName || '—'}
              </span>

              <button
                type="button"
                onMouseEnter={() => setHoveredTransferUserId(row.id)}
                onMouseLeave={() => setHoveredTransferUserId((prev) => (prev === row.id ? null : prev))}
                onFocus={() => setHoveredTransferUserId(row.id)}
                onBlur={() => setHoveredTransferUserId((prev) => (prev === row.id ? null : prev))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '2px 8px',
                  borderRadius: 999,
                  border: '1px solid rgba(15,118,110,0.35)',
                  background: 'rgba(13,148,136,0.12)',
                  color: '#115e59',
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  cursor: 'help',
                }}
                title={`${transfer.originStoreName} -> ${transfer.targetStoreName}`}
              >
                <ArrowLeftRight size={11} strokeWidth={2.3} />
                {t('transfers.transfer', 'Transfer')}
              </button>

              {showPopover && (
                <div
                  onMouseEnter={() => setHoveredTransferUserId(row.id)}
                  onMouseLeave={() => setHoveredTransferUserId((prev) => (prev === row.id ? null : prev))}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    minWidth: 250,
                    maxWidth: 320,
                    zIndex: 15,
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    background: '#fff',
                    boxShadow: '0 14px 30px rgba(0,0,0,0.16)',
                    padding: '10px 11px',
                    display: 'grid',
                    gap: 5,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)' }}>
                    {transfer.originStoreName}{' -> '}{transfer.targetStoreName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {t('transfers.form.startDate', 'Start date')}: <strong>{formatTransferDate(transfer.startDate)}</strong>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {t('transfers.form.endDate', 'End date')}: <strong>{formatTransferDate(transfer.endDate)}</strong>
                  </div>
                  {transfer.reason && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {t('transfers.form.reason', 'Reason')}: {transfer.reason}
                    </div>
                  )}
                  {transfer.notes && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {t('common.notes', 'Notes')}: {transfer.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        }
        return (
          <span style={{ fontSize: '13px', color: row.storeName ? 'var(--text-secondary)' : 'var(--text-disabled)' }}>
            {row.storeName ?? '—'}
          </span>
        );
      },
    },
    {
      key: 'department',
      label: t('employees.colDept'),
      render: (row) => (
        <span style={{ fontSize: '13px', color: row.department ? 'var(--text-secondary)' : 'var(--text-disabled)' }}>
          {row.department ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('employees.colStatus'),
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : 'danger'}>
          {row.status === 'active' ? t('employees.statusActive') : t('employees.statusInactive')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '80px',
      align: 'right',
      render: (row) => (
        <button
          onClick={() => navigate(`/dipendenti/${row.id}`)}
          className="emp-open-btn"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '12px', fontWeight: 600, color: 'var(--accent)',
            fontFamily: 'var(--font-body)', padding: '5px 10px',
            borderRadius: 'var(--radius-sm)', display: 'inline-flex',
            alignItems: 'center', gap: '3px', whiteSpace: 'nowrap',
          }}
        >
          {t('common.open')} →
        </button>
      ),
    },
  ];

  return (
    <div className="page-enter" style={{ maxWidth: '1200px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between', marginBottom: '24px', gap: '12px',
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '3px' }}>
            <h1 style={{
              fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)', margin: 0, letterSpacing: '-0.02em',
            }}>
              {t('employees.title')}
            </h1>
            {total > 0 && !loading && (
              <span style={{
                background: 'var(--primary)', color: '#fff',
                fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-display)',
                padding: '2px 8px', borderRadius: '999px', letterSpacing: '0.04em',
              }}>
                {total}
              </span>
            )}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            {hasActiveFilters
              ? t('employees.foundResults', { count: total })
              : t('employees.subtitle')}
          </p>
        </div>

        {isAdminOrHr && (
          <button
            onClick={() => setShowNewForm(true)}
            className="btn btn-primary"
            style={{
              background: 'var(--primary)', color: '#fff', border: 'none',
              borderRadius: 'var(--radius)', padding: '9px 18px',
              fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-body)',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
              gap: '7px', flexShrink: 0, boxShadow: '0 2px 8px rgba(13,33,55,0.18)',
            }}
          >
            <span style={{ fontSize: '17px', lineHeight: 1, marginTop: '-1px', fontWeight: 300 }}>+</span>
            {t('employees.newEmployee')}
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: '10px', flexWrap: 'wrap',
        marginBottom: '18px', alignItems: 'flex-end',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '14px 16px',
        boxShadow: 'var(--shadow-xs)',
      }}>
        <div style={{ flex: '2 1 200px', minWidth: '150px', maxWidth: '300px' }}>
          <Input
            placeholder={t('employees.searchPlaceholder')}
            value={search}
            onChange={(e) => updateParam('search', e.target.value)}
          />
        </div>
        {(isAdminOrHr || isSuperAdmin) && companies.length > 0 && (
          <div style={{ flex: '1 1 175px', minWidth: '140px', maxWidth: '240px' }}>
            <Select value={companyFilter} onChange={(e) => updateParam('company_id', e.target.value)}>
              <option value="">{t('employees.allCompanies')}</option>
              {companies.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </Select>
          </div>
        )}
        <div style={{ flex: '1 1 155px', minWidth: '130px', maxWidth: '220px' }}>
          <Select value={storeId} onChange={(e) => updateParam('store_id', e.target.value)}>
            <option value="">{t('employees.allStores')}</option>
            {stores.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.companyName ? `${s.name} (${s.companyName})` : s.name}
              </option>
            ))}
          </Select>
        </div>
        <div style={{ flex: '1 1 155px', minWidth: '130px', maxWidth: '220px' }}>
          <Input
            placeholder={t('employees.departmentFilter')}
            value={department}
            onChange={(e) => updateParam('department', e.target.value)}
          />
        </div>
        <div style={{ flex: '1 1 140px', minWidth: '120px', maxWidth: '190px' }}>
          <Select value={status} onChange={(e) => updateParam('status', e.target.value)}>
            <option value="">{t('employees.allStatuses')}</option>
            <option value="active">{t('employees.statusActive')}</option>
            <option value="inactive">{t('employees.statusInactive')}</option>
          </Select>
        </div>
        <div style={{ flex: '1 1 155px', minWidth: '130px', maxWidth: '220px' }}>
          <Select value={role} onChange={(e) => updateParam('role', e.target.value)}>
            <option value="">{t('employees.allRoles')}</option>
            <option value="admin">{tRole('admin')}</option>
            <option value="hr">{tRole('hr')}</option>
            <option value="area_manager">{tRole('area_manager')}</option>
            <option value="store_manager">{tRole('store_manager')}</option>
            <option value="employee">{tRole('employee')}</option>
          </Select>
        </div>
        {hasActiveFilters && (
          <button
            onClick={() => setSearchParams(new URLSearchParams())}
            style={{
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '7px 12px',
              fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer',
              fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            ✕ Reset
          </button>
        )}
      </div>

      {error && (
        <div style={{ marginBottom: '16px' }}>
          <Alert variant="danger" title={t('common.error')}>{error}</Alert>
        </div>
      )}

      <Table<Employee>
        columns={columns}
        data={employees}
        loading={loading}
        emptyText={t('employees.noEmployees')}
      />

      <Pagination
        page={page}
        pages={pages}
        total={total}
        limit={limit}
        onPageChange={(p) => updateParam('page', String(p))}
      />

      {isAdminOrHr && (
        <EmployeeForm
          key={`new-employee-form-${newFormInstance}`}
          open={showNewForm}
          onCreated={() => {
            setListReloadTick((prev) => prev + 1);
          }}
          onSuccess={() => {
            setShowNewForm(false);
            setNewFormInstance((prev) => prev + 1);
            setListReloadTick((prev) => prev + 1);
            showToast(t('employees.createdSuccess'), 'success');
            updateParam('page', '1');
          }}
          onCancel={() => setShowNewForm(false)}
        />
      )}
    </div>
  );
}

export default EmployeeList;
