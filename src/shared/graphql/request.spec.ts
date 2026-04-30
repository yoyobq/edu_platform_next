import { Kind, type OperationDefinitionNode, OperationTypeNode } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clientMutateMock, clientQueryMock, getGraphQLClientMock, getOperationASTMock, gqlMock } =
  vi.hoisted(() => ({
    clientMutateMock: vi.fn(),
    clientQueryMock: vi.fn(),
    getGraphQLClientMock: vi.fn(),
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
  getGraphQLRuntimeConfig: () => ({}),
}));

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
    getOperationASTMock.mockReset();
    gqlMock.mockReset();

    clientQueryMock.mockResolvedValue({ data: { ok: true } });
    getGraphQLClientMock.mockReturnValue({
      mutate: clientMutateMock,
      query: clientQueryMock,
    });
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
});
