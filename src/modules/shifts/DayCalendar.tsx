import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, CalendarDays, Moon, Palmtree, Thermometer, Coffee, Store as StoreIcon } from 'lucide-react';
import { Shift } from '../../api/shifts';
import { LeaveBlock } from '../../api/leave';
import { TransferAssignment } from '../../api/transfers';
import { getAvatarUrl } from '../../api/client';

interface DayCalendarProps {
  shifts: Shift[];
  date: Date;
  onShiftClick: (shift: Shift) => void;
  onSlotClick: (userId: number, date: string) => void;
  canEdit: boolean;
  leaveBlocks?: LeaveBlock[];
  transferBlocks?: TransferAssignment[];
}

const START_HOUR = 7;   // 07:00
const END_HOUR   = 22;  // 22:00
const TOTAL_MINS = (END_HOUR - START_HOUR) * 60;

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function pct(mins: number): string {
  return `${Math.max(0, Math.min(100, ((mins - START_HOUR * 60) / TOTAL_MINS) * 100)).toFixed(3)}%`;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

const HOUR_LABELS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => `${String(START_HOUR + i).padStart(2, '0')}:00`
);

const STATUS_META: Record<string, {
  bg: string; text: string; border: string; abbr: string;
  labelKey: string; labelFb: string; descKey: string; descFb: string;
}> = {
  scheduled: {
    bg: 'linear-gradient(135deg,#1E4A7A,#0D2137)', text: '#fff', border: '#3a7bd5', abbr: 'P',
    labelKey: 'shifts.status.scheduled', labelFb: 'Pianificato',
    descKey: 'shifts.status.scheduledDesc', descFb: 'Turno pianificato, in attesa di conferma',
  },
  confirmed: {
    bg: 'linear-gradient(135deg,#166534,#15803d)', text: '#fff', border: '#16a34a', abbr: 'C',
    labelKey: 'shifts.status.confirmed', labelFb: 'Confermato',
    descKey: 'shifts.status.confirmedDesc', descFb: 'Turno confermato e attivo',
  },
  cancelled: {
    bg: 'rgba(0,0,0,0.05)', text: '#9ca3af', border: '#e5e7eb', abbr: 'A',
    labelKey: 'shifts.status.cancelled', labelFb: 'Annullato',
    descKey: 'shifts.status.cancelledDesc', descFb: 'Turno annullato',
  },
};

const OFF_DAY_META = {
  bg: 'rgba(241,245,249,0.94)',
  color: '#475569',
  border: 'rgba(148,163,184,0.42)',
  leftBorder: 'rgba(100,116,139,0.62)',
};

function transferVisualMeta(status: TransferAssignment['status']): {
  bg: string;
  border: string;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  badgeColor: string;
} {
  if (status === 'completed') {
    return {
      bg: 'rgba(30,64,175,0.1)',
      border: 'rgba(30,64,175,0.28)',
      color: '#1e40af',
      badgeBg: 'rgba(239,246,255,0.95)',
      badgeBorder: 'rgba(30,64,175,0.34)',
      badgeColor: '#1e3a8a',
    };
  }
  if (status === 'cancelled') {
    return {
      bg: 'rgba(239,68,68,0.08)',
      border: 'rgba(185,28,28,0.25)',
      color: '#b91c1c',
      badgeBg: 'rgba(254,242,242,0.95)',
      badgeBorder: 'rgba(185,28,28,0.32)',
      badgeColor: '#991b1b',
    };
  }
  return {
    bg: 'rgba(13,148,136,0.1)',
    border: 'rgba(15,118,110,0.25)',
    color: '#115e59',
    badgeBg: 'rgba(240,253,250,0.95)',
    badgeBorder: 'rgba(15,118,110,0.32)',
    badgeColor: '#0f766e',
  };
}

