from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from datetime import datetime, timezone
from bson import ObjectId

uri = 'mongodb+srv://fikiribienvenu6_db_user:Try06123@cluster0.vz6amgm.mongodb.net/pulmoscan?appName=Cluster0&ssl=true'
client = MongoClient(uri, server_api=ServerApi('1'), serverSelectionTimeoutMS=10000)
db = client['pulmoscan']

patient = db.patients.find_one({})
doctor  = db.users.find_one({'role': 'radiologist'})
recept  = db.users.find_one({'role': 'receptionist'})

patient_id = str(patient['_id'])
doctor_id  = str(doctor['_id'])
recept_id  = str(recept['_id'])

scan = {
    'patient_id':          patient_id,
    'requested_by':        recept_id,
    'assigned_doctor_id':  doctor_id,
    'file_path':           '',
    'file_name':           '',
    'file_type':           '',
    'file_size_kb':        0.0,
    'priority':            'normal',
    'status':              'assigned',
    'scan_date':           None,
    'notes':               'CT scan requested for lung cancer screening',
    'heatmap_path':        None,
    'prediction_id':       None,
    'report_id':           None,
    'created_at':          datetime.now(timezone.utc),
    'updated_at':          datetime.now(timezone.utc),
}

result = db.ct_scans.insert_one(scan)
print(f"CT scan created: {result.inserted_id}")
print(f"  patient: {patient.get('full_name', patient_id)}")
print(f"  doctor:  {doctor.get('email')}")
print(f"  status:  assigned")
print()
print("The Radiologist can now see and upload this scan at /radiologist/scans")
