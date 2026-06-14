// src/entities/upstream-session/infrastructure/upstream-session-graphql.integration.spec.ts
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

vi.mock('@/shared/graphql/client', () => ({
  getGraphQLClient: getGraphQLClientMock,
  getGraphQLRuntimeConfig: getGraphQLRuntimeConfigMock,
}));

import { GraphQLIngressError } from '@/shared/graphql';

import { executeUpstreamSessionGraphQL } from './upstream-session-graphql';

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

describe('executeUpstreamSessionGraphQL integration', () => {
  beforeEach(() => {
    clientMutateMock.mockReset();
    clientQueryMock.mockReset();
    getGraphQLClientMock.mockReset();
    getGraphQLRuntimeConfigMock.mockReset();
    getOperationASTMock.mockReset();
    gqlMock.mockReset();

    getGraphQLClientMock.mockReturnValue({
      mutate: clientMutateMock,
      query: clientQueryMock,
    });
    getGraphQLRuntimeConfigMock.mockReturnValue({});
    getOperationASTMock.mockReturnValue(
      createOperation(OperationTypeNode.QUERY, 'FetchClassDirectory'),
    );
    gqlMock.mockImplementation((query: string) => ({
      definitions: [],
      kind: 'Document',
      query,
    }));
  });

  it('keeps site reactive refresh enabled for protected upstream proxy requests', async () => {
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
      .mockResolvedValueOnce({
        data: {
          fetchClassDirectory: {
            classes: [],
            upstreamSessionToken: 'upstream-token-002',
          },
        },
      });

    await expect(
      executeUpstreamSessionGraphQL(
        `
          query FetchClassDirectory($sessionToken: String!) {
            fetchClassDirectory(sessionToken: $sessionToken) {
              upstreamSessionToken
            }
          }
        `,
        {
          sessionToken: 'upstream-token-001',
        },
      ),
    ).resolves.toEqual({
      fetchClassDirectory: {
        classes: [],
        upstreamSessionToken: 'upstream-token-002',
      },
    });

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(onAuthFailure).not.toHaveBeenCalled();
    expect(clientQueryMock).toHaveBeenCalledTimes(2);
    expect(clientQueryMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        context: {
          authMode: 'required',
        },
        variables: {
          sessionToken: 'upstream-token-001',
        },
      }),
    );
    expect(clientQueryMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        context: {
          authMode: 'required',
        },
        variables: {
          sessionToken: 'upstream-token-001',
        },
      }),
    );
  });
});
