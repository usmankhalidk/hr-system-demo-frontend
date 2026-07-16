import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import {
  getLeaveRequests,
  getPendingLeaveApprovals,
  getLeaveBalance,
  LeaveRequest,
  LeaveBalance,
} from '../../api/leave';
import { LeaveBalanceCard } from './LeaveBalanceCard';
import { LeaveRequestDrawer } from './LeaveRequestDrawer';
import { LeaveApprovalList } from './LeaveApprovalList';
import AdminLeavePanel from './AdminLeavePanel';
import LeaveCalendar from './LeaveCalendar';

const ADMIN_ROLES = ['admin', 'hr'] as const;

const APPROVER_ROLES = ['admin', 'hr', 'area_manager', 'store_manager'] as const;
type ApproverRole = typeof APPROVER_ROLES[number];

function isApprover(role: string): role is ApproverRole {
  return (APPROVER_ROLES as readonly string[]).includes(role);
}

type Tab = 'mine' | 'pending' | 'calendar';

// Outer shell: only calls useAuth (one stable hook), then delegates to the
// appropriate view. This avoids a Rules-of-Hooks violation that would occur
// if useState/useCallback/useEffect were called after a conditional return.
export default function LeavePage() {
  const { user } = useAuth();

  if (user && (((ADMIN_ROLES as readonly string[]).includes(user.role)) || user.isSuperAdmin)) {
    return <AdminLeavePanel />;
  }

  return <PersonalLeavePage />;
}

