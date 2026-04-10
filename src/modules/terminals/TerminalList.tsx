import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getTerminals, Terminal } from '../../api/terminals';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { UserRole } from '../../types';
import { Table, Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import { Pagination } from '../../components/ui/Pagination';
import { TerminalForm } from './TerminalForm';
import { Plus, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);
  const [listReloadTick, setListReloadTick] = useState(0);

  const search = searchParams.get('search') ?? '';
  const storeId = searchParams.get('store_id') ?? '';
  const status = searchParams.get('status') ?? '';
  const companyFilter = searchParams.get('company_id') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = 20;

  const isAdminOrHr = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'area_manager';
  const isSuperAdmin = user?.isSuperAdmin === true;
  const tRole = (roleKey: string) => (t as (k: string) => string)(`roles.${roleKey}`);

  const fetchTerminals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTerminals({
        search,
        status,
        store_id: storeId,
        company_id: companyFilter,
        page,
        limit,
      });
      setTerminals(response.data.data);
      setTotal(response.data.meta.total);
      setTotalPages(response.data.meta.totalPages);
    } catch (err) {
      console.error('Error loading terminals:', err);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [search, status, page, limit, t]);

  useEffect(() => {
    fetchTerminals();
  }, [fetchTerminals, listReloadTick]);

  const handleSearchChange = (val: string) => {
    setSearchParams(prev => {
      if (val) prev.set('search', val);
      else prev.delete('search');
      prev.set('page', '1');
      return prev;
    });
  };

  const handleOpenForm = (terminal: Terminal | null = null) => {
    setSelectedTerminal(terminal);
    setShowForm(true);
  };

  const columns: Column<Terminal>[] = [
    {
      key: 'name',
      label: t('common.name'),
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>
            {row.name.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</span>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (row) => <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{row.email}</span>,
    },
    {
      key: 'storeName',
      label: t('employees.colStore'),
      render: (row) => <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500 }}>{row.storeName}</span>,
    },
    {
      key: 'companyName',
      label: t('employees.colCompany'),
      render: (row) => <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{row.companyName}</span>,
    },
    {
      key: 'role',
      label: t('common.role'),
      render: (row) => <Badge variant={ROLE_BADGE_VARIANT[row.role]}>{tRole(row.role)}</Badge>,
    },
    {
      key: 'status',
      label: t('common.status'),
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : 'neutral'}>
          {row.status === 'active' ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
    {
      key: 'id',
      label: t('terminals.colActions'),
      align: 'right',
      render: (row) => (
        <button
          onClick={() => handleOpenForm(row)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '12px', fontWeight: 600, color: 'var(--accent)',
            fontFamily: 'var(--font-body)', padding: '5px 10px',
            borderRadius: 'var(--radius-sm)', display: 'inline-flex',
            alignItems: 'center', gap: '3px', whiteSpace: 'nowrap',
          }}
        >
          {t('common.open')}
          <ChevronRight size={14} />
        </button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '20px' }}>
        <div style={{ flex: 1, maxWidth: '400px' }}>
          <Input
            placeholder={t('terminals.searchPlaceholder')}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        {(isAdminOrHr || isSuperAdmin) && (
          <Button onClick={() => handleOpenForm(null)}>
            <Plus size={18} style={{ marginRight: '8px' }} />
            {t('terminals.newTerminal')}
          </Button>
        )}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          columns={columns}
          data={terminals}
          loading={loading}
          onRowClick={(row) => handleOpenForm(row)}
        />
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
          <Pagination
            page={page}
            pages={totalPages}
            total={total}
            limit={limit}
            onPageChange={(p) => setSearchParams(prev => { prev.set('page', p.toString()); return prev; })}
          />
        </div>
      )}

      <TerminalForm
        open={showForm}
        terminal={selectedTerminal}
        onSuccess={() => {
          setShowForm(false);
          setListReloadTick(prev => prev + 1);
          showToast(selectedTerminal ? t('common.success') : t('terminals.terminalSaveSuccess'), 'success');
        }}
        onCancel={() => setShowForm(false)}
      />
    </div>
  );
}
