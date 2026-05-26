# 10. 竞品数据与调研方法附录

本文档用于说明 `docs/market-research/` 目录下 9 份模块报告的市场数据来源、采集口径、竞品筛选原则和数据限制，确保结论可追溯、可复核、可继续迭代。

## 1. 数据来源

本轮调研采用两类数据源：

- 项目现状数据：以当前仓库实现为唯一基线，重点参考 `docs/PRD v1.0.md`、`src/pages/newtab/App.tsx`、`src/features/*`、`src/shared/config/views.ts`、`src/features/settings/settings-tabs.tsx` 以及对应 `store / repositories / services / chrome` 目录。
- 市场与竞品数据：以 Chrome Web Store 公开页面为主，采集字段包括扩展名称、评分、评论数、用户量、主页地址和公开版本更新时间；外部官网仅用于确认产品定位，不作为用户规模统计来源。

## 2. 数据时间与口径

- 采集时间：2026-05-25。
- 用户量口径：使用 Chrome Web Store 公开展示的安装量分档，属于区间型公开值，非精确实时 DAU/MAU。
- 评分口径：使用商店公开星级平均分。
- 评论口径：使用商店公开评论总数。
- 更新时间口径：使用商店公开版本对应的时间戳字段换算而来，更适合做“产品是否仍在维护”的粗略判断，不应等价理解为最后一次功能迭代发布时间。

## 3. 竞品筛选原则

- 优先选择与 Canopy 某个模块直接竞争的 Chrome 扩展，而不是跨平台 SaaS 或浏览器原生能力。
- 优先选择“用户量足够大”或“场景相关性足够强”的产品，避免只看高热度但不具可比性的泛工具。
- 对同一模块，尽量同时覆盖“头部规模竞品”和“强场景竞品”，例如：
  - 标签 / 归档模块同时参考 OneTab、Session Buddy、Workona、Tabs Outliner。
  - 新标签页体验同时参考 Momentum、Tabliss、daily.dev。
  - 开发工具同时参考 JSON Formatter、Web Developer、ModHeader、Octotree。
- 当 Chrome Web Store 搜索结果存在同名或相似扩展时，优先采用安装量、评论量和产品定位更稳定的条目。

## 4. 公开竞品数据明细

