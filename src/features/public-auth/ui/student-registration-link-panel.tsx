// src/features/public-auth/ui/student-registration-link-panel.tsx

import { useEffect, useRef, useState } from 'react';
import { MailOutlined, ReloadOutlined, RightOutlined, TeamOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Form, Input, Skeleton, Steps, Typography } from 'antd';
import { useNavigate } from 'react-router';

import { validateAccountPassword } from '../application/account-password-validation';
import {
  isValidStudentRegistrationIdCardLastSix,
  isValidStudentRegistrationLoginName,
} from '../application/student-registration-validation';
import type {
  StudentRegistrationConsumptionResult,
  StudentRegistrationLinkInfo,
  StudentRegistrationLinkReason,
} from '../application/types';
import { publicAuthApi } from '../infrastructure/public-auth-api';

const PUBLIC_AUTH_RETURN_LOGIN_URL = '/login?skipRestore=1';
const FALLBACK_STUDENT_REGISTRATION_ID_EXAMPLE = '3130102XX';
const STUDENT_REGISTRATION_LINK_LEVEL_REASONS = new Set<string>([
  'CLASS_NOT_FOUND',
  'LINK_EXPIRED',
  'LINK_NOT_ACTIVE',
  'LINK_NOT_FOUND',
  'LINK_REVOKED',
]);

type StudentRegistrationPhase = 'loading' | 'ready' | 'failure' | 'error' | 'pending-email';

export type StudentRegistrationPanelContext = {
  currentStep: number;
  emailVerificationRequired: boolean | null;
  info: StudentRegistrationLinkInfo | null;
  phase: StudentRegistrationPhase;
};

type StudentRegistrationFormValues = {
  confirmPassword: string;
  idCardLastSix: string;
  loginEmail: string;
  loginName: string;
  loginPassword: string;
  name: string;
  nickname: string;
  studentId: string;
};

type StudentRegistrationStep = {
  description: string;
  fields: (keyof StudentRegistrationFormValues)[];
  title: string;
};

type StudentRegistrationStepSnapshot = Partial<Record<keyof StudentRegistrationFormValues, string>>;

const studentRegistrationSteps: StudentRegistrationStep[] = [
  {
    title: '身份核对',
    description: '确认受邀学生',
    fields: ['studentId', 'name', 'idCardLastSix'],
  },
  {
    title: '账号信息',
    description: '设置登录凭证',
    fields: ['nickname', 'loginName', 'loginPassword', 'confirmPassword'],
  },
  {
    title: '登录邮箱',
    description: '进入邮箱验证',
    fields: ['loginEmail'],
  },
];

function isStudentRegistrationLinkLevelReason(
  reason: string,
): reason is StudentRegistrationLinkReason {
  return STUDENT_REGISTRATION_LINK_LEVEL_REASONS.has(reason);
}

function resolveLinkFailureTitle(
  reason: StudentRegistrationLinkReason,
  info: StudentRegistrationLinkInfo | null,
) {
  if (info?.status === 'CONSUMED') {
    return '注册链接已使用';
  }

  if (reason === 'LINK_EXPIRED') {
    return '注册链接已过期';
  }

  if (reason === 'LINK_REVOKED') {
    return '注册链接已撤销';
  }

  if (reason === 'CLASS_NOT_FOUND') {
    return '班级不可用';
  }

  return '注册链接不可用';
}

function StudentRegistrationSummaryCard({ info }: { info: StudentRegistrationLinkInfo }) {
  const classLabel = info.className || info.classCode;

  return (
    <div className="rounded-card p-4" style={{ background: 'var(--ant-color-fill-quaternary)' }}>
      <Flex gap={8} align="center">
        <TeamOutlined
          style={{ color: 'var(--ant-color-primary)', fontSize: 'var(--ant-font-size-lg)' }}
        />
        <Typography.Text strong>{classLabel}</Typography.Text>
      </Flex>
    </div>
  );
}

function StudentRegistrationProgress({
  compact,
  currentStep,
}: {
  compact: boolean;
  currentStep: number;
}) {
  return (
    <Steps
      current={currentStep}
      orientation={compact ? 'vertical' : 'horizontal'}
      responsive={false}
      size="small"
      titlePlacement={compact ? 'horizontal' : 'vertical'}
      items={studentRegistrationSteps.map((step) => ({
        content: step.description,
        title: step.title,
      }))}
    />
  );
}

