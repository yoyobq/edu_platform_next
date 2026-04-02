<!-- docs/ui-design/brand/app-icons.md -->

# App Icons

浏览器、收藏夹、桌面入口等小尺寸品牌图标。不讨论页面内 Logo 或业务 UI icon。

## 当前资产

| 文件                            | 用途                        | 状态                                   |
| ------------------------------- | --------------------------- | -------------------------------------- |
| `public/favicon.ico`            | 浏览器标签                  | `index.html` 已引用                    |
| `public/icon.svg`               | 现代浏览器图标（黑底白标）  | `index.html` 已引用（`image/svg+xml`） |
| `public/icon-light.svg`         | 白底黑标变体                | 已落位，供浅色背景或导出场景使用       |
| `public/icons/icon-128x128.png` | 扩展 / 缩略图（黑底白标）   | 已交付                                 |
| `public/icons/icon-192x192.png` | manifest 中尺寸（黑底白标） | 已交付                                 |
| `public/icons/icon-512x512.png` | manifest 大尺寸（黑底白标） | 已交付                                 |

`index.html` 引用：

```html
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/svg+xml" href="/icon.svg" />
```

当前 `icon.svg` / `icon-light.svg` 均为真矢量 SVG，共用同一主轮廓，仅按底色切换黑白反相版本。

## 待补充

- `apple-touch-icon.png`（需在 `index.html` 增加 `<link rel="apple-touch-icon">`）
- `manifest.json`（引用 `icons/icon-192x192.png` 和 `icons/icon-512x512.png`）

## 规则

- 小尺寸入口使用 `icon.svg` / `favicon.ico`，不拿完整 Logo 硬缩小
- 所有入口保持单一主轮廓；仅按底色切换 `icon.svg` / `icon-light.svg` 技术变体
- 文件命名保持稳定（见 [asset-engineering.md](./asset-engineering.md)）

## 质量检查

迭代时至少验证：

1. `16px`、`32px` 缩看：主轮廓可辨认
2. 深浅背景切换：两种底色均成立
3. 识别度来自轮廓和结构，不来自细节堆砌
