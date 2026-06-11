from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

uri = 'mongodb+srv://fikiribienvenu6_db_user:Try06123@cluster0.vz6amgm.mongodb.net/pulmoscan?appName=Cluster0&ssl=true'
client = MongoClient(uri, server_api=ServerApi('1'), serverSelectionTimeoutMS=10000)
db = client['pulmoscan']

users = list(db.users.find({}, {'email': 1, 'role': 1, 'is_active': 1, 'must_change_password': 1}))
print(f"Total users: {len(users)}")
print()
for u in users:
    print(f"  role={u['role']:<20} email={u['email']}  active={u.get('is_active')}  must_change_pw={u.get('must_change_password')}")
