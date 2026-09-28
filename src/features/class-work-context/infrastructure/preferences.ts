// src/features/class-work-context/infrastructure/preferences.ts
const PREFIX = 'edu-mate.class-work.v1:';

export function readWorkClass(accountId: number): string | null {
  try {
    return window.localStorage.getItem(`${PREFIX}${accountId}`)?.trim() || null;
  } catch {
    return null;
  }
}
export function writeWorkClass(accountId: number, id: string | null): boolean {
  try {
    if (id) window.localStorage.setItem(`${PREFIX}${accountId}`, id);
    else window.localStorage.removeItem(`${PREFIX}${accountId}`);
    return true;
  } catch {
    return false;
  }
}
