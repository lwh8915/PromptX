from pydantic_settings import BaseSettings
from functools import lru_cache
import secrets


class Settings(BaseSettings):
    """应用配置类，从环境变量读取配置"""
    
    # MongoDB 配置
    mongodb_url: str
    mongodb_db_name: str = "prompt_manager"
    
    # JWT 配置（自动生成安全密钥，每次重启会变化，生产环境建议固定配置）
    jwt_secret_key: str = secrets.token_urlsafe(32)
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440  # 24 hours
    
    # 应用配置
    app_name: str = "Prompt Manager"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # SMTP 邮件配置
    smtp_host: str = "smtp.qq.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_name: str = "Prompt Manager"
    
    # LLM API 配置 (用于 AI 提示词修改功能)
    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = "gemini-3-pro"
    
    # CORS 配置 - 为 App 迁移准备，允许所有来源
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "tauri://localhost",  # Tauri Desktop App
        "capacitor://localhost",  # Capacitor Mobile App
    ]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()