function resolveStudentIdExample(info: StudentRegistrationLinkInfo) {
  const expandedClassMatch = info.className?.match(/(\d{2})大(\d{1,2})/) ?? null;

  if (expandedClassMatch) {
    const [, enrollmentYear, classNumber] = expandedClassMatch;

    return `3${enrollmentYear}02${classNumber.padStart(2, '0')}XX`;
  }

  const classDigits = info.className?.match(/\d{4}/)?.[0] ?? null;

  if (!classDigits) {
    return FALLBACK_STUDENT_REGISTRATION_ID_EXAMPLE;
  }

  const enrollmentYear = classDigits.slice(0, 2);
  const classNumber = classDigits.slice(2, 4);

  return `3${enrollmentYear}01${classNumber}XX`;
}

function StudentRegistrationForm({
  currentStep,
  info,
  onCurrentStepChange,
  onSubmit,
  onVerifyAccount,
  onVerifyIdentity,
  verifyingAccount,
  verifyingIdentity,
  submitError,
  submitting,
}: {
  currentStep: number;
  info: StudentRegistrationLinkInfo;
  onCurrentStepChange: (step: number) => void;
  onSubmit: (values: StudentRegistrationFormValues) => Promise<void>;
  onVerifyAccount: (
    values: Pick<StudentRegistrationFormValues, 'loginName' | 'loginPassword' | 'nickname'>,
  ) => Promise<boolean>;
  onVerifyIdentity: (
    values: Pick<StudentRegistrationFormValues, 'idCardLastSix' | 'name' | 'studentId'>,
  ) => Promise<boolean>;
  verifyingAccount: boolean;
  verifyingIdentity: boolean;
  submitError: string | null;
  submitting: boolean;
}) {
  const [form] = Form.useForm<StudentRegistrationFormValues>();
  const [nicknameTouched, setNicknameTouched] = useState(false);
  const [stepTransitioning, setStepTransitioning] = useState(false);
  const currentStepRef = useRef(currentStep);
  const nextStepInFlightRef = useRef(false);
  const verificationRequestIdRef = useRef(0);
  const isStudentIdLocked = info.scope === 'STUDENT' && Boolean(info.studentId);
  const isLastStep = currentStep === studentRegistrationSteps.length - 1;
  const studentIdExample = resolveStudentIdExample(info);
  const isIdentityStepVerifying = currentStep === 0 && (verifyingIdentity || stepTransitioning);
  const isAccountStepVerifying = currentStep === 1 && (verifyingAccount || stepTransitioning);
  const isCurrentStepBusy =
    isIdentityStepVerifying || isAccountStepVerifying || stepTransitioning || submitting;

  useEffect(() => {
    form.setFieldsValue({
      studentId: isStudentIdLocked ? (info.studentId ?? '') : '',
    });
    setNicknameTouched(false);
  }, [form, info.studentId, isStudentIdLocked]);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  function readStepSnapshot(
    fields: (keyof StudentRegistrationFormValues)[],
  ): StudentRegistrationStepSnapshot {
    const values = form.getFieldsValue(fields);

    return fields.reduce<StudentRegistrationStepSnapshot>((snapshot, field) => {
      snapshot[field] = values[field] ?? '';
      return snapshot;
    }, {});
  }

  function isSameStepSnapshot(
    fields: (keyof StudentRegistrationFormValues)[],
    left: StudentRegistrationStepSnapshot,
    right: StudentRegistrationStepSnapshot,
  ) {
    return fields.every((field) => (left[field] ?? '') === (right[field] ?? ''));
  }

  async function goToNextStep() {
    if (isCurrentStepBusy || nextStepInFlightRef.current) {
      return;
    }

    nextStepInFlightRef.current = true;
    setStepTransitioning(true);

    try {
      const stepAtRequest = currentStep;
      const stepFields = studentRegistrationSteps[stepAtRequest].fields;

      await form.validateFields(stepFields);

      const requestId = verificationRequestIdRef.current + 1;
      verificationRequestIdRef.current = requestId;
      const requestSnapshot = readStepSnapshot(stepFields);

      if (stepAtRequest === 0) {
        const values = form.getFieldsValue();
        const canProceed = await onVerifyIdentity({
          idCardLastSix: values.idCardLastSix,
          name: values.name,
          studentId: values.studentId,
        });

        if (!canProceed) {
          return;
        }
      }

      if (stepAtRequest === 1) {
        const values = form.getFieldsValue();
        const canProceed = await onVerifyAccount({
          loginName: values.loginName,
          loginPassword: values.loginPassword,
          nickname: values.nickname,
        });

        if (!canProceed) {
          return;
        }
      }

      const isLatestRequest = verificationRequestIdRef.current === requestId;
      const isStillSameStep = currentStepRef.current === stepAtRequest;
      const isStillSameInput = isSameStepSnapshot(
        stepFields,
        requestSnapshot,
        readStepSnapshot(stepFields),
      );

      if (!isLatestRequest || !isStillSameStep || !isStillSameInput) {
        return;
      }

      onCurrentStepChange(Math.min(stepAtRequest + 1, studentRegistrationSteps.length - 1));
    } catch {
      // antd Form has already rendered field-level validation feedback.
    } finally {
      nextStepInFlightRef.current = false;
      setStepTransitioning(false);
    }
  }

  function goToPreviousStep() {
    if (isCurrentStepBusy || nextStepInFlightRef.current) {
      return;
    }

    verificationRequestIdRef.current += 1;
    onCurrentStepChange(Math.max(currentStep - 1, 0));
  }

  function moveToFirstErrorStep(errorFields: { name: (string | number)[] }[]) {
    const firstErrorField = errorFields[0]?.name[0];

    if (typeof firstErrorField !== 'string') {
      return;
    }

    const targetStep = studentRegistrationSteps.findIndex((step) =>
      step.fields.includes(firstErrorField as keyof StudentRegistrationFormValues),
    );

    if (targetStep >= 0) {
      onCurrentStepChange(targetStep);
    }
  }

  return (
    <Form<StudentRegistrationFormValues>
      form={form}
      layout="vertical"
      requiredMark={false}
      onFinish={onSubmit}
      onFinishFailed={({ errorFields }) => moveToFirstErrorStep(errorFields)}
      onValuesChange={(changedValues) => {
        if ('nickname' in changedValues) {
          setNicknameTouched(true);
        }

        if ('name' in changedValues && !nicknameTouched) {
          form.setFieldValue('nickname', changedValues.name);
        }
      }}
      autoComplete="on"
      size="large"
    >
      {submitError ? (
        <Form.Item>
          <Alert type="error" showIcon title={submitError} />
        </Form.Item>
      ) : null}

      <div hidden={currentStep !== 0}>
        <Form.Item
          label="学号"
          name="studentId"
          rules={[{ required: true, message: '请输入学号。', whitespace: true }]}
          extra={isStudentIdLocked ? '这个链接已指定学号，不能修改。' : `例如：${studentIdExample}`}
        >
          <Input
            disabled={isStudentIdLocked || isIdentityStepVerifying}
            placeholder="请输入完整学号"
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item
          label="学生姓名"
          name="name"
          rules={[{ required: true, message: '请输入学生姓名。', whitespace: true }]}
        >
          <Input
            disabled={isIdentityStepVerifying}
            placeholder="请输入你的真实姓名"
            autoComplete="name"
          />
        </Form.Item>

        <Form.Item
          label="身份证后 6 位"
          name="idCardLastSix"
          validateTrigger={['onChange', 'onBlur']}
          rules={[
            { required: true, message: '请输入身份证后 6 位。' },
            {
              validator(_, value: string | undefined) {
                if (!value || isValidStudentRegistrationIdCardLastSix(value)) {
                  return Promise.resolve();
                }

                return Promise.reject(
                  new Error('身份证后 6 位只能包含数字或字母，且长度必须为 6。'),
                );
              },
            },
          ]}
        >
          <Input
            disabled={isIdentityStepVerifying}
            placeholder="请输入身份证后 6 位"
            autoComplete="off"
            maxLength={6}
          />
        </Form.Item>
      </div>

      <div hidden={currentStep !== 1}>
        <Form.Item label="昵称（可选）" name="nickname" extra="默认使用学生姓名，也可以自定义。">
          <Input
            disabled={isAccountStepVerifying}
            placeholder="可选填写昵称"
            autoComplete="nickname"
          />
        </Form.Item>

        <Form.Item
          label="登录名（可选）"
          name="loginName"
          validateTrigger={['onChange', 'onBlur']}
          extra="留空时可直接使用登录邮箱登录。"
          rules={[
            {
              validator(_, value: string | undefined) {
                if (isValidStudentRegistrationLoginName(value)) {
                  return Promise.resolve();
                }

                return Promise.reject(
                  new Error('登录名需为 4-30 位，只能包含字母、数字、下划线或短横线。'),
                );
              },
            },
          ]}
        >
          <Input
            disabled={isAccountStepVerifying}
            placeholder="可选填写登录名"
            autoComplete="username"
          />
        </Form.Item>

        <Form.Item
          label="登录密码"
          name="loginPassword"
          validateFirst
          validateTrigger={['onChange', 'onBlur']}
          rules={[
            { required: true, message: '请输入登录密码。' },
            {
              validator(_, value: string | undefined) {
                if (!value) {
                  return Promise.resolve();
                }

                const validationMessage = validateAccountPassword(value);
                if (!validationMessage) {
                  return Promise.resolve();
                }

                return Promise.reject(new Error(validationMessage));
              },
            },
          ]}
        >
          <Input.Password
            disabled={isAccountStepVerifying}
            placeholder="请输入登录密码"
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item
          label="确认登录密码"
          name="confirmPassword"
          dependencies={['loginPassword']}
          validateTrigger={['onChange', 'onBlur']}
          rules={[
            { required: true, message: '请再次输入登录密码。' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('loginPassword') === value) {
                  return Promise.resolve();
                }

                return Promise.reject(new Error('两次输入的密码不一致。'));
              },
            }),
          ]}
        >
          <Input.Password
            disabled={isAccountStepVerifying}
            placeholder="请再次输入登录密码"
            autoComplete="new-password"
          />
        </Form.Item>
      </div>

      <div hidden={currentStep !== 2}>
        <Form.Item
          label="登录邮箱"
          name="loginEmail"
          validateTrigger={['onChange', 'onBlur']}
          extra="提交后会向该邮箱发送验证邮件。"
          rules={[
            { required: true, message: '请输入登录邮箱。' },
            { type: 'email', message: '请输入有效邮箱地址。' },
          ]}
        >
          <Input disabled={submitting} placeholder="请输入登录邮箱" autoComplete="email" />
        </Form.Item>
      </div>

      <Form.Item style={{ marginBottom: 0 }}>
        <Flex gap={8} justify={currentStep > 0 ? 'space-between' : 'flex-end'} wrap>
          {currentStep > 0 ? (
            <Button disabled={isCurrentStepBusy} onClick={goToPreviousStep}>
              上一步
            </Button>
          ) : null}
          {isLastStep ? (
            <Button type="primary" htmlType="submit" loading={submitting}>
              提交注册
            </Button>
          ) : (
            <Button
              type="primary"
              disabled={isCurrentStepBusy}
              loading={
                (currentStep === 0 && verifyingIdentity) || (currentStep === 1 && verifyingAccount)
              }
              onClick={goToNextStep}
            >
              下一步
            </Button>
          )}
        </Flex>
      </Form.Item>
    </Form>
  );
}

