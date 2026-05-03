import type { StaffDirectoryEntry } from '@/shared/upstream';

function includesAnyKeyword(value: string, keywords: readonly string[]) {
  const normalizedValue = value.toLowerCase();

  return keywords.some((keyword) => normalizedValue.includes(keyword.toLowerCase()));
}

export function resolveStaffInviteFailureMessage(input: {
  email: string;
  error: unknown;
  fallback: string;
  teacher: StaffDirectoryEntry | null;
}) {
  const rawMessage = input.error instanceof Error ? input.error.message : input.fallback;
  const teacherLabel = input.teacher ? `${input.teacher.name}（${input.teacher.staffId}）` : null;

  if (includesAnyKeyword(rawMessage, ['email', '邮箱', 'registered', '已注册'])) {
    return `登录邮箱 ${input.email} 已注册。请换一个邮箱，或让用户直接登录 / 使用找回密码。`;
  }

  if (
    includesAnyKeyword(rawMessage, [
      'staffId',
      'staff id',
      '教职工',
      '工号',
      '已绑定',
      '已使用',
      '占用',
    ])
  ) {
    return teacherLabel
      ? `${teacherLabel}已绑定或已被邀请，请确认是否选错教师。`
      : `${rawMessage} 请确认教师 ID 是否正确。`;
  }

  return rawMessage;
}
