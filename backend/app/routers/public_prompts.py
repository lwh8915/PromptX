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
