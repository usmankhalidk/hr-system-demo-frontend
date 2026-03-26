import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Reply, Plus, Inbox } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Message } from '../../types';
import {
  getMessages, markMessageAsRead, getHrRecipient,
} from '../../api/messages';
import { translateApiError } from '../../utils/apiErrors';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { ComposeMessage } from './ComposeMessage';
import { useBreakpoint } from '../../hooks/useBreakpoint';

/* ─── helpers ────────────────────────────────────────────────────────────── */

function formatRelativeDate(dateStr: string, lang: string): string {
  try {
    const locale = lang.startsWith('it') ? 'it-IT' : 'en-GB';
    const d = new Date(dateStr);
    const diffHours = (Date.now() - d.getTime()) / 3_600_000;
    if (diffHours < 1) {
      const mins = Math.max(1, Math.round(diffHours * 60));
      return lang.startsWith('it') ? `${mins}m fa` : `${mins}m ago`;
    }
    if (diffHours < 24) {
      return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    }
    if (diffHours < 168) {
      return d.toLocaleDateString(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

function formatFullDate(dateStr: string, lang: string): string {
  try {
    const locale = lang.startsWith('it') ? 'it-IT' : 'en-GB';
    return new Date(dateStr).toLocaleDateString(locale, {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
}

const AVATAR_COLORS = ['#0284C7', '#15803D', '#7C3AED', '#C9973A', '#0891B2', '#DC2626', '#D97706'];
function avatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}
function initials(name: string): string {
  const p = name.trim().split(' ');
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

/* ─── sub-components ─────────────────────────────────────────────────────── */

const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 36 }) => {
  const color = avatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `${color}1A`, border: `2px solid ${color}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, fontWeight: 800, fontSize: size * 0.36,
      fontFamily: 'var(--font-display)', flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  );
};

interface MessageRowProps {
  msg: Message;
  isSelected: boolean;
  lang: string;
  onClick: () => void;
}

const MessageRow: React.FC<MessageRowProps> = ({ msg, isSelected, lang, onClick }) => {
  // For sent messages show the recipient's name; for received show the sender's
  const senderName = msg.direction === 'sent'
    ? (msg.recipientName ?? msg.senderName ?? '—')
    : (msg.senderName ?? '—');
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', border: 'none',
        padding: '14px 16px',
        background: isSelected
          ? 'var(--accent-light)'
          : msg.isRead ? 'transparent' : 'rgba(201,151,58,0.04)',
        cursor: 'pointer',
        borderLeft: `3px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
        transition: 'background 0.15s',
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}
      onMouseEnter={e => {
        if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-warm)';
      }}
      onMouseLeave={e => {
        if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background =
          msg.isRead ? 'transparent' : 'rgba(201,151,58,0.04)';
      }}
    >
      <Avatar name={senderName} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 13, fontWeight: msg.isRead ? 500 : 700,
            color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {senderName}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-disabled)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {formatRelativeDate(msg.createdAt, lang)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          {!msg.isRead && (
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
          )}
          <span style={{
            fontSize: 12, color: 'var(--text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontWeight: msg.isRead ? 400 : 600,
          }}>
            {msg.subject}
          </span>
        </div>
        <div style={{
          fontSize: 11.5, color: 'var(--text-disabled)', marginTop: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {msg.body.slice(0, 80)}
        </div>
      </div>
    </button>
  );
};

interface DetailPaneProps {
  msg: Message;
  lang: string;
  onReply: (msg: Message) => void;
  t: (key: string) => string;
}

const DetailPane: React.FC<DetailPaneProps> = ({ msg, lang, onReply, t }) => {
  // For sent messages show the recipient's name; for received show the sender's
  const senderName = msg.direction === 'sent'
    ? (msg.recipientName ?? msg.senderName ?? '—')
    : (msg.senderName ?? '—');
  const color = avatarColor(senderName);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Detail header */}
      <div style={{
        padding: '20px 24px', borderBottom: '1px solid var(--border-light)',
        background: 'var(--surface-warm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={senderName} size={42} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                {senderName}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {formatFullDate(msg.createdAt, lang)}
              </div>
            </div>
          </div>
          <Button
            onClick={() => onReply(msg)}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Reply size={14} />
            {t('messages.reply')}
          </Button>
        </div>

        <div style={{
          marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-light)',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            color: 'var(--text-disabled)', marginBottom: 6,
          }}>
            {t('messages.subject')}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.4 }}>
            {msg.subject}
          </div>
        </div>
      </div>

      {/* Message body */}
      <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        <div style={{
          fontSize: 13.5, color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
          lineHeight: 1.7, whiteSpace: 'pre-wrap',
          background: `${color}06`, borderRadius: 'var(--radius)',
          padding: '16px 20px', border: `1px solid ${color}15`,
        }}>
          {msg.body}
        </div>
      </div>

      {/* Read status */}
      <div style={{
        padding: '10px 24px', borderTop: '1px solid var(--border-light)',
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11, color: 'var(--text-disabled)',
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#15803D' }} />
        {t('messages.read')}
      </div>
    </div>
  );
};

const EmptyDetail: React.FC<{ t: (k: string) => string }> = ({ t }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '100%', padding: 40, gap: 12, color: 'var(--text-disabled)',
  }}>
    <Inbox size={36} strokeWidth={1.5} />
    <div style={{ fontSize: 13, fontWeight: 500 }}>{t('messages.selectMessage')}</div>
  </div>
);

/* ─── main page ──────────────────────────────────────────────────────────── */

export default function HRChatPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { isMobile } = useBreakpoint();

  const isEmployee = user?.role === 'employee';

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Message | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState<{ id: number; name: string } | null>(null);
  const [composeDefaultSubject, setComposeDefaultSubject] = useState<string>('');

  // HR contact (for employee role only)
  const [hrRecipient, setHrRecipient] = useState<{ recipientId: number; recipientName: string } | null>(null);
  const [hrLoading, setHrLoading] = useState(false);

  const loadMessages = useCallback(() => {
    setLoading(true);
    setError(null);
    getMessages()
      .then(msgs => {
        setMessages(msgs);
        setSelected(prev => prev ? (msgs.find(m => m.id === prev.id) ?? null) : null);
      })
      .catch(err => setError(translateApiError(err, t, t('messages.errorLoad'))))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Employee: load HR contact for compose
  useEffect(() => {
    if (!isEmployee) return;
    setHrLoading(true);
    getHrRecipient()
      .then(setHrRecipient)
      .catch(() => {})
      .finally(() => setHrLoading(false));
  }, [isEmployee]);

  const handleSelect = async (msg: Message) => {
    // On mobile, toggle expand inline
    if (isMobile) {
      setSelected(prev => prev?.id === msg.id ? null : msg);
    } else {
      setSelected(msg);
    }
    if (!msg.isRead) {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isRead: true } : m));
      markMessageAsRead(msg.id).catch(() => {});
    }
  };

  const handleCompose = () => {
    if (isEmployee && hrRecipient) {
      setComposeRecipient({ id: hrRecipient.recipientId, name: hrRecipient.recipientName });
    } else {
      setComposeRecipient(null); // will show picker
    }
    // New message: keep subject empty.
    setComposeDefaultSubject('');
    setComposeOpen(true);
  };

  const handleReply = (msg: Message) => {
    // If the user sent this message, reply goes to the original recipient; otherwise to the sender
    if (msg.direction === 'sent') {
      setComposeRecipient({ id: msg.recipientId, name: msg.recipientName ?? '—' });
    } else {
      setComposeRecipient({ id: msg.senderId, name: msg.senderName ?? '—' });
    }
    // Prefill the subject so the user can truly "reply" to the same thread.
    setComposeDefaultSubject(msg.subject ?? '');
    setComposeOpen(true);
  };

  const handleSent = () => {
    showToast(t('messages.successSent'), 'success');
    setComposeOpen(false);
    setComposeRecipient(null);
    setComposeDefaultSubject('');
    loadMessages();
  };

  const unread = messages.filter(m => !m.isRead).length;

  const composeDisabled = isEmployee && (hrLoading || !hrRecipient);

  return (
    <div className="page-enter" style={{ maxWidth: 1100, margin: '0 auto', fontFamily: 'var(--font-body)' }}>

      {/* Page header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap', marginBottom: 20,
      }}>
        <div>
          <h1 style={{
            margin: 0, fontFamily: 'var(--font-display)', fontSize: 24,
            fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em',
          }}>
            {t('messages.inbox')}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {unread > 0
              ? (i18n.language.startsWith('it')
                  ? `${unread} ${unread === 1 ? 'messaggio non letto' : 'messaggi non letti'}`
                  : `${unread} unread ${unread === 1 ? 'message' : 'messages'}`)
              : t('messages.noUnread')}
          </p>
        </div>

        <button
          onClick={handleCompose}
          disabled={composeDisabled}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 'var(--radius-sm)',
            background: composeDisabled ? 'var(--border)' : 'var(--accent)',
            color: composeDisabled ? 'var(--text-disabled)' : '#fff',
            border: 'none', cursor: composeDisabled ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: 13.5, fontFamily: 'var(--font-body)',
            transition: 'opacity 0.15s',
          }}
        >
          {hrLoading ? <Spinner size="sm" color="#fff" /> : <Plus size={15} />}
          {t('messages.compose')}
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant="danger" title={t('common.error')} onClose={() => setError(null)}>{error}</Alert>
        </div>
      )}

      {/* Two-pane layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '320px 1fr',
        gap: 16,
        alignItems: 'start',
      }}>

        {/* ── Message list panel ── */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}>
          {/* List header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-light)',
            background: 'var(--surface-warm)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <MessageSquare size={14} color="var(--accent)" />
            <span style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: 'var(--text-muted)',
            }}>
              {t('messages.title')}
            </span>
            {unread > 0 && (
              <span style={{
                marginLeft: 'auto',
                background: 'var(--accent)', color: '#fff',
                fontSize: 10, fontWeight: 700, borderRadius: 99,
                padding: '2px 7px',
              }}>
                {unread}
              </span>
            )}
          </div>

          {/* List body */}
          {loading ? (
            <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
              <Spinner size="lg" color="var(--accent)" />
            </div>
          ) : messages.length === 0 ? (
            <div style={{
              padding: '40px 20px', textAlign: 'center',
              color: 'var(--text-muted)', fontSize: 13,
            }}>
              <MessageSquare size={28} strokeWidth={1.5} style={{ marginBottom: 10, opacity: 0.4 }} />
              <div>{t('messages.noMessages')}</div>
            </div>
          ) : (
            <div>
              {messages.map((msg, idx) => (
                <div key={msg.id} style={{ borderBottom: idx < messages.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                  <MessageRow
                    msg={msg}
                    isSelected={selected?.id === msg.id}
                    lang={i18n.language}
                    onClick={() => void handleSelect(msg)}
                  />
                  {/* Mobile inline expand */}
                  {isMobile && selected?.id === msg.id && (
                    <div style={{
                      padding: '16px 16px 16px 64px',
                      background: 'var(--accent-light)',
                      borderTop: '1px solid var(--border-light)',
                    }}>
                      <div style={{
                        fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7,
                        whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)',
                      }}>
                        {msg.body}
                      </div>
                      <button
                        onClick={() => handleReply(msg)}
                        style={{
                          marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                          background: 'var(--accent)', color: '#fff',
                          border: 'none', cursor: 'pointer',
                          fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)',
                        }}
                      >
                        <Reply size={12} /> {t('messages.reply')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Detail panel (desktop only) ── */}
        {!isMobile && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            minHeight: 480,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {selected ? (
              <DetailPane
                msg={selected}
                lang={i18n.language}
                onReply={handleReply}
                t={t as (k: string) => string}
              />
            ) : (
              <EmptyDetail t={t as (k: string) => string} />
            )}
          </div>
        )}
      </div>

      {/* Compose modal */}
      {composeOpen && (
        <ComposeMessage
          recipientId={composeRecipient?.id}
          recipientName={composeRecipient?.name}
          defaultSubject={composeDefaultSubject}
          onClose={() => { setComposeOpen(false); setComposeRecipient(null); }}
          onSent={handleSent}
        />
      )}
    </div>
  );
}
