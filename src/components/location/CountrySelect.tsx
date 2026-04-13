import React, { useMemo } from 'react';
import ReactCountryFlag from 'react-country-flag';
import { Country } from 'country-state-city';
import CustomSelect, { SelectOption } from '../ui/CustomSelect';

interface CountrySelectProps {
  value: string | null;
  onChange: (countryCode: string | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  isClearable?: boolean;
}

export function CountrySelect({
  value,
  onChange,
  label = 'Country',
  placeholder = 'Select country...',
  disabled = false,
  error,
  isClearable = true,
}: CountrySelectProps) {
  const options = useMemo<SelectOption[]>(() => {
    return Country.getAllCountries()
      .map((country) => ({
        value: country.isoCode,
        label: country.name,
        render: (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ReactCountryFlag countryCode={country.isoCode} svg style={{ width: '1em', height: '1em', borderRadius: 2 }} />
            <span>{country.name}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>+{country.phonecode}</span>
          </span>
        )
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

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
        placeholder={placeholder}
        disabled={disabled}
        error={error}
        isClearable={isClearable}
      />
    </div>
  );
}
