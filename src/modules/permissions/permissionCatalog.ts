export const MANAGED_ROLE_KEYS = [
  'admin',
  'hr',
  'area_manager',
  'store_manager',
  'employee',
  'store_terminal',
] as const;

export type ManagedRoleKey = typeof MANAGED_ROLE_KEYS[number];

export const MODULE_KEYS = [
  'negozi',
  'dipendenti',
  'ats',
  'onboarding',
  'documenti',
  'terminali',
  'turni',
  'trasferimenti',
  'presenze',
  'anomalie',
  'permessi',
  'saldi',
  'messaggi',
  'gestione_accessi',
  'impostazioni',
  'report',
] as const;

export type ModuleKey = typeof MODULE_KEYS[number];

export const ROLE_COLORS: Record<ManagedRoleKey, string> = {
  admin: '#C9973A',
  hr: '#0284C7',
  area_manager: '#15803D',
  store_manager: '#7C3AED',
  employee: '#374151',
  store_terminal: '#9CA3AF',
};

export const SYSTEM_MODULE_KEYS = [
  'negozi',
  'dipendenti',
  'ats',
  'onboarding',
  'documenti',
  'terminali',
  'turni',
  'trasferimenti',
  'presenze',
  'anomalie',
  'permessi',
  'saldi',
  'messaggi',
  'gestione_accessi',
  'impostazioni',
] as const;

export type SystemModuleKey = typeof SYSTEM_MODULE_KEYS[number];

export const MODULE_ROLE_ELIGIBILITY: Record<ModuleKey, readonly ManagedRoleKey[]> = {
  dipendenti: ['admin', 'hr', 'area_manager', 'store_manager'],
  turni: ['admin', 'hr', 'area_manager', 'store_manager', 'employee'],
  trasferimenti: ['admin', 'hr', 'area_manager', 'store_manager'],
  presenze: ['admin', 'hr', 'area_manager', 'store_manager', 'employee', 'store_terminal'],
  anomalie: ['admin', 'hr', 'area_manager', 'store_manager'],
  permessi: ['admin', 'hr', 'area_manager', 'store_manager', 'employee'],
  saldi: ['admin', 'hr'],
  negozi: ['admin', 'hr', 'area_manager', 'store_manager', 'store_terminal'],
  messaggi: ['admin', 'hr', 'area_manager', 'store_manager', 'employee'],
  impostazioni: ['admin'],
  documenti: ['admin', 'hr', 'area_manager', 'store_manager', 'employee'],
  ats: ['admin', 'hr', 'area_manager'],
  onboarding: ['admin', 'hr', 'area_manager', 'store_manager', 'employee', 'store_terminal'],
  report: [],
  gestione_accessi: ['admin', 'hr', 'area_manager'],
  terminali: ['admin', 'hr', 'area_manager', 'store_manager', 'employee'],
};

export function isRoleEligibleForModule(role: ManagedRoleKey, moduleKey: ModuleKey): boolean {
  return MODULE_ROLE_ELIGIBILITY[moduleKey].includes(role);
}
