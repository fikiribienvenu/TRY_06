"""
Migration: rename role 'junior_doctor' -> 'radiologist' in MongoDB
"""
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

uri = 'mongodb+srv://fikiribienvenu6_db_user:Try06123@cluster0.vz6amgm.mongodb.net/pulmoscan?appName=Cluster0&ssl=true'
client = MongoClient(uri, server_api=ServerApi('1'))
db = client['pulmoscan']

# Fix users
r = db.users.update_many({"role": "junior_doctor"}, {"$set": {"role": "radiologist"}})
print(f"Users updated: {r.modified_count} (junior_doctor → radiologist)")

# Verify
print("\nAll users now:")
for u in db.users.find({}, {"email": 1, "role": 1}):
    print(f"  {u['role']:<20} {u['email']}")
