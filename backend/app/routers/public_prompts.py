from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId

from ..models.public_prompt import (
    PublicPromptCreate, 
    PublicPromptResponse, 
    PublicPromptListResponse,
    PublicPromptSubmit,
    PublicPromptReview
)
from ..database import get_collection
from ..services.auth import get_current_user

router = APIRouter()

# 每日上传限制
DAILY_UPLOAD_LIMIT = 3

# 默认分类（用于初始化）
DEFAULT_CATEGORIES = ["写作", "编程", "营销", "翻译", "学习", "效率", "其他"]


async def ensure_default_categories():
    """确保默认分类存在（首次运行时初始化）"""
    collection = get_collection("public_categories")
    count = await collection.count_documents({})
    if count == 0:
        # 初始化默认分类
        now = datetime.utcnow()
        for i, name in enumerate(DEFAULT_CATEGORIES):
            await collection.insert_one({
                "name": name,
                "sort_order": i,
                "created_at": now
            })


async def get_all_categories() -> List[str]:
    """获取所有分类名称列表"""
    collection = get_collection("public_categories")
    # 确保有默认分类
    await ensure_default_categories()
    
    cursor = collection.find({}).sort("sort_order", 1)
    categories = []
    async for cat in cursor:
        categories.append(cat["name"])
    return categories


def serialize_public_prompt(prompt: dict, current_user_id: str = None) -> dict:
    """序列化公共提示词"""
    liked_by = prompt.get("liked_by", [])
    # Check if current user has liked this prompt
    is_liked = False
    if current_user_id:
        is_liked = ObjectId(current_user_id) in liked_by or current_user_id in [str(uid) for uid in liked_by]
    
    return {
        "id": str(prompt["_id"]),
        "title": prompt.get("title", ""),
        "content": prompt.get("content", ""),
        "description": prompt.get("description"),
        "tags": prompt.get("tags", []),
        "category": prompt.get("category", "其他"),
        "author_id": str(prompt.get("author_id", "")),
        "author_name": prompt.get("author_name", "匿名"),
        "source_prompt_id": str(prompt["source_prompt_id"]) if prompt.get("source_prompt_id") else None,
        "status": prompt.get("status", "pending"),
        "review_note": prompt.get("review_note"),
        "download_count": prompt.get("download_count", 0),
        "like_count": prompt.get("like_count", 0),
        "is_liked": is_liked,
        "avg_rating": prompt.get("avg_rating", 0),
        "review_count": prompt.get("review_count", 0),
        "created_at": prompt.get("created_at", datetime.utcnow()),
        "updated_at": prompt.get("updated_at", datetime.utcnow())
    }


async def get_today_upload_count(user_id: str) -> int:
    """获取用户今日上传次数"""
    collection = get_collection("public_prompts")
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    count = await collection.count_documents({
        "author_id": ObjectId(user_id),
        "created_at": {"$gte": today_start}
    })
    
    return count


@router.get("/categories", response_model=List[str])
async def get_categories(current_user: dict = Depends(get_current_user)):
    """获取公共提示词分类列表"""
    return await get_all_categories()


@router.get("/my-upload-status", response_model=dict)
async def get_my_upload_status(current_user: dict = Depends(get_current_user)):
    """获取用户今日上传状态"""
    today_count = await get_today_upload_count(current_user["id"])
    return {
        "today_count": today_count,
        "daily_limit": DAILY_UPLOAD_LIMIT,
        "auto_approve_remaining": max(0, DAILY_UPLOAD_LIMIT - today_count),
        "needs_review": today_count >= DAILY_UPLOAD_LIMIT
    }


@router.get("", response_model=PublicPromptListResponse)
async def get_public_prompts(
    category: Optional[str] = Query(None, description="分类筛选"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    sort_by: Optional[str] = Query("latest", description="排序方式: latest/likes/downloads"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: dict = Depends(get_current_user)
):
    """获取公共提示词列表（仅显示已审核通过的）"""
    collection = get_collection("public_prompts")
    
    # 构建查询条件 - 只显示已通过审核的
    query = {"status": "approved"}
    
    if category:
        query["category"] = category
    
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"tags": {"$in": [search]}}
        ]
    
    # 获取总数
    total = await collection.count_documents(query)
    
    # 根据排序方式选择排序字段
    if sort_by == "likes":
        sort_field = [("like_count", -1), ("created_at", -1)]
    elif sort_by == "downloads":
        sort_field = [("download_count", -1), ("created_at", -1)]
    else:  # latest
        sort_field = [("created_at", -1)]
    
    # 分页查询
    skip = (page - 1) * page_size
    cursor = collection.find(query).sort(sort_field).skip(skip).limit(page_size)
    
    items = []
    async for prompt in cursor:
        items.append(serialize_public_prompt(prompt, current_user["id"]))
    
    return PublicPromptListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/my-submissions", response_model=PublicPromptListResponse)
