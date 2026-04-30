import React from 'react';
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
          {isPDF ? (
            <iframe
              src={url}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              title={filename}
            />
          ) : isImage ? (
            <img
              src={url}
              alt={filename}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
              }}
            />
          ) : (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Preview not available for this file type
              </div>
              <a
                href={url}
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
      </div>
    </div>,
    document.body
  );
}
