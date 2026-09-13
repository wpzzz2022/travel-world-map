# 我们的旅行地图 🌍

一个两个人的旅行计划网页：首页是一颗可以转动的地球仪，点开国家 → 收集城市与景点、打卡点和小红书攻略笔记，再把想去的城市串成待出行的旅行计划。

## 功能

- **地球仪首页**：想去的国家亮金色、去过的亮绿色，目的地坐标处有涟漪动画；点击国家进入对应列表。
- **中国市级地图**：点开中国，370 个市级单位摊在高德地图上——绿色=去过、金色=想去、灰绿=还没去；城市列表按省分组，支持状态筛选和搜索。点任意城市（哪怕还没去过）直接进入城市页，标记状态、添加景点。直辖市/港澳台以省级为"市"单位；也可以添加自定义地点。
- **三级结构**：国家 → 目的地（城市）→ 景点，每级都能添加 / 删除。
- **景点详情页**：介绍、位置坐标、景点地图（金色菱形=景点、绿色数字=打卡点）、打卡点（机位说明 + 坐标 + 照片）、关联的小红书笔记卡片（链接 + 封面图 + 备注）。
- **冒险记录** 🧭：仿 AdventureLog，记录每一次「去过」——日期（起止）、关联城市、星级评分、感想；列表按时间倒序。
- **本机相册**：冒险记录和每个景点都可以「关联本机相册文件夹」（Chrome/Edge 的 File System Access API，句柄存在 IndexedDB，刷新后仍有效），文件夹里的照片和视频直接在页面里浏览（灯箱看大图/播视频），文件不复制不上传；也支持手动加小图（base64）和图片/视频链接。
- **视频支持**：景点、打卡点、冒险相册里的视频都能播放——mp4/mov/webm 等按扩展名自动识别，缩略图显示首帧 + ▶ 角标。
- **旅行计划** 🧳：新建计划 → 从城市页「加入行程」或在计划里挑站点/自由填写 → 每站填天数、↑↓ 调顺序 → 自动合计总天数；行程段可关联到城市页，出发前逐个订票。
- **地图选点**：表单里的地图点一下就能取坐标，也可以直接填经纬度。
- **打开地图**：每个坐标都带高德 / 百度 / Google 三个外链，国内坐标自动带 `coordinate=wgs84` 参数避免偏移。
- **数据本地保存 + 云同步**：不登录时数据存在浏览器 localStorage；部署了 `api/` 目录的 Cloudflare Worker 后，登录账号即可**多用户隔离 + 自动云同步**（换设备登录同一账号，数据自动拉取，修改自动推送）。顶栏「数据」菜单支持导出 / 导入 JSON。

