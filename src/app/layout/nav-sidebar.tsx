// src/app/layout/nav-sidebar.tsx

import { useMemo } from 'react';
import {
  CodeOutlined,
  ExperimentOutlined,
  HomeOutlined,
  LeftOutlined,
  LockOutlined,
  RightOutlined,
  SendOutlined,
  TeamOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Menu, Tooltip } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import { useLocation, useNavigate } from 'react-router';

import { NAV_FULL_WIDTH, NAV_RAIL_WIDTH, useNavCapability } from '@/app/providers';

import type { NavigationMetaItem } from './navigation-meta';

const ICON_MAP: Record<string, React.ComponentType> = {
  CodeOutlined,
  ExperimentOutlined,
  HomeOutlined,
  LockOutlined,
  SendOutlined,
  TeamOutlined,
  WarningOutlined,
};

function resolveIcon(iconKey: string): React.ReactNode {
  const IconComponent = ICON_MAP[iconKey];
  return IconComponent ? <IconComponent /> : null;
}

function toMenuItems(items: NavigationMetaItem[], collapsed: boolean): ItemType[] {
  return items.map((item) => {
    if (item.children) {
      return {
        key: item.key,
        icon: resolveIcon(item.iconKey),
        label: item.label,
        title: collapsed ? item.label : undefined,
        children: toMenuItems(item.children, collapsed),
      };
    }

    return {
      key: item.key,
      icon: resolveIcon(item.iconKey),
      label: item.label,
      title: collapsed ? item.label : undefined,
    };
  });
}

/** Collect all leaf paths (including from children) for route matching. */
function flattenPaths(items: NavigationMetaItem[]): NavigationMetaItem[] {
  const result: NavigationMetaItem[] = [];

  for (const item of items) {
    if (item.children) {
      result.push(...flattenPaths(item.children));
    } else {
      result.push(item);
    }
  }

  return result;
}

/** Find which top-level group key should be open for the current route. */
function findOpenGroupKeys(items: NavigationMetaItem[], pathname: string): string[] {
  for (const item of items) {
    if (!item.children) continue;

    for (const child of item.children) {
      if (pathname === child.path || pathname.startsWith(child.path + '/')) {
        return [item.key];
      }
    }
  }

  return [];
}

type NavSidebarProps = {
  items: NavigationMetaItem[];
};

export function NavSidebar({ items }: NavSidebarProps) {
  const { mode, pinToFull, setMode } = useNavCapability();
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = mode === 'rail';

  const menuItems = useMemo(() => toMenuItems(items, collapsed), [items, collapsed]);

  const allLeaves = useMemo(() => flattenPaths(items), [items]);
  const leafPathByKey = useMemo(
    () => new Map(allLeaves.map((item) => [item.key, item.path])),
    [allLeaves],
  );

  const selectedKey = useMemo(() => {
    const pathname = location.pathname;
    let best: string | null = null;

    for (const item of allLeaves) {
      if (pathname === item.path || pathname.startsWith(item.path + '/')) {
        if (!best || item.path.length > best.length) {
          best = item.key;
        }
      }
    }

    return best ?? '/';
  }, [location.pathname, allLeaves]);

  const openKeys = useMemo(
    () => findOpenGroupKeys(items, location.pathname),
    [items, location.pathname],
  );

  if (mode === 'none') return null;

  const sidebarWidth = collapsed ? NAV_RAIL_WIDTH : NAV_FULL_WIDTH;

  return (
    <div className="relative flex h-full flex-col">
      {/* Menu area - full height with scroll */}
      <div
        className="app-nav-menu-shell flex-1 overflow-y-auto overflow-x-hidden py-2"
        style={{ width: sidebarWidth }}
      >
        <Menu
          key={collapsed ? 'rail-menu' : 'full-menu'}
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[selectedKey]}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={({ key }) => {
            const targetPath = leafPathByKey.get(String(key));
            if (targetPath) {
              navigate(targetPath);
            }
          }}
          style={{ background: 'transparent', borderInlineEnd: 'none' }}
        />
      </div>

      <Tooltip title={collapsed ? '展开菜单' : '收起菜单'} placement="right">
        <button
          type="button"
          className="app-nav-sidebar-toggle absolute flex h-5 w-5 items-center justify-center rounded-full bg-sidebar-affordance text-sidebar-affordance-ink transition-colors hover:bg-sidebar-affordance-hover hover:text-text"
          style={{ left: sidebarWidth - 10, top: 45 }}
          aria-label={collapsed ? '展开导航菜单' : '收起导航菜单'}
          onClick={collapsed ? pinToFull : () => setMode('rail')}
        >
          {collapsed ? (
            <RightOutlined style={{ fontSize: 8 }} />
          ) : (
            <LeftOutlined style={{ fontSize: 8 }} />
          )}
        </button>
      </Tooltip>
    </div>
  );
}
