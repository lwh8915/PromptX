# Role
你是一个精通现代 Web 开发和跨平台应用架构的全栈专家。你非常熟悉 Python 后端生态和现代前端工程化。

# Project Context
我要开发一个名为 "Prompt Manager" 的提示词管理工具。
**核心目标：** 目前开发 Web 版本，但架构必须为未来直接打包成 **Desktop App (使用 Tauri/Electron)** 和 **Mobile App (使用 Capacitor/React Native)** 做好准备。

# Design Standard
**⚠️ STRICT REQUIREMENT:** 请调用你的 **"UI UX Pro Max"** 能力/插件进行设计。
- 风格要求：极致的现代感、高审美、微交互丰富。
- 布局要求：响应式布局必须完美，因为未来要适配手机端 App。

# Tech Stack Choices (为了最大化可移植性)
1.  **Backend (API Server):**
    - Language: Python 3.10+
    - Framework: **FastAPI** (必须使用 FastAPI，因为它基于 OpenAPI 标准，方便生成客户端代码，且性能极佳)。
    - Database: MongoDB Atlas (Async driver: Motor).
    - Auth: JWT (JSON Web Tokens) - 无状态认证，App 和 Web 通用。

2.  **Frontend (Web Client):**
    - Framework: **React** + **Vite** (Vite 对 Tauri/Capacitor 支持最好)。
    - Language: TypeScript.
    - Router: React Router v6.
    - State Management: Zustand (轻量级，方便逻辑复用)。
    - Styling: Tailwind CSS (配合 UI UX Pro Max 规范).

# Detailed Features

## 1. Landing Page (官网 & 入口)
- 功能：展示产品价值、GitHub 链接、功能介绍。
- 交互：
  - 点击 "Get Started" -> 跳转登录页 (/login)。
  - 登录/注册页需设计为独立的精美卡片式页面。
  - **App 预备:** 登录成功后，Token 存储在 localStorage/SecureStore，为 App 持久化登录做准备。

## 2. Dashboard (主应用 - 类似 Notion/Obsidian 的布局)
**Layout:** 经典的 "Sidebar + Main Content" 布局。
- **Sidebar (侧边栏):**
  - **顶部:** "Smart Filter" 下拉菜单（预置分类：电商、小说、编程等）。
    - 逻辑：选择过滤后，下方的分类树只显示相关内容。支持用户输入自定义过滤词。
  - **中间:** 动态分类树（Category Tree）。
    - 支持无限级或至少两级嵌套（例如：AI -> Text -> Claude）。
    - 交互：点击分类，右侧刷新数据；支持右键菜单进行“重命名/删除”。
  - **底部:** 用户 Profile 设置。
- **Main Content (右侧内容区):**
  - **Top Bar:** 全局搜索框（Search Prompts...） + "New Prompt" 按钮。
  - **Content Area:**
    - **View Mode:** 响应式网格（Grid）展示卡片，手机端自动变为单列列表。
    - **Prompt Card:** 包含标题、标签(Tags)、部分内容预览。
    - **Action:** **[COPY] 按钮**（核心功能，点击一键复制内容并弹出 Toast 提示）、编辑、删除。

## 3. Database & Environment
- 数据库连接字符串将通过环境变量 `MONGODB_URL` 获取。
- 示例结构 (请在代码中使用 `python-dotenv` 读取):
  `MONGODB_URL=mongodb+srv://<user>:<password>@cluster0.85phrf6.mongodb.net/?appName=Cluster0`
- **Security Warning:** 代码中严禁硬编码密码。

# Development Steps for You
请一步步思考并输出代码：

1.  **Architecture:** 设计符合 "App Migration Ready" 的目录结构（前后端完全分离）。
2.  **Backend Core:** 编写 FastAPI 的 `main.py`，配置 CORS（允许跨域是 App 开发的关键），以及基于 Motor 的 MongoDB 连接配置。
3.  **Data Models:** 定义 Pydantic 模型（User, Category, Prompt）。
4.  **API Logic:** 实现 JWT 登录/注册接口，以及 Prompt/Category 的 CRUD 接口。
5.  **Frontend Setup:** 给出 React + Vite 的初始化结构，以及符合 "UI UX Pro Max" 的核心组件代码（特别是 Sidebar 和 PromptCard 的样式）。

Let's start! First, show me the **Project Directory Structure** and the **Backend Configuration** ensuring it's ready for future App migration.