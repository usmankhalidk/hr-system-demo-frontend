import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { translateApiError } from '../../utils/apiErrors';
import {
  getJobs, createJob, updateJob, deleteJob, publishJob,
  getCandidates, createCandidate, updateCandidateStage, deleteCandidate,
  getInterviews, createInterview,
  getAlerts, getRisks,
  JobPosting, Candidate, Interview, HRAlert, JobRisk,
  CandidateStatus, JobStatus,
} from '../../api/ats';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STAGES: CandidateStatus[] = ['received', 'review', 'interview', 'hired', 'rejected'];

const NEXT_STAGE: Partial<Record<CandidateStatus, CandidateStatus>> = {
  received:  'review',
  review:    'interview',
  interview: 'hired',
};

const STAGE_COLOR: Record<CandidateStatus, string> = {
  received:  '#0284C7',
  review:    '#7C3AED',
  interview: '#C9973A',
  hired:     '#15803D',
  rejected:  '#DC2626',
};

const STATUS_COLOR: Record<JobStatus, string> = {
  draft:     '#6B7280',
  published: '#15803D',
  closed:    '#DC2626',
};

function initials(name: string) {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TabBarProps {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (k: string) => void;
}
const TabBar: React.FC<TabBarProps> = ({ tabs, active, onChange }) => (
  <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
    {tabs.map((tab) => (
      <button
        key={tab.key}
        onClick={() => onChange(tab.key)}
        style={{
          padding: '10px 18px',
          background: 'none', border: 'none',
          borderBottom: active === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
          color: active === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
          fontWeight: active === tab.key ? 600 : 400,
          fontSize: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: -1, transition: 'color 0.15s',
        }}
      >
        {tab.label}
        {tab.count !== undefined && tab.count > 0 && (
          <span style={{
            background: active === tab.key ? 'var(--accent)' : 'var(--border)',
            color: active === tab.key ? 'white' : 'var(--text-muted)',
            borderRadius: 99, fontSize: 11, fontWeight: 700,
            padding: '1px 7px', fontFamily: 'var(--font-display)',
          }}>{tab.count}</span>
        )}
      </button>
    ))}
  </div>
);

// Job form modal
interface JobModalProps {
  job?: JobPosting | null;
  onSave: (title: string, description: string, tags: string[]) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}
const JobModal: React.FC<JobModalProps> = ({ job, onSave, onClose, saving }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState(job?.title ?? '');
  const [description, setDescription] = useState(job?.description ?? '');
  const [tagInput, setTagInput] = useState(job?.tags.join(', ') ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagInput.split(',').map((s) => s.trim()).filter(Boolean);
    onSave(title.trim(), description.trim(), tags);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 520,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)', animation: 'popIn 0.22s cubic-bezier(0.16,1,0.3,1)',
      }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 20px', fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-primary)' }}>
          {job ? t('ats.editJob') : t('ats.newJob')}
        </h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
              {t('ats.jobTitle')} *
            </label>
            <input
              className="field-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder={t('ats.jobTitlePlaceholder')}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
              {t('ats.jobDescription')}
            </label>
            <textarea
              className="field-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={t('ats.jobDescriptionPlaceholder')}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
              {t('ats.jobTags')}
            </label>
            <input
              className="field-input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder={t('ats.jobTagsPlaceholder')}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !title.trim()}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Candidate detail modal
