import React, { useEffect, useMemo } from 'react';
import { State } from 'country-state-city';
import CustomSelect, { SelectOption } from '../ui/CustomSelect';

interface StateSelectProps {
  countryCode: string | null;
  value: string | null;
  onChange: (stateCode: string | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  isClearable?: boolean;
  highlightSelected?: boolean;
}

export function StateSelect({
  countryCode,
  value,
  onChange,
  label = 'State / Region',
  placeholder = 'Select state...',
  disabled = false,
  error,
  isClearable = true,
  highlightSelected = false,
}: StateSelectProps) {
  const options = useMemo<SelectOption[]>(() => {
    if (!countryCode) return [];
    return State.getStatesOfCountry(countryCode)
      .map((state) => ({ value: state.isoCode, label: state.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [countryCode]);

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
        highlightSelected={highlightSelected}
      />
    </div>
  );
}
