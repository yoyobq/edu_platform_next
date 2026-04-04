function getNavigationOrigin() {
  return typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
}

export function sanitizeRedirectTarget(
  candidate: string | null,
  origin = getNavigationOrigin(),
): string {
  if (!candidate || !candidate.startsWith('/')) {
    return '/';
  }

  if (candidate.startsWith('//')) {
    return '/';
  }

  try {
    const parsedURL = new URL(candidate, origin);

    if (parsedURL.origin !== origin) {
      return '/';
    }

    return `${parsedURL.pathname}${parsedURL.search}${parsedURL.hash}`;
  } catch {
    return '/';
  }
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
