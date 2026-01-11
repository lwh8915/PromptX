"""
Database migration script to add avg_rating and review_count fields to existing public_prompts.
Run this script once to fix old data that's missing these fields.

Usage:
    cd backend
    python -m app.scripts.migrate_rating_fields
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "promptx")


async def migrate():
    """Add avg_rating and review_count to prompts that don't have them."""
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    prompts_collection = db["public_prompts"]
    reviews_collection = db["public_prompt_reviews"]
    
    # Find all prompts missing avg_rating or review_count
    cursor = prompts_collection.find({
        "$or": [
            {"avg_rating": {"$exists": False}},
            {"review_count": {"$exists": False}}
        ]
    })
    
    updated_count = 0
    async for prompt in cursor:
        prompt_id = prompt["_id"]
        
        # Calculate actual rating stats from reviews
        pipeline = [
            {"$match": {"prompt_id": prompt_id, "status": "approved"}},
            {"$group": {
                "_id": None,
                "avg_rating": {"$avg": "$rating"},
                "count": {"$sum": 1}
            }}
        ]
        
        result = await reviews_collection.aggregate(pipeline).to_list(1)
        
        if result:
            avg_rating = round(result[0]["avg_rating"], 1)
            review_count = result[0]["count"]
        else:
            avg_rating = 0
            review_count = 0
        
        # Update the prompt
        await prompts_collection.update_one(
            {"_id": prompt_id},
            {"$set": {"avg_rating": avg_rating, "review_count": review_count}}
        )
        updated_count += 1
        print(f"Updated prompt {prompt_id}: avg_rating={avg_rating}, review_count={review_count}")
    
    print(f"\n✅ Migration complete! Updated {updated_count} prompts.")
    
    # Also ensure liked_by exists on all prompts
    result = await prompts_collection.update_many(
        {"liked_by": {"$exists": False}},
        {"$set": {"liked_by": []}}
    )
    if result.modified_count > 0:
        print(f"✅ Added liked_by field to {result.modified_count} prompts.")
    
    # Ensure like_count exists
    result = await prompts_collection.update_many(
        {"like_count": {"$exists": False}},
        {"$set": {"like_count": 0}}
    )
    if result.modified_count > 0:
        print(f"✅ Added like_count field to {result.modified_count} prompts.")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
