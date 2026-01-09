from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


# 预设的安全问题列表
SECURITY_QUESTIONS = [
    "您的小学校名是什么？",
    "您母亲的姓名是什么？",
    "您的第一只宠物叫什么名字？",
    "您最喜欢的电影是什么？",
    "您出生的城市是哪里？",
    "您最好的朋友叫什么名字？",
]


class UserBase(BaseModel):
    """用户基础模型"""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)


class UserCreate(UserBase):
    """用户注册请求模型"""
    password: str
    security_question: str = Field(..., description="安全问题")
    security_answer: str = Field(..., min_length=1, description="安全问题答案")


class UserLogin(BaseModel):
    """用户登录请求模型 - 支持用户名或邮箱"""
    identifier: str = Field(..., description="用户名或邮箱")
    password: str


class UserResponse(UserBase):
    """用户响应模型"""
    id: str
    avatar: Optional[str] = None
    is_admin: bool = False  # 管理员角色
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserInDB(UserBase):
    """数据库中的用户模型"""
    hashed_password: str
    security_question: str
    security_answer_hash: str
    avatar: Optional[str] = None
    is_admin: bool = False  # 管理员角色
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Token(BaseModel):
    """JWT Token 响应模型"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# 密码重置相关模型
class ForgotPasswordEmailRequest(BaseModel):
    """请求发送邮箱验证码"""
    email: EmailStr


class ResetPasswordByCodeRequest(BaseModel):
    """通过验证码重置密码"""
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6)


class GetSecurityQuestionRequest(BaseModel):
    """获取用户安全问题"""
    identifier: str = Field(..., description="用户名或邮箱")


class GetSecurityQuestionResponse(BaseModel):
    """安全问题响应"""
    question: str
    email: str  # 返回脱敏的邮箱用于显示


class ResetPasswordByQuestionRequest(BaseModel):
    """通过安全问题重置密码"""
    identifier: str = Field(..., description="用户名或邮箱")
    security_answer: str
    new_password: str = Field(..., min_length=6)


class MessageResponse(BaseModel):
    """通用消息响应"""
    message: str
    success: bool = True
