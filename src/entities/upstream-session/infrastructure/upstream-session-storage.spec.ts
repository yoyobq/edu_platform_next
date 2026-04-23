import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearStoredUpstreamSession,
  readStoredUpstreamSession,
  writeStoredUpstreamSession,
} from './upstream-session-storage';

const UPSTREAM_SESSION_STORAGE_KEY = 'aigc-friendly-frontend.upstream.session.v2';
const LEGACY_UPSTREAM_SESSION_STORAGE_KEY = 'aigc-friendly-frontend.labs.upstream-session-demo.v1';

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

let originalWindowDescriptor: PropertyDescriptor | undefined;
let storage: MemoryStorage;

beforeEach(() => {
  originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  storage = new MemoryStorage();

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: storage,
    },
  });
});

afterEach(() => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, 'window');
});

describe('upstream-session-storage', () => {
  it('writes the entity-scoped v2 key and clears the legacy labs key', () => {
    storage.setItem(LEGACY_UPSTREAM_SESSION_STORAGE_KEY, 'legacy-value');

    writeStoredUpstreamSession({
      accountId: 1001,
      expiresAt: '2026-05-01T08:00:00.000Z',
      upstreamLoginId: 'teacher.alice',
      upstreamSessionToken: 'upstream-token-001',
    });

    expect(storage.getItem(LEGACY_UPSTREAM_SESSION_STORAGE_KEY)).toBeNull();

    const storedValue = JSON.parse(storage.getItem(UPSTREAM_SESSION_STORAGE_KEY) ?? '{}') as {
      upstreamSessionToken?: string;
      version?: number;
    };

    expect(storedValue).toMatchObject({
      upstreamSessionToken: 'upstream-token-001',
      version: 2,
    });
  });

  it('migrates a valid legacy labs session into the entity-scoped v2 key', () => {
    storage.setItem(
      LEGACY_UPSTREAM_SESSION_STORAGE_KEY,
      JSON.stringify({
        accountId: 1001,
        expiresAt: '2026-05-01T08:00:00.000Z',
        upstreamLoginId: 'teacher.alice',
        upstreamSessionToken: 'legacy-upstream-token',
        version: 1,
      }),
    );

    const session = readStoredUpstreamSession(1001);

    expect(session).toMatchObject({
      accountId: 1001,
      upstreamSessionToken: 'legacy-upstream-token',
      version: 2,
    });
    expect(storage.getItem(LEGACY_UPSTREAM_SESSION_STORAGE_KEY)).toBeNull();
    expect(JSON.parse(storage.getItem(UPSTREAM_SESSION_STORAGE_KEY) ?? '{}')).toMatchObject({
      upstreamSessionToken: 'legacy-upstream-token',
      version: 2,
    });
  });

  it('clears both storage keys when the restored session belongs to another account', () => {
    storage.setItem(
      LEGACY_UPSTREAM_SESSION_STORAGE_KEY,
      JSON.stringify({
        accountId: 9527,
        expiresAt: '2026-05-01T08:00:00.000Z',
        upstreamLoginId: 'teacher.alice',
        upstreamSessionToken: 'foreign-upstream-token',
        version: 1,
      }),
    );

    expect(readStoredUpstreamSession(1001)).toBeNull();
    expect(storage.getItem(UPSTREAM_SESSION_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_UPSTREAM_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('clears both storage keys on explicit logout', () => {
    storage.setItem(UPSTREAM_SESSION_STORAGE_KEY, 'current-value');
    storage.setItem(LEGACY_UPSTREAM_SESSION_STORAGE_KEY, 'legacy-value');

    clearStoredUpstreamSession();

    expect(storage.getItem(UPSTREAM_SESSION_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_UPSTREAM_SESSION_STORAGE_KEY)).toBeNull();
  });
});
