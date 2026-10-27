// src/labs/teaching-inspection/date-policy.ts
import type { InspectionKind, Resource } from './model';

export const dateGuidance: Record<InspectionKind, string> = {
  LESSON_PLAN: '教案：上游历史可核实实际日期；偏离安排时按最近日期关联，存在歧义则人工核对。',
  PROGRESS: '进度：已提交轮次的日期以上游为准，只能调整后续轮次；下一轮日期必须晚于此前实际日期。',
  ASSIGNMENT: '作业：上游只能核对次数。这里统一确认本地提交日期，保存后仍不能核实上游实际日期。',
};
export function suggestedInspectionDates(resource: Resource, kind: InspectionKind): string[] {
  return [0, 1, 2].map((index) =>
    kind === 'PROGRESS' && resource.schedule.records[index]
      ? resource.schedule.records[index].checkDate
      : resource.status.rounds[index]?.dateEditable
        ? (resource.suggestedDates[index] ?? resource.schedule.dates[index] ?? '')
        : (resource.schedule.dates[index] ?? ''),
  );
}
export function inspectionDateProblem(
  dates: string[],
  resource: Resource,
  kind: InspectionKind,
): string | null {
  const effective = [0, 1, 2].map((index) =>
    kind === 'PROGRESS'
      ? (resource.schedule.records[index]?.checkDate ?? dates[index])
      : dates[index],
  );
  if (effective.some((date) => !date)) return '请补齐三轮检查日期。';
  if (effective.some((date, index) => index > 0 && date <= effective[index - 1]))
    return kind === 'PROGRESS'
      ? '后续检查日期必须晚于上游已提交日期，且三轮日期严格递增，请调整后重新预览。'
      : '三轮检查日期必须严格递增，不能重复，请调整后重新预览。';
  return null;
}
