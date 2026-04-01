import { describe, it, expect } from 'vitest';
import {
  MODULE_KEYS,
  SYSTEM_MODULE_KEYS,
  MODULE_ROLE_ELIGIBILITY,
  MANAGED_ROLE_KEYS,
  isRoleEligibleForModule,
  type ModuleKey,
  type ManagedRoleKey,
} from '../modules/permissions/permissionCatalog';

describe('permissionCatalog — anomalie removal', () => {
  it('does not include anomalie in MODULE_KEYS', () => {
    expect(MODULE_KEYS).not.toContain('anomalie');
  });

  it('does not include anomalie in SYSTEM_MODULE_KEYS', () => {
    expect(SYSTEM_MODULE_KEYS).not.toContain('anomalie');
  });

  it('does not include anomalie in MODULE_ROLE_ELIGIBILITY', () => {
    expect(Object.keys(MODULE_ROLE_ELIGIBILITY)).not.toContain('anomalie');
  });
});

describe('permissionCatalog — MODULE_KEYS structure', () => {
  it('contains expected modules after removal', () => {
    const expected = ['dipendenti', 'turni', 'presenze', 'permessi', 'negozi', 'messaggi', 'impostazioni', 'documenti', 'ats', 'report'];
    expect(MODULE_KEYS).toHaveLength(expected.length);
    for (const mod of expected) {
      expect(MODULE_KEYS).toContain(mod);
    }
  });

  it('MODULE_KEYS has exactly 10 entries', () => {
    expect(MODULE_KEYS).toHaveLength(10);
  });
});

describe('permissionCatalog — SYSTEM_MODULE_KEYS structure', () => {
  it('contains expected system modules after removal', () => {
    const expected = ['dipendenti', 'turni', 'presenze', 'permessi', 'negozi', 'messaggi', 'impostazioni'];
    expect(SYSTEM_MODULE_KEYS).toHaveLength(expected.length);
    for (const mod of expected) {
      expect(SYSTEM_MODULE_KEYS).toContain(mod);
    }
  });

  it('SYSTEM_MODULE_KEYS has exactly 7 entries', () => {
    expect(SYSTEM_MODULE_KEYS).toHaveLength(7);
  });
});

describe('permissionCatalog — MODULE_ROLE_ELIGIBILITY', () => {
  it('has an entry for every MODULE_KEY', () => {
    for (const key of MODULE_KEYS) {
      expect(MODULE_ROLE_ELIGIBILITY).toHaveProperty(key);
    }
  });

  it('presenze allows all 6 roles including store_terminal', () => {
    const presenze = MODULE_ROLE_ELIGIBILITY['presenze'];
    const allRoles: ManagedRoleKey[] = [...MANAGED_ROLE_KEYS];
    for (const role of allRoles) {
      expect(presenze).toContain(role);
    }
  });

  it('dipendenti does not include employee or store_terminal', () => {
    const dipendenti = MODULE_ROLE_ELIGIBILITY['dipendenti'];
    expect(dipendenti).not.toContain('employee');
    expect(dipendenti).not.toContain('store_terminal');
  });

  it('impostazioni is restricted to admin, hr, area_manager', () => {
    const impostazioni = MODULE_ROLE_ELIGIBILITY['impostazioni'];
    expect(impostazioni).toContain('admin');
    expect(impostazioni).toContain('hr');
    expect(impostazioni).toContain('area_manager');
    expect(impostazioni).not.toContain('store_manager');
    expect(impostazioni).not.toContain('employee');
    expect(impostazioni).not.toContain('store_terminal');
  });
});

describe('isRoleEligibleForModule', () => {
  it('returns true when role is eligible for the module', () => {
    expect(isRoleEligibleForModule('admin', 'dipendenti')).toBe(true);
    expect(isRoleEligibleForModule('hr', 'turni')).toBe(true);
    expect(isRoleEligibleForModule('store_terminal', 'presenze')).toBe(true);
  });

  it('returns false when role is not eligible for the module', () => {
    expect(isRoleEligibleForModule('employee', 'dipendenti')).toBe(false);
    expect(isRoleEligibleForModule('store_terminal', 'messaggi')).toBe(false);
    expect(isRoleEligibleForModule('store_manager', 'impostazioni')).toBe(false);
  });

  it('returns false for any role when module has empty eligibility (documenti)', () => {
    const roles: ManagedRoleKey[] = [...MANAGED_ROLE_KEYS];
    for (const role of roles) {
      expect(isRoleEligibleForModule(role, 'documenti')).toBe(false);
    }
  });

  it('returns false for any role when module has empty eligibility (ats)', () => {
    const roles: ManagedRoleKey[] = [...MANAGED_ROLE_KEYS];
    for (const role of roles) {
      expect(isRoleEligibleForModule(role, 'ats')).toBe(false);
    }
  });

  // Regression: ensure isRoleEligibleForModule handles all current ModuleKey values without throwing
  it('does not throw for any valid module/role combination', () => {
    for (const mod of MODULE_KEYS) {
      for (const role of MANAGED_ROLE_KEYS) {
        expect(() => isRoleEligibleForModule(role, mod as ModuleKey)).not.toThrow();
      }
    }
  });
});