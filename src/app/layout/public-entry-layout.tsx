import { ConfigProvider } from 'antd';
import { Outlet } from 'react-router';

export function PublicEntryLayout() {
  return (
    <ConfigProvider
      theme={{
        cssVar: {},
        token: {
          colorPrimary: '#1255CC',
          colorError: '#D93025',
          colorLink: '#1255CC',
          colorBgLayout: '#F4F6FA',
          colorBgContainer: '#FFFFFF',
          borderRadius: 8,
          borderRadiusLG: 12,
          borderRadiusSM: 4,
        },
      }}
    >
      <Outlet />
    </ConfigProvider>
  );
}
