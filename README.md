# TikTok 视频播放量批量查询工具

一个可通过网址访问的工具：用户上传指定格式的 Excel 视频列表后，系统自动批量查询该批视频“当次”的最新播放量，在线查看明细与汇总，并支持结果下载。

详细任务书见 [TODO.md](./TODO.md)。

## 项目用途

招聘方会提供一份包含 264 条 TikTok 视频记录的 Excel（字段：达人昵称、达人ID、视频信息、视频ID、发布时间、VV）。本项目需要：

1. 接收同结构的 `.xlsx` 文件上传（不依赖固定文件名、行顺序或写死的视频列表）。
2. 对文件中的每条视频发起实时查询，获取“本次”的最新播放量（不能回显原表 VV 或上次结果）。
3. 在 30 分钟内完成整批（264 条）的查询、展示与可导出结果的生成。
4. 为每条记录准确标注查询结果：
   - 成功取得播放量；
   - 已确认下架／删除／私密等不可用状态；
   - 抓取失败／原因未确认。
5. 在页面上展示本批次的汇总信息（输入总数、成功数、不可用数、失败数、成功播放量总和、起止时间与耗时）。
6. 支持将本批次结果导出为 CSV 或 `.xlsx`，且导出内容与页面展示的明细完全一致，达人ID／视频ID（19 位文本）需完整保留，不丢失精度、不被截断或转换为科学计数法。

完整的验收口径、异常分类标准和交付条件，以 [TODO.md](./TODO.md) 为准。

## 技术栈

- **前端**：React 19 + Vite（`frontend/`）
- **后端**：Spring Boot 4 + Kotlin（`backend/`）
- **部署**：自建服务器，相关脚本/配置见 `deploy/`

## 目录结构

```
.
├── TODO.md        # 任务书：需求、验收标准与交付条件
├── frontend/       # React + Vite 前端，提供上传、查询进度、明细与汇总展示、下载入口
├── backend/        # Spring Boot (Kotlin) 后端，负责 Excel 解析、批量查询调度与结果导出
└── deploy/         # 部署相关配置
```

## 开发

### 前端

```bash
cd frontend
npm install
npm run dev
```

### 后端

```bash
cd backend
./gradlew bootRun
```

> 当前仓库为初始化脚手架，尚未实现具体的查询、展示与导出逻辑。

## 生产抓取代理

后端通过 `YTDLP_PROXY` 环境变量配置 yt-dlp 代理。部署时，在服务器 `~/tikviews-release/.env` 中设置：

```dotenv
YTDLP_PROXY=http://<代理容器在后端网络中可访问的地址>:<端口>
```

若代理容器不在生产 Compose 创建的网络中，需先将其接入同一 Docker 网络，或使用服务器可从后端容器访问的地址。仅启动代理容器不会自动让后端使用它。后端重新创建后，抓取测试日志应显示“使用代理”。

## 生产部署

推送到 `prod` 分支即触发 `.github/workflows/deploy-prod.yml`：CI 构建前后端产物后，先打包上传到阿里云 OSS 并签发一个 1 小时有效的临时下载链接，再通过 SSH 让服务器拉取这个链接完成部署——这样 GitHub Actions Runner 到服务器之间只需要传一个很短的 URL，构建产物本身走 OSS 的网络，避免了直接用 SSH 长途传输大文件时的不稳定。部署完成后（无论成功还是失败）CI 会清理掉本次上传的 OSS 对象。

需要在仓库 Secrets 中配置：

- `SERVER_HOST` / `SERVER_USER` / `SERVER_SSH_KEY` / `SERVER_SSH_PORT`（可选，默认 22）：部署服务器的 SSH 信息。
- `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`：阿里云 OSS 的 AccessKey，建议使用仅有该 Bucket 读写权限的子账号。
- `OSS_BUCKET`：用于中转部署产物的 Bucket 名称。
- `OSS_ENDPOINT`：Bucket 所在地域的 OSS 外网 Endpoint（例如 `oss-cn-hangzhou.aliyuncs.com`），需要能从 GitHub Actions 和部署服务器两侧访问。
- `SERVERCHAN_SENDKEY`（可选）：配置后部署成功/失败会通过 Server 酱推送微信通知。

建议额外在 OSS 控制台为 `deploy/tikviews/` 这个前缀配置一条 1~2 天后自动删除的生命周期规则，作为工作流清理步骤失败时的兜底。

## 登录密码

访问前端需要输入 4 位数字密码才能进入项目，密码通过后端 `APP_PASSWORD` 环境变量配置，默认值为 `1122`。部署时可在 `~/tikviews-release/.env` 中设置：

```dotenv
APP_PASSWORD=<4 位数字密码>
```
