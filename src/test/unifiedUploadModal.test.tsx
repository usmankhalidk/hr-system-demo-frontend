import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/config';
import { UnifiedUploadWizard } from '../modules/documents/UnifiedUploadModal';
import * as docsApi from '../api/documents';
import * as companiesApi from '../api/companies';
import * as employeesApi from '../api/employees';

// Mock useBreakpoint
vi.mock('../hooks/useBreakpoint', () => ({
  useBreakpoint: () => ({ isMobile: false }),
}));

// Mock useAuth
const mockUser = { id: 1, role: 'admin', companyId: 1 };
const mockAllowedCompanyIds = [1, 2];
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    allowedCompanyIds: mockAllowedCompanyIds,
    loading: false,
    refreshPermissions: vi.fn(),
  }),
}));

// Mock useToast
vi.mock('../context/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

describe('UnifiedUploadWizard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Step 1 initially and handles file selection to Step 2', async () => {
    const getCompaniesSpy = vi.spyOn(companiesApi, 'getCompanies').mockResolvedValue([
      { id: 1, name: 'Company A' } as any,
      { id: 2, name: 'Company B' } as any
    ]);
    const getEmployeesSpy = vi.spyOn(employeesApi, 'getEmployees').mockResolvedValue({ employees: [] } as any);

    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <I18nextProvider i18n={i18n}>
        <UnifiedUploadWizard onClose={onClose} onSuccess={onSuccess} />
      </I18nextProvider>
    );

    // Initial step should be File Selection (Step 1)
    expect(screen.getByText(/Multiple files allowed/i)).toBeInTheDocument();

    // Mock file input selection
    const file = new File(['dummy content'], 'document.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    // Should transition to Step 2
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('GLOBAL SETTINGS'))).toBeInTheDocument();
    });

    // Check if Company dropdown is rendered
    expect(screen.getAllByText(/Company/i).length).toBeGreaterThan(0);

    // Check if Back button is rendered on Step 2
    const backBtn = screen.getByTestId('wizard-back-button');
    expect(backBtn).toBeInTheDocument();

    // Click Back to go back to Step 1
    fireEvent.click(backBtn);
    expect(screen.getByText(/Multiple files allowed/i)).toBeInTheDocument();
  });
});
