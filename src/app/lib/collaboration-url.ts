// src/app/lib/collaboration-url.ts

export type CollaborationAvailability = 'available' | 'degraded' | 'readonly' | 'unavailable';

const COLLABORATION_AVAILABILITY_VALUES = new Set<CollaborationAvailability>([
  'available',
  'degraded',
  'readonly',
  'unavailable',
]);

export function readCollaborationAvailability(search: string): CollaborationAvailability | null {
  const value = new URLSearchParams(search).get('availability');

  return value && COLLABORATION_AVAILABILITY_VALUES.has(value as CollaborationAvailability)
    ? (value as CollaborationAvailability)
    : null;
}

export function withCollaborationSearch(pathname: string, search: string): string {
  const availability = readCollaborationAvailability(search);

  if (!availability) {
    return pathname;
  }

  const nextSearchParams = new URLSearchParams();

  nextSearchParams.set('availability', availability);

  return `${pathname}?${nextSearchParams.toString()}`;
}
