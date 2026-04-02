<!-- docs/ui-design/brand/asset-engineering.md -->

# Asset Engineering

品牌资产的工程维护方式。不管视觉样式。

## 目录角色

| 目录                          | 角色                 | 说明                                                                                    |
| ----------------------------- | -------------------- | --------------------------------------------------------------------------------------- |
| `public/`                     | 运行时交付           | `favicon.ico`、`icon.svg`、`icon-light.svg`、`logo.svg`、`logo-dark.svg`、`icons/*.png` |
| `src/assets/brand/`（未建立） | 源文件纳入仓库时使用 | 后续需要时建立                                                                          |
| `@ant-design/icons`           | UI 功能图标          | 直接 import，不建本地图标目录                                                           |

## 命名约定

| 文件名                  | 用途                      |
| ----------------------- | ------------------------- |
| `logo.svg`              | 彩色 Logo（标准品牌展示） |
| `logo-dark.svg`         | 深色背景 Logo（反白版）   |
| `icon.svg`              | 浏览器图标（黑底白标）    |
| `icon-light.svg`        | 浏览器图标（白底黑标）    |
| `favicon.ico`           | 传统 favicon              |
| `icon-maskable-512.png` | PWA maskable 图标         |

禁止临时文件名、日期、人名或导出工具默认命名。

## 格式

- 品牌源资产保留真矢量版本
- 运行时按目标平台导出 SVG / PNG / ICO
- `public/logo.svg`、`public/logo-dark.svg`、`public/icon.svg`、`public/icon-light.svg` 应始终保持为真矢量 SVG
- 交付用 SVG 应保持洁净：剔除无用 `defs`、冗余 `g` 编组、隐藏图层、编辑器元数据

## Code Review 检查点

| #   | 检查项                               |
| --- | ------------------------------------ |
| 1   | 这是 Logo、App Icon 还是 UI Icon？   |
| 2   | 是否使用了正确来源？                 |
| 3   | 是否修改了交付文件但忘记同步源资产？ |
| 4   | 是否引入了第二套功能图标库？         |
| 5   | SVG 是否仍有大量设计工具冗余？       |
