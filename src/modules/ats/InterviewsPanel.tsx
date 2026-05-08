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
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        <button
          onClick={() => setActiveTab('upcoming')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'upcoming' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'upcoming' ? 'var(--primary)' : 'var(--text-secondary)',
            fontSize: '0.9rem',
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
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'past' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'past' ? 'var(--primary)' : 'var(--text-secondary)',
            fontSize: '0.9rem',
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                  borderRadius: 10,
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
                  e.currentTarget.style.borderColor = '#3b82f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                {/* Compact Header */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, #0D2137 0%, #1e3a5f 100%)',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  {/* Date Badge */}
                  <div
                    style={{
                      minWidth: 50,
                      textAlign: 'center',
                      padding: '6px 4px',
                      background: 'rgba(255,255,255,0.15)',
                      borderRadius: 7,
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.2)',
                    }}
                  >
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, lineHeight: 1 }}>
                      {scheduledDate.getDate()}
                    </div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, marginTop: 2, opacity: 0.9 }}>
                      {scheduledDate.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
                    </div>
                  </div>

                  {/* Time & Duration */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>
                      <Clock size={15} />
                      {scheduledDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      {interview.durationMinutes && <span style={{ opacity: 0.8, fontSize: '0.8rem' }}>({interview.durationMinutes}min)</span>}
                    </div>
                  </div>

                  {/* Interview Type Badge */}
                  <div
                    style={{
                      padding: '5px 10px',
                      borderRadius: 5,
                      background: interview.interviewType === 'phone' ? 'rgba(234,88,12,0.25)' : 'rgba(34,197,94,0.25)',
                      border: `1px solid ${interview.interviewType === 'phone' ? 'rgba(234,88,12,0.5)' : 'rgba(34,197,94,0.5)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    {interview.interviewType === 'phone' ? <Phone size={13} color="#fff" /> : <Users size={13} color="#fff" />}
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>
                      {interview.interviewType === 'phone' ? t('ats.phone', 'Phone') : t('ats.inPerson', 'In-Person')}
                    </span>
                  </div>
                </div>

                {/* Compact Content */}
                <div style={{ padding: '12px 14px' }}>
                  {/* Candidate & Position Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #e2e8f0' }}>
                    {candidateAvatarUrl ? (
                      <img
                        src={candidateAvatarUrl}
                        alt={candidateFullName}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid #3b82f6',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'linear-gradient(135deg, #1e3a5f, #3a7bd5)',
                          color: '#fff',
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          border: '2px solid #3b82f6',
                        }}
                      >
                        {candidateFullName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
                        {candidateFullName}
                      </div>
                      {interview.positionTitle && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Briefcase size={11} />
                          {interview.positionTitle}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Details Grid - Compact */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                    {/* Interviewer & Location Row */}
                    {interviewerFullName && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        {interviewerAvatarUrl ? (
                          <img
                            src={interviewerAvatarUrl}
                            alt={interviewerFullName}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '2px solid #7c3aed',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
                              color: '#fff',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              border: '2px solid #7c3aed',
                            }}
                          >
                            {interviewerFullName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>
                            {t('ats.interviewer', 'Interviewer')}
                          </div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {interviewerFullName}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Location */}
                    {interview.location && interview.interviewType === 'in_person' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(34,197,94,0.15)',
                            border: '2px solid rgba(34,197,94,0.3)',
                          }}
                        >
                          <MapPin size={14} color="#15803d" />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>
                            {t('ats.location', 'Location')}
                          </div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {interview.location}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {interview.description && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: '6px 8px',
                        background: 'rgba(148,163,184,0.06)',
                        borderRadius: 5,
                        borderLeft: '3px solid #94a3b8',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.4 }}>
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
