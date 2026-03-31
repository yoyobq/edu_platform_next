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
