import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Upload, Download } from 'lucide-react';
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
import { BulkImportModal } from './BulkImportModal';
import { exportEmployeesToExcel } from './bulkImportUtils';
import CustomSelect, { SelectOption } from '../../components/ui/CustomSelect';

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

function truncateText(value: string | null | undefined, max: number): string {
  const text = value ?? '—';
  if (text === '—' || text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export function EmployeeList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, allowedCompanyIds } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [showNewForm, setShowNewForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [newFormInstance, setNewFormInstance] = useState(0);
  const [listReloadTick, setListReloadTick] = useState(0);
  const [exporting, setExporting] = useState(false);

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

  const companyOptions = useMemo<SelectOption[]>(() => {
    return companies.map((c) => ({
      value: String(c.id),
      label: c.name,
    }));
  }, [companies]);

  const storeOptions = useMemo<SelectOption[]>(() => {
    return stores.map((s) => ({
      value: String(s.id),
      label: s.companyName ? `${s.name} (${s.companyName})` : s.name,
    }));
  }, [stores]);

  const statusOptions = useMemo<SelectOption[]>(() => [
    { value: 'active', label: t('employees.statusActive') },
    { value: 'inactive', label: t('employees.statusInactive') },
  ], [t]);

  const roleOptions = useMemo<SelectOption[]>(() => [
    { value: 'admin', label: tRole('admin') },
    { value: 'hr', label: tRole('hr') },
    { value: 'area_manager', label: tRole('area_manager') },
    { value: 'store_manager', label: tRole('store_manager') },
    { value: 'employee', label: tRole('employee') },
  ], [t, tRole]);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await getEmployees({
        search: search || undefined,
        storeId: storeId ? parseInt(storeId, 10) : undefined,
        department: department || undefined,
        status: status || undefined,
        role: role || undefined,
        page: 1,
        limit: 10000,
        targetCompanyId: companyFilter ? parseInt(companyFilter, 10) : undefined,
        includeSensitive: true,
      });
      const safeName = `employees_${new Date().toISOString().slice(0, 10)}.xlsx`;
      exportEmployeesToExcel(res.employees, safeName);
    } catch {
      // silently ignore — user stays on the page
    } finally {
      setExporting(false);
    }
  }, [exporting, search, storeId, department, status, role, companyFilter]);

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
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13.5px', lineHeight: 1.3, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fullName}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {truncateText(row.email, 18)}
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
      render: (row) => <Badge variant={ROLE_BADGE_VARIANT[row.role]}>{row.isSuperAdmin ? t('roles.super_admin') : tRole(row.role)}</Badge>,
    },
    ...(showCompanyColumn ? [{
      key: 'companyName' as keyof Employee,
      label: t('employees.colCompany'),
      render: (row: Employee) => (
        <div style={{ display: 'grid', gap: 2, maxWidth: 170 }}>
          <span style={{ fontSize: '13px', color: row.companyName ? 'var(--text-secondary)' : 'var(--text-disabled)', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {truncateText(row.companyName, 16)}
          </span>
          {row.companyGroupName ? (
            <span style={{ fontSize: '10.5px', color: '#9A6808', display: 'inline-block', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {truncateText(row.companyGroupName, 18)}
            </span>
          ) : null}
        </div>
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
                maxWidth: 160,
                display: 'inline-block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {truncateText(transfer.originStoreName || row.storeName, 16)}
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
          <span style={{ fontSize: '13px', color: row.storeName ? 'var(--text-secondary)' : 'var(--text-disabled)', maxWidth: 160, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {truncateText(row.storeName, 16)}
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
          <div style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            flexShrink: 0,
            width: isMobile ? '100%' : 'auto',
            flexDirection: isMobile ? 'column' : 'row',
          }}>
            {isMobile ? (
              <>
                {/* First Row: Export and Import (Full width, 50% split) */}
                <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    style={{
                      background: 'var(--surface)', color: 'var(--primary)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', padding: '9px 18px',
                      fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-body)',
                      cursor: exporting ? 'not-allowed' : 'pointer',
                      opacity: exporting ? 0.65 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: '7px', flex: 1, transition: 'border-color 0.15s, box-shadow 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Download size={15} />
                    {exporting ? t('common.loading', 'Exporting…') : t('employees.exportBtn', 'Export Employees')}
                  </button>
                  <button
                    onClick={() => setShowBulkImport(true)}
                    style={{
                      background: 'var(--surface)', color: 'var(--primary)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', padding: '9px 18px',
                      fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-body)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: '7px', flex: 1, transition: 'border-color 0.15s, box-shadow 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Upload size={15} />
                    {t('employees.bulkImportBtn', 'Import Employees')}
                  </button>
                </div>
                {/* Second Row: New Employee (Full width) */}
                <button
                  onClick={() => setShowNewForm(true)}
                  className="btn btn-primary"
                  style={{
                    background: 'var(--primary)', color: '#fff', border: 'none',
                    borderRadius: 'var(--radius)', padding: '9px 18px',
                    fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-body)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '7px', width: '100%', boxShadow: '0 2px 8px rgba(13,33,55,0.18)',
                  }}
                >
                  <span style={{ fontSize: '17px', lineHeight: 1, marginTop: '-1px', fontWeight: 300 }}>+</span>
                  {t('employees.newEmployee')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  style={{
                    background: 'var(--surface)', color: 'var(--primary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: '9px 18px',
                    fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-body)',
                    cursor: exporting ? 'not-allowed' : 'pointer',
                    opacity: exporting ? 0.65 : 1,
                    display: 'inline-flex', alignItems: 'center',
                    gap: '7px', flexShrink: 0, transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                >
                  <Download size={15} />
                  {exporting ? t('common.loading', 'Exporting…') : t('employees.exportBtn', 'Export Employees')}
                </button>
                <button
                  onClick={() => setShowBulkImport(true)}
                  style={{
                    background: 'var(--surface)', color: 'var(--primary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: '9px 18px',
                    fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-body)',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                    gap: '7px', flexShrink: 0, transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                >
                  <Upload size={15} />
                  {t('employees.bulkImportBtn', 'Import Employees')}
                </button>
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
              </>
            )}
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: '10px',
        flexWrap: isMobile ? 'nowrap' : 'wrap',
        marginBottom: '18px',
        alignItems: isMobile ? 'stretch' : 'flex-end',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        boxShadow: 'var(--shadow-xs)',
      }}>
        {isMobile ? (
          <>
            {/* Row 1: Search bar (Full width) */}
            <div style={{ width: '100%' }}>
              <Input
                placeholder={t('employees.searchPlaceholder')}
                value={search}
                onChange={(e) => updateParam('search', e.target.value)}
              />
            </div>

            {/* Row 2: Company dropdown selector (Full width) */}
            {(isAdminOrHr || isSuperAdmin) && companies.length > 0 && (
              <div style={{ width: '100%' }}>
                <CustomSelect
                  value={companyFilter || null}
                  onChange={(value) => updateParam('company_id', value || '')}
                  options={companyOptions}
                  placeholder={t('employees.allCompanies')}
                  isClearable={true}
                  searchable={companies.length > 5}
                  highlightSelected={true}
                  controlMinHeight={38}
                />
              </div>
            )}

            {/* Row 3: Store dropdown + Department search bar (50% / 50% split) */}
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <CustomSelect
                  value={storeId || null}
                  onChange={(value) => updateParam('store_id', value || '')}
                  options={storeOptions}
                  placeholder={t('employees.allStores')}
                  isClearable={true}
                  searchable={stores.length > 5}
                  highlightSelected={true}
                  controlMinHeight={38}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Input
                  placeholder={t('employees.departmentFilter')}
                  value={department}
                  onChange={(e) => updateParam('department', e.target.value)}
                />
              </div>
            </div>

            {/* Row 4: Status dropdown + Roles dropdown (50% / 50% split) */}
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <CustomSelect
                  value={status || null}
                  onChange={(value) => updateParam('status', value || '')}
                  options={statusOptions}
                  placeholder={t('employees.allStatuses')}
                  isClearable={true}
                  searchable={false}
                  highlightSelected={true}
                  controlMinHeight={38}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <CustomSelect
                  value={role || null}
                  onChange={(value) => updateParam('role', value || '')}
                  options={roleOptions}
                  placeholder={t('employees.allRoles')}
                  isClearable={true}
                  searchable={false}
                  highlightSelected={true}
                  controlMinHeight={38}
                />
              </div>
            </div>

            {/* Row 5: Reset Filters button (Full width if active) */}
            {hasActiveFilters && (
              <button
                onClick={() => setSearchParams(new URLSearchParams())}
                style={{
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: '10px 12px',
                  fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', width: '100%', textAlign: 'center',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
              >
                ✕ Reset Filters
              </button>
            )}
          </>
        ) : (
          <>
            <div style={{ flex: '2 1 200px', minWidth: '150px', maxWidth: '300px' }}>
              <Input
                placeholder={t('employees.searchPlaceholder')}
                value={search}
                onChange={(e) => updateParam('search', e.target.value)}
              />
            </div>
            {(isAdminOrHr || isSuperAdmin) && companies.length > 0 && (
              <div style={{ flex: '1 1 175px', minWidth: '140px', maxWidth: '240px' }}>
                <CustomSelect
                  value={companyFilter || null}
                  onChange={(value) => updateParam('company_id', value || '')}
                  options={companyOptions}
                  placeholder={t('employees.allCompanies')}
                  isClearable={true}
                  searchable={companies.length > 5}
                  highlightSelected={true}
                  controlMinHeight={38}
                />
              </div>
            )}
            <div style={{ flex: '1 1 155px', minWidth: '130px', maxWidth: '220px' }}>
              <CustomSelect
                value={storeId || null}
                onChange={(value) => updateParam('store_id', value || '')}
                options={storeOptions}
                placeholder={t('employees.allStores')}
                isClearable={true}
                searchable={stores.length > 5}
                highlightSelected={true}
                controlMinHeight={38}
              />
            </div>
            <div style={{ flex: '1 1 155px', minWidth: '130px', maxWidth: '220px' }}>
              <Input
                placeholder={t('employees.departmentFilter')}
                value={department}
                onChange={(e) => updateParam('department', e.target.value)}
              />
            </div>
            <div style={{ flex: '1 1 140px', minWidth: '120px', maxWidth: '190px' }}>
              <CustomSelect
                value={status || null}
                onChange={(value) => updateParam('status', value || '')}
                options={statusOptions}
                placeholder={t('employees.allStatuses')}
                isClearable={true}
                searchable={false}
                highlightSelected={true}
                controlMinHeight={38}
              />
            </div>
            <div style={{ flex: '1 1 155px', minWidth: '130px', maxWidth: '220px' }}>
              <CustomSelect
                value={role || null}
                onChange={(value) => updateParam('role', value || '')}
                options={roleOptions}
                placeholder={t('employees.allRoles')}
                isClearable={true}
                searchable={false}
                highlightSelected={true}
                controlMinHeight={38}
              />
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
          </>
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

      {isAdminOrHr && (
        <BulkImportModal
          open={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          onComplete={() => setListReloadTick((prev) => prev + 1)}
        />
      )}
    </div>
  );
}

export default EmployeeList;
