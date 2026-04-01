<!-- docs/ui-design/brand/asset-engineering.md -->

# Asset Engineering

本文件只管品牌资产的工程维护方式，不管视觉样式本身。

## 目录角色

- `public/`：运行时交付资产
- 品牌源文件：应放在设计工具或专门的品牌源目录
- UI 功能图标：继续直接从 `@ant-design/icons` 引入，不建本地图标目录

若后续需要把源文件纳入仓库，优先使用 `src/assets/brand/` 之类的语义目录。

## 命名

建议使用稳定命名：

- `logo.svg`
- `icon.svg`
- `favicon.ico`
- `logo-dark.svg`
- `logo-light.svg`
- `icon-maskable-512.png`

不要使用临时文件名、日期、人名或导出工具默认命名。

## 格式

- 品牌源资产优先保留真矢量版本
- 运行时再按目标平台导出 SVG / PNG / ICO
- 现有位图包裹型 SVG 可暂时继续使用，但不建议作为长期 source of truth

## Review 检查点

涉及品牌资产改动时，至少检查：

1. 这是 Logo、App Icon，还是 UI Icon
2. 是否使用了正确来源
3. 是否修改了交付文件而忘记同步源资产
4. 是否引入了第二套功能图标库
