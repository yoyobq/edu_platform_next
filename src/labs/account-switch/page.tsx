import { useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Form, Input, Space, Tag, Typography } from 'antd';

import { getGraphQLClient } from '@/shared/graphql';

import { accountSwitchLabAccess } from './access';
import {
  type AccountSwitchLabSession,
  canUseAccountSwitchLabSession,
  createAccountSwitchLabSession,
} from './api';
import { accountSwitchLabMeta } from './meta';
import {
  type AccountSwitchLabRecord,
  readAccountSwitchLabRecords,
  readCurrentAuthSession,
  upsertAccountSwitchLabRecord,
  writeAccountSwitchLabRecords,
  writeCurrentAuthSession,
} from './storage';

type AddAccountFormValues = {
  loginName: string;
  loginPassword: string;
};

function formatAccessGroups(session: AccountSwitchLabSession) {
  return session.userInfo.accessGroup.length > 0 ? session.userInfo.accessGroup.join(', ') : '-';
}

function describeAccount(session: AccountSwitchLabSession) {
  return session.account.loginName || session.account.loginEmail || `#${session.accountId}`;
}

export function AccountSwitchLabPage() {
  const [form] = Form.useForm<AddAccountFormValues>();
  const [records, setRecords] = useState<AccountSwitchLabRecord[]>(() =>
    readAccountSwitchLabRecords(),
  );
  const [activeSnapshot, setActiveSnapshot] = useState<AccountSwitchLabSession | null>(() =>
    readCurrentAuthSession(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const storedAccountIds = useMemo(
    () => new Set(records.map((record) => record.session.accountId)),
    [records],
  );

  function commitRecords(nextRecords: AccountSwitchLabRecord[]) {
    writeAccountSwitchLabRecords(nextRecords);
    setRecords(nextRecords);
  }

  function addSession(session: AccountSwitchLabSession, message: string) {
    if (!canUseAccountSwitchLabSession(session)) {
      throw new Error('账号切换 Lab 只允许添加 ADMIN 或 STAFF 账号。');
    }

    const nextRecords = upsertAccountSwitchLabRecord(records, session);

    commitRecords(nextRecords);
    setErrorMessage(null);
    setSuccessMessage(message);
  }

  async function switchToSession(session: AccountSwitchLabSession) {
    setSwitchingAccountId(session.accountId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await getGraphQLClient().clearStore();
      writeCurrentAuthSession(session);
      setActiveSnapshot(session);
      setSuccessMessage(`已切换到 ${session.displayName}。`);
      window.location.reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '切换账号失败。');
    } finally {
      setSwitchingAccountId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4">
          <div>
            <Typography.Title level={3} style={{ marginBottom: 8 }}>
              账号切换 Lab
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {accountSwitchLabMeta.purpose}
            </Typography.Paragraph>
          </div>

          <div className="flex flex-wrap gap-2">
            <Tag color="blue">负责人：{accountSwitchLabMeta.owner}</Tag>
            <Tag color="purple">复核时间：{accountSwitchLabMeta.reviewAt}</Tag>
            <Tag color="green">环境：{accountSwitchLabAccess.env.join(', ')}</Tag>
            <Tag color="gold">
              访问级别：{accountSwitchLabAccess.allowedAccessLevels.join(', ')}
            </Tag>
          </div>

          {activeSnapshot ? (
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="当前账号">{activeSnapshot.displayName}</Descriptions.Item>
              <Descriptions.Item label="accountId">{activeSnapshot.accountId}</Descriptions.Item>
              <Descriptions.Item label="登录标识">
                {describeAccount(activeSnapshot)}
              </Descriptions.Item>
              <Descriptions.Item label="权限组">
                {formatAccessGroups(activeSnapshot)}
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Alert type="warning" showIcon message="当前没有已认证账号。" />
          )}
        </div>
      </Card>

      {errorMessage ? <Alert type="error" showIcon message={errorMessage} /> : null}
      {successMessage ? <Alert type="success" showIcon message={successMessage} /> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <Card title="添加账号">
          <div className="flex flex-col gap-4">
            <Button
              disabled={
                !activeSnapshot ||
                (activeSnapshot && storedAccountIds.has(activeSnapshot.accountId))
              }
              onClick={() => {
                if (!activeSnapshot) {
                  return;
                }

                try {
                  addSession(activeSnapshot, `已添加当前账号 ${activeSnapshot.displayName}。`);
                } catch (error) {
                  setErrorMessage(error instanceof Error ? error.message : '添加当前账号失败。');
                  setSuccessMessage(null);
                }
              }}
            >
              添加当前账号
            </Button>

            <Form<AddAccountFormValues>
              form={form}
              layout="vertical"
              requiredMark={false}
              onFinish={async (values) => {
                setSubmitting(true);
                setErrorMessage(null);
                setSuccessMessage(null);

                try {
                  const session = await createAccountSwitchLabSession({
                    loginName: values.loginName,
                    loginPassword: values.loginPassword,
                  });

                  addSession(session, `已添加账号 ${session.displayName}。`);
                  form.resetFields();
                } catch (error) {
                  setErrorMessage(error instanceof Error ? error.message : '添加账号失败。');
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <Form.Item
                label="登录名或邮箱"
                name="loginName"
                rules={[{ required: true, message: '请输入登录名或邮箱。' }]}
              >
                <Input autoComplete="username" />
              </Form.Item>

              <Form.Item
                label="密码"
                name="loginPassword"
                rules={[{ required: true, message: '请输入密码。' }]}
              >
                <Input.Password autoComplete="off" />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" loading={submitting} block>
                  添加账号
                </Button>
              </Form.Item>
            </Form>
          </div>
        </Card>

        <Card title="已添加账号">
          <div className="flex flex-col gap-3">
            {records.length === 0 ? (
              <Alert type="info" showIcon message="还没有添加账号。" />
            ) : (
              records.map((record) => {
                const session = record.session;
                const isActive = activeSnapshot?.accountId === session.accountId;

                return (
                  <Card key={session.accountId} size="small">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Typography.Text strong>{session.displayName}</Typography.Text>
                          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                            {describeAccount(session)}
                          </Typography.Paragraph>
                        </div>
                        <Space wrap>
                          {isActive ? <Tag color="green">当前</Tag> : null}
                          <Tag>#{session.accountId}</Tag>
                          <Tag>{session.primaryAccessGroup}</Tag>
                        </Space>
                      </div>

                      <Descriptions size="small" column={1}>
                        <Descriptions.Item label="权限组">
                          {formatAccessGroups(session)}
                        </Descriptions.Item>
                        <Descriptions.Item label="添加时间">{record.addedAt}</Descriptions.Item>
                      </Descriptions>

                      <Space wrap>
                        <Button
                          type="primary"
                          disabled={isActive}
                          loading={switchingAccountId === session.accountId}
                          onClick={() => void switchToSession(session)}
                        >
                          切换到此账号
                        </Button>
                        <Button
                          danger
                          onClick={() => {
                            const nextRecords = records.filter(
                              (candidate) => candidate.session.accountId !== session.accountId,
                            );

                            commitRecords(nextRecords);
                            setSuccessMessage(`已移除 ${session.displayName}。`);
                            setErrorMessage(null);
                          }}
                        >
                          移除
                        </Button>
                      </Space>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