function StudentRegistrationFailureState({
  info,
  message,
  reason,
  onReload,
}: {
  info: StudentRegistrationLinkInfo | null;
  message: string;
  onReload: () => void;
  reason: StudentRegistrationLinkReason;
}) {
  const navigate = useNavigate();

  return (
    <Flex vertical gap={16}>
      {info ? <StudentRegistrationSummaryCard info={info} /> : null}
      <Alert
        type="error"
        showIcon
        title={resolveLinkFailureTitle(reason, info)}
        description={message}
      />
      <Flex gap={8} justify="flex-end" wrap>
        <Button onClick={onReload} icon={<ReloadOutlined />}>
          重新读取
        </Button>
        <Button
          type="primary"
          icon={<RightOutlined />}
          iconPlacement="end"
          onClick={() => navigate(PUBLIC_AUTH_RETURN_LOGIN_URL)}
        >
          返回登录
        </Button>
      </Flex>
    </Flex>
  );
}

function PendingEmailState({
  result,
}: {
  result: Extract<StudentRegistrationConsumptionResult, { status: 'success' }>;
}) {
  const navigate = useNavigate();
  const requiresEmailVerification = result.emailVerificationRequired;
  const [resending, setResending] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<{
    message: string;
    type: 'error' | 'info';
  } | null>(null);
  const navigateToLogin = () =>
    navigate(PUBLIC_AUTH_RETURN_LOGIN_URL, {
      state: {
        loginName: result.loginEmail,
      },
    });

  return (
    <Flex vertical gap={16}>
      <Alert
        type="success"
        showIcon
        title="账号已创建"
        description={
          requiresEmailVerification
            ? '请先完成登录邮箱验证。验证完成后，就可以使用登录邮箱或登录名登录。'
            : '账号已经可以登录。你可以使用登录邮箱或登录名登录。'
        }
      />
      <div className="rounded-card p-4" style={{ background: 'var(--ant-color-fill-quaternary)' }}>
        <Flex gap={8} align="center">
          <MailOutlined
            style={{ color: 'var(--ant-color-primary)', fontSize: 'var(--ant-font-size-lg)' }}
          />
          <Typography.Text strong>{result.loginEmail}</Typography.Text>
        </Flex>
      </div>
      {requiresEmailVerification ? (
        <Alert
          type={result.emailVerificationSent ? 'info' : 'warning'}
          showIcon
          title={result.emailVerificationSent ? '验证邮件已发送' : '验证邮件发送失败'}
          description={
            result.emailVerificationSent
              ? '请查收登录邮箱中的验证邮件，并通过邮件链接完成验证。'
              : '注册已经完成，但初始验证邮件未能发送。可以重新发送验证邮件。'
          }
        />
      ) : null}
      {resendFeedback ? (
        <Alert type={resendFeedback.type} showIcon title={resendFeedback.message} />
      ) : null}
      <Flex gap={8} justify="flex-end" wrap>
        {requiresEmailVerification ? (
          <Button
            icon={<ReloadOutlined />}
            loading={resending}
            onClick={async () => {
              setResending(true);
              setResendFeedback(null);

              try {
                const resendResult = await publicAuthApi.resendLoginEmailVerification({
                  loginEmail: result.loginEmail,
                });

                if (resendResult.status === 'success') {
                  setResendFeedback({
                    type: 'info',
                    message: '如果账户需要验证，请稍后查收邮箱。',
                  });
                  return;
                }

                setResendFeedback({
                  type: 'error',
                  message: resendResult.message,
                });
              } finally {
                setResending(false);
              }
            }}
          >
            重新发送验证邮件
          </Button>
        ) : null}
        <Button
          type="primary"
          icon={<RightOutlined />}
          iconPlacement="end"
          onClick={navigateToLogin}
        >
          前往登录
        </Button>
      </Flex>
    </Flex>
  );
}

