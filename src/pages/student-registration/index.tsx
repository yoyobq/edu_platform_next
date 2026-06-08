// src/pages/student-registration/index.tsx

import { useRef, useState } from 'react';
import { Card, Flex, Typography } from 'antd';
import { useParams } from 'react-router';

import {
  StudentRegistrationLinkPanel,
  type StudentRegistrationPanelContext,
} from '@/features/public-auth';

import { BrandLockup } from '@/shared/ui/brand';
import { useWidthBand } from '@/shared/ui/responsive-layout';

type StudentRegistrationWidthBand = 'compact' | 'regular';

const STUDENT_REGISTRATION_WIDTH_RULES: { max: number; value: StudentRegistrationWidthBand }[] = [
  { max: 760, value: 'compact' },
];

function resolveStudentRegistrationLead(context: StudentRegistrationPanelContext) {
  if (context.phase === 'loading') {
    return '正在读取注册链接，请稍候。';
  }

  if (context.phase === 'failure' || context.phase === 'error') {
    return '当前注册链接暂不可用，请根据页面提示处理。';
  }

  if (context.phase === 'pending-email') {
    return '注册信息已提交，接下来请验证登录邮箱。';
  }

  return '请按步骤核对身份并设置平台账号。';
}

export function StudentRegistrationPage() {
  const { token = '' } = useParams();
  const shellRef = useRef<HTMLDivElement>(null);
  const { band } = useWidthBand<HTMLDivElement, StudentRegistrationWidthBand>(
    shellRef,
    STUDENT_REGISTRATION_WIDTH_RULES,
    'regular',
  );
  const isCompact = band === 'compact';
  const [registrationContext, setRegistrationContext] = useState<StudentRegistrationPanelContext>({
    currentStep: 0,
    info: null,
    phase: 'loading',
  });
  const registrationClassName = registrationContext.info?.className?.trim();
  const registrationTitle = registrationClassName
    ? `${registrationClassName} 学生注册`
    : '学生注册';

  return (
    <div ref={shellRef} className="min-h-screen bg-bg-layout px-6 py-10 text-text">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl flex-col justify-center gap-6">
        <Flex
          vertical
          gap={20}
          align={isCompact ? 'center' : 'flex-start'}
          style={{ textAlign: isCompact ? 'center' : 'left' }}
        >
          <BrandLockup variant="public-entry" />
          <div style={{ maxWidth: 680 }}>
            <h1
              style={{
                fontSize: 'var(--ant-font-size-heading-3)',
                fontWeight: 600,
                lineHeight: 'var(--ant-line-height-heading-3)',
                marginBottom: 12,
                marginTop: 8,
              }}
            >
              {registrationTitle}
            </h1>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {resolveStudentRegistrationLead(registrationContext)}
            </Typography.Paragraph>
          </div>
        </Flex>

        <Card styles={{ body: { padding: isCompact ? '20px 16px' : 32 } }}>
          <StudentRegistrationLinkPanel
            compact={isCompact}
            token={token}
            onContextChange={setRegistrationContext}
          />
        </Card>
      </div>
    </div>
  );
}
