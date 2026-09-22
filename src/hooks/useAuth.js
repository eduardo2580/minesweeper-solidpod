import { useState, useEffect, useCallback } from 'react';
import {
  getDefaultSession,
  handleIncomingRedirect,
  login,
  logout,
} from '@inrupt/solid-client-authn-browser';

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [webId, setWebId] = useState(null);
  const [loading, setLoading] = useState(true);

  function syncFromSession() {
    const s = getDefaultSession();
    setIsLoggedIn(!!s.info.isLoggedIn);
    setWebId(s.info.webId ?? null);
  }

  useEffect(() => {
    async function init() {
      try {
        await handleIncomingRedirect({ restorePreviousSession: true });
      } catch (err) {
        console.error('handleIncomingRedirect error:', err);
      }
      syncFromSession();
      setLoading(false);

      const s = getDefaultSession();
      // v2.x uses session.events EventEmitter (onLogout/onSessionRestore were removed)
      s.events?.on('logout', () => {
        setIsLoggedIn(false);
        setWebId(null);
      });
      s.events?.on('sessionRestore', () => syncFromSession());
    }
    init();
  }, []);

  const handleLogin = useCallback(async (oidcIssuer) => {
    // Use origin + pathname so the redirect back never includes a prior code param
    const redirectUrl = window.location.origin + window.location.pathname;
    await login({
      oidcIssuer,
      redirectUrl,
      clientName: import.meta.env.VITE_APP_NAME || 'My Solid App',
      clientId: `${window.location.origin}/client-id.json`,
    });
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout({ logoutType: 'app' });
    } catch {
      /* ignore */
    }
    setIsLoggedIn(false);
    setWebId(null);
  }, []);

  return {
    session: getDefaultSession(),
    isLoggedIn,
    webId,
    loading,
    login: handleLogin,
    logout: handleLogout,
  };
}
