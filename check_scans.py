from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

uri = 'mongodb+srv://fikiribienvenu6_db_user:Try06123@cluster0.vz6amgm.mongodb.net/pulmoscan?appName=Cluster0&ssl=true'
client = MongoClient(uri, server_api=ServerApi('1'), serverSelectionTimeoutMS=10000)
db = client['pulmoscan']

# Get radiologist
jr = db.users.find_one({'role': 'radiologist'})
print(f"Radiologist: {jr['email']}  id={jr['_id']}")

# Get patients
patients = list(db.patients.find({}, {'patient_id': 1, 'full_name': 1, 'assigned_doctor_id': 1}))
print(f"\nPatients ({len(patients)}):")
for p in patients:
    print(f"  {p.get('full_name','?')}  pid={p.get('patient_id')}  assigned_doctor={p.get('assigned_doctor_id','none')}  id={p['_id']}")

# Get CT scans
scans = list(db.ct_scans.find({}, {'patient_id': 1, 'status': 1, 'assigned_doctor_id': 1, 'file_name': 1}))
print(f"\nCT Scans ({len(scans)}):")
for s in scans:
    print(f"  status={s.get('status')}  doctor={s.get('assigned_doctor_id','none')}  file={s.get('file_name','none')}  id={s['_id']}")
