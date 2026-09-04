// src/features/public-auth/application/staff-invite-login-name-validation.ts

export function validateStaffInviteLoginName(value: string | undefined): string | null {
  const normalized = value?.trim() ?? '';

  if (!normalized) {
    return null;
  }
  if (normalized.length < 4) {
    return '登录名至少 4 个字符。';
  }
  if (normalized.length > 30) {
    return '登录名最多 30 个字符。';
  }
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    return '登录名只允许字母、数字、下划线和短横线。';
  }
  if (/^[_-]|[_-]$/.test(normalized)) {
    return '登录名不得以下划线或短横线开头或结尾。';
  }
  if (/^\d+$/.test(normalized)) {
    return '登录名不得为纯数字。';
  }

  return null;
}
