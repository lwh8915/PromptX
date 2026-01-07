from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from ..models import PromptCreate, PromptUpdate, PromptResponse
from ..models.prompt import PromptListResponse
from ..models.prompt_version import (
    PromptVersionResponse, PromptVersionListResponse, 
    PromptCompareResponse, DiffLine
)
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
        current_version=prompt.get("current_version", 1),
        version_count=prompt.get("version_count", 1),
        created_at=prompt["created_at"],
        updated_at=prompt["updated_at"]
    )


@router.get("/tags", response_model=List[str])
async def get_tags(current_user: dict = Depends(get_current_user)):
    """获取所有已使用的标签"""
    prompts_collection = get_collection("prompts")
    
    pipeline = [
        {"$match": {"user_id": current_user["id"]}},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags"}},
        {"$sort": {"_id": 1}}
    ]
    
    result = await prompts_collection.aggregate(pipeline).to_list(length=None)
    return [item["_id"] for item in result]


from pydantic import BaseModel

class AIModifyRequest(BaseModel):
    """AI 修改请求模型"""
    content: str
    suggestion: str

class AIModifyResponse(BaseModel):
    """AI 修改响应模型"""
    modified_content: str


@router.post("/ai-modify", response_model=AIModifyResponse)
async def ai_modify_prompt(
    request: AIModifyRequest,
    current_user: dict = Depends(get_current_user)
):
    """使用 AI 修改提示词"""
    from ..services.llm_service import modify_prompt_with_ai
    
    try:
        modified_content = await modify_prompt_with_ai(request.content, request.suggestion)
        return AIModifyResponse(modified_content=modified_content)
    except ValueError as e:
        print(f"AI Modify Error (ValueError): {str(e)}")  # Debug Log
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"AI Modify Error (Exception): {str(e)}")   # Debug Log
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"AI 服务调用失败: {str(e)}"
        )


@router.get("", response_model=PromptListResponse)
async def get_prompts(
    category_id: Optional[str] = Query(None, description="分类ID"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    tags: Optional[List[str]] = Query(None, alias="tags", description="标签过滤"),  # 支持多标签
    tag: Optional[str] = Query(None, description="兼容旧版标签参数"),               # 兼容旧参数
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
    
    # 标签过滤逻辑
    # 如果传了 tags (列表)，则使用 $all 查询 (包含所有选中的标签)
    if tags:
        query["tags"] = {"$all": tags}
    # 兼容旧版单一 tag 参数
    elif tag:
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
        "current_version": 1,
        "version_count": 1,
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
    """更新提示词（自动保存历史版本）"""
    prompts_collection = get_collection("prompts")
    categories_collection = get_collection("categories")
    versions_collection = get_collection("prompt_versions")
    
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
    
    # 检查是否有实质性内容变更（标题、内容、描述、标签）
    update_data = {k: v for k, v in prompt_data.model_dump().items() if v is not None}
    content_fields = {"title", "content", "description", "tags"}
    has_content_change = any(
        field in update_data and update_data[field] != prompt.get(field)
        for field in content_fields
    )
    
    # 如果有内容变更，保存当前版本到历史
    if has_content_change:
        current_version = prompt.get("current_version", 1)
        
        # 保存当前内容为历史版本
        version_doc = {
            "prompt_id": prompt_id,
            "version": current_version,
            "title": prompt["title"],
            "content": prompt["content"],
            "description": prompt.get("description"),
            "tags": prompt.get("tags", []),
            "user_id": current_user["id"],
            "created_at": prompt.get("updated_at", prompt["created_at"]),
        }
        await versions_collection.insert_one(version_doc)
        
        # 更新版本号
        update_data["current_version"] = current_version + 1
        update_data["version_count"] = prompt.get("version_count", 1) + 1
    
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


# ============ 版本管理 API ============

def serialize_version(version: dict) -> PromptVersionResponse:
    """序列化版本数据"""
    return PromptVersionResponse(
        id=str(version["_id"]),
        prompt_id=version["prompt_id"],
        version=version["version"],
        title=version["title"],
        content=version["content"],
        description=version.get("description"),
        tags=version.get("tags", []),
        change_note=version.get("change_note"),
        created_at=version["created_at"]
    )


@router.get("/{prompt_id}/versions", response_model=PromptVersionListResponse)
async def get_versions(
    prompt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """获取提示词的版本历史"""
    prompts_collection = get_collection("prompts")
    versions_collection = get_collection("prompt_versions")
    
    # 验证提示词存在且属于当前用户
    prompt = await prompts_collection.find_one({
        "_id": ObjectId(prompt_id),
        "user_id": current_user["id"]
    })
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="提示词不存在"
        )
    
    # 获取所有历史版本
    cursor = versions_collection.find({
        "prompt_id": prompt_id,
        "user_id": current_user["id"]
    }).sort("version", -1)
    
    versions = await cursor.to_list(length=100)
    
    # 添加当前版本作为最新版本（如果有历史版本的话）
    current_version_doc = {
        "_id": prompt["_id"],
        "prompt_id": prompt_id,
        "version": prompt.get("current_version", 1),
        "title": prompt["title"],
        "content": prompt["content"],
        "description": prompt.get("description"),
        "tags": prompt.get("tags", []),
        "change_note": "当前版本",
        "created_at": prompt["updated_at"]
    }
    
    all_versions = [serialize_version(current_version_doc)] + [serialize_version(v) for v in versions]
    

    return PromptVersionListResponse(
        items=all_versions,
        total=len(all_versions)
    )


def compute_diff(old_text: str, new_text: str) -> List[DiffLine]:
    """计算两段文本的差异"""
    import difflib
    
    old_lines = old_text.splitlines(keepends=True)
    new_lines = new_text.splitlines(keepends=True)
    
    diff_result = []
    matcher = difflib.SequenceMatcher(None, old_lines, new_lines)
    
    old_line_num = 1
    new_line_num = 1
    
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            for line in old_lines[i1:i2]:
                diff_result.append(DiffLine(
                    type="unchanged",
                    content=line.rstrip('\n\r'),
                    line_number_old=old_line_num,
                    line_number_new=new_line_num
                ))
                old_line_num += 1
                new_line_num += 1
        elif tag == 'delete':
            for line in old_lines[i1:i2]:
                diff_result.append(DiffLine(
                    type="removed",
                    content=line.rstrip('\n\r'),
                    line_number_old=old_line_num
                ))
                old_line_num += 1
        elif tag == 'insert':
            for line in new_lines[j1:j2]:
                diff_result.append(DiffLine(
                    type="added",
                    content=line.rstrip('\n\r'),
                    line_number_new=new_line_num
                ))
                new_line_num += 1
        elif tag == 'replace':
            for line in old_lines[i1:i2]:
                diff_result.append(DiffLine(
                    type="removed",
                    content=line.rstrip('\n\r'),
                    line_number_old=old_line_num
                ))
                old_line_num += 1
            for line in new_lines[j1:j2]:
                diff_result.append(DiffLine(
                    type="added",
                    content=line.rstrip('\n\r'),
                    line_number_new=new_line_num
                ))
                new_line_num += 1
    
    return diff_result


async def _get_version_content(prompt_id: str, version: int, current_user: dict) -> PromptVersionResponse:
    """内部函数：获取特定版本的内容（供 compare 使用）"""
    prompts_collection = get_collection("prompts")
    versions_collection = get_collection("prompt_versions")
    
    # 验证提示词存在且属于当前用户
    prompt = await prompts_collection.find_one({
        "_id": ObjectId(prompt_id),
        "user_id": current_user["id"]
    })
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="提示词不存在"
        )
    
    # 如果请求的是当前版本
    if version == prompt.get("current_version", 1):
        current_version_doc = {
            "_id": prompt["_id"],
            "prompt_id": prompt_id,
            "version": version,
            "title": prompt["title"],
            "content": prompt["content"],
            "description": prompt.get("description"),
            "tags": prompt.get("tags", []),
            "change_note": "当前版本",
            "created_at": prompt["updated_at"]
        }
        return serialize_version(current_version_doc)
    
    # 查找历史版本
    version_doc = await versions_collection.find_one({
        "prompt_id": prompt_id,
        "version": version,
        "user_id": current_user["id"]
    })
    
    if not version_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="版本不存在"
        )
    
    return serialize_version(version_doc)


