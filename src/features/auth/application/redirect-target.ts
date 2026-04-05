import { sanitizeRedirectTarget } from '@/shared/navigation';

function getNavigationOrigin() {
  return typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
}

export function resolveLoginRedirectTarget(
  candidate: string | null,
  origin = getNavigationOrigin(),
) {
  const redirectTarget = sanitizeRedirectTarget(candidate, origin);
  const parsedURL = new URL(redirectTarget, origin);

  return parsedURL.pathname === '/login' ? '/' : redirectTarget;
}

export function resolveWelcomeRedirectTarget(
  candidate: string | null,
  origin = getNavigationOrigin(),
) {
  const redirectTarget = sanitizeRedirectTarget(candidate, origin);
  const parsedURL = new URL(redirectTarget, origin);

  if (parsedURL.pathname === '/login' || parsedURL.pathname === '/welcome') {
    return '/';
  }

  return redirectTarget;
}

export function buildWelcomeRedirectTarget(
  candidate: string | null,
  origin = getNavigationOrigin(),
) {
  const redirectTarget = resolveWelcomeRedirectTarget(candidate, origin);

  if (redirectTarget === '/') {
    return '/welcome';
  }

  return `/welcome?redirect=${encodeURIComponent(redirectTarget)}`;
}

export function resolveAuthenticatedRedirectTarget(
  candidate: string | null,
  options: {
    needsProfileCompletion: boolean;
  },
  origin = getNavigationOrigin(),
) {
  const redirectTarget = resolveLoginRedirectTarget(candidate, origin);
  const parsedURL = new URL(redirectTarget, origin);

  if (parsedURL.pathname === '/welcome') {
    const welcomeRedirectTarget = resolveWelcomeRedirectTarget(
      parsedURL.searchParams.get('redirect'),
      origin,
    );

    if (!options.needsProfileCompletion) {
      return welcomeRedirectTarget;
    }

    return buildWelcomeRedirectTarget(welcomeRedirectTarget, origin);
  }

  if (!options.needsProfileCompletion) {
    return redirectTarget;
  }

  return buildWelcomeRedirectTarget(redirectTarget, origin);
}
