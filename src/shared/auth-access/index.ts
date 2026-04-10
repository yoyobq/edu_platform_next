export const AUTH_ACCESS_GROUPS = ['ADMIN', 'GUEST', 'REGISTRANT', 'STAFF', 'STUDENT'] as const;

export type AuthAccessGroup = (typeof AUTH_ACCESS_GROUPS)[number];

export function isAuthAccessGroup(value: unknown): value is AuthAccessGroup {
  return typeof value === 'string' && (AUTH_ACCESS_GROUPS as readonly string[]).includes(value);
}
