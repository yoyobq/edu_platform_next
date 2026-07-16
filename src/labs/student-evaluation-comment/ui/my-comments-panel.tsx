// src/labs/student-evaluation-comment/ui/my-comments-panel.tsx

import { useCallback, useEffect, useState } from 'react';
import { ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Empty, Space, Spin, Tag, Timeline } from 'antd';

import {
  formatStudentEvaluationCommentDateTime,
  resolveStudentEvaluationCommentErrorMessage,
} from '../application/display';
import { getMyStudentEvaluationComments } from '../infrastructure/api';
import type { MyStudentEvaluationComments } from '../types';

export function MyStudentEvaluationCommentsPanel() {
  const [result, setResult] = useState<MyStudentEvaluationComments | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setResult(await getMyStudentEvaluationComments());
    } catch (nextError) {
      setResult(null);
      setError(resolveStudentEvaluationCommentErrorMessage(nextError, 'mine'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  if (isLoading && !result) {
    return (
      <Card>
        <div className="flex min-h-48 items-center justify-center">
          <Spin description="正在读取本人正式评语" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert
        showIcon
        action={
          <Button icon={<ReloadOutlined />} onClick={() => void loadComments()}>
            重试
          </Button>
        }
        description="本人接口不会接受 studentId，仅按当前账号的学生身份绑定读取。"
        title={error}
        type="error"
      />
    );
  }

  if (!result) {
    return <Empty description="没有可展示的本人评语数据" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card
        extra={
          <Button icon={<ReloadOutlined />} loading={isLoading} onClick={() => void loadComments()}>
            刷新
          </Button>
        }
        title="本人正式评语"
      >
        <Descriptions column={1} size="small">
          <Descriptions.Item label="学生编号">{result.studentId}</Descriptions.Item>
          <Descriptions.Item label="数据范围">
            仅展示当前账号绑定学生的正式人工评语
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="毕业评语">
        {result.graduation ? (
          <Space orientation="vertical" size="middle">
            <Space wrap>
              <Tag color="purple">毕业评语</Tag>
              <Tag>人工正式文本</Tag>
              <span>
                更新于 {formatStudentEvaluationCommentDateTime(result.graduation.updatedAt)}
              </span>
            </Space>
            <div className="whitespace-pre-wrap break-words">{result.graduation.content}</div>
          </Space>
        ) : (
          <Empty description="尚未填写正式毕业评语" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      <Card title={`学期评语（${result.terms.length}）`}>
        {result.terms.length ? (
          <Timeline
            items={result.terms.map((term) => ({
              content: (
                <Card size="small" title={`学期 ${term.semesterId}`}>
                  <Space orientation="vertical" size="small">
                    <Space wrap>
                      <Tag>人工正式文本</Tag>
                      <span>更新于 {formatStudentEvaluationCommentDateTime(term.updatedAt)}</span>
                    </Space>
                    <div className="whitespace-pre-wrap break-words">{term.content}</div>
                  </Space>
                </Card>
              ),
            }))}
          />
        ) : (
          <Empty description="尚未填写学期正式评语" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>
    </div>
  );
}
