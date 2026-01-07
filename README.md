<div align="center">
  <img src="frontend/public/logo.png" alt="PromptX Logo" width="272" height="120" />
  <h1>🚀 Prompt Manager (PromptX)</h1>
  
  <p align="center">
    <strong>✨ 极致现代感 · 智能版本管理 · 跨平台同步</strong>
  </p>

  <p align="center">
    <a href="#核心功能">核心功能</a> •
    <a href="#快速开始">快速开始</a> •
    <a href="#docker-部署">Docker 部署</a> •
    <a href="#技术栈">技术栈</a>
  </p>

  ![License](https://img.shields.io/badge/license-MIT-blue.svg)
  ![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
  ![React](https://img.shields.io/badge/react-18-blue.svg)
  ![Docker](https://img.shields.io/badge/docker-ready-green.svg)
</div>

<br />

> **PromptX** 不仅仅是一个提示词存储工具，它是专为 AI 时代打造的生产力神器。采用 **UI/UX Pro Max** 设计标准，结合强大的 **版本管理** 和 **智能分类**，让你的 AI 工作流效率提升 10x。

## 项目架构

```
PromptX/
├── backend/          # FastAPI 后端
│   ├── app/
│   │   ├── main.py       # 应用入口
│   │   ├── config.py     # 配置管理
│   │   ├── database.py   # MongoDB 连接
│   │   ├── models/       # Pydantic 模型
│   │   ├── routers/      # API 路由
│   │   └── services/     # 业务逻辑（含邮件服务）
│   └── requirements.txt
│
└── frontend/         # React 前端
    ├── src/
    │   ├── pages/        # 页面组件
    │   ├── components/   # 通用组件
    │   ├── stores/       # Zustand 状态
    │   ├── api/          # API 客户端
    │   └── types/        # TypeScript 类型
    └── package.json
```

## 快速开始

### 1. 后端启动

```bash
cd backend

# 创建 conda 虚拟环境
conda create -n promptx python=3.10 -y
conda activate promptx

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的 MongoDB 连接串、SMTP 配置

# 启动服务
uvicorn app.main:app --reload
```

API 文档: http://localhost:8000/docs

### 2. 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build
```

访问: http://localhost:5173

## 技术栈

| 层级 | 技术 |
|------|------|
| **Backend** | Python 3.10+ / FastAPI / MongoDB (Motor) / JWT / SMTP |
| **Frontend** | React / TypeScript / Vite / Tailwind CSS / Zustand |

## 核心功能

- ✅ JWT 用户认证（登录/注册）
- ✅ **用户名或邮箱登录**
- ✅ **安全问题验证** - 注册时设置，用于找回密码
- ✅ **忘记密码** - 支持邮箱验证码和安全问题两种方式
- ✅ 提示词 CRUD（创建/读取/更新/删除）
- ✅ 智能分类（支持嵌套/树形结构、**展开/收起**）
- ✅ 一键复制（核心功能）
- ✅ 全局搜索
- ✅ **高级标签系统**（支持多选筛选、下拉快捷选择）
- ✅ **智能分页**（大数据量自动分页导航）
- ✅ **数据管理**（提供批量测试数据生成与清理脚本）
- ✅ 收藏功能
- ✅ **版本管理**（自动保存、差异对比、一键恢复）
- ✅ 卡片/列表视图切换
- ✅ 提示词阅读弹窗
- ✅ 响应式布局（桌面/移动端适配）

## 邮件配置（可选）

用于密码重置功能，支持 QQ 邮箱、163 邮箱等 SMTP 服务。

### QQ 邮箱配置步骤：
1. 登录 [QQ邮箱](https://mail.qq.com)
2. 设置 → 账户 → POP3/SMTP服务 → 开启
3. 发送短信验证后获取 **16位授权码**
4. 在 `.env` 中配置：
```bash
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=你的QQ邮箱
SMTP_PASSWORD=16位授权码
```

## 设计规范

采用 **UI UX Pro Max** 设计标准：
- 深色玻璃态主题
- 渐变配色系统
- 丰富微交互动画
- 完美响应式布局

## Docker 部署

### 方式一：直接运行（推荐）

无需下载源码，只需下载 `docker-compose.hub.yml` 和配置文件。

1. 下载配置文件：
   - [docker-compose.hub.yml](./docker-compose.hub.yml)
   - [.env.docker.example](./.env.docker.example) (重命名为 `.env`)

2. 编辑 `.env` 文件，填入你的 MongoDB 连接串。

3. 启动（指定配置文件）：
```bash
docker-compose -f docker-compose.hub.yml up -d
```

> **🔥 自动热更新已启用**：
> 默认集成了 `Watchtower` 服务，它会每 **60秒** 检查一次 Docker Hub。
> 当你推送新镜像时，部署服务器会自动拉取并重启服务，无需人工通过。

### 方式二：源码构建

如果你想自己修改代码并构建：

```bash
# 1. 复制环境变量配置
cp .env.docker.example .env

# 2. 编辑 .env 填入你的 MongoDB 连接串

# 3. 构建并启动
docker-compose up -d --build
```

访问: http://localhost

### 停止服务

```bash
docker-compose down
```

### 更新部署

```bash
git pull
docker-compose up -d --build
```

## App 迁移准备

本项目架构已为未来迁移做好准备：
- **Desktop App**: Tauri (CORS 已配置 `tauri://localhost`)
- **Mobile App**: Capacitor (CORS 已配置 `capacitor://localhost`)

## License

MIT