interface CandidateModalProps {
  candidate: Candidate;
  jobs: JobPosting[];
  onClose: () => void;
  onAdvance: (status: CandidateStatus) => Promise<void>;
  onReject: () => Promise<void>;
  onDelete: () => Promise<void>;
  saving: boolean;
}
const CandidateModal: React.FC<CandidateModalProps> = ({
  candidate, jobs, onClose, onAdvance, onReject, onDelete, saving,
}) => {
  const { t } = useTranslation();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [intDate, setIntDate] = useState('');
  const [intTime, setIntTime] = useState('09:00');
  const [intLocation, setIntLocation] = useState('');
  const [intNotes, setIntNotes] = useState('');
  const [savingInt, setSavingInt] = useState(false);
  const { showToast } = useToast();

  const jobTitle = jobs.find((j) => j.id === candidate.jobPostingId)?.title;

  useEffect(() => {
    getInterviews(candidate.id).then(setInterviews).catch(() => {});
  }, [candidate.id]);

  const handleCreateInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intDate) return;
    setSavingInt(true);
    try {
      const scheduledAt = new Date(`${intDate}T${intTime}:00`).toISOString();
      const iv = await createInterview(candidate.id, { scheduledAt, location: intLocation || undefined, notes: intNotes || undefined });
      setInterviews((prev) => [...prev, iv]);
      setShowInterviewForm(false);
      setIntDate(''); setIntTime('09:00'); setIntLocation(''); setIntNotes('');
      showToast(t('ats.interviewCreated'), 'success');
    } catch (err) {
      showToast(t('ats.interviewError'), 'error');
    } finally {
      setSavingInt(false);
    }
  };

  const next = NEXT_STAGE[candidate.status];
  const stageColor = STAGE_COLOR[candidate.status];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)', animation: 'popIn 0.22s cubic-bezier(0.16,1,0.3,1)',
      }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
            background: `${stageColor}18`, border: `2px solid ${stageColor}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: stageColor,
          }}>
            {initials(candidate.fullName)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>
              {candidate.fullName}
            </div>
            {jobTitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>← {jobTitle}</div>}
            <span style={{
              display: 'inline-block', marginTop: 6,
              background: `${stageColor}14`, color: stageColor,
              borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 600,
            }}>
              {t(`ats.stage_${candidate.status}`)}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, padding: 4 }}>×</button>
        </div>

        {/* Contact Info */}
        <div style={{ background: 'var(--background)', borderRadius: 10, padding: '14px 16px', marginBottom: 18, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {candidate.email && (
            <div style={{ fontSize: 13 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Email</div>
              <a href={`mailto:${candidate.email}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{candidate.email}</a>
            </div>
          )}
          {candidate.phone && (
            <div style={{ fontSize: 13 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{t('ats.phone')}</div>
              <a href={`tel:${candidate.phone}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{candidate.phone}</a>
            </div>
          )}
          <div style={{ fontSize: 13 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{t('ats.source')}</div>
            <span style={{ textTransform: 'capitalize' }}>{candidate.source}</span>
          </div>
          <div style={{ fontSize: 13 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{t('ats.addedOn')}</div>
            {fmtDate(candidate.createdAt)}
          </div>
        </div>

        {/* Tags */}
        {candidate.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
            {candidate.tags.map((tag) => (
              <span key={tag} style={{
                background: 'var(--border)', color: 'var(--text-secondary)',
                borderRadius: 6, padding: '3px 10px', fontSize: 12,
              }}>{tag}</span>
            ))}
          </div>
        )}

        {/* Interviews */}
        {(candidate.status === 'interview' || interviews.length > 0) && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{t('ats.interviews')}</div>
              {!showInterviewForm && (
                <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setShowInterviewForm(true)}>
                  + {t('ats.addInterview')}
                </button>
              )}
            </div>
            {interviews.length === 0 && !showInterviewForm && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{t('ats.noInterviews')}</p>
            )}
            {interviews.map((iv) => (
              <div key={iv.id} style={{
                background: 'var(--background)', borderRadius: 8, padding: '10px 14px', marginBottom: 8, fontSize: 13,
              }}>
                <div style={{ fontWeight: 600 }}>{fmtDateTime(iv.scheduledAt)}</div>
                {iv.location && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>📍 {iv.location}</div>}
                {iv.feedback && <div style={{ color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>"{iv.feedback}"</div>}
              </div>
            ))}
            {showInterviewForm && (
              <form onSubmit={handleCreateInterview} style={{ background: 'var(--background)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{t('ats.interviewDate')} *</label>
                    <input type="date" className="field-input" value={intDate} onChange={(e) => setIntDate(e.target.value)} required style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{t('ats.interviewTime')}</label>
                    <input type="time" className="field-input" value={intTime} onChange={(e) => setIntTime(e.target.value)} style={{ width: '100%' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{t('ats.interviewLocation')}</label>
                  <input className="field-input" value={intLocation} onChange={(e) => setIntLocation(e.target.value)} placeholder={t('ats.interviewLocationPlaceholder')} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{t('common.notes')}</label>
                  <textarea className="field-input" value={intNotes} onChange={(e) => setIntNotes(e.target.value)} rows={2} style={{ width: '100%', resize: 'none', fontFamily: 'inherit' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setShowInterviewForm(false)}>{t('common.cancel')}</button>
                  <button type="submit" className="btn btn-primary" style={{ fontSize: 12 }} disabled={savingInt}>{savingInt ? t('common.saving') : t('ats.scheduleInterview')}</button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Actions */}
        {candidate.status !== 'hired' && candidate.status !== 'rejected' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            {next && (
              <button className="btn btn-primary" onClick={() => onAdvance(next)} disabled={saving} style={{ flex: 1 }}>
                {saving ? t('common.saving') : t(`ats.advanceTo_${next}`)}
              </button>
            )}
            <button className="btn" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5', flex: 1 }}
              onClick={onReject} disabled={saving}>
              {t('ats.reject')}
            </button>
            <button className="btn" style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', minWidth: 36 }}
              onClick={onDelete} disabled={saving} title={t('common.delete')}>
              🗑
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

// Jobs panel
const JobsPanel: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editJob, setEditJob] = useState<JobPosting | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getJobs(filterStatus ? { status: filterStatus } : undefined);
      setJobs(all);
    } catch {
      showToast(t('ats.errorLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSave = async (title: string, description: string, tags: string[]) => {
    setSaving(true);
    try {
      if (editJob) {
        const updated = await updateJob(editJob.id, { title, description, tags });
        setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
        showToast(t('ats.jobUpdated'), 'success');
      } else {
        const created = await createJob({ title, description, tags });
        setJobs((prev) => [created, ...prev]);
        showToast(t('ats.jobCreated'), 'success');
      }
      setShowModal(false);
      setEditJob(null);
    } catch (err) {
      showToast(translateApiError(err, t, t('ats.errorSave')) ?? t('ats.errorSave'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (job: JobPosting) => {
    if (!confirm(t('ats.confirmDeleteJob', { title: job.title }))) return;
    try {
      await deleteJob(job.id);
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      showToast(t('ats.jobDeleted'), 'success');
    } catch {
      showToast(t('ats.errorDelete'), 'error');
    }
  };

  const handlePublish = async (job: JobPosting) => {
    try {
      const updated = await publishJob(job.id);
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      showToast(t('ats.jobPublished'), 'success');
    } catch {
      showToast(t('ats.errorPublish'), 'error');
    }
  };

  const JOB_STATUS_LABELS: Record<string, string> = {
    draft: t('ats.status_draft'),
    published: t('ats.status_published'),
    closed: t('ats.status_closed'),
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          className="field-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ minWidth: 140 }}
        >
          <option value="">{t('common.all')}</option>
          <option value="draft">{t('ats.status_draft')}</option>
          <option value="published">{t('ats.status_published')}</option>
          <option value="closed">{t('ats.status_closed')}</option>
        </select>
        {canEdit && (
          <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => { setEditJob(null); setShowModal(true); }}>
            + {t('ats.newJob')}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {[1,2,3].map((i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 16, width: '40%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 12, width: '70%' }} />
              </div>
              <div className="skeleton" style={{ height: 28, width: 80, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('ats.noJobs')}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {jobs.map((job) => {
            const sc = STATUS_COLOR[job.status];
            return (
              <div key={job.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>{job.title}</div>
                  {job.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                      {job.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {job.tags.map((tag) => (
                      <span key={tag} style={{ background: 'var(--border)', color: 'var(--text-secondary)', borderRadius: 5, padding: '1px 8px', fontSize: 11 }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span style={{
                    background: `${sc}12`, color: sc, borderRadius: 8,
                    padding: '4px 12px', fontSize: 12, fontWeight: 600,
                  }}>
                    {JOB_STATUS_LABELS[job.status]}
                  </span>
                  {job.publishedAt && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(job.publishedAt)}</span>}
                  {canEdit && (
                    <>
                      {job.status === 'draft' && (
                        <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => handlePublish(job)}>
                          {t('ats.publish')}
                        </button>
                      )}
                      <button className="btn" style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, padding: '4px 10px' }}
                        onClick={() => { setEditJob(job); setShowModal(true); }}>
                        {t('common.edit')}
                      </button>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, padding: '0 2px', lineHeight: 1 }}
                        onClick={() => handleDelete(job)}>
                        ×
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <JobModal
          job={editJob}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditJob(null); }}
          saving={saving}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Kanban panel
// ---------------------------------------------------------------------------

const KanbanPanel: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterJob, setFilterJob] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addJobId, setAddJobId] = useState<string>('');
  const [addSaving, setAddSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [cands, js] = await Promise.all([
        getCandidates(filterJob ? { jobId: parseInt(filterJob) } : undefined),
        getJobs(),
      ]);
      setCandidates(cands);
      setJobs(js);
    } catch {
      showToast(t('ats.errorLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [filterJob]);

  useEffect(() => { fetch(); }, [fetch]);

  const byStage = (stage: CandidateStatus) =>
    candidates.filter((c) => c.status === stage).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const handleAdvance = async (status: CandidateStatus) => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await updateCandidateStage(selected.id, status);
      setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setSelected(updated);
      showToast(t('ats.stageUpdated'), 'success');
    } catch (err) {
      showToast(translateApiError(err, t, t('ats.errorStage')) ?? t('ats.errorStage'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await updateCandidateStage(selected.id, 'rejected');
      setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setSelected(null);
      showToast(t('ats.candidateRejected'), 'success');
    } catch {
      showToast(t('ats.errorStage'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(t('ats.confirmDeleteCandidate', { name: selected.fullName }))) return;
    setSaving(true);
    try {
      await deleteCandidate(selected.id);
      setCandidates((prev) => prev.filter((c) => c.id !== selected.id));
      setSelected(null);
      showToast(t('ats.candidateDeleted'), 'success');
    } catch {
      showToast(t('ats.errorDelete'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddSaving(true);
    try {
      const c = await createCandidate({
        fullName: addName.trim(),
        email: addEmail.trim() || undefined,
        phone: addPhone.trim() || undefined,
        jobPostingId: addJobId ? parseInt(addJobId) : undefined,
      });
      setCandidates((prev) => [c, ...prev]);
      setShowAddModal(false);
      setAddName(''); setAddEmail(''); setAddPhone(''); setAddJobId('');
      showToast(t('ats.candidateAdded'), 'success');
    } catch {
      showToast(t('ats.errorSave'), 'error');
    } finally {
      setAddSaving(false);
    }
  };

  const STAGE_LABELS: Record<CandidateStatus, string> = {
    received:  t('ats.stage_received'),
    review:    t('ats.stage_review'),
    interview: t('ats.stage_interview'),
    hired:     t('ats.stage_hired'),
    rejected:  t('ats.stage_rejected'),
  };

  const VISIBLE_STAGES: CandidateStatus[] = ['received', 'review', 'interview', 'hired', 'rejected'];

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="field-select" value={filterJob} onChange={(e) => setFilterJob(e.target.value)} style={{ minWidth: 180 }}>
          <option value="">{t('ats.allJobs')}</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        {canEdit && (
          <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setShowAddModal(true)}>
            + {t('ats.addCandidate')}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
          {['received','review','interview','hired','rejected'].map((s) => (
            <div key={s} style={{ minWidth: 240, flexShrink: 0, background: 'var(--background)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton" style={{ height: 12, width: '60%' }} />
              </div>
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1,2].map((i) => (
                  <div key={i} style={{ background: 'var(--surface)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div className="skeleton" style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div className="skeleton" style={{ height: 11, width: '70%', marginBottom: 6 }} />
                        <div className="skeleton" style={{ height: 10, width: '40%' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
          {VISIBLE_STAGES.map((stage) => {
            const sc = STAGE_COLOR[stage];
            const cols = byStage(stage);
            return (
              <div key={stage} style={{
                minWidth: 250, width: 260, flexShrink: 0,
                background: 'var(--background)', borderRadius: 12,
                border: `1px solid var(--border)`,
              }}>
                {/* Column header */}
                <div style={{
                  padding: '10px 14px', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: sc, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>
                    {STAGE_LABELS[stage]}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11,
                    background: `${sc}18`, color: sc, borderRadius: 99, padding: '1px 7px',
                  }}>
                    {cols.length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{ padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
                  {cols.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 12 }}>—</div>
                  )}
                  {cols.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className="kanban-card"
                      style={{
                        background: 'var(--surface)', border: `1px solid ${c.unread ? sc : 'var(--border)'}`,
                        borderRadius: 10, padding: '10px 12px', textAlign: 'left',
                        cursor: 'pointer', width: '100%',
                        boxShadow: c.unread ? `0 0 0 2px ${sc}22` : '0 1px 3px rgba(0,0,0,0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                          background: `${sc}16`, color: sc, fontFamily: 'var(--font-display)',
                          fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {initials(c.fullName)}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.fullName}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{fmtDate(c.createdAt)}</div>
                        </div>
                        {c.unread && <div style={{ width: 7, height: 7, borderRadius: '50%', background: sc, flexShrink: 0 }} />}
                      </div>
                      {c.email && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</div>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add candidate modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowAddModal(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', animation: 'popIn 0.22s cubic-bezier(0.16,1,0.3,1)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontFamily: 'var(--font-display)', fontSize: 17 }}>{t('ats.addCandidate')}</h3>
            <form onSubmit={handleAddCandidate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>{t('ats.candidateName')} *</label>
                <input className="field-input" value={addName} onChange={(e) => setAddName(e.target.value)} required placeholder="Mario Rossi" style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Email</label>
                  <input className="field-input" type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="mario@email.com" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>{t('ats.phone')}</label>
                  <input className="field-input" type="tel" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="+39 345..." style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>{t('ats.position')}</label>
                <select className="field-select" value={addJobId} onChange={(e) => setAddJobId(e.target.value)} style={{ width: '100%' }}>
                  <option value="">{t('ats.noPosition')}</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={addSaving || !addName.trim()}>{addSaving ? t('common.saving') : t('ats.addCandidate')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <CandidateModal
          candidate={selected}
          jobs={jobs}
          onClose={() => setSelected(null)}
          onAdvance={handleAdvance}
          onReject={handleReject}
          onDelete={handleDelete}
          saving={saving}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Alerts panel
// ---------------------------------------------------------------------------

const AlertsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<HRAlert[]>([]);
  const [risks, setRisks] = useState<JobRisk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAlerts(), getRisks()])
      .then(([a, r]) => { setAlerts(a); setRisks(r); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const ALERT_ICON: Record<string, string> = {
    new_candidates:     '👤',
    interview_today:    '🗓',
    candidates_pending: '⏳',
    job_at_risk:        '⚠️',
  };

  const ALERT_COLOR: Record<string, string> = {
    new_candidates:     '#0284C7',
    interview_today:    '#7C3AED',
    candidates_pending: '#C9973A',
    job_at_risk:        '#DC2626',
  };

  const RISK_COLORS: Record<string, string> = {
    ok: '#15803D', medium: '#C9973A', high: '#DC2626',
  };

  if (loading) return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      {[1,2,3].map((i) => (
        <div key={i} style={{ background: 'var(--surface)', borderRadius: 12, padding: '16px 18px', border: '1px solid var(--border)', display: 'flex', gap: 14 }}>
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 12, width: '80%' }} />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Alerts */}
      <div>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('ats.hrAlerts')}
        </h3>
        {alerts.length === 0 ? (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
            padding: '28px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('ats.noAlerts')}</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {alerts.map((alert, i) => {
              const ac = ALERT_COLOR[alert.type] ?? '#6B7280';
              return (
                <div key={i} style={{
                  background: 'var(--surface)', border: `1px solid ${ac}30`,
                  borderLeft: `4px solid ${ac}`,
                  borderRadius: 12, padding: '16px 18px',
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                }}>
                  <div style={{ fontSize: 24, flexShrink: 0, lineHeight: 1 }}>{ALERT_ICON[alert.type] ?? '🔔'}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>{alert.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{alert.message}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Risks */}
      {risks.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('ats.jobRisks')}
          </h3>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{t('ats.jobTitle')}</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{t('ats.riskLevel')}</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{t('ats.riskFlags')}</th>
                </tr>
              </thead>
              <tbody>
                {risks.filter((r) => r.riskLevel !== 'ok').map((risk) => {
                  const rc = RISK_COLORS[risk.riskLevel];
                  const flags = [
                    risk.flags.lowCandidates && t('ats.flag_lowCandidates'),
                    risk.flags.noInterviews && t('ats.flag_noInterviews'),
                    risk.flags.noHires && t('ats.flag_noHires'),
                  ].filter(Boolean) as string[];
                  return (
                    <tr key={risk.jobPostingId} style={{ borderBottom: '1px solid var(--border)' }} className="tr-hoverable">
                      <td style={{ padding: '12px 16px', fontWeight: 500, fontSize: 14 }}>{risk.jobTitle}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: `${rc}14`, color: rc, borderRadius: 6,
                          padding: '3px 10px', fontSize: 12, fontWeight: 600,
                        }}>
                          {t(`ats.risk_${risk.riskLevel}`)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {flags.join(' · ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main ATSPage
// ---------------------------------------------------------------------------

export default function ATSPage() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const canEdit = !!user && ['admin', 'hr'].includes(user.role);
  const defaultTab = canEdit ? 'candidates' : 'candidates';

  const [tab, setTab] = useState<'jobs' | 'candidates' | 'alerts'>(defaultTab);

  const tabs = [
    ...(canEdit ? [{ key: 'jobs', label: t('ats.tabJobs') }] : []),
    { key: 'candidates', label: t('ats.tabCandidates') },
    { key: 'alerts', label: t('ats.tabAlerts') },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }} className="page-enter">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('nav.ats')}
        </h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
          {t('ats.subtitle')}
        </p>
      </div>

      <TabBar tabs={tabs} active={tab} onChange={(k) => setTab(k as typeof tab)} />

      {tab === 'jobs' && canEdit && <JobsPanel canEdit={canEdit} />}
      {tab === 'candidates' && <KanbanPanel canEdit={canEdit} />}
      {tab === 'alerts' && <AlertsPanel />}
    </div>
  );
}
