import React, { useEffect, useMemo } from 'react';
import { City } from 'country-state-city';
import CustomSelect, { SelectOption } from '../ui/CustomSelect';

interface CitySelectProps {
  countryCode: string | null;
  stateCode?: string | null;
  value: string | null;
  onChange: (cityName: string | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  isClearable?: boolean;
}

export function CitySelect({
  countryCode,
  stateCode,
  value,
  onChange,
  label = 'City',
  placeholder = 'Select city...',
  disabled = false,
  error,
  isClearable = true,
}: CitySelectProps) {
  const options = useMemo<SelectOption[]>(() => {
    if (!countryCode) return [];

    const rows = stateCode
      ? City.getCitiesOfState(countryCode, stateCode)
      : City.getCitiesOfCountry(countryCode);

    return (rows ?? [])
      .map((city) => ({ value: city.name, label: city.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [countryCode, stateCode]);

  useEffect(() => {
    if (!value) return;
    if (options.some((option) => option.value === value)) return;
    onChange(null);
  }, [value, options, onChange]);

  const isDisabled = disabled || !countryCode || options.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 4 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <CustomSelect
        options={options}
        value={value}
        onChange={onChange}
        placeholder={countryCode ? placeholder : 'Select country first'}
        disabled={isDisabled}
        error={error}
        isClearable={isClearable}
      />
    </div>
  );
}
