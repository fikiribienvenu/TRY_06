from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from passlib.context import CryptContext

uri = 'mongodb+srv://fikiribienvenu6_db_user:Try06123@cluster0.vz6amgm.mongodb.net/pulmoscan?appName=Cluster0&ssl=true'
client = MongoClient(uri, server_api=ServerApi('1'), serverSelectionTimeoutMS=10000)
db = client['pulmoscan']
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Print all users with roles
print("All users:")
for u in db.users.find():
    print(f"  {u['role']:<20} {u['email']}")

print()

# Reset all to known passwords
resets = [
    ("director@pulmoscan.ai",      "Director@2026!"),
    ("badmanusual@gmail.com",       "JuniorDr@2026!"),
    ("adygrafix@gmail.com",         "Recept@2026!"),
    ("fikiribienvenu6@gmail.com",   "SeniorDr@2026!"),
    ("fikiribienve@gmail.com",      "Patient@2026!"),
]

for email, pw in resets:
    hashed = pwd_context.hash(pw)
    result = db.users.update_one(
        {"email": email},
        {"$set": {"hashed_password": hashed, "must_change_password": False}}
    )
    if result.matched_count:
        print(f"  Reset: {email}  →  {pw}")
    else:
        print(f"  NOT FOUND: {email}")

print("\nDone.")
