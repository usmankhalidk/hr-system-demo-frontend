import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, Users, MapPin, Calendar, Clock, User, Briefcase, Trash2, Save, Building2, Store as StoreIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Interview } from '../../api/ats';
import { getAvatarUrl } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DatePicker } from '../../components/ui/DatePicker';
import { TimePicker } from '../../components/ui/TimePicker';
import { fullName, initials, formatDuration } from './atsCalendarUtils';

interface InterviewDetailsModalProps {
  interview: Interview;
  onClose: () => void;
  onSave: (updates: Partial<Interview>) => Promise<void>;
  onDelete: () => Promise<void>;
}

const INTERVIEW_TYPE_OPTIONS = [
  { value: 'phone', label: 'Phone Interview', icon: Phone },
  { value: 'in_person', label: 'In-Person Interview', icon: Users },
];

export default function InterviewDetailsModal({
  interview,
  onClose,
  onSave,
  onDelete,
}: InterviewDetailsModalProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form state - parse scheduledAt into date and time
  const scheduledAtDate = new Date(interview.scheduledAt);
  const initialDate = scheduledAtDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const initialTime = scheduledAtDate.toTimeString().slice(0, 5); // HH:mm
  
  const [interviewType, setInterviewType] = useState<Interview['interviewType']>(
    interview.interviewType
  );
  const [scheduledDate, setScheduledDate] = useState(initialDate);
  const [scheduledTime, setScheduledTime] = useState(initialTime);
  const [durationMinutes, setDurationMinutes] = useState(String(interview.durationMinutes || 60));
  const [location, setLocation] = useState(interview.location ?? '');
  const [notes, setNotes] = useState(interview.notes ?? '');
  const [description, setDescription] = useState(interview.description ?? '');

  const candidateFullName = fullName(interview.candidateName || '', interview.candidateSurname || '');
  const candidateInitials = initials(interview.candidateName || '', interview.candidateSurname || '');
  const candidateAvatarUrl = getAvatarUrl(interview.candidateAvatarFilename);

  const interviewerFullName = interview.interviewerName
    ? fullName(interview.interviewerName, interview.interviewerSurname || '')
    : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Combine date and time into ISO string
      const scheduledAt = `${scheduledDate}T${scheduledTime}:00`;
      
      await onSave({
        interviewType,
        scheduledAt,
        durationMinutes: parseInt(durationMinutes, 10),
        location: location || null,
        notes: notes || null,
        description: description || null,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save interview:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (error) {
      console.error('Failed to delete interview:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleCancel = () => {
    // Reset form
    const scheduledAtDate = new Date(interview.scheduledAt);
    setInterviewType(interview.interviewType);
    setScheduledDate(scheduledAtDate.toISOString().split('T')[0]);
    setScheduledTime(scheduledAtDate.toTimeString().slice(0, 5));
    setDurationMinutes(String(interview.durationMinutes || 60));
    setLocation(interview.location ?? '');
    setNotes(interview.notes ?? '');
    setDescription(interview.description ?? '');
    setIsEditing(false);
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(13,33,55,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 700,
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 24px 72px rgba(0,0,0,0.22)',
          animation: 'popIn 0.22s cubic-bezier(0.16,1,0.3,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 28px',
            background: 'linear-gradient(135deg, #0D2137 0%, #1e3a5f 100%)',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Calendar size={24} color="#fff" />
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '1.35rem',
                fontWeight: 700,
                color: '#fff',
              }}
            >
              {t('ats.interviewDetails', 'Interview Details')}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              cursor: 'pointer',
              padding: 10,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
          >
            <X size={20} color="#fff" />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '28px' }}>
          {/* Candidate Section */}
          <div
            style={{
              marginBottom: 24,
              padding: 20,
              background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(147,197,253,0.08) 100%)',
              borderRadius: 12,
              border: '1px solid rgba(59,130,246,0.2)',
            }}
          >
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#1e40af',
                marginBottom: 14,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <User size={14} />
              {t('ats.candidate', 'Candidate')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {candidateAvatarUrl ? (
                <img
                  src={candidateAvatarUrl}
                  alt={candidateFullName}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid rgba(59,130,246,0.3)',
                    boxShadow: '0 4px 12px rgba(59,130,246,0.15)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #1e3a5f, #3a7bd5)',
                    color: '#fff',
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    border: '3px solid rgba(59,130,246,0.3)',
                    boxShadow: '0 4px 12px rgba(59,130,246,0.15)',
                  }}
                >
                  {candidateInitials}
                </div>
              )}
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e40af', marginBottom: 4 }}>
                  {candidateFullName}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Briefcase size={14} />
                  {interview.positionTitle || t('ats.noPosition', 'No position specified')}
                </div>
              </div>
            </div>
          </div>

          {/* Interview Details Section */}
          <div
            style={{
              marginBottom: 24,
              padding: 20,
              background: 'linear-gradient(135deg, rgba(201,151,58,0.08) 0%, rgba(251,191,36,0.08) 100%)',
              borderRadius: 12,
              border: '1px solid rgba(201,151,58,0.2)',
            }}
          >
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#92400e',
                marginBottom: 16,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Calendar size={14} />
              {t('ats.interviewDetails', 'Interview Details')}
            </div>

            {/* Interview Type */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                }}
              >
                {t('ats.interviewType', 'Interview Type')}
              </label>
              {isEditing ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  {INTERVIEW_TYPE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = interviewType === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setInterviewType(option.value as Interview['interviewType'])}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: isSelected
                            ? '2px solid var(--primary)'
                            : '1px solid var(--border)',
                          background: isSelected ? 'rgba(13,33,55,0.05)' : 'var(--surface)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.15s',
                        }}
                      >
                        <Icon
                          size={20}
                          color={isSelected ? 'var(--primary)' : 'var(--text-muted)'}
                        />
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                          }}
                        >
                          {t(`ats.interviewType.${option.value}`, option.label)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {(() => {
                    const Icon = INTERVIEW_TYPE_ICONS[interview.interviewType];
                    return (
                      <>
                        <Icon size={18} color="var(--text-secondary)" />
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                          {t(`ats.interviewType.${interview.interviewType}`, interview.interviewType)}
                        </span>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Date and Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: 8,
                  }}
                >
                  {t('ats.date', 'Date')}
                </label>
                {isEditing ? (
                  <DatePicker
                    value={scheduledDate}
                    onChange={(value) => setScheduledDate(value)}
                  />
                ) : (
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                    {new Date(scheduledDate).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: 8,
                  }}
                >
                  {t('ats.time', 'Time')}
                </label>
                {isEditing ? (
                  <TimePicker
                    value={scheduledTime}
                    onChange={(value) => setScheduledTime(value)}
                  />
                ) : (
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                    {scheduledTime ? scheduledTime.slice(0, 5) : '-'}
                  </div>
                )}
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: 8,
                  }}
                >
                  {t('ats.duration', 'Duration')}
                </label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    placeholder="60"
                    min="15"
                    step="15"
                  />
                ) : (
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                    {formatDuration(interview.durationMinutes || 60)}
                  </div>
                )}
              </div>
            </div>

            {/* Location */}
            {(interviewType === 'in_person' || !isEditing && interview.location) && (
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: 8,
                  }}
                >
                  <MapPin size={14} style={{ display: 'inline', marginRight: 4 }} />
                  {t('ats.location', 'Location')}
                </label>
                {isEditing ? (
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={t('ats.locationPlaceholder', 'Enter location')}
                  />
                ) : (
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                    {interview.location || '-'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Interviewer Section */}
          {interviewerFullName && (
            <div
              style={{
                marginBottom: 24,
                padding: 20,
                background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(168,85,247,0.08) 100%)',
                borderRadius: 12,
                border: '1px solid rgba(124,58,237,0.2)',
              }}
            >
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#6b21a8',
                  marginBottom: 14,
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <User size={14} />
                {t('ats.interviewer', 'Interviewer')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
                    color: '#fff',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    border: '2px solid rgba(124,58,237,0.3)',
                  }}
                >
                  {interviewerFullName.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#6b21a8' }}>
                  {interviewerFullName}
                </span>
              </div>
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: 8,
              }}
            >
              {t('ats.description', 'Description')}
            </label>
            {isEditing ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('ats.descriptionPlaceholder', 'Interview description...')}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            ) : (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {interview.description || '-'}
              </div>
            )}
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: 8,
              }}
            >
              {t('ats.notes', 'Notes')}
            </label>
            {isEditing ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('ats.notesPlaceholder', 'Add notes...')}
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            ) : (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {interview.notes || '-'}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            {!isEditing && (
              <Button
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Trash2 size={16} />
                {t('common.delete', 'Delete')}
              </Button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {isEditing ? (
              <>
                <Button variant="secondary" onClick={handleCancel} disabled={saving}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={16} />
                  {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                </Button>
              </>
            ) : (
              <Button variant="primary" onClick={() => setIsEditing(true)}>
                {t('common.edit', 'Edit')}
              </Button>
            )}
          </div>
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm &&
          createPortal(
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9100,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
              onClick={() => setShowDeleteConfirm(false)}
            >
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 12,
                  padding: 24,
                  maxWidth: 400,
                  width: '100%',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: 700 }}>
                  {t('ats.deleteInterviewConfirm', 'Delete Interview?')}
                </h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  {t(
                    'ats.deleteInterviewWarning',
                    'This action cannot be undone. The interview will be permanently deleted.'
                  )}
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                    {t('common.cancel', 'Cancel')}
                  </Button>
                  <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                    {deleting ? t('common.deleting', 'Deleting...') : t('common.delete', 'Delete')}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>,
    document.body
  );
}

const INTERVIEW_TYPE_ICONS: Record<Interview['interviewType'], typeof Phone> = {
  phone: Phone,
  in_person: Users,
};
