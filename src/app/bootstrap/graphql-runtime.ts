import {
  ensureFreshSession,
  forceLogout,
  getCurrentAuthSession,
  queueAuthRefreshFailureMessage,
} from '@/features/auth';

import { configureGraphQLRuntime } from '@/shared/graphql';

let hasBootstrappedGraphQLRuntime = false;
let refreshSessionPromise: Promise<void> | null = null;

export function bootstrapGraphQLRuntime() {
  if (hasBootstrappedGraphQLRuntime) {
    return;
  }

  configureGraphQLRuntime({
    getAccessToken: () => getCurrentAuthSession()?.accessToken ?? null,
    onAuthFailure: () => {
      queueAuthRefreshFailureMessage();
      forceLogout(null);
    },
    refreshSession: () => {
      if (refreshSessionPromise) {
        return refreshSessionPromise;
      }

      refreshSessionPromise = (async () => {
        try {
          await ensureFreshSession({ force: true });
        } finally {
          refreshSessionPromise = null;
        }
      })();

      return refreshSessionPromise;
    },
  });

  hasBootstrappedGraphQLRuntime = true;
}