@router.get("/{prompt_id}/versions/compare", response_model=PromptCompareResponse)
async def compare_versions(
    prompt_id: str,
    v1: int = Query(..., description="旧版本号"),
    v2: int = Query(..., description="新版本号"),
    current_user: dict = Depends(get_current_user)
):
    """对比两个版本"""
    # 获取两个版本的内容
    version1 = await _get_version_content(prompt_id, v1, current_user)
    version2 = await _get_version_content(prompt_id, v2, current_user)
    
    # 计算内容差异
    content_diff = compute_diff(version1.content, version2.content)
    
    # 计算标签差异
    tags1 = set(version1.tags)
    tags2 = set(version2.tags)
    
    return PromptCompareResponse(
        version_old=v1,
        version_new=v2,
        title_old=version1.title,
        title_new=version2.title,
        title_changed=version1.title != version2.title,
        content_diff=content_diff,
        tags_added=list(tags2 - tags1),
        tags_removed=list(tags1 - tags2),
        description_old=version1.description,
        description_new=version2.description,
        description_changed=version1.description != version2.description
    )


@router.get("/{prompt_id}/versions/{version}", response_model=PromptVersionResponse)
async def get_version(
    prompt_id: str,
    version: int,
    current_user: dict = Depends(get_current_user)
):
    """获取特定版本的内容"""
    return await _get_version_content(prompt_id, version, current_user)



@router.post("/{prompt_id}/versions/{version}/restore", response_model=PromptResponse)
async def restore_version(
    prompt_id: str,
    version: int,
    current_user: dict = Depends(get_current_user)
):
    """恢复到指定版本"""
    prompts_collection = get_collection("prompts")
    versions_collection = get_collection("prompt_versions")
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
    
    # 获取目标版本
    target_version = await versions_collection.find_one({
        "prompt_id": prompt_id,
        "version": version,
        "user_id": current_user["id"]
    })
    
    if not target_version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="目标版本不存在"
        )
    
    # 先保存当前内容为历史版本
    current_version = prompt.get("current_version", 1)
    version_doc = {
        "prompt_id": prompt_id,
        "version": current_version,
        "title": prompt["title"],
        "content": prompt["content"],
        "description": prompt.get("description"),
        "tags": prompt.get("tags", []),
        "change_note": f"恢复前的版本（恢复到 v{version}）",
        "user_id": current_user["id"],
        "created_at": prompt.get("updated_at", prompt["created_at"]),
    }
    await versions_collection.insert_one(version_doc)
    
    # 恢复内容
    now = datetime.utcnow()
    await prompts_collection.update_one(
        {"_id": ObjectId(prompt_id)},
        {"$set": {
            "title": target_version["title"],
            "content": target_version["content"],
            "description": target_version.get("description"),
            "tags": target_version.get("tags", []),
            "current_version": current_version + 1,
            "version_count": prompt.get("version_count", 1) + 1,
            "updated_at": now
        }}
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

