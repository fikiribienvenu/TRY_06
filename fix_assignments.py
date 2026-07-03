from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

uri = 'mongodb+srv://fikiribienvenu6_db_user:Try06123@cluster0.vz6amgm.mongodb.net/pulmoscan?appName=Cluster0&ssl=true'
client = MongoClient(uri, server_api=ServerApi('1'))
db = client['pulmoscan']

jr = db.users.find_one({'role': 'junior_doctor'})
jr_id = str(jr['_id'])
print(f"Current Junior Doctor: {jr['email']}  id={jr_id}")

# Reassign all patients and ct_scans to the current junior doctor
p_result = db.patients.update_many({}, {"$set": {"assigned_doctor_id": jr_id}})
s_result = db.ct_scans.update_many({}, {"$set": {"assigned_doctor_id": jr_id}})

print(f"Updated {p_result.modified_count} patients → assigned to {jr['email']}")
print(f"Updated {s_result.modified_count} CT scans  → assigned to {jr['email']}")

# Show final state
print("\n=== Patients ===")
for p in db.patients.find():
    print(f"  {p.get('full_name','?'):<30} assigned_doctor={p.get('assigned_doctor_id')}")

print("\n=== CT Scans ===")
for s in db.ct_scans.find():
    print(f"  status={s.get('status'):<15} file={s.get('file_name','none'):<20} doctor={s.get('assigned_doctor_id')}")

print("\n=== Reports ===")
for r in db.reports.find():
    print(f"  status={r.get('status'):<20} junior_doctor_id={r.get('junior_doctor_id')}")
