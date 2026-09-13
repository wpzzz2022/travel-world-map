# 服务器部署架构（Docker）

本项目现阶段是**纯前端应用**：构建产物是静态文件，用户数据（旅行内容、照片链接、文件夹句柄）都存在**每个人自己的浏览器**里（localStorage + IndexedDB）。所以第一阶段的部署非常轻：一个 nginx 容器就够了；文件里也预留了第二阶段「数据同步后端」的位置。

## 阶段一：纯静态部署（当前可用）

```
                     ┌────────────────────────── 服务器 ──────────────────────────┐
                     │                                                            │
 浏览器（你俩） ────▶ │  Caddy :80/:443（可选，自动 HTTPS）                         │
      HTTPS          │        │                                                   │
                     │        ▼                                                   │
                     │  travel-map 容器（nginx:alpine）                            │
                     │    /            → index.html（不缓存）                      │
                     │    /assets/*    → 构建产物（永久缓存）                      │
                     │    /geo/*       → 中国省界 GeoJSON（按天缓存）              │
                     │                                                            │
                     │  数据：只在两人各自的浏览器 localStorage/IndexedDB 里        │
                     └────────────────────────────────────────────────────────────┘
```

- 资源占用：nginx:alpine 运行时约 10~20MB 内存，最低配 1 核 512MB 的小机器都绰绰有余。
- 服务器本身**无状态**：删容器重建不丢任何数据；备份 = 两人各自在页面里「导出全部数据 JSON」。

### 部署步骤

```bash
# 1. 服务器上装好 Docker（含 compose 插件）后，把项目传上去（git clone 或 scp）
# 2. 构建并启动
docker compose up -d --build
# 3. 打开 http://<服务器IP>:8080
```

日常更新：

```bash
git pull
docker compose up -d --build   # 重新构建镜像并原地替换，秒级中断
docker image prune -f          # 顺手清掉旧镜像（可选）
```

构建默认走 npmmirror（npm 依赖）+ DaoCloud 镜像源（node/nginx 基础镜像），国内开箱即用；能直连官方源的环境：

```bash
docker compose build --build-arg NPM_REGISTRY=https://registry.npmjs.org --build-arg DOCKER_REGISTRY=docker.io
```

### HTTPS：服务器上必须做

**「关联本机相册文件夹」功能依赖浏览器的 File System Access API，它只在安全上下文可用**——localhost 算安全，但 `http://服务器IP` 不算。所以一旦部署到服务器并想继续用本机相册，必须上 HTTPS。

最省事的方案是让 Caddy 自动申请续期证书（compose 文件里已备好注释块）：

```bash
# 1. 域名 A 记录指到服务器，比如 travel.example.com
# 2. 写一个 Caddyfile 放在项目根目录：
```

```Caddyfile
travel.example.com {
    reverse_proxy web:80
}
```

```bash
# 3. 打开 docker-compose.yml 里的 caddy 注释块，然后：
docker compose up -d
# 以后通过 https://travel.example.com 访问，80/443 由 Caddy 接管，
# compose 里 web 的 "8080:80" 端口映射可以删掉，只走反代。
```

如果服务器上已经有别的 nginx/caddy 在管 443，就不用这套：在宿主机的反代里加一条 `travel.example.com → 127.0.0.1:8080` 即可。

## 阶段二：数据同步（未来要「多设备/双人共享」时再加）

现在换设备靠「导出 JSON → 导入」。如果之后想要云同步，加一个**几十行的轻量后端**就够，不用上数据库：

```
                     ┌────────────────────────── 服务器 ────────────────────────┐
 浏览器 ── HTTPS ──▶ │  Caddy                                                   │
                     │    /        → travel-map（nginx 静态站）                  │
                     │    /api/*   → travel-map-api（Node 容器）                 │
                     │                 GET  /api/data?token=…   拉取最新 JSON    │
                     │                 PUT  /api/data           推送整份 JSON    │
                     │                 GET  /api/version     当前版本号/时间戳   │
                     │                 （数据就是一份 JSON，落盘在 volume）      │
                     │  volume: api-data → /data/travel.json                    │
                     └──────────────────────────────────────────────────────────┘
```

设计要点（等实现时照着做）：

- **整文档同步**：前端数据模型本来就是一份 `TravelData` JSON，直接 PUT 整份、带 `updatedAt` 做乐观锁（版本号不一致时提示先拉取），不用做字段级合并。
- **鉴权**：两个人的私人站点，一个共享 `SYNC_TOKEN` 环境变量 + 请求头校验即可，不需要账号系统。
- **备份**：`api-data` volume 就是全部状态，`docker run --rm -v api-data:/data -v $PWD:/backup alpine cp /data/travel.json /backup/` 一行备份。
- compose 文件里已经留好注释掉的 `api` 服务块，实现后取消注释 `docker compose up -d` 即可。
- 本机相册的**文件夹句柄**（IndexedDB）始终留在各人浏览器里，不进后端——照片文件不上服务器，只有文字数据和手动小图会同步。

## 相册存储怎么选（网盘联动 / MinIO / 本机相册）

照片放在哪里，按需求从上往下选，**能用上面的方案就不要往下加组件**：

