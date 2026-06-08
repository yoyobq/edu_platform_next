// src/pages/student-registration/copy.ts

import type { StudentRegistrationPanelContext } from '@/features/public-auth';

export function resolveStudentRegistrationLead(context: StudentRegistrationPanelContext) {
  if (context.phase === 'loading') {
    return '正在读取注册链接，请稍候。';
  }

  if (context.phase === 'failure' || context.phase === 'error') {
    return '当前注册链接暂不可用，请根据页面提示处理。';
  }

  if (context.phase === 'pending-email') {
    if (context.emailVerificationRequired === false) {
      return '注册信息已提交，账号已可直接登录。';
    }

    return '注册信息已提交，接下来请验证登录邮箱。';
  }

  return '请按步骤核对身份并设置平台账号。';
}
