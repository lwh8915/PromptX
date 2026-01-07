# Prompt Manager

> 🚀 AI 提示词管理工具 - 一键复制、智能分类、跨平台同步

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
- ✅ 智能分类（支持嵌套/树形结构）
- ✅ 一键复制（核心功能）
- ✅ 全局搜索
- ✅ 标签系统
- ✅ 收藏功能
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

### 一键启动

```bash
# 1. 复制环境变量配置
cp .env.docker.example .env

# 2. 编辑 .env 填入你的 MongoDB 连接串（SMTP 可选）

# 3. 构建并启动
docker-compose up -d --build

# 4. 查看日志
docker-compose logs -f
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
