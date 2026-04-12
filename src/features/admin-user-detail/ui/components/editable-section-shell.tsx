import { EditOutlined } from '@ant-design/icons';
import { Alert, Button, Flex } from 'antd';
import type { ReactNode } from 'react';

export function EditableSectionShell({
  children,
  editLabel,
  editing,
  errorMessage,
  formId,
  onCancel,
  onEdit,
  saveLabel,
  saving,
}: {
  children: ReactNode;
  editLabel: string;
  editing: boolean;
  errorMessage: string | null;
  formId: string;
  onCancel: () => void;
  onEdit: () => void;
  saveLabel: string;
  saving: boolean;
}) {
  return (
    <Flex vertical gap={12}>
      <Flex align="center" gap={8} justify="flex-end">
        {editing ? (
          <Flex gap={8}>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" htmlType="submit" form={formId} loading={saving}>
              {saveLabel}
            </Button>
          </Flex>
        ) : (
          <Button icon={<EditOutlined />} onClick={onEdit} aria-label={editLabel} size="small">
            编辑
          </Button>
        )}
      </Flex>
      {errorMessage ? <Alert type="error" showIcon message={errorMessage} /> : null}
      {children}
    </Flex>
  );
}

export function EditableFormCard({
  children,
  spanClassName,
}: {
  children: ReactNode;
  spanClassName?: string;
}) {
  return (
    <div className={spanClassName}>
      <div className="flex h-full flex-col justify-start">{children}</div>
    </div>
  );
}
