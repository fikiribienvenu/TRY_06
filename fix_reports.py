"""
Fix reports collection:
1. Rename field junior_doctor_id → radiologist_id
2. Set radiologist_id from junior_doctor_id if missing
"""
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

uri = 'mongodb+srv://fikiribienvenu6_db_user:Try06123@cluster0.vz6amgm.mongodb.net/pulmoscan?appName=Cluster0&ssl=true'
client = MongoClient(uri, server_api=ServerApi('1'))
db = client['pulmoscan']

# Get current radiologist
radiologist = db.users.find_one({'role': 'radiologist'})
rad_id = str(radiologist['_id'])
print(f"Radiologist: {radiologist['email']}  id={rad_id}")

reports = list(db.reports.find())
print(f"\nTotal reports: {len(reports)}")

fixed = 0
for r in reports:
    update = {}

    # If radiologist_id is missing but junior_doctor_id exists → rename
    if not r.get('radiologist_id') and r.get('junior_doctor_id'):
        update['$set'] = {'radiologist_id': r['junior_doctor_id']}
        update['$unset'] = {'junior_doctor_id': ''}

    # If both missing → assign current radiologist
    elif not r.get('radiologist_id') and not r.get('junior_doctor_id'):
        update['$set'] = {'radiologist_id': rad_id}

    if update:
        db.reports.update_one({'_id': r['_id']}, update)
        fixed += 1

print(f"Fixed {fixed} reports")

# Verify
print("\nReports after fix:")
for r in db.reports.find({}, {'status': 1, 'radiologist_id': 1, 'patient_id': 1}):
    print(f"  status={r.get('status'):<20}  radiologist_id={r.get('radiologist_id','MISSING')}")
