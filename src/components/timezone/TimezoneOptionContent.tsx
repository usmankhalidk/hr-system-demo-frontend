import React from 'react';
import { getTimezoneLocalTimeLabel, getUtcOffsetLabel } from '../../utils/timezone';

interface TimezoneOptionContentProps {
  timezone: string;
}

export function TimezoneOptionContent({ timezone }: TimezoneOptionContentProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', minWidth: 0 }}>
      <div style={{ display: 'grid', gap: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{timezone}</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{getUtcOffsetLabel(timezone)}</span>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {getTimezoneLocalTimeLabel(timezone)}
      </span>
    </div>
  );
}
