import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { translateApiError } from '../../utils/apiErrors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { getApiBaseUrl } from '../../api/client';
import {
  getJobs, createJob, updateJob, deleteJob, publishJob,
  getCandidates, createCandidate, updateCandidateStage, deleteCandidate,
  getInterviews, createInterview,
  getAlerts, getRisks,
  JobPosting, Candidate, Interview, HRAlert, JobRisk,
  CandidateStatus, JobStatus,
} from '../../api/ats';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAGES: CandidateStatus[] = ['received', 'review', 'interview', 'hired', 'rejected'];

const NEXT_STAGE: Partial<Record<CandidateStatus, CandidateStatus>> = {
  received: 'review',
  review: 'interview',
  interview: 'hired',
};

const STAGE_COLOR: Record<CandidateStatus, string> = {
  received:  '#0284C7',
  review:    '#7C3AED',
  interview: '#C9973A',
  hired:     '#15803D',
  rejected:  '#DC2626',
};

const STAGE_BG: Record<CandidateStatus, string> = {
  received:  'rgba(2,132,199,0.08)',
  review:    'rgba(124,58,237,0.08)',
  interview: 'rgba(201,151,58,0.10)',
  hired:     'rgba(21,128,61,0.08)',
  rejected:  'rgba(220,38,38,0.07)',
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
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ─── Shared modal backdrop ─────────────────────────────────────────────────────

const ModalBackdrop: React.FC<{ onClose: () => void; width?: number; children: React.ReactNode }> = ({
  onClose, width = 520, children,
}) =>
  createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(13,33,55,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)', borderRadius: 16,
          width: '100%', maxWidth: width, maxHeight: '92vh', overflowY: 'auto',
          boxShadow: '0 24px 72px rgba(0,0,0,0.22)',
          animation: 'popIn 0.22s cubic-bezier(0.16,1,0.3,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );

// ─── Job form modal ────────────────────────────────────────────────────────────

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
    <ModalBackdrop onClose={onClose}>
      {/* Header */}
      <div style={{
        padding: '20px 28px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
            {job ? t('ats.editJob') : t('ats.newJob')}
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            {job ? t('ats.jobTitle') : t('ats.jobTitlePlaceholder')}
          </p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 22, lineHeight: 1, padding: '2px 6px', borderRadius: 6 }}>×</button>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input
          label={`${t('ats.jobTitle')} *`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder={t('ats.jobTitlePlaceholder')}
          autoFocus
        />

        <div>
          <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
            {t('ats.jobDescription')}
          </label>
          <textarea
            className="field-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder={t('ats.jobDescriptionPlaceholder')}
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', padding: '8px 12px', fontSize: 13.5, borderRadius: 'var(--radius)', border: '1px solid var(--border)', outline: 'none', display: 'block' }}
          />
        </div>

        <Input
          label={t('ats.jobTags')}
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder={t('ats.jobTagsPlaceholder')}
          hint="Separate with commas"
        />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 }}>
          <Button variant="secondary" type="button" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" loading={saving} disabled={!title.trim()}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </ModalBackdrop>
  );
};

