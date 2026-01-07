from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class PromptVersionBase(BaseModel):
    """版本基础模型"""
    title: str
    content: str
    description: Optional[str] = None
    tags: List[str] = []
    change_note: Optional[str] = None  # 修改说明


class PromptVersionCreate(PromptVersionBase):
    """创建版本请求模型（内部使用）"""
    prompt_id: str
    version: int
    user_id: str


class PromptVersionResponse(PromptVersionBase):
    """版本响应模型"""
    id: str
    prompt_id: str
    version: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class PromptVersionListResponse(BaseModel):
    """版本列表响应模型"""
    items: List[PromptVersionResponse]
    total: int


class DiffLine(BaseModel):
    """Diff 行"""
    type: str  # "added", "removed", "unchanged"
    content: str
    line_number_old: Optional[int] = None
    line_number_new: Optional[int] = None


class PromptCompareResponse(BaseModel):
    """版本对比响应模型"""
    version_old: int
    version_new: int
    title_old: str
    title_new: str
    title_changed: bool
    content_diff: List[DiffLine]
    tags_added: List[str]
    tags_removed: List[str]
    description_old: Optional[str] = None
    description_new: Optional[str] = None
    description_changed: bool
