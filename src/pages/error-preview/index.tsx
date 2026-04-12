// src/pages/error-preview/index.tsx

import { useState } from 'react';
import { Card, Flex, Segmented, Typography } from 'antd';
import { useLoaderData, useNavigate } from 'react-router';

import { logout } from '@/features/auth';
import { Error403, Error404, Error500, ErrorRouteCrash } from '@/features/error-feedback';

type PreviewKey = '404' | '403' | '500' | 'crash';

const PREVIEW_OPTIONS: { label: string; value: PreviewKey }[] = [
  { label: '404 页面不存在', value: '404' },
  { label: '403 访问被拒绝', value: '403' },
  { label: '500 服务异常', value: '500' },
  { label: '路由渲染异常', value: 'crash' },
];

export function ErrorPreviewPage() {
  const loaderData = useLoaderData() as { isForbidden?: boolean } | null;
  const navigate = useNavigate();
  const [active, setActive] = useState<PreviewKey>('404');
  const handleRelogin = () => {
    logout();
    navigate('/login', { replace: true });
  };
  const previewMap: Record<PreviewKey, () => React.JSX.Element> = {
    '403': () => <Error403 onRelogin={handleRelogin} />,
    '404': () => <Error404 />,
    '500': () => <Error500 />,
    crash: () => <ErrorRouteCrash />,
  };
  const Preview = previewMap[active];

  if (loaderData?.isForbidden) {
    return <Error403 onRelogin={handleRelogin} />;
  }

  return (
    <Flex vertical gap={24}>
      <Card>
        <Flex vertical gap={12}>
          <Typography.Title level={3} style={{ marginBottom: 0 }}>
            异常页预览
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            预览系统内各类异常状态页面的渲染效果。切换标签查看不同状态码对应的展示。
          </Typography.Paragraph>
          <Segmented
            value={active}
            options={PREVIEW_OPTIONS}
            onChange={(v) => setActive(v as PreviewKey)}
          />
        </Flex>
      </Card>

      <Card
        styles={{
          body: {
            padding: 0,
            borderTop: '1px solid var(--ant-color-border-secondary)',
          },
        }}
      >
        <Preview />
      </Card>
    </Flex>
  );
}
