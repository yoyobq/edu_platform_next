// src/features/auth/infrastructure/explicit-logout-redirect.ts

const EXPLICIT_LOGOUT_REDIRECT_HOME_KEY = 'platform_next.auth_explicit_logout_redirect_home';

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function markExplicitLogoutRedirectHome() {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.setItem(EXPLICIT_LOGOUT_REDIRECT_HOME_KEY, '1');
}

export function consumeExplicitLogoutRedirectHome() {
  if (!canUseSessionStorage()) {
    return false;
  }

  const value = window.sessionStorage.getItem(EXPLICIT_LOGOUT_REDIRECT_HOME_KEY);
  window.sessionStorage.removeItem(EXPLICIT_LOGOUT_REDIRECT_HOME_KEY);

  return value === '1';
}
