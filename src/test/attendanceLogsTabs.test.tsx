import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/config';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Admin', surname: 'User', role: 'admin', companyId: 1 },
    permissions: {},
    logout: vi.fn(),
  }),
}));

vi.mock('../hooks/useBreakpoint', () => ({
  useBreakpoint: () => ({ isMobile: false, isTablet: false }),
}));

vi.mock('../api/attendance', () => ({
  listAttendanceEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
}));

vi.mock('../api/employees', () => ({
  getEmployees: vi.fn().mockResolvedValue({ employees: [] }),
}));

vi.mock('../api/stores', () => ({
  getStores: vi.fn().mockResolvedValue([]),
}));

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
  getAvatarUrl: vi.fn().mockReturnValue(''),
}));

vi.mock('../utils/date', () => ({
  formatLocalDate: (d: Date) => d.toISOString().slice(0, 10),
  formatDateTime: (s: string) => ({ date: s, time: '' }),
}));

// Stub complex pickers as simple inputs
vi.mock('../components/ui/DatePicker', () => ({
  DatePicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input
      type="text"
      data-testid="date-picker"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('../components/ui/TimePicker', () => ({
  TimePicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input
      type="text"
      data-testid="time-picker"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('../components/ui/WeekPicker', () => ({
  WeekPicker: ({ onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <input
      type="text"
      data-testid="week-picker"
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// Stub AnomalyList so we can assert its presence
vi.mock('../modules/attendance/AnomalyList', () => ({
  default: (props: { dateFrom: string; dateTo: string }) => (
    <div data-testid="anomaly-list" data-from={props.dateFrom} data-to={props.dateTo} />
  ),
}));

// ── Render helper ──────────────────────────────────────────────────────────

import AttendanceLogsPage from '../modules/attendance/AttendanceLogsPage';

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <AttendanceLogsPage />
    </I18nextProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AttendanceLogsPage — tab switching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // i18n defaults to Italian: tab_events = 'Registro', tab_anomalies = 'Anomalie'
  it('renders both the Events (Registro) and Anomalies (Anomalie) tabs', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /registro|log/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^anomalie$|^anomalies$/i })).toBeInTheDocument();
    });
  });

  it('defaults to the events tab and does not show AnomalyList', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /registro|log/i })).toBeInTheDocument();
    });
    // AnomalyList should NOT be visible by default
    expect(screen.queryByTestId('anomaly-list')).not.toBeInTheDocument();
  });

  it('shows AnomalyList after clicking the Anomalies tab', async () => {
    renderPage();
    const anomaliesTab = await screen.findByRole('button', { name: /^anomalie$|^anomalies$/i });
    fireEvent.click(anomaliesTab);
    await waitFor(() => {
      expect(screen.getByTestId('anomaly-list')).toBeInTheDocument();
    });
  });

  it('hides AnomalyList and shows events content when Events tab is clicked', async () => {
    renderPage();
    // Switch to anomalies first
    const anomaliesTab = await screen.findByRole('button', { name: /^anomalie$|^anomalies$/i });
    fireEvent.click(anomaliesTab);
    await waitFor(() => {
      expect(screen.getByTestId('anomaly-list')).toBeInTheDocument();
    });
    // Switch back to events
    const eventsTab = screen.getByRole('button', { name: /registro|log/i });
    fireEvent.click(eventsTab);
    await waitFor(() => {
      expect(screen.queryByTestId('anomaly-list')).not.toBeInTheDocument();
    });
  });

  it('hides event-type filter pills when anomalies tab is active', async () => {
    renderPage();
    // Before switching: the att-type-btn elements are present (event type pills)
    const getTypePills = () => document.querySelectorAll('.att-type-btn');

    // On events tab there should be event type pill buttons
    await waitFor(() => {
      expect(getTypePills().length).toBeGreaterThan(0);
    });

    // Switch to anomalies
    const anomaliesTab = screen.getByRole('button', { name: /^anomalie$|^anomalies$/i });
    fireEvent.click(anomaliesTab);
    await waitFor(() => {
      expect(getTypePills().length).toBe(0);
    });
  });

  it('passes dateFrom and dateTo props to AnomalyList', async () => {
    renderPage();
    const anomaliesTab = await screen.findByRole('button', { name: /^anomalie$|^anomalies$/i });
    fireEvent.click(anomaliesTab);
    const anomalyList = await screen.findByTestId('anomaly-list');
    // The dates should be non-empty ISO date strings (today and 7 days ago)
    expect(anomalyList.getAttribute('data-from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(anomalyList.getAttribute('data-to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});