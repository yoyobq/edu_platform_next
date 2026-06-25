// src/app/lib/collaboration-url.ts

const COLLABORATION_AVAILABILITY_VALUES = ['available', 'degraded', 'readonly', 'unavailable'];

export function withCollaborationSearch(pathname: string, search: string): string {
  const searchParams = new URLSearchParams(search);
  const availability = searchParams.get('availability');

  if (!availability || !COLLABORATION_AVAILABILITY_VALUES.includes(availability)) {
    return pathname;
  }

  const nextSearchParams = new URLSearchParams();

  nextSearchParams.set('availability', availability);

  return `${pathname}?${nextSearchParams.toString()}`;
}
