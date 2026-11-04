// src/features/teaching-inspection/infrastructure/reconciliation.ts
import { reconcileLessonSaves as lesson } from '../application/lesson-reread';
import { reconcileProgress as progress } from '../application/progress-recovery';

import * as api from './api';
import * as recovery from './recovery';
type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer R] ? R : never;
export const reconcileProgress = (...args: Tail<Parameters<typeof progress>>) =>
  progress({ api, ...recovery }, ...args);
export const reconcileLessonSaves = (...args: Tail<Parameters<typeof lesson>>) =>
  lesson({ api, ...recovery }, ...args);
