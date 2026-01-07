from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from datetime import datetime
from bson import ObjectId

from ..models import CategoryCreate, CategoryUpdate, CategoryResponse
from ..database import get_collection
from ..services.auth import get_current_user

router = APIRouter()


def serialize_category(category: dict, children: List[dict] = None, prompt_count: int = 0) -> CategoryResponse:
    """序列化分类数据"""
    return CategoryResponse(
        id=str(category["_id"]),
        name=category["name"],
        parent_id=category.get("parent_id"),
        icon=category.get("icon"),
        order=category.get("order", 0),
        user_id=category["user_id"],
        children=children or [],
        prompt_count=prompt_count,
        created_at=category["created_at"]
    )


@router.get("", response_model=List[CategoryResponse])
async def get_categories(current_user: dict = Depends(get_current_user)):
    """获取用户的所有分类（树形结构）"""
    categories_collection = get_collection("categories")
    prompts_collection = get_collection("prompts")
    
    # 获取用户的所有分类
    cursor = categories_collection.find({"user_id": current_user["id"]}).sort("order", 1)
    categories = await cursor.to_list(length=None)
    
    # 获取每个分类的直接提示词数量
    direct_counts = {}
    for cat in categories:
        cat_id = str(cat["_id"])
        count = await prompts_collection.count_documents({
            "user_id": current_user["id"],
            "category_id": cat_id
        })
        direct_counts[cat_id] = count
    
    # 构建分类映射
    category_map = {}
    for cat in categories:
        cat_id = str(cat["_id"])
        category_map[cat_id] = {
            "data": cat,
            "children": [],
            "direct_count": direct_counts[cat_id]
        }
    
    # 构建树形结构
    root_categories = []
    for cat in categories:
        cat_id = str(cat["_id"])
        parent_id = cat.get("parent_id")
        
        if parent_id and parent_id in category_map:
            # 添加到父分类的 children 中
            category_map[parent_id]["children"].append(category_map[cat_id])
        else:
            # 根分类
            root_categories.append(category_map[cat_id])
    
    # 递归计算总数（包含子分类）并序列化
    def serialize_with_children(cat_info):
        children = [serialize_with_children(child) for child in cat_info["children"]]
        # 计算总数 = 直接数量 + 所有子分类的总数
        total_count = cat_info["direct_count"] + sum(c.prompt_count for c in children)
        return serialize_category(
            cat_info["data"], 
            children=children,
            prompt_count=total_count
        )
    
    return [serialize_with_children(cat) for cat in root_categories]


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: CategoryCreate,
    current_user: dict = Depends(get_current_user)
):
    """创建新分类"""
    categories_collection = get_collection("categories")
    
    # 如果有父分类，验证父分类存在
    if category_data.parent_id:
        parent = await categories_collection.find_one({
            "_id": ObjectId(category_data.parent_id),
            "user_id": current_user["id"]
        })
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="父分类不存在"
            )
    
    # 检查同级分类是否有同名
    existing = await categories_collection.find_one({
        "name": category_data.name,
        "parent_id": category_data.parent_id,  # 同一父级下
        "user_id": current_user["id"]
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"同级分类下已存在名为 \"{category_data.name}\" 的分类"
        )
    
    now = datetime.utcnow()
    category_dict = {
        "name": category_data.name,
        "parent_id": category_data.parent_id,
        "icon": category_data.icon,
        "order": category_data.order,
        "user_id": current_user["id"],
        "created_at": now,
        "updated_at": now,
    }
    
    result = await categories_collection.insert_one(category_dict)
    category_dict["_id"] = result.inserted_id
    
    return serialize_category(category_dict)


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: str,
    category_data: CategoryUpdate,
    current_user: dict = Depends(get_current_user)
):
    """更新分类"""
    categories_collection = get_collection("categories")
    
    # 验证分类存在
    category = await categories_collection.find_one({
        "_id": ObjectId(category_id),
        "user_id": current_user["id"]
    })
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="分类不存在"
        )
    
    # 更新字段
    update_data = {k: v for k, v in category_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await categories_collection.update_one(
        {"_id": ObjectId(category_id)},
        {"$set": update_data}
    )
    
    # 获取更新后的分类
    updated_category = await categories_collection.find_one({"_id": ObjectId(category_id)})
    return serialize_category(updated_category)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    current_user: dict = Depends(get_current_user)
):
    """删除分类"""
    categories_collection = get_collection("categories")
    prompts_collection = get_collection("prompts")
    
    # 验证分类存在
    category = await categories_collection.find_one({
        "_id": ObjectId(category_id),
        "user_id": current_user["id"]
    })
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="分类不存在"
        )
    
    # 删除该分类下的所有子分类
    await categories_collection.delete_many({
        "parent_id": category_id,
        "user_id": current_user["id"]
    })
    
    # 将该分类下的提示词的分类设为空
    await prompts_collection.update_many(
        {"category_id": category_id, "user_id": current_user["id"]},
        {"$set": {"category_id": None}}
    )
    
    # 删除分类
    await categories_collection.delete_one({"_id": ObjectId(category_id)})
