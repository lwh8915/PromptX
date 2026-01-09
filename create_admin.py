"""
管理员用户管理脚本

用法:
  python create_admin.py                  # 交互式创建/设置管理员
  python create_admin.py --email xxx      # 将指定邮箱用户设为管理员
  python create_admin.py --username xxx   # 将指定用户名用户设为管理员
  python create_admin.py --create         # 创建新管理员账户
"""
import asyncio
import argparse
from datetime import datetime
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import getpass

# 加载 .env 文件
load_dotenv()

# 密码加密上下文 (与 auth.py 保持一致)
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")


async def get_db():
    """获取数据库连接"""
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("MONGODB_DB_NAME", "PromptX")
    
    if not mongodb_url:
        print("❌ 错误: 未找到 MONGODB_URL 环境变量")
        print("   请确保 .env 文件存在并包含 MONGODB_URL 配置")
        return None, None
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    return client, db


async def set_admin_by_email(email: str):
    """将指定邮箱用户设为管理员"""
    client, db = await get_db()
    if not db:
        return
    
    users = db["users"]
    user = await users.find_one({"email": email})
    
    if not user:
        print(f"❌ 未找到邮箱为 {email} 的用户")
        client.close()
        return
    
    if user.get("is_admin"):
        print(f"⚠️ 用户 {user['username']} 已经是管理员")
    else:
        await users.update_one({"_id": user["_id"]}, {"$set": {"is_admin": True}})
        print(f"✅ 已将用户 {user['username']} ({email}) 设为管理员")
    
    client.close()


async def set_admin_by_username(username: str):
    """将指定用户名用户设为管理员"""
    client, db = await get_db()
    if not db:
        return
    
    users = db["users"]
    user = await users.find_one({"username": username})
    
    if not user:
        print(f"❌ 未找到用户名为 {username} 的用户")
        client.close()
        return
    
    if user.get("is_admin"):
        print(f"⚠️ 用户 {username} 已经是管理员")
    else:
        await users.update_one({"_id": user["_id"]}, {"$set": {"is_admin": True}})
        print(f"✅ 已将用户 {username} ({user['email']}) 设为管理员")
    
    client.close()


async def create_admin_user():
    """交互式创建新管理员账户"""
    client, db = await get_db()
    if not db:
        return
    
    users = db["users"]
    
    print("\n=== 创建新管理员账户 ===\n")
    
    # 输入用户信息
    username = input("用户名: ").strip()
    if not username:
        print("❌ 用户名不能为空")
        client.close()
        return
    
    email = input("邮箱: ").strip()
    if not email:
        print("❌ 邮箱不能为空")
        client.close()
        return
    
    password = getpass.getpass("密码: ")
    if len(password) < 6:
        print("❌ 密码至少需要6个字符")
        client.close()
        return
    
    password_confirm = getpass.getpass("确认密码: ")
    if password != password_confirm:
        print("❌ 两次密码不一致")
        client.close()
        return
    
    # 检查是否已存在
    existing = await users.find_one({
        "$or": [{"email": email}, {"username": username}]
    })
    
    if existing:
        print(f"❌ 用户名或邮箱已被使用")
        client.close()
        return
    
    # 创建用户
    now = datetime.utcnow()
    new_user = {
        "email": email,
        "username": username,
        "hashed_password": pwd_context.hash(password),
        "security_question": "管理员账户",
        "security_answer_hash": pwd_context.hash("admin"),
        "avatar": None,
        "is_admin": True,
        "created_at": now,
        "updated_at": now
    }
    
    result = await users.insert_one(new_user)
    print(f"\n✅ 管理员账户创建成功!")
    print(f"   用户名: {username}")
    print(f"   邮箱: {email}")
    
    client.close()


async def list_admins():
    """列出所有管理员用户"""
    client, db = await get_db()
    if not db:
        return
    
    users = db["users"]
    admins = await users.find({"is_admin": True}).to_list(length=100)
    
    if not admins:
        print("当前没有管理员用户")
    else:
        print(f"\n当前管理员用户 ({len(admins)} 个):")
        for admin in admins:
            print(f"  - {admin['username']} ({admin['email']})")
    
    client.close()


async def interactive_mode():
    """交互式模式"""
    print("\n" + "="*50)
    print("  PromptX 管理员管理工具")
    print("="*50)
    print("\n请选择操作:")
    print("  1. 将现有用户设为管理员")
    print("  2. 创建新管理员账户")
    print("  3. 查看当前管理员列表")
    print("  0. 退出")
    
    choice = input("\n请输入选项 (0-3): ").strip()
    
    if choice == "1":
        identifier = input("\n请输入用户邮箱或用户名: ").strip()
        if "@" in identifier:
            await set_admin_by_email(identifier)
        else:
            await set_admin_by_username(identifier)
    elif choice == "2":
        await create_admin_user()
    elif choice == "3":
        await list_admins()
    elif choice == "0":
        print("退出")
    else:
        print("无效选项")


def main():
    parser = argparse.ArgumentParser(description="PromptX 管理员管理工具")
    parser.add_argument("--email", help="将指定邮箱用户设为管理员")
    parser.add_argument("--username", help="将指定用户名用户设为管理员")
    parser.add_argument("--create", action="store_true", help="创建新管理员账户")
    parser.add_argument("--list", action="store_true", help="查看当前管理员列表")
    
    args = parser.parse_args()
    
    if args.email:
        asyncio.run(set_admin_by_email(args.email))
    elif args.username:
        asyncio.run(set_admin_by_username(args.username))
    elif args.create:
        asyncio.run(create_admin_user())
    elif args.list:
        asyncio.run(list_admins())
    else:
        asyncio.run(interactive_mode())


if __name__ == "__main__":
    main()
