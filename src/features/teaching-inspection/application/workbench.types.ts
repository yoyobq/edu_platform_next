// src/features/teaching-inspection/application/workbench.types.ts
import type {
  UpstreamAccountIdentity,
  useUpstreamLoginModalController,
} from '@/entities/upstream-session';

import type * as Flow from '../infrastructure/api';
import type * as Api from '../infrastructure/lesson-api';
import type { RecoveryEntry } from '../infrastructure/recovery';
import type { Prepared } from '../model';
type Controller = ReturnType<typeof useUpstreamLoginModalController<never>>;
export type Draft = {
  prepared?: Prepared;
  editedChapter?: string;
  message: string;
  state: 'ready' | 'error' | 'unknown' | 'saved' | 'busy';
};
export type Row = {
  key: string;
  name: string;
  staffId: string;
  group: string;
  course?: Api.LessonSummary;
  round: number;
  date?: string;
};
export type Activity =
  | { kind: 'sync'; key: string }
  | { kind: 'batch-sync' }
  | { kind: 'prepare'; dispatched?: boolean }
  | { kind: 'submit'; key?: string }
  | null;
export type ExecutionProgress = {
  done: number;
  total: number;
  label: string;
  success: number;
  failed: number;
  unknown: number;
};
type Setter<T> = (value: T | ((old: T) => T)) => void;
export type RunContext = {
  running: { current: boolean };
  stop: { current: boolean };
  alive: { current: boolean };
  latestSession: { current: Controller };
  chosen: Row[];
  rows: Row[];
  emptyChapter: (row: Row) => boolean;
  canPrepare: (row: Row) => boolean;
  canSubmit: (row: Row) => boolean;
  patch: (key: string, value: Draft) => void;
  drafts: Record<string, Draft>;
  setBusy: (value: boolean) => void;
  setActivity: (value: Activity) => void;
  setError: (value: string) => void;
  setProgress: Setter<ExecutionProgress>;
  setDrafts: Setter<Record<string, Draft>>;
  setSelected: (value: string[]) => void;
  semesterId: number;
  kind: 'LESSON_PLAN' | 'PROGRESS' | 'ASSIGNMENT';
  isIndividual: boolean;
  isProgress: boolean;
  account: UpstreamAccountIdentity;
  location: { departmentId?: string | null };
  retirePreparationTracking: (row: Row) => void;
  track: (entry: RecoveryEntry) => void;
  forget: (ids: string[]) => void;
  rememberPreparation: (result: Prepared) => void;
  reload: () => Promise<void>;
  recoveries: () => unknown;
  flow: typeof Flow;
  api: typeof Api;
  newRequestId: () => string;
  waitBetweenItems: () => Promise<void>;
};
