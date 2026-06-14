import { Kind, type OperationDefinitionNode, OperationTypeNode } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  clientMutateMock,
  clientQueryMock,
  getGraphQLClientMock,
  getGraphQLRuntimeConfigMock,
  getOperationASTMock,
  gqlMock,
} = vi.hoisted(() => ({
  clientMutateMock: vi.fn(),
  clientQueryMock: vi.fn(),
  getGraphQLClientMock: vi.fn(),
  getGraphQLRuntimeConfigMock: vi.fn(),
  getOperationASTMock: vi.fn(),
  gqlMock: vi.fn(),
}));

vi.mock('@apollo/client', () => ({
  gql: gqlMock,
}));

vi.mock('graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('graphql')>();

  return {
    ...actual,
    getOperationAST: getOperationASTMock,
  };
});

vi.mock('./client', () => ({
  getGraphQLClient: getGraphQLClientMock,
  getGraphQLRuntimeConfig: getGraphQLRuntimeConfigMock,
}));

import { GraphQLIngressError } from './errors';
import { executeGraphQL } from './request';

function createOperation(
  operation: OperationTypeNode,
  operationName: string,
): OperationDefinitionNode {
  return {
    directives: [],
    kind: Kind.OPERATION_DEFINITION,
    name: {
      kind: Kind.NAME,
      value: operationName,
    },
    operation,
    selectionSet: {
      kind: Kind.SELECTION_SET,
      selections: [],
    },
    variableDefinitions: [],
  };
}

describe('executeGraphQL', () => {
  beforeEach(() => {
    clientMutateMock.mockReset();
    clientQueryMock.mockReset();
    getGraphQLClientMock.mockReset();
    getGraphQLRuntimeConfigMock.mockReset();
    getOperationASTMock.mockReset();
    gqlMock.mockReset();

    clientQueryMock.mockResolvedValue({ data: { ok: true } });
    getGraphQLClientMock.mockReturnValue({
      mutate: clientMutateMock,
      query: clientQueryMock,
    });
    getGraphQLRuntimeConfigMock.mockReturnValue({});
    getOperationASTMock.mockReturnValue(
      createOperation(OperationTypeNode.QUERY, 'CachedGraphQLQuery'),
    );
    gqlMock.mockImplementation((query: string) => ({
      definitions: [],
      kind: 'Document',
      query,
    }));
  });

  it('caches parsed documents by query string without skipping requests', async () => {
    const query = `
      query CachedGraphQLQuery($id: ID!) {
        node(id: $id) {
          id
        }
      }
    `;

    await expect(executeGraphQL(query, { id: 'NODE-001' })).resolves.toEqual({ ok: true });
    await expect(executeGraphQL(query, { id: 'NODE-002' })).resolves.toEqual({ ok: true });

    expect(gqlMock).toHaveBeenCalledTimes(1);
    expect(getOperationASTMock).toHaveBeenCalledTimes(1);
    expect(clientQueryMock).toHaveBeenCalledTimes(2);
    expect(clientQueryMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        query: gqlMock.mock.results[0]?.value,
        variables: { id: 'NODE-001' },
      }),
    );
    expect(clientQueryMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        query: gqlMock.mock.results[0]?.value,
        variables: { id: 'NODE-002' },
      }),
    );
  });

  it('does not call auth failure when reactive refresh fails for a non-auth reason', async () => {
    const refreshSession = vi.fn(async () => {
      throw new GraphQLIngressError({
        message: 'Network unavailable',
        type: 'network',
      });
    });
    const onAuthFailure = vi.fn();

    getGraphQLRuntimeConfigMock.mockReturnValue({
      onAuthFailure,
      refreshSession,
    });
    clientQueryMock.mockRejectedValueOnce(
      new GraphQLIngressError({
        message: 'Access token expired',
        type: 'auth',
      }),
    );

    await expect(executeGraphQL('query NeedsAuth { me { accountId } }', {})).rejects.toMatchObject({
      type: 'network',
    });

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(onAuthFailure).not.toHaveBeenCalled();
    expect(clientQueryMock).toHaveBeenCalledTimes(1);
  });

  it('does not run reactive refresh when auth retry is disabled', async () => {
    const refreshSession = vi.fn();
    const onAuthFailure = vi.fn();

    getGraphQLRuntimeConfigMock.mockReturnValue({
      onAuthFailure,
      refreshSession,
    });
    clientQueryMock.mockRejectedValueOnce(
      new GraphQLIngressError({
        message: 'Upstream session expired',
        type: 'auth',
      }),
    );

    await expect(
      executeGraphQL('query UpstreamProxy { upstream { id } }', {}, { allowAuthRetry: false }),
    ).rejects.toMatchObject({
      type: 'auth',
    });

    expect(refreshSession).not.toHaveBeenCalled();
    expect(onAuthFailure).not.toHaveBeenCalled();
    expect(clientQueryMock).toHaveBeenCalledTimes(1);
  });

  it('calls auth failure when reactive refresh fails with auth', async () => {
    const refreshSession = vi.fn(async () => {
      throw new GraphQLIngressError({
        message: 'Refresh token expired',
        type: 'auth',
      });
    });
    const onAuthFailure = vi.fn();

    getGraphQLRuntimeConfigMock.mockReturnValue({
      onAuthFailure,
      refreshSession,
    });
    clientQueryMock.mockRejectedValueOnce(
      new GraphQLIngressError({
        message: 'Access token expired',
        type: 'auth',
      }),
    );

    await expect(executeGraphQL('query NeedsAuth { me { accountId } }', {})).rejects.toMatchObject({
      type: 'auth',
    });

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(clientQueryMock).toHaveBeenCalledTimes(1);
  });

  it('does not call auth failure after retry when retry auth logout is disabled', async () => {
    const refreshSession = vi.fn(async () => undefined);
    const onAuthFailure = vi.fn();

    getGraphQLRuntimeConfigMock.mockReturnValue({
      onAuthFailure,
      refreshSession,
    });
    clientQueryMock
      .mockRejectedValueOnce(
        new GraphQLIngressError({
          message: 'Access token expired',
          type: 'auth',
        }),
      )
      .mockRejectedValueOnce(
        new GraphQLIngressError({
          message: 'Upstream session expired',
          type: 'auth',
        }),
      );

    await expect(
      executeGraphQL(
        'query UpstreamProxyAfterRefresh { upstream { id } }',
        {},
        { logoutOnRetryAuthFailure: false },
      ),
    ).rejects.toMatchObject({
      message: 'Upstream session expired',
      type: 'auth',
    });

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(onAuthFailure).not.toHaveBeenCalled();
    expect(clientQueryMock).toHaveBeenCalledTimes(2);
  });
});
