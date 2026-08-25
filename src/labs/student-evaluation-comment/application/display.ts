// src/labs/student-evaluation-comment/application/display.ts

import { hasGraphQLCategory, isGraphQLIngressError } from '@/shared/graphql';

const STUDENT_STATUS_LABELS: Record<string, string> = {
  DROPPED: '退学',
  ENROLLED: '在读',
  GRADUATED: '已毕业',
  NOT_CHECKED_IN: '未报到',
  OFF_CAMPUS_INTERNSHIP: '校外实习',
  PRE_REGISTERED: '预报到',
  SUSPENDED: '暂离',
};

export function formatStudentEvaluationCommentDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatStudentEvaluationCommentStatus(status: string) {
  return STUDENT_STATUS_LABELS[status] ?? status;
}

export function isStudentEvaluationCommentConflict(error: unknown) {
  return hasGraphQLCategory(error, 'CONFLICT');
}

export function resolveStudentEvaluationCommentErrorMessage(
  error: unknown,
  context: 'ai' | 'class-scope' | 'mine' | 'options' | 'save',
) {
  if (hasGraphQLCategory(error, 'FORBIDDEN')) {
    if (context === 'mine') {
      return '当前账号未绑定有效学生身份，或无权读取本人评语。';
    }

    if (context === 'options') {
      return '当前账号无权读取候选数据，可尝试直接输入班级 classId。';
    }

    return '当前账号没有目标班级的正式评语编辑权限。';
  }

  if (hasGraphQLCategory(error, 'BAD_USER_INPUT')) {
    return '输入无效，或班级、学期、活动名单已经发生变化，请核对后重试。';
  }

  if (hasGraphQLCategory(error, 'CONFLICT')) {
    return context === 'ai'
      ? 'AI 草稿状态已变化，请保留当前文本并重新加载草稿。'
      : '评语已被其他人修改，请重新加载当前班级数据。';
  }

  if (hasGraphQLCategory(error, 'INTERNAL_SERVER_ERROR')) {
    return context === 'ai'
      ? 'AI 评语草稿服务暂时不可用，人工评语仍可继续使用。'
      : '评语服务暂时不可用，请稍后重试。';
  }

  if (isGraphQLIngressError(error)) {
    return error.userMessage;
  }

  return error instanceof Error ? error.message : '请求失败，请稍后重试。';
}
