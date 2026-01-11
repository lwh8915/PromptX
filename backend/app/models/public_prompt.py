from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime


class PublicPromptBase(BaseModel):
    """公共提示词基础模型"""
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)
    description: Optional[str] = None
    tags: List[str] = []
    category: str = Field(default="其他", description="分类：写作、编程、营销、翻译、其他")


class PublicPromptCreate(PublicPromptBase):
    """创建公共提示词请求模型"""
    pass


class PublicPromptSubmit(BaseModel):
    """从个人库上传到公共库的请求模型"""
    prompt_id: str  # 源提示词 ID


class PublicPromptResponse(PublicPromptBase):
    """公共提示词响应模型"""
    id: str
    author_id: str
    author_name: str
    source_prompt_id: Optional[str] = None
    status: Literal["pending", "approved", "rejected"] = "pending"
    review_note: Optional[str] = None
    download_count: int = 0
    like_count: int = 0
    is_liked: bool = False
    avg_rating: float = 0
    review_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PublicPromptListResponse(BaseModel):
    """公共提示词列表响应模型"""
    items: List[PublicPromptResponse]
    total: int
    page: int
    page_size: int


class PublicPromptReview(BaseModel):
    """审核请求模型"""
    note: Optional[str] = None  # 拒绝原因（可选）
