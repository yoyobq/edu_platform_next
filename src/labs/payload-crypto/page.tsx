import { useCallback, useEffect, useMemo, useState } from 'react';
import { CodeHighlighter } from '@ant-design/x';
import { Button, Card, Input, Tag, Typography } from 'antd';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism/index.js';

import { payloadCryptoLabAccess } from './access';
import { requestGraphQL } from './api';
import { payloadCryptoLabMeta } from './meta';

type SstsPayloadDebugResultDTO = {
  encryptedData: string;
  operation: string;
  plainTextData: unknown;
};

type CodeThemeMode = 'dark' | 'light';

const ENCRYPT_MUTATION = `
  mutation DebugEncryptSstsPayload($input: DebugEncryptSstsPayloadInput!) {
    debugEncryptSstsPayload(input: $input) {
      encryptedData
      operation
      plainTextData
    }
  }
`;

const DECRYPT_MUTATION = `
  mutation DebugDecryptSstsPayload($input: DebugDecryptSstsPayloadInput!) {
    debugDecryptSstsPayload(input: $input) {
      encryptedData
      operation
      plainTextData
    }
  }
`;

function normalizeInput(raw: string) {
  let str = raw.trim();

  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1);
  }

  return str.trim();
}

function isJsonInput(input: string) {
  try {
    JSON.parse(input);
    return true;
  } catch {
    return false;
  }
}

