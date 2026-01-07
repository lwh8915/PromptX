from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class PromptBase(BaseModel):
    """提示词基础模型"""
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)
    category_id: Optional[str] = None
    tags: List[str] = []
    description: Optional[str] = None
    is_favorite: bool = False


class PromptCreate(PromptBase):
    """创建提示词请求模型"""
    pass


class PromptUpdate(BaseModel):
    """更新提示词请求模型"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = None
    category_id: Optional[str] = None
    tags: Optional[List[str]] = None
    description: Optional[str] = None
    is_favorite: Optional[bool] = None


class PromptResponse(PromptBase):
    """提示词响应模型"""
    id: str
    user_id: str
    category_name: Optional[str] = None  # 分类名称
    copy_count: int = 0  # 复制次数统计
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PromptInDB(PromptBase):
    """数据库中的提示词模型"""
    user_id: str
    copy_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PromptListResponse(BaseModel):
    """提示词列表响应模型"""
    items: List[PromptResponse]
    total: int
    page: int
    page_size: int