// ─── Candidate detail panel ────────────────────────────────────────────────────

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
  const { showToast } = useToast();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [intDate, setIntDate] = useState('');
  const [intTime, setIntTime] = useState('09:00');
  const [intLocation, setIntLocation] = useState('');
  const [intNotes, setIntNotes] = useState('');
  const [savingInt, setSavingInt] = useState(false);

  const jobTitle = jobs.find((j) => j.id === candidate.jobPostingId)?.title;
  const stageColor = STAGE_COLOR[candidate.status];
  const stageBg = STAGE_BG[candidate.status];
  const next = NEXT_STAGE[candidate.status];

  useEffect(() => {
    getInterviews(candidate.id).then(setInterviews).catch(() => {});
  }, [candidate.id]);

  const handleCreateInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intDate) return;
    setSavingInt(true);
    try {
      const scheduledAt = new Date(`${intDate}T${intTime}:00`).toISOString();
      const iv = await createInterview(candidate.id, {
        scheduledAt,
        location: intLocation || undefined,
        notes: intNotes || undefined,
      });
      setInterviews((prev) => [...prev, iv]);
      setShowInterviewForm(false);
      setIntDate(''); setIntTime('09:00'); setIntLocation(''); setIntNotes('');
      showToast(t('ats.interviewCreated'), 'success');
    } catch {
      showToast(t('ats.interviewError'), 'error');
    } finally {
      setSavingInt(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose} width={580}>
      {/* Gradient header */}
      <div style={{
        background: `linear-gradient(135deg, ${stageColor}18 0%, ${stageColor}08 100%)`,
        borderBottom: `3px solid ${stageColor}`,
        padding: '24px 28px 20px',
        position: 'relative',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 18, lineHeight: 1,
          width: 28, height: 28, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Avatar */}
          <div style={{
            width: 54, height: 54, borderRadius: '50%', flexShrink: 0,
            background: stageColor, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18,
            boxShadow: `0 4px 16px ${stageColor}40`,
          }}>
            {initials(candidate.fullName)}
          </div>

          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--text-primary)', marginBottom: 4 }}>
              {candidate.fullName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                background: stageColor, color: '#fff',
                borderRadius: 99, padding: '2px 12px', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                {t(`ats.stage_${candidate.status}`)}
              </span>
              {jobTitle && (
                <span style={{
                  background: 'var(--surface)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', borderRadius: 99,
                  padding: '2px 10px', fontSize: 11,
                }}>
                  📌 {jobTitle}
                </span>
              )}
              {candidate.unread && (
                <span style={{
                  background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE',
                  borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 700,
                }}>
                  NEW
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Contact grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12,
          background: 'var(--background)', borderRadius: 12, padding: '14px 16px',
        }}>
          {[
            { label: 'Email', value: candidate.email, href: candidate.email ? `mailto:${candidate.email}` : undefined },
            { label: t('ats.phone'), value: candidate.phone, href: candidate.phone ? `tel:${candidate.phone}` : undefined },
            { label: t('ats.source'), value: candidate.source },
            { label: t('ats.addedOn'), value: fmtDate(candidate.createdAt) },
          ].filter((i) => i.value).map((item) => (
            <div key={item.label}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
                {item.label}
              </div>
              {item.href ? (
                <a href={item.href} style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}>
                  {item.value}
                </a>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, textTransform: 'capitalize' }}>{item.value}</div>
              )}
            </div>
          ))}
        </div>

        {/* Tags */}
        {candidate.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {candidate.tags.map((tag) => (
              <span key={tag} style={{
                background: 'var(--accent-light, rgba(201,151,58,0.10))',
                color: 'var(--accent)', border: '1px solid rgba(201,151,58,0.2)',
                borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 500,
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Stage pipeline visual */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Pipeline
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {(['received', 'review', 'interview', 'hired'] as CandidateStatus[]).map((s, idx) => {
              const stageIdx = ['received', 'review', 'interview', 'hired', 'rejected'].indexOf(candidate.status);
              const thisIdx = idx;
              const isDone = candidate.status !== 'rejected' && stageIdx >= thisIdx;
              const isCurrent = candidate.status !== 'rejected' && stageIdx === thisIdx;
              const sc = STAGE_COLOR[s];
              return (
                <React.Fragment key={s}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: isDone ? sc : 'var(--border)',
                      border: isCurrent ? `3px solid ${sc}` : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                      boxShadow: isCurrent ? `0 0 0 3px ${sc}22` : 'none',
                    }}>
                      {isDone && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                    </div>
                    <div style={{ fontSize: 10, color: isDone ? sc : 'var(--text-muted)', fontWeight: isCurrent ? 700 : 400, marginTop: 4, textAlign: 'center' }}>
                      {t(`ats.stage_${s}`)}
                    </div>
                  </div>
                  {idx < 3 && (
                    <div style={{
                      height: 2, flex: 1, marginBottom: 18,
                      background: candidate.status !== 'rejected' && stageIdx > idx ? sc : 'var(--border)',
                      transition: 'background 0.3s',
                    }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          {candidate.status === 'rejected' && (
            <div style={{
              marginTop: 8, padding: '6px 12px', background: '#FEF2F2',
              border: '1px solid #FCA5A5', borderRadius: 8,
              fontSize: 12, color: '#DC2626', fontWeight: 600, textAlign: 'center',
            }}>
              ✕ {t('ats.stage_rejected')}
            </div>
          )}
        </div>

        {/* Interviews section */}
        {(candidate.status === 'interview' || interviews.length > 0) && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                🗓 {t('ats.interviews')}
                {interviews.length > 0 && (
                  <span style={{ background: 'var(--primary)', color: 'var(--accent)', borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>
                    {interviews.length}
                  </span>
                )}
              </div>
              {!showInterviewForm && (
                <Button variant="secondary" size="sm" onClick={() => setShowInterviewForm(true)}>
                  + {t('ats.addInterview')}
                </Button>
              )}
            </div>

            {interviews.length === 0 && !showInterviewForm && (
              <div style={{
                background: 'var(--background)', borderRadius: 10, padding: '12px 16px',
                fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic',
              }}>
                {t('ats.noInterviews')}
              </div>
            )}

            {interviews.map((iv) => (
              <div key={iv.id} style={{
                background: 'var(--background)', borderRadius: 10, padding: '12px 16px',
                marginBottom: 8, borderLeft: `3px solid ${STAGE_COLOR.interview}`,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>
                  🕐 {fmtDateTime(iv.scheduledAt)}
                </div>
                {iv.location && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>📍 {iv.location}</div>
                )}
                {iv.notes && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{iv.notes}</div>
                )}
                {iv.feedback && (
                  <div style={{
                    fontSize: 12, color: 'var(--text-secondary)', marginTop: 6,
                    fontStyle: 'italic', padding: '6px 10px',
                    background: 'var(--surface)', borderRadius: 6, borderLeft: '2px solid var(--accent)',
                  }}>
                    "{iv.feedback}"
                  </div>
                )}
              </div>
            ))}

            {showInterviewForm && (
              <form onSubmit={handleCreateInterview} style={{
                background: 'var(--background)', borderRadius: 12, padding: '16px',
                display: 'flex', flexDirection: 'column', gap: 12,
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                      {t('ats.interviewDate')} *
                    </label>
                    <input type="date" className="field-input" value={intDate} onChange={(e) => setIntDate(e.target.value)} required
                      style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', outline: 'none', display: 'block' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                      {t('ats.interviewTime')}
                    </label>
                    <input type="time" className="field-input" value={intTime} onChange={(e) => setIntTime(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', outline: 'none', display: 'block' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    {t('ats.interviewLocation')}
                  </label>
                  <input className="field-input" value={intLocation} onChange={(e) => setIntLocation(e.target.value)}
                    placeholder={t('ats.interviewLocationPlaceholder')}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', outline: 'none', display: 'block' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    {t('common.notes')}
                  </label>
                  <textarea className="field-input" value={intNotes} onChange={(e) => setIntNotes(e.target.value)} rows={2}
                    style={{ width: '100%', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit', padding: '7px 10px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--border)', outline: 'none', display: 'block' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button variant="secondary" size="sm" type="button" onClick={() => setShowInterviewForm(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button variant="primary" size="sm" type="submit" loading={savingInt}>
                    {t('ats.scheduleInterview')}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Action footer */}
        {candidate.status !== 'hired' && candidate.status !== 'rejected' && (
          <div style={{
            display: 'flex', gap: 8, flexWrap: 'wrap',
            paddingTop: 16, borderTop: '1px solid var(--border)',
          }}>
            {next && (
              <Button variant="primary" onClick={() => onAdvance(next)} loading={saving} style={{ flex: 1, minWidth: 140 }}>
                {t(`ats.advanceTo_${next}`)}
              </Button>
            )}
            <Button
              variant="danger"
              onClick={onReject}
              loading={saving}
              style={{ flex: 1, minWidth: 100 }}
            >
              {t('ats.reject')}
            </Button>
            <button
              onClick={onDelete}
              disabled={saving}
              style={{
                background: 'var(--background)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', borderRadius: 'var(--radius)',
                cursor: 'pointer', padding: '8px 12px', fontSize: 16, lineHeight: 1,
                flexShrink: 0,
              }}
              title={t('common.delete')}
            >
              🗑
            </button>
          </div>
        )}
      </div>
    </ModalBackdrop>
  );
};

// ─── Jobs Panel ────────────────────────────────────────────────────────────────

const JobsPanel: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editJob, setEditJob] = useState<JobPosting | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [feedCopied, setFeedCopied] = useState(false);

  const feedUrl = user?.companyId
    ? `${getApiBaseUrl()}/ats/feed/${user.companyId}/jobs.xml`
    : null;

  const handleCopyFeed = () => {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl).then(() => {
      setFeedCopied(true);
      showToast(t('ats.feedCopied'), 'success');
      setTimeout(() => setFeedCopied(false), 2500);
    });
  };

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      setJobs(await getJobs(filterStatus ? { status: filterStatus } : undefined));
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
      setShowModal(false); setEditJob(null);
    } catch (err) {
      showToast(translateApiError(err, t, t('ats.errorSave')) ?? t('ats.errorSave'), 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (job: JobPosting) => {
    if (!confirm(t('ats.confirmDeleteJob', { title: job.title }))) return;
    try {
      await deleteJob(job.id);
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      showToast(t('ats.jobDeleted'), 'success');
    } catch { showToast(t('ats.errorDelete'), 'error'); }
  };

  const handlePublish = async (job: JobPosting) => {
    try {
      const updated = await publishJob(job.id);
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      showToast(t('ats.jobPublished'), 'success');
    } catch { showToast(t('ats.errorPublish'), 'error'); }
  };

  // Status counts
  const counts = { all: jobs.length, draft: jobs.filter((j) => j.status === 'draft').length, published: jobs.filter((j) => j.status === 'published').length, closed: jobs.filter((j) => j.status === 'closed').length };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Status filter pills */}
        <div style={{ display: 'flex', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4 }}>
          {[
            { value: '', label: t('common.all'), count: counts.all },
            { value: 'draft', label: t('ats.status_draft'), count: counts.draft },
            { value: 'published', label: t('ats.status_published'), count: counts.published },
            { value: 'closed', label: t('ats.status_closed'), count: counts.closed },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              style={{
                padding: '5px 12px', border: 'none', borderRadius: 7,
                background: filterStatus === opt.value ? 'var(--primary)' : 'transparent',
                color: filterStatus === opt.value ? '#fff' : 'var(--text-secondary)',
                fontWeight: filterStatus === opt.value ? 600 : 400,
                fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: 'var(--font-body)',
              }}
            >
              {opt.label}
              {opt.count > 0 && (
                <span style={{
                  background: filterStatus === opt.value ? 'rgba(255,255,255,0.2)' : 'var(--background)',
                  color: filterStatus === opt.value ? '#fff' : 'var(--text-muted)',
                  borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '0 5px',
                  minWidth: 16, textAlign: 'center',
                }}>
                  {opt.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {canEdit && (
          <Button variant="primary" size="sm" style={{ marginLeft: 'auto' }} onClick={() => { setEditJob(null); setShowModal(true); }}>
            <span style={{ fontSize: 16 }}>+</span> {t('ats.newJob')}
          </Button>
        )}
      </div>

      {/* Feed URL banner */}
      {canEdit && feedUrl && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(13,33,55,0.04) 0%, rgba(201,151,58,0.06) 100%)',
          border: '1px solid var(--border)',
          borderLeft: '3px solid var(--accent)',
          borderRadius: 12,
          padding: '14px 18px',
          marginBottom: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              📡 {t('ats.feedTitle')}
            </span>
            <span style={{
              background: 'rgba(201,151,58,0.15)', color: '#92600a',
              borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '2px 7px',
              border: '1px solid rgba(201,151,58,0.25)',
            }}>
              {t('ats.indeedApiPending')}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {t('ats.indeedApiPendingHint')}
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{
              flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 7, padding: '6px 10px', fontSize: 11.5,
              color: 'var(--text-primary)', fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {feedUrl}
            </code>
            <Button variant="secondary" size="sm" onClick={handleCopyFeed} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              {feedCopied ? '✓ ' + t('common.copied', 'Copied') : t('common.copy', 'Copy URL')}
            </Button>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {t('ats.feedHint')}
          </p>
        </div>
      )}

      {/* Job list */}
      {loading ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 22px', display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 16, width: '35%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 12, width: '60%', marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="skeleton" style={{ height: 20, width: 50, borderRadius: 99 }} />
                  <div className="skeleton" style={{ height: 20, width: 60, borderRadius: 99 }} />
                </div>
              </div>
              <div className="skeleton" style={{ height: 28, width: 80, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '56px 24px',
          background: 'var(--surface)', borderRadius: 16,
          border: '1px dashed var(--border)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>💼</div>
          <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: 6 }}>
            {t('ats.noJobs')}
          </div>
          {canEdit && (
            <div style={{ marginTop: 16 }}>
              <Button variant="primary" onClick={() => setShowModal(true)}>
                + {t('ats.newJob')}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {jobs.map((job) => {
            const sc = STATUS_COLOR[job.status];
            const isHovered = hoveredId === job.id;
            return (
              <div
                key={job.id}
                onMouseEnter={() => setHoveredId(job.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderLeft: `4px solid ${sc}`,
                  borderRadius: 14, padding: '16px 20px',
                  display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                  transition: 'box-shadow 0.18s, transform 0.18s',
                  boxShadow: isHovered ? 'var(--shadow)' : 'none',
                  transform: isHovered ? 'translateY(-1px)' : 'none',
                }}
              >
                {/* Text block */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{job.title}</span>
                    <span style={{
                      background: `${sc}14`, color: sc, borderRadius: 99,
                      padding: '2px 10px', fontSize: 11, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      {t(`ats.status_${job.status}`)}
                    </span>
                  </div>
                  {job.description && (
                    <div style={{
                      fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8,
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                    }}>
                      {job.description}
                    </div>
                  )}
                  {job.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {job.tags.map((tag) => (
                        <span key={tag} style={{
                          background: 'rgba(201,151,58,0.10)', color: 'var(--accent)',
                          border: '1px solid rgba(201,151,58,0.2)',
                          borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 500,
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Meta + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                  {job.publishedAt && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      📅 {fmtDate(job.publishedAt)}
                    </span>
                  )}
                  {canEdit && (
                    <>
                      {job.status === 'draft' && (
                        <Button variant="accent" size="sm" onClick={() => handlePublish(job)}>
                          {t('ats.publish')}
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => { setEditJob(job); setShowModal(true); }}>
                        {t('common.edit')}
                      </Button>
                      <button
                        onClick={() => handleDelete(job)}
                        style={{
                          background: 'none', border: '1px solid var(--border)',
                          cursor: 'pointer', color: 'var(--text-muted)', fontSize: 15,
                          borderRadius: 'var(--radius-sm)', padding: '4px 8px', lineHeight: 1,
                        }}
                        title={t('common.delete')}
                      >
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

// ─── Kanban Panel ─────────────────────────────────────────────────────────────

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
      setCandidates(cands); setJobs(js);
    } catch { showToast(t('ats.errorLoad'), 'error'); }
    finally { setLoading(false); }
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
    } finally { setSaving(false); }
  };

  const handleReject = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await updateCandidateStage(selected.id, 'rejected');
      setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setSelected(null);
      showToast(t('ats.candidateRejected'), 'success');
    } catch { showToast(t('ats.errorStage'), 'error'); }
    finally { setSaving(false); }
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
    } catch { showToast(t('ats.errorDelete'), 'error'); }
    finally { setSaving(false); }
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
    } catch { showToast(t('ats.errorSave'), 'error'); }
    finally { setAddSaving(false); }
  };

  const STAGE_LABELS: Record<CandidateStatus, string> = {
    received:  t('ats.stage_received'),
    review:    t('ats.stage_review'),
    interview: t('ats.stage_interview'),
    hired:     t('ats.stage_hired'),
    rejected:  t('ats.stage_rejected'),
  };

  const STAGE_ICON: Record<CandidateStatus, string> = {
    received:  '📥',
    review:    '🔍',
    interview: '🎤',
    hired:     '✅',
    rejected:  '✕',
  };

  const publishedJobs = jobs.filter((j) => j.status === 'published');

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <select
            className="field-select"
            value={filterJob}
            onChange={(e) => setFilterJob(e.target.value)}
            style={{
              minWidth: 200, padding: '8px 32px 8px 12px', fontSize: 13,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, color: 'var(--text-primary)', cursor: 'pointer',
              appearance: 'none',
            }}
          >
            <option value="">{t('ats.allJobs')}</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)', fontSize: 11 }}>▼</span>
        </div>

        {/* Pipeline summary */}
        {!loading && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STAGES.filter((s) => byStage(s).length > 0).map((s) => (
              <span key={s} style={{
                fontSize: 11, fontWeight: 600,
                background: STAGE_BG[s], color: STAGE_COLOR[s],
                border: `1px solid ${STAGE_COLOR[s]}30`,
                borderRadius: 99, padding: '3px 9px',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {STAGE_ICON[s]} {byStage(s).length}
              </span>
            ))}
          </div>
        )}

        {canEdit && (
          <Button variant="primary" size="sm" style={{ marginLeft: 'auto' }} onClick={() => setShowAddModal(true)}>
            <span style={{ fontSize: 16 }}>+</span> {t('ats.addCandidate')}
          </Button>
        )}
      </div>

      {/* Board */}
      {loading ? (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
          {STAGES.map((s) => (
            <div key={s} style={{ minWidth: 240, flexShrink: 0, background: 'var(--background)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ height: 4, background: STAGE_COLOR[s] }} />
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                <div className="skeleton" style={{ height: 12, width: '55%' }} />
              </div>
              <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2].map((i) => (
                  <div key={i} style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div className="skeleton" style={{ height: 11, width: '65%', marginBottom: 6 }} />
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
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
          {STAGES.map((stage) => {
            const sc = STAGE_COLOR[stage];
            const sb = STAGE_BG[stage];
            const cols = byStage(stage);
            return (
              <div
                key={stage}
                style={{
                  minWidth: 252, width: 252, flexShrink: 0,
                  background: 'var(--background)',
                  borderRadius: 14, overflow: 'hidden',
                  border: '1px solid var(--border)',
                }}
              >
                {/* Column top bar */}
                <div style={{ height: 4, background: sc }} />

                {/* Column header */}
                <div style={{
                  padding: '10px 14px 10px',
                  borderBottom: `1px solid var(--border)`,
                  background: sb,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 15 }}>{STAGE_ICON[stage]}</span>
                  <span style={{ fontWeight: 700, fontSize: 12.5, color: sc, flex: 1, fontFamily: 'var(--font-display)' }}>
                    {STAGE_LABELS[stage]}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12,
                    background: sc, color: '#fff', borderRadius: 99, padding: '1px 8px',
                    minWidth: 20, textAlign: 'center',
                  }}>
                    {cols.length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 80 }}>
                  {cols.length === 0 && (
                    <div style={{
                      textAlign: 'center', padding: '20px 8px',
                      color: 'var(--text-muted)', fontSize: 12,
                      border: '1px dashed var(--border)', borderRadius: 10,
                    }}>
                      —
                    </div>
                  )}
                  {cols.map((c) => {
                    const jobName = jobs.find((j) => j.id === c.jobPostingId)?.title;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelected(c)}
                        style={{
                          background: 'var(--surface)',
                          border: `1px solid ${c.unread ? sc : 'var(--border)'}`,
                          borderRadius: 10, padding: '10px 12px',
                          textAlign: 'left', cursor: 'pointer', width: '100%',
                          boxShadow: c.unread
                            ? `0 0 0 2px ${sc}22, 0 2px 8px rgba(0,0,0,0.07)`
                            : '0 1px 3px rgba(0,0,0,0.05)',
                          transition: 'box-shadow 0.15s, transform 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,0.10)`;
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = c.unread ? `0 0 0 2px ${sc}22, 0 2px 8px rgba(0,0,0,0.07)` : '0 1px 3px rgba(0,0,0,0.05)';
                          e.currentTarget.style.transform = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: jobName || c.email ? 6 : 0 }}>
                          {/* Avatar */}
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: sc, color: '#fff',
                            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: `0 2px 6px ${sc}30`,
                          }}>
                            {initials(c.fullName)}
                          </div>

                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{
                              fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {c.fullName}
                            </div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>
                              {fmtDate(c.createdAt)}
                            </div>
                          </div>

                          {c.unread && (
                            <div style={{
                              width: 7, height: 7, borderRadius: '50%',
                              background: sc, flexShrink: 0,
                              boxShadow: `0 0 0 2px ${sc}30`,
                            }} />
                          )}
                        </div>

                        {/* Position tag */}
                        {jobName && (
                          <div style={{
                            fontSize: 10.5, color: 'var(--text-muted)',
                            background: 'var(--background)', borderRadius: 5,
                            padding: '2px 7px', marginTop: 2, display: 'inline-block',
                            border: '1px solid var(--border)',
                            maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            📌 {jobName}
                          </div>
                        )}

                        {/* Email */}
                        {c.email && (
                          <div style={{
                            fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            ✉ {c.email}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Candidate Modal */}
      {showAddModal && (
        <ModalBackdrop onClose={() => setShowAddModal(false)} width={480}>
          <div style={{ padding: '20px 28px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                {t('ats.addCandidate')}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                {t('ats.candidateName')}
              </p>
            </div>
            <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 22, padding: '2px 6px' }}>×</button>
          </div>

          <form onSubmit={handleAddCandidate} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input
              label={`${t('ats.candidateName')} *`}
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              required
              placeholder="Mario Rossi"
              autoFocus
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Email" type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="mario@email.com" />
              <Input label={t('ats.phone')} type="tel" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="+39 345..." />
            </div>

            <div>
              <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                {t('ats.position')}
              </label>
              <select
                value={addJobId}
                onChange={(e) => setAddJobId(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', fontSize: 13.5,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', color: 'var(--text-primary)',
                  outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
                }}
              >
                <option value="">{t('ats.noPosition')}</option>
                {publishedJobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                {publishedJobs.length === 0 && jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 }}>
              <Button variant="secondary" type="button" onClick={() => setShowAddModal(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="primary" type="submit" loading={addSaving} disabled={!addName.trim()}>
                {t('ats.addCandidate')}
              </Button>
            </div>
          </form>
        </ModalBackdrop>
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

// ─── Alerts Panel ─────────────────────────────────────────────────────────────

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

  const RISK_BG: Record<string, string> = {
    ok: 'rgba(21,128,61,0.08)', medium: 'rgba(201,151,58,0.10)', high: 'rgba(220,38,38,0.07)',
  };

  if (loading) return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ background: 'var(--surface)', borderRadius: 14, padding: '18px 20px', border: '1px solid var(--border)', display: 'flex', gap: 14 }}>
          <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 14, width: '55%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 12, width: '80%' }} />
          </div>
        </div>
      ))}
    </div>
  );

  const atRiskJobs = risks.filter((r) => r.riskLevel !== 'ok');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* HR Alerts */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            🔔 {t('ats.hrAlerts')}
          </h3>
          {alerts.length > 0 && (
            <span style={{
              background: '#DC2626', color: '#fff', borderRadius: 99,
              fontSize: 11, fontWeight: 700, padding: '1px 8px',
            }}>
              {alerts.length}
            </span>
          )}
        </div>

        {alerts.length === 0 ? (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '36px 28px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 15, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: 4 }}>
              {t('ats.noAlerts')}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {alerts.map((alert, i) => {
              const ac = ALERT_COLOR[alert.type] ?? '#6B7280';
              return (
                <div key={i} style={{
                  background: 'var(--surface)',
                  border: `1px solid ${ac}25`,
                  borderLeft: `4px solid ${ac}`,
                  borderRadius: 14, padding: '16px 20px',
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                  transition: 'box-shadow 0.15s',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: `${ac}14`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20,
                  }}>
                    {ALERT_ICON[alert.type] ?? '🔔'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {alert.title}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {alert.message}
                    </div>
                    {alert.count > 1 && (
                      <div style={{
                        marginTop: 8, display: 'inline-flex', alignItems: 'center',
                        background: `${ac}14`, color: ac,
                        borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700,
                      }}>
                        {alert.count} items
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* At-risk positions */}
      {atRiskJobs.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              ⚠️ {t('ats.jobRisks')}
            </h3>
            <span style={{
              background: '#DC262614', color: '#DC2626', border: '1px solid #DC262625',
              borderRadius: 99, fontSize: 11, fontWeight: 700, padding: '1px 8px',
            }}>
              {atRiskJobs.length}
            </span>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {atRiskJobs.map((risk) => {
              const rc = RISK_COLORS[risk.riskLevel];
              const rb = RISK_BG[risk.riskLevel];
              const flags = [
                risk.flags.lowCandidates && t('ats.flag_lowCandidates'),
                risk.flags.noInterviews && t('ats.flag_noInterviews'),
                risk.flags.noHires && t('ats.flag_noHires'),
              ].filter(Boolean) as string[];
              return (
                <div key={risk.jobPostingId} style={{
                  background: 'var(--surface)', border: `1px solid ${rc}25`,
                  borderRadius: 14, padding: '14px 20px',
                  display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: rc, flexShrink: 0,
                    boxShadow: `0 0 0 4px ${rc}20`,
                  }} />
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {risk.jobTitle}
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {flags.map((flag) => (
                        <span key={flag} style={{
                          background: `${rc}12`, color: rc,
                          border: `1px solid ${rc}25`,
                          borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 500,
                        }}>
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span style={{
                    background: rb, color: rc,
                    border: `1px solid ${rc}25`,
                    borderRadius: 99, padding: '4px 14px', fontSize: 12, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    flexShrink: 0,
                  }}>
                    {t(`ats.risk_${risk.riskLevel}`)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main ATSPage ─────────────────────────────────────────────────────────────

export default function ATSPage() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const canEdit = !!user && ['admin', 'hr'].includes(user.role);
  const [tab, setTab] = useState<'jobs' | 'candidates' | 'alerts'>('candidates');

  const tabs = [
    ...(canEdit ? [{ key: 'jobs', label: t('ats.tabJobs'), icon: '💼' }] : []),
    { key: 'candidates', label: t('ats.tabCandidates'), icon: '👥' },
    { key: 'alerts', label: t('ats.tabAlerts'), icon: '🔔' },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }} className="page-enter">

      {/* Hero header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #163352 100%)',
        borderRadius: 16, padding: '28px 32px', marginBottom: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16,
        boxShadow: '0 8px 32px rgba(13,33,55,0.14)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'rgba(201,151,58,0.18)',
              border: '1px solid rgba(201,151,58,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>
              🎯
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800,
              color: '#fff', margin: 0, letterSpacing: '-0.02em',
            }}>
              {t('nav.ats')}
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.65)', maxWidth: 480 }}>
            {t('ats.subtitle')}
          </p>
        </div>

        {/* Stage pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(Object.entries({
            received:  STAGE_COLOR.received,
            review:    STAGE_COLOR.review,
            interview: STAGE_COLOR.interview,
            hired:     STAGE_COLOR.hired,
          }) as [CandidateStatus, string][]).map(([stage, color]) => (
            <div key={stage} style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${color}50`,
              borderRadius: 8, padding: '6px 12px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                {t(`ats.stage_${stage}`)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pill tab switcher */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 28,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 4, width: 'fit-content',
      }}>
        {tabs.map((tb) => {
          const isActive = tab === tb.key;
          return (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key as typeof tab)}
              style={{
                padding: '8px 20px',
                background: isActive ? 'var(--primary)' : 'transparent',
                border: 'none', borderRadius: 9,
                color: isActive ? '#fff' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400,
                fontSize: 14, cursor: 'pointer',
                transition: 'all 0.18s ease',
                display: 'flex', alignItems: 'center', gap: 7,
                fontFamily: 'var(--font-body)',
                boxShadow: isActive ? '0 2px 8px rgba(13,33,55,0.18)' : 'none',
              }}
            >
              <span style={{ fontSize: 15 }}>{tb.icon}</span>
              {tb.label}
            </button>
          );
        })}
      </div>

      {tab === 'jobs' && canEdit && <JobsPanel canEdit={canEdit} />}
      {tab === 'candidates' && <KanbanPanel canEdit={canEdit} />}
      {tab === 'alerts' && <AlertsPanel />}
    </div>
  );
}
