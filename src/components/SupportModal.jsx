import { useState } from 'react';
import Modal from './Modal.jsx';
import { getErrorLog } from '../lib/errorLog.js';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@privatedatapod.com';
const APP_NAME = import.meta.env.VITE_APP_NAME || 'My Solid App';

function getDiagnostics(webId, activeView) {
  return [
    `Date:    ${new Date().toUTCString()}`,
    `View:    ${activeView || 'unknown'}`,
    `WebID:   ${webId || 'not logged in'}`,
    `Browser: ${navigator.userAgent}`,
    `URL:     ${window.location.href}`,
    ``,
    `--- Console Errors / Warnings ---`,
    getErrorLog(),
  ].join('\n');
}

export default function SupportModal({ isOpen, onClose, webId, activeView }) {
  const [description, setDescription] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const diagnostics = getDiagnostics(webId, activeView);

  const buildBody = () =>
    `What happened:\n${description.trim() || '(no description provided)'}\n\n--- Diagnostic Information ---\n${diagnostics}`;

  const handleEmail = () => {
    const subject = encodeURIComponent(`${APP_NAME} Support Request`);
    const body = encodeURIComponent(buildBody());
    window.open(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`, '_self');
    onClose();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildBody());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that block clipboard access
      const el = document.createElement('textarea');
      el.value = buildBody();
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Get Support" size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ color: 'var(--sd-text-2, var(--text-secondary))', fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
          Describe your problem below, then click <strong>Open in Email Client</strong> to send a
          pre-filled message to{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          Diagnostic details are attached automatically.
        </p>

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
            What went wrong?
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe what you were doing and what happened…"
            rows={4}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1.5px solid var(--sd-border, #E5E7EB)',
              borderRadius: 8,
              fontSize: 13.5,
              fontFamily: 'inherit',
              resize: 'vertical',
              color: 'var(--sd-text-1, #111827)',
              background: 'var(--sd-surface, #fff)',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.12s',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--sd-blue, #1A73E8)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--sd-border, #E5E7EB)'; }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
            Diagnostic Information{' '}
            <span style={{ color: 'var(--sd-text-3, #9CA3AF)', fontWeight: 400 }}>(included automatically)</span>
          </label>
          <pre style={{
            background: 'var(--sd-bg, #F8F9FA)',
            border: '1px solid var(--sd-border, #E5E7EB)',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 12,
            color: 'var(--sd-text-2, #4B5563)',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            lineHeight: 1.7,
            maxHeight: 180,
            overflowY: 'auto',
          }}>
            {diagnostics}
          </pre>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--sd-border, #E5E7EB)' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px', borderRadius: 6,
              border: '1px solid var(--sd-border, #E5E7EB)',
              background: 'transparent', cursor: 'pointer',
              fontSize: 13.5, fontWeight: 500,
              color: 'var(--sd-text-2, #4B5563)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCopy}
            style={{
              padding: '7px 16px', borderRadius: 6,
              border: '1px solid var(--sd-border, #E5E7EB)',
              background: 'transparent', cursor: 'pointer',
              fontSize: 13.5, fontWeight: 500,
              color: 'var(--sd-text-1, #111827)',
            }}
          >
            {copied ? '✓ Copied!' : 'Copy to Clipboard'}
          </button>
          <button
            onClick={handleEmail}
            style={{
              padding: '7px 16px', borderRadius: 6,
              border: 'none', background: 'var(--sd-blue, #1A73E8)',
              color: '#fff', cursor: 'pointer',
              fontSize: 13.5, fontWeight: 500,
            }}
          >
            Open in Email Client
          </button>
        </div>
      </div>
    </Modal>
  );
}
