"""
团队管理路由
提供团队创建、管理、成员邀请、提示词共享等功能
"""
from datetime import datetime
from typing import Optional
import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId
from pydantic import BaseModel, Field

from ..database import get_collection
from ..services.auth import get_current_user

router = APIRouter()


# ============== Pydantic Models ==============

class TeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=200)


class TeamUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=200)


class TeamResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    owner_id: str
    owner_name: str
    invite_code: str
    member_count: int
    my_role: Optional[str]  # owner / admin / member
    created_at: datetime


class TeamMemberResponse(BaseModel):
    user_id: str
    username: str
    role: str
    joined_at: datetime


class JoinTeamRequest(BaseModel):
    invite_code: str = Field(..., min_length=6, max_length=10)


class UpdateMemberRole(BaseModel):
    role: str = Field(..., pattern="^(admin|member)$")


class SharePromptRequest(BaseModel):
    prompt_id: str


class TeamPromptResponse(BaseModel):
    id: str
    prompt_id: str
    title: str
    content: str
    description: Optional[str]
    tags: list
    category: str
    shared_by: str
    shared_by_name: str
    shared_at: datetime


# 团队分类模型
class TeamCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=30)
    icon: Optional[str] = Field("📁", max_length=10)


class TeamCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=30)
    icon: Optional[str] = Field(None, max_length=10)
    order: Optional[int] = None


class TeamCategoryResponse(BaseModel):
    id: str
    team_id: str
    name: str
    icon: str
    order: int


# 团队提示词更新模型
class TeamPromptUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    description: Optional[str] = None
    change_note: Optional[str] = "更新内容"


# ============== Helper Functions ==============

