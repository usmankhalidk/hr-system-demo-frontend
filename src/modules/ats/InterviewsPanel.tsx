import { useState, useEffect } from 'react';
import { Calendar, Clock, Phone, Users, Briefcase, FileText, Mail, PhoneIcon, Linkedin, Building2, Store } from 'lucide-react';
import DocumentPreviewModal from './DocumentPreviewModal';
import { getResumeUrl, getAvatarUrl, getCompanyLogoUrl, getStoreLogoUrl } from '../../api/client';
import { useTranslation } from 'react-i18next';
import { getAllInterviews, Interview as APIInterview } from '../../api/ats';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Spinner';

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
      console.log('✅ Interviews loaded successfully:', data.length, 'interviews');
      console.log('📊 First interview sample:', data[0]);
      setInterviews(data);
    } catch (error) {
      console.error('❌ Failed to load interviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();
  
  // Filter interviews based on user role
  const filteredByRole = user?.role === 'store_manager' 
    ? interviews.filter((interview) => interview.interviewerId === user.id)
    : interviews;

  console.log('🔍 Filtering results:', {
    totalInterviews: interviews.length,
    userRole: user?.role,
    filteredCount: filteredByRole.length,
    userId: user?.id
  });

  const upcomingInterviews = filteredByRole
    .filter((interview) => new Date(interview.scheduledAt) >= now)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const pastInterviews = filteredByRole
    .filter((interview) => new Date(interview.scheduledAt) < now)
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  console.log('📅 Interview counts:', {
    upcoming: upcomingInterviews.length,
    past: pastInterviews.length,
    activeTab
  });

  const displayedInterviews = activeTab === 'upcoming' ? upcomingInterviews : pastInterviews;

  const [resumePreviewUrl, setResumePreviewUrl] = useState<string | null>(null);
  const [resumeFilename, setResumeFilename] = useState<string | null>(null);
  const [showResumePreview, setShowResumePreview] = useState(false);

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
                  {/* Second Row: Candidate Details with Labels */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                    {/* Candidate Block */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {t('ats.candidate', 'Candidate')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {candidateAvatarUrl ? (
                          <img
                            src={candidateAvatarUrl}
                            alt={candidateFullName}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '2px solid #3b82f6',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'linear-gradient(135deg, #1e3a5f, #3a7bd5)',
                              color: '#fff',
                              fontSize: '0.8rem',
                              fontWeight: 800,
                              border: '2px solid #3b82f6',
                            }}
                          >
                            {candidateFullName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{candidateFullName}</div>
                      </div>
                    </div>

                    {/* Email Block */}
                    {interview.candidateEmail && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {t('common.email', 'Email')}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Mail size={14} color="#3b82f6" />
                          <span style={{ fontSize: '0.85rem', color: '#475569' }}>{interview.candidateEmail}</span>
                        </div>
                      </div>
                    )}

                    {/* Phone Block */}
                    {interview.candidatePhone && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 150 }}>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {t('common.phone', 'Phone')}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <PhoneIcon size={14} color="#10b981" />
                          <span style={{ fontSize: '0.85rem', color: '#475569' }}>{interview.candidatePhone}</span>
                        </div>
                      </div>
                    )}

                    {/* LinkedIn Block */}
                    {interview.candidateLinkedinUrl && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 150 }}>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          LinkedIn
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Linkedin size={14} color="#0077b5" />
                          <a 
                            href={interview.candidateLinkedinUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.85rem', color: '#0077b5', textDecoration: 'none' }}
                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            {t('ats.viewProfile', 'View Profile')}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CV / Resume - Full Width Row */}
                  {(() => {
                    const candidateCvPath = interview.resumePath || interview.cvPath || null;
                    if (!candidateCvPath) return null;
                    const url = getResumeUrl(candidateCvPath);
                    const filename = candidateCvPath.split('/').pop() ?? candidateCvPath;
                    return (
                      <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, border: '1px dashed rgba(148,163,184,0.25)', background: 'rgba(241,245,249,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                          <FileText size={16} color="#64748b" />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#334155' }}>{filename}</div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{t('ats.cvAttached', 'CV attached')}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!url) return;
                            setResumePreviewUrl(url);
                            setResumeFilename(filename);
                            setShowResumePreview(true);
                          }}
                          style={{ 
                            padding: '5px 12px', 
                            borderRadius: 6, 
                            border: '1px solid rgba(13,33,55,0.15)', 
                            background: '#fff', 
                            fontSize: '0.75rem',
                            fontWeight: 700, 
                            cursor: 'pointer',
                            color: '#0f172a',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f1f5f9';
                            e.currentTarget.style.borderColor = '#3b82f6';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#fff';
                            e.currentTarget.style.borderColor = 'rgba(13,33,55,0.15)';
                          }}
                        >
                          {t('ats.viewCv', 'View')}
                        </button>
                      </div>
                    );
                  })()}

                  {/* Third Row: Interviewer, Company, Store, Position, Location, Salary */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                    {/* Interviewer Block */}
                    {interviewerFullName && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 150 }}>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {t('ats.interviewer', 'Interviewer')}
                        </div>
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
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                              {interviewerFullName}
                            </div>
                            {interview.interviewerRole && (
                              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{interview.interviewerRole}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Company Block */}
                    {interview.companyName && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 150 }}>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {t('common.company', 'Company')}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {interview.companyLogoFilename ? (
                            <img
                              src={getCompanyLogoUrl(interview.companyLogoFilename) || ''}
                              alt={interview.companyName}
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 6,
                                objectFit: 'cover',
                                border: '1px solid #e2e8f0',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 6,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: '#fff',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                border: '1px solid #e2e8f0',
                              }}
                            >
                              <Building2 size={16} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{interview.companyName}</div>
                            {interview.companyGroupName && (
                              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{interview.companyGroupName}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Store Block */}
                    {interview.storeName && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 150 }}>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {t('common.store', 'Store')}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {interview.storeLogoFilename ? (
                            <img
                              src={getStoreLogoUrl(interview.storeLogoFilename) || ''}
                              alt={interview.storeName}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                objectFit: 'cover',
                                border: '1px solid #e2e8f0',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                color: '#fff',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                border: '1px solid #e2e8f0',
                              }}
                            >
                              <Store size={16} />
                            </div>
                          )}
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{interview.storeName}</div>
                        </div>
                      </div>
                    )}

                    {/* Position Block */}
                    {interview.positionTitle && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 120 }}>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {t('ats.position', 'Position')}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0f172a', fontWeight: 700 }}>
                          <Briefcase size={14} />
                          <span style={{ fontSize: '0.9rem' }}>{interview.positionTitle}</span>
                        </div>
                      </div>
                    )}

                    {/* Working Hours Block */}
                    {interview.positionWeeklyHours && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 90 }}>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {t('ats.workingHours', 'Working Hours')}
                        </div>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 4,
                            background: '#dbeafe',
                            color: '#1e40af',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'inline-block',
                            width: 'fit-content',
                          }}
                        >
                          {interview.positionWeeklyHours}h/week
                        </span>
                      </div>
                    )}

                    {/* Job Type Block */}
                    {interview.positionJobType && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 90 }}>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {t('ats.jobType', 'Job Type')}
                        </div>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 4,
                            background: '#e0e7ff',
                            color: '#4338ca',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'inline-block',
                            width: 'fit-content',
                          }}
                        >
                          {interview.positionJobType === 'fulltime' ? t('ats.jobType_fulltime', 'Full-time') :
                           interview.positionJobType === 'parttime' ? t('ats.jobType_parttime', 'Part-time') :
                           interview.positionJobType === 'contract' ? t('ats.jobType_contract', 'Contract') :
                           interview.positionJobType === 'internship' ? t('ats.jobType_internship', 'Internship') :
                           interview.positionJobType}
                        </span>
                      </div>
                    )}

                    {/* Location Block */}
                    {interview.positionLocation && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 100 }}>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {t('common.location', 'Location')}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
                          📍 {interview.positionLocation}
                        </div>
                      </div>
                    )}

                    {/* Salary Block */}
                    {(interview.positionSalaryMin || interview.positionSalaryMax) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 80 }}>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {t('ats.salary', 'Salary')}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 700 }}>
                          💰 {interview.positionSalaryMin && interview.positionSalaryMax
                            ? `€${interview.positionSalaryMin.toLocaleString()} - €${interview.positionSalaryMax.toLocaleString()}`
                            : interview.positionSalaryMin
                            ? `€${interview.positionSalaryMin.toLocaleString()}+`
                            : interview.positionSalaryMax
                            ? `Up to €${interview.positionSalaryMax.toLocaleString()}`
                            : ''}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Position Description */}
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
      {showResumePreview && resumePreviewUrl && resumeFilename && (
        <DocumentPreviewModal url={resumePreviewUrl} filename={resumeFilename} onClose={() => setShowResumePreview(false)} />
      )}
    </div>
  );
}

