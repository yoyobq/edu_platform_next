import { useMemo, useState } from 'react';
import { LeftOutlined } from '@ant-design/icons';
import { Alert, Avatar, Button, Card, Flex, message, Skeleton, Tag, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router';

import type { AdminUserDetail } from '../application/get-admin-user-detail';
import {
  ADMIN_USER_DETAIL_ACCOUNT_STATUS_LABELS,
  ADMIN_USER_DETAIL_STAFF_EMPLOYMENT_STATUS_LABELS,
} from '../application/get-admin-user-detail';
import type {
  UpdateAdminUserDetailAccountSectionCommand,
  UpdateAdminUserDetailAccountSectionResult,
  UpdateAdminUserDetailStaffSectionInput,
  UpdateAdminUserDetailStaffSectionResult,
  UpdateAdminUserDetailUserInfoSectionInput,
  UpdateAdminUserDetailUserInfoSectionResult,
} from '../application/update-admin-user-detail-sections';
import { assertAdminUserDetailIdentityHintAllowed } from '../application/update-admin-user-detail-sections';
import {
  type AdminDepartmentOptionsLoader,
  useAdminDepartmentOptions,
} from '../application/use-admin-department-options';
import {
  type AdminUserDetailLoader,
  useAdminUserDetail,
} from '../application/use-admin-user-detail';

import { BilingualLabel } from './components/bilingual-label';
import { DetailSectionBlock } from './components/detail-section-block';
import { hasLockedAccessGroup, normalizeAccessGroupValue } from './lib/access-group';
import {
  areStringArraysEqual,
  formatDateTime,
  formatOptionalValue,
  normalizeBirthDateValue,
  normalizeOptionalTextValue,
  normalizeRequiredTextValue,
} from './lib/formatters';
import { buildGeographicInput, parseGeographicValue } from './lib/geographic';
import { getStatusTagColor } from './lib/status-tag';
import { normalizeTagsValue } from './lib/tags';
import {
  AccountSectionEditor,
  type AccountSectionFormValues,
  AccountSectionViewer,
  buildAccountSectionGroup,
} from './sections/account-section';
import {
  buildStaffSectionGroup,
  StaffSectionEditor,
  type StaffSectionFormValues,
  StaffSectionViewer,
} from './sections/staff-section';
import {
  buildUserInfoSectionGroup,
  UserInfoSectionEditor,
  type UserInfoSectionFormValues,
  UserInfoSectionViewer,
} from './sections/user-info-section';
import { type EditableSectionKey, INITIAL_SECTION_ERROR_STATE } from './model';

type AdminUserDetailPageContentProps = {
  accountId: number;
  loadDepartmentOptions: AdminDepartmentOptionsLoader;
  loadDetail: AdminUserDetailLoader;
  updateAccountSection: (
    input: UpdateAdminUserDetailAccountSectionCommand,
  ) => Promise<UpdateAdminUserDetailAccountSectionResult>;
  updateStaffSection: (
    input: UpdateAdminUserDetailStaffSectionInput,
  ) => Promise<UpdateAdminUserDetailStaffSectionResult>;
  updateUserInfoSection: (
    input: UpdateAdminUserDetailUserInfoSectionInput,
  ) => Promise<UpdateAdminUserDetailUserInfoSectionResult>;
};

function RecentLoginList({ items }: { items: AdminUserDetail['account']['recentLoginHistory'] }) {
  if (items.length === 0) {
    return <Alert type="info" showIcon message="后端当前未返回最近登录记录。" />;
  }

  return (
    <Flex vertical gap={12}>
      {items.map((item, index) => (
        <div
          key={`${item.timestamp}-${item.ip}-${index}`}
          className="rounded-block border border-border bg-bg-layout px-4 py-3"
        >
          <Flex align="center" justify="space-between" gap={16} wrap>
            <Typography.Text strong>{formatDateTime(item.timestamp)}</Typography.Text>
            <Tag>{item.audience || '未知客户端'}</Tag>
          </Flex>
          <Typography.Paragraph style={{ marginBottom: 0, marginTop: 8 }}>
            登录 IP：{item.ip}
          </Typography.Paragraph>
        </div>
      ))}
    </Flex>
  );
}

function SkeletonBar({ height, width }: { height: number; width: number | string }) {
  return (
    <div style={{ width, maxWidth: '100%' }}>
      <Skeleton.Button active size="small" style={{ width: '100%', height }} />
    </div>
  );
}

function DetailFieldSkeleton({
  labelWidth,
  valueWidth,
}: {
  labelWidth: number;
  valueWidth: number | string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SkeletonBar height={12} width={labelWidth} />
      <SkeletonBar height={18} width={valueWidth} />
    </div>
  );
}

function DetailCardSkeleton({
  editableFields,
  fixedFields,
  referenceFields,
  titleWidth,
  minHeight,
}: {
  editableFields: readonly { labelWidth: number; valueWidth: number | string }[];
  fixedFields: readonly { labelWidth: number; valueWidth: number | string }[];
  referenceFields: readonly { labelWidth: number; valueWidth: number | string }[];
  titleWidth: number;
  minHeight: number;
}) {
  return (
    <div className="rounded-card shadow-card">
      <Card
        title={
          <Flex align="center" gap={8} wrap="wrap">
            <SkeletonBar height={16} width={titleWidth} />
            <SkeletonBar height={12} width={96} />
          </Flex>
        }
        styles={{ body: { minHeight, padding: 24 } }}
      >
        <Flex vertical gap={24}>
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            {fixedFields.map((field, index) => (
              <DetailFieldSkeleton
                key={`fixed-${titleWidth}-${index}`}
                labelWidth={field.labelWidth}
                valueWidth={field.valueWidth}
              />
            ))}
          </div>

          <div className="rounded-block border border-border p-4">
            <Flex align="center" gap={8} justify="flex-end">
              <SkeletonBar height={28} width={60} />
            </Flex>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {editableFields.map((field, index) => (
                <DetailFieldSkeleton
                  key={`editable-${titleWidth}-${index}`}
                  labelWidth={field.labelWidth}
                  valueWidth={field.valueWidth}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-2 xl:grid-cols-4">
              {referenceFields.map((field, index) => (
                <DetailFieldSkeleton
                  key={`reference-${titleWidth}-${index}`}
                  labelWidth={field.labelWidth}
                  valueWidth={field.valueWidth}
                />
              ))}
            </div>
          </div>
        </Flex>
      </Card>
    </div>
  );
}

function SidebarCardSkeleton({
  minHeight,
  rows,
  titleWidth,
}: {
  minHeight: number;
  rows: number;
  titleWidth: number;
}) {
  return (
    <div className="rounded-card shadow-card">
      <Card
        title={<SkeletonBar height={16} width={titleWidth} />}
        styles={{ body: { minHeight, padding: 16 } }}
      >
        <div className="flex flex-col gap-4">
          {Array.from({ length: rows }, (_, index) => (
            <div key={`${titleWidth}-${index}`} className="flex flex-col gap-2">
              <SkeletonBar height={12} width={index % 2 === 0 ? 72 : 88} />
              <SkeletonBar
                height={18}
                width={index === rows - 1 ? '58%' : index % 2 === 0 ? '72%' : '86%'}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AdminUserDetailLoadingSkeleton() {
  return (
    <>
      <div
        className="rounded-block border border-border bg-bg-container p-6 shadow-card"
        style={{ minHeight: 164 }}
      >
        <Flex align="start" gap={24}>
          <Skeleton.Avatar active shape="circle" size={72} />
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <Flex align="center" gap={8} wrap>
              <SkeletonBar height={28} width={180} />
              <SkeletonBar height={24} width={72} />
              <SkeletonBar height={24} width={92} />
            </Flex>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 xl:grid-cols-4">
              <DetailFieldSkeleton labelWidth={56} valueWidth={84} />
              <DetailFieldSkeleton labelWidth={40} valueWidth={96} />
              <DetailFieldSkeleton labelWidth={48} valueWidth={132} />
              <DetailFieldSkeleton labelWidth={56} valueWidth={88} />
            </div>

            <Flex gap={6} wrap>
              <SkeletonBar height={22} width={68} />
              <SkeletonBar height={22} width={78} />
              <SkeletonBar height={22} width={62} />
            </Flex>
          </div>
        </Flex>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <DetailCardSkeleton
            minHeight={360}
            titleWidth={124}
            fixedFields={[
              { labelWidth: 68, valueWidth: '54%' },
              { labelWidth: 64, valueWidth: '44%' },
              { labelWidth: 56, valueWidth: '62%' },
              { labelWidth: 72, valueWidth: '48%' },
            ]}
            editableFields={[
              { labelWidth: 72, valueWidth: '78%' },
              { labelWidth: 66, valueWidth: '70%' },
              { labelWidth: 60, valueWidth: '64%' },
            ]}
            referenceFields={[
              { labelWidth: 64, valueWidth: '72%' },
              { labelWidth: 48, valueWidth: '58%' },
              { labelWidth: 72, valueWidth: '68%' },
              { labelWidth: 56, valueWidth: '52%' },
            ]}
          />

          <DetailCardSkeleton
            minHeight={456}
            titleWidth={136}
            fixedFields={[
              { labelWidth: 56, valueWidth: '48%' },
              { labelWidth: 68, valueWidth: '60%' },
              { labelWidth: 52, valueWidth: '72%' },
              { labelWidth: 64, valueWidth: '54%' },
            ]}
            editableFields={[
              { labelWidth: 52, valueWidth: '66%' },
              { labelWidth: 62, valueWidth: '74%' },
              { labelWidth: 64, valueWidth: '82%' },
              { labelWidth: 48, valueWidth: '58%' },
              { labelWidth: 40, valueWidth: '52%' },
              { labelWidth: 60, valueWidth: '88%' },
            ]}
            referenceFields={[
              { labelWidth: 64, valueWidth: '68%' },
              { labelWidth: 60, valueWidth: '52%' },
              { labelWidth: 56, valueWidth: '62%' },
              { labelWidth: 72, valueWidth: '46%' },
            ]}
          />

          <DetailCardSkeleton
            minHeight={372}
            titleWidth={148}
            fixedFields={[
              { labelWidth: 52, valueWidth: '56%' },
              { labelWidth: 64, valueWidth: '44%' },
              { labelWidth: 56, valueWidth: '58%' },
              { labelWidth: 68, valueWidth: '50%' },
            ]}
            editableFields={[
              { labelWidth: 62, valueWidth: '70%' },
              { labelWidth: 54, valueWidth: '76%' },
              { labelWidth: 60, valueWidth: '64%' },
              { labelWidth: 48, valueWidth: '86%' },
            ]}
            referenceFields={[
              { labelWidth: 56, valueWidth: '60%' },
              { labelWidth: 68, valueWidth: '54%' },
              { labelWidth: 52, valueWidth: '66%' },
              { labelWidth: 64, valueWidth: '48%' },
            ]}
          />
        </div>

        <div className="flex flex-col gap-6">
          <SidebarCardSkeleton minHeight={248} rows={5} titleWidth={82} />
          <SidebarCardSkeleton minHeight={272} rows={4} titleWidth={116} />
        </div>
      </div>
    </>
  );
}

export function AdminUserDetailPageContent({
  accountId,
  loadDepartmentOptions,
  loadDetail,
  updateAccountSection,
  updateStaffSection,
  updateUserInfoSection,
}: AdminUserDetailPageContentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [editingSection, setEditingSection] = useState<EditableSectionKey | null>(null);
  const [savingSection, setSavingSection] = useState<EditableSectionKey | null>(null);
  const [sectionErrors, setSectionErrors] = useState(INITIAL_SECTION_ERROR_STATE);
  const {
    applyAccountUpdate,
    applyStaffUpdate,
    applyUserInfoUpdate,
    errorMessage,
    hasLoaded,
    isLoading,
    result,
    retry,
  } = useAdminUserDetail(accountId, loadDetail);
  const { errorMessage: departmentLoadErrorMessage, options: departmentOptions } =
    useAdminDepartmentOptions(loadDepartmentOptions);
  const departmentMap = useMemo(
    () => new Map(departmentOptions.map((department) => [department.id, department])),
    [departmentOptions],
  );

  const accountSections = useMemo(
    () => (result ? buildAccountSectionGroup(result) : null),
    [result],
  );
  const userInfoSections = useMemo(
    () => (result ? buildUserInfoSectionGroup(result) : null),
    [result],
  );
  const staffSections = useMemo(
    () => (result ? buildStaffSectionGroup(result, departmentMap) : null),
    [departmentMap, result],
  );

  async function handleAccountSectionSubmit(values: AccountSectionFormValues) {
    if (!result || !values.identityHint) {
      return;
    }

    try {
      assertAdminUserDetailIdentityHintAllowed(result.userInfo.accessGroup, values.identityHint);
    } catch (error) {
      setSectionErrors((currentErrors) => ({
        ...currentErrors,
        account: error instanceof Error ? error.message : '身份提示校验失败。',
      }));
      return;
    }

    const hasChanged =
      values.status !== result.account.status ||
      values.identityHint !== result.account.identityHint;

    if (!hasChanged) {
      setSectionErrors((currentErrors) => ({ ...currentErrors, account: null }));
      setEditingSection(null);
      return;
    }

    setSavingSection('account');
    setSectionErrors((currentErrors) => ({ ...currentErrors, account: null }));

    try {
      const mutationResult = await updateAccountSection({
        accessGroup: result.userInfo.accessGroup,
        accountId: result.account.id,
        identityHint: values.identityHint,
        status: values.status,
      });

      applyAccountUpdate(mutationResult.account);
      setEditingSection(null);
      void messageApi.success({
        content: `已更新账户 ${result.account.id} 的常用字段`,
        duration: 2,
      });
    } catch (error) {
      setSectionErrors((currentErrors) => ({
        ...currentErrors,
        account: error instanceof Error ? error.message : '账户常用字段保存失败。',
      }));
    } finally {
      setSavingSection(null);
    }
  }

  async function handleUserInfoSectionSubmit(values: UserInfoSectionFormValues) {
    if (!result) {
      return;
    }

    const isAccessGroupLocked = hasLockedAccessGroup(result.userInfo.accessGroup);
    const normalizedCurrentAccessGroup = normalizeAccessGroupValue(result.userInfo.accessGroup);
    const normalizedNextAccessGroup = normalizeAccessGroupValue(values.accessGroup);
    const shouldUpdateAccessGroup =
      !isAccessGroupLocked &&
      !areStringArraysEqual(normalizedNextAccessGroup, normalizedCurrentAccessGroup);
    const normalizedNextValues = {
      accessGroup: shouldUpdateAccessGroup ? normalizedNextAccessGroup : undefined,
      address: normalizeOptionalTextValue(values.address),
      birthDate: normalizeBirthDateValue(values.birthDate),
      email: normalizeOptionalTextValue(values.email),
      gender: values.gender,
      geographic: buildGeographicInput({
        city: values.geographicCity,
        province: values.geographicProvince,
      }),
      nickname: normalizeRequiredTextValue(values.nickname),
      phone: normalizeOptionalTextValue(values.phone),
      signature: normalizeOptionalTextValue(values.signature),
      tags: normalizeTagsValue(values.tags),
      userState: values.userState,
    };
    const normalizedCurrentGeographic = buildGeographicInput(
      parseGeographicValue(result.userInfo.geographic),
    );
    const normalizedCurrentValues = {
      address: normalizeOptionalTextValue(result.userInfo.address),
      birthDate: normalizeOptionalTextValue(result.userInfo.birthDate),
      email: normalizeOptionalTextValue(result.userInfo.email),
      gender: result.userInfo.gender,
      nickname: normalizeRequiredTextValue(result.userInfo.nickname),
      phone: normalizeOptionalTextValue(result.userInfo.phone),
      signature: normalizeOptionalTextValue(result.userInfo.signature),
      tags: normalizeTagsValue(result.userInfo.tags ?? []),
      userState: result.userInfo.userState,
    };

    const hasChanged =
      shouldUpdateAccessGroup ||
      normalizedNextValues.address !== normalizedCurrentValues.address ||
      normalizedNextValues.birthDate !== normalizedCurrentValues.birthDate ||
      normalizedNextValues.email !== normalizedCurrentValues.email ||
      normalizedNextValues.gender !== normalizedCurrentValues.gender ||
      JSON.stringify(normalizedNextValues.geographic) !==
        JSON.stringify(normalizedCurrentGeographic) ||
      normalizedNextValues.nickname !== normalizedCurrentValues.nickname ||
      normalizedNextValues.phone !== normalizedCurrentValues.phone ||
      normalizedNextValues.signature !== normalizedCurrentValues.signature ||
      normalizedNextValues.userState !== normalizedCurrentValues.userState ||
      !areStringArraysEqual(normalizedNextValues.tags, normalizedCurrentValues.tags);

    if (!hasChanged) {
      setSectionErrors((currentErrors) => ({ ...currentErrors, userInfo: null }));
      setEditingSection(null);
      return;
    }

    setSavingSection('userInfo');
    setSectionErrors((currentErrors) => ({ ...currentErrors, userInfo: null }));

    try {
      const mutationResult = await updateUserInfoSection({
        accountId: result.account.id,
        ...normalizedNextValues,
      });

      applyAccountUpdate(mutationResult.account);
      applyUserInfoUpdate(mutationResult.userInfo);
      setEditingSection(null);
      void messageApi.success({
        content: `已更新账户 ${result.account.id} 的用户信息`,
        duration: 2,
      });
    } catch (error) {
      setSectionErrors((currentErrors) => ({
        ...currentErrors,
        userInfo: error instanceof Error ? error.message : '用户常用字段保存失败。',
      }));
    } finally {
      setSavingSection(null);
    }
  }

  async function handleStaffSectionSubmit(values: StaffSectionFormValues) {
    if (!result) {
      return;
    }

    const normalizedNextValues = {
      departmentId: normalizeOptionalTextValue(values.departmentId),
      employmentStatus: values.employmentStatus,
      jobTitle: normalizeOptionalTextValue(values.jobTitle),
      name: normalizeRequiredTextValue(values.name),
      remark: normalizeOptionalTextValue(values.remark),
    };
    const normalizedCurrentValues = {
      departmentId: normalizeOptionalTextValue(result.staff.departmentId),
      employmentStatus: result.staff.employmentStatus,
      jobTitle: normalizeOptionalTextValue(result.staff.jobTitle),
      name: normalizeRequiredTextValue(result.staff.name),
      remark: normalizeOptionalTextValue(result.staff.remark),
    };

    const hasChanged =
      normalizedNextValues.departmentId !== normalizedCurrentValues.departmentId ||
      normalizedNextValues.employmentStatus !== normalizedCurrentValues.employmentStatus ||
      normalizedNextValues.jobTitle !== normalizedCurrentValues.jobTitle ||
      normalizedNextValues.name !== normalizedCurrentValues.name ||
      normalizedNextValues.remark !== normalizedCurrentValues.remark;

    if (!hasChanged) {
      setSectionErrors((currentErrors) => ({ ...currentErrors, staff: null }));
      setEditingSection(null);
      return;
    }

    setSavingSection('staff');
    setSectionErrors((currentErrors) => ({ ...currentErrors, staff: null }));

    try {
      const mutationResult = await updateStaffSection({
        accountId: result.account.id,
        ...normalizedNextValues,
      });

      applyStaffUpdate(mutationResult.staff);
      setEditingSection(null);
      void messageApi.success({
        content: `已更新 staff ${result.staff.id} 的常用字段`,
        duration: 2,
      });
    } catch (error) {
      setSectionErrors((currentErrors) => ({
        ...currentErrors,
        staff: error instanceof Error ? error.message : 'staff 常用字段保存失败。',
      }));
    } finally {
      setSavingSection(null);
    }
  }

  function openSectionEditor(sectionKey: EditableSectionKey) {
    setSectionErrors((currentErrors) => ({
      ...currentErrors,
      [sectionKey]: null,
    }));
    setEditingSection(sectionKey);
  }

  function cancelSectionEditor(sectionKey: EditableSectionKey) {
    setSectionErrors((currentErrors) => ({
      ...currentErrors,
      [sectionKey]: null,
    }));
    setEditingSection((currentEditingSection) =>
      currentEditingSection === sectionKey ? null : currentEditingSection,
    );
  }

  return (
    <div
      className="mx-auto flex flex-col gap-6 pb-6"
      style={{ maxWidth: 'var(--width-content-readable)' }}
    >
      {messageContextHolder}

      <Flex align="center" gap={12}>
        <Button
          type="text"
          icon={<LeftOutlined />}
          onClick={() => navigate({ pathname: '/admin/users', search: location.search })}
        >
          用户列表
        </Button>
      </Flex>

      {result ? (
        <div className="rounded-block border border-border bg-bg-container p-6 shadow-card">
          <Flex gap={24} align="start">
            <div className="relative shrink-0">
              <Avatar
                size={72}
                src={result.userInfo.avatarUrl || undefined}
                style={{
                  border: '3px solid var(--ant-color-bg-container)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                {result.userInfo.nickname?.trim()?.slice(0, 1) ||
                  String(result.account.id).slice(-2)}
              </Avatar>
              <div
                className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full ${
                  result.account.status === 'ACTIVE' ? 'bg-success' : 'bg-fill-secondary'
                }`}
                style={{ border: '3px solid var(--ant-color-bg-container)' }}
                title={result.account.status}
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <Flex align="center" gap={8} wrap>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {formatOptionalValue(result.userInfo.nickname)}
                </Typography.Title>
                <Tag color={getStatusTagColor(result.account.status)}>
                  {ADMIN_USER_DETAIL_ACCOUNT_STATUS_LABELS[result.account.status]}
                </Tag>
                {result.staff?.id && (
                  <Tag color={getStatusTagColor(result.staff.employmentStatus)}>
                    {
                      ADMIN_USER_DETAIL_STAFF_EMPLOYMENT_STATUS_LABELS[
                        result.staff.employmentStatus
                      ]
                    }
                  </Tag>
                )}
              </Flex>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 xl:grid-cols-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-text-secondary">账户 ID</span>
                  <span className="font-mono text-sm">{result.account.id}</span>
                </div>
                {result.staff?.id && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-text-secondary">工号</span>
                    <span className="font-mono text-sm">{result.staff.id}</span>
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-text-secondary">登录名</span>
                  <span className="text-sm">{formatOptionalValue(result.account.loginName)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-text-secondary">身份提示</span>
                  <span className="text-sm">
                    {formatOptionalValue(result.account.identityHint)}
                  </span>
                </div>
              </div>

              <Flex gap={4} wrap>
                {result.userInfo.accessGroup.map((group) => (
                  <Tag
                    key={group}
                    color={group === 'REGISTRANT' ? 'gold' : 'blue'}
                    style={{ margin: 0 }}
                  >
                    {group}
                  </Tag>
                ))}
              </Flex>
            </div>
          </Flex>
        </div>
      ) : null}

      {!hasLoaded ? (
        <AdminUserDetailLoadingSkeleton />
      ) : errorMessage || !result || !accountSections || !userInfoSections || !staffSections ? (
        <Alert
          type="error"
          showIcon
          message="无法加载用户详情"
          description={errorMessage || '账户信息获取失败'}
          action={
            <Button size="small" type="primary" onClick={retry}>
              立即重试
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <div className="rounded-card shadow-card">
              <Card
                styles={{ body: { padding: 24 } }}
                title={<BilingualLabel title="账户配置" subtitle="Account Settings" />}
              >
                <Flex vertical gap={24}>
                  <DetailSectionBlock section={accountSections.fixed} />
                  <div
                    className={`rounded-block border border-border transition-colors duration-150 ${
                      editingSection === 'account'
                        ? 'bg-fill-secondary p-6'
                        : 'p-4 hover:bg-fill-hover'
                    }`}
                  >
                    {editingSection === 'account' ? (
                      <AccountSectionEditor
                        detail={result}
                        errorMessage={sectionErrors.account}
                        formId="account-section-form"
                        onCancel={() => cancelSectionEditor('account')}
                        onEdit={() => openSectionEditor('account')}
                        onSubmit={handleAccountSectionSubmit}
                        saving={savingSection === 'account'}
                      />
                    ) : (
                      <AccountSectionViewer
                        section={accountSections.editable}
                        onEdit={() => openSectionEditor('account')}
                      />
                    )}
                  </div>
                  <DetailSectionBlock section={accountSections.reference} />
                </Flex>
              </Card>
            </div>

            <div className="rounded-card shadow-card">
              <Card
                styles={{ body: { padding: 24 } }}
                title={<BilingualLabel title="个人背景" subtitle="Personal Profile" />}
              >
                <Flex vertical gap={24}>
                  <DetailSectionBlock section={userInfoSections.fixed} />
                  <div
                    className={`rounded-block border border-border transition-colors duration-150 ${
                      editingSection === 'userInfo'
                        ? 'bg-fill-secondary p-6'
                        : 'p-4 hover:bg-fill-hover'
                    }`}
                  >
                    {editingSection === 'userInfo' ? (
                      <UserInfoSectionEditor
                        detail={result}
                        errorMessage={sectionErrors.userInfo}
                        formId="user-info-section-form"
                        onCancel={() => cancelSectionEditor('userInfo')}
                        onEdit={() => openSectionEditor('userInfo')}
                        onSubmit={handleUserInfoSectionSubmit}
                        saving={savingSection === 'userInfo'}
                      />
                    ) : (
                      <UserInfoSectionViewer
                        section={userInfoSections.editable}
                        onEdit={() => openSectionEditor('userInfo')}
                      />
                    )}
                  </div>
                  <DetailSectionBlock section={userInfoSections.reference} />
                </Flex>
              </Card>
            </div>

            <div className="rounded-card shadow-card">
              <Card
                styles={{ body: { padding: 24 } }}
                title={<BilingualLabel title="Staff 职业信息" subtitle="Staff Identity" />}
              >
                <Flex vertical gap={24}>
                  <DetailSectionBlock section={staffSections.fixed} />
                  <div
                    className={`rounded-block border border-border transition-colors duration-150 ${
                      editingSection === 'staff'
                        ? 'bg-fill-secondary p-6'
                        : 'p-4 hover:bg-fill-hover'
                    }`}
                  >
                    {editingSection === 'staff' ? (
                      <StaffSectionEditor
                        departmentLoadErrorMessage={departmentLoadErrorMessage}
                        departmentOptions={departmentOptions}
                        detail={result}
                        errorMessage={sectionErrors.staff}
                        formId="staff-section-form"
                        onCancel={() => cancelSectionEditor('staff')}
                        onEdit={() => openSectionEditor('staff')}
                        onSubmit={handleStaffSectionSubmit}
                        saving={savingSection === 'staff'}
                      />
                    ) : (
                      <StaffSectionViewer
                        section={staffSections.editable}
                        onEdit={() => openSectionEditor('staff')}
                      />
                    )}
                  </div>
                  <DetailSectionBlock section={staffSections.reference} />
                </Flex>
              </Card>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-card shadow-card">
              <Card title="快速识别" styles={{ body: { padding: 16 } }}>
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-text-secondary">账户状态</span>
                      <div>
                        <Tag color={getStatusTagColor(result.account.status)}>
                          {ADMIN_USER_DETAIL_ACCOUNT_STATUS_LABELS[result.account.status]}
                        </Tag>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-text-secondary">在职状态</span>
                      <div>
                        <Tag color={getStatusTagColor(result.staff.employmentStatus)}>
                          {
                            ADMIN_USER_DETAIL_STAFF_EMPLOYMENT_STATUS_LABELS[
                              result.staff.employmentStatus
                            ]
                          }
                        </Tag>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-text-secondary">登录邮箱</span>
                      <span
                        className="font-mono text-xs"
                        style={{ wordBreak: 'break-all', color: 'var(--ant-color-text)' }}
                      >
                        {result.account.loginEmail || '—'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-text-secondary">联系邮箱</span>
                      <span className="text-sm" style={{ wordBreak: 'break-all' }}>
                        {result.userInfo.email || '—'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-text-secondary">手机号</span>
                      <span className="font-mono text-sm">{result.userInfo.phone || '—'}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <div className="rounded-card shadow-card">
              <Card
                title={<BilingualLabel title="最近登录" subtitle="Recent Activity" />}
                styles={{ body: { padding: '12px 12px 16px' } }}
              >
                <RecentLoginList items={result.account.recentLoginHistory} />
              </Card>
            </div>
          </div>
        </div>
      )}

      {hasLoaded && isLoading && (
        <div className="fixed right-8" style={{ top: '6rem' }} data-layout-layer="top-control-bar">
          <div
            className="rounded-card shadow-card"
            style={{ borderColor: 'color-mix(in srgb, var(--ant-color-primary) 20%, transparent)' }}
          >
            <Card styles={{ body: { padding: 12 } }}>
              <Flex align="center" gap={8}>
                <Skeleton.Avatar active size="small" />
                <span className="text-xs font-medium text-primary">正在刷新数据...</span>
              </Flex>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
