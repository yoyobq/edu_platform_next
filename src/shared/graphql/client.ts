import { ApolloClient, HttpLink, InMemoryCache, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

type GraphQLRuntimeConfig = {
  getAccessToken?: () => string | null | undefined;
};

let runtimeConfig: GraphQLRuntimeConfig = {};
let graphQLClient: ApolloClient | null = null;

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return { ...value };
}

function getContextAuthMode(context: unknown): 'required' | 'none' | null {
  const authMode = toRecord(context).authMode;

  return authMode === 'required' || authMode === 'none' ? authMode : null;
}

function getRequestAuthorizationHeader(headers: unknown): string | null {
  const headerRecord = toRecord(headers);

  if (typeof headerRecord.Authorization === 'string') {
    return headerRecord.Authorization;
  }

  if (typeof headerRecord.authorization === 'string') {
    return headerRecord.authorization;
  }

  return null;
}

function getGraphQLEndpoint(): string {
  const endpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT;

  if (typeof endpoint !== 'string' || !endpoint.trim()) {
    throw new Error('未配置可用的 VITE_GRAPHQL_ENDPOINT。');
  }

  return endpoint;
}

function getGraphQLWSEndpoint(): string | null {
  const configuredEndpoint = import.meta.env.VITE_GRAPHQL_WS_ENDPOINT;

  if (typeof configuredEndpoint === 'string' && configuredEndpoint.trim()) {
    return configuredEndpoint;
  }

  const httpEndpoint = getGraphQLEndpoint();

  try {
    const url = new URL(httpEndpoint);

    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

    return url.toString();
  } catch {
    return null;
  }
}

function getAuthorizationHeader(accessToken?: string | null) {
  return accessToken ? `Bearer ${accessToken}` : null;
}

function removeAuthorizationHeader(headers: unknown) {
  const nextHeaders = toRecord(headers);

  delete nextHeaders.Authorization;
  delete nextHeaders.authorization;

  return nextHeaders;
}

function createHTTPLink() {
  const httpLink = new HttpLink({
    uri: getGraphQLEndpoint(),
  });

  const authContextLink = setContext((_, previousContext) => {
    if (getContextAuthMode(previousContext) === 'none') {
      return {
        headers: removeAuthorizationHeader(previousContext.headers),
      };
    }

    const requestAuthorizationHeader = getRequestAuthorizationHeader(previousContext.headers);
    const authorizationHeader =
      requestAuthorizationHeader ??
      getAuthorizationHeader(runtimeConfig.getAccessToken?.() ?? null);

    return {
      headers: {
        ...previousContext.headers,
        ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
      },
    };
  });

  return authContextLink.concat(httpLink);
}

function createWSLink() {
  const wsEndpoint = getGraphQLWSEndpoint();

  if (!wsEndpoint || typeof window === 'undefined' || typeof WebSocket === 'undefined') {
    return null;
  }

  return new GraphQLWsLink(
    createClient({
      connectionParams: () => {
        const accessToken = runtimeConfig.getAccessToken?.() ?? null;
        const authorizationHeader = getAuthorizationHeader(accessToken);

        return authorizationHeader
          ? {
              headers: {
                Authorization: authorizationHeader,
              },
            }
          : {};
      },
      url: wsEndpoint,
    }),
  );
}

function createApolloClient() {
  const httpLink = createHTTPLink();
  const wsLink = createWSLink();

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: wsLink
      ? split(
          ({ query }) => {
            const definition = getMainDefinition(query);

            return (
              definition.kind === 'OperationDefinition' && definition.operation === 'subscription'
            );
          },
          wsLink,
          httpLink,
        )
      : httpLink,
  });
}

export function configureGraphQLRuntime(config: GraphQLRuntimeConfig) {
  runtimeConfig = {
    ...runtimeConfig,
    ...config,
  };
}

export function getGraphQLClient() {
  if (!graphQLClient) {
    graphQLClient = createApolloClient();
  }

  return graphQLClient;
}

export { getGraphQLEndpoint };
