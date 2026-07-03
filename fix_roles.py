from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from passlib.context import CryptContext

uri = 'mongodb+srv://fikiribienvenu6_db_user:Try06123@cluster0.vz6amgm.mongodb.net/pulmoscan?appName=Cluster0&ssl=true'
client = MongoClient(uri, server_api=ServerApi('1'), serverSelectionTimeoutMS=10000)
db = client['pulmoscan']
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Fix roles and passwords for all staff
fixes = [
    # email,                          correct_role,       password
    ("badmanusual@gmail.com",         "junior_doctor",    "JuniorDr@2026!"),
    ("fikiribienve@gmail.com",        "receptionist",     "Recept@2026!"),
    ("fikiribienvenu6@gmail.com",     "senior_doctor",    "SeniorDr@2026!"),
    ("fikiribienvenuregis@gmail.com", "patient",          "Patient@2026!"),
    ("director@pulmoscan.ai",         "director",         "Director@2026!"),
]

print("Fixing roles and passwords:\n")
for email, role, pw in fixes:
    hashed = pwd_context.hash(pw)
    result = db.users.update_one(
        {"email": email},
        {"$set": {
            "role": role,
            "hashed_password": hashed,
            "must_change_password": False,
            "is_active": True,
        }}
    )
    status = "FIXED" if result.matched_count else "NOT FOUND"
    print(f"  [{status}]  {email:<40}  role={role:<15}  pw={pw}")

print("\n=== All users after fix ===")
for u in db.users.find():
    print(f"  {u['role']:<20} {u['email']}  active={u.get('is_active')}")
