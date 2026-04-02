<!-- docs/ui-design/brand/README.md -->

# Brand Docs

品牌目录只处理三类问题：

1. 品牌调性与默认审美判断
2. Logo / App Icon / UI Icon 的使用边界
3. 品牌资产的工程维护方式

若只是判断“这个页面该不该再加点东西”，先看 [brand-tone.md](./brand-tone.md)。
若已确定要用哪类资产，再进入对应子文档。

## 阅读顺序

默认按下面顺序查阅：

1. [brand-tone.md](./brand-tone.md)
   适合做总判断：该收还是该放、该退还是该响。

2. [logo.md](./logo.md)
   适合判断页面中的品牌位、弱露出和 Logo 使用边界。

3. [app-icons.md](./app-icons.md)
   适合判断浏览器、桌面入口、收藏等小尺寸品牌图标。

4. [ui-icons.md](./ui-icons.md)
   适合判断产品内部导航、操作、状态和提示图标。

5. [asset-engineering.md](./asset-engineering.md)
   适合处理品牌资产命名、格式、运行时交付和 SVG 工程清洁度。

## 优先级

- 调性冲突时：`brand-tone.md` 优先
- 资产类型冲突时：先判断它到底是 Logo、App Icon 还是 UI Icon
- 工程落地问题：`asset-engineering.md` 只回答“怎么交付和维护”，不改写调性判断
