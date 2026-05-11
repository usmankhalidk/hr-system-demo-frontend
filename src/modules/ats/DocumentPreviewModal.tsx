import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface DocumentPreviewModalProps {
  url: string;
  filename: string;
  onClose: () => void;
}

export default function DocumentPreviewModal({ url, filename, onClose }: DocumentPreviewModalProps) {
  const fileExtension = filename.split('.').pop()?.toLowerCase();
  const isPDF = fileExtension === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '');
  const shouldInlinePreview = isPDF || isImage;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(shouldInlinePreview);
  const [loadError, setLoadError] = useState<string | null>(null);

  const resolvedUrl = useMemo(() => {
    if (/^(https?:|blob:|data:)/i.test(url)) return url;
    const envBase = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || '';
    if (envBase) {
      return `${envBase}${url.startsWith('/') ? url : `/${url}`}`;
    }
    const fallbackBase = window.location.origin.replace(/:\d+$/, ':3001');
    return `${fallbackBase}${url.startsWith('/') ? url : `/${url}`}`;
  }, [url]);

  useEffect(() => {
    if (!shouldInlinePreview) {
      setLoading(false);
      setPreviewUrl(null);
      setLoadError(null);
      return;
    }

    if (/^(blob:|data:)/i.test(resolvedUrl)) {
      setLoading(false);
      setPreviewUrl(resolvedUrl);
      setLoadError(null);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);
    setLoadError(null);

    const token = localStorage.getItem('hr_token') || sessionStorage.getItem('hr_token') || '';
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(resolvedUrl, { headers })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP_${res.status}`);
        }
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          throw new Error('HTML_RESPONSE');
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (active) setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (active) {
          setPreviewUrl(null);
          setLoadError('preview_failed');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [resolvedUrl, shouldInlinePreview]);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.60)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '90vw',
          maxWidth: 1200,
          height: '90vh',
          background: '#fff',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
            {filename}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              Loading preview...
            </div>
          )}
          {!loading && loadError && (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 46, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Unable to display this file in the preview.
              </div>
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  background: 'var(--primary)',
                  color: '#fff',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                Open in New Tab
              </a>
            </div>
          )}
          {!loading && !loadError && shouldInlinePreview && previewUrl && isPDF && (
            <object
              data={previewUrl}
              type="application/pdf"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#fff',
              }}
            >
              <iframe
                src={previewUrl}
                title={filename}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </object>
          )}
          {!loading && !loadError && shouldInlinePreview && previewUrl && isImage && (
            <img
              src={previewUrl}
              alt={filename}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
              }}
            />
          )}
          {!loading && !loadError && !shouldInlinePreview && (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Preview not available for this file type
              </div>
              <a
                href={resolvedUrl}
                download={filename}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  background: 'var(--primary)',
                  color: '#fff',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                Download File
              </a>
            </div>
          )}
        </div>
        
        {/* Footer with actions */}
        {(isPDF || isImage) && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              background: 'var(--surface)',
            }}
          >
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '8px 16px',
                background: 'var(--background)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              🔗 Open in New Tab
            </a>
            <a
              href={resolvedUrl}
              download={filename}
              style={{
                padding: '8px 16px',
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ⬇️ Download
            </a>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
