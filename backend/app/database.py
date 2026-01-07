from motor.motor_asyncio import AsyncIOMotorClient
from .config import get_settings

settings = get_settings()


class Database:
    """MongoDB 数据库管理类"""
    client: AsyncIOMotorClient = None
    
    
db = Database()


async def connect_to_mongodb():
    """连接到 MongoDB Atlas"""
    db.client = AsyncIOMotorClient(settings.mongodb_url)
    print(f"✅ Connected to MongoDB: {settings.mongodb_db_name}")


async def close_mongodb_connection():
    """关闭 MongoDB 连接"""
    if db.client:
        db.client.close()
        print("❌ Disconnected from MongoDB")


def get_database():
    """获取数据库实例"""
    return db.client[settings.mongodb_db_name]


def get_collection(collection_name: str):
    """获取指定集合"""
    return get_database()[collection_name]
