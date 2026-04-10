import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getTerminals, Terminal } from '../../api/terminals';
import apiClient from '../../api/client';
import { translateApiError } from '../../utils/apiErrors';
import { getStores } from '../../api/stores';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Store, UserRole } from '../../types';
import { Table, Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Alert } from '../../components/ui/Alert';
import { Pagination } from '../../components/ui/Pagination';

interface CompanyOption {
  id: number;
  name: string;
}

const ROLE_BADGE_VARIANT: Record<UserRole | string, 'accent' | 'primary' | 'info' | 'success' | 'warning' | 'neutral'> = {
  admin: 'accent',
  hr: 'info',
  area_manager: 'success',
  store_manager: 'warning',
  employee: 'neutral',
  store_terminal: 'neutral',
};

export default function TerminalList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const search = searchParams.get('search') ?? '';
  const storeId = searchParams.get('store_id') ?? '';
  const status = searchParams.get('status') ?? '';
  const companyFilter = searchParams.get('company_id') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = 20;

  const isAdminOrHr = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'area_manager';
  const isSuperAdmin = user?.isSuperAdmin === true;
  const tRole = (roleKey: string) => (t as (k: string) => string)(`roles.${roleKey}`);
  const hasActiveFilters = !!(search || storeId || status || companyFilter);

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
    getTerminals({
      search: search || undefined,
      store_id: storeId || undefined,
      status: status || undefined,
      company_id: companyFilter || undefined,
      page,
      limit,
    })
      .then((res) => {
        setTerminals(res.data.data);
        setTotal(res.data.meta.total);
        setTotalPages(res.data.meta.totalPages);
      })
      .catch((err) => {
        setError(translateApiError(err, t, t('terminals.errorLoad', 'Errore nel caricamento dei terminali')));
      })
      .finally(() => setLoading(false));
  }, [search, storeId, status, companyFilter, page, t]);

  const columns: Column<Terminal>[] = [
    {
      key: 'name',
      label: t('terminals.colName'),
      render: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13.5px' }}>{row.name}</span>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{row.email}</span>
        </div>
      ),
    },
    {
      key: 'role',
      label: t('terminals.colRole'),
      render: (row) => (
        <Badge variant={ROLE_BADGE_VARIANT[row.role]}>{tRole(row.role)}</Badge>
      ),
    },
    {
      key: 'companyId',
      label: t('terminals.colCompany'),
      render: (row) => row.companyName || '—',
    },
    {
      key: 'storeId',
      label: t('terminals.colStore'),
      render: (row) => row.storeName || '—',
    },
    {
      key: 'status',
      label: t('terminals.colStatus'),
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : 'danger'}>
          {row.status === 'active' ? t('terminals.statusActive') : t('terminals.statusInactive')}
        </Badge>
      ),
    },
  ];

  return (
    <div className="page-enter">
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', fontFamily: 'var(--font-display)' }}>
            {t('terminals.title')}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            {t('terminals.subtitle')}
          </p>
        </div>
      </div>

      <Alert variant="info">
        {t('terminals.readOnlyNotice')}
      </Alert>

      <div style={{
        background: 'var(--surface)',
        padding: '20px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('common.search')}
            </label>
            <Input
              value={search}
              onChange={(e) => updateParam('search', e.target.value)}
              placeholder={t('terminals.searchPlaceholder')}
            />
          </div>

          {(isAdminOrHr || isSuperAdmin) && companies.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('terminals.colCompany')}
              </label>
              <Select value={companyFilter} onChange={(e) => updateParam('company_id', e.target.value)}>
                <option value="">{t('employees.allCompanies')}</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id.toString()}>{c.name}</option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('terminals.colStore')}
            </label>
            <Select value={storeId} onChange={(e) => updateParam('store_id', e.target.value)}>
              <option value="">{t('employees.allStores')}</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id.toString()}>{s.name}</option>
              ))}
            </Select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('terminals.colStatus')}
            </label>
            <Select value={status} onChange={(e) => updateParam('status', e.target.value)}>
              <option value="">{t('terminals.allStatuses')}</option>
              <option value="active">{t('terminals.statusActive')}</option>
              <option value="inactive">{t('terminals.statusInactive')}</option>
            </Select>
          </div>
        </div>

        {hasActiveFilters && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
            <button
              onClick={() => setSearchParams({})}
              style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {t('common.filter')} (Reset)
            </button>
          </div>
        )}
      </div>

      {error ? (
        <Alert variant="danger">{error}</Alert>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <Table
            columns={columns}
            data={terminals}
            loading={loading}
            emptyText={t('terminals.noTerminals')}
          />
          {totalPages > 1 && (
            <div style={{ padding: '20px', borderTop: '1px solid var(--border-light)' }}>
              <Pagination
                page={page}
                pages={totalPages}
                total={total}
                limit={limit}
                onPageChange={(p) => updateParam('page', p.toString())}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
