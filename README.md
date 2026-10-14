# ServerStatus Rust Pixel Theme

[ServerStatus-Rust](https://github.com/zdz/ServerStatus-Rust) 的像素风主题，使用 Vite 8、Vue 3 单文件组件和 TypeScript。Docker 构建时自动测试并打包，运行时只需要 Nginx。

A pixel-art theme for [ServerStatus-Rust](https://github.com/zdz/ServerStatus-Rust), built with Vite 8, Vue 3 SFCs, and TypeScript. Docker builds the frontend; the runtime image only needs Nginx.

## 中文

### 部署

将本项目的 `docker-compose.yml`、后端的 `config.toml` 和 `stats.json` 放在同一目录。首次部署没有 `stats.json` 时，可执行 `touch stats.json`。

```sh
docker compose up -d
```

访问 `http://服务器地址:8081`。主题镜像为 `ghcr.io/vhvy/serverstatus-rust-pixel-theme:latest`，支持 amd64 和 arm64。Nginx 自动转发 API 请求至后端。

更新镜像：

```sh
docker compose pull
docker compose up -d
```

从源码构建镜像：

```sh
docker build -t serverstatus-rust-pixel-theme .
```

Docker 构建阶段直接使用官方 `ghcr.io/pnpm/pnpm:12.10.1` 镜像，由 pnpm 安装 Node 24，按 `pnpm-lock.yaml` 安装依赖，运行测试、类型检查和 Vite 打包，只将 `dist/` 复制到 Nginx 运行镜像。现有发布工作流继续通过这个 Dockerfile 构建多平台镜像。

### 运行时配置

配置位于 `web/public/theme-config.json`，构建后位于 `web/dist/theme-config.json`。页面启动时通过 `/theme-config.json` 读取，不会编译进 JS。Nginx 和客户端均禁用配置缓存。

将该文件复制为部署目录中的 `theme-config.json`，修改后取消 Compose 中可选挂载的注释：

```yaml
volumes:
  - ./theme-config.json:/opt/ServerStatus/web/theme-config.json:ro
```

运行 `docker compose up -d` 应用挂载。直接编辑挂载文件后，刷新页面即可生效，无需重建镜像。若用编辑器或脚本以原子替换方式更换整个文件，请重新创建容器以重新绑定文件。

挂载前请先创建有效 JSON 文件，不支持注释。配置加载失败或格式不合法时，页面会显示错误。

| 字段              | 默认值             | 用途                                                 |
| ----------------- | ------------------ | ---------------------------------------------------- |
| `title`           | `Pixel Status`     | 页面标题                                             |
| `defaultTheme`    | `light`            | 默认主题 `light` / `dark`，本地保存的主题优先        |
| `endpoint`        | `/json/stats.json` | 后端数据接口                                         |
| `refreshInterval` | `5000`             | 轮询间隔，毫秒，最少 1000                            |
| `staleAfter`      | `30`               | 报告过期阈值，秒，最少 10                            |
| `requestTimeout`  | `8000`             | 数据请求超时，毫秒，最少 1000                        |
| `historyLimit`    | `60`               | 每个节点的会话样本数，范围 2–600                     |
| `nodeArt`         | `{}`               | 按节点名称指定 `compute`、`storage` 或 `router` 插画 |

### 开发

建议使用 Node 24，pnpm 版本由 `web/package.json` 的 `packageManager` 固定。项目由 `pnpm create vite --template vue-ts` 官方模板初始化，前端文件全部位于 `web/`。请先安装 pnpm，版本由 `packageManager` 固定。

```sh
cd web
pnpm install --frozen-lockfile
pnpm dev
```

开发服务器默认把 `/json` 转发至 `http://127.0.0.1:8080`，可指定其他后端：

```sh
PIXEL_STATUS_BACKEND=https://status.example.com pnpm dev
```

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm preview
pnpm format:check
```

`pnpm build` 包含类型检查，输出到 `web/dist/`。`pnpm preview` 仅预览静态产物，不提供开发服务器的后端代理；生产环境由 Nginx 转发 API。

| 路径                           | 职责                                  |
| ------------------------------ | ------------------------------------- |
| `web/src/main.ts`              | 加载配置并挂载应用                    |
| `web/src/App.vue`              | 页面组合、节点选择状态                |
| `web/src/components/`          | 页头、汇总、列表、详情抽屉、About     |
| `web/src/components/panels/`   | 各仪表面板                            |
| `web/src/composables/`         | 轮询、主题、弹层和图表生命周期        |
| `web/src/lib/`                 | 数据转换、Canvas 绘图、配置读取及测试 |
| `web/src/types.ts`             | 配置、接口、节点和历史采样类型        |
| `web/src/assets/`              | 由 Vite 打包的图片、样式和字体        |
| `web/public/theme-config.json` | 部署时可替换的运行时配置              |

## English

### Deploy

Place `docker-compose.yml`, the backend's `config.toml`, and `stats.json` in the same directory. Create an empty `stats.json` with `touch stats.json` for a fresh deployment.

```sh
docker compose up -d
```

Open `http://your-server:8081`. The image is `ghcr.io/vhvy/serverstatus-rust-pixel-theme:latest`, supporting amd64 and arm64. Nginx forwards API requests to the backend.

```sh
docker compose pull
docker compose up -d
```

Build from source with `docker build -t serverstatus-rust-pixel-theme .`. The multi-stage Dockerfile starts from the official `ghcr.io/pnpm/pnpm:12.10.1` image, installs Node 24 through pnpm, uses a frozen lockfile, runs tests and the production build including type checks, and copies only `dist/` into the Nginx image.

### Runtime configuration

Configuration lives in `web/public/theme-config.json` and is copied to `web/dist/theme-config.json`. The application fetches `/theme-config.json` at startup without caching; the file is never imported into the JavaScript bundle.

Copy it to `theme-config.json` alongside your Compose file and enable the optional mount:

```yaml
volumes:
  - ./theme-config.json:/opt/ServerStatus/web/theme-config.json:ro
```

Run `docker compose up -d` to apply the mount. Edit the mounted file and refresh the page to apply changes without rebuilding. If an editor or script replaces the file atomically, recreate the container to rebind it. Create a valid JSON file before mounting; comments are not supported. Configuration failures are shown on the page.

Settings include `title`, `defaultTheme` (`light` / `dark`), `endpoint` (`/json/stats.json`), `refreshInterval` (milliseconds), `staleAfter` (seconds), `requestTimeout` (milliseconds), `historyLimit` (2–600 samples), and `nodeArt` (node names mapped to `compute`, `storage`, or `router`). A saved browser theme overrides `defaultTheme`.

### Develop

Use Node 24 and the pnpm version pinned in `web/package.json`. The project was initialized with the official `pnpm create vite --template vue-ts` template.

```sh
cd web
pnpm install --frozen-lockfile
pnpm dev
```

The development server proxies `/json` to `http://127.0.0.1:8080`; override it with `PIXEL_STATUS_BACKEND=https://status.example.com pnpm dev`.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm preview
pnpm format:check
```

`pnpm build` checks types and generates `web/dist/`. `pnpm preview` serves static output without the development API proxy. Production API forwarding is provided by Nginx.

All frontend source, dependencies, Vite configuration, and runtime configuration live in `web/`. Vue SFCs live in `web/src/components/`, composables in `web/src/composables/`, and data conversion, drawing, configuration loading, and tests in `web/src/lib/`. Shared types live in `web/src/types.ts`, bundled assets in `web/src/assets/`, and runtime settings in `web/public/theme-config.json`.

## CI / Docker

Pull requests run frontend formatting, tests, type checks, and a production build. Pushes to `master`, version tags (`v*`), and manual runs publish amd64/arm64 images only after those checks pass. `latest` follows `master`; release tags receive full and minor version image tags. CI uses `pnpm/setup` with Node 24 and `web/pnpm-lock.yaml`, without Corepack.

The Dockerfile follows the [official pnpm Docker recipe](https://pnpm.io/docker). BuildKit caches dependency downloads separately from pnpm's managed Node.js runtime. Only production files enter the Nginx runtime image.

The three illustrations are transparent WebP images resized with nearest-neighbor sampling to 640px wide, then encoded losslessly. This retains pixel edges and supports the current display sizes on high-density screens.
