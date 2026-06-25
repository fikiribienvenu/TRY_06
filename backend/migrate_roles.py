"""
One-time migration: rename role 'junior_doctor' -> 'radiologist' in the users collection.
Run from the backend directory: python migrate_roles.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URL = "mongodb+srv://fikiribienvenu6_db_user:Try06123@cluster0.vz6amgm.mongodb.net/pulmoscan?appName=Cluster0&ssl=true"
DB_NAME = "pulmoscan"


async def migrate():
    client = AsyncIOMotorClient(MONGODB_URL, serverSelectionTimeoutMS=30000)
    db = client[DB_NAME]
    collection = db["users"]

    result = await collection.update_many(
        {"role": "junior_doctor"},
        {"$set": {"role": "radiologist"}},
    )

    print(f"Matched:  {result.matched_count}")
    print(f"Modified: {result.modified_count}")
    client.close()


asyncio.run(migrate())