## 快速开始

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 类型检查 + 产出 dist/
npm run preview  # 本地预览 dist
```

**服务器部署**：`docker compose up -d --build` 一条命令起 nginx 静态站；架构说明、HTTPS 配置（本机相册功能在服务器上必须 HTTPS）和未来的数据同步后端方案见 [DEPLOY.md](DEPLOY.md)。

技术栈：Vite + React 18 + TypeScript + react-globe.gl（three.js 地球仪）+ Leaflet + topojson world-atlas。

## 地图方案（为什么不是谷歌地图 / OSM）

站内底图按坐标位置自动选择，不需要任何 API key：

| 场景 | 底图 | 说明 |
| --- | --- | --- |
| 中国大陆坐标 | 高德道路瓦片 | 国内访问最快最稳，中文标注全 |
| 海外坐标 | Esri World Street Map | 全球覆盖，国内可达（实测 0.7s） |

配套细节：

- 站内统一存 **WGS84（GPS）坐标**（`src/lib/maps.ts`）。高德瓦片是 GCJ-02 网格，国内点位显示前会做 `wgs84ToGcj02` 换算，选点器点击后再换算回 WGS84 存储；海外坐标不做换算（GCJ-02 只在中国境内有偏移）。
- 「打开地图」外链里，高德 `uri.amap.com/marker` 必须带 `coordinate=wgs84`，否则定位偏移几百米；百度链接口带 `coord_type=wgs84` 由百度自动换算。
- 实测（2026-09，本机网络）：`tile.openstreetmap.org` 与 CARTO 瓦片均超时不可达；CARTO 还额外要求 API key（会盖 "API KEY REQUIRED" 水印）；高德道路瓦片对海外只返回空白图（所以海外切 Esri）。
- 如果以后想换成**高德官方 JS API**（带搜索、路书等）：在[高德开放平台](https://lbs.amap.com/)免费申请 Web端 key + 安全密钥即可，坐标换算逻辑可以直接复用 `wgs84ToGcj02`。

## 小红书笔记怎么关联

小红书**没有对外开放的笔记 API**（官方开放平台只面向企业号/电商场景），所以采用「链接 + 存图」的手动流程：

1. 在小红书 App 里点「分享 → 复制链接」。
2. 景点页点「＋ 小红书笔记」把链接贴进来，填上标题 / 作者 / 备注。
3. 图片用 [XHS-Downloader](https://github.com/JoeanAmier/XHS-Downloader)（开源，支持批量下载无水印原图；也有 [油猴脚本版](https://greasyfork.org/zh-CN/scripts/483847-xhs-downloader) 更轻量）下载，存进项目 `public/xhs/` 目录。
4. 添加图片时填 `/xhs/文件名.jpg` 即可显示在打卡点或笔记卡片里。

想再省事一点的话，可以后续加一个小脚本：粘贴分享链接 → 调 XHS-Downloader → 图片自动落盘 + 生成笔记 JSON 片段。

## 关于 AdventureLog：功能梳理与融入方案

[AdventureLog](https://github.com/Sevenlines/AdventureLog)（GPL-3.0，SvelteKit 前端 + Django 后端 + PostGIS，Docker 自部署，多端）是同类里功能最全的项目。它的功能全景和对本项目的融入建议：

| AdventureLog 功能 | 现状 | 融入建议 |
| --- | --- | --- |
| 冒险记录（地点、日期、评分、笔记、照片、链接） | ✅ 已有：冒险记录页（日期起止 + 星级 + 感想 + 关联城市）+ 相册 | 大图缩放、时间线视图可以继续打磨 |
| 到访国家/地区统计地图 | 部分：地球仪已按国家着色 | 加一个统计页（去过 N 国 N 城、世界覆盖率）即可 |
| **行程规划（多天、逐日安排）** | 已有简化版：旅行计划（站点串联 + 天数 + 排序 + 状态） | 后续可升级为逐日安排（每天挂景点、交通） |
| 交通记录（航班/火车号段） | 无 | 放进行程备注够用；要做就加"交通段"类型 |
| 清单（打包/待办 checklist） | 无 | 小功能，行程详情页加一个 checklist 块即可 |
| 协作编辑 | 登录 + 云同步已实现（每人一个账号，各自数据）；两人共编同一份待做 | 需要后端；同步后端已就绪（`api/`），加共享标记即可 |
| 公开分享页 | 无 | 需要托管；可以把导出 JSON 渲染成静态页发布 |
| 照片 EXIF 自动定位/时间线 | 无（本机相册按文件名排序） | 手动流程已覆盖；批量导入 EXIF 属于锦上添花 |
| 世界覆盖地图 + 自定义分类 | 无 | 分类标签可以加，优先级低 |

**结论：不建议直接引入 AdventureLog 本体**（Django 全栈 + 数据库 + 账号体系，融进这个纯前端项目等于重写），建议按上表逐个"抄功能"。两者定位互补：AdventureLog 适合要云同步、协作、分享的人；本项目定位两人用、零部署、数据随身（JSON 互通）。

## 同类开源项目参考

- [AdventureLog](https://github.com/Sevenlines/AdventureLog) — 旅行记录 + 行程规划，功能最全（Django 全栈）。
- [Dawarich](https://github.com/Freika/dawarich) — 自托管位置时间线（OwnTracks/Overland 数据），偏"足迹记录"而非"攻略"。
- [XHS-Downloader](https://github.com/JoeanAmier/XHS-Downloader) — 小红书笔记素材批量下载（本项目手动流程的主力工具）。

## 目录结构

```
scripts/    build-china-data.mjs（从 DataV.GeoAtlas 抓取中国省市数据，改动行政区划时重跑）
api/        Cloudflare Worker：注册/登录 + 每账号数据同步（KV），详见 DEPLOY.md
src/
  pages/    HomePage（地球仪）/ ChinaPage（中国市级地图）/ CountryPage /
            DestinationPage（城市页，含中国"还没去"城市支持）/ SpotPage /
            PlansPage + PlanDetailPage（旅行计划）/
            AdventuresPage + AdventureDetailPage（冒险记录）
  components/ SpotMap / MapPicker / DestinationForm / AdventureForm / MediaFolder（本机相册）/
              MediaCarousel（大框轮播）/ Gallery（照片+视频+灯箱）/ PhotoInput / LoginModal（登录）/
              XhsPostCard / CoordsField / Modal / SettingsMenu（顶栏导航 + 登录 + 数据菜单）
  lib/      maps.ts（坐标换算、外链）/ geo.ts（国家多边形与中文国名）/
            media.ts（视频识别、日期）/ mediaStore.ts（文件夹句柄 IndexedDB）/
            sync.ts（云同步客户端）/ store.ts
  data/     seed.json（示例数据）/ china-cities.json（370 个市级单位）/ china.ts
public/geo/ china-provinces.json（省界轮廓，中国页运行时加载）
public/xhs/     小红书笔记图片放这里（引用路径 /xhs/文件名）
public/sample/  示例图片和测试视频
```
