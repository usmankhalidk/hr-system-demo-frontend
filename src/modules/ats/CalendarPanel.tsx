import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Interview as APIInterview, JobPosting, getAllInterviews, updateInterview, deleteInterview, InterviewType } from '../../api/ats';
import { Employee } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import { Button } from '../../components/ui/Button';
import CustomSelect, { SelectOption } from '../../components/ui/CustomSelect';
import ATSWeeklyCalendar from './ATSWeeklyCalendar';
import ATSMonthlyCalendar from './ATSMonthlyCalendar';
import InterviewDetailsModal from './InterviewDetailsModal';
import ModalBackdrop from '../../components/ui/ModalBackdrop';
import {
  formatDate,
  getWeekStart,
  getWeekEnd,
  getMonthStart,
  getMonthEnd,
  addWeeks,
  addMonths,
  applyFilters,
  getActiveFilterCount,
  InterviewFilter,
  Interview,
} from './atsCalendarUtils';

interface CalendarPanelProps {
  positions: JobPosting[];
  employees: Employee[];
}

type CalendarView = 'weekly' | 'monthly';

export default function CalendarPanel({
  positions,
  employees,
}: CalendarPanelProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { socket } = useSocket();

  // State
  const [view, setView] = useState<CalendarView>('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInterview, setSelectedInterview] = useState<APIInterview | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<InterviewFilter>({
    positionId: null,
    interviewerId: null,
    status: null,
  });

  // Calculate date range based on view
  const dateRange = useMemo(() => {
    if (view === 'weekly') {
      return {
        start: formatDate(getWeekStart(currentDate)),
        end: formatDate(getWeekEnd(currentDate)),
      };
    } else {
      return {
        start: formatDate(getMonthStart(currentDate)),
        end: formatDate(getMonthEnd(currentDate)),
      };
    }
  }, [view, currentDate]);

  // Fetch interviews
  const fetchInterviews = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
      };

      if (filters.positionId !== null) {
        params.positionId = filters.positionId;
      }
      if (filters.interviewerId !== null) {
        params.interviewerId = filters.interviewerId;
      }
      if (filters.status !== null) {
        params.status = filters.status;
      }

      const response = await getAllInterviews(params);
      
      // Transform interviews to include scheduledDate, scheduledTime, and status
      const transformedInterviews = (response.interviews || []).map((interview) => {
        const scheduledDate = new Date(interview.scheduledAt);
        const dateStr = scheduledDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = scheduledDate.toTimeString().slice(0, 5); // HH:mm
        
        return {
          ...interview,
          scheduledDate: dateStr,
          scheduledTime: timeStr,
          durationMinutes: interview.durationMinutes || 60,
          status: 'scheduled' as const,
        };
      });
      
      setInterviews(transformedInterviews);
    } catch (error) {
      console.error('Failed to fetch interviews:', error);
      showToast(t('ats.fetchInterviewsError', 'Failed to load interviews'), 'error');
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange.start, dateRange.end, filters, t, showToast]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchInterviews();
  }, [fetchInterviews]);

  // Real-time updates via WebSocket
  useEffect(() => {
    if (!socket) return;

    const transformInterview = (interview: APIInterview): Interview => {
      const scheduledDate = new Date(interview.scheduledAt);
      const dateStr = scheduledDate.toISOString().split('T')[0];
      const timeStr = scheduledDate.toTimeString().slice(0, 5);
      
      return {
        ...interview,
        scheduledDate: dateStr,
        scheduledTime: timeStr,
        durationMinutes: interview.durationMinutes || 60,
        status: 'scheduled' as const,
      };
    };

    const handleInterviewCreated = (data: { interview: APIInterview }) => {
      setInterviews((prev) => [...prev, transformInterview(data.interview)]);
      showToast(t('ats.interviewCreated', 'New interview scheduled'), 'success');
    };

    const handleInterviewUpdated = (data: { interview: APIInterview }) => {
      const transformed = transformInterview(data.interview);
      setInterviews((prev) =>
        prev.map((interview) => (interview.id === transformed.id ? transformed : interview))
      );
      if (selectedInterview?.id === data.interview.id) {
        setSelectedInterview(data.interview);
      }
    };

    const handleInterviewDeleted = (data: { interviewId: number }) => {
      setInterviews((prev) => prev.filter((interview) => interview.id !== data.interviewId));
      if (selectedInterview?.id === data.interviewId) {
        setSelectedInterview(null);
      }
    };

    socket.on('interview:created', handleInterviewCreated);
    socket.on('interview:updated', handleInterviewUpdated);
    socket.on('interview:deleted', handleInterviewDeleted);

    return () => {
      socket.off('interview:created', handleInterviewCreated);
      socket.off('interview:updated', handleInterviewUpdated);
      socket.off('interview:deleted', handleInterviewDeleted);
    };
  }, [socket, selectedInterview, t, showToast]);

  // Navigation handlers
  const handlePrevious = () => {
    if (view === 'weekly') {
      setCurrentDate((prev) => addWeeks(prev, -1));
    } else {
      setCurrentDate((prev) => addMonths(prev, -1));
    }
  };

  const handleNext = () => {
    if (view === 'weekly') {
      setCurrentDate((prev) => addWeeks(prev, 1));
    } else {
      setCurrentDate((prev) => addMonths(prev, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // View toggle
  const handleViewChange = (newView: CalendarView) => {
    setView(newView);
  };

  // Filter handlers
  const handleFilterChange = (key: keyof InterviewFilter, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      positionId: null,
      interviewerId: null,
      status: null,
    });
  };

  // Interview handlers
  const handleInterviewClick = (interview: Interview) => {
    // Convert back to API Interview for the modal
    const apiInterview: APIInterview = {
      id: interview.id,
      candidateId: interview.candidateId,
      interviewerId: interview.interviewerId,
      interviewType: interview.interviewType,
      scheduledAt: interview.scheduledAt,
      location: interview.location,
      description: interview.description,
      notes: interview.notes,
      feedback: interview.feedback,
      durationMinutes: interview.durationMinutes,
      icsUid: interview.icsUid,
      createdAt: interview.createdAt,
      updatedAt: interview.updatedAt,
      candidateName: interview.candidateName,
      candidateSurname: interview.candidateSurname,
      candidateAvatarFilename: interview.candidateAvatarFilename,
      positionTitle: interview.positionTitle,
      positionId: interview.positionId,
      interviewerName: interview.interviewerName,
      interviewerSurname: interview.interviewerSurname,
      interviewerAvatarFilename: interview.interviewerAvatarFilename,
    };
    setSelectedInterview(apiInterview);
  };

  const handleSaveInterview = async (updates: Partial<APIInterview>) => {
    if (!selectedInterview) return;

    try {
      // Filter out null values - API expects undefined for optional fields
      const cleanedUpdates: {
        feedback?: string;
        notes?: string;
        scheduledAt?: string;
        interviewType?: InterviewType;
        location?: string;
        description?: string;
        durationMinutes?: number;
        interviewerId?: number | null;
      } = {};
      
      for (const [key, value] of Object.entries(updates)) {
        if (value !== null) {
          (cleanedUpdates as any)[key] = value;
        }
      }
      
      const updated = await updateInterview(selectedInterview.id, cleanedUpdates);
      
      // Transform the updated interview
      const scheduledDate = new Date(updated.scheduledAt);
      const dateStr = scheduledDate.toISOString().split('T')[0];
      const timeStr = scheduledDate.toTimeString().slice(0, 5);
      
      const transformedUpdated: Interview = {
        ...updated,
        scheduledDate: dateStr,
        scheduledTime: timeStr,
        durationMinutes: updated.durationMinutes || 60,
        status: 'scheduled' as const,
      };
      
      setInterviews((prev) =>
        prev.map((interview) => (interview.id === transformedUpdated.id ? transformedUpdated : interview))
      );
      setSelectedInterview(updated);
      showToast(t('ats.interviewUpdated', 'Interview updated successfully'), 'success');
    } catch (error) {
      console.error('Failed to update interview:', error);
      showToast(t('ats.updateInterviewError', 'Failed to update interview'), 'error');
      throw error;
    }
  };

  const handleDeleteInterview = async () => {
    if (!selectedInterview) return;

    try {
      await deleteInterview(selectedInterview.id);
      setInterviews((prev) => prev.filter((interview) => interview.id !== selectedInterview.id));
      setSelectedInterview(null);
      showToast(t('ats.interviewDeleted', 'Interview deleted successfully'), 'success');
    } catch (error) {
      console.error('Failed to delete interview:', error);
      showToast(t('ats.deleteInterviewError', 'Failed to delete interview'), 'error');
      throw error;
    }
  };

  // Apply filters to interviews
  const filteredInterviews = useMemo(() => {
    return applyFilters(interviews, filters);
  }, [interviews, filters]);

  // Active filter count
  const activeFilterCount = getActiveFilterCount(filters);

  // Date range label
  const dateRangeLabel = useMemo(() => {
    if (view === 'weekly') {
      const start = getWeekStart(currentDate);
      const end = getWeekEnd(currentDate);
      return `${start.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })} - ${end.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`;
    } else {
      return currentDate.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
    }
  }, [view, currentDate]);

  // Position options for filter
  const positionOptions: SelectOption[] = useMemo(() => {
    return [
      { value: 'all', label: t('common.allPositions', 'All Positions') },
      ...positions.map((position) => ({
        value: String(position.id),
        label: position.title,
      })),
    ];
  }, [positions, t]);

  // Interviewer options for filter
  const interviewerOptions: SelectOption[] = useMemo(() => {
    const interviewers = employees.filter(
      (emp) => emp.role === 'hr' || emp.role === 'area_manager' || emp.role === 'admin'
    );
    return [
      { value: 'all', label: t('common.allInterviewers', 'All Interviewers') },
      ...interviewers.map((emp) => ({
        value: String(emp.id),
        label: `${emp.name} ${emp.surname}`,
      })),
    ];
  }, [employees, t]);

  // Status options for filter
  const statusOptions: SelectOption[] = [
    { value: 'all', label: t('common.allStatuses', 'All Statuses') },
    { value: 'scheduled', label: t('ats.interviewStatus.scheduled', 'Scheduled') },
    { value: 'completed', label: t('ats.interviewStatus.completed', 'Completed') },
    { value: 'cancelled', label: t('ats.interviewStatus.cancelled', 'Cancelled') },
    { value: 'rescheduled', label: t('ats.interviewStatus.rescheduled', 'Rescheduled') },
  ];

  return (
    <>
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 16,
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Single row header - matching shifts module */}
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            minHeight: 52,
          }}
        >
          {/* LEFT: view toggle + navigation + today */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {/* View toggle pill */}
            <div
              style={{
                display: 'flex',
                background: 'var(--background)',
                border: '1.5px solid var(--border)',
                borderRadius: 8,
                padding: 2,
                gap: 2,
                flexShrink: 0,
              }}
            >
              {(['weekly', 'monthly'] as CalendarView[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleViewChange(mode)}
                  style={{
                    padding: '5px 14px',
                    background: view === mode ? 'var(--primary)' : 'transparent',
                    color: view === mode ? '#fff' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: 6,
                    fontFamily: 'var(--font-body)',
                    fontSize: 12,
                    fontWeight: 600,
                    transition: 'background 0.15s, color 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {mode === 'weekly' ? t('ats.weeklyView', 'Weekly') : t('ats.monthlyView', 'Monthly')}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0, margin: '0 2px' }} />

            {/* Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
              <button
                onClick={handlePrevious}
                aria-label="Previous"
                style={{
                  padding: '5px 8px',
                  color: 'var(--text-primary)',
                  borderRadius: 6,
                  lineHeight: 1,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronLeft size={16} />
              </button>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: 130,
                  textAlign: 'center',
                  userSelect: 'none',
                  padding: '0 4px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 14,
                    color: 'var(--primary)',
                    lineHeight: 1.1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {dateRangeLabel}
                </span>
              </div>

              <button
                onClick={handleNext}
                aria-label="Next"
                style={{
                  padding: '5px 8px',
                  color: 'var(--text-primary)',
                  borderRadius: 6,
                  lineHeight: 1,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Today button */}
            <Button variant="secondary" onClick={handleToday} style={{ fontSize: 12, padding: '5px 14px', fontWeight: 600, flexShrink: 0 }}>
              {t('common.today', 'Today')}
            </Button>
          </div>

          {/* RIGHT: filter button + loading */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* Filter button */}
            <button
              onClick={() => setShowFilterModal(true)}
              style={{
                padding: '6px 12px',
                border: '1.5px solid var(--border)',
                borderRadius: 7,
                background: activeFilterCount > 0 ? 'var(--primary)' : 'var(--surface)',
                color: activeFilterCount > 0 ? '#fff' : 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                transition: 'all 0.15s',
              }}
            >
              <Filter size={14} />
              {t('common.filters', 'Filters')}
              {activeFilterCount > 0 && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 18,
                    height: 18,
                    borderRadius: 999,
                    background: activeFilterCount > 0 ? 'rgba(255,255,255,0.25)' : 'var(--accent)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '0 5px',
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    flexShrink: 0,
                    border: '2px solid var(--border)',
                    borderTopColor: 'var(--primary)',
                    animation: 'spin 0.7s linear infinite',
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {t('common.loading', 'Loading...')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Calendar Content */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--background)' }}>
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 400,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  border: '4px solid var(--border)',
                  borderTopColor: 'var(--accent)',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
            </div>
          ) : view === 'weekly' ? (
            <ATSWeeklyCalendar
              interviews={filteredInterviews}
              weekStart={getWeekStart(currentDate)}
              onInterviewClick={handleInterviewClick}
            />
          ) : (
            <ATSMonthlyCalendar
              interviews={filteredInterviews}
              currentDate={currentDate}
              onDayClick={(date) => {
                setCurrentDate(new Date(date));
                setView('weekly');
              }}
              onInterviewClick={handleInterviewClick}
            />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          <div>
            {filteredInterviews.length} {t('ats.interviews', 'interviews')}
            {activeFilterCount > 0 && ` (${t('common.filtered', 'filtered')})`}
          </div>
        </div>
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <ModalBackdrop onClose={() => setShowFilterModal(false)} width={500}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <Filter size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                {t('common.filters', 'Filters')}
              </h3>
              <button
                onClick={() => setShowFilterModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: 24,
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Position filter */}
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {t('ats.position', 'Position')}
              </label>
              <CustomSelect
                options={positionOptions}
                value={filters.positionId === null ? 'all' : String(filters.positionId)}
                onChange={(value) => handleFilterChange('positionId', value === 'all' || value === null ? null : parseInt(value, 10))}
                placeholder={t('ats.selectPosition', 'Select Position')}
              />
            </div>

            {/* Interviewer filter */}
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {t('ats.interviewer', 'Interviewer')}
              </label>
              <CustomSelect
                options={interviewerOptions}
                value={filters.interviewerId === null ? 'all' : String(filters.interviewerId)}
                onChange={(value) => handleFilterChange('interviewerId', value === 'all' || value === null ? null : parseInt(value, 10))}
                placeholder={t('ats.selectInterviewer', 'Select Interviewer')}
              />
            </div>

            {/* Status filter */}
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {t('common.status', 'Status')}
              </label>
              <CustomSelect
                options={statusOptions}
                value={filters.status === null ? 'all' : filters.status}
                onChange={(value) => handleFilterChange('status', value === 'all' ? null : (value as Interview['status']))}
                placeholder={t('ats.selectStatus', 'Select Status')}
              />
            </div>
          </div>

          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <Button variant="secondary" onClick={handleClearFilters} disabled={activeFilterCount === 0}>
              {t('common.clearFilters', 'Clear Filters')}
            </Button>
            <Button variant="primary" onClick={() => setShowFilterModal(false)}>
              {t('common.apply', 'Apply')}
            </Button>
          </div>
        </ModalBackdrop>
      )}

      {/* Interview Details Modal */}
      {selectedInterview && (
        <InterviewDetailsModal
          interview={selectedInterview}
          onClose={() => setSelectedInterview(null)}
          onSave={handleSaveInterview}
          onDelete={handleDeleteInterview}
        />
      )}
    </>
  );
}
