import { useState } from 'react';
import SupportModal from './SupportModal.jsx';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'My Solid App';
const APP_SUBTITLE = import.meta.env.VITE_APP_SUBTITLE || 'Your data, on your own Solid Pod — private, portable, and under your control.';

const FEATURED_PROVIDER = { label: 'privatedatapod.com', value: 'https://privatedatapod.com' };

const OTHER_PROVIDERS = [
  { label: 'solidcommunity.net', value: 'https://solidcommunity.net' },
  { label: 'inrupt.net',         value: 'https://inrupt.net' },
  { label: 'solidweb.org',       value: 'https://solidweb.org' },
];

export default function LoginScreen({ onLogin, error }) {
  const [issuer, setIssuer] = useState(FEATURED_PROVIDER.value);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [showSupport, setShowSupport] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!issuer.trim()) return;
    setLoading(true);
    setLoginError(null);
    try {
      await onLogin(issuer.trim());
    } catch (err) {
      setLoading(false);
      const msg = err?.message ?? String(err);
      const isCors = err instanceof TypeError && (
        msg === 'Failed to fetch' ||
        msg === 'Load failed' ||
        msg === 'NetworkError when attempting to fetch resource.'
      );
      if (isCors) {
        setLoginError(
          `Cannot reach "${issuer.trim()}" — the server is blocking cross-origin requests (CORS). ` +
          `The pod provider must return Access-Control-Allow-Origin headers. Try a different provider.`
        );
      } else {
        setLoginError(msg || 'Login failed. Check the provider URL and try again.');
      }
      console.error('Login error:', err);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">

        {/* Desktop hero panel (hidden on mobile via CSS) */}
        <div className="login-hero">
          <div className="login-hero-logo">
            {/* Replace with your app logo */}
            <svg viewBox="0 0 48 48" width="56" height="56" fill="none">
              <rect width="48" height="48" rx="12" fill="rgba(255,255,255,0.15)"/>
              <path d="M24 10L10 38h8l3-6h6l3 6h8L24 10zm0 10l3.5 7h-7L24 20z" fill="white"/>
              <circle cx="34" cy="14" r="6" fill="#34A853"/>
            </svg>
          </div>
          <h1>{APP_NAME}</h1>
          <p>{APP_SUBTITLE}</p>
        </div>

        {/* Form column */}
        <div className="login-form-col">

          {/* Mobile header (hidden on desktop via CSS) */}
          <div className="login-card-header">
            <div className="login-logo">
              <svg viewBox="0 0 48 48" width="56" height="56" fill="none">
                <rect width="48" height="48" rx="12" fill="#1A73E8"/>
                <path d="M24 10L10 38h8l3-6h6l3 6h8L24 10zm0 10l3.5 7h-7L24 20z" fill="white"/>
                <circle cx="34" cy="14" r="6" fill="#34A853"/>
              </svg>
            </div>
            <h1 className="login-title">{APP_NAME}</h1>
            <p className="login-subtitle">{APP_SUBTITLE}</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <label className="login-label" htmlFor="issuer">
              Identity Provider
            </label>

            {/* Featured provider */}
            <button
              type="button"
              className={`featured-provider-btn ${issuer === FEATURED_PROVIDER.value ? 'active' : ''}`}
              onClick={() => setIssuer(FEATURED_PROVIDER.value)}
            >
              <div className="fpb-header">
                <span className="fpb-name">
                  <svg viewBox="0 0 20 20" width="16" height="16" style={{ marginRight: 6, flexShrink: 0 }}>
                    <path d="M10 1L3 4v5c0 4.25 2.95 8.22 7 9.19C14.05 17.22 17 13.25 17 9V4L10 1z" fill="currentColor" opacity=".9"/>
                  </svg>
                  privatedatapod.com
                </span>
                <span className="fpb-badge">Recommended</span>
              </div>
              <p className="fpb-desc">Private, secure Solid Pods — purpose-built for your data</p>
            </button>

            <div className="login-presets-label">Other providers</div>
            <div className="login-presets">
              {OTHER_PROVIDERS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  className={`preset-btn ${issuer === p.value ? 'active' : ''}`}
                  onClick={() => setIssuer(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              id="issuer"
              type="url"
              className="login-input"
              value={issuer}
              onChange={e => setIssuer(e.target.value)}
              placeholder="https://your-pod-provider.example"
              required
              autoComplete="url"
            />

            {(loginError || error) && (
              <p className="login-error" role="alert">{loginError || error}</p>
            )}

            <button
              type="submit"
              className="login-btn"
              disabled={loading || !issuer.trim()}
            >
              {loading ? (
                <>
                  <span className="spinner-sm" />
                  Redirecting to provider…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="18" height="18" style={{ marginRight: 8 }}>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" fill="currentColor"/>
                  </svg>
                  Sign in
                </>
              )}
            </button>
          </form>

          <p className="login-footer">
            Don&apos;t have a Pod?{' '}
            <a href="https://privatedatapod.com" target="_blank" rel="noopener noreferrer">
              Get one at privatedatapod.com
            </a>
          </p>

          <div style={{ borderTop: '1px solid var(--sd-border, #E5E7EB)', marginTop: 8, paddingTop: 12, textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setShowSupport(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: 'var(--sd-text-2, #4B5563)',
                textDecoration: 'underline', padding: 0,
              }}
            >
              Having trouble? Get support
            </button>
          </div>

        </div>
      </div>

      <SupportModal
        isOpen={showSupport}
        onClose={() => setShowSupport(false)}
        webId={null}
        activeView="login"
      />
    </div>
  );
}
