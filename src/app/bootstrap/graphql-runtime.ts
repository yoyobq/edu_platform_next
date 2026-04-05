import { getAuthSessionSnapshot } from '@/features/auth';

import { configureGraphQLRuntime } from '@/shared/graphql';

let hasBootstrappedGraphQLRuntime = false;

export function bootstrapGraphQLRuntime() {
  if (hasBootstrappedGraphQLRuntime) {
    return;
  }

  configureGraphQLRuntime({
    getAccessToken: () => getAuthSessionSnapshot()?.accessToken ?? null,
  });

  hasBootstrappedGraphQLRuntime = true;
}
