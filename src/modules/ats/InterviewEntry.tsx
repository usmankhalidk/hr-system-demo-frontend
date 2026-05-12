import { useState } from 'react';
import { Phone, Users, MapPin, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Interview } from './atsCalendarUtils';
import { getAvatarUrl } from '../../api/client';
import {
  INTERVIEW_STATUS_COLORS,
  CONFLICT_COLORS,
  initials,
  fullName,
  formatTime,
  formatDuration,
} from './atsCalendarUtils';

interface InterviewEntryProps {
  interview: Interview;
  variant: 'weekly' | 'monthly';
  onClick: () => void;
  hasConflict?: boolean;
  showTooltip?: boolean;
}

const INTERVIEW_TYPE_ICONS = {
  phone: Phone,
  in_person: Users,
};

export default function InterviewEntry({
  interview,
  variant,
  onClick,
  hasConflict = false,
  showTooltip = true,
}: InterviewEntryProps) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(false);

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsHovered(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // If card is lower than 55% of the viewport height, display tooltip on top of the card
    if (rect.top > viewportHeight * 0.55) {
      setIsNearBottom(true);
    } else {
      setIsNearBottom(false);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsNearBottom(false);
  };

  const colors = INTERVIEW_STATUS_COLORS[interview.status];
  const Icon = INTERVIEW_TYPE_ICONS[interview.interviewType];
  const candidateFullName = fullName(interview.candidateName || '', interview.candidateSurname || '');
  const interviewerFullName = interview.interviewerName
    ? fullName(interview.interviewerName, interview.interviewerSurname || '')
    : null;
  const candidateInitials = initials(interview.candidateName || '', interview.candidateSurname || '');
  const avatarUrl = getAvatarUrl(interview.candidateAvatarFilename);

  const isCancelled = interview.status === 'cancelled';

  // Weekly variant: larger, more detailed
  if (variant === 'weekly') {
    return (
      <div
        style={{ position: 'relative' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: 6,
            border: hasConflict
              ? `1px solid ${CONFLICT_COLORS.border}`
              : `1px solid ${colors.border}`,
            borderLeftWidth: 5,
            borderLeftStyle: 'solid',
            borderLeftColor: hasConflict ? CONFLICT_COLORS.border : colors.leftBorder,
            background: hasConflict ? CONFLICT_COLORS.bg : colors.bg,
            color: hasConflict ? CONFLICT_COLORS.text : colors.text,
            padding: '3px 8px',
            fontSize: '0.65rem',
            fontWeight: 800,
            lineHeight: 1,
            cursor: 'pointer',
            transition: 'transform 0.1s, filter 0.15s',
            overflow: 'hidden',
            opacity: isCancelled ? 0.6 : 1,
            textDecoration: isCancelled ? 'line-through' : 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)';
            e.currentTarget.style.filter = 'brightness(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.filter = '';
          }}
        >
          <Icon size={11} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {formatTime(interview.scheduledTime)} • {candidateFullName}
          </span>
          {hasConflict && <AlertTriangle size={10} strokeWidth={2.5} style={{ flexShrink: 0 }} />}
        </div>

        {/* Tooltip */}
        {showTooltip && isHovered && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              top: isNearBottom ? 'auto' : '100%',
              bottom: isNearBottom ? '100%' : 'auto',
              marginTop: isNearBottom ? 0 : 4,
              marginBottom: isNearBottom ? 4 : 0,
              minWidth: 190,
              maxWidth: 240,
              borderRadius: 8,
              border: '1px solid rgba(148,163,184,0.44)',
              background: '#ffffff',
              boxShadow: '0 10px 25px rgba(15,23,42,0.15)',
              padding: '8px 10px',
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          >
            {/* Candidate */}
            <div style={{ marginBottom: 5 }}>
              <div
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 2,
                }}
              >
                {t('ats.candidate', 'Candidate')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={candidateFullName}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '1px solid rgba(148,163,184,0.45)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #1e3a5f, #3a7bd5)',
                      color: '#fff',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      border: '1px solid rgba(148,163,184,0.45)',
                    }}
                  >
                    {candidateInitials}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {candidateFullName}
                  </div>
                </div>
              </div>
            </div>

            {/* Position */}
            <div style={{ marginBottom: 5 }}>
              <div
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 2,
                }}
              >
                {t('ats.position', 'Position')}
              </div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {interview.positionTitle}
              </div>
            </div>

            {/* Interview Details */}
            <div style={{ marginBottom: 5 }}>
              <div
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: 2,
                }}
              >
                {t('ats.interviewDetails', 'Interview Details')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Icon size={12} strokeWidth={2.5} color="var(--text-secondary)" />
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {t(`ats.interviewType.${interview.interviewType}`, interview.interviewType)}
                </span>
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                {formatTime(interview.scheduledTime)} • {formatDuration(interview.durationMinutes)}
              </div>
            </div>

            {/* Interviewer */}
            {interviewerFullName && (
              <div style={{ marginBottom: 5 }}>
                <div
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: 2,
                  }}
                >
                  {t('ats.interviewer', 'Interviewer')}
                </div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {interviewerFullName}
                </div>
              </div>
            )}

            {/* Location */}
            {interview.location && (
              <div style={{ marginBottom: 5 }}>
                <div
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: 2,
                  }}
                >
                  {t('ats.location', 'Location')}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  {interview.location}
                </div>
              </div>
            )}

            {/* Notes Preview */}
            {interview.notes && (
              <div>
                <div
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: 2,
                  }}
                >
                  {t('ats.notes', 'Notes')}
                </div>
                <div
                  style={{
                    fontSize: '0.62rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.3,
                    maxHeight: 50,
                    overflow: 'hidden',
                  }}
                >
                  {interview.notes.slice(0, 100)}
                  {interview.notes.length > 100 && '...'}
                </div>
              </div>
            )}

            {/* Conflict Warning */}
            {hasConflict && (
              <div
                style={{
                  marginTop: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: 'rgba(251,191,36,0.12)',
                  border: '1px solid #f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <AlertTriangle size={14} color="#92400e" strokeWidth={2.5} />
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#92400e' }}>
                  {t('ats.scheduleConflict', 'Schedule conflict detected')}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Monthly variant: compact, badge-like
  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          borderRadius: 6,
          border: hasConflict
            ? `1px solid ${CONFLICT_COLORS.border}`
            : `1px solid ${colors.border}`,
          borderLeftWidth: 5,
          borderLeftStyle: 'solid',
          borderLeftColor: hasConflict ? CONFLICT_COLORS.border : colors.leftBorder,
          background: hasConflict ? CONFLICT_COLORS.bg : colors.bg,
          color: hasConflict ? CONFLICT_COLORS.text : colors.text,
          padding: '3px 8px',
          fontSize: '0.65rem',
          fontWeight: 800,
          lineHeight: 1,
          cursor: 'pointer',
          transition: 'transform 0.1s',
          overflow: 'hidden',
          opacity: isCancelled ? 0.6 : 1,
          textDecoration: isCancelled ? 'line-through' : 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.02)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <Icon size={11} strokeWidth={2.5} style={{ flexShrink: 0 }} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {formatTime(interview.scheduledTime)} • {candidateFullName}
        </span>
        {hasConflict && <AlertTriangle size={10} strokeWidth={2.5} style={{ flexShrink: 0 }} />}
      </div>

      {/* Simplified tooltip for monthly view */}
      {showTooltip && isHovered && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: 200,
            maxWidth: 280,
            borderRadius: 8,
            border: '1px solid rgba(148,163,184,0.44)',
            background: '#ffffff',
            boxShadow: '0 14px 36px rgba(15,23,42,0.22)',
            padding: '8px 10px',
            zIndex: 100,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            {candidateFullName}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
            {interview.positionTitle}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
            {formatTime(interview.scheduledTime)} • {formatDuration(interview.durationMinutes)}
          </div>
          {interviewerFullName && (
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {t('ats.interviewer', 'Interviewer')}: {interviewerFullName}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