export function StudentRegistrationLinkPanel({
  compact = false,
  onContextChange,
  token,
}: {
  compact?: boolean;
  onContextChange?: (context: StudentRegistrationPanelContext) => void;
  token: string;
}) {
  const [phase, setPhase] = useState<StudentRegistrationPhase>('loading');
  const [currentStep, setCurrentStep] = useState(0);
  const [linkInfo, setLinkInfo] = useState<StudentRegistrationLinkInfo | null>(null);
  const [linkFailure, setLinkFailure] = useState<{
    info: StudentRegistrationLinkInfo | null;
    message: string;
    reason: StudentRegistrationLinkReason;
  } | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [verifyingIdentity, setVerifyingIdentity] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<Extract<
    StudentRegistrationConsumptionResult,
    { status: 'success' }
  > | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    onContextChange?.({
      currentStep,
      emailVerificationRequired:
        phase === 'pending-email' ? (successResult?.emailVerificationRequired ?? true) : null,
      info: linkInfo,
      phase,
    });
  }, [currentStep, linkInfo, onContextChange, phase, successResult?.emailVerificationRequired]);

  useEffect(() => {
    let isActive = true;

    async function runWorkflow() {
      setPhase('loading');
      setCurrentStep(0);
      setLinkInfo(null);
      setLinkFailure(null);
      setPageError(null);
      setSubmitError(null);
      setVerifyingAccount(false);
      setVerifyingIdentity(false);
      setSuccessResult(null);

      const result = await publicAuthApi.getStudentRegistrationLinkInfo({
        token,
      });

      if (!isActive) {
        return;
      }

      if (result.status === 'ready') {
        setLinkInfo(result.info);
        setPhase('ready');
        return;
      }

      if (result.status === 'failure') {
        setLinkInfo(result.info);
        setLinkFailure({
          info: result.info,
          message: result.message,
          reason: result.reason,
        });
        setPhase('failure');
        return;
      }

      setPageError(result.message);
      setPhase('error');
    }

    void runWorkflow();

    return () => {
      isActive = false;
    };
  }, [reloadKey, token]);

  async function refreshStudentRegistrationLinkState() {
    const result = await publicAuthApi.getStudentRegistrationLinkInfo({
      token,
    });

    setSubmitError(null);

    if (result.status === 'ready') {
      setLinkInfo(result.info);
      setLinkFailure(null);
      setPageError(null);
      setPhase('ready');
      return 'ready';
    }

    if (result.status === 'failure') {
      setLinkInfo(result.info);
      setLinkFailure({
        info: result.info,
        message: result.message,
        reason: result.reason,
      });
      setPageError(null);
      setPhase('failure');
      return 'blocked';
    }

    setLinkFailure(null);
    setPageError(result.message);
    setPhase('error');
    return 'blocked';
  }

  if (phase === 'loading') {
    return (
      <Flex vertical gap={12}>
        <Typography.Text type="secondary">正在读取学生注册链接</Typography.Text>
        <Skeleton active paragraph={{ rows: 4 }} title={false} />
      </Flex>
    );
  }

  if (phase === 'failure' && linkFailure) {
    return (
      <StudentRegistrationFailureState
        info={linkFailure.info}
        message={linkFailure.message}
        reason={linkFailure.reason}
        onReload={() => setReloadKey((current) => current + 1)}
      />
    );
  }

  if (phase === 'error' && pageError) {
    return (
      <Flex vertical gap={16}>
        <Alert type="error" showIcon title="暂时无法读取注册链接" description={pageError} />
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={() => setReloadKey((current) => current + 1)}
        >
          重新读取
        </Button>
      </Flex>
    );
  }

  if (phase === 'pending-email' && successResult) {
    return <PendingEmailState result={successResult} />;
  }

  if (!linkInfo) {
    return null;
  }

  return (
    <Flex vertical gap={compact ? 20 : 28}>
      <StudentRegistrationProgress compact={compact} currentStep={currentStep} />
      <StudentRegistrationForm
        currentStep={currentStep}
        info={linkInfo}
        onCurrentStepChange={setCurrentStep}
        verifyingAccount={verifyingAccount}
        verifyingIdentity={verifyingIdentity}
        submitError={submitError}
        submitting={submitting}
        onVerifyAccount={async (values) => {
          setVerifyingAccount(true);
          setSubmitError(null);

          try {
            const result = await publicAuthApi.verifyStudentRegistrationAccount({
              loginName: values.loginName,
              loginPassword: values.loginPassword,
              nickname: values.nickname,
              token,
            });

            if (result.status === 'success') {
              return true;
            }

            if (
              result.status === 'failure' &&
              isStudentRegistrationLinkLevelReason(result.reason)
            ) {
              const latestState = await refreshStudentRegistrationLinkState();

              if (latestState === 'ready') {
                setSubmitError(result.message);
              }

              return false;
            }

            setSubmitError(result.message);
            return false;
          } finally {
            setVerifyingAccount(false);
          }
        }}
        onVerifyIdentity={async (values) => {
          setVerifyingIdentity(true);
          setSubmitError(null);

          try {
            const result = await publicAuthApi.verifyStudentRegistrationIdentity({
              idCardLastSix: values.idCardLastSix,
              name: values.name,
              studentId: values.studentId,
              token,
            });

            if (result.status === 'success') {
              return true;
            }

            if (
              result.status === 'failure' &&
              isStudentRegistrationLinkLevelReason(result.reason)
            ) {
              const latestState = await refreshStudentRegistrationLinkState();

              if (latestState === 'ready') {
                setSubmitError(result.message);
              }

              return false;
            }

            setSubmitError(result.message);
            return false;
          } finally {
            setVerifyingIdentity(false);
          }
        }}
        onSubmit={async (values) => {
          setSubmitting(true);
          setSubmitError(null);

          try {
            const result = await publicAuthApi.consumeStudentRegistrationLink({
              idCardLastSix: values.idCardLastSix,
              loginEmail: values.loginEmail,
              loginName: values.loginName,
              loginPassword: values.loginPassword,
              name: values.name,
              nickname: values.nickname,
              studentId: values.studentId,
              token,
            });

            if (result.status === 'success') {
              setSuccessResult(result);
              setPhase('pending-email');
              return;
            }

            if (result.status === 'link-failure') {
              const latestState = await refreshStudentRegistrationLinkState();

              if (latestState === 'ready') {
                setSubmitError(result.message);
              }

              return;
            }

            setSubmitError(result.message);
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </Flex>
  );
}
