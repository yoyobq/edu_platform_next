import {
  ensureFreshSession,
  forceLogout,
  getCurrentAuthSession,
  queueAuthRefreshFailureMessage,
} from '@/features/auth';

import { configureGraphQLRuntime } from '@/shared/graphql';

let hasBootstrappedGraphQLRuntime = false;

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
      return ensureFreshSession({ force: true }).then(() => undefined);
    },
  });

  hasBootstrappedGraphQLRuntime = true;
}
