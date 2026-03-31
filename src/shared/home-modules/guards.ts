import type { HomeModuleContract, VisibleHomeModuleContract } from './contract';

export function isVisibleHomeModule(
  module: HomeModuleContract,
): module is VisibleHomeModuleContract {
  return module.visibility.visible;
}
