// src/features/student-evaluation-comment/application/workspace-state.ts

import type { StudentEvaluationCommentWorkbench } from '../types';

type WorkspaceState =
  | {
      status: 'loading' | 'ready';
      workspace: StudentEvaluationCommentWorkbench | null;
      errorMessage: null;
    }
  | { status: 'failed'; workspace: StudentEvaluationCommentWorkbench | null; errorMessage: string };
type WorkspaceEvent =
  | { type: 'requested' }
  | { type: 'received'; workspace: StudentEvaluationCommentWorkbench }
  | { type: 'failed'; errorMessage: string };

export const initialWorkspaceState: WorkspaceState = {
  status: 'loading',
  workspace: null,
  errorMessage: null,
};

export function workspaceReducer(state: WorkspaceState, event: WorkspaceEvent): WorkspaceState {
  switch (event.type) {
    case 'requested':
      return { status: 'loading', workspace: state.workspace, errorMessage: null };
    case 'received':
      return { status: 'ready', workspace: event.workspace, errorMessage: null };
    case 'failed':
      return { status: 'failed', workspace: state.workspace, errorMessage: event.errorMessage };
  }
}
