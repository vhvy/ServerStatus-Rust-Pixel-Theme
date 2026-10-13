# ServerStatus Rust Pixel Theme

[ServerStatus-Rust](https://github.com/zdz/ServerStatus-Rust) 的像素风主题，使用 Vue 3 CDN，无需前端构建。

A pixel-art theme for [ServerStatus-Rust](https://github.com/zdz/ServerStatus-Rust), using Vue 3 via CDN with no frontend build step.

## 中文

### 部署

准备 Docker 和 Docker Compose。将本项目的 `docker-compose.yml`、后端的 `config.toml` 和 `stats.json` 放在同一目录。首次部署没有 `stats.json` 时，可执行 `touch stats.json` 创建文件。

在该目录运行：

```sh
docker compose up -d
```

访问 `http://服务器地址:8081`。主题镜像为 `ghcr.io/vhvy/serverstatus-rust-pixel-theme:latest`，支持 amd64 和 arm64；Nginx 自动转发 API 请求至后端。

更新：

```sh
docker compose pull
docker compose up -d
```

### 配置

主题配置位于 `web/assets/js/config.js`：`title` 设置页面标题，`defaultTheme` 默认 `light`，`endpoint` 默认 `/json/stats.json`。

要在部署时自定义配置，将该文件复制为部署目录中的 `theme-config.js`，修改后取消 Compose 中可选 `volumes` 的注释，再运行 `docker compose up -d`。

## English

### Deploy

Install Docker and Docker Compose. Place this project's `docker-compose.yml` alongside your backend's `config.toml` and `stats.json`. For a fresh installation without `stats.json`, create it with `touch stats.json`.

Run in that directory:

```sh
docker compose up -d
```

Open `http://your-server:8081`. The theme image is `ghcr.io/vhvy/serverstatus-rust-pixel-theme:latest`, supporting amd64 and arm64. Nginx forwards API requests to the backend.

Update:

```sh
docker compose pull
docker compose up -d
```

### Configure

Theme settings are in `web/assets/js/config.js`: `title` sets the page title, `defaultTheme` defaults to `light`, and `endpoint` defaults to `/json/stats.json`.

To customize a deployment, copy that file to `theme-config.js` in your deployment directory, edit it, uncomment the optional `volumes` in Compose, and run `docker compose up -d` again.
