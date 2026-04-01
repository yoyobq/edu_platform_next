<!-- docs/ui-design/brand/app-icons.md -->

# App Icons

本文件约束浏览器、收藏夹、桌面入口等小尺寸品牌图标，不讨论业务功能 icon。

## 范围

包括：

- `favicon.ico`
- `icon.svg`
- 未来的 `apple-touch-icon`
- 未来 `manifest` 使用的多尺寸图标

不包括：

- 页面中的 Logo
- 按钮、导航、状态使用的 UI icon

## 规则

- 小尺寸入口优先使用 `icon.svg` / `favicon.ico`，不要直接拿完整 Logo 硬缩小
- 浏览器与系统入口应保持单一主版本，不同入口不要随意换图
- 导出文件命名保持稳定，不使用临时人名、日期或版本后缀

## 推荐交付

当前最小集合：

- `favicon.ico`
- `icon.svg`

后续若接入更多入口，补充：

- `apple-touch-icon.png`
- `192x192` / `512x512` manifest 图标

## 当前项目提醒

`public/logo.svg` 与 `public/icon.svg` 当前属于运行时交付资产，可继续使用；但它们不是长期可编辑的唯一设计源。