async def get_my_submissions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """获取我提交的公共提示词（含所有状态）"""
    collection = get_collection("public_prompts")
    user_id = ObjectId(current_user["id"])
    
    query = {"author_id": user_id}
    total = await collection.count_documents(query)
    
    skip = (page - 1) * page_size
    cursor = collection.find(query).sort("created_at", -1).skip(skip).limit(page_size)
    
    items = []
    async for prompt in cursor:
        items.append(serialize_public_prompt(prompt))
    
    return PublicPromptListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{prompt_id}", response_model=PublicPromptResponse)
async def get_public_prompt(
    prompt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """获取单个公共提示词详情"""
    collection = get_collection("public_prompts")
    
    try:
        prompt = await collection.find_one({"_id": ObjectId(prompt_id)})
    except:
        raise HTTPException(status_code=400, detail="无效的提示词 ID")
    
    if not prompt:
        raise HTTPException(status_code=404, detail="提示词不存在")
    
    # 非作者只能看到已通过的
    if prompt.get("status") != "approved" and str(prompt.get("author_id")) != current_user["id"]:
        raise HTTPException(status_code=404, detail="提示词不存在")
    
    return serialize_public_prompt(prompt)


@router.post("", response_model=PublicPromptResponse)
async def create_public_prompt(
    prompt_data: PublicPromptCreate,
    current_user: dict = Depends(get_current_user)
):
    """直接创建公共提示词（管理员无限制自动通过，普通用户前3个自动通过）"""
    collection = get_collection("public_prompts")
    users_collection = get_collection("users")
    
    # 获取用户信息
    user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    author_name = user.get("username", "匿名") if user else "匿名"
    is_admin = user.get("is_admin", False) if user else False
    
    # 管理员无限制直接通过，普通用户前3个自动通过
    if is_admin:
        status = "approved"
    else:
        today_count = await get_today_upload_count(current_user["id"])
        status = "approved" if today_count < DAILY_UPLOAD_LIMIT else "pending"
    
    now = datetime.utcnow()
    
    # 验证分类是否有效
    all_categories = await get_all_categories()
    valid_category = prompt_data.category if prompt_data.category in all_categories else "其他"
    
    new_prompt = {
        "title": prompt_data.title,
        "content": prompt_data.content,
        "description": prompt_data.description,
        "tags": prompt_data.tags,
        "category": valid_category,
        "author_id": ObjectId(current_user["id"]),
        "author_name": author_name,
        "source_prompt_id": None,
        "status": status,
        "review_note": None,
        "download_count": 0,
        "like_count": 0,
        "liked_by": [],
        "avg_rating": 0,
        "review_count": 0,
        "created_at": now,
        "updated_at": now
    }
    
    result = await collection.insert_one(new_prompt)
    new_prompt["_id"] = result.inserted_id
    
    return serialize_public_prompt(new_prompt)


@router.post("/upload/{prompt_id}", response_model=PublicPromptResponse)
async def upload_to_public(
    prompt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """从个人库上传提示词到公共库（管理员无限制自动通过，普通用户前3个自动通过）"""
    prompts_collection = get_collection("prompts")
    public_collection = get_collection("public_prompts")
    users_collection = get_collection("users")
    
    # 获取源提示词
    try:
        source_prompt = await prompts_collection.find_one({
            "_id": ObjectId(prompt_id),
            "user_id": current_user["id"]  # prompts collection stores user_id as string
        })
    except:
        raise HTTPException(status_code=400, detail="无效的提示词 ID")
    
    if not source_prompt:
        raise HTTPException(status_code=404, detail="提示词不存在或无权限")
    
    # 检查是否已上传过
    existing = await public_collection.find_one({
        "source_prompt_id": ObjectId(prompt_id),
        "author_id": ObjectId(current_user["id"])
    })
    if existing:
        raise HTTPException(status_code=400, detail="该提示词已分享到公共库")
    
    # 获取用户信息
    user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    author_name = user.get("username", "匿名") if user else "匿名"
    is_admin = user.get("is_admin", False) if user else False
    
    # 管理员无限制直接通过，普通用户前3个自动通过
    if is_admin:
        status = "approved"
    else:
        today_count = await get_today_upload_count(current_user["id"])
        status = "approved" if today_count < DAILY_UPLOAD_LIMIT else "pending"
    
    now = datetime.utcnow()
    
    # 自动从标签中检测分类
    source_tags = source_prompt.get("tags", [])
    detected_category = "其他"
    all_categories = await get_all_categories()
    for tag in source_tags:
        if tag in all_categories:
            detected_category = tag
            break
    
    new_public_prompt = {
        "title": source_prompt.get("title", ""),
        "content": source_prompt.get("content", ""),
        "description": source_prompt.get("description"),
        "tags": source_tags,
        "category": detected_category,  # 自动从标签检测分类
        "author_id": ObjectId(current_user["id"]),
        "author_name": author_name,
        "source_prompt_id": ObjectId(prompt_id),
        "status": status,
        "review_note": None,
        "download_count": 0,
        "like_count": 0,
        "liked_by": [],
        "avg_rating": 0,
        "review_count": 0,
        "created_at": now,
        "updated_at": now
    }
    
    result = await public_collection.insert_one(new_public_prompt)
    new_public_prompt["_id"] = result.inserted_id
    
    return serialize_public_prompt(new_public_prompt)


@router.post("/{prompt_id}/download", response_model=dict)
async def download_to_personal(
    prompt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """下载公共提示词到个人库"""
    public_collection = get_collection("public_prompts")
    prompts_collection = get_collection("prompts")
    downloads_collection = get_collection("public_prompt_downloads")
    
    # 获取公共提示词
    try:
        public_prompt = await public_collection.find_one({
            "_id": ObjectId(prompt_id),
            "status": "approved"
        })
    except:
        raise HTTPException(status_code=400, detail="无效的提示词 ID")
    
    if not public_prompt:
        raise HTTPException(status_code=404, detail="提示词不存在")
    
    user_id = ObjectId(current_user["id"])
    
    # 创建个人提示词副本
    now = datetime.utcnow()
    new_prompt = {
        "title": public_prompt.get("title", ""),
        "content": public_prompt.get("content", ""),
        "description": public_prompt.get("description"),
        "tags": public_prompt.get("tags", []),
        "category_id": None,  # 不设置分类
        "user_id": current_user["id"],  # Store as string to match prompts collection format
        "is_favorite": False,
        "copy_count": 0,
        "current_version": 1,
        "created_at": now,
        "updated_at": now
    }
    
    result = await prompts_collection.insert_one(new_prompt)
    
    # 增加下载计数
    await public_collection.update_one(
        {"_id": ObjectId(prompt_id)},
        {"$inc": {"download_count": 1}}
    )
    
    # 记录下载历史（用于评价验证）
    existing_download = await downloads_collection.find_one({
        "prompt_id": ObjectId(prompt_id),
        "user_id": user_id
    })
    if not existing_download:
        await downloads_collection.insert_one({
            "prompt_id": ObjectId(prompt_id),
            "user_id": user_id,
            "downloaded_at": now,
            "has_reviewed": False
        })
    
    return {
        "message": "下载成功",
        "prompt_id": str(result.inserted_id)
    }


@router.post("/{prompt_id}/like", response_model=dict)
async def like_prompt(
    prompt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """点赞公共提示词"""
    collection = get_collection("public_prompts")
    
    try:
        prompt = await collection.find_one({
            "_id": ObjectId(prompt_id),
            "status": "approved"
        })
    except:
        raise HTTPException(status_code=400, detail="无效的提示词 ID")
    
    if not prompt:
        raise HTTPException(status_code=404, detail="提示词不存在")
    
    user_oid = ObjectId(current_user["id"])
    liked_by = prompt.get("liked_by", [])
    
    # 检查是否已点赞
    if user_oid in liked_by:
        raise HTTPException(status_code=400, detail="您已经点赞过了")
    
    # 添加点赞
    await collection.update_one(
        {"_id": ObjectId(prompt_id)},
        {
            "$addToSet": {"liked_by": user_oid},
            "$inc": {"like_count": 1}
        }
    )
    
    new_count = prompt.get("like_count", 0) + 1
    return {"message": "点赞成功", "like_count": new_count}


@router.delete("/{prompt_id}/like", response_model=dict)
async def unlike_prompt(
    prompt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """取消点赞公共提示词"""
    collection = get_collection("public_prompts")
    
    try:
        prompt = await collection.find_one({
            "_id": ObjectId(prompt_id),
            "status": "approved"
        })
    except:
        raise HTTPException(status_code=400, detail="无效的提示词 ID")
    
    if not prompt:
        raise HTTPException(status_code=404, detail="提示词不存在")
    
    user_oid = ObjectId(current_user["id"])
    liked_by = prompt.get("liked_by", [])
    
    # 检查是否已点赞
    if user_oid not in liked_by:
        raise HTTPException(status_code=400, detail="您还没有点赞")
    
    # 取消点赞
    await collection.update_one(
        {"_id": ObjectId(prompt_id)},
        {
            "$pull": {"liked_by": user_oid},
            "$inc": {"like_count": -1}
        }
    )
    
    new_count = max(0, prompt.get("like_count", 0) - 1)
    return {"message": "已取消点赞", "like_count": new_count}


# ============ 管理员 API ============

async def check_admin(current_user: dict):
    """检查用户是否为管理员"""
    users_collection = get_collection("users")
    user = await users_collection.find_one({"_id": ObjectId(current_user["id"])})
    if not user or not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


@router.get("/admin/pending", response_model=PublicPromptListResponse)
async def get_pending_prompts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """获取待审核的公共提示词列表 (管理员)"""
    await check_admin(current_user)
    
    collection = get_collection("public_prompts")
    
    query = {"status": "pending"}
    total = await collection.count_documents(query)
    
    skip = (page - 1) * page_size
    cursor = collection.find(query).sort("created_at", 1).skip(skip).limit(page_size)  # 按提交时间升序
    
    items = []
    async for prompt in cursor:
        items.append(serialize_public_prompt(prompt))
    
    return PublicPromptListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )


@router.post("/admin/{prompt_id}/approve", response_model=PublicPromptResponse)
async def approve_prompt(
    prompt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """审核通过公共提示词 (管理员)"""
    admin_user = await check_admin(current_user)
    
    collection = get_collection("public_prompts")
    
    try:
        prompt = await collection.find_one({"_id": ObjectId(prompt_id)})
    except:
        raise HTTPException(status_code=400, detail="无效的提示词 ID")
    
    if not prompt:
        raise HTTPException(status_code=404, detail="提示词不存在")
    
    if prompt.get("status") != "pending":
        raise HTTPException(status_code=400, detail="该提示词不在待审核状态")
    
    # 更新状态
    now = datetime.utcnow()
    await collection.update_one(
        {"_id": ObjectId(prompt_id)},
        {
            "$set": {
                "status": "approved",
                "reviewed_by": ObjectId(current_user["id"]),
                "reviewed_at": now,
                "updated_at": now
            }
        }
    )
    
    prompt["status"] = "approved"
    prompt["updated_at"] = now
    
    return serialize_public_prompt(prompt)


@router.post("/admin/{prompt_id}/reject", response_model=PublicPromptResponse)
async def reject_prompt(
    prompt_id: str,
    review: PublicPromptReview,
    current_user: dict = Depends(get_current_user)
):
    """审核拒绝公共提示词 (管理员)"""
    admin_user = await check_admin(current_user)
    
    collection = get_collection("public_prompts")
    
    try:
        prompt = await collection.find_one({"_id": ObjectId(prompt_id)})
    except:
        raise HTTPException(status_code=400, detail="无效的提示词 ID")
    
    if not prompt:
        raise HTTPException(status_code=404, detail="提示词不存在")
    
    if prompt.get("status") != "pending":
        raise HTTPException(status_code=400, detail="该提示词不在待审核状态")
    
    # 更新状态
    now = datetime.utcnow()
    await collection.update_one(
        {"_id": ObjectId(prompt_id)},
        {
            "$set": {
                "status": "rejected",
                "review_note": review.note,
                "reviewed_by": ObjectId(current_user["id"]),
                "reviewed_at": now,
                "updated_at": now
            }
        }
    )
    
    prompt["status"] = "rejected"
    prompt["review_note"] = review.note
    prompt["updated_at"] = now
    
    return serialize_public_prompt(prompt)


@router.get("/admin/stats", response_model=dict)
async def get_admin_stats(current_user: dict = Depends(get_current_user)):
    """获取审核统计信息 (管理员)"""
    await check_admin(current_user)
    
    collection = get_collection("public_prompts")
    
    pending_count = await collection.count_documents({"status": "pending"})
    approved_count = await collection.count_documents({"status": "approved"})
    rejected_count = await collection.count_documents({"status": "rejected"})
    
    return {
        "pending": pending_count,
        "approved": approved_count,
        "rejected": rejected_count,
        "total": pending_count + approved_count + rejected_count
    }


@router.get("/admin/all", response_model=PublicPromptListResponse)
async def get_all_prompts(
    status: Optional[str] = Query(None, description="状态筛选: pending/approved/rejected"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """获取所有公共提示词列表 (管理员)"""
    await check_admin(current_user)
    
    collection = get_collection("public_prompts")
    
    query = {}
    if status:
        query["status"] = status
    
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}},
            {"author_name": {"$regex": search, "$options": "i"}}
        ]
    
    total = await collection.count_documents(query)
    
    skip = (page - 1) * page_size
    cursor = collection.find(query).sort("created_at", -1).skip(skip).limit(page_size)
    
    items = []
    async for prompt in cursor:
        items.append(serialize_public_prompt(prompt))
    
    return PublicPromptListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )


@router.delete("/admin/{prompt_id}", response_model=dict)
async def delete_public_prompt(
    prompt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """删除公共提示词 (管理员)"""
    await check_admin(current_user)
    
    collection = get_collection("public_prompts")
    
    try:
        prompt = await collection.find_one({"_id": ObjectId(prompt_id)})
    except:
        raise HTTPException(status_code=400, detail="无效的提示词 ID")
    
    if not prompt:
        raise HTTPException(status_code=404, detail="提示词不存在")
    
    await collection.delete_one({"_id": ObjectId(prompt_id)})
    
    return {"message": "删除成功", "id": prompt_id}


# ============ 分类管理 API (管理员) ============

@router.get("/admin/categories", response_model=List[dict])
async def get_admin_categories(current_user: dict = Depends(get_current_user)):
    """获取分类列表详情 (管理员)"""
    await check_admin(current_user)
    
    collection = get_collection("public_categories")
    await ensure_default_categories()
    
    cursor = collection.find({}).sort("sort_order", 1)
    categories = []
    async for cat in cursor:
        categories.append({
            "id": str(cat["_id"]),
            "name": cat["name"],
            "sort_order": cat.get("sort_order", 0),
            "created_at": cat.get("created_at")
        })
    return categories


@router.post("/admin/categories", response_model=dict)
async def create_category(
    name: str = Query(..., min_length=1, max_length=20, description="分类名称"),
    current_user: dict = Depends(get_current_user)
):
    """创建新分类 (管理员)"""
    await check_admin(current_user)
    
    collection = get_collection("public_categories")
    
    # 检查是否已存在
    existing = await collection.find_one({"name": name})
    if existing:
        raise HTTPException(status_code=400, detail="该分类已存在")
    
    # 获取最大排序号
    last_cat = await collection.find_one({}, sort=[("sort_order", -1)])
    max_order = last_cat.get("sort_order", 0) if last_cat else 0
    
    now = datetime.utcnow()
    result = await collection.insert_one({
        "name": name,
        "sort_order": max_order + 1,
        "created_at": now
    })
    
    return {
        "message": "创建成功",
        "id": str(result.inserted_id),
        "name": name
    }


@router.delete("/admin/categories/{category_id}", response_model=dict)
async def delete_category(
    category_id: str,
    current_user: dict = Depends(get_current_user)
):
    """删除分类 (管理员)"""
    await check_admin(current_user)
    
    collection = get_collection("public_categories")
    
    try:
        category = await collection.find_one({"_id": ObjectId(category_id)})
    except:
        raise HTTPException(status_code=400, detail="无效的分类 ID")
    
    if not category:
        raise HTTPException(status_code=404, detail="分类不存在")
    
    # 不允许删除"其他"分类
    if category["name"] == "其他":
        raise HTTPException(status_code=400, detail="无法删除默认分类")
    
    # 将使用该分类的提示词改为"其他"
    prompts_collection = get_collection("public_prompts")
    await prompts_collection.update_many(
        {"category": category["name"]},
        {"$set": {"category": "其他"}}
    )
    
    await collection.delete_one({"_id": ObjectId(category_id)})
    
    return {"message": "删除成功", "id": category_id, "name": category["name"]}


@router.put("/admin/categories/reorder", response_model=dict)
async def reorder_categories(
    category_ids: List[str],
    current_user: dict = Depends(get_current_user)
):
    """重新排序分类 (管理员)"""
    await check_admin(current_user)
    
    collection = get_collection("public_categories")
    
    # 更新每个分类的排序号
    for i, cat_id in enumerate(category_ids):
        try:
            await collection.update_one(
                {"_id": ObjectId(cat_id)},
                {"$set": {"sort_order": i}}
            )
        except:
            pass  # 忽略无效的ID
    
    return {"message": "排序更新成功"}


# ============ 评价系统 API ============

# 敏感词列表（基础版）
SENSITIVE_WORDS = ["垃圾", "傻逼", "fuck", "shit", "废物", "骗子"]


def filter_sensitive_words(text: str) -> str:
    """过滤敏感词"""
    result = text
    for word in SENSITIVE_WORDS:
        result = result.replace(word, "*" * len(word))
    return result


def serialize_review(review: dict, current_user_id: str = None) -> dict:
    """序列化评价"""
    liked_by = review.get("liked_by", [])
    is_liked = False
    if current_user_id:
        is_liked = ObjectId(current_user_id) in liked_by or current_user_id in [str(uid) for uid in liked_by]
    
    return {
        "id": str(review["_id"]),
        "prompt_id": str(review.get("prompt_id", "")),
        "user_id": str(review.get("user_id", "")),
        "user_name": review.get("user_name", "匿名"),
        "rating": review.get("rating", 5),
        "content": review.get("content", ""),
        "like_count": review.get("like_count", 0),
        "is_liked": is_liked,
        "author_reply": review.get("author_reply"),
        "author_reply_at": review.get("author_reply_at"),
        "status": review.get("status", "approved"),
        "created_at": review.get("created_at", datetime.utcnow()),
        "updated_at": review.get("updated_at", datetime.utcnow())
    }


async def update_prompt_rating(prompt_id: str):
    """更新提示词的平均评分"""
    reviews_collection = get_collection("public_prompt_reviews")
    prompts_collection = get_collection("public_prompts")
    
    print(f"[DEBUG] update_prompt_rating called for prompt_id: {prompt_id}")
    
    # 计算平均分
    pipeline = [
        {"$match": {"prompt_id": ObjectId(prompt_id), "status": "approved"}},
        {"$group": {
            "_id": None,
            "avg_rating": {"$avg": "$rating"},
            "count": {"$sum": 1}
        }}
    ]
    
    result = await reviews_collection.aggregate(pipeline).to_list(1)
    print(f"[DEBUG] Aggregation result: {result}")
    
    if result:
        avg_rating = round(result[0]["avg_rating"], 1)
        review_count = result[0]["count"]
    else:
        avg_rating = 0
        review_count = 0
    
    print(f"[DEBUG] Updating prompt with avg_rating={avg_rating}, review_count={review_count}")
    
    update_result = await prompts_collection.update_one(
        {"_id": ObjectId(prompt_id)},
        {"$set": {"avg_rating": avg_rating, "review_count": review_count}}
    )
    print(f"[DEBUG] Update result: matched={update_result.matched_count}, modified={update_result.modified_count}")


@router.post("/{prompt_id}/reviews", response_model=dict)
async def create_review(
    prompt_id: str,
    rating: int = Query(..., ge=1, le=5, description="评分1-5"),
    content: str = Query(..., min_length=1, max_length=500, description="评价内容"),
    current_user: dict = Depends(get_current_user)
):
    """创建评价（需要已下载该提示词）"""
    prompts_collection = get_collection("public_prompts")
    reviews_collection = get_collection("public_prompt_reviews")
    downloads_collection = get_collection("public_prompt_downloads")
    users_collection = get_collection("users")
    
    # 验证提示词存在
    try:
        prompt = await prompts_collection.find_one({"_id": ObjectId(prompt_id), "status": "approved"})
    except:
        raise HTTPException(status_code=400, detail="无效的提示词 ID")
    
    if not prompt:
        raise HTTPException(status_code=404, detail="提示词不存在")
    
    user_id = ObjectId(current_user["id"])
    
    # 验证已下载（作者可以直接评价自己的提示词）
    is_author = prompt.get("author_id") == user_id
    if not is_author:
        download_record = await downloads_collection.find_one({
            "prompt_id": ObjectId(prompt_id),
            "user_id": user_id
        })
        if not download_record:
            raise HTTPException(status_code=403, detail="请先下载该提示词后再评价")
    
    # 检查是否已评价
    existing_review = await reviews_collection.find_one({
        "prompt_id": ObjectId(prompt_id),
        "user_id": user_id
    })
    if existing_review:
        raise HTTPException(status_code=400, detail="您已经评价过该提示词")
    
    # 获取用户信息
    user = await users_collection.find_one({"_id": user_id})
    user_name = user.get("username", "匿名") if user else "匿名"
    
    # 过滤敏感词
    filtered_content = filter_sensitive_words(content)
    
    now = datetime.utcnow()
    new_review = {
        "prompt_id": ObjectId(prompt_id),
        "user_id": user_id,
        "user_name": user_name,
        "rating": rating,
        "content": filtered_content,
        "like_count": 0,
        "liked_by": [],
        "author_reply": None,
        "author_reply_at": None,
        "is_reported": False,
        "report_count": 0,
        "status": "approved",
        "created_at": now,
        "updated_at": now
    }
    
    result = await reviews_collection.insert_one(new_review)
    new_review["_id"] = result.inserted_id
    
    # 更新提示词的平均评分
    await update_prompt_rating(prompt_id)
    
    # 更新下载记录标记已评价
    if not is_author:
        await downloads_collection.update_one(
            {"prompt_id": ObjectId(prompt_id), "user_id": user_id},
            {"$set": {"has_reviewed": True}}
        )
        
        # 通知提示词作者有新评论
        prompt_author_id = prompt.get("author_id")
        author_id_str = str(prompt_author_id) if prompt_author_id else None
        print(f"[DEBUG] Creating notification for author: {author_id_str}, prompt_author_id type: {type(prompt_author_id)}")
        
        if author_id_str and author_id_str != str(user_id):
            try:
                from .notifications import create_notification
                await create_notification(
                    user_id=author_id_str,
                    notification_type="review_reply",
                    title="您的提示词收到了新评价",
                    content=f"{user_name} 对《{prompt.get('title', '提示词')}》评价了 {rating} 星：{filtered_content[:80]}{'...' if len(filtered_content) > 80 else ''}",
                    related_id=prompt_id,
                    actor_name=user_name
                )
                print(f"[DEBUG] Notification created successfully for {author_id_str}")
            except Exception as e:
                print(f"[DEBUG] Failed to create notification: {e}")
    
    return {
        "message": "评价成功",
        "review": serialize_review(new_review, current_user["id"])
    }


@router.get("/{prompt_id}/reviews", response_model=dict)
async def get_reviews(
    prompt_id: str,
    sort_by: str = Query("latest", regex="^(latest|likes)$", description="排序方式"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """获取提示词的评价列表"""
    reviews_collection = get_collection("public_prompt_reviews")
    
    try:
        ObjectId(prompt_id)
    except:
        raise HTTPException(status_code=400, detail="无效的提示词 ID")
    
    # 构建查询
    query = {"prompt_id": ObjectId(prompt_id), "status": "approved"}
    
    # 排序
    if sort_by == "likes":
        sort = [("like_count", -1), ("created_at", -1)]
    else:
        sort = [("created_at", -1)]
    
    # 分页
    skip = (page - 1) * page_size
    
    # 查询
    total = await reviews_collection.count_documents(query)
    cursor = reviews_collection.find(query).sort(sort).skip(skip).limit(page_size)
    
    reviews = []
    async for review in cursor:
        reviews.append(serialize_review(review, current_user["id"]))
    
    return {
        "items": reviews,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/{prompt_id}/my-review", response_model=dict)
async def get_my_review(
    prompt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """获取我对该提示词的评价"""
    reviews_collection = get_collection("public_prompt_reviews")
    downloads_collection = get_collection("public_prompt_downloads")
    
    try:
        ObjectId(prompt_id)
    except:
        raise HTTPException(status_code=400, detail="无效的提示词 ID")
    
    user_id = ObjectId(current_user["id"])
    
    # 查询我的评价
    review = await reviews_collection.find_one({
        "prompt_id": ObjectId(prompt_id),
        "user_id": user_id
    })
    
    # 查询是否已下载
    download_record = await downloads_collection.find_one({
        "prompt_id": ObjectId(prompt_id),
        "user_id": user_id
    })
    
    return {
        "review": serialize_review(review, current_user["id"]) if review else None,
        "has_downloaded": download_record is not None,
        "can_review": download_record is not None and review is None
    }


@router.post("/reviews/{review_id}/like", response_model=dict)
async def like_review(
    review_id: str,
    current_user: dict = Depends(get_current_user)
):
    """点赞评论"""
    reviews_collection = get_collection("public_prompt_reviews")
    
    try:
        review = await reviews_collection.find_one({"_id": ObjectId(review_id)})
    except:
        raise HTTPException(status_code=400, detail="无效的评论 ID")
    
    if not review:
        raise HTTPException(status_code=404, detail="评论不存在")
    
    user_id = ObjectId(current_user["id"])
    liked_by = review.get("liked_by", [])
    
    if user_id in liked_by:
        raise HTTPException(status_code=400, detail="已经点赞过")
    
    await reviews_collection.update_one(
        {"_id": ObjectId(review_id)},
        {
            "$push": {"liked_by": user_id},
            "$inc": {"like_count": 1}
        }
    )
    
    return {"message": "点赞成功", "like_count": review.get("like_count", 0) + 1}


@router.delete("/reviews/{review_id}/like", response_model=dict)
async def unlike_review(
    review_id: str,
    current_user: dict = Depends(get_current_user)
):
    """取消点赞评论"""
    reviews_collection = get_collection("public_prompt_reviews")
    
    try:
        review = await reviews_collection.find_one({"_id": ObjectId(review_id)})
    except:
        raise HTTPException(status_code=400, detail="无效的评论 ID")
    
    if not review:
        raise HTTPException(status_code=404, detail="评论不存在")
    
    user_id = ObjectId(current_user["id"])
    liked_by = review.get("liked_by", [])
    
    if user_id not in liked_by:
        raise HTTPException(status_code=400, detail="尚未点赞")
    
    await reviews_collection.update_one(
        {"_id": ObjectId(review_id)},
        {
            "$pull": {"liked_by": user_id},
            "$inc": {"like_count": -1}
        }
    )
    
    return {"message": "取消点赞", "like_count": max(0, review.get("like_count", 1) - 1)}


@router.post("/reviews/{review_id}/reply", response_model=dict)
async def reply_to_review(
    review_id: str,
    reply: str = Query(..., min_length=1, max_length=500, description="回复内容"),
    current_user: dict = Depends(get_current_user)
):
    """作者回复评论"""
    reviews_collection = get_collection("public_prompt_reviews")
    prompts_collection = get_collection("public_prompts")
    
    try:
        review = await reviews_collection.find_one({"_id": ObjectId(review_id)})
    except:
        raise HTTPException(status_code=400, detail="无效的评论 ID")
    
    if not review:
        raise HTTPException(status_code=404, detail="评论不存在")
    
    # 验证是提示词作者
    prompt = await prompts_collection.find_one({"_id": review["prompt_id"]})
    if not prompt or str(prompt.get("author_id")) != current_user["id"]:
        raise HTTPException(status_code=403, detail="只有提示词作者可以回复")
    
    # 过滤敏感词
    filtered_reply = filter_sensitive_words(reply)
    
    now = datetime.utcnow()
    await reviews_collection.update_one(
        {"_id": ObjectId(review_id)},
        {"$set": {
            "author_reply": filtered_reply,
            "author_reply_at": now,
            "updated_at": now
        }}
    )
    
    # 发送通知给评论用户
    review_user_id = str(review.get("user_id"))
    print(f"[DEBUG] Reply notification - review_user_id: {review_user_id}, current_user_id: {current_user['id']}")
    
    if review_user_id != current_user["id"]:  # Don't notify if replying to own review
        try:
            from .notifications import create_notification
            await create_notification(
                user_id=review_user_id,
                notification_type="review_reply",
                title="您的评论收到了作者回复",
                content=f"{current_user.get('username', '作者')} 回复了您的评论：{filtered_reply[:100]}{'...' if len(filtered_reply) > 100 else ''}",
                related_id=str(prompt.get("_id")),
                actor_name=current_user.get("username")
            )
            print(f"[DEBUG] Reply notification created for {review_user_id}")
        except Exception as e:
            print(f"[DEBUG] Failed to create reply notification: {e}")
    else:
        print(f"[DEBUG] Skipping notification - replying to own review")
    
    return {"message": "回复成功"}


@router.post("/reviews/{review_id}/report", response_model=dict)
async def report_review(
    review_id: str,
    reason: str = Query(..., min_length=1, max_length=200, description="举报原因"),
    current_user: dict = Depends(get_current_user)
):
    """举报评论"""
    reviews_collection = get_collection("public_prompt_reviews")
    reports_collection = get_collection("review_reports")
    
    try:
        review = await reviews_collection.find_one({"_id": ObjectId(review_id)})
    except:
        raise HTTPException(status_code=400, detail="无效的评论 ID")
    
    if not review:
        raise HTTPException(status_code=404, detail="评论不存在")
    
    user_id = ObjectId(current_user["id"])
    
    # 检查是否已举报
    existing_report = await reports_collection.find_one({
        "review_id": ObjectId(review_id),
        "reporter_id": user_id
    })
    if existing_report:
        raise HTTPException(status_code=400, detail="您已举报过该评论")
    
    now = datetime.utcnow()
    await reports_collection.insert_one({
        "review_id": ObjectId(review_id),
        "reporter_id": user_id,
        "reason": reason,
        "status": "pending",
        "created_at": now
    })
    
    # 更新评论的举报状态
    await reviews_collection.update_one(
        {"_id": ObjectId(review_id)},
        {
            "$set": {"is_reported": True},
            "$inc": {"report_count": 1}
        }
    )
    
    return {"message": "举报已提交，我们会尽快处理"}


# ============ 管理员评价管理 API ============

@router.get("/admin/reviews", response_model=dict)
async def get_admin_reviews(
    status: Optional[str] = Query(None, regex="^(approved|pending|reported)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """获取所有评论列表（管理员）"""
    await check_admin(current_user)
    
    reviews_collection = get_collection("public_prompt_reviews")
    
    query = {}
    if status == "reported":
        query["is_reported"] = True
    elif status:
        query["status"] = status
    
    skip = (page - 1) * page_size
    total = await reviews_collection.count_documents(query)
    
    cursor = reviews_collection.find(query).sort("created_at", -1).skip(skip).limit(page_size)
    
    reviews = []
    async for review in cursor:
        reviews.append(serialize_review(review))
    
    return {
        "items": reviews,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.delete("/admin/reviews/{review_id}", response_model=dict)
async def delete_review(
    review_id: str,
    current_user: dict = Depends(get_current_user)
):
    """删除评论（管理员）"""
    await check_admin(current_user)
    
    reviews_collection = get_collection("public_prompt_reviews")
    
    try:
        review = await reviews_collection.find_one({"_id": ObjectId(review_id)})
    except:
        raise HTTPException(status_code=400, detail="无效的评论 ID")
    
    if not review:
        raise HTTPException(status_code=404, detail="评论不存在")
    
    prompt_id = str(review["prompt_id"])
    
    await reviews_collection.delete_one({"_id": ObjectId(review_id)})
    
    # 更新提示词评分
    await update_prompt_rating(prompt_id)
    
    return {"message": "删除成功", "id": review_id}


@router.get("/admin/review-stats", response_model=dict)
async def get_review_stats(current_user: dict = Depends(get_current_user)):
    """获取评价统计（管理员）"""
    await check_admin(current_user)
    
    reviews_collection = get_collection("public_prompt_reviews")
    reports_collection = get_collection("review_reports")
    
    total_reviews = await reviews_collection.count_documents({})
    reported_reviews = await reviews_collection.count_documents({"is_reported": True})
    pending_reports = await reports_collection.count_documents({"status": "pending"})
    
    # 计算总体平均分
    pipeline = [
        {"$match": {"status": "approved"}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}}}
    ]
    result = await reviews_collection.aggregate(pipeline).to_list(1)
    overall_avg = round(result[0]["avg"], 2) if result else 0
    
    return {
        "total_reviews": total_reviews,
        "reported_reviews": reported_reviews,
        "pending_reports": pending_reports,
        "overall_avg_rating": overall_avg
    }
