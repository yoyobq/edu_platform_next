// src/features/student-profile-filing/ui/student-graduation-info-form.tsx
import { useCallback, useEffect, useState } from 'react';
import { Alert, App, Button, Form, Input, Select, Space, Spin, Tag } from 'antd';
import { useBeforeUnload, useBlocker } from 'react-router';

import { hasGraphQLCategory } from '@/shared/graphql';

import {
  type GraduationInfo,
  type GraduationPatch,
  patchGraduationInfo,
  readGraduationInfo,
} from '../infrastructure/student-graduation-info-api';

const LABELS: Record<string, string> = {
  GRADUATION_CERTIFICATE_NO: '毕业证书编号',
  ACTUAL_GRADUATION_DATE: '实际毕业日期',
  DESTINATION: '毕业去向',
  VOCATIONAL_SKILL_TYPE: '职业技能工种 / 类型',
  VOCATIONAL_CERTIFICATE_NO: '职业技能证书号码',
  INTERNSHIP_START_DATE: '实习开始日期',
  INTERNSHIP_END_DATE: '实习结束日期',
  INTERNSHIP_LOCATION: '实习地点',
  INTERNSHIP_CONTENT: '实习内容',
  INTERNSHIP_ASSESSMENT: '实习评定',
};

export function StudentGraduationInfoForm({
  studentId,
  onDirtyChange,
  onBusyChange,
}: {
  studentId: string;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<Record<string, string>>();
  const [info, setInfo] = useState<GraduationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocker = useBlocker(dirty || saving);
  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (dirty || saving) {
          event.preventDefault();
          event.returnValue = '';
        }
      },
      [dirty, saving],
    ),
  );
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange(saving);
  }, [saving, onBusyChange]);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const dialog = modal.confirm({
      title: saving ? '正在保存，请稍后离开' : '放弃未保存的毕业信息？',
      okButtonProps: { disabled: saving },
      onOk: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
    });
    return () => dialog.destroy();
  }, [blocker, modal, saving]);

  const accept = useCallback(
    (next: GraduationInfo) => {
      setInfo(next);
      form.resetFields();
      form.setFieldsValue(
        Object.fromEntries(next.fields.map((field) => [field.field, field.localValue ?? ''])),
      );
      setDirty(false);
      setError(null);
    },
    [form],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    void readGraduationInfo(studentId)
      .then((next) => {
        if (active) accept(next);
      })
      .catch(() => {
        if (active) setError('毕业信息读取失败，请确认权限后重试。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [studentId, accept]);

  async function reload() {
    if (dirty && !(await modal.confirm({ title: '重新读取将放弃未保存的修改，是否继续？' })))
      return;
    setLoading(true);
    try {
      accept(await readGraduationInfo(studentId));
    } catch {
      setError('毕业信息读取失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }

  async function save(explicit?: GraduationPatch[]) {
    if (!info) return;
    const values = await form.validateFields();
    const fields =
      explicit ??
      info.fields.flatMap<GraduationPatch>((field) => {
        if (!field.canSet) return [];
        const value = (values[field.field] ?? '').trim();
        if (value === (field.localValue ?? '')) return [];
        return [
          { field: field.field, action: value ? 'SET' : 'CLEAR', ...(value ? { value } : {}) },
        ];
      });
    if (!fields.length) {
      setDirty(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      accept(await patchGraduationInfo({ studentId, expectedRevision: info.revision, fields }));
      message.success('毕业信息已本地保存');
    } catch (failure) {
      setError(
        hasGraphQLCategory(failure, 'CONFLICT')
          ? '资料已被他人或上游刷新修改。当前输入已保留，请重新读取后核对再保存。'
          : '保存失败，当前输入已保留。请检查字段、权限后重试。',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Spin spinning={loading}>
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          title="毕业信息独立治理，不计入基础建档六项进度。"
          description="本地保存不需要上游登录；上游已有值优先。技术等级只填写技能工种，不填写证书号码。"
        />
        {error ? <Alert type="error" showIcon title={error} /> : null}
        <Button
          disabled={saving}
          onClick={() => {
            void reload();
          }}
        >
          重新读取毕业信息
        </Button>
        {info ? (
          <>
            <span>
              预计毕业年份：{info.expectedGraduationYear ?? '班级或学制信息缺失'}
              （本地计算，不可修改）
            </span>
            {!info.mainSnapshotPresent ? (
              <Alert type="warning" showIcon title="请先完成主档案抓取，再保存毕业信息。" />
            ) : null}
            <Form
              form={form}
              layout="vertical"
              onValuesChange={() => setDirty(true)}
              onFinish={() => {
                void save();
              }}
            >
              {info.fields.map((field) => (
                <div key={field.field}>
                  {field.source === 'UPSTREAM' ? (
                    <div>
                      <Tag>上游</Tag>
                      {LABELS[field.field]}：{field.value ?? '上游值无法识别，需在上游更正'}
                    </div>
                  ) : null}
                  <Form.Item name={field.field} label={LABELS[field.field] ?? field.field}>
                    {field.field === 'DESTINATION' ? (
                      <Select
                        allowClear
                        disabled={!info.canEdit || !field.canSet || saving}
                        options={['就业', '升学', '入伍', '自主创业', '自由职业', '其他'].map(
                          (value) => ({ label: value, value }),
                        )}
                      />
                    ) : (
                      <Input.TextArea
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        maxLength={2000}
                        disabled={!info.canEdit || !field.canSet || saving}
                        placeholder={field.field.endsWith('_DATE') ? 'YYYY-MM-DD' : '缺失可暂留空'}
                      />
                    )}
                  </Form.Item>
                  {field.warningCodes.includes('GRADUATION_LOCAL_VALUE_SHADOWED') ? (
                    <Button
                      size="small"
                      disabled={!info.canEdit || dirty || saving}
                      onClick={() => {
                        void save([{ field: field.field, action: 'CLEAR' }]);
                      }}
                    >
                      清理被上游覆盖的本地候选
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                disabled={!info.canEdit || !dirty}
              >
                本地保存毕业信息
              </Button>
            </Form>
          </>
        ) : null}
      </Space>
    </Spin>
  );
}
