// src/features/public-auth/ui/student-registration-link-panel.tsx

import { useEffect, useState } from 'react';
import {
  CheckCircleOutlined,
  MailOutlined,
  ReloadOutlined,
  RightOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Alert, Button, Flex, Form, Input, Skeleton, Typography } from 'antd';
import { useNavigate } from 'react-router';

import {
  getStudentRegistrationPasswordRuleState,
  isValidStudentRegistrationIdCardLastSix,
  isValidStudentRegistrationLoginName,
  studentRegistrationPasswordValidationMessage,
} from '../application/student-registration-validation';
import type {
  StudentRegistrationConsumptionResult,
  StudentRegistrationLinkInfo,
  StudentRegistrationLinkReason,
} from '../application/types';
import { publicAuthApi } from '../infrastructure/public-auth-api';

const PUBLIC_AUTH_RETURN_LOGIN_URL = '/login?skipRestore=1';

type StudentRegistrationPhase = 'loading' | 'ready' | 'failure' | 'error' | 'pending-email';

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

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveLinkFailureTitle(reason: StudentRegistrationLinkReason) {
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
  return (
    <div className="rounded-card p-4" style={{ background: 'var(--ant-color-fill-quaternary)' }}>
      <Flex vertical gap={12}>
        <Flex gap={8} align="center">
          <TeamOutlined
            style={{ color: 'var(--ant-color-primary)', fontSize: 'var(--ant-font-size-lg)' }}
          />
          <Typography.Text strong>{info.className || info.classCode}</Typography.Text>
        </Flex>
        <Flex gap={24} wrap style={{ paddingLeft: 24 }}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 'var(--ant-font-size-sm)' }}>
              班级代码
            </Typography.Text>
            <div style={{ marginTop: 2 }}>
              <Typography.Text>{info.classCode}</Typography.Text>
            </div>
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 'var(--ant-font-size-sm)' }}>
              链接类型
            </Typography.Text>
            <div style={{ marginTop: 2 }}>
              <Typography.Text>
                {info.scope === 'STUDENT' ? '指定学生' : '班级共享'}
              </Typography.Text>
            </div>
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 'var(--ant-font-size-sm)' }}>
              过期时间
            </Typography.Text>
            <div style={{ marginTop: 2 }}>
              <Typography.Text>{formatDateTime(info.expiresAt)}</Typography.Text>
            </div>
          </div>
        </Flex>
      </Flex>
    </div>
  );
}

function StudentRegistrationForm({
  info,
  onSubmit,
  submitError,
  submitting,
}: {
  info: StudentRegistrationLinkInfo;
  onSubmit: (values: StudentRegistrationFormValues) => Promise<void>;
  submitError: string | null;
  submitting: boolean;
}) {
  const [form] = Form.useForm<StudentRegistrationFormValues>();
  const [nicknameTouched, setNicknameTouched] = useState(false);
  const isStudentIdLocked = info.scope === 'STUDENT';

  useEffect(() => {
    form.setFieldsValue({
      studentId: isStudentIdLocked ? (info.studentId ?? '') : '',
    });
    setNicknameTouched(false);
  }, [form, info.studentId, isStudentIdLocked]);

  return (
    <Form<StudentRegistrationFormValues>
      form={form}
      layout="vertical"
      requiredMark={false}
      onFinish={onSubmit}
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

      <Form.Item
        label="学生编号"
        name="studentId"
        rules={[{ required: true, message: '请输入学生编号。', whitespace: true }]}
        extra={isStudentIdLocked ? '这个链接已指定学生编号，不能修改。' : undefined}
      >
        <Input disabled={isStudentIdLocked} placeholder="请输入学生编号" autoComplete="off" />
      </Form.Item>

      <Form.Item
        label="学生姓名"
        name="name"
        rules={[{ required: true, message: '请输入学生姓名。', whitespace: true }]}
      >
        <Input placeholder="请输入学生姓名" autoComplete="name" />
      </Form.Item>

      <Form.Item
        label="证件号后 6 位"
        name="idCardLastSix"
        validateTrigger={['onChange', 'onBlur']}
        rules={[
          { required: true, message: '请输入证件号后 6 位。' },
          {
            validator(_, value: string | undefined) {
              if (!value || isValidStudentRegistrationIdCardLastSix(value)) {
                return Promise.resolve();
              }

              return Promise.reject(new Error('证件号后 6 位只能包含数字或字母，且长度必须为 6。'));
            },
          },
        ]}
      >
        <Input placeholder="请输入证件号后 6 位" autoComplete="off" maxLength={6} />
      </Form.Item>

      <Form.Item
        label="登录邮箱"
        name="loginEmail"
        validateTrigger={['onChange', 'onBlur']}
        rules={[
          { required: true, message: '请输入登录邮箱。' },
          { type: 'email', message: '请输入有效邮箱地址。' },
        ]}
      >
        <Input placeholder="请输入登录邮箱" autoComplete="email" />
      </Form.Item>

      <Form.Item label="昵称（可选）" name="nickname" extra="默认使用学生姓名，也可以自定义。">
        <Input placeholder="可选填写昵称" autoComplete="nickname" />
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
        <Input placeholder="可选填写登录名" autoComplete="username" />
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

              const { hasMinLength, hasRequiredCharacterMix } =
                getStudentRegistrationPasswordRuleState(value);

              if (hasMinLength && hasRequiredCharacterMix) {
                return Promise.resolve();
              }

              return Promise.reject(new Error(studentRegistrationPasswordValidationMessage));
            },
          },
        ]}
      >
        <Input.Password placeholder="请输入登录密码" autoComplete="new-password" />
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
        <Input.Password placeholder="请再次输入登录密码" autoComplete="new-password" />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0 }}>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          提交注册
        </Button>
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
      <Alert type="error" showIcon title={resolveLinkFailureTitle(reason)} description={message} />
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

export function StudentRegistrationLinkPanel({ token }: { token: string }) {
  const [phase, setPhase] = useState<StudentRegistrationPhase>('loading');
  const [linkInfo, setLinkInfo] = useState<StudentRegistrationLinkInfo | null>(null);
  const [linkFailure, setLinkFailure] = useState<{
    info: StudentRegistrationLinkInfo | null;
    message: string;
    reason: StudentRegistrationLinkReason;
  } | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<Extract<
    StudentRegistrationConsumptionResult,
    { status: 'success' }
  > | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function runWorkflow() {
      setPhase('loading');
      setLinkInfo(null);
      setLinkFailure(null);
      setPageError(null);
      setSubmitError(null);
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
    <Flex vertical gap={16}>
      <StudentRegistrationSummaryCard info={linkInfo} />
      <Alert
        type="info"
        showIcon
        title="注册后需要验证登录邮箱"
        description="提交成功后，系统会向登录邮箱发送验证邮件。邮箱验证完成前，账号不能登录。"
      />
      <StudentRegistrationForm
        info={linkInfo}
        submitError={submitError}
        submitting={submitting}
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

            setSubmitError(result.message);
          } finally {
            setSubmitting(false);
          }
        }}
      />
      <Typography.Text type="secondary">
        <CheckCircleOutlined aria-hidden="true" /> 注册成功后不会自动登录。
      </Typography.Text>
    </Flex>
  );
}
