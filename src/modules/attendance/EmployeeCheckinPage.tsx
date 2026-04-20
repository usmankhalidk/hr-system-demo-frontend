import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useRef, useState } from 'react';
import { listMyAttendanceEvents, type AttendanceEvent, type EventType } from '../../api/attendance';
import { Spinner } from '../../components/ui/Spinner';
import { getDeviceFingerprint } from '../../utils/deviceFingerprint';
import { formatLocalDate } from '../../utils/date';
import { useOfflineSync } from '../../context/OfflineSyncContext';
import client from '../../api/client';

const STEPS = [
  { icon: '🖥️', key: 'step1' },
  { icon: '📱', key: 'step2' },
  { icon: '👆', key: 'step3' },
  { icon: '✅', key: 'step4' },
];

const EVENT_COLORS: Record<string, string> = {
  checkin:     '#16a34a',
  break_start: '#d97706',
  break_end:   '#2563eb',
  checkout:    '#dc2626',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

type Filter = '7' | '30';

export default function EmployeeCheckinPage() {
  const { t } = useTranslation();
  const { user, permissions } = useAuth();
  const { lastSyncTime, isOnline, isSyncing, queueLength, enqueue } = useOfflineSync();

  const [filter, setFilter] = useState<Filter>('7');
  const [historyVersion, setHistoryVersion] = useState(0);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fingerprintRef = useRef<string | null>(null);

  const initials = user
    ? `${user.name?.[0] ?? ''}${user.surname ? user.surname[0] : ''}`.toUpperCase()
    : '';

  const CLOCK_ACTIONS: { type: EventType; label: string; color: string }[] = [
    { type: 'checkin',     label: t('terminal.checkin'),    color: '#16a34a' },
    { type: 'break_start', label: t('terminal.breakStart'), color: '#d97706' },
    { type: 'break_end',   label: t('terminal.breakEnd'),   color: '#2563eb' },
    { type: 'checkout',    label: t('terminal.checkout'),   color: '#dc2626' },
  ];

  async function handleAction(eventType: EventType) {
    if (actionLoading) return;
    setActionLoading(true);
    setActionMsg(null);

    try {
      if (!fingerprintRef.current) {
        const fp = await getDeviceFingerprint();
        fingerprintRef.current = fp.fingerprint;
      }

      const eventTime = new Date().toISOString();

      if (!isOnline) {
        await enqueue({
          event_type: eventType,
          event_time: eventTime,
          unique_id: user?.uniqueId || undefined,
          user_id: user?.id,
          device_fingerprint: fingerprintRef.current || undefined,
        });
        setActionMsg({ text: 'Timbratura salvata offline — verrà sincronizzata automaticamente', ok: true });
      } else {
        // Use /sync endpoint — /checkin requires a QR token and is for terminal use only.
        // /sync accepts authenticated direct clock-ins without a QR token.
        const clientUuid: string =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const res = await client.post('/attendance/sync', {
          events: [{
            event_type: eventType,
            event_time: eventTime,
            unique_id: user?.uniqueId || undefined,
            user_id: user?.id,
            device_fingerprint: fingerprintRef.current || undefined,
            client_uuid: clientUuid,
          }],
        });
        const result = (res.data as any)?.data ?? res.data;
        if ((result?.failed ?? 0) > 0) {
          throw new Error(result?.errors?.[0] ?? 'Errore durante la timbratura');
        }
        setActionMsg({ text: 'Timbratura registrata con successo', ok: true });
        // Increment historyVersion to trigger a real re-fetch of attendance history
        window.setTimeout(() => setHistoryVersion((v) => v + 1), 1500);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Errore durante la timbratura';
      setActionMsg({ text: msg, ok: false });
    } finally {
      setActionLoading(false);
      window.setTimeout(() => setActionMsg(null), 4000);
    }
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    const days = parseInt(filter, 10);
    const dateFrom = formatLocalDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
    let alive = true;

    async function load() {
      if (permissions['presenze'] === false) {
        setLoading(false);
        return;
      }
      try {
        if (!fingerprintRef.current) {
          const fp = await getDeviceFingerprint();
          fingerprintRef.current = fp.fingerprint;
        }
        const deviceFingerprint = fingerprintRef.current ?? undefined;
        const res = await listMyAttendanceEvents({ dateFrom, deviceFingerprint });
        if (alive) setEvents(res.events);
      } catch {
        if (alive) setError('Errore nel caricamento delle presenze');
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => { alive = false; };
  }, [filter, lastSyncTime, historyVersion, permissions['presenze']]);

  // Group events by date
  const grouped: { date: string; items: AttendanceEvent[] }[] = [];
  if (Array.isArray(events)) {
    for (const ev of events) {
      if (!ev) continue;
      const rawTime = (ev as any).eventTime ?? (ev as any).event_time;
      if (!rawTime) continue;
      
      try {
        const dObj = new Date(rawTime);
        if (isNaN(dObj.getTime())) {
          console.warn('[CheckinPage] Invalid date found for event:', ev);
          continue;
        }
        const date = formatLocalDate(dObj);
        let group = grouped.find((g) => g.date === date);
        if (!group) {
          group = { date, items: [] };
          grouped.push(group);
        }
        group.items.push(ev);
      } catch (err) {
        console.error('[CheckinPage] Crash prevented during grouping:', err);
      }
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header banner with employee identity */}
      <div
        className="pop-in"
        style={{
          background: 'linear-gradient(135deg, #0D2137 0%, #1A3B5C 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Avatar */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(201,151,58,0.20)',
          border: '2px solid rgba(201,151,58,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: '#C9973A',
        }}>
          {initials}
        </div>

        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18, fontWeight: 700, color: '#ffffff', marginBottom: 2,
          }}>
            {user ? `${user.name}${user.surname ? ` ${user.surname}` : ''}` : t('checkin.title')}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-body)' }}>
            {t('checkin.subtitle')}
          </div>
        </div>
      </div>

      {/* Offline / sync status banner */}
      {(!isOnline || isSyncing || queueLength > 0) && (
        <div style={{
          borderRadius: 'var(--radius-md)',
          padding: '10px 16px',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'var(--font-body)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: !isOnline ? 'rgba(220,38,38,0.10)' : 'rgba(37,99,235,0.10)',
          border: `1px solid ${!isOnline ? 'rgba(220,38,38,0.30)' : 'rgba(37,99,235,0.30)'}`,
          color: !isOnline ? '#dc2626' : '#2563eb',
        }}>
          <span style={{ fontSize: 16 }}>{!isOnline ? '📵' : isSyncing ? '🔄' : '⏳'}</span>
          {!isOnline
            ? 'Modalità offline — le timbrature verranno sincronizzate automaticamente'
            : isSyncing
            ? 'Sincronizzazione in corso...'
            : `${queueLength} ${queueLength === 1 ? 'timbratura in attesa' : 'timbrature in attesa'} di sincronizzazione`}
        </div>
      )}

      {/* Clock-in action buttons */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderTop: '3px solid var(--accent)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          fontFamily: 'var(--font-display)', marginBottom: 4,
        }}>
          Timbra
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {CLOCK_ACTIONS.map(({ type, label, color }) => (
            <button
              key={type}
              onClick={() => void handleAction(type)}
              disabled={actionLoading}
              style={{
                padding: '14px 10px',
                borderRadius: 10,
                border: `1.5px solid ${color}55`,
                background: `${color}15`,
                color,
                fontSize: 13, fontWeight: 800,
                cursor: actionLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-display)',
                letterSpacing: 0.5,
                opacity: actionLoading ? 0.6 : 1,
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {actionLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
            <Spinner size="sm" color="var(--accent)" />
          </div>
        )}

        {actionMsg && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13, fontWeight: 600,
            fontFamily: 'var(--font-body)',
            background: actionMsg.ok ? 'rgba(22,163,74,0.10)' : 'rgba(220,38,38,0.10)',
            border: `1px solid ${actionMsg.ok ? 'rgba(22,163,74,0.30)' : 'rgba(220,38,38,0.30)'}`,
            color: actionMsg.ok ? '#16a34a' : '#dc2626',
          }}>
            {actionMsg.text}
          </div>
        )}
      </div>

      {/* Steps card */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderTop: '3px solid var(--accent)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          fontFamily: 'var(--font-display)', marginBottom: 4,
        }}>
          {t('checkin.howToUse')}
        </div>

        {STEPS.map(({ icon, key }, i) => (
          <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(201,151,58,0.10)',
              border: '1.5px solid rgba(201,151,58,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>
              {icon}
            </div>
            <div>
              <div style={{
                fontSize: 12, fontWeight: 700, color: 'var(--accent)',
                fontFamily: 'var(--font-display)', marginBottom: 2,
              }}>
                {t('checkin.stepLabel', { n: i + 1 })}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {t(`checkin.${key}`)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action type legend */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: '20px 24px',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          fontFamily: 'var(--font-display)', marginBottom: 14,
        }}>
          {t('checkin.actionTypes')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { color: '#16a34a', labelKey: 'scan.checkin' },
            { color: '#d97706', labelKey: 'scan.breakStart' },
            { color: '#2563eb', labelKey: 'scan.breakEnd' },
            { color: '#dc2626', labelKey: 'scan.checkout' },
          ].map(({ color, labelKey }) => (
            <div key={labelKey} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              borderRadius: 10,
              background: `${color}12`,
              border: `1px solid ${color}30`,
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: color, flexShrink: 0,
              }} />
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                letterSpacing: 0.3,
              }}>
                {t(labelKey)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Attendance history — only shown when presenze module is enabled */}
      {permissions['presenze'] !== false && <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: '20px 24px',
      }}>
        {/* Header + filter pills */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            fontFamily: 'var(--font-display)',
          }}>
            {t('checkin.myHistory')}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['7', '30'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: filter === f ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                  background: filter === f ? 'var(--primary)' : 'var(--surface)',
                  color: filter === f ? '#fff' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-display)',
                  transition: 'all 0.15s',
                }}
              >
                {t(f === '7' ? 'checkin.filterLast7' : 'checkin.filterLast30')}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <Spinner size="md" color="var(--accent)" />
          </div>
        )}

        {error && !loading && (
          <div style={{ color: 'var(--danger)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
            {error}
          </div>
        )}

        {!loading && !error && grouped.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            {t('checkin.noHistory')}
          </div>
        )}

        {!loading && !error && grouped.map(({ date, items }) => (
          <div key={date} style={{ marginBottom: 16 }}>
            {/* Date header */}
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              fontFamily: 'var(--font-display)',
              marginBottom: 8,
              paddingBottom: 4,
              borderBottom: '1px solid var(--border-light)',
            }}>
              {formatDate(date)}
            </div>

            {/* Events for this day */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((ev) => {
                const rawTime = (ev as any).event_time ?? ev.eventTime;
                const rawType = (ev as any).event_type ?? ev.eventType;
                const storeName = (ev as any).store_name ?? ev.storeName;
                const color = EVENT_COLORS[rawType] ?? '#6b7280';
                const labelKey = rawType === 'checkin' ? 'scan.checkin'
                  : rawType === 'break_start' ? 'scan.breakStart'
                  : rawType === 'break_end' ? 'scan.breakEnd'
                  : 'scan.checkout';
                return (
                  <div key={ev.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '9px 12px',
                    borderRadius: 8,
                    background: `${color}0d`,
                    border: `1px solid ${color}28`,
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: color, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-display)',
                      }}>
                        {t(labelKey)}
                      </span>
                      {storeName && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                          {storeName}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {formatTime(rawTime)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}