async function apiEncrypt(payload: string): Promise<string> {
  try {
    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      return 'Error encrypting payload: Invalid JSON input format';
    }

    const data = await requestGraphQL<
      { debugEncryptSstsPayload: SstsPayloadDebugResultDTO },
      { input: { plainTextData: unknown } }
    >(ENCRYPT_MUTATION, { input: { plainTextData: parsedPayload } });
    return data.debugEncryptSstsPayload.encryptedData;
  } catch (err: unknown) {
    return `Error encrypting payload: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

async function apiDecrypt(payload: string): Promise<string> {
  try {
    const data = await requestGraphQL<
      { debugDecryptSstsPayload: SstsPayloadDebugResultDTO },
      { input: { encryptedData: string } }
    >(DECRYPT_MUTATION, { input: { encryptedData: payload } });
    return JSON.stringify(data.debugDecryptSstsPayload.plainTextData, null, 2);
  } catch (err: unknown) {
    return `Error decrypting payload: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

export function PayloadCryptoLabPage() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeThemeMode, setCodeThemeMode] = useState<CodeThemeMode>('dark');
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [showShortcutHint, setShowShortcutHint] = useState(() =>
    typeof document !== 'undefined' ? document.hasFocus() : false,
  );

  const normalizedInput = normalizeInput(input);
  const canProcess = Boolean(normalizedInput) && !loading;
  const isInputCompressed = Boolean(result) && !isInputExpanded;
  const gridClassName = isInputExpanded
    ? 'grid gap-4 xl:grid-cols-[minmax(300px,1fr)_minmax(0,1.5fr)]'
    : isInputCompressed
      ? 'grid gap-4 xl:grid-cols-[minmax(220px,0.55fr)_minmax(0,2.05fr)]'
      : 'grid gap-4 xl:grid-cols-[minmax(240px,0.75fr)_minmax(0,1.75fr)]';
  const inputAutoSize = useMemo(() => {
    if (isInputExpanded) {
      return { maxRows: 18, minRows: 8 };
    }

    if (isInputCompressed) {
      return { maxRows: 7, minRows: 4 };
    }

    return { maxRows: 10, minRows: 5 };
  }, [isInputCompressed, isInputExpanded]);
  const codeHighlightProps = {
    codeTagProps: {
      style: {
        background: 'transparent',
        overflowWrap: 'anywhere',
        whiteSpace: 'pre-wrap',
      },
    },
    wrapLongLines: true,
    ...(codeThemeMode === 'dark'
      ? {
          style: {
            ...vscDarkPlus,
            'pre[class*="language-"]': {
              ...vscDarkPlus['pre[class*="language-"]'],
              margin: 0,
            },
          },
        }
      : null),
  };

  useEffect(() => {
    function syncPageFocus() {
      setShowShortcutHint(document.hasFocus() && document.visibilityState === 'visible');
    }

    syncPageFocus();
    window.addEventListener('focus', syncPageFocus);
    window.addEventListener('blur', syncPageFocus);
    document.addEventListener('visibilitychange', syncPageFocus);

    return () => {
      window.removeEventListener('focus', syncPageFocus);
      window.removeEventListener('blur', syncPageFocus);
      document.removeEventListener('visibilitychange', syncPageFocus);
    };
  }, []);

  const handleProcess = useCallback(async () => {
    const normalizedInput = normalizeInput(input);
    if (!normalizedInput) {
      return;
    }

    setLoading(true);

    try {
      const nextResult = isJsonInput(normalizedInput)
        ? await apiEncrypt(normalizedInput)
        : await apiDecrypt(normalizedInput);

      setResult(nextResult);
    } finally {
      setLoading(false);
    }
  }, [input]);

  useEffect(() => {
    if (!canProcess) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter' || !event.ctrlKey) {
        return;
      }

      event.preventDefault();
      void handleProcess();
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [canProcess, handleProcess]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              载荷加解密工具
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {payloadCryptoLabMeta.purpose}
            </Typography.Paragraph>
          </div>

          <div className="flex flex-wrap gap-2">
            <Tag color="blue">负责人：{payloadCryptoLabMeta.owner}</Tag>
            <Tag color="purple">复核时间：{payloadCryptoLabMeta.reviewAt}</Tag>
            <Tag color="green">环境：{payloadCryptoLabAccess.env.join(', ')}</Tag>
            <Tag color="gold">角色：{payloadCryptoLabAccess.roles.join(', ')}</Tag>
          </div>
        </div>
      </Card>

      <div className={gridClassName}>
        <Card
          title="输入载荷"
          extra={
            <Button
              size="small"
              type="text"
              onClick={() => setIsInputExpanded((currentValue) => !currentValue)}
            >
              {isInputExpanded ? '恢复紧凑' : '展开输入区'}
            </Button>
          }
        >
          <div className="flex flex-col gap-4">
            <Input.TextArea
              autoSize={inputAutoSize}
              placeholder="粘贴载荷后自动识别：JSON 会加密，其他内容会解密"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{ fontFamily: 'monospace' }}
            />
            <Typography.Text type="secondary">
              更适合粘贴即处理的流转；输入区会在结果出现后自动收缩，把空间让给结果。
            </Typography.Text>
            <Button
              type="primary"
              size="large"
              shape="round"
              aria-keyshortcuts="Control+Enter"
              loading={loading}
              disabled={!normalizedInput}
              onClick={() => void handleProcess()}
            >
              <div className="flex items-center gap-2">
                <span>自动处理</span>
                {showShortcutHint ? (
                  <span className="rounded-full border border-current/15 px-2 py-0.5 text-xs text-current/75">
                    Ctrl+Enter
                  </span>
                ) : null}
              </div>
            </Button>
          </div>
        </Card>

        <Card
          title="结果"
          extra={
            <Button
              size="small"
              type={codeThemeMode === 'dark' ? 'primary' : 'default'}
              onClick={() =>
                setCodeThemeMode((currentValue) => (currentValue === 'dark' ? 'light' : 'dark'))
              }
            >
              {codeThemeMode === 'dark' ? '切到亮色' : '切到暗色'}
            </Button>
          }
        >
          {result ? (
            <CodeHighlighter
              lang="json"
              highlightProps={codeHighlightProps}
              style={{ width: '100%' }}
              styles={{
                code: {
                  fontSize: 'var(--ant-font-size-sm)',
                  lineHeight: 1.6,
                },
                root: {
                  overflow: 'hidden',
                },
              }}
            >
              {result}
            </CodeHighlighter>
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center">
              <Typography.Text type="secondary">暂无结果，请先执行加解密操作</Typography.Text>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
