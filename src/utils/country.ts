import { Country } from 'country-state-city';

export function getCountryDisplayName(countryCode?: string | null): string | null {
  const normalized = (countryCode ?? '').trim().toUpperCase();
  if (!normalized) return null;
  return Country.getCountryByCode(normalized)?.name ?? normalized;
}
