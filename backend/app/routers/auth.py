from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime
from bson import ObjectId

from ..models import UserCreate, UserLogin, UserResponse, Token
from ..models.user import (
    ForgotPasswordEmailRequest,
    ResetPasswordByCodeRequest,
    GetSecurityQuestionRequest,
    GetSecurityQuestionResponse,
    ResetPasswordByQuestionRequest,
    MessageResponse,
    SECURITY_QUESTIONS
)
from ..database import get_collection
from ..services.auth import (
    get_password_hash, 
    verify_password, 
    create_access_token,
    get_current_user
)
from ..services.email import (
    generate_code,
    store_code,
    verify_code,
    send_verification_email
)

router = APIRouter()


def mask_email(email: str) -> str:
    """脱敏邮箱地址"""
    parts = email.split("@")
    if len(parts) != 2:
        return email
    username = parts[0]
    domain = parts[1]
    if len(username) <= 2:
        masked = username[0] + "***"
    else:
        masked = username[:2] + "***" + username[-1]
    return f"{masked}@{domain}"


async def find_user_by_identifier(identifier: str):
    """通过用户名或邮箱查找用户"""
    users_collection = get_collection("users")
    
    # 检查是否是邮箱格式
    if "@" in identifier:
        user = await users_collection.find_one({"email": identifier})
    else:
        user = await users_collection.find_one({"username": identifier})
    
    return user


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    """用户注册"""
    users_collection = get_collection("users")
    
    # 检查邮箱是否已存在
    existing_user = await users_collection.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该邮箱已被注册"
        )
    
    # 检查用户名是否已存在
    existing_username = await users_collection.find_one({"username": user_data.username})
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该用户名已被使用"
        )
    
    # 验证安全问题是否有效
    if user_data.security_question not in SECURITY_QUESTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的安全问题"
        )
    
    # 创建新用户
    now = datetime.utcnow()
    user_dict = {
        "email": user_data.email,
        "username": user_data.username,
        "hashed_password": get_password_hash(user_data.password),
        "security_question": user_data.security_question,
        "security_answer_hash": get_password_hash(user_data.security_answer.lower()),  # 答案不区分大小写
        "avatar": None,
        "created_at": now,
        "updated_at": now,
    }
    
    result = await users_collection.insert_one(user_dict)
    user_id = str(result.inserted_id)
    
    # 生成 Token
    access_token = create_access_token(data={"sub": user_id})
    
    return Token(
        access_token=access_token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            username=user_data.username,
            avatar=None,
            is_admin=False,
            created_at=now
        )
    )


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    """用户登录 - 支持用户名或邮箱"""
    user = await find_user_by_identifier(credentials.identifier)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名/邮箱或密码错误"
        )
    
    # 验证密码
    if not verify_password(credentials.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名/邮箱或密码错误"
        )
    
    # 生成 Token
    user_id = str(user["_id"])
    access_token = create_access_token(data={"sub": user_id})
    
    return Token(
        access_token=access_token,
        user=UserResponse(
            id=user_id,
            email=user["email"],
            username=user["username"],
            avatar=user.get("avatar"),
            is_admin=user.get("is_admin", False),
            created_at=user["created_at"]
        )
    )


@router.post("/forgot-password/email", response_model=MessageResponse)
async def forgot_password_send_code(request: ForgotPasswordEmailRequest):
    """发送密码重置验证码到邮箱"""
    users_collection = get_collection("users")
    
    user = await users_collection.find_one({"email": request.email})
    if not user:
        # 为了安全，不透露邮箱是否存在
        return MessageResponse(message="如果该邮箱已注册，验证码已发送")
    
    # 生成并存储验证码
    code = generate_code()
    store_code(request.email, code)
    
    # 发送邮件
    success = await send_verification_email(request.email, code)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="邮件发送失败，请稍后重试"
        )
    
    return MessageResponse(message="验证码已发送到您的邮箱")


@router.post("/reset-password/email", response_model=MessageResponse)
async def reset_password_by_code(request: ResetPasswordByCodeRequest):
    """通过邮箱验证码重置密码"""
    users_collection = get_collection("users")
    
    # 验证验证码
    if not verify_code(request.email, request.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码无效或已过期"
        )
    
    # 更新密码
    result = await users_collection.update_one(
        {"email": request.email},
        {"$set": {
            "hashed_password": get_password_hash(request.new_password),
            "updated_at": datetime.utcnow()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    return MessageResponse(message="密码重置成功")


@router.post("/forgot-password/question", response_model=GetSecurityQuestionResponse)
async def get_security_question(request: GetSecurityQuestionRequest):
    """获取用户的安全问题"""
    user = await find_user_by_identifier(request.identifier)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 检查用户是否有安全问题（老用户可能没有）
    if not user.get("security_question"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该用户未设置安全问题，请使用邮箱验证码重置密码"
        )
    
    return GetSecurityQuestionResponse(
        question=user["security_question"],
        email=mask_email(user["email"])
    )


@router.post("/reset-password/question", response_model=MessageResponse)
async def reset_password_by_question(request: ResetPasswordByQuestionRequest):
    """通过安全问题重置密码"""
    users_collection = get_collection("users")
    
    user = await find_user_by_identifier(request.identifier)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 验证安全问题答案
    if not user.get("security_answer_hash"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该用户未设置安全问题"
        )
    
    if not verify_password(request.security_answer.lower(), user["security_answer_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="安全问题答案错误"
        )
    
    # 更新密码
    await users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "hashed_password": get_password_hash(request.new_password),
            "updated_at": datetime.utcnow()
        }}
    )
    
    return MessageResponse(message="密码重置成功")


@router.get("/security-questions")
async def get_security_questions():
    """获取可用的安全问题列表"""
    return {"questions": SECURITY_QUESTIONS}


@router.get("/profile", response_model=UserResponse)
async def get_profile(current_user: dict = Depends(get_current_user)):
    """获取当前用户资料"""
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        username=current_user["username"],
        avatar=current_user.get("avatar"),
        is_admin=current_user.get("is_admin", False),
        created_at=current_user["created_at"]
    )
