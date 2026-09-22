import { useEffect } from 'react';

const ICONS = {
  success: (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/>
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/>
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor"/>
    </svg>
  ),
};

function Toast({ toast, onRemove }) {
  useEffect(() => {
    return () => {};
  }, []);

  return (
    <div className={`toast toast-${toast.type}`} role="alert">
      <span className="toast-icon">{ICONS[toast.type] ?? ICONS.info}</span>
      <span className="toast-message">{toast.message}</span>
      <button
        className="toast-close"
        onClick={() => onRemove(toast.id)}
        aria-label="Dismiss"
      >
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
        </svg>
      </button>
    </div>
  );
}

export default function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}