def generate_invite_code(length: int = 8) -> str:
    """生成随机邀请码"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


async def get_user_role_in_team(team_id: str, user_id: str) -> Optional[str]:
    """获取用户在团队中的角色"""
    members_collection = get_collection("team_members")
    member = await members_collection.find_one({
        "team_id": ObjectId(team_id),
        "user_id": ObjectId(user_id)
    })
    return member.get("role") if member else None


async def check_team_permission(team_id: str, user_id: str, required_roles: list) -> str:
    """检查用户是否有指定权限，返回用户角色"""
    role = await get_user_role_in_team(team_id, user_id)
    if not role:
        raise HTTPException(status_code=403, detail="您不是该团队成员")
    if role not in required_roles:
        raise HTTPException(status_code=403, detail="权限不足")
    return role


def serialize_team(team: dict, user_id: str = None, role: str = None) -> dict:
    """序列化团队数据"""
    return {
        "id": str(team["_id"]),
        "name": team.get("name", ""),
        "description": team.get("description"),
        "owner_id": str(team.get("owner_id", "")),
        "owner_name": team.get("owner_name", ""),
        "invite_code": team.get("invite_code", ""),
        "member_count": team.get("member_count", 1),
        "my_role": role,
        "created_at": team.get("created_at", datetime.utcnow())
    }


# ============== Team CRUD ==============

@router.post("", response_model=TeamResponse)
async def create_team(
    data: TeamCreate,
    current_user: dict = Depends(get_current_user)
):
    """创建团队"""
    teams_collection = get_collection("teams")
    members_collection = get_collection("team_members")
    user_id = ObjectId(current_user["id"])
    
    # 生成唯一邀请码
    invite_code = generate_invite_code()
    while await teams_collection.find_one({"invite_code": invite_code}):
        invite_code = generate_invite_code()
    
    now = datetime.utcnow()
    new_team = {
        "name": data.name,
        "description": data.description,
        "owner_id": user_id,
        "owner_name": current_user.get("username", ""),
        "invite_code": invite_code,
        "member_count": 1,
        "created_at": now,
        "updated_at": now
    }
    
    result = await teams_collection.insert_one(new_team)
    team_id = result.inserted_id
    
    # 将创建者添加为 owner
    await members_collection.insert_one({
        "team_id": team_id,
        "user_id": user_id,
        "role": "owner",
        "joined_at": now
    })
    
    new_team["_id"] = team_id
    return serialize_team(new_team, current_user["id"], "owner")


@router.get("", response_model=list)
async def get_my_teams(current_user: dict = Depends(get_current_user)):
    """获取我加入的所有团队"""
    members_collection = get_collection("team_members")
    teams_collection = get_collection("teams")
    user_id = ObjectId(current_user["id"])
    
    # 查找用户所属的所有团队
    memberships = await members_collection.find({"user_id": user_id}).to_list(100)
    
    result = []
    for membership in memberships:
        team = await teams_collection.find_one({"_id": membership["team_id"]})
        if team:
            result.append(serialize_team(team, current_user["id"], membership["role"]))
    
    return result


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """获取团队详情"""
    teams_collection = get_collection("teams")
    
    role = await get_user_role_in_team(team_id, current_user["id"])
    if not role:
        raise HTTPException(status_code=403, detail="您不是该团队成员")
    
    team = await teams_collection.find_one({"_id": ObjectId(team_id)})
    if not team:
        raise HTTPException(status_code=404, detail="团队不存在")
    
    return serialize_team(team, current_user["id"], role)


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: str,
    data: TeamUpdate,
    current_user: dict = Depends(get_current_user)
):
    """更新团队信息（仅 owner/admin）"""
    await check_team_permission(team_id, current_user["id"], ["owner", "admin"])
    
    teams_collection = get_collection("teams")
    
    update_data = {"updated_at": datetime.utcnow()}
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    
    await teams_collection.update_one(
        {"_id": ObjectId(team_id)},
        {"$set": update_data}
    )
    
    team = await teams_collection.find_one({"_id": ObjectId(team_id)})
    role = await get_user_role_in_team(team_id, current_user["id"])
    return serialize_team(team, current_user["id"], role)


@router.delete("/{team_id}")
async def delete_team(
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """删除团队（仅 owner）"""
    await check_team_permission(team_id, current_user["id"], ["owner"])
    
    teams_collection = get_collection("teams")
    members_collection = get_collection("team_members")
    team_prompts_collection = get_collection("team_prompts")
    
    # 删除团队及相关数据
    await teams_collection.delete_one({"_id": ObjectId(team_id)})
    await members_collection.delete_many({"team_id": ObjectId(team_id)})
    await team_prompts_collection.delete_many({"team_id": ObjectId(team_id)})
    
    return {"message": "团队已删除"}


@router.post("/{team_id}/regenerate-code")
async def regenerate_invite_code(
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """重新生成邀请码（仅 owner/admin）"""
    await check_team_permission(team_id, current_user["id"], ["owner", "admin"])
    
    teams_collection = get_collection("teams")
    
    new_code = generate_invite_code()
    while await teams_collection.find_one({"invite_code": new_code, "_id": {"$ne": ObjectId(team_id)}}):
        new_code = generate_invite_code()
    
    await teams_collection.update_one(
        {"_id": ObjectId(team_id)},
        {"$set": {"invite_code": new_code, "updated_at": datetime.utcnow()}}
    )
    
    return {"invite_code": new_code}


# ============== Member Management ==============

@router.post("/join")
async def join_team(
    data: JoinTeamRequest,
    current_user: dict = Depends(get_current_user)
):
    """通过邀请码加入团队"""
    teams_collection = get_collection("teams")
    members_collection = get_collection("team_members")
    user_id = ObjectId(current_user["id"])
    
    # 查找团队
    team = await teams_collection.find_one({"invite_code": data.invite_code.upper()})
    if not team:
        raise HTTPException(status_code=404, detail="邀请码无效")
    
    team_id = team["_id"]
    
    # 检查是否已经是成员
    existing = await members_collection.find_one({
        "team_id": team_id,
        "user_id": user_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="您已经是该团队成员")
    
    # 加入团队
    await members_collection.insert_one({
        "team_id": team_id,
        "user_id": user_id,
        "role": "member",
        "joined_at": datetime.utcnow()
    })
    
    # 更新成员计数
    await teams_collection.update_one(
        {"_id": team_id},
        {"$inc": {"member_count": 1}}
    )
    
    return {
        "message": f"成功加入团队「{team['name']}」",
        "team_id": str(team_id),
        "team_name": team["name"]
    }


@router.get("/{team_id}/members", response_model=list)
async def get_team_members(
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """获取团队成员列表"""
    await check_team_permission(team_id, current_user["id"], ["owner", "admin", "member"])
    
    members_collection = get_collection("team_members")
    users_collection = get_collection("users")
    
    members = await members_collection.find({"team_id": ObjectId(team_id)}).to_list(100)
    
    result = []
    for member in members:
        user = await users_collection.find_one({"_id": member["user_id"]})
        result.append({
            "user_id": str(member["user_id"]),
            "username": user.get("username", "未知用户") if user else "未知用户",
            "role": member["role"],
            "joined_at": member["joined_at"]
        })
    
    # 按角色排序：owner > admin > member
    role_order = {"owner": 0, "admin": 1, "member": 2}
    result.sort(key=lambda x: role_order.get(x["role"], 3))
    
    return result


@router.put("/{team_id}/members/{user_id}")
async def update_member_role(
    team_id: str,
    user_id: str,
    data: UpdateMemberRole,
    current_user: dict = Depends(get_current_user)
):
    """更新成员角色（仅 owner）"""
    await check_team_permission(team_id, current_user["id"], ["owner"])
    
    members_collection = get_collection("team_members")
    
    # 不能修改 owner 的角色
    target_member = await members_collection.find_one({
        "team_id": ObjectId(team_id),
        "user_id": ObjectId(user_id)
    })
    if not target_member:
        raise HTTPException(status_code=404, detail="成员不存在")
    if target_member["role"] == "owner":
        raise HTTPException(status_code=400, detail="无法更改团队创建者的角色")
    
    await members_collection.update_one(
        {"team_id": ObjectId(team_id), "user_id": ObjectId(user_id)},
        {"$set": {"role": data.role}}
    )
    
    return {"message": "角色已更新"}


@router.delete("/{team_id}/members/{user_id}")
async def remove_member(
    team_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """移除成员（仅 owner/admin）"""
    role = await check_team_permission(team_id, current_user["id"], ["owner", "admin"])
    
    members_collection = get_collection("team_members")
    teams_collection = get_collection("teams")
    
    # 检查目标成员
    target_member = await members_collection.find_one({
        "team_id": ObjectId(team_id),
        "user_id": ObjectId(user_id)
    })
    if not target_member:
        raise HTTPException(status_code=404, detail="成员不存在")
    
    # 不能移除 owner
    if target_member["role"] == "owner":
        raise HTTPException(status_code=400, detail="无法移除团队创建者")
    
    # admin 不能移除其他 admin
    if role == "admin" and target_member["role"] == "admin":
        raise HTTPException(status_code=403, detail="管理员无法移除其他管理员")
    
    # 移除成员
    await members_collection.delete_one({
        "team_id": ObjectId(team_id),
        "user_id": ObjectId(user_id)
    })
    
    # 更新成员计数
    await teams_collection.update_one(
        {"_id": ObjectId(team_id)},
        {"$inc": {"member_count": -1}}
    )
    
    return {"message": "成员已移除"}


@router.delete("/{team_id}/leave")
async def leave_team(
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """退出团队"""
    role = await get_user_role_in_team(team_id, current_user["id"])
    if not role:
        raise HTTPException(status_code=403, detail="您不是该团队成员")
    
    if role == "owner":
        raise HTTPException(status_code=400, detail="团队创建者无法退出，请先转让或删除团队")
    
    members_collection = get_collection("team_members")
    teams_collection = get_collection("teams")
    
    await members_collection.delete_one({
        "team_id": ObjectId(team_id),
        "user_id": ObjectId(current_user["id"])
    })
    
    await teams_collection.update_one(
        {"_id": ObjectId(team_id)},
        {"$inc": {"member_count": -1}}
    )
    
    return {"message": "已退出团队"}


# ============== Team Prompts ==============

@router.post("/{team_id}/prompts")
async def share_prompt_to_team(
    team_id: str,
    data: SharePromptRequest,
    current_user: dict = Depends(get_current_user)
):
    """共享提示词到团队"""
    await check_team_permission(team_id, current_user["id"], ["owner", "admin", "member"])
    
    prompts_collection = get_collection("prompts")
    team_prompts_collection = get_collection("team_prompts")
    user_id = ObjectId(current_user["id"])
    
    # 验证提示词存在且属于当前用户
    # 支持 user_id 为 ObjectId 或字符串两种格式
    prompt = await prompts_collection.find_one({
        "_id": ObjectId(data.prompt_id),
        "$or": [
            {"user_id": user_id},
            {"user_id": str(user_id)}
        ]
    })
    if not prompt:
        raise HTTPException(status_code=404, detail="提示词不存在或无权限共享")
    
    # 检查是否已共享
    existing = await team_prompts_collection.find_one({
        "team_id": ObjectId(team_id),
        "prompt_id": ObjectId(data.prompt_id)
    })
    if existing:
        raise HTTPException(status_code=400, detail="该提示词已共享到团队")
    
    # 创建共享记录
    now = datetime.utcnow()
    share_result = await team_prompts_collection.insert_one({
        "team_id": ObjectId(team_id),
        "prompt_id": ObjectId(data.prompt_id),
        "shared_by": user_id,
        "shared_at": now,
        "title": prompt.get("title", ""),
        "content": prompt.get("content", ""),
        "description": prompt.get("description"),
        "tags": prompt.get("tags", []),
        "version_count": 1,
        "team_copy_count": 0  # 团队内的复制计数
    })
    
    # 创建初始版本记录
    versions_collection = get_collection("team_prompt_versions")
    await versions_collection.insert_one({
        "team_id": ObjectId(team_id),
        "prompt_id": ObjectId(data.prompt_id),
        "share_id": share_result.inserted_id,
        "version": 1,
        "title": prompt.get("title", ""),
        "content": prompt.get("content", ""),
        "description": prompt.get("description"),
        "tags": prompt.get("tags", []),
        "modified_by": user_id,
        "modified_by_name": current_user.get("username", ""),
        "modified_at": now,
        "change_note": "初始版本（共享时创建）"
    })
    
    return {"message": "提示词已共享到团队"}


@router.get("/{team_id}/prompts")
async def get_team_prompts(
    team_id: str,
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """获取团队提示词列表"""
    await check_team_permission(team_id, current_user["id"], ["owner", "admin", "member"])
    
    team_prompts_collection = get_collection("team_prompts")
    prompts_collection = get_collection("prompts")
    users_collection = get_collection("users")
    team_categories_collection = get_collection("team_categories")
    
    # 获取团队分类映射
    team_cats = await team_categories_collection.find({"team_id": ObjectId(team_id)}).to_list(100)
    cat_map = {str(c["_id"]): c for c in team_cats}
    
    # 获取所有团队共享的提示词ID
    shares = await team_prompts_collection.find({"team_id": ObjectId(team_id)}).to_list(1000)
    prompt_ids = [s["prompt_id"] for s in shares]
    share_map = {str(s["prompt_id"]): s for s in shares}
    
    if not prompt_ids:
        return {"items": [], "total": 0, "page": page, "page_size": page_size}
    
    # 构建查询
    query = {"_id": {"$in": prompt_ids}}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}}
        ]
    if category:
        query["category"] = category
    
    # 分页查询
    total = await prompts_collection.count_documents(query)
    skip = (page - 1) * page_size
    prompts = await prompts_collection.find(query).sort("updated_at", -1).skip(skip).limit(page_size).to_list(page_size)
    
    # 构建响应
    items = []
    for prompt in prompts:
        prompt_id_str = str(prompt["_id"])
        share_info = share_map.get(prompt_id_str, {})
        
        # 获取分享者信息
        shared_by_user = await users_collection.find_one({"_id": share_info.get("shared_by")})
        
        # 获取团队分类名称
        team_cat_id = share_info.get("team_category_id")
        team_cat_name = None
        if team_cat_id:
            cat_info = cat_map.get(str(team_cat_id))
            if cat_info:
                team_cat_name = cat_info.get("name")
        
        items.append({
            "id": prompt_id_str,
            "prompt_id": prompt_id_str,
            "title": share_info.get("title", prompt.get("title", "")),
            "content": share_info.get("content", prompt.get("content", "")),
            "description": share_info.get("description", prompt.get("description")),
            "tags": share_info.get("tags", prompt.get("tags", [])),
            "category": team_cat_name,
            "shared_by": str(share_info.get("shared_by", "")),
            "shared_by_name": shared_by_user.get("username", "") if shared_by_user else "",
            "shared_at": share_info.get("shared_at", datetime.utcnow()),
            "version_count": share_info.get("version_count", 1),
            "copy_count": share_info.get("team_copy_count", 0),
            "team_category_id": str(team_cat_id) if team_cat_id else None
        })
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.post("/{team_id}/prompts/{prompt_id}/copy")
async def increment_team_copy_count(
    team_id: str,
    prompt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """增加团队提示词的复制计数"""
    await check_team_permission(team_id, current_user["id"], ["owner", "admin", "member"])
    
    team_prompts_collection = get_collection("team_prompts")
    
    result = await team_prompts_collection.update_one(
        {"team_id": ObjectId(team_id), "prompt_id": ObjectId(prompt_id)},
        {"$inc": {"team_copy_count": 1}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="团队中不存在该提示词")
    
    return {"message": "复制计数已更新"}


@router.delete("/{team_id}/prompts/{prompt_id}")
async def unshare_prompt(
    team_id: str,
    prompt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """取消共享提示词"""
    role = await check_team_permission(team_id, current_user["id"], ["owner", "admin", "member"])
    
    team_prompts_collection = get_collection("team_prompts")
    user_id = ObjectId(current_user["id"])
    
    # 查找共享记录
    share = await team_prompts_collection.find_one({
        "team_id": ObjectId(team_id),
        "prompt_id": ObjectId(prompt_id)
    })
    if not share:
        raise HTTPException(status_code=404, detail="共享记录不存在")
    
    # 权限检查：自己的可以取消，admin/owner 可以取消所有
    if str(share["shared_by"]) != current_user["id"] and role == "member":
        raise HTTPException(status_code=403, detail="只能取消自己共享的提示词")
    
    await team_prompts_collection.delete_one({
        "team_id": ObjectId(team_id),
        "prompt_id": ObjectId(prompt_id)
    })
    
    return {"message": "已取消共享"}


@router.post("/{team_id}/prompts/{prompt_id}/copy")
async def copy_team_prompt_to_personal(
    team_id: str,
    prompt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """复制团队提示词到个人库"""
    await check_team_permission(team_id, current_user["id"], ["owner", "admin", "member"])
    
    team_prompts_collection = get_collection("team_prompts")
    prompts_collection = get_collection("prompts")
    user_id = ObjectId(current_user["id"])
    
    # 验证是团队分享的提示词
    share = await team_prompts_collection.find_one({
        "team_id": ObjectId(team_id),
        "prompt_id": ObjectId(prompt_id)
    })
    if not share:
        raise HTTPException(status_code=404, detail="团队中不存在该提示词")
    
    # 获取原提示词
    original = await prompts_collection.find_one({"_id": ObjectId(prompt_id)})
    if not original:
        raise HTTPException(status_code=404, detail="原提示词已被删除")
    
    # 创建副本
    now = datetime.utcnow()
    new_prompt = {
        "user_id": user_id,
        "title": f"{original.get('title', '')} (副本)",
        "content": original.get("content", ""),
        "description": original.get("description"),
        "tags": original.get("tags", []),
        "category": original.get("category", "其他"),
        "is_favorite": False,
        "created_at": now,
        "updated_at": now
    }
    
    result = await prompts_collection.insert_one(new_prompt)
    
    return {
        "message": "已复制到个人库",
        "prompt_id": str(result.inserted_id)
    }


# ============== Team Categories ==============

@router.get("/{team_id}/categories", response_model=list)
async def get_team_categories(
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """获取团队分类列表"""
    await check_team_permission(team_id, current_user["id"], ["owner", "admin", "member"])
    
    categories_collection = get_collection("team_categories")
    
    categories = await categories_collection.find(
        {"team_id": ObjectId(team_id)}
    ).sort("order", 1).to_list(100)
    
    return [
        {
            "id": str(cat["_id"]),
            "team_id": str(cat["team_id"]),
            "name": cat["name"],
            "icon": cat.get("icon", "📁"),
            "order": cat.get("order", 0),
            "created_by": str(cat.get("created_by", "")),
            "created_at": cat.get("created_at", datetime.utcnow())
        }
        for cat in categories
    ]


@router.post("/{team_id}/categories", response_model=TeamCategoryResponse)
async def create_team_category(
    team_id: str,
    data: TeamCategoryCreate,
    current_user: dict = Depends(get_current_user)
):
    """创建团队分类（仅 owner 可创建）"""
    await check_team_permission(team_id, current_user["id"], ["owner"])
    
    categories_collection = get_collection("team_categories")
    user_id = ObjectId(current_user["id"])
    
    # 检查是否已存在同名分类
    existing = await categories_collection.find_one({
        "team_id": ObjectId(team_id),
        "name": data.name
    })
    if existing:
        raise HTTPException(status_code=400, detail="该分类名称已存在")
    
    # 获取当前最大 order
    max_order_cat = await categories_collection.find_one(
        {"team_id": ObjectId(team_id)},
        sort=[("order", -1)]
    )
    next_order = (max_order_cat.get("order", 0) + 1) if max_order_cat else 0
    
    now = datetime.utcnow()
    new_category = {
        "team_id": ObjectId(team_id),
        "name": data.name,
        "icon": data.icon or "📁",
        "order": next_order,
        "created_by": user_id,
        "created_at": now
    }
    
    result = await categories_collection.insert_one(new_category)
    
    return {
        "id": str(result.inserted_id),
        "team_id": team_id,
        "name": data.name,
        "icon": data.icon or "📁",
        "order": next_order,
        "created_by": current_user["id"],
        "created_at": now
    }


@router.put("/{team_id}/categories/{category_id}", response_model=TeamCategoryResponse)
async def update_team_category(
    team_id: str,
    category_id: str,
    data: TeamCategoryUpdate,
    current_user: dict = Depends(get_current_user)
):
    """更新团队分类（仅 owner 可编辑）"""
    await check_team_permission(team_id, current_user["id"], ["owner"])
    
    categories_collection = get_collection("team_categories")
    
    category = await categories_collection.find_one({
        "_id": ObjectId(category_id),
        "team_id": ObjectId(team_id)
    })
    if not category:
        raise HTTPException(status_code=404, detail="分类不存在")
    
    update_data = {}
    if data.name is not None:
        # 检查名称冲突
        existing = await categories_collection.find_one({
            "team_id": ObjectId(team_id),
            "name": data.name,
            "_id": {"$ne": ObjectId(category_id)}
        })
        if existing:
            raise HTTPException(status_code=400, detail="该分类名称已存在")
        update_data["name"] = data.name
    if data.icon is not None:
        update_data["icon"] = data.icon
    if data.order is not None:
        update_data["order"] = data.order
    
    if update_data:
        await categories_collection.update_one(
            {"_id": ObjectId(category_id)},
            {"$set": update_data}
        )
    
    updated = await categories_collection.find_one({"_id": ObjectId(category_id)})
    
    return {
        "id": str(updated["_id"]),
        "team_id": str(updated["team_id"]),
        "name": updated["name"],
        "icon": updated.get("icon", "📁"),
        "order": updated.get("order", 0),
        "created_by": str(updated.get("created_by", "")),
        "created_at": updated.get("created_at", datetime.utcnow())
    }


@router.delete("/{team_id}/categories/{category_id}")
async def delete_team_category(
    team_id: str,
    category_id: str,
    current_user: dict = Depends(get_current_user)
):
    """删除团队分类（仅 owner 可删除）"""
    await check_team_permission(team_id, current_user["id"], ["owner"])
    
    categories_collection = get_collection("team_categories")
    team_prompts_collection = get_collection("team_prompts")
    
    category = await categories_collection.find_one({
        "_id": ObjectId(category_id),
        "team_id": ObjectId(team_id)
    })
    if not category:
        raise HTTPException(status_code=404, detail="分类不存在")
    
    # 将该分类下的提示词移到"未分类"
    await team_prompts_collection.update_many(
        {"team_id": ObjectId(team_id), "team_category_id": ObjectId(category_id)},
        {"$unset": {"team_category_id": ""}}
    )
    
    await categories_collection.delete_one({"_id": ObjectId(category_id)})
    
    return {"message": "分类已删除"}


# ============== Update prompt team category ==============

@router.put("/{team_id}/prompts/{prompt_id}/category")
async def update_team_prompt_category(
    team_id: str,
    prompt_id: str,
    category_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """更新团队提示词的分类"""
    await check_team_permission(team_id, current_user["id"], ["owner", "admin", "member"])
    
    team_prompts_collection = get_collection("team_prompts")
    categories_collection = get_collection("team_categories")
    
    # 验证提示词在团队中
    share = await team_prompts_collection.find_one({
        "team_id": ObjectId(team_id),
        "prompt_id": ObjectId(prompt_id)
    })
    if not share:
        raise HTTPException(status_code=404, detail="团队中不存在该提示词")
    
    if category_id:
        # 验证分类存在
        category = await categories_collection.find_one({
            "_id": ObjectId(category_id),
            "team_id": ObjectId(team_id)
        })
        if not category:
            raise HTTPException(status_code=404, detail="分类不存在")
        
        await team_prompts_collection.update_one(
            {"team_id": ObjectId(team_id), "prompt_id": ObjectId(prompt_id)},
            {"$set": {"team_category_id": ObjectId(category_id)}}
        )
    else:
        # 移除分类
        await team_prompts_collection.update_one(
            {"team_id": ObjectId(team_id), "prompt_id": ObjectId(prompt_id)},
            {"$unset": {"team_category_id": ""}}
        )
    
    return {"message": "分类已更新"}


# ============== Team Prompt Version Management ==============

@router.get("/{team_id}/prompts/{prompt_id}/versions")
async def get_team_prompt_versions(
    team_id: str,
    prompt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """获取团队提示词版本历史"""
    await check_team_permission(team_id, current_user["id"], ["owner", "admin", "member"])
    
    versions_collection = get_collection("team_prompt_versions")
    
    versions = await versions_collection.find({
        "team_id": ObjectId(team_id),
        "prompt_id": ObjectId(prompt_id)
    }).sort("version", -1).to_list(100)
    
    return [
        {
            "id": str(v["_id"]),
            "version": v["version"],
            "title": v.get("title", ""),
            "content": v.get("content", ""),
            "description": v.get("description"),
            "tags": v.get("tags", []),
            "modified_by": str(v.get("modified_by", "")),
            "modified_by_name": v.get("modified_by_name", ""),
            "modified_at": v.get("modified_at"),
            "change_note": v.get("change_note", "")
        }
        for v in versions
    ]


@router.put("/{team_id}/prompts/{prompt_id}")
async def update_team_prompt(
    team_id: str,
    prompt_id: str,
    data: TeamPromptUpdate,
    current_user: dict = Depends(get_current_user)
):
    """编辑团队提示词（创建新版本）"""
    await check_team_permission(team_id, current_user["id"], ["owner", "admin", "member"])
    
    team_prompts_collection = get_collection("team_prompts")
    versions_collection = get_collection("team_prompt_versions")
    user_id = ObjectId(current_user["id"])
    
    # 获取当前团队提示词
    share = await team_prompts_collection.find_one({
        "team_id": ObjectId(team_id),
        "prompt_id": ObjectId(prompt_id)
    })
    if not share:
        raise HTTPException(status_code=404, detail="团队中不存在该提示词")
    
    # 准备更新数据
    now = datetime.utcnow()
    update_data = {}
    if data.title is not None:
        update_data["title"] = data.title
    if data.content is not None:
        update_data["content"] = data.content
    if data.description is not None:
        update_data["description"] = data.description
    
    if not update_data:
        return {"message": "无需更新"}
    
    # 更新团队提示词记录
    current_version = share.get("version_count", 1)
    new_version = current_version + 1
    
    update_data["version_count"] = new_version
    await team_prompts_collection.update_one(
        {"_id": share["_id"]},
        {"$set": update_data}
    )
    
    # 创建新版本记录
    await versions_collection.insert_one({
        "team_id": ObjectId(team_id),
        "prompt_id": ObjectId(prompt_id),
        "share_id": share["_id"],
        "version": new_version,
        "title": update_data.get("title", share.get("title", "")),
        "content": update_data.get("content", share.get("content", "")),
        "description": update_data.get("description", share.get("description")),
        "tags": share.get("tags", []),
        "modified_by": user_id,
        "modified_by_name": current_user.get("username", ""),
        "modified_at": now,
        "change_note": data.change_note or "更新内容"
    })
    
    return {"message": "提示词已更新", "version": new_version}


@router.post("/{team_id}/prompts/{prompt_id}/restore/{version}")
async def restore_team_prompt_version(
    team_id: str,
    prompt_id: str,
    version: int,
    current_user: dict = Depends(get_current_user)
):
    """恢复团队提示词到指定版本"""
    await check_team_permission(team_id, current_user["id"], ["owner", "admin", "member"])
    
    team_prompts_collection = get_collection("team_prompts")
    versions_collection = get_collection("team_prompt_versions")
    user_id = ObjectId(current_user["id"])
    
    # 获取目标版本
    target_version = await versions_collection.find_one({
        "team_id": ObjectId(team_id),
        "prompt_id": ObjectId(prompt_id),
        "version": version
    })
    if not target_version:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    # 获取当前团队提示词
    share = await team_prompts_collection.find_one({
        "team_id": ObjectId(team_id),
        "prompt_id": ObjectId(prompt_id)
    })
    if not share:
        raise HTTPException(status_code=404, detail="团队中不存在该提示词")
    
    # 更新团队提示词
    now = datetime.utcnow()
    current_version = share.get("version_count", 1)
    new_version = current_version + 1
    
    await team_prompts_collection.update_one(
        {"_id": share["_id"]},
        {"$set": {
            "title": target_version.get("title", ""),
            "content": target_version.get("content", ""),
            "description": target_version.get("description"),
            "tags": target_version.get("tags", []),
            "version_count": new_version
        }}
    )
    
    # 创建恢复版本记录
    await versions_collection.insert_one({
        "team_id": ObjectId(team_id),
        "prompt_id": ObjectId(prompt_id),
        "share_id": share["_id"],
        "version": new_version,
        "title": target_version.get("title", ""),
        "content": target_version.get("content", ""),
        "description": target_version.get("description"),
        "tags": target_version.get("tags", []),
        "modified_by": user_id,
        "modified_by_name": current_user.get("username", ""),
        "modified_at": now,
        "change_note": f"恢复为第 {version} 版"
    })
    
    return {"message": f"已恢复为第 {version} 版", "new_version": new_version}