| 产品                      | 主要对应模块             | Chrome Web Store 搜索词              | 扩展 ID                            | 用户量 | 评分 | 评论数 | 主页                | 公开更新时间 |
| ------------------------- | ------------------------ | ------------------------------------ | ---------------------------------- | ------ | ---- | ------ | ------------------- | ------------ |
| OneTab                    | 标签工作台 / 会话归档    | `one tab`                            | `chphlpgkkbolifaimnlloiipkdnihall` | 2M     | 4.45 | 14,527 | `one-tab.com`       | 2013-03-07   |
| Session Buddy             | 标签工作台 / 归档 / 历史 | `session buddy tab bookmark manager` | `edacconmaakjimmfgnblocblbcdcpbko` | 1M     | 4.66 | 25,095 | `sessionbuddy.com`  | 2010-03-03   |
| Tab Manager by Workona    | 标签工作台 / 搜索 / 设置 | `workona`                            | `ailcmbgekjpnablpdkmaaccecekgdhlh` | 200K   | 4.64 | 3,795  | `workona.com`       | 2017-10-01   |
| Toby: Tab Management Tool | 标签工作台 / 搜索 / 书签 | `toby tab management tool`           | `hddnkoipeenegfoeaoibdmnaalmgkpip` | 300K   | 4.21 | 3,279  | `gettoby.com`       | 2016-03-28   |
| Tabs Outliner             | 会话归档 / 历史          | `tabs outliner`                      | `eggkanocgddhmamlbiijnphhppkpkmkl` | 100K   | 4.44 | 3,324  | `tabsoutliner.com`  | 2012-07-21   |
| Tab Suspender by Workona  | 标签工作台 / 洞察        | `tab suspender by workona`           | `kkahjkjjcepelnnikconblkonolboiok` | 30K    | 4.04 | 330    | `workona.com`       | 2021-02-10   |
| Raindrop.io               | 书签中心                 | `raindrop io`                        | `ldgfbffkinooeloadekpmfoklnobpien` | 400K   | 4.12 | 776    | `raindrop.io`       | 2013-10-24   |
| Better History            | 历史记录 / 洞察          | `better history`                     | `egehpkpgpgooebopjihjmnpejnjafefi` | 100K   | 4.70 | 1,428  | `betterhistory.io`  | 2018-10-15   |
| History Trends Unlimited  | 历史记录 / 洞察          | `history trends unlimited`           | `pnmchffiealhkdloeffcdnbgdnedheme` | 60K    | 4.52 | 470    | —                   | 2013-03-17   |
| Momentum                  | 设置与个性化 / 热榜      | `momentum`                           | `laookkfknpbbblfpciffpaejjkokdgca` | 2M     | 4.49 | 13,759 | `momentumdash.com`  | 2013-10-02   |
| Tabliss                   | 设置与个性化 / 热榜      | `tabliss`                            | `hipekcciheckooncpjeljhnekcoolahp` | 100K   | 4.66 | 382    | `tabliss.io`        | 2017-09-02   |
| daily.dev                 | 热榜聚合                 | `daily.dev`                          | `jlmpjdjjbgclbocgajdjefcidcncaied` | 400K   | 4.82 | 2,798  | `daily.dev`         | 2017-11-02   |
| 稀土掘金                  | 热榜聚合                 | `juejin`                             | `lecdifefmmfjnjjinhaennhdlmcaeeeb` | 100K   | 3.47 | 352    | `juejin.cn`         | 2016-05-16   |
| JSON Formatter            | 开发工具栏               | `json formatter`                     | `bcjindcccaagfpapjjmafapmmgkkhgoa` | 2M     | 4.28 | 2,082  | `callumlocke.com`   | 2011-02-26   |
| Web Developer             | 开发工具栏               | `web developer`                      | `bfbameneiokkgbdmiekhjnmfkcnldhhm` | 1M     | 4.46 | 2,831  | `chrispederick.com` | 2010-03-17   |
| ModHeader                 | 开发工具栏               | `modheader`                          | `idgpnmonknjnojddfkpgkljpfnnfcklj` | 900K   | 2.99 | 1,178  | `modheader.com`     | 2011-12-15   |
| Octotree                  | 开发工具栏               | `octotree`                           | `bkhaagjahfmjljalopjnoealnfndnagc` | 200K   | 4.86 | 1,137  | `octotree.io`       | 2014-05-10   |
| Quick Tabs                | 搜索与命令中心 / 历史    | `quick tabs`                         | `jnjfeinjfmenlddahdjdmgpbokiacbbb` | 30K    | 4.54 | 549    | —                   | 2009-12-30   |

## 5. 本轮未采用或降权处理的数据

- `Tab Manager Plus Plus` 搜索结果虽然能命中同名词，但公开安装量仅 `359`、评论数仅 `1`，信号过弱，不适合作为本轮主竞品基准，因此未纳入核心报告的主表。
- 外部官网上的营销文案、博客案例和发布日志可以辅助理解定位，但不作为用户规模、评分、渗透率等客观市场数据使用。
- 对于 Chrome Web Store 未明确展示的字段，例如留存、活跃率、商业化转化率，本轮不进行推断，以避免报告失真。

## 6. 如何使用本附录

- 如果后续要更新 9 份模块报告，只需先更新本表中的市场数据，再回写到对应模块报告的“市场数据快照”部分。
- 如果后续要增加新模块或新增竞品，建议先写入本附录，再更新总览 README，最后补对应模块报告，保证口径一致。
- 如果后续要把报告转成产品路线图，本附录可作为“为什么选择这些竞品”的依据，而 `11-chrome-api-integration-roadmap.md` 则可作为“怎么落地”的技术依据。
