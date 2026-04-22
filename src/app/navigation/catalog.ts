import { getAcademicAffairsNavigationItems } from './providers/academic-affairs';
import { getAdminNavigationItems } from './providers/admin';
import { getErrorNavigationItems } from './providers/errors';
import { getHomeNavigationItems } from './providers/home';
import { getLabsNavigationItems, hasPayloadCryptoNavigationAccess } from './providers/labs';
import { getSandboxNavigationItems } from './providers/sandbox';
import type { NavigationFilter } from './types';
import {
  filterNavigationItems,
  findNavigationItemByPath,
  flattenNavigationItems,
  mergeNavigationItems,
} from './utils';

const NAVIGATION_PROVIDERS = [
  getHomeNavigationItems,
  getAdminNavigationItems,
  getAcademicAffairsNavigationItems,
  getErrorNavigationItems,
  getLabsNavigationItems,
  getSandboxNavigationItems,
] as const;

function collectNavigationItems(filter: NavigationFilter) {
  return NAVIGATION_PROVIDERS.flatMap((provider) => provider(filter));
}

export function getNavigationItems(filter: NavigationFilter) {
  return filterNavigationItems(mergeNavigationItems(collectNavigationItems(filter)), filter);
}

export function getNavigationLeafItems(filter: NavigationFilter) {
  return flattenNavigationItems(getNavigationItems(filter));
}

export function canAccessNavigationPath(path: string, filter: NavigationFilter) {
  return findNavigationItemByPath(getNavigationItems(filter), path) !== null;
}

export function resolveNavMode(filter: NavigationFilter) {
  return getNavigationItems(filter).some((item) => item.navMode !== 'none') ? 'rail' : 'none';
}

export { hasPayloadCryptoNavigationAccess };
