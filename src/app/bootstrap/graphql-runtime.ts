import { ensureFreshSession, forceLogout, getAuthSessionSnapshot } from '@/features/auth';

import { configureGraphQLRuntime } from '@/shared/graphql';

let hasBootstrappedGraphQLRuntime = false;

export function bootstrapGraphQLRuntime() {
  if (hasBootstrappedGraphQLRuntime) {
    return;
  }

  configureGraphQLRuntime({
    getAccessToken: () => getAuthSessionSnapshot()?.accessToken ?? null,
    onAuthFailure: () => forceLogout(),
    refreshSession: async () => {
      await ensureFreshSession({ force: true });
    },
  });

  hasBootstrappedGraphQLRuntime = true;
}
