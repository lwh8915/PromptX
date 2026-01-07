from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .config import get_settings
from .database import connect_to_mongodb, close_mongodb_connection
from .routers import auth, categories, prompts

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时连接数据库
    await connect_to_mongodb()
    yield
    # 关闭时断开连接
    await close_mongodb_connection()


# 创建 FastAPI 应用
app = FastAPI(
    title=settings.app_name,
    description="提示词管理工具 API - 为 Web/Desktop/Mobile App 提供统一后端",
    version="1.0.0",
    lifespan=lifespan,
)

# 配置 CORS - 关键配置，确保 App 可以正常访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(categories.router, prefix="/api/categories", tags=["分类"])
app.include_router(prompts.router, prefix="/api/prompts", tags=["提示词"])


@app.get("/")
async def root():
    """健康检查端点"""
    return {
        "message": "Welcome to Prompt Manager API",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}
