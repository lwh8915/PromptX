#!/usr/bin/env python
"""检查评价数据"""
import asyncio
from dotenv import load_dotenv
load_dotenv()

import os
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def check():
    client = AsyncIOMotorClient(os.environ.get('MONGODB_URL'))
    db = client['promptx']
    
    # 检查评价记录 - 使用正确的集合名
    count = await db.public_prompt_reviews.count_documents({})
    print(f"Total reviews: {count}")
    
    reviews = await db.public_prompt_reviews.find().to_list(10)
    print("\n=== Reviews ===")
    for r in reviews:
        print(f"  Rating: {r.get('rating')}, Prompt: {r.get('prompt_id')}, User: {r.get('user_name')}")
        
        # 检查对应的提示词
        prompt_id = r.get('prompt_id')
        if prompt_id:
            prompt = await db.public_prompts.find_one({'_id': prompt_id})
            if prompt:
                print(f"    -> Prompt: {prompt.get('title','')[:30]}")
                print(f"       avg_rating: {prompt.get('avg_rating')}, review_count: {prompt.get('review_count')}")

if __name__ == "__main__":
    asyncio.run(check())
