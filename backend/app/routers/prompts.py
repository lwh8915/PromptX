from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from ..models import PromptCreate, PromptUpdate, PromptResponse
from ..models.prompt import PromptListResponse
from ..database import get_collection
from ..services.auth import get_current_user

router = APIRouter()


def serialize_prompt(prompt: dict, category_name: str = None) -> PromptResponse:
    """序列化提示词数据"""
    return PromptResponse(
        id=str(prompt["_id"]),
        title=prompt["title"],
        content=prompt["content"],
        category_id=prompt.get("category_id"),
        category_name=category_name,
        tags=prompt.get("tags", []),
        description=prompt.get("description"),
        is_favorite=prompt.get("is_favorite", False),
        user_id=prompt["user_id"],
        copy_count=prompt.get("copy_count", 0),
        created_at=prompt["created_at"],
        updated_at=prompt["updated_at"]
    )


@router.get("", response_model=PromptListResponse)
async def get_prompts(
    category_id: Optional[str] = Query(None, description="分类ID"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    tag: Optional[str] = Query(None, description="标签过滤"),
    is_favorite: Optional[bool] = Query(None, description="收藏过滤"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: dict = Depends(get_current_user)
):
    """获取提示词列表"""
    prompts_collection = get_collection("prompts")
    categories_collection = get_collection("categories")
    
    # 构建查询条件
    query = {"user_id": current_user["id"]}
    
    if category_id:
        # 获取该分类及其所有子分类的ID
        all_category_ids = [category_id]
        
        # 递归获取所有子分类ID
        async def get_child_ids(parent_id: str):
            cursor = categories_collection.find({
                "parent_id": parent_id,
                "user_id": current_user["id"]
            })
            children = await cursor.to_list(length=None)
            for child in children:
                child_id = str(child["_id"])
                all_category_ids.append(child_id)
                await get_child_ids(child_id)
        
        await get_child_ids(category_id)
        
        # 使用 $in 查询所有相关分类的提示词
        query["category_id"] = {"$in": all_category_ids}
    
    if is_favorite is not None:
        query["is_favorite"] = is_favorite
    
    if tag:
        query["tags"] = tag
    
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    
    # 获取总数
    total = await prompts_collection.count_documents(query)
    
    # 分页查询
    skip = (page - 1) * page_size
    cursor = prompts_collection.find(query).sort("updated_at", -1).skip(skip).limit(page_size)
    prompts = await cursor.to_list(length=page_size)
    
    # 获取分类名称映射
    category_ids = [p.get("category_id") for p in prompts if p.get("category_id")]
    category_names = {}
    if category_ids:
        cat_cursor = categories_collection.find({
            "_id": {"$in": [ObjectId(cid) for cid in category_ids]}
        })
        async for cat in cat_cursor:
            category_names[str(cat["_id"])] = cat["name"]
    
    # 序列化结果
    items = [
        serialize_prompt(p, category_names.get(p.get("category_id")))
        for p in prompts
    ]
    
    return PromptListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{prompt_id}", response_model=PromptResponse)
async def get_prompt(
    prompt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """获取单个提示词"""
    prompts_collection = get_collection("prompts")
    categories_collection = get_collection("categories")
    
    prompt = await prompts_collection.find_one({
        "_id": ObjectId(prompt_id),
        "user_id": current_user["id"]
    })
    
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="提示词不存在"
        )
    
    # 获取分类名称
    category_name = None
    if prompt.get("category_id"):
        category = await categories_collection.find_one({
            "_id": ObjectId(prompt["category_id"])
        })
        if category:
            category_name = category["name"]
    
    return serialize_prompt(prompt, category_name)


@router.post("", response_model=PromptResponse, status_code=status.HTTP_201_CREATED)
async def create_prompt(
    prompt_data: PromptCreate,
    current_user: dict = Depends(get_current_user)
):
    """创建新提示词"""
    prompts_collection = get_collection("prompts")
    categories_collection = get_collection("categories")
    
    # 验证分类存在
    category_name = None
    if prompt_data.category_id:
        category = await categories_collection.find_one({
            "_id": ObjectId(prompt_data.category_id),
            "user_id": current_user["id"]
        })
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="分类不存在"
            )
        category_name = category["name"]
    
    now = datetime.utcnow()
    prompt_dict = {
        "title": prompt_data.title,
        "content": prompt_data.content,
        "category_id": prompt_data.category_id,
        "tags": prompt_data.tags,
        "description": prompt_data.description,
        "is_favorite": prompt_data.is_favorite,
        "user_id": current_user["id"],
        "copy_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    
    result = await prompts_collection.insert_one(prompt_dict)
    prompt_dict["_id"] = result.inserted_id
    
    return serialize_prompt(prompt_dict, category_name)


@router.put("/{prompt_id}", response_model=PromptResponse)
async def update_prompt(
    prompt_id: str,
    prompt_data: PromptUpdate,
    current_user: dict = Depends(get_current_user)
):
    """更新提示词"""
    prompts_collection = get_collection("prompts")
    categories_collection = get_collection("categories")
    
    # 验证提示词存在
    prompt = await prompts_collection.find_one({
        "_id": ObjectId(prompt_id),
        "user_id": current_user["id"]
    })
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="提示词不存在"
        )
    
    # 更新字段
    update_data = {k: v for k, v in prompt_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await prompts_collection.update_one(
        {"_id": ObjectId(prompt_id)},
        {"$set": update_data}
    )
    
    # 获取更新后的提示词
    updated_prompt = await prompts_collection.find_one({"_id": ObjectId(prompt_id)})
    
    # 获取分类名称
    category_name = None
    if updated_prompt.get("category_id"):
        category = await categories_collection.find_one({
            "_id": ObjectId(updated_prompt["category_id"])
        })
        if category:
            category_name = category["name"]
    
    return serialize_prompt(updated_prompt, category_name)


@router.delete("/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt(
    prompt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """删除提示词"""
    prompts_collection = get_collection("prompts")
    
    result = await prompts_collection.delete_one({
        "_id": ObjectId(prompt_id),
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="提示词不存在"
        )


@router.post("/{prompt_id}/copy", response_model=PromptResponse)
async def increment_copy_count(
    prompt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """增加复制次数（当用户点击复制按钮时调用）"""
    prompts_collection = get_collection("prompts")
    categories_collection = get_collection("categories")
    
    result = await prompts_collection.find_one_and_update(
        {"_id": ObjectId(prompt_id), "user_id": current_user["id"]},
        {"$inc": {"copy_count": 1}},
        return_document=True
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="提示词不存在"
        )
    
    # 获取分类名称
    category_name = None
    if result.get("category_id"):
        category = await categories_collection.find_one({
            "_id": ObjectId(result["category_id"])
        })
        if category:
            category_name = category["name"]
    
    return serialize_prompt(result, category_name)
