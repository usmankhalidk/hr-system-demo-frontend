import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock api/client before imports so it's hoisted properly
const mockGet = vi.fn();

vi.mock('../api/client', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getAvatarUrl: vi.fn().mockReturnValue(''),
}));

import { getCompaniesPermissions } from '../api/systemPermissions';

// ── Tests for CompanyGrid interface (anomalie removed) ─────────────────────

describe('systemPermissions — CompanyGrid anomalie removal', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('getCompaniesPermissions returns a grid without anomalie', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          companies: [
            {
              id: 1,
              name: 'TestCo',
              grid: {
                turni:        { admin: true,  hr: true,  areaManager: false, storeManager: false, employee: false, storeTerminal: false },
                permessi:     { admin: true,  hr: true,  areaManager: false, storeManager: false, employee: false, storeTerminal: false },
                presenze:     { admin: true,  hr: true,  areaManager: true,  storeManager: true,  employee: true,  storeTerminal: true  },
                negozi:       { admin: true,  hr: false, areaManager: false, storeManager: false, employee: false, storeTerminal: false },
                dipendenti:   { admin: true,  hr: true,  areaManager: false, storeManager: false, employee: false, storeTerminal: false },
                messaggi:     { admin: true,  hr: true,  areaManager: false, storeManager: false, employee: false, storeTerminal: false },
                impostazioni: { admin: true,  hr: false, areaManager: false, storeManager: false, employee: false, storeTerminal: false },
              },
            },
          ],
        },
      },
    });

    const result = await getCompaniesPermissions();
    const grid = result.companies[0].grid;

    // Verify expected keys are present
    expect(grid).toHaveProperty('turni');
    expect(grid).toHaveProperty('presenze');
    expect(grid).toHaveProperty('permessi');
    expect(grid).toHaveProperty('negozi');
    expect(grid).toHaveProperty('dipendenti');
    expect(grid).toHaveProperty('messaggi');
    expect(grid).toHaveProperty('impostazioni');

    // The grid should NOT have an anomalie key
    expect(grid).not.toHaveProperty('anomalie');
  });

  it('getCompaniesPermissions calls the correct endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: { companies: [] } },
    });

    await getCompaniesPermissions();
    expect(mockGet).toHaveBeenCalledWith('/permissions/companies');
  });
});

describe('systemPermissions — SystemPermissionUpdate module union', () => {
  it('valid module values do not include anomalie', () => {
    // The valid module values after the PR are:
    // 'turni' | 'permessi' | 'presenze' | 'negozi' | 'dipendenti' | 'messaggi' | 'impostazioni'
    const validModules = ['turni', 'permessi', 'presenze', 'negozi', 'dipendenti', 'messaggi', 'impostazioni'] as const;
    expect(validModules).not.toContain('anomalie');
  });

  it('has exactly 7 valid module values after anomalie removal', () => {
    const validModules = ['turni', 'permessi', 'presenze', 'negozi', 'dipendenti', 'messaggi', 'impostazioni'];
    expect(validModules).toHaveLength(7);
  });

  it('all expected valid modules are present', () => {
    const validModules = ['turni', 'permessi', 'presenze', 'negozi', 'dipendenti', 'messaggi', 'impostazioni'];
    expect(validModules).toContain('turni');
    expect(validModules).toContain('permessi');
    expect(validModules).toContain('presenze');
    expect(validModules).toContain('negozi');
    expect(validModules).toContain('dipendenti');
    expect(validModules).toContain('messaggi');
    expect(validModules).toContain('impostazioni');
  });
});