import React, { useEffect, useState, useMemo, useRef } from 'react';
import CustomSelect, { SelectOption } from '../ui/CustomSelect';
import { getCities, CityOption } from '../../api/location';

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
  highlightSelected?: boolean;
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
  highlightSelected = false,
}: CitySelectProps) {
  const [cities, setCities] = useState<CityOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Load cities from backend API when countryCode or stateCode changes
  useEffect(() => {
    if (!countryCode) {
      setCities([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    getCities(countryCode, stateCode)
      .then((data) => {
        if (!mounted) return;
        setCities(data);
      })
      .catch((err) => {
        console.error('Failed to load cities:', err);
        if (mounted) setCities([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [countryCode, stateCode]);

  const options = useMemo<SelectOption[]>(() => {
    return cities
      .map((city) => ({ value: city.value, label: city.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [cities]);

  // Prevent parent onChange updates from triggering the effect loop
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!value) return;
    if (loading) return; // Wait until options are loaded before validating
    if (options.some((option) => option.value === value)) return;
    onChangeRef.current(null);
  }, [value, options, loading]);

  const isDisabled = disabled || !countryCode || options.length === 0 || loading;

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
        placeholder={
          loading
            ? 'Loading cities...'
            : countryCode
            ? placeholder
            : 'Select country first'
        }
        disabled={isDisabled}
        error={error}
        isClearable={isClearable}
        highlightSelected={highlightSelected}
      />
    </div>
  );
}
