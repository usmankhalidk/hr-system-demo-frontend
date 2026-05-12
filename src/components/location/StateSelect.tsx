import React, { useEffect, useState, useMemo, useRef } from 'react';
import CustomSelect, { SelectOption } from '../ui/CustomSelect';
import { getStates, StateOption } from '../../api/location';

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
  const [states, setStates] = useState<StateOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Load states from backend API when countryCode changes
  useEffect(() => {
    if (!countryCode) {
      setStates([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    getStates(countryCode)
      .then((data) => {
        if (!mounted) return;
        setStates(data);
      })
      .catch((err) => {
        console.error('Failed to load states:', err);
        if (mounted) setStates([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [countryCode]);

  const options = useMemo<SelectOption[]>(() => {
    return states
      .map((state) => ({ value: state.value, label: state.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [states]);

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
            ? 'Loading states...'
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
