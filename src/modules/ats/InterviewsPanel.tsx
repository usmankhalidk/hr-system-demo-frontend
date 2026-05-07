import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Phone, Users, User, Briefcase, Building2, Store as StoreIcon, Mail, Hash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAllInterviews, Interview as APIInterview } from '../../api/ats';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Spinner';
import { getAvatarUrl } from '../../api/client';

export default function InterviewsPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [interviews, setInterviews] = useState<APIInterview[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    loadInterviews();
  }, []);

  const loadInterviews = async () => {
    try {
      setLoading(true);
      const { interviews: data } = await getAllInterviews();
      setInterviews(data);
    } catch (error) {
      console.error('Failed to load interviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();
  
  // Filter interviews based on user role
  const filteredByRole = user?.role === 'store_manager' 
    ? interviews.filter((interview) => interview.interviewerId === user.id)
    : interviews;

  const upcomingInterviews = filteredByRole
    .filter((interview) => new Date(interview.scheduledAt) >= now)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const pastInterviews = filteredByRole
    .filter((interview) => new Date(interview.scheduledAt) < now)
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  const displayedInterviews = activeTab === 'upcoming' ? upcomingInterviews : pastInterviews;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spinner size="lg" color="var(--primary)" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '2px solid var(--border)' }}>
        <button
          onClick={() => setActiveTab('upcoming')}
          style={{
            padding: '12px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'upcoming' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'upcoming' ? 'var(--primary)' : 'var(--text-secondary)',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: -2,
          }}
        >
          {t('ats.upcomingInterviews', 'Upcoming')} ({upcomingInterviews.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          style={{
            padding: '12px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'past' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'past' ? 'var(--primary)' : 'var(--text-secondary)',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: -2,
          }}
        >
          {t('ats.pastInterviews', 'Past')} ({pastInterviews.length})
        </button>
      </div>

      {/* Interviews List */}
      {displayedInterviews.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'var(--text-muted)',
          }}
        >
          <Calendar size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>
            {activeTab === 'upcoming'
              ? t('ats.noUpcomingInterviews', 'No upcoming interviews')
              : t('ats.noPastInterviews', 'No past interviews')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {displayedInterviews.map((interview) => {
            const scheduledDate = new Date(interview.scheduledAt);
            const candidateFullName = `${interview.candidateName || ''} ${interview.candidateSurname || ''}`.trim() || t('ats.defaultCandidateName', 'Candidate');
            const candidateAvatarUrl = getAvatarUrl(interview.candidateAvatarFilename);
            const interviewerFullName = interview.interviewerName
              ? `${interview.interviewerName} ${interview.interviewerSurname || ''}`.trim()
              : null;
            const interviewerAvatarUrl = interview.interviewerAvatarFilename 
              ? getAvatarUrl(interview.interviewerAvatarFilename)
              : null;

            return (
              <div
                key={interview.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 16,
                  overflow: 'hidden',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = '#3b82f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                {/* Header with Date Badge */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, #0D2137 0%, #1e3a5f 100%)',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Date Badge */}
                    <div
                      style={{
                        minWidth: 70,
                        textAlign: 'center',
                        padding: '10px 8px',
                        background: 'rgba(255,255,255,0.15)',
                        borderRadius: 12,
                        color: '#fff',
                        border: '2px solid rgba(255,255,255,0.2)',
                      }}
                    >
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>
                        {scheduledDate.getDate()}
                      </div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, marginTop: 4, opacity: 0.9, letterSpacing: 0.5 }}>
                        {scheduledDate.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
                      </div>
                    </div>

                    {/* Time and Duration */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', marginBottom: 6 }}>
                        <Clock size={18} />
                        <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                          {scheduledDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {interview.durationMinutes && (
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                          {interview.durationMinutes} {t('ats.minutes', 'minutes')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Interview Type Badge */}
                  <div
                    style={{
                      padding: '8px 16px',
                      borderRadius: 999,
                      background: interview.interviewType === 'phone' 
                        ? 'rgba(234,88,12,0.2)' 
                        : 'rgba(34,197,94,0.2)',
                      border: interview.interviewType === 'phone'
                        ? '2px solid rgba(234,88,12,0.4)'
                        : '2px solid rgba(34,197,94,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {interview.interviewType === 'phone' ? (
                      <Phone size={16} color="#fff" />
                    ) : (
                      <Users size={16} color="#fff" />
                    )}
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {interview.interviewType === 'phone'
                        ? t('ats.phone', 'Phone')
                        : t('ats.inPerson', 'In-Person')}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: '20px' }}>
                  {/* Candidate Section */}
                  <div
                    style={{
                      padding: 16,
                      background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(147,197,253,0.08) 100%)',
                      borderRadius: 12,
                      border: '1px solid rgba(59,130,246,0.2)',
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e40af', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      {t('ats.candidate', 'Candidate')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {candidateAvatarUrl ? (
                        <img
                          src={candidateAvatarUrl}
                          alt={candidateFullName}
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '3px solid rgba(59,130,246,0.3)',
                            boxShadow: '0 4px 12px rgba(59,130,246,0.15)',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'linear-gradient(135deg, #1e3a5f, #3a7bd5)',
                            color: '#fff',
                            fontSize: '1rem',
                            fontWeight: 800,
                            border: '3px solid rgba(59,130,246,0.3)',
                            boxShadow: '0 4px 12px rgba(59,130,246,0.15)',
                          }}
                        >
                          {candidateFullName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e40af', marginBottom: 4 }}>
                          {candidateFullName}
                        </div>
                        {interview.positionTitle && (
                          <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Briefcase size={14} />
                            {interview.positionTitle}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Interviewer Section */}
                  {interviewerFullName && (
                    <div
                      style={{
                        padding: 16,
                        background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(168,85,247,0.08) 100%)',
                        borderRadius: 12,
                        border: '1px solid rgba(124,58,237,0.2)',
                        marginBottom: 16,
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b21a8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        {t('ats.interviewer', 'Interviewer')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {interviewerAvatarUrl ? (
                          <img
                            src={interviewerAvatarUrl}
                            alt={interviewerFullName}
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '3px solid rgba(124,58,237,0.3)',
                              boxShadow: '0 4px 12px rgba(124,58,237,0.15)',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
                              color: '#fff',
                              fontSize: '0.9rem',
                              fontWeight: 800,
                              border: '3px solid rgba(124,58,237,0.3)',
                              boxShadow: '0 4px 12px rgba(124,58,237,0.15)',
                            }}
                          >
                            {interviewerFullName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#6b21a8' }}>
                          {interviewerFullName}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Location */}
                  {interview.location && interview.interviewType === 'in_person' && (
                    <div
                      style={{
                        padding: 14,
                        background: 'rgba(34,197,94,0.08)',
                        borderRadius: 10,
                        border: '1px solid rgba(34,197,94,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 16,
                      }}
                    >
                      <MapPin size={18} color="#15803d" />
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#15803d' }}>
                        {interview.location}
                      </span>
                    </div>
                  )}

                  {/* Description */}
                  {interview.description && (
                    <div
                      style={{
                        padding: 14,
                        background: 'rgba(148,163,184,0.08)',
                        borderRadius: 10,
                        border: '1px solid rgba(148,163,184,0.2)',
                      }}
                    >
                      <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
                        {interview.description}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
