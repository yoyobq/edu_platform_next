// src/labs/teaching-inspection/time-plan-presentation.ts
import type { TimeWorkspace } from './model';

export type TimeCourse = TimeWorkspace['resources'][number];
export function needsCourseAttention(row: TimeCourse, workspace: TimeWorkspace): boolean {
  if (row.blockers.some((code) => code !== 'SHORT_COURSE')) return true;
  const group = row.grouping?.group ?? row.timePlan.group;
  if (!group || group === 'CUSTOM') return !row.timePlan.confirmed || !!row.grouping?.needsReview;
  const rule =
    group === 'FULL'
      ? workspace.semesterTimePlan
      : workspace.groupPlans?.find((plan) => plan.group === group);
  // Waiting for a semester-wide confirmation is not an individual course exception.
  if (!rule?.confirmed || (workspace.grouping && !workspace.grouping.confirmed)) return false;
  return !!row.grouping?.needsReview;
}