| 方案 | 适用场景 | 代价 |
| --- | --- | --- |
| **本机相册（已实现）** | 照片在自己电脑里，按景点/日期整理好目录 | 零成本；换电脑要重新关联 |
| **网盘同步目录（推荐，零开发）** | 照片在百度网盘/夸克里，想多设备可用 | 用网盘 PC 客户端的「同步空间」把云盘相册同步到本地一个目录，应用里关联那个目录即可——等于给本机相册接上了网盘，一行代码不用写 |
| **百度网盘 API 联动** | 真要让应用直接读写网盘 | 门槛较高：开放平台应用审核（个人权限受限，[开放平台](https://pan.baidu.com/union/doc/)）、备案域名做 OAuth 回调、后端保管 token 并代理图片流（防盗链）；相册深度能力需设备绑定，分享类 API 不对个人开放 |
| **MinIO / 云 OSS** | 想要「照片集中存服务器、两人共享同一批图、任何设备打开都有」 | 需要阶段二后端 + 服务器磁盘带宽 + 备份；MinIO 自托管数据自己握，云 OSS（阿里云 OSS 等）省运维但要花钱 |

夸克网盘目前**没有官方的个人开发者 API**（open.quark.cn 是小程序平台），社区方案靠 Cookie 抓包，有账号风控风险，不建议接入项目。

**MinIO 上手姿势**（等真有共享图库需求时）：

```
compose 增加一个 minio 服务（数据落 volume，加入备份）
前端上传/读取都找 api 拿「预签名 URL」直传直读 MinIO，不占后端带宽
localStorage 里只存对象 key（如 spots/<id>/DSC_1234.jpg），照片本体不进 localStorage
缩略图：后端启动时用 sharp 生成一份小图，或列表先出原图压缩帧
```

对两个人的使用量，先做阶段二的 JSON 同步 + 网盘同步目录，基本不会想念 MinIO。

## 公网托管：Vercel / Netlify / Cloudflare Pages 怎么选

本项目是纯静态站（hash 路由、无服务端），三家都能直接托管，HTTPS 自动配好（本机相册功能可用）。选型要点：

| | Cloudflare Pages（推荐） | Vercel | Netlify |
| --- | --- | --- | --- |
| 免费额度 | 流量/请数量基本不限 | 100GB/月 | 100GB/月 |
| 不用 GitHub 的部署方式 | 拖拽 dist 文件夹，或 `npx wrangler pages deploy dist` | `npx vercel --prod` | `npx netlify deploy --prod --dir=dist` |
| 大陆访问（默认域名） | `pages.dev` 常被污染 | `vercel.app` 常被污染 | `netlify.app` 常被污染 |
| 大陆访问（绑定自定义域名后） | 三者里相对最稳 | 一般 | 一般 |
| 未来阶段二（数据同步） | 同项目加 Workers + KV/D1，免费额度大 | Serverless Functions | Functions |

**推荐 Cloudflare Pages**，理由：① 命令行一条 `npx wrangler pages deploy dist` 直接从本机上传，不需要 GitHub（国内推 GitHub 仓库很折磨）；② 免费额度最宽松；③ 以后做数据同步后端，Workers/KV/D1 和 Pages 在同一个账号里，几行代码的事。

### Cloudflare Pages 部署步骤

```bash
# 0. 注册 cloudflare.com 账号（邮箱即可）
# 1. 本地构建
npm run build
# 2. 一条命令上传（首次会让你浏览器登录授权）
npx wrangler pages deploy dist --project-name=travel-map
# 3. 得到 https://travel-map.pages.dev —— 但大陆访问建议做第 4 步
# 4. （强烈建议）绑定自己的域名：Pages 项目 → Custom domains → 添加
#    域名在任意注册商买，DNS 托管到 Cloudflare 即可，证书自动配
```

以后更新就是重新 `npm run build` + 再跑一次第 2 步。

### 大陆访问的现实预期

三个平台的免费节点都不在大陆，绑了自定义域名后大陆打开大约 2~5 秒首屏（走 Cloudflare/自选线路），日常可用但谈不上快。如果以后追求大陆秒开，路线是：国内对象存储 + CDN（如阿里云 OSS，需域名备案，一年几十块）——好在这个应用对服务器零依赖，随时可以把托管从 Cloudflare 搬回国内，数据不受影响。

### 两个迁移提醒

1. **数据在浏览器里按域名隔离**：部署到新域名后，浏览器里是一片空白（全新 origin）。在旧的 localhost:5173 页面点「数据 → 导出全部数据」，再到新域名页面「导入」即可完成迁移。
2. 网盘/本机相册的**文件夹句柄也按域名记录**，换域名后到冒险/景点详情页重新关联一次文件夹（点一次授权）。

## 常见问题

| 问题 | 处理 |
| --- | --- |
| 端口 8080 被占 | 改 compose 里 `"8080:80"` 左边的端口 |
| 构建时 npm 超时 | 已默认走 npmmirror；或换 `--build-arg NPM_REGISTRY=…` |
| 想看运行日志 | `docker logs -f travel-map` |
| 容器健康检查失败 | `docker exec travel-map wget -qO- http://127.0.0.1/` 看返回 |
| 国内服务器拉不动 nginx/node 镜像 | 配置 Docker 镜像加速器，或先在本地构建好 `docker save` 传上去 `docker load` |
