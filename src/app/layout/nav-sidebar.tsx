// src/app/layout/nav-sidebar.tsx

import { useMemo } from 'react';
import {
  HomeOutlined,
  LockOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { Menu, Tooltip } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import { Link, useLocation } from 'react-router';

import { NAV_RAIL_WIDTH, useNavCapability } from '@/app/providers';

import type { NavigationMetaItem } from './navigation-meta';

const ICON_MAP: Record<string, React.ComponentType> = {
  HomeOutlined,
  LockOutlined,
  SendOutlined,
};

function resolveIcon(iconKey: string): React.ReactNode {
  const IconComponent = ICON_MAP[iconKey];
  return IconComponent ? <IconComponent /> : null;
}

function toMenuItems(items: NavigationMetaItem[], collapsed: boolean): ItemType[] {
  return items.map((item) => ({
    key: item.key,
    icon: resolveIcon(item.iconKey),
    label: collapsed ? (
      <Tooltip title={item.label} placement="right">
        <Link to={item.path} aria-label={item.label} />
      </Tooltip>
    ) : (
      <Link to={item.path}>{item.label}</Link>
    ),
    children: item.children ? toMenuItems(item.children, collapsed) : undefined,
  }));
}

type NavSidebarProps = {
  items: NavigationMetaItem[];
};

export function NavSidebar({ items }: NavSidebarProps) {
  const { mode, pinToFull, setMode } = useNavCapability();
  const location = useLocation();
  const collapsed = mode === 'rail';

  const menuItems = useMemo(() => toMenuItems(items, collapsed), [items, collapsed]);

  const selectedKey = useMemo(() => {
    const pathname = location.pathname;
    // Match the longest prefix among registered paths.
    let best: string | null = null;
    for (const item of items) {
      if (pathname === item.path || pathname.startsWith(item.path + '/')) {
        if (!best || item.path.length > best.length) {
          best = item.key;
        }
      }
    }
    return best ?? '/';
  }, [location.pathname, items]);

  if (mode === 'none') return null;

  return (
    <div className="flex h-full flex-col" style={{ width: collapsed ? NAV_RAIL_WIDTH : undefined }}>
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[selectedKey]}
          items={menuItems}
          style={{ borderInlineEnd: 'none' }}
        />
      </div>

      <div className="border-t border-border">
        {collapsed ? (
          <Tooltip title="展开菜单" placement="right">
            <button
              type="button"
              className="flex w-full items-center justify-center py-3 text-text-secondary transition-colors hover:bg-bg-layout hover:text-text"
              aria-label="展开导航菜单"
              onClick={pinToFull}
            >
              <MenuUnfoldOutlined />
            </button>
          </Tooltip>
        ) : (
          <Tooltip title="收起菜单" placement="right">
            <button
              type="button"
              className="flex w-full items-center justify-center py-3 text-text-secondary transition-colors hover:bg-bg-layout hover:text-text"
              aria-label="收起导航菜单"
              onClick={() => setMode('rail')}
            >
              <MenuFoldOutlined />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
