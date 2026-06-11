from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from passlib.context import CryptContext

uri = 'mongodb+srv://fikiribienvenu6_db_user:Try06123@cluster0.vz6amgm.mongodb.net/pulmoscan?appName=Cluster0&ssl=true'
client = MongoClient(uri, server_api=ServerApi('1'), serverSelectionTimeoutMS=10000)
db = client['pulmoscan']

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Reset passwords for all non-director users to known values
resets = [
    ("badmanusual@gmail.com",         "JuniorDr@2026!"),   # junior doctor
    ("adygrafix@gmail.com",           "Recept@2026!"),      # receptionist
    ("fikiribienvenu6@gmail.com",     "SeniorDr@2026!"),    # senior doctor
    ("fikiribienve@gmail.com",        "Patient@2026!"),     # patient
]

for email, new_pw in resets:
    hashed = pwd_context.hash(new_pw)
    result = db.users.update_one(
        {"email": email},
        {"$set": {"hashed_password": hashed, "must_change_password": False}}
    )
    if result.matched_count:
        print(f"  Reset: {email}  →  {new_pw}")
    else:
        print(f"  NOT FOUND: {email}")

print("\nDone. Use these credentials to log in.")
