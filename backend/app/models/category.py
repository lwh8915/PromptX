from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class CategoryBase(BaseModel):
    """分类基础模型"""
    name: str = Field(..., min_length=1, max_length=100)
    parent_id: Optional[str] = None  # 支持嵌套分类
    icon: Optional[str] = None  # 分类图标
    order: int = 0  # 排序顺序


class CategoryCreate(CategoryBase):
    """创建分类请求模型"""
    pass


class CategoryUpdate(BaseModel):
    """更新分类请求模型"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    parent_id: Optional[str] = None
    icon: Optional[str] = None
    order: Optional[int] = None


class CategoryResponse(CategoryBase):
    """分类响应模型"""
    id: str
    user_id: str
    children: List["CategoryResponse"] = []  # 子分类列表
    prompt_count: int = 0  # 该分类下的提示词数量
    created_at: datetime
    
    class Config:
        from_attributes = True


class CategoryInDB(CategoryBase):
    """数据库中的分类模型"""
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# 解决循环引用
CategoryResponse.model_rebuild()
