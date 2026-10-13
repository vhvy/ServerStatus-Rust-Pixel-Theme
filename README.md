# Pixel Status

A full-width, English-first pixel-art theme for [ServerStatus-Rust](https://github.com/zdz/ServerStatus-Rust). Vue 3 is loaded from a pinned CDN production build. No package installation or build step is required.

## Configuration

Edit `web/assets/js/config.js`:

```js
window.PIXEL_STATUS_CONFIG = {
  title: "vhvy's Server Status",
  defaultTheme: 'light',
  endpoint: '/json/stats.json',
  refreshInterval: 5000,
  staleAfter: 30,
  requestTimeout: 8000,
  historyLimit: 60,
  nodeArt: {},
};
```

`title` controls the large page heading and browser tab title. `defaultTheme` controls the initial theme (`light` by default); a previously saved manual theme choice takes precedence. Refresh/timeout intervals are milliseconds; `staleAfter` is seconds.

For a same-origin backend, set `endpoint` to `/json/stats.json`. A separate API domain must allow the frontend through CORS. Requests send no credentials.

Artwork is selected by node name: `router/switch/gateway` uses the switch, `nas/synology/storage` uses the NAS, and other names use the compute box. Override with backend node identifiers:

```js
nodeArt: {
  'aliyun-sh': 'compute',
  'homelab-synology': 'storage',
  'homelab-corerouter': 'router'
}
```

Illustrations are decorative, not detected hardware models.

## Preview

Serve `web/` with any static HTTP server. For a standalone preview without the backend, temporarily set `endpoint` to `https://status.vhvy.me/json/stats.json`. For example, run from the repository root:

```sh
python -m http.server 4173 --bind 127.0.0.1 --directory web
```

Open http://127.0.0.1:4173/. Opening the HTML with `file://` may encounter browser CORS restrictions.

## Deploy

The Docker image includes all of `web/` and the Nginx configuration. For a manual static deployment, copy the contents of `web/` into a static web root.

Vue **3.5.44** is pinned in `web/index.html`. To serve the library locally, download that same production file and replace its script URL. A library-loading failure shows a startup message while uncompiled templates remain hidden.

### GitHub Actions 镜像发布

将主题提交到 [vhvy/ServerStatus-Rust-Pixel-Theme](https://github.com/vhvy/ServerStatus-Rust-Pixel-Theme)，`.github/workflows/docker.yml` 会：

- 仅 `master` 分支 push 时自动触发，发布 `latest`、`master` 与 `sha-*` 标签。
- 支持 `workflow_dispatch` 手动运行；选择 `master` 时更新 `latest`，选择其他分支时只发布该分支与 SHA 标签。
- PR 和 tag push 不触发此发布流程。
- 发布 `linux/amd64` 和 `linux/arm64` 镜像到固定地址 `ghcr.io/vhvy/serverstatus-rust-pixel-theme`。

使用 GitHub 自带的 `GITHUB_TOKEN`，无需设置 Docker Hub 密码。仓库/组织需允许 Actions 写入 Packages。首次发布后，如果希望服务器匿名拉取镜像，请在 GitHub Package 设置中将镜像可见性设为 Public；私有镜像需要先在服务器登录 GHCR。配置参考 [GitHub 官方发布文档](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)。

Workflow 直接构建并发布镜像，不执行额外的 JS、Compose、Nginx 或打包文件检查。镜像地址和标签会显示在 Actions 运行摘要中。本地修改尚未提交或推送，不会自动触发发布。

### 一个 Compose 启动后端与主题

先等待 workflow 成功发布镜像。在服务器准备下面这些文件，不需要克隆前端源码或额外挂载 Nginx 配置：

```text
deployment/
  docker-compose.yml
  config.toml
  stats.json
```

1. 复制根目录的 `docker-compose.yml`，主题镜像已写死为 `ghcr.io/vhvy/serverstatus-rust-pixel-theme:latest`，网页端口为 `8081`，无需 `.env`。
2. 放入现有后端的 `config.toml` 和 `stats.json`。首次部署没有 `stats.json` 时，在 Linux 服务器运行 `printf '{}' > stats.json` 创建普通文件。配置中的 `http_addr` 应为 `0.0.0.0:8080`，`grpc_addr` 为 `0.0.0.0:9394`。请在启动前确认这两个挂载文件存在。
3. 在上述部署目录执行：

```sh
docker compose up -d
```

浏览器打开 `http://服务器地址:8081/`。后端保留原有 `8080`、`9394` 端口和配置/数据/时区挂载。网页默认请求同域 `/json/stats.json`，由 Nginx 转发到后端。

更新镜像并重建容器：

```sh
docker compose pull
docker compose up -d
```

修改网页标题等设置时，把 `web/assets/js/config.js` 复制成部署目录中的 `theme-config.js`，编辑后取消 Compose 中可选 `volumes` 的注释。该配置文件会覆盖镜像内的配置，无需重新构建。只需要修改标题时，请保留同域 API 地址 `/json/stats.json`。

若需要本地构建，运行 `docker build -t ghcr.io/vhvy/serverstatus-rust-pixel-theme:latest .`，再使用同一个 Compose 启动。

### Nginx 路由

The Rust binary embeds its original frontend at compile time. A runtime `/web` volume does not replace those embedded files. A separate Nginx container serves the theme from `/opt/ServerStatus/web`. Existing files are served locally; every other path falls back to `@proxy` and is forwarded to the backend with the original URI and query string.

`deploy/nginx.conf` forwards Host, real IP, forwarding headers and upgrade headers as in the supplied configuration. Inside Compose, the upstream is `http://stat_server:8080` because the backend runs in another container. For Nginx running directly on the host, change it to `http://127.0.0.1:8080` and set the theme root to your actual directory. Add your domain/SSL settings to the server block as needed.

The two services share Compose's default network. Bind paths are relative to the root Compose file, with no dependency on a sibling checkout. See the [Compose service reference](https://docs.docker.com/reference/compose-file/services/). Docker is not installed in the current development environment; local container builds and startup have not been run.

Alternatively, copy the frontend files into the backend's `web/` directory before rebuilding its Rust binary. Retain `web/jinja/` for backend detail/map/client-init routes.

## Code layout

```text
server-status-rust-theme/
  README.md
  Dockerfile
  .dockerignore
  .gitignore
  docker-compose.yml
  .github/
    workflows/
      docker.yml
  web/
    index.html
    favicon.svg
    assets/
      js/
        config.js
        app.js
        core.js
        charts.js
      css/
        style.css
      fonts/
        DepartureMono-Regular.woff2
        LICENSE
      compute.png
      storage.png
      router.png
  deploy/
    nginx.conf
```

`web/index.html` contains the Vue template. `app.js` handles state/polling; `core.js` handles pure data rules and session samples; `charts.js` draws Canvas charts. CSS is grouped by page region and responsive layout. Configuration lives in `web/assets/js/config.js`.

Names and notes use escaped Vue text interpolation. Keyed lists preserve node elements/focus during polling. Keyboard shortcuts: `/` focuses search, Escape clears it, and arrow keys switch between focused node cards.

## Data rules

- A node is online if IPv4 or IPv6 is up. Offline nodes are excluded from fleet resource totals.
- Fleet CPU averages available reports. Fleet memory is capacity-weighted.
- Memory/swap arrive as KiB. Disk arrives as MiB or MB according to `si`; network rates are bytes/second.
- Month traffic is the nonnegative difference between total traffic and the backend's monthly baseline. Without vnStat, counters may reset after a host restart.
- CPU/network graphs retain real samples from the current page session, up to `historyLimit`. Missing intervals break curves; removed nodes discard their samples. Reloading clears history.
- Public API data does not expose per-core CPU, GPU, power or temperature, so these are not fabricated.
- Source timestamps are compared with the viewer's clock. A delay may indicate old data or a clock mismatch. Last-report values stay visible during errors. Times use the viewer's local timezone.

## Assets

[Departure Mono](https://departuremono.com/) by Helena Zhang is licensed under SIL OFL 1.1; the included license is `web/assets/fonts/LICENSE`.

The three PNG illustrations were generated with ImageGen: an isometric gold compute box, blue-gray four-bay NAS and purple-gray eight-port switch, using stepped outlines, pixel blocks, limited palettes, metal dithering, LEDs and transparent backgrounds, without text or logos.
