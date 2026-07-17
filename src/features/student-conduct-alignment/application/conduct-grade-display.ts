// src/features/student-conduct-alignment/application/conduct-grade-display.ts

const FIELD_LABELS: Record<string, string> = {
  confirmedGrade: '确认等级',
  estimatedGrade: '推定等级',
  score: '分数',
};

const SOURCE_LABELS: Record<string, string> = {
  LOCAL_CORRECTION: '本地补正',
  MISSING: '当前缺失',
  UPSTREAM_CONFIRMED: '校园网',
};

const CONFLICT_COPY: Record<string, { description: string; label: string }> = {
  CORRECTION_CLEANUP_PENDING: {
    description: '校园网已经提供该字段，当前值以校园网为准；旧的本地补正可以清理。',
    label: '旧补正待清理',
  },
  UPSTREAM_CHANGED_SINCE_CORRECTION: {
    description:
      '校园网操行记录的整体基线在本地补正后发生了变化。为避免误用旧补正，系统暂未采用该补正；基线变化不代表当前字段已经有校园网值。',
    label: '基线变化待复核',
  },
};

export function resolveConductGradeFieldLabel(fieldKey: string) {
  return FIELD_LABELS[fieldKey] ?? fieldKey;
}

export function resolveConductGradeSourceLabel(source: string | null) {
  if (!source) return '未知来源';
  return SOURCE_LABELS[source] ?? source;
}

export function resolveConductGradeConflictCopy(code: string) {
  return (
    CONFLICT_COPY[code] ?? {
      description: '该字段存在需要人工确认的数据冲突。',
      label: code,
    }
  );
}