function IconMenu() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function PersonalLeavePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isMobile } = useBreakpoint();

  const [activeTab, setActiveTab] = useState<Tab>('mine');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [balanceVisible, setBalanceVisible] = useState(true);

  const [loadingMine, setLoadingMine] = useState(true);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(true);

  const userIsApprover = user ? (isApprover(user.role) || user.isSuperAdmin) : false;

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchMyRequests = useCallback(async () => {
    setLoadingMine(true);
    try {
      const res = await getLeaveRequests();
      setMyRequests(res.requests);
    } catch {
      // Error handled silently — list stays empty
    } finally {
      setLoadingMine(false);
    }
  }, []);

  const fetchPendingRequests = useCallback(async () => {
    if (!userIsApprover) return;
    setLoadingPending(true);
    try {
      const res = await getPendingLeaveApprovals();
      setPendingRequests(res.requests);
    } catch {
      // Silently handle
    } finally {
      setLoadingPending(false);
    }
  }, [userIsApprover]);

  const fetchBalance = useCallback(async () => {
    setLoadingBalance(true);
    try {
      const res = await getLeaveBalance({ year: new Date().getFullYear() });
      setBalances(res.balances);
      // balanceVisible defaults to true for non-employees (admin/hr); employees get explicit flag
      setBalanceVisible(res.balanceVisible !== false);
    } catch {
      // Silently handle
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  useEffect(() => {
    fetchMyRequests();
    fetchBalance();
    if (userIsApprover) fetchPendingRequests();
  }, [fetchMyRequests, fetchBalance, fetchPendingRequests, userIsApprover]);

  const [prefilledDate, setPrefilledDate] = useState<string | undefined>(undefined);

  const handleDayClick = (date: string) => {
    setPrefilledDate(date);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setPrefilledDate(undefined);
  };

  // ---------------------------------------------------------------------------
  // Tab styling
  // ---------------------------------------------------------------------------

  function tabStyle(tab: Tab): React.CSSProperties {
    const active = activeTab === tab;
    return {
      padding: '10px 20px',
      fontSize: 14,
      fontWeight: active ? 700 : 500,
      color: active ? 'var(--primary)' : 'var(--text-secondary)',
      background: 'none',
      border: 'none',
      borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
      cursor: 'pointer',
      transition: 'all 0.15s',
      whiteSpace: 'nowrap',
    };
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={{ padding: isMobile ? '16px 0' : '24px 20px', width: '100%' }}>
      {/* Page header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
            {t('leave.page_title')}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {t('leave.page_subtitle')}
          </p>
        </div>
        {user?.role !== 'store_terminal' && (
          isMobile ? (
            <button
              onClick={() => setMobileMenuOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
                height: 36,
                minWidth: 36,
                border: '1.5px solid var(--border)',
                background: 'var(--surface)',
                borderRadius: 8,
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              <IconMenu />
            </button>
          ) : (
            <button
              onClick={() => {
                setPrefilledDate(undefined);
                setDrawerOpen(true);
              }}
              style={{
                padding: '10px 20px', borderRadius: 8, border: 'none',
                background: 'var(--primary)', color: '#fff',
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              + {t('leave.new_request')}
            </button>
          )
        )}
      </div>

      {/* Balance card — hidden when admin has disabled balance visibility for employees */}
      {user?.role !== 'store_terminal' && balanceVisible && (
        <LeaveBalanceCard balances={balances} loading={loadingBalance} />
      )}

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--surface)' }}>
        {/* Tabs */}
        <div style={{ borderBottom: '1px solid var(--border)', display: 'flex', gap: 0, padding: '0 12px', background: 'var(--surface-warm)' }}>
          <button style={tabStyle('mine')} onClick={() => setActiveTab('mine')}>
            {t('leave.tab_mine')}
          </button>
          {userIsApprover && (
            <button style={tabStyle('pending')} onClick={() => setActiveTab('pending')}>
              {t('leave.tab_pending')}
              {pendingRequests.length > 0 && (
                <span style={{
                  marginLeft: 8, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--accent)', color: '#fff',
                  fontSize: 11, fontWeight: 800,
                }}>
                  {pendingRequests.length}
                </span>
              )}
            </button>
          )}
          <button style={tabStyle('calendar')} onClick={() => setActiveTab('calendar')}>
            {t('leave.tab_calendar', 'Calendar')}
          </button>
        </div>

        {/* Tab content */}
        <div style={{ padding: '10px 4px 6px' }}>
          {activeTab === 'mine' && (
            <LeaveApprovalList
              requests={myRequests}
              loading={loadingMine}
              onRefresh={fetchMyRequests}
              showActions={false}
            />
          )}
          {activeTab === 'pending' && userIsApprover && (
            <LeaveApprovalList
              requests={pendingRequests}
              loading={loadingPending}
              onRefresh={fetchPendingRequests}
              showActions
            />
          )}
          {activeTab === 'calendar' && (
            <LeaveCalendar onDayClick={handleDayClick} onRefresh={() => { fetchMyRequests(); if (userIsApprover) fetchPendingRequests(); }} />
          )}
        </div>
      </div>

      {/* Leave request drawer */}
      <LeaveRequestDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        initialStartDate={prefilledDate}
        initialEndDate={prefilledDate}
        onSubmitted={() => {
          handleCloseDrawer();
          fetchMyRequests();
          fetchBalance();
        }}
      />

      {createPortal(
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1400,
              background: 'rgba(13,33,55,0.55)',
              backdropFilter: 'blur(3px)',
              opacity: mobileMenuOpen ? 1 : 0,
              pointerEvents: mobileMenuOpen ? 'auto' : 'none',
              transition: 'opacity 0.3s ease',
            }}
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'min(320px, 85vw)',
              background: 'var(--surface)',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.3s ease',
              zIndex: 1401,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              background: 'var(--primary)',
              color: '#fff',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}>
              <div>
                <div style={{
                  fontSize: 10,
                  letterSpacing: 1.2,
                  opacity: 0.7,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}>
                  {t('leave.page_title')}
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                }}>
                  {t('common.options', 'Options')}
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#fff',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 20,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>

            {/* Menu Items */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 0',
            }}>
              <button
                onClick={() => {
                  setPrefilledDate(undefined);
                  setDrawerOpen(true);
                  setMobileMenuOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 20px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                  borderBottom: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--background)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  {t('leave.new_request')}
                </span>
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
