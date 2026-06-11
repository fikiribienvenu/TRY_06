from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from passlib.context import CryptContext

uri = 'mongodb+srv://fikiribienvenu6_db_user:Try06123@cluster0.vz6amgm.mongodb.net/pulmoscan?appName=Cluster0&ssl=true'
client = MongoClient(uri, server_api=ServerApi('1'), serverSelectionTimeoutMS=10000)
db = client['pulmoscan']

user = db.users.find_one({'email': 'director@pulmoscan.ai'})
stored_hash = user.get('hashed_password', '')

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Test both possible passwords
for pw in ['Director@2024!', 'Director@2026!']:
    match = pwd_context.verify(pw, stored_hash)
    print(f'  Password "{pw}" matches: {match}')
