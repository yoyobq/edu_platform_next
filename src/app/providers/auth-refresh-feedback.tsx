import { useEffect } from 'react';
import { message } from 'antd';
import { useLocation } from 'react-router';

import { readAuthRefreshFeedbackFlash } from '@/features/auth';

export function AuthRefreshFeedbackBridge() {
  const [messageApi, contextHolder] = message.useMessage();
  const location = useLocation();

  useEffect(() => {
    const flash = readAuthRefreshFeedbackFlash();

    if (flash) {
      if (flash.type === 'error') {
        void messageApi.error({
          content: flash.content,
          duration: 2.5,
        });
      } else {
        void messageApi.success({
          content: flash.content,
          duration: 2,
        });
      }
    }
  }, [location.hash, location.pathname, location.search, messageApi]);

  return <>{contextHolder}</>;
}
