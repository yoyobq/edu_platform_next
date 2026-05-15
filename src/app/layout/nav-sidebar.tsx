// src/app/layout/nav-sidebar.tsx

import { type ReactNode, useMemo } from 'react';
import {
  ApiOutlined,
  BookOutlined,
  CalendarOutlined,
  CarryOutOutlined,
  CodeOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FormOutlined,
  HomeOutlined,
  LockOutlined,
  MailOutlined,
  ReadOutlined,
  ScheduleOutlined,
  SendOutlined,
  SettingOutlined,
  SolutionOutlined,
  SyncOutlined,
  TableOutlined,
  TeamOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Menu } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import { useLocation, useNavigate } from 'react-router';

import {
  isNavigationGroupItem,
  type NavigationLeafItem,
  type NavigationMetaItem,
} from '@/app/navigation';
import { NAV_FULL_WIDTH, NAV_RAIL_WIDTH, useNavCapability } from '@/app/providers';

const ICON_MAP: Record<string, React.ComponentType> = {
  ApiOutlined,
  BookOutlined,
  CalendarOutlined,
  CarryOutOutlined,
  CodeOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FormOutlined,
  HomeOutlined,
  LockOutlined,
  MailOutlined,
  ReadOutlined,
  ScheduleOutlined,
  SyncOutlined,
  SendOutlined,
  SettingOutlined,
  SolutionOutlined,
  TableOutlined,
  TeamOutlined,
  WarningOutlined,
};

function resolveIcon(iconKey: string): React.ReactNode {
  const IconComponent = ICON_MAP[iconKey];
  return IconComponent ? <IconComponent /> : null;
}

function toMenuItems(items: readonly NavigationMetaItem[], collapsed: boolean): ItemType[] {
  return items.map((item) => {
    if (isNavigationGroupItem(item)) {
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
function flattenPaths(items: readonly NavigationMetaItem[]): NavigationLeafItem[] {
  const result: NavigationLeafItem[] = [];

  for (const item of items) {
    if (isNavigationGroupItem(item)) {
      result.push(...flattenPaths(item.children));
    } else {
      result.push(item);
    }
  }

  return result;
}

/** Find which top-level group key should be open for the current route. */
function findOpenGroupKeys(items: readonly NavigationMetaItem[], pathname: string): string[] {
  for (const item of items) {
    if (!isNavigationGroupItem(item)) continue;

    for (const child of item.children) {
      if (pathname === child.path || pathname.startsWith(child.path + '/')) {
        return [item.key];
      }
    }
  }

  return [];
}

type NavSidebarProps = {
  footer?: ReactNode;
  header?: ReactNode;
  items: NavigationMetaItem[];
};

export function NavSidebar({ footer, header, items }: NavSidebarProps) {
  const { mode } = useNavCapability();
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
      {header ? (
        <div
          className="flex shrink-0 items-center px-3 py-1"
          style={{ height: 88, width: sidebarWidth }}
        >
          {header}
        </div>
      ) : null}

      {/* Menu area - full height with scroll */}
      <div
        className="app-nav-menu-shell min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-0"
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

      {footer ? (
        <div
          className="flex shrink-0 flex-col gap-1 px-2 pb-2 pt-3"
          style={{ width: sidebarWidth }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