export default function DayCalendar({ shifts, date, onShiftClick, onSlotClick, canEdit, leaveBlocks, transferBlocks }: DayCalendarProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';
  const dateStr = formatDate(date);
  const today = formatDate(new Date());
  const isToday = dateStr === today;

  // Group shifts by user
  const userMap = new Map<number, { name: string; surname: string; avatarFilename: string | null; shifts: Shift[] }>();
  for (const s of shifts) {
    const key = s.date.split('T')[0];
    if (key !== dateStr) continue;
    if (!userMap.has(s.userId)) {
      userMap.set(s.userId, {
        name: s.userName,
        surname: s.userSurname,
        avatarFilename: s.userAvatarFilename ?? null,
        shifts: [],
      });
    }
    const userEntry = userMap.get(s.userId)!;
    if (!userEntry.avatarFilename && s.userAvatarFilename) {
      userEntry.avatarFilename = s.userAvatarFilename;
    }
    userEntry.shifts.push(s);
  }

  // Include transfer-only users for the selected day (no shifts required to render row).
  if (transferBlocks) {
    for (const tb of transferBlocks) {
      if (tb.startDate > dateStr || tb.endDate < dateStr) continue;
      if (!userMap.has(tb.userId)) {
        userMap.set(tb.userId, {
          name: tb.userName,
          surname: tb.userSurname,
          avatarFilename: tb.userAvatarFilename ?? null,
          shifts: [],
        });
      }
    }
  }

  const users = Array.from(userMap.entries()).sort((a, b) => a[1].surname.localeCompare(b[1].surname));

  const nowMins = (() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  })();
  const showNowLine = isToday && nowMins >= START_HOUR * 60 && nowMins <= END_HOUR * 60;

  return (
    <div style={{ overflowX: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Day header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: isToday ? 'var(--accent)' : 'var(--primary)',
          color: '#fff', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1, fontFamily: 'var(--font-display)' }}>
            {date.getDate()}
          </span>
          <span style={{ fontSize: 9, opacity: 0.8, fontWeight: 600, letterSpacing: 0.5 }}>
            {date.toLocaleDateString(locale, { month: 'short' }).toUpperCase()}
          </span>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--primary)' }}>
            {date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {shifts.filter(s => s.date.split('T')[0] === dateStr && s.status !== 'cancelled').length > 0
              ? `${shifts.filter(s => s.date.split('T')[0] === dateStr && s.status !== 'cancelled').length} ${t('shifts.shiftsLoaded')}`
              : t('shifts.noShiftsToday')}
          </div>
        </div>
      </div>

      {users.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ marginBottom: 10, opacity: 0.25, display: 'flex', justifyContent: 'center' }}><CalendarDays size={32} /></div>
          <div style={{ fontWeight: 600 }}>{t('shifts.noShiftsToday')}</div>
          {canEdit && (
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {t('shifts.clickToAdd')}
            </div>
          )}
        </div>
      ) : (
        <div style={{ minWidth: 700 }}>
          {/* Hour ruler */}
          <div style={{ display: 'flex', paddingLeft: 190, borderBottom: '1px solid var(--border)' }}>
            {HOUR_LABELS.map((h, i) => (
              <div key={h} style={{
                flex: i === HOUR_LABELS.length - 1 ? '0 0 0' : 1,
                fontSize: 10, color: 'var(--text-muted)', fontWeight: 600,
                padding: '4px 0', borderLeft: '1px solid var(--border)',
                paddingLeft: 4, fontFamily: 'var(--font-display)',
              }}>
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          {users.map(([userId, userData], rowIdx) => {
            const rowLeave = leaveBlocks?.find(
              (lb) => lb.userId === userId && dateStr >= lb.startDate && dateStr <= lb.endDate
            ) ?? null;
            const transferPriority: Record<TransferAssignment['status'], number> = {
              active: 0,
              completed: 1,
              cancelled: 2,
            };
            const rowTransfer = (transferBlocks ?? [])
              .filter((tb) => tb.userId === userId && dateStr >= tb.startDate && dateStr <= tb.endDate)
              .sort((a, b) => {
                if (transferPriority[a.status] !== transferPriority[b.status]) {
                  return transferPriority[a.status] - transferPriority[b.status];
                }
                return b.id - a.id;
              })[0] ?? null;
            const isVacation = rowLeave?.leaveType === 'vacation';
            const isPending = rowLeave ? rowLeave.status !== 'hr_approved' : false;
            const transferTargetStoreId = rowTransfer?.targetStoreId ?? null;
            const transferLaneShifts = transferTargetStoreId == null
              ? []
              : userData.shifts.filter((shift) => shift.storeId === transferTargetStoreId || shift.assignmentId != null);
            const originLaneShifts = transferTargetStoreId == null
              ? userData.shifts
              : userData.shifts.filter((shift) => !(shift.storeId === transferTargetStoreId || shift.assignmentId != null));
            const showDualLane = transferTargetStoreId != null;
            const avatarInitials = `${(userData.name || '').slice(0, 1)}${(userData.surname || '').slice(0, 1)}`.toUpperCase();
            const avatarUrl = getAvatarUrl(userData.avatarFilename);
            const fullName = `${userData.name} ${userData.surname}`.trim();
            const rowStoreNames = Array.from(new Set(userData.shifts.map((s) => s.storeName).filter(Boolean))) as string[];
            const originStoreName = rowTransfer?.originStoreName ?? rowStoreNames[0] ?? t('transfers.table.origin', 'Origine');
            const targetStoreName = rowTransfer?.targetStoreName ?? t('transfers.table.target', 'Destinazione');
            const transferVm = transferVisualMeta(rowTransfer?.status ?? 'active');
            const rowHasOffDay = userData.shifts.some((shift) => shift.isOffDay);

            const renderIdentityRow = (opts: {
              storeName: string;
              isTransfer: boolean;
              status?: TransferAssignment['status'];
            }) => {
              const isTransfer = opts.isTransfer;
              const status = opts.status ?? 'active';
              const statusVisual = isTransfer ? transferVisualMeta(status) : null;
              return (
                <div style={{
                  minHeight: 56,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 8,
                  padding: '5px 8px',
                  background: isTransfer ? statusVisual?.bg : 'rgba(13,33,55,0.03)',
                  borderTop: isTransfer ? `1px dashed ${statusVisual?.border}` : 'none',
                }}>
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={fullName}
                      style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg,var(--primary),var(--accent))',
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>
                      {avatarInitials}
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }} title={fullName}>
                      {fullName}
                    </div>
                    <div style={{
                      marginTop: 3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 7px',
                      borderRadius: 999,
                      background: isTransfer ? statusVisual?.bg : 'rgba(13,33,55,0.08)',
                      border: `1px solid ${isTransfer ? statusVisual?.border : 'rgba(13,33,55,0.16)'}`,
                      color: isTransfer ? statusVisual?.color : 'var(--text-secondary)',
                      fontSize: 9,
                      fontWeight: 800,
                      lineHeight: 1.2,
                      width: '100%',
                      minWidth: 0,
                    }}>
                      <StoreIcon size={10} strokeWidth={2.3} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }} title={opts.storeName}>
                        {opts.storeName}
                      </span>
                    </div>
                  </div>
                </div>
              );
            };

            const renderShiftBlocks = (laneShifts: Shift[], laneKey: string) => {
              const offDayShifts = laneShifts.filter((shift) => shift.isOffDay);
              const workingShifts = laneShifts.filter((shift) => !shift.isOffDay);
              return (
                <>
                  {offDayShifts.map((shift, idx) => (
                    <div
                      key={`off-${shift.id}-${laneKey}`}
                      onClick={(e) => { e.stopPropagation(); onShiftClick(shift); }}
                      title={t('shifts.form.offDay', 'Off day')}
                      style={{
                        position: 'absolute',
                        top: 5 + (idx * 34),
                        left: 6,
                        zIndex: 9,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 8px 4px 6px',
                        borderRadius: 8,
                        borderTop: `1px solid ${OFF_DAY_META.border}`,
                        borderRight: `1px solid ${OFF_DAY_META.border}`,
                        borderBottom: `1px solid ${OFF_DAY_META.border}`,
                        borderLeft: `3px solid ${OFF_DAY_META.leftBorder}`,
                        background: OFF_DAY_META.bg,
                        color: OFF_DAY_META.color,
                        fontSize: 10,
                        fontWeight: 800,
                        lineHeight: 1.2,
                        cursor: 'pointer',
                        maxWidth: 'calc(100% - 12px)',
                      }}
                    >
                      <Moon size={11} strokeWidth={2.4} />
                      <span style={{ overflow: 'hidden', lineHeight: 1.25 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t('shifts.form.offDay', 'Off day')}
                        </span>
                        {(shift.startTime.slice(0, 5) !== '00:00' || shift.endTime.slice(0, 5) !== '00:01') && (
                          <span style={{
                            display: 'block',
                            fontSize: 9,
                            color: '#64748b',
                            textDecoration: 'line-through',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {t('shifts.status.cancelled', 'Cancelled')} · {shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                  {workingShifts.map((shift) => {
              const colors = STATUS_META[shift.status] ?? STATUS_META.scheduled;
              const isCancelled = shift.status === 'cancelled';

              const mainRange = `${shift.startTime.slice(0, 5)}–${shift.endTime.slice(0, 5)}`;
              const breakInfo = shift.breakType === 'flexible' && shift.breakMinutes
                ? ` · ${t('shifts.form.breakMinutes')}: ${shift.breakMinutes} min (${t('shifts.form.breakType_flexible')})`
                : shift.breakStart && shift.breakEnd
                ? ` · ${t('shifts.form.breakStart')}: ${shift.breakStart.slice(0, 5)}–${shift.breakEnd.slice(0, 5)}`
                : '';
              const splitInfo = shift.isSplit && shift.splitStart2 && shift.splitEnd2
                ? ` · ${t('shifts.form.isSplit')}: ${shift.splitStart2.slice(0, 5)}–${shift.splitEnd2.slice(0, 5)}`
                : '';
              const hoursInfo = shift.shiftHours ? ` (${shift.shiftHours}h)` : '';
              const shiftTitle = `${t(colors.labelKey, colors.labelFb)} — ${mainRange}${hoursInfo}${breakInfo}${splitInfo}`;

              const renderBlock = (
                blockStart: string,
                blockEnd: string,
                isSecondBlock: boolean,
                withBreak: boolean,
              ) => {
                const sMins = timeToMins(blockStart);
                const eMins = timeToMins(blockEnd);
                const blockLeft = pct(sMins);
                const blockDurMins = Math.max(1, eMins - sMins);
                const blockWidth = `${Math.max(0.5, (blockDurMins / TOTAL_MINS) * 100).toFixed(3)}%`;

                let hasBreakOverlay = false;
                let breakOverlayLeft = '0%';
                let breakOverlayWidth = '0%';
                if (withBreak && shift.breakStart && shift.breakEnd) {
                  const bsMins = timeToMins(shift.breakStart);
                  const beMins = timeToMins(shift.breakEnd);
                  if (bsMins >= sMins && beMins <= eMins) {
                    hasBreakOverlay = true;
                    breakOverlayLeft = `${(((bsMins - sMins) / blockDurMins) * 100).toFixed(2)}%`;
                    breakOverlayWidth = `${(((beMins - bsMins) / blockDurMins) * 100).toFixed(2)}%`;
                  }
                }

                const blockKey = `${shift.id}-${isSecondBlock ? 'b' : 'a'}-${laneKey}`;
                const transferStatus = laneKey === 'transfer' && rowTransfer && !isSecondBlock
                  ? rowTransfer.status
                  : null;
                const transferStatusVisual = transferStatus ? transferVisualMeta(transferStatus) : null;
                const transferStatusStore = rowTransfer?.targetStoreName ?? targetStoreName;

                return (
                  <div
                    key={blockKey}
                    onClick={(e) => { e.stopPropagation(); onShiftClick(shift); }}
                    title={shiftTitle}
                    style={{
                      position: 'absolute',
                      left: blockLeft,
                      width: blockWidth,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      height: 40,
                      background: colors.bg,
                      color: colors.text,
                      borderRadius: 6,
                      border: isSecondBlock ? `1.5px dashed ${colors.border}` : `1px solid ${colors.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '0 6px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: !isCancelled ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                      textDecoration: isCancelled ? 'line-through' : 'none',
                      opacity: isCancelled ? 0.55 : isSecondBlock ? 0.88 : 1,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      transition: 'opacity 0.15s, filter 0.15s',
                      zIndex: 5,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.12)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ''; }}
                  >
                    {hasBreakOverlay && (
                      <div
                        style={{
                          position: 'absolute',
                          left: breakOverlayLeft,
                          width: breakOverlayWidth,
                          top: 0,
                          bottom: 0,
                          background: 'repeating-linear-gradient(45deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.22) 3px, rgba(0,0,0,0.22) 4px)',
                          borderLeft: '1px solid rgba(255,255,255,0.3)',
                          borderRight: '1px solid rgba(255,255,255,0.3)',
                          pointerEvents: 'none',
                          zIndex: 1,
                        }}
                      />
                    )}

                    {transferStatus && transferStatusVisual && (
                      <span style={{
                        position: 'absolute',
                        top: 2,
                        right: 3,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '1px 4px',
                        borderRadius: 4,
                        background: transferStatusVisual.badgeBg,
                        border: `1px solid ${transferStatusVisual.badgeBorder}`,
                        color: transferStatusVisual.badgeColor,
                        fontSize: 8,
                        fontWeight: 800,
                        lineHeight: 1.2,
                        textTransform: 'uppercase',
                        zIndex: 3,
                        maxWidth: 'calc(100% - 8px)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        <ArrowLeftRight size={9} strokeWidth={2.4} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, maxWidth: 72 }} title={transferStatusStore}>{transferStatusStore}</span>
                        {t(`transfers.status.${transferStatus}`, transferStatus)}
                      </span>
                    )}

                    <span style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      background: isSecondBlock ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.18)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      lineHeight: 1,
                      color: isCancelled ? '#9ca3af' : 'rgba(255,255,255,0.9)',
                      position: 'relative',
                      zIndex: 2,
                      flexShrink: 0,
                    }}>
                      {isSecondBlock ? '2' : colors.abbr}
                    </span>

                    <span style={{ position: 'relative', zIndex: 2, lineHeight: 1.15, overflow: 'hidden' }}>
                      {blockStart.slice(0, 5)}–{blockEnd.slice(0, 5)}
                      {!isSecondBlock && shift.shiftHours && (
                        <span style={{ marginLeft: 3, opacity: 0.75, fontSize: '0.65rem' }}>({shift.shiftHours}h)</span>
                      )}
                      {hasBreakOverlay && (
                        <span style={{
                          marginLeft: 5,
                          opacity: 0.7,
                          fontSize: 9,
                          position: 'relative',
                          zIndex: 2,
                          background: 'rgba(255,255,255,0.12)',
                          borderRadius: 3,
                          padding: '1px 4px',
                        }}>
                          <Coffee size={9} strokeWidth={2.5} /> {shift.breakStart!.slice(0, 5)}
                        </span>
                      )}
                      {!hasBreakOverlay && !isSecondBlock && shift.breakType === 'flexible' && shift.breakMinutes && (
                        <span style={{
                          marginLeft: 5,
                          opacity: 0.7,
                          fontSize: 9,
                          position: 'relative',
                          zIndex: 2,
                          background: 'rgba(255,255,255,0.12)',
                          borderRadius: 3,
                          padding: '1px 4px',
                        }}>
                          <Coffee size={9} strokeWidth={2.5} /> {shift.breakMinutes}m flex
                        </span>
                      )}
                    </span>
                  </div>
                );
              };

              if (shift.isSplit && shift.splitStart2 && shift.splitEnd2) {
                return (
                  <React.Fragment key={`${shift.id}-${laneKey}`}>
                    {renderBlock(shift.startTime, shift.endTime, false, true)}
                    {renderBlock(shift.splitStart2, shift.splitEnd2, true, false)}
                  </React.Fragment>
                );
              }

              return renderBlock(shift.startTime, shift.endTime, false, true);
                  })}
                </>
              );
            };

            return (
            <div
              key={userId}
              style={{
                display: 'flex', alignItems: 'stretch',
                borderBottom: '1px solid var(--border)',
                background: rowIdx % 2 === 0 ? 'var(--surface)' : 'var(--background)',
                minHeight: showDualLane ? 114 : 60,
              }}
            >
              {/* Name */}
              <div style={{
                width: 190,
                flexShrink: 0,
                padding: 0,
                fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                borderRight: '1px solid var(--border)', lineHeight: 1.3,
                background: rowLeave
                  ? (isVacation ? 'rgba(219,234,254,0.28)' : 'rgba(255,237,213,0.28)')
                  : undefined,
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
              }}>
                {showDualLane ? (
                  <div style={{ display: 'flex', flexDirection: 'column', minHeight: 112 }}>
                    {renderIdentityRow({ storeName: originStoreName, isTransfer: false })}
                    {renderIdentityRow({ storeName: targetStoreName, isTransfer: true, status: rowTransfer?.status })}
                  </div>
                ) : (
                  renderIdentityRow({ storeName: rowStoreNames[0] ?? originStoreName, isTransfer: false })
                )}
                {rowLeave && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    margin: '5px 8px 6px',
                    padding: '3px 8px 3px 6px',
                    borderRadius: 4,
                    background: isVacation ? 'rgba(219,234,254,0.9)' : 'rgba(255,237,213,0.9)',
                    borderLeft: `3px solid ${isVacation
                      ? (isPending ? 'rgba(37,99,235,0.45)' : '#2563eb')
                      : (isPending ? 'rgba(234,88,12,0.45)' : '#ea580c')}`,
                    borderTop: `1px ${isPending ? 'dashed' : 'solid'} ${isVacation ? 'rgba(37,99,235,0.18)' : 'rgba(234,88,12,0.18)'}`,
                    borderRight: `1px ${isPending ? 'dashed' : 'solid'} ${isVacation ? 'rgba(37,99,235,0.18)' : 'rgba(234,88,12,0.18)'}`,
                    borderBottom: `1px ${isPending ? 'dashed' : 'solid'} ${isVacation ? 'rgba(37,99,235,0.18)' : 'rgba(234,88,12,0.18)'}`,
                    fontSize: 10, fontWeight: 700,
                    color: isVacation ? '#1e40af' : '#9a3412',
                    opacity: isPending ? 0.75 : 1,
                  }}>
                    {isVacation ? <Palmtree size={11} strokeWidth={2.5} /> : <Thermometer size={11} strokeWidth={2.5} />}
                    <span>{isVacation ? t('leave.type_vacation') : t('leave.type_sick')}</span>
                    {isPending && (
                      <span style={{
                        fontSize: 8.5, fontWeight: 700,
                        background: 'rgba(255,255,255,0.7)',
                        padding: '1px 3px', borderRadius: 3, lineHeight: 1.4,
                        color: isVacation ? '#3b82f6' : '#f97316',
                      }}>{t('leave.pending_short')}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div
                style={{
                  flex: 1,
                  position: 'relative',
                  minHeight: showDualLane ? 114 : 60,
                  cursor: canEdit && !rowHasOffDay ? 'pointer' : 'default',
                }}
                onClick={() => canEdit && !rowHasOffDay && onSlotClick(userId, dateStr)}
              >
                {/* Leave timeline overlay — clean gradient wash */}
                {rowLeave && (
                  <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
                    background: isVacation
                      ? 'linear-gradient(90deg, rgba(219,234,254,0.45) 0%, rgba(219,234,254,0.12) 100%)'
                      : 'linear-gradient(90deg, rgba(255,237,213,0.45) 0%, rgba(255,237,213,0.12) 100%)',
                    borderTop: `2px solid ${isVacation
                      ? (isPending ? 'rgba(37,99,235,0.2)' : 'rgba(37,99,235,0.38)')
                      : (isPending ? 'rgba(234,88,12,0.2)' : 'rgba(234,88,12,0.38)')}`,
                    opacity: isPending ? 0.65 : 1,
                  }} />
                )}
                {showDualLane ? (
                  <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 2, minHeight: 114 }}>
                    <div style={{ position: 'relative', minHeight: 56, background: 'rgba(13,33,55,0.02)' }}>
                      {HOUR_LABELS.slice(0, -1).map((_, i) => (
                        <div key={`origin-grid-${i}`} style={{
                          position: 'absolute', top: 0, bottom: 0,
                          left: `${(i / (HOUR_LABELS.length - 1)) * 100}%`,
                          borderLeft: '1px solid var(--border)',
                          opacity: 0.5, pointerEvents: 'none',
                        }} />
                      ))}
                      {showNowLine && (
                        <div style={{
                          position: 'absolute', top: 0, bottom: 0,
                          left: pct(nowMins), width: 2, background: 'var(--accent)', zIndex: 10, pointerEvents: 'none',
                        }} />
                      )}
                      {renderShiftBlocks(originLaneShifts, 'origin')}
                      {originLaneShifts.length === 0 && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-disabled)' }}>
                          —
                        </div>
                      )}
                    </div>

                    <div style={{
                      position: 'relative',
                      minHeight: 56,
                      borderTop: `1px dashed ${transferVm.border}`,
                      background: transferVm.bg,
                    }}>
                      {HOUR_LABELS.slice(0, -1).map((_, i) => (
                        <div key={`transfer-grid-${i}`} style={{
                          position: 'absolute', top: 0, bottom: 0,
                          left: `${(i / (HOUR_LABELS.length - 1)) * 100}%`,
                          borderLeft: '1px solid var(--border)',
                          opacity: 0.5, pointerEvents: 'none',
                        }} />
                      ))}
                      {showNowLine && (
                        <div style={{
                          position: 'absolute', top: 0, bottom: 0,
                          left: pct(nowMins), width: 2, background: 'var(--accent)', zIndex: 10, pointerEvents: 'none',
                        }} />
                      )}
                      {renderShiftBlocks(transferLaneShifts, 'transfer')}
                      {transferLaneShifts.length === 0 && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-disabled)' }}>
                          —
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {HOUR_LABELS.slice(0, -1).map((_, i) => (
                      <div key={i} style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: `${(i / (HOUR_LABELS.length - 1)) * 100}%`,
                        borderLeft: '1px solid var(--border)',
                        opacity: 0.5, pointerEvents: 'none',
                      }} />
                    ))}
                    {showNowLine && (
                      <div style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: pct(nowMins),
                        width: 2,
                        background: 'var(--accent)',
                        zIndex: 10,
                        pointerEvents: 'none',
                      }} />
                    )}
                    {renderShiftBlocks(originLaneShifts, 'single')}
                  </>
                )}
              </div>
            </div>
          ); })}
        </div>
      )}

      {/* Legend */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface-warm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
            letterSpacing: 0.6, textTransform: 'uppercase', marginRight: 4, flexShrink: 0,
          }}>
            {t('shifts.legend')}:
          </span>
          {Object.entries(STATUS_META).map(([status, meta]) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px 3px 5px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                background: meta.bg, color: meta.text,
                border: `1px solid ${meta.border}`,
                boxShadow: status !== 'cancelled' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                textDecoration: status === 'cancelled' ? 'line-through' : 'none',
                opacity: status === 'cancelled' ? 0.7 : 1,
              }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                  background: 'rgba(255,255,255,0.18)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.6rem', fontWeight: 800,
                  color: status === 'cancelled' ? '#9ca3af' : 'rgba(255,255,255,0.9)',
                }}>
                  {meta.abbr}
                </span>
                {t(meta.labelKey, meta.labelFb)}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {t(meta.descKey, meta.descFb)}
              </span>
              <span style={{ color: 'var(--border)', fontSize: 14, lineHeight: 1 }}>·</span>
            </div>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 8px 3px 6px', borderRadius: 6, fontSize: 11, fontWeight: 800,
              background: OFF_DAY_META.bg, color: OFF_DAY_META.color,
              borderTop: `1px solid ${OFF_DAY_META.border}`,
              borderRight: `1px solid ${OFF_DAY_META.border}`,
              borderBottom: `1px solid ${OFF_DAY_META.border}`,
              borderLeft: `3px solid ${OFF_DAY_META.leftBorder}`,
            }}>
              <Moon size={11} strokeWidth={2.4} />
              {t('shifts.form.offDay', 'Off day')}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {t('shifts.offDayLegend', 'Date marked as non-working day')}
            </span>
            <span style={{ color: 'var(--border)', fontSize: 14, lineHeight: 1 }}>·</span>
          </div>

          {/* Break legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 8px 3px 5px', borderRadius: 5, fontSize: 11, fontWeight: 700,
              background: 'linear-gradient(135deg,#1E4A7A,#0D2137)',
              color: '#fff', border: '1px solid #3a7bd5',
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              overflow: 'hidden', position: 'relative',
            }}>
              {/* Hatched section preview */}
              <span style={{
                display: 'inline-block', width: 18, height: 12, borderRadius: 2,
                background: 'repeating-linear-gradient(45deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.28) 3px, rgba(0,0,0,0.28) 4px)',
                border: '1px solid rgba(255,255,255,0.25)',
                flexShrink: 0,
              }} />
              <Coffee size={11} strokeWidth={2.5} /> {t('shifts.form.breakStart')}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {t('shifts.breakLegend')}
            </span>
            <span style={{ color: 'var(--border)', fontSize: 14, lineHeight: 1 }}>·</span>
          </div>

          {/* Split shift legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px 3px 5px', borderRadius: 5, fontSize: 11, fontWeight: 700,
              background: 'linear-gradient(135deg,#1E4A7A,#0D2137)',
              color: '#fff',
              border: '1.5px dashed #3a7bd5',
              opacity: 0.88,
            }}>
              <span style={{
                width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                background: 'rgba(255,255,255,0.22)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.9)',
              }}>2</span>
              {t('shifts.form.isSplit')}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {t('shifts.splitLegend')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
